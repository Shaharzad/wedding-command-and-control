/* A stand-in backend for the browser tests.

   Not shipped in index.html — the harness injects it. It keeps its "database"
   in localStorage and broadcasts changes over BroadcastChannel, so two pages in
   the same browser behave like two people on two machines: real concurrent
   writes, real realtime delivery, real role enforcement.

   It is a test double, not a security model. The actual rules are the RLS
   policies in supabase/migrations/0001_init.sql, which only a real project can
   exercise. */
window.WCC = window.WCC || {};

(function (W) {
  'use strict';

  var DB_KEY = 'wcc.fake.db';
  var CHANNEL = 'wcc-fake-sync';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(DB_KEY)) ||
        { weddings: {}, members: [], records: {}, comments: [], activity: [] };
    } catch (err) {
      return { weddings: {}, members: [], records: {}, comments: [], activity: [] };
    }
  }

  function persist(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function key(w, c, i) { return w + '|' + c + '|' + i; }
  function now() { return new Date().toISOString(); }

  function create(opts) {
    var me = {
      id: opts.userId || 'user_' + Math.random().toString(36).slice(2, 8),
      email: opts.email || 'someone@example.com'
    };
    var signedIn = opts.signedIn !== false;
    var channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
    var listeners = [];

    if (channel) {
      channel.onmessage = function (e) {
        var msg = e.data;
        if (!msg || msg.from === me.id) return;
        listeners.forEach(function (l) {
          if (l.weddingId === msg.weddingId) l.onRow(msg.row);
        });
      };
    }

    function announce(weddingId, row) {
      if (channel) channel.postMessage({ from: me.id, weddingId: weddingId, row: row });
    }

    function myRole(db, weddingId) {
      for (var i = 0; i < db.members.length; i++) {
        var m = db.members[i];
        if (m.wedding_id === weddingId && m.user_id === me.id && m.accepted_at) return m.role;
      }
      return null;
    }

    function requireWrite(db, weddingId) {
      var r = myRole(db, weddingId);
      if (r !== 'owner' && r !== 'editor') {
        var err = new Error('new row violates row-level security policy');
        err.code = '42501';
        throw err;
      }
    }

    function logActivity(db, weddingId, collection, id, op, data) {
      if (collection === 'history' || collection === 'singleton') return;
      db.activity.push({
        id: db.activity.length + 1, wedding_id: weddingId, actor: me.id,
        collection: collection, record_id: id, op: op,
        summary: (data && (data.title || data.name || data.item || data.outfit ||
          data.description || data.person || data.from || data.category)) || '',
        at: now()
      });
    }

    return {
      /* test helpers */
      __me: me,
      __reset: function () {
        localStorage.removeItem(DB_KEY);
      },

      auth: {
        signIn: function (email) { me.email = email; signedIn = true; return Promise.resolve({}); },
        signOut: function () { signedIn = false; return Promise.resolve({}); },
        getUser: function () { return Promise.resolve(signedIn ? me : null); },
        onChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; }
      },

      weddings: {
        list: function () {
          var db = load();
          return Promise.resolve(db.members.filter(function (m) {
            return m.user_id === me.id && m.accepted_at;
          }).map(function (m) {
            return {
              id: m.wedding_id,
              name: (db.weddings[m.wedding_id] || {}).name || 'Our wedding',
              role: m.role
            };
          }));
        },
        create: function (name, displayName) {
          var db = load();
          var id = 'w_' + Math.random().toString(36).slice(2, 10);
          db.weddings[id] = { id: id, name: name || 'Our wedding', created_by: me.id };
          db.members.push({
            id: 'm_' + Math.random().toString(36).slice(2, 8),
            wedding_id: id, user_id: me.id, invited_email: null,
            role: 'owner', display_name: displayName || null, accepted_at: now()
          });
          persist(db);
          return Promise.resolve(id);
        },
        acceptInvites: function () {
          var db = load(), n = 0;
          db.members.forEach(function (m) {
            if (!m.user_id && m.invited_email &&
                String(m.invited_email).toLowerCase() === me.email.toLowerCase()) {
              m.user_id = me.id;
              m.accepted_at = now();
              n += 1;
            }
          });
          persist(db);
          return Promise.resolve(n);
        }
      },

      members: {
        list: function (weddingId) {
          var db = load();
          return Promise.resolve(db.members.filter(function (m) {
            return m.wedding_id === weddingId;
          }));
        },
        mine: function (weddingId) {
          var db = load();
          for (var i = 0; i < db.members.length; i++) {
            var m = db.members[i];
            if (m.wedding_id === weddingId && m.user_id === me.id && m.accepted_at) {
              return Promise.resolve({ id: m.id, role: m.role, display_name: m.display_name });
            }
          }
          return Promise.resolve(null);
        },
        setName: function (weddingId, name) {
          var db = load();
          var cleaned = String(name || '').trim().slice(0, 60);
          if (!cleaned) return Promise.reject(new Error('a name is required'));
          db.members.forEach(function (m) {
            if (m.wedding_id === weddingId && m.user_id === me.id) m.display_name = cleaned;
          });
          persist(db);
          return Promise.resolve(cleaned);
        },
        invite: function (weddingId, email, role) {
          var db = load();
          db.members.push({
            id: 'm_' + Math.random().toString(36).slice(2, 8),
            wedding_id: weddingId, user_id: null, invited_email: email,
            role: role || 'editor', display_name: null, accepted_at: null
          });
          persist(db);
          return Promise.resolve([]);
        },
        setRole: function (memberId, role) {
          var db = load();
          db.members.forEach(function (m) { if (m.id === memberId) m.role = role; });
          persist(db);
          return Promise.resolve([]);
        },
        remove: function (memberId) {
          var db = load();
          db.members = db.members.filter(function (m) { return m.id !== memberId; });
          persist(db);
          return Promise.resolve([]);
        }
      },

      records: {
        loadAll: function (weddingId) {
          var db = load();
          var out = [];
          Object.keys(db.records).forEach(function (k) {
            if (k.indexOf(weddingId + '|') === 0) out.push(db.records[k]);
          });
          return Promise.resolve(out);
        },
        upsertMany: function (weddingId, rows) {
          var db = load();
          try { requireWrite(db, weddingId); } catch (err) { return Promise.reject(err); }
          rows.forEach(function (r) {
            var k = key(weddingId, r.collection, r.id);
            var existed = !!db.records[k];
            db.records[k] = {
              wedding_id: weddingId, collection: r.collection, id: r.id,
              data: r.data, updated_at: now(), updated_by: me.id, deleted_at: null
            };
            logActivity(db, weddingId, r.collection, r.id, existed ? 'update' : 'create', r.data);
          });
          persist(db);
          rows.forEach(function (r) {
            announce(weddingId, db.records[key(weddingId, r.collection, r.id)]);
          });
          return Promise.resolve([]);
        },
        setDeleted: function (weddingId, collection, id, deleted) {
          var db = load();
          try { requireWrite(db, weddingId); } catch (err) { return Promise.reject(err); }
          var k = key(weddingId, collection, id);
          if (db.records[k]) {
            db.records[k].deleted_at = deleted ? now() : null;
            db.records[k].updated_at = now();
            db.records[k].updated_by = me.id;
            logActivity(db, weddingId, collection, id,
              deleted ? 'delete' : 'restore', db.records[k].data);
            persist(db);
            announce(weddingId, db.records[k]);
          }
          return Promise.resolve([]);
        },
        clearAll: function (weddingId) {
          var db = load();
          try { requireWrite(db, weddingId); } catch (err) { return Promise.reject(err); }
          Object.keys(db.records).forEach(function (k) {
            if (k.indexOf(weddingId + '|') === 0) delete db.records[k];
          });
          persist(db);
          return Promise.resolve([]);
        },
        bump: function (weddingId, collection, id, field, delta, patch) {
          var db = load();
          try { requireWrite(db, weddingId); } catch (err) { return Promise.reject(err); }
          var k = key(weddingId, collection, id);
          if (db.records[k]) {
            var d = db.records[k].data || {};
            Object.keys(patch || {}).forEach(function (pk) { d[pk] = patch[pk]; });
            d[field] = Math.max(0, (Number(d[field]) || 0) + delta);
            db.records[k].data = d;
            db.records[k].updated_at = now();
            db.records[k].updated_by = me.id;
            persist(db);
            announce(weddingId, db.records[k]);
          }
          return Promise.resolve(db.records[k] ? db.records[k].data : null);
        }
      },

      comments: {
        list: function (weddingId, collection, recordId) {
          var db = load();
          return Promise.resolve(db.comments.filter(function (c) {
            return c.wedding_id === weddingId && c.collection === collection &&
              c.record_id === recordId;
          }));
        },
        add: function (weddingId, collection, recordId, body) {
          var db = load();
          db.comments.push({
            id: 'c_' + Math.random().toString(36).slice(2, 8),
            wedding_id: weddingId, collection: collection, record_id: recordId,
            author_id: me.id, body: body, created_at: now()
          });
          persist(db);
          return Promise.resolve([]);
        }
      },

      activity: {
        list: function (weddingId, limit) {
          var db = load();
          return Promise.resolve(db.activity.filter(function (a) {
            return a.wedding_id === weddingId;
          }).sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, limit || 100));
        }
      },

      realtime: {
        subscribe: function (weddingId, onRow) {
          var entry = { weddingId: weddingId, onRow: onRow };
          listeners.push(entry);
          return {
            unsubscribe: function () {
              listeners = listeners.filter(function (l) { return l !== entry; });
            }
          };
        }
      }
    };
  }

  W.FakeBackend = { create: create };
})(window.WCC);
