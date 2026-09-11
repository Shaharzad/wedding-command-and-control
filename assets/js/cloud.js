/* The sync layer.

   The app stays exactly as it was: all state in memory, every render
   synchronous. Only the network is async, and it lives entirely in here.

   - load    fetch every record for a wedding in ONE query, then hand the
             assembled state to Store. Partial loads are never allowed, because
             normalise() treats an unresolved eventId as a dead reference and
             deletes seating tables and run-of-show slots outright.
   - write   the UI mutates memory and returns immediately; the change is
             queued and pushed behind it.
   - remote  a change from someone else patches the record in place and calls
             the store's own notify(), which re-renders as usual.

   The backend is injected (`Cloud.use`) so the browser tests can run against an
   in-memory fake instead of a real project. */
window.WCC = window.WCC || {};

(function (W) {
  'use strict';

  var U = W.Util;
  var Cloud = {};

  var backend = null;
  var weddingId = '';
  var user = null;
  var role = 'editor';
  var myName = '';
  var statusListeners = [];
  /* Names have to be available synchronously during a render, so the member
     list is fetched once when the wedding opens and kept here. */
  var directory = [];
  var status = { online: true, syncing: false, error: null };

  /* Collections that live as plain arrays of records on the state object. */
  var LIST_COLLECTIONS = ['events', 'tasks', 'budget', 'guests', 'vendors',
    'wardrobe', 'shopping', 'contacts', 'tables', 'decor', 'shots', 'nikah',
    'gifts', 'responsibilities', 'timeline'];

  /* Nested arrays get their own collection name. */
  var NESTED = {
    menu: { path: ['catering', 'items'] },
    honeymoonItems: { path: ['honeymoon', 'items'] }
  };

  /* Single objects stored as one row each under the `singleton` collection.
     meta.savedAt and meta.onboarded are per-device and deliberately excluded —
     syncing them would make every save a write everyone else sees. */
  var SINGLETONS = {
    settings: function (s) { return U.clone(s.settings); },
    catering: function (s) { return { guestCount: s.catering.guestCount }; },
    honeymoon: function (s) {
      var h = s.honeymoon;
      return {
        destination: h.destination, startDate: h.startDate,
        endDate: h.endDate, budget: h.budget, notes: h.notes
      };
    },
    meta: function (s) {
      return {
        createdAt: s.meta.createdAt,
        seeded: s.meta.seeded,
        lastExportAt: s.meta.lastExportAt
      };
    }
  };

  Cloud.LIST_COLLECTIONS = LIST_COLLECTIONS;
  Cloud.NESTED = NESTED;

  /* ------------------------------------------------------ state <-> rows -- */

  /* Every record in the state, as flat rows ready for the records table. */
  Cloud.flatten = function (state) {
    var rows = [];
    LIST_COLLECTIONS.forEach(function (c) {
      (state[c] || []).forEach(function (rec) {
        rows.push({ collection: c, id: rec.id, data: rec });
      });
    });
    Object.keys(NESTED).forEach(function (c) {
      var p = NESTED[c].path;
      var list = (state[p[0]] || {})[p[1]] || [];
      list.forEach(function (rec) {
        rows.push({ collection: c, id: rec.id, data: rec });
      });
    });
    (state.history || []).forEach(function (h) {
      rows.push({ collection: 'history', id: h.date, data: h });
    });
    Object.keys(SINGLETONS).forEach(function (id) {
      rows.push({ collection: 'singleton', id: id, data: SINGLETONS[id](state) });
    });
    return rows;
  };

  /* Rows back into the shape normalise() expects. Soft-deleted rows are
     dropped here so the rest of the app never has to know about them. */
  Cloud.hydrate = function (rows) {
    var state = { schema: 3, catering: { guestCount: 0, items: [] },
      honeymoon: { items: [] }, history: [], settings: {}, meta: {} };
    LIST_COLLECTIONS.forEach(function (c) { state[c] = []; });

    rows.forEach(function (row) {
      if (row.deleted_at) return;
      var c = row.collection;
      var data = row.data || {};
      if (c === 'singleton') {
        if (row.id === 'catering') state.catering.guestCount = data.guestCount;
        else if (row.id === 'settings') state.settings = data;
        else if (row.id === 'meta') state.meta = data;
        else if (row.id === 'honeymoon') {
          Object.keys(data).forEach(function (k) { state.honeymoon[k] = data[k]; });
        }
        return;
      }
      if (c === 'history') { state.history.push(data); return; }
      if (NESTED[c]) {
        var p = NESTED[c].path;
        state[p[0]][p[1]].push(data);
        return;
      }
      if (state[c]) state[c].push(data);
    });
    return state;
  };

  /* Where a given collection's array lives on the state object. */
  Cloud.listFor = function (state, collection) {
    if (NESTED[collection]) {
      var p = NESTED[collection].path;
      return state[p[0]][p[1]];
    }
    if (collection === 'history') return state.history;
    return state[collection] || null;
  };

  /* ------------------------------------------------------------- status -- */

  function setStatus(patch) {
    var changed = false;
    Object.keys(patch).forEach(function (k) {
      if (status[k] !== patch[k]) { status[k] = patch[k]; changed = true; }
    });
    if (!changed) return;
    statusListeners.forEach(function (fn) {
      try { fn(Cloud.status()); } catch (err) { /* one listener must not stop the rest */ }
    });
  }

  Cloud.status = function () {
    return {
      online: status.online, syncing: status.syncing, error: status.error,
      enabled: !!backend, weddingId: weddingId, role: role,
      user: user ? { id: user.id, email: user.email } : null
    };
  };
  Cloud.onStatus = function (fn) { statusListeners.push(fn); };
  Cloud.isEnabled = function () { return !!backend; };
  Cloud.weddingId = function () { return weddingId; };
  Cloud.user = function () { return user; };
  Cloud.role = function () { return role; };
  Cloud.myName = function () { return myName; };
  Cloud.setMyName = function (name) {
    return backend.members.setName(weddingId, name).then(function (saved) {
      myName = String(saved || name || '').trim();
      return Cloud.refreshDirectory();
    });
  };
  Cloud.canWrite = function () { return !backend || role === 'owner' || role === 'editor'; };

  /* -------------------------------------------------------- push queue --- */

  var queue = [];
  var draining = false;
  var retryTimer = null;

  function scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(function () { retryTimer = null; drain(); }, 4000);
  }

  function drain() {
    if (draining || !queue.length || !backend) return;
    if (!status.online) { setStatus({ syncing: false }); return; }
    draining = true;
    setStatus({ syncing: true });

    var job = queue[0];
    job().then(function () {
      queue.shift();
      draining = false;
      if (queue.length) drain();
      else setStatus({ syncing: false, error: null });
    }).catch(function (err) {
      draining = false;
      setStatus({ syncing: false, error: String((err && err.message) || err) });
      scheduleRetry();
    });
  }

  Cloud.pendingWrites = function () { return queue.length; };

  Cloud.flush = function () {
    /* Used by tests and by "export before you lose it" paths. */
    return new Promise(function (resolve) {
      var tick = function () {
        if (!queue.length && !draining) resolve(true);
        else setTimeout(tick, 30);
      };
      drain();
      tick();
    });
  };

  /* ----------------------------------------------------------- writing --- */

  /* change is one of:
       {c, id}                     upsert one record
       {c, id, op:'delete'}        retire one record
       {c, id, op:'restore'}       bring one back
       {rows:[{c, id}]}            upsert several
       {full:true, deletes:[...]}  push everything, retire the listed records
       {replaceAll:true}           clear the wedding and write this state
       {bump:{c,id,field,delta,patch}}  add to a number without reading it first */
  Cloud.push = function (change, state) {
    if (!backend || !weddingId || !change) return;
    if (!Cloud.canWrite()) return;

    if (change.replaceAll) {
      /* Import, sample data and reset replace the whole wedding, so what was
         there has to go rather than linger for everyone else. */
      queue.push(function () {
        return backend.records.clearAll(weddingId).then(function () {
          return backend.records.upsertMany(weddingId, Cloud.flatten(state));
        });
      });
    } else if (change.full) {
      var retire = change.deletes || [];
      queue.push(function () {
        return backend.records.upsertMany(weddingId, Cloud.flatten(state))
          .then(function () {
            return retire.reduce(function (chain, d) {
              return chain.then(function () {
                return backend.records.setDeleted(weddingId, d.c, d.id, true);
              });
            }, Promise.resolve());
          });
      });
    } else if (change.rows) {
      var many = change.rows.map(function (r) { return rowFor(state, r.c, r.id); })
        .filter(Boolean);
      if (!many.length) return;
      queue.push(function () {
        return backend.records.upsertMany(weddingId, many);
      });
    } else if (change.bump) {
      var b = change.bump;
      queue.push(function () {
        return backend.records.bump(weddingId, b.c, b.id, b.field, b.delta, b.patch || {});
      });
    } else if (change.op === 'delete') {
      queue.push(function () {
        return backend.records.setDeleted(weddingId, change.c, change.id, true);
      });
    } else if (change.op === 'restore') {
      queue.push(function () {
        return backend.records.setDeleted(weddingId, change.c, change.id, false);
      });
    } else {
      var row = rowFor(state, change.c, change.id);
      if (!row) return;
      queue.push(function () {
        return backend.records.upsertMany(weddingId, [row]);
      });
    }
    drain();
  };

  function rowFor(state, collection, id) {
    if (collection === 'singleton') {
      if (!SINGLETONS[id]) return null;
      return { collection: 'singleton', id: id, data: SINGLETONS[id](state) };
    }
    var list = Cloud.listFor(state, collection);
    if (!list) return null;
    var key = collection === 'history' ? 'date' : 'id';
    for (var i = 0; i < list.length; i++) {
      if (list[i][key] === id) {
        return { collection: collection, id: id, data: list[i] };
      }
    }
    return null;
  }

  /* ---------------------------------------------------------- sessions --- */

  Cloud.use = function (impl) {
    backend = impl;
    setStatus({ error: null });
    return Cloud;
  };

  Cloud.signIn = function (email) { return backend.auth.signIn(email); };
  Cloud.signOut = function () {
    if (subscription) { subscription.unsubscribe(); subscription = null; }
    weddingId = '';
    user = null;
    queue.length = 0;
    return backend.auth.signOut();
  };

  Cloud.restoreSession = function () {
    return backend.auth.getUser().then(function (u) {
      user = u;
      return u;
    });
  };

  Cloud.listWeddings = function () { return backend.weddings.list(); };
  Cloud.createWedding = function (name, displayName) {
    return backend.weddings.create(name, displayName);
  };
  Cloud.acceptInvites = function () { return backend.weddings.acceptInvites(); };

  /* -------------------------------------------------------- opening up --- */

  var subscription = null;

  /* Loads everything for a wedding in one go and hands it back assembled. */
  Cloud.open = function (id) {
    weddingId = id;
    return backend.records.loadAll(id).then(function (rows) {
      return backend.members.mine(id).then(function (m) {
        role = (m && m.role) || 'viewer';
        myName = (m && m.display_name) || '';
        return backend.members.list(id).then(function (all) {
          Cloud.setDirectory(all);
          return Cloud.hydrate(rows);
        }).catch(function () { return Cloud.hydrate(rows); });
      });
    });
  };

  /* Someone who joins after you opened the app would otherwise never appear in
     an assignment list. Re-read it when the window regains focus, and whenever
     the People page loads it. */
  Cloud.refreshDirectory = function () {
    if (!backend || !weddingId) return Promise.resolve(directory);
    return backend.members.list(weddingId).then(function (all) {
      var before = directory.length;
      Cloud.setDirectory(all);
      if (directory.length !== before && W.App && W.App.rerender) W.App.rerender();
      return directory;
    }).catch(function () { return directory; });
  };

  Cloud.setDirectory = function (rows) {
    directory = (rows || []).filter(function (m) { return m.user_id; })
      .map(function (m) {
        return {
          id: m.user_id,
          name: m.display_name || m.invited_email || '',
          role: m.role
        };
      });
  };

  /* Everyone who could be given a job. */
  Cloud.people = function () { return directory.slice(); };

  Cloud.personName = function (userId) {
    if (!userId) return '';
    for (var i = 0; i < directory.length; i++) {
      if (directory[i].id === userId) return directory[i].name;
    }
    return '';
  };

  Cloud.isMe = function (userId) {
    return !!(user && userId && user.id === userId);
  };

  /* onRemote({collection, id, data, deleted}) for every change made elsewhere. */
  Cloud.listen = function (onRemote) {
    if (!backend || !weddingId) return;
    if (subscription) subscription.unsubscribe();
    subscription = backend.realtime.subscribe(weddingId, function (row) {
      /* Our own writes come back too; the store ignores no-op patches. */
      onRemote({
        collection: row.collection,
        id: row.id,
        data: row.data,
        deleted: !!row.deleted_at,
        updatedBy: row.updated_by
      });
    });
  };

  Cloud.stopListening = function () {
    if (subscription) { subscription.unsubscribe(); subscription = null; }
  };

  Cloud.members = function () {
    return backend.members.list(weddingId).then(function (rows) {
      Cloud.setDirectory(rows);
      return rows;
    });
  };
  Cloud.invite = function (email, r) { return backend.members.invite(weddingId, email, r); };
  Cloud.setRole = function (memberId, r) { return backend.members.setRole(memberId, r); };
  Cloud.removeMember = function (memberId) { return backend.members.remove(memberId); };

  Cloud.comments = function (collection, recordId) {
    return backend.comments.list(weddingId, collection, recordId);
  };
  Cloud.addComment = function (collection, recordId, body) {
    return backend.comments.add(weddingId, collection, recordId, body);
  };
  Cloud.activity = function (limit) { return backend.activity.list(weddingId, limit); };

  /* --------------------------------------------------- connection state -- */

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('online', function () {
      setStatus({ online: true });
      drain();
    });
    window.addEventListener('offline', function () { setStatus({ online: false }); });
    window.addEventListener('focus', function () { Cloud.refreshDirectory(); });
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      status.online = false;
    }
  }

  W.Cloud = Cloud;
})(window.WCC);
