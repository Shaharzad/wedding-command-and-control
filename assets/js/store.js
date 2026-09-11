/* The single source of truth.
   One state object, one localStorage key, saved on every mutation, loaded on
   boot. Every number on screen is derived from here — nothing is stored twice. */
window.WCC = window.WCC || {};

(function (W) {
  'use strict';

  var U = W.Util;
  var KEY = 'wcc.wedding.v1';
  var SCHEMA = 3;

  var LINE_BREAK = new RegExp('\\r?\\n');
  /* Saves with one of these reasons can be undone: the copy already in
     localStorage is exactly the state before the delete. */
  var UNDOABLE = /^remove:/;
  var undoSnapshot = null;
  /* The exact records a delete touched, with the values they had beforehand.
     Undo restores only these, so it can never wipe out what someone else has
     changed in the meantime. */
  var undoRows = null;
  var cacheKey = KEY;
  var listeners = [];
  var lastSaveOk = true;

  /* ---------------------------------------------------------- defaults -- */

  function emptyState() {
    return {
      schema: SCHEMA,
      settings: {
        brideName: '',
        groomName: '',
        weddingDate: '',
        venue: '',
        hashtag: '',
        currency: 'PKR'
      },
      events: [],
      tasks: [],
      budget: [],
      guests: [],
      vendors: [],
      wardrobe: [],
      catering: { guestCount: 0, items: [] },
      shopping: [],
      contacts: [],
      tables: [],
      decor: [],
      shots: [],
      nikah: [],
      honeymoon: { destination: '', startDate: '', endDate: '', budget: 0, notes: '', items: [] },
      gifts: [],
      responsibilities: [],
      timeline: [],
      history: [],
      meta: {
        createdAt: U.nowISO(),
        onboarded: false,
        seeded: false,
        savedAt: '',
        lastExportAt: ''
      }
    };
  }

  /* ------------------------------------------------------- normalising --
     Runs on load and on import. Anything missing or the wrong type is repaired
     rather than allowed to blank the screen. */

  function str(v, fallback) {
    return typeof v === 'string' ? v : (fallback === undefined ? '' : fallback);
  }
  function oneOf(v, list, fallback) {
    return list.indexOf(v) >= 0 ? v : fallback;
  }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function dateStr(v) { return U.isValidISODate(v) ? String(v).slice(0, 10) : ''; }

  function normTask(t) {
    if (!t || typeof t !== 'object') t = {};
    var recurrence = oneOf(t.recurrence, ['none', 'daily', 'weekly'], 'none');
    var dates = arr(t.completedDates).filter(U.isValidISODate);
    dates.sort();
    var hasExplicitStatus = W.OPT.taskStatus.indexOf(t.status) >= 0;
    var status = hasExplicitStatus ? t.status : 'Not Started';
    var completedAt = typeof t.completedAt === 'string' && t.completedAt ? t.completedAt : null;

    /* A one-off task is Completed exactly when it has a completedAt stamp.
       An explicit status wins — that is how the edit form un-completes a task.
       A missing status falls back to whatever the stamp says. */
    if (recurrence === 'none') {
      if (status === 'Completed' && !completedAt) {
        if (!dates.length) dates = [U.todayISO()];
        completedAt = dates[dates.length - 1] + 'T09:00:00.000';
      }
      if (status !== 'Completed') {
        if (hasExplicitStatus) { completedAt = null; dates = []; }
        else if (completedAt) { status = 'Completed'; }
      }
    } else {
      completedAt = dates.length ? dates[dates.length - 1] + 'T09:00:00.000' : null;
      if (status === 'Completed') status = 'In Progress';
    }
    return {
      id: str(t.id) || U.uid('task'),
      title: str(t.title, 'Untitled task'),
      category: oneOf(t.category, W.OPT.taskCategory, 'Other'),
      priority: oneOf(t.priority, W.OPT.priority, 'Medium'),
      status: status,
      dueDate: dateStr(t.dueDate),
      notes: str(t.notes),
      recurrence: recurrence,
      /* Who is doing it. A member id on a shared wedding; empty otherwise. */
      assignee: str(t.assignee),
      completedAt: completedAt,
      completedDates: dates,
      createdAt: str(t.createdAt) || U.nowISO()
    };
  }

  function normBudget(b) {
    if (!b || typeof b !== 'object') b = {};
    return {
      id: str(b.id) || U.uid('bud'),
      category: oneOf(b.category, W.OPT.budgetCategory, 'Miscellaneous'),
      label: str(b.label),
      planned: Math.max(0, U.num(b.planned)),
      actual: Math.max(0, U.num(b.actual)),
      paymentStatus: oneOf(b.paymentStatus, W.OPT.paymentStatus, 'Unpaid'),
      vendor: str(b.vendor),
      paymentDate: dateStr(b.paymentDate),
      notes: str(b.notes)
    };
  }

  function normGuest(g) {
    if (!g || typeof g !== 'object') g = {};
    return {
      id: str(g.id) || U.uid('guest'),
      name: str(g.name, 'Unnamed guest'),
      group: str(g.group),
      side: oneOf(g.side, W.OPT.side, 'Both'),
      phone: str(g.phone),
      adults: Math.max(0, Math.round(U.num(g.adults, 1))),
      children: Math.max(0, Math.round(U.num(g.children, 0))),
      rsvp: oneOf(g.rsvp, W.OPT.rsvp, 'Pending'),
      invitation: oneOf(g.invitation, W.OPT.invitation, 'Not Sent'),
      invitationDate: dateStr(g.invitationDate),
      events: arr(g.events).filter(function (x) { return typeof x === 'string'; }),
      meal: oneOf(g.meal, W.OPT.meal, 'No preference'),
      notes: str(g.notes)
    };
  }

  function normEvent(e) {
    if (!e || typeof e !== 'object') e = {};
    return {
      id: str(e.id) || U.uid('evt'),
      name: str(e.name, 'Untitled event'),
      type: oneOf(e.type, W.OPT.eventType, 'Custom'),
      date: dateStr(e.date),
      startTime: /^\d{2}:\d{2}$/.test(e.startTime) ? e.startTime : '',
      endTime: /^\d{2}:\d{2}$/.test(e.endTime) ? e.endTime : '',
      venue: str(e.venue),
      address: str(e.address),
      dressCode: str(e.dressCode),
      theme: str(e.theme),
      expectedGuests: Math.max(0, Math.round(U.num(e.expectedGuests))),
      budget: Math.max(0, U.num(e.budget)),
      status: oneOf(e.status, W.OPT.eventStatus, 'Planning'),
      notes: str(e.notes)
    };
  }

  function normVendor(v) {
    if (!v || typeof v !== 'object') v = {};
    return {
      id: str(v.id) || U.uid('vnd'),
      name: str(v.name, 'Unnamed vendor'),
      category: oneOf(v.category, W.OPT.budgetCategory, 'Miscellaneous'),
      contactName: str(v.contactName),
      phone: str(v.phone),
      email: str(v.email),
      website: str(v.website),
      quotedPrice: Math.max(0, U.num(v.quotedPrice)),
      finalPrice: Math.max(0, U.num(v.finalPrice)),
      status: oneOf(v.status, W.OPT.vendorStatus, 'Researching'),
      eventId: str(v.eventId),
      /* The one link to the ledger. Paid and remaining are derived from it,
         never stored here, so there is only one set of figures. */
      budgetLineId: str(v.budgetLineId),
      /* Day-of information, used by the wedding-day sheet. */
      arrivalTime: /^\d{2}:\d{2}$/.test(v.arrivalTime) ? v.arrivalTime : '',
      notes: str(v.notes)
    };
  }

  function normWardrobe(w) {
    if (!w || typeof w !== 'object') w = {};
    return {
      id: str(w.id) || U.uid('wrd'),
      person: oneOf(w.person, W.OPT.person, 'Bride'),
      wearer: str(w.wearer),
      kind: oneOf(w.kind, W.OPT.wardrobeKind, 'Outfit'),
      outfit: str(w.outfit, 'Untitled item'),
      designer: str(w.designer),
      cost: Math.max(0, U.num(w.cost)),
      status: oneOf(w.status, W.OPT.wardrobeStatus, 'To Buy'),
      fittingDate: dateStr(w.fittingDate),
      eventId: str(w.eventId),
      notes: str(w.notes)
    };
  }

  function normMenuItem(m) {
    if (!m || typeof m !== 'object') m = {};
    return {
      id: str(m.id) || U.uid('menu'),
      course: oneOf(m.course, W.OPT.course, 'Main course'),
      name: str(m.name, 'Untitled dish'),
      costPerHead: Math.max(0, U.num(m.costPerHead)),
      eventId: str(m.eventId),
      notes: str(m.notes)
    };
  }

  function normCatering(c) {
    if (!c || typeof c !== 'object') c = {};
    return {
      guestCount: Math.max(0, Math.round(U.num(c.guestCount))),
      items: arr(c.items).map(normMenuItem)
    };
  }

  function normShopping(x) {
    if (!x || typeof x !== 'object') x = {};
    return {
      id: str(x.id) || U.uid('shop'),
      item: str(x.item, 'Untitled item'),
      category: oneOf(x.category, W.OPT.shoppingCategory, 'Other'),
      quantity: Math.max(1, Math.round(U.num(x.quantity, 1))),
      estimatedCost: Math.max(0, U.num(x.estimatedCost)),
      status: oneOf(x.status, W.OPT.shoppingStatus, 'To Buy'),
      assignedTo: str(x.assignedTo),
      assignee: str(x.assignee),
      purchaseDate: dateStr(x.purchaseDate),
      notes: str(x.notes)
    };
  }

  function normContact(c) {
    if (!c || typeof c !== 'object') c = {};
    return {
      id: str(c.id) || U.uid('con'),
      name: str(c.name, 'Unnamed contact'),
      role: oneOf(c.role, W.OPT.contactRole, 'Other'),
      relation: str(c.relation),
      phone: str(c.phone),
      email: str(c.email),
      notes: str(c.notes)
    };
  }

  function normTable(x) {
    if (!x || typeof x !== 'object') x = {};
    var seen = {};
    return {
      id: str(x.id) || U.uid('tbl'),
      name: str(x.name, 'Table'),
      capacity: Math.max(0, Math.round(U.num(x.capacity, 10))),
      eventId: str(x.eventId),
      guestIds: arr(x.guestIds).filter(function (g) {
        if (typeof g !== 'string' || seen[g]) return false;
        seen[g] = true;
        return true;
      }),
      notes: str(x.notes)
    };
  }

  function normDecor(x) {
    if (!x || typeof x !== 'object') x = {};
    return {
      id: str(x.id) || U.uid('dec'),
      area: oneOf(x.area, W.OPT.decorArea, 'Other'),
      eventId: str(x.eventId),
      description: str(x.description, 'Untitled note'),
      palette: str(x.palette),
      status: oneOf(x.status, W.OPT.decorStatus, 'Idea'),
      supplier: str(x.supplier),
      estimatedCost: Math.max(0, U.num(x.estimatedCost)),
      notes: str(x.notes)
    };
  }

  function normShot(x) {
    if (!x || typeof x !== 'object') x = {};
    return {
      id: str(x.id) || U.uid('shot'),
      category: oneOf(x.category, W.OPT.shotCategory, 'Candid'),
      description: str(x.description, 'Untitled shot'),
      people: str(x.people),
      eventId: str(x.eventId),
      mustHave: x.mustHave === true,
      done: x.done === true,
      notes: str(x.notes)
    };
  }

  function normNikah(x) {
    if (!x || typeof x !== 'object') x = {};
    return {
      id: str(x.id) || U.uid('nik'),
      item: str(x.item, 'Untitled item'),
      status: oneOf(x.status, W.OPT.nikahStatus, 'To Do'),
      owner: str(x.owner),
      dueDate: dateStr(x.dueDate),
      notes: str(x.notes)
    };
  }

  function normHoneymoonItem(x) {
    if (!x || typeof x !== 'object') x = {};
    return {
      id: str(x.id) || U.uid('hmi'),
      type: oneOf(x.type, W.OPT.honeymoonType, 'Other'),
      title: str(x.title, 'Untitled booking'),
      date: dateStr(x.date),
      cost: Math.max(0, U.num(x.cost)),
      status: oneOf(x.status, W.OPT.honeymoonStatus, 'To Book'),
      reference: str(x.reference),
      notes: str(x.notes)
    };
  }

  function normHoneymoon(h) {
    if (!h || typeof h !== 'object') h = {};
    return {
      destination: str(h.destination),
      startDate: dateStr(h.startDate),
      endDate: dateStr(h.endDate),
      budget: Math.max(0, U.num(h.budget)),
      notes: str(h.notes),
      items: arr(h.items).map(normHoneymoonItem)
    };
  }

  function normGift(x) {
    if (!x || typeof x !== 'object') x = {};
    return {
      id: str(x.id) || U.uid('gift'),
      guestId: str(x.guestId),
      from: str(x.from),
      kind: oneOf(x.kind, W.OPT.giftKind, 'Gift'),
      description: str(x.description),
      amount: Math.max(0, U.num(x.amount)),
      eventId: str(x.eventId),
      date: dateStr(x.date),
      thankYouSent: x.thankYouSent === true,
      notes: str(x.notes)
    };
  }

  function normResponsibility(x) {
    if (!x || typeof x !== 'object') x = {};
    return {
      id: str(x.id) || U.uid('resp'),
      person: str(x.person, 'Someone'),
      area: oneOf(x.area, W.OPT.responsibilityArea, 'Other'),
      description: str(x.description),
      eventId: str(x.eventId),
      assignee: str(x.assignee),
      status: oneOf(x.status, W.OPT.responsibilityStatus, 'Assigned'),
      notes: str(x.notes)
    };
  }

  function normSlot(x) {
    if (!x || typeof x !== 'object') x = {};
    return {
      id: str(x.id) || U.uid('slot'),
      eventId: str(x.eventId),
      time: /^\d{2}:\d{2}$/.test(x.time) ? x.time : '12:00',
      title: str(x.title, 'Untitled'),
      owner: str(x.owner),
      done: x.done === true,
      notes: str(x.notes)
    };
  }

  function normSnapshot(s) {
    if (!s || typeof s !== 'object' || !U.isValidISODate(s.date)) return null;
    return {
      date: String(s.date).slice(0, 10),
      tasksTotal: Math.max(0, Math.round(U.num(s.tasksTotal))),
      tasksDone: Math.max(0, Math.round(U.num(s.tasksDone))),
      budgetPlanned: Math.max(0, U.num(s.budgetPlanned)),
      budgetSpent: Math.max(0, U.num(s.budgetSpent)),
      guestsTotal: Math.max(0, Math.round(U.num(s.guestsTotal))),
      guestsConfirmed: Math.max(0, Math.round(U.num(s.guestsConfirmed))),
      vendorsBooked: Math.max(0, Math.round(U.num(s.vendorsBooked)))
    };
  }

  /* Which normaliser belongs to which collection — needed when a single
     record arrives on its own from another person's browser. */
  var NORMALISERS = {
    events: normEvent, tasks: normTask, budget: normBudget, guests: normGuest,
    vendors: normVendor, wardrobe: normWardrobe, shopping: normShopping,
    contacts: normContact, tables: normTable, decor: normDecor, shots: normShot,
    nikah: normNikah, gifts: normGift, responsibilities: normResponsibility,
    timeline: normSlot, menu: normMenuItem, honeymoonItems: normHoneymoonItem,
    history: normSnapshot
  };

  function normalise(raw, opts) {
    var base = emptyState();
    if (!raw || typeof raw !== 'object') return base;

    var s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    base.settings = {
      brideName: str(s.brideName),
      groomName: str(s.groomName),
      weddingDate: dateStr(s.weddingDate),
      venue: str(s.venue),
      hashtag: str(s.hashtag),
      currency: 'PKR'
    };

    base.tasks = arr(raw.tasks).map(normTask);
    base.budget = arr(raw.budget).map(normBudget);
    base.guests = arr(raw.guests).map(normGuest);
    base.events = arr(raw.events).map(normEvent);
    base.vendors = arr(raw.vendors).map(normVendor);
    base.wardrobe = arr(raw.wardrobe).map(normWardrobe);
    base.catering = normCatering(raw.catering);
    base.shopping = arr(raw.shopping).map(normShopping);
    base.contacts = arr(raw.contacts).map(normContact);
    base.tables = arr(raw.tables).map(normTable);
    base.decor = arr(raw.decor).map(normDecor);
    base.shots = arr(raw.shots).map(normShot);
    base.nikah = arr(raw.nikah).map(normNikah);
    base.honeymoon = normHoneymoon(raw.honeymoon);
    base.gifts = arr(raw.gifts).map(normGift);
    base.responsibilities = arr(raw.responsibilities).map(normResponsibility);
    base.timeline = arr(raw.timeline).map(normSlot);

    var seen = {};
    base.history = arr(raw.history).map(normSnapshot).filter(function (h) {
      if (!h || seen[h.date]) return false;
      seen[h.date] = true;
      return true;
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    var m = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
    base.meta = {
      createdAt: str(m.createdAt) || U.nowISO(),
      onboarded: m.onboarded === true,
      seeded: m.seeded === true,
      savedAt: str(m.savedAt),
      lastExportAt: dateStr(m.lastExportAt)
    };

    /* Every cross-reference must point at something that still exists. */
    var validEvents = {};
    base.events.forEach(function (e) { validEvents[e.id] = true; });
    base.guests.forEach(function (g) {
      g.events = g.events.filter(function (id) { return validEvents[id]; });
    });
    [base.vendors, base.wardrobe, base.catering.items, base.decor, base.shots,
      base.gifts, base.responsibilities].forEach(function (list) {
      list.forEach(function (x) { if (x.eventId && !validEvents[x.eventId]) x.eventId = ''; });
    });
    /* Tables and timeline slots belong to an event; without one they are noise.
       Shared data skips this: another person may be mid-way through creating
       the event, and throwing away their seating plan would be unforgivable. */
    if (!opts || opts.prune !== false) {
      base.tables = base.tables.filter(function (tb) { return validEvents[tb.eventId]; });
      base.timeline = base.timeline.filter(function (sl) { return validEvents[sl.eventId]; });
    }

    var validGuests = {};
    base.guests.forEach(function (g) { validGuests[g.id] = true; });
    var seatedSomewhere = {};
    base.tables.forEach(function (tb) {
      /* A guest sits at one table per event, and only if they still exist. */
      tb.guestIds = tb.guestIds.filter(function (gid) {
        var key = tb.eventId + '|' + gid;
        if (!validGuests[gid] || seatedSomewhere[key]) return false;
        seatedSomewhere[key] = true;
        return true;
      });
    });
    base.gifts.forEach(function (gf) {
      if (gf.guestId && !validGuests[gf.guestId]) gf.guestId = '';
    });
    var validLines = {};
    base.budget.forEach(function (b) { validLines[b.id] = true; });
    base.vendors.forEach(function (v) {
      if (v.budgetLineId && !validLines[v.budgetLineId]) v.budgetLineId = '';
    });

    return base;
  }

  /* ------------------------------------------------------------- store -- */

  var Store = {};
  Store.state = emptyState();

  Store.subscribe = function (fn) { listeners.push(fn); };

  function notify(reason) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](Store.state, reason); } catch (err) { /* one bad listener must not stop the rest */ }
    }
  }

  Store.load = function () {
    var raw = null;
    try {
      var text = window.localStorage.getItem(cacheKey);
      if (text) raw = JSON.parse(text);
    } catch (err) {
      raw = null; /* corrupt or blocked storage falls back to a valid empty state */
    }
    Store.state = normalise(raw);
    Store.logSnapshot();
    return Store.state;
  };

  /* Each wedding gets its own cache, so signing into a second one cannot show
     the first one's data for a moment. */
  Store.setCacheKey = function (k) { cacheKey = k || KEY; };
  Store.cacheKey = function () { return cacheKey; };

  /* Take a full server load as the truth. Never prunes, and never echoes the
     result back to the server. */
  Store.adopt = function (raw) {
    Store.state = normalise(raw, { prune: false });
    Store.logSnapshot();
    writeCache();
    notify('adopt');
    return Store.state;
  };

  function writeCache() {
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(Store.state));
      lastSaveOk = true;
    } catch (err) {
      lastSaveOk = false;
    }
    return lastSaveOk;
  }

  /* change describes what actually moved, so only that gets sent:
       {c, id}                one record written
       {c, id, op:'delete'}   one record retired
       {rows:[{c, id}]}       several records written
       {full:true}            everything (cascades, import, reset)
       {bump:{...}}           add to a number server-side
     Omit it for a purely local save such as boot. */
  Store.save = function (reason, change) {
    /* What is on disk is the state before this change — the undo point. */
    var previous = null;
    if (UNDOABLE.test(reason || '')) {
      try { previous = window.localStorage.getItem(cacheKey); } catch (err) { previous = null; }
    }

    Store.logSnapshot();
    Store.state.meta.savedAt = U.nowISO();
    writeCache();

    if (previous) {
      undoSnapshot = previous;
      undoRows = rowsChangedSince(previous);
    }

    if (change) pushToCloud(change);
    notify(reason || 'save');
    return lastSaveOk;
  };

  function cloud() {
    return (W.Cloud && W.Cloud.isEnabled()) ? W.Cloud : null;
  }

  function pushToCloud(change) {
    var C = cloud();
    if (C) C.push(change, Store.state);
  }

  /* Flatten both sides and report the records that differ, carrying the values
     they held before. Only runs on deletes, which are rare. */
  function rowsChangedSince(previousJSON) {
    var C = W.Cloud;
    if (!C || !C.flatten) return null;
    var before;
    try { before = JSON.parse(previousJSON); } catch (err) { return null; }

    function index(state) {
      var m = {};
      C.flatten(state).forEach(function (r) { m[r.collection + '|' + r.id] = r; });
      return m;
    }
    var was = index(before), now = index(Store.state);
    var rows = [];
    Object.keys(was).forEach(function (k) {
      var b = was[k], a = now[k];
      if (!a || JSON.stringify(a.data) !== JSON.stringify(b.data)) {
        rows.push({ c: b.collection, id: b.id, data: b.data });
      }
    });
    return rows;
  }

  Store.canUndo = function () { return !!undoSnapshot; };
  Store.clearUndo = function () { undoSnapshot = null; undoRows = null; };

  /* One step only, and the offer expires with its toast.

     On a shared wedding it puts back exactly the records the delete touched and
     leaves everything else alone — restoring a whole document would throw away
     whatever anyone else did in the meantime. */
  Store.undo = function () {
    if (!undoSnapshot) return false;

    if (cloud() && undoRows && undoRows.length) {
      var rows = undoRows;
      undoSnapshot = null;
      undoRows = null;
      rows.forEach(function (r) { putRecord(r.c, r.id, r.data); });
      Store.save('undo', { rows: rows.map(function (r) { return { c: r.c, id: r.id }; }) });
      return true;
    }

    var raw = null;
    try { raw = JSON.parse(undoSnapshot); } catch (err) { raw = null; }
    undoSnapshot = null;
    undoRows = null;
    if (!raw) return false;
    Store.state = normalise(raw);
    Store.save('undo', { full: true });
    return true;
  };

  /* ------------------------------------------------- records from elsewhere --

     Patched in place rather than replaced: views hold references to record
     objects across a render, and makeCrud.update already relies on identity
     staying stable. */

  function listFor(collection) {
    var C = W.Cloud;
    return C && C.listFor ? C.listFor(Store.state, collection) : null;
  }

  function putRecord(collection, id, data) {
    if (collection === 'singleton') {
      applySingleton(id, data);
      return;
    }
    var list = listFor(collection);
    if (!list) return;
    var idKey = collection === 'history' ? 'date' : 'id';
    var norm = NORMALISERS[collection];
    var next = norm ? norm(data) : data;
    if (!next) return;
    for (var i = 0; i < list.length; i++) {
      if (list[i][idKey] === id) {
        var existing = list[i];
        Object.keys(existing).forEach(function (k) {
          if (!Object.prototype.hasOwnProperty.call(next, k)) delete existing[k];
        });
        Object.keys(next).forEach(function (k) { existing[k] = next[k]; });
        return;
      }
    }
    list.push(next);
  }

  function dropRecord(collection, id) {
    var list = listFor(collection);
    if (!list) return;
    var idKey = collection === 'history' ? 'date' : 'id';
    for (var i = 0; i < list.length; i++) {
      if (list[i][idKey] === id) { list.splice(i, 1); return; }
    }
  }

  function applySingleton(id, data) {
    var d = data || {};
    if (id === 'settings') {
      Object.keys(d).forEach(function (k) { Store.state.settings[k] = d[k]; });
      Store.state.settings.currency = 'PKR';
    } else if (id === 'catering') {
      Store.state.catering.guestCount = Math.max(0, Math.round(U.num(d.guestCount)));
    } else if (id === 'honeymoon') {
      ['destination', 'startDate', 'endDate', 'budget', 'notes'].forEach(function (k) {
        if (d[k] !== undefined) Store.state.honeymoon[k] = d[k];
      });
    } else if (id === 'meta') {
      ['createdAt', 'seeded', 'lastExportAt'].forEach(function (k) {
        if (d[k] !== undefined) Store.state.meta[k] = d[k];
      });
    }
  }

  /* Called by the sync layer for every change made by anyone else. */
  Store.applyRemote = function (change) {
    if (!change || !change.collection) return false;
    if (change.deleted) dropRecord(change.collection, change.id);
    else putRecord(change.collection, change.id, change.data);
    writeCache();
    notify('remote');
    return true;
  };

  Store.lastSaveOk = function () { return lastSaveOk; };

  Store.markExported = function () {
    Store.state.meta.lastExportAt = U.todayISO();
    Store.save('export', { c: 'singleton', id: 'meta' });
  };

  /* Days since the last export; null if there has never been one. Only
     meaningful once there is something worth losing. */
  Store.backupAgeDays = function () {
    var last = Store.state.meta.lastExportAt;
    if (!last) return null;
    return U.daysBetween(last, U.todayISO());
  };

  Store.hasContent = function () {
    var st = Store.state;
    return st.tasks.length + st.guests.length + st.budget.length + st.events.length > 0;
  };

  Store.storageBytes = function () {
    try { return (window.localStorage.getItem(KEY) || '').length; } catch (err) { return 0; }
  };

  /* Import, sample data and reset all swap the whole document. On a shared
     wedding that has to retire what was there first, or the old records would
     linger for everyone else. */
  Store.replaceAll = function (raw, reason) {
    Store.state = normalise(raw);
    Store.save(reason || 'replace', { replaceAll: true });
  };

  Store.reset = function () {
    var fresh = emptyState();
    fresh.meta.onboarded = true;
    Store.state = fresh;
    Store.save('reset', { replaceAll: true });
  };

  /* --------------------------------------------------------- snapshots --
     One row per day, upserted so today's row stays accurate as things change.
     This is the only time dimension trend charts will ever have. */

  Store.buildSnapshot = function (dateISO) {
    var st = Store.state;
    var oneOff = st.tasks.filter(function (t) { return t.recurrence === 'none'; });
    return {
      date: dateISO,
      tasksTotal: oneOff.length,
      tasksDone: oneOff.filter(function (t) { return !!t.completedAt; }).length,
      budgetPlanned: U.sum(st.budget, function (b) { return b.planned; }),
      budgetSpent: U.sum(st.budget, function (b) { return b.actual; }),
      guestsTotal: st.guests.length,
      guestsConfirmed: st.guests.filter(function (g) { return g.rsvp === 'Attending'; }).length,
      vendorsBooked: st.vendors.filter(function (v) { return v && v.status === 'Booked'; }).length
    };
  };

  Store.logSnapshot = function () {
    var today = U.todayISO();
    var snap = Store.buildSnapshot(today);
    var hist = Store.state.history;
    for (var i = hist.length - 1; i >= 0; i--) {
      if (hist[i].date === today) { hist[i] = snap; return; }
      if (hist[i].date < today) break;
    }
    hist.push(snap);
    hist.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  };

  /* --------------------------------------------------------------- CRUD -- */

  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function removeById(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { list.splice(i, 1); return true; }
    }
    return false;
  }

  function makeCrud(key, norm, prefix) {
    return {
      all: function () { return Store.state[key]; },
      get: function (id) { return find(Store.state[key], id); },
      add: function (data) {
        var item = norm(data);
        if (!item.id) item.id = U.uid(prefix);
        Store.state[key].push(item);
        Store.save('add:' + key, { c: key, id: item.id });
        return item;
      },
      update: function (id, data) {
        var existing = find(Store.state[key], id);
        if (!existing) return null;
        var merged = {};
        var k;
        for (k in existing) if (Object.prototype.hasOwnProperty.call(existing, k)) merged[k] = existing[k];
        for (k in data) if (Object.prototype.hasOwnProperty.call(data, k)) merged[k] = data[k];
        merged.id = id;
        var normed = norm(merged);
        for (k in normed) if (Object.prototype.hasOwnProperty.call(normed, k)) existing[k] = normed[k];
        Store.save('update:' + key, { c: key, id: id });
        return existing;
      },
      /* A cascade passes its own change, because deleting one record there
         also rewrites a dozen others. */
      remove: function (id, change) {
        var ok = removeById(Store.state[key], id);
        if (ok) Store.save('remove:' + key, change || { c: key, id: id, op: 'delete' });
        return ok;
      }
    };
  }

  Store.tasks = makeCrud('tasks', normTask, 'task');
  Store.budget = makeCrud('budget', normBudget, 'bud');
  Store.guests = makeCrud('guests', normGuest, 'guest');
  Store.events = makeCrud('events', normEvent, 'evt');
  Store.vendors = makeCrud('vendors', normVendor, 'vnd');
  Store.wardrobe = makeCrud('wardrobe', normWardrobe, 'wrd');
  Store.shopping = makeCrud('shopping', normShopping, 'shop');
  Store.contacts = makeCrud('contacts', normContact, 'con');
  Store.tables = makeCrud('tables', normTable, 'tbl');
  Store.decor = makeCrud('decor', normDecor, 'dec');
  Store.shots = makeCrud('shots', normShot, 'shot');
  Store.nikah = makeCrud('nikah', normNikah, 'nik');
  Store.gifts = makeCrud('gifts', normGift, 'gift');
  Store.responsibilities = makeCrud('responsibilities', normResponsibility, 'resp');
  Store.timeline = makeCrud('timeline', normSlot, 'slot');

  /* Catering items live inside the catering object, so they get their own
     small CRUD rather than a top-level list. */
  Store.menu = {
    all: function () { return Store.state.catering.items; },
    get: function (id) { return find(Store.state.catering.items, id); },
    add: function (data) {
      var item = normMenuItem(data);
      Store.state.catering.items.push(item);
      Store.save('add:menu', { c: 'menu', id: item.id });
      return item;
    },
    update: function (id, data) {
      var existing = find(Store.state.catering.items, id);
      if (!existing) return null;
      var merged = {}, k;
      for (k in existing) if (Object.prototype.hasOwnProperty.call(existing, k)) merged[k] = existing[k];
      for (k in data) if (Object.prototype.hasOwnProperty.call(data, k)) merged[k] = data[k];
      merged.id = id;
      var normed = normMenuItem(merged);
      for (k in normed) if (Object.prototype.hasOwnProperty.call(normed, k)) existing[k] = normed[k];
      Store.save('update:menu', { c: 'menu', id: id });
      return existing;
    },
    remove: function (id) {
      var ok = removeById(Store.state.catering.items, id);
      if (ok) Store.save('remove:menu', { c: 'menu', id: id, op: 'delete' });
      return ok;
    }
  };

  Store.honeymoonItems = {
    all: function () { return Store.state.honeymoon.items; },
    get: function (id) { return find(Store.state.honeymoon.items, id); },
    add: function (data) {
      var item = normHoneymoonItem(data);
      Store.state.honeymoon.items.push(item);
      Store.save('add:honeymoon', { c: 'honeymoonItems', id: item.id });
      return item;
    },
    update: function (id, data) {
      var existing = find(Store.state.honeymoon.items, id);
      if (!existing) return null;
      var merged = {}, k;
      for (k in existing) if (Object.prototype.hasOwnProperty.call(existing, k)) merged[k] = existing[k];
      for (k in data) if (Object.prototype.hasOwnProperty.call(data, k)) merged[k] = data[k];
      merged.id = id;
      var normed = normHoneymoonItem(merged);
      for (k in normed) if (Object.prototype.hasOwnProperty.call(normed, k)) existing[k] = normed[k];
      Store.save('update:honeymoon', { c: 'honeymoonItems', id: id });
      return existing;
    },
    remove: function (id) {
      var ok = removeById(Store.state.honeymoon.items, id);
      if (ok) Store.save('remove:honeymoon', { c: 'honeymoonItems', id: id, op: 'delete' });
      return ok;
    }
  };

  Store.saveHoneymoon = function (data) {
    var h = Store.state.honeymoon;
    h.destination = str(data.destination);
    h.startDate = dateStr(data.startDate);
    h.endDate = dateStr(data.endDate);
    h.budget = Math.max(0, U.num(data.budget));
    h.notes = str(data.notes);
    Store.save('honeymoon', { c: 'singleton', id: 'honeymoon' });
  };

  Store.setGuestCount = function (n) {
    Store.state.catering.guestCount = Math.max(0, Math.round(U.num(n)));
    Store.save('catering:count', { c: 'singleton', id: 'catering' });
  };

  /* Deleting an event or a budget line must not leave dangling references. */
  var removeEvent = Store.events.remove;
  Store.events.remove = function (id) {
    Store.state.guests.forEach(function (g) {
      g.events = g.events.filter(function (e) { return e !== id; });
    });
    Store.state.vendors.concat(Store.state.wardrobe, Store.state.catering.items,
      Store.state.decor, Store.state.shots, Store.state.gifts, Store.state.responsibilities)
      .forEach(function (x) { if (x.eventId === id) x.eventId = ''; });
    /* Tables and timeline slots only mean anything with their event. */
    var gone = [{ c: 'events', id: id }];
    Store.state.tables.forEach(function (tb) {
      if (tb.eventId === id) gone.push({ c: 'tables', id: tb.id });
    });
    Store.state.timeline.forEach(function (sl) {
      if (sl.eventId === id) gone.push({ c: 'timeline', id: sl.id });
    });
    Store.state.tables = Store.state.tables.filter(function (tb) { return tb.eventId !== id; });
    Store.state.timeline = Store.state.timeline.filter(function (sl) { return sl.eventId !== id; });
    /* One event delete rewrites records across eight collections, so the whole
       state goes up alongside the list of what was retired. */
    return removeEvent(id, { full: true, deletes: gone });
  };

  var removeBudgetLine = Store.budget.remove;
  Store.budget.remove = function (id) {
    Store.state.vendors.forEach(function (v) {
      if (v.budgetLineId === id) v.budgetLineId = '';
    });
    return removeBudgetLine(id, { full: true, deletes: [{ c: 'budget', id: id }] });
  };

  /* ---------------------------------------------------- vendor ledger --
     A vendor never stores what it has been paid. That number lives once, in
     the linked budget line, and everything else is derived from it. */

  Store.vendorAgreed = function (v) {
    return v ? (v.finalPrice || v.quotedPrice || 0) : 0;
  };

  Store.vendorLine = function (v) {
    return v && v.budgetLineId ? Store.budget.get(v.budgetLineId) : null;
  };

  Store.vendorPaid = function (v) {
    var line = Store.vendorLine(v);
    return line ? line.actual : 0;
  };

  Store.vendorRemaining = function (v) {
    return Math.max(0, Store.vendorAgreed(v) - Store.vendorPaid(v));
  };

  Store.createBudgetLineForVendor = function (vendor) {
    var line = Store.budget.add({
      category: vendor.category,
      planned: Store.vendorAgreed(vendor),
      actual: 0,
      paymentStatus: 'Unpaid',
      vendor: vendor.name
    });
    return line;
  };

  Store.linkVendorToLine = function (vendorId, lineId) {
    var v = Store.vendors.get(vendorId);
    var line = Store.budget.get(lineId);
    if (!v || !line) return null;
    v.budgetLineId = line.id;
    if (!line.vendor) line.vendor = v.name;
    /* A brand new line with nothing planned takes the agreed price. */
    if (!line.planned) line.planned = Store.vendorAgreed(v);
    Store.save('vendor:link', {
      rows: [{ c: 'vendors', id: v.id }, { c: 'budget', id: line.id }]
    });
    return line;
  };

  Store.recordVendorPayment = function (vendorId, amount, dateISO) {
    var v = Store.vendors.get(vendorId);
    if (!v) return null;
    var line = Store.vendorLine(v);
    if (!line) return null;
    line.actual = Math.max(0, line.actual + U.num(amount));
    if (dateISO) line.paymentDate = dateISO;
    var target = Store.vendorAgreed(v) || line.planned;
    line.paymentStatus = line.actual <= 0 ? 'Unpaid'
      : (target > 0 && line.actual >= target ? 'Paid' : 'Partially Paid');
    /* The amount is applied server-side as an increment rather than a write, so
       two people paying the same vendor at once cannot lose one payment. */
    Store.save('vendor:payment', {
      bump: {
        c: 'budget', id: line.id, field: 'actual', delta: U.num(amount),
        patch: { paymentDate: line.paymentDate, paymentStatus: line.paymentStatus }
      }
    });
    return line;
  };

  /* A deleted guest must leave every table and gift record behind them. */
  var removeGuest = Store.guests.remove;
  Store.guests.remove = function (id) {
    Store.state.tables.forEach(function (tb) {
      tb.guestIds = tb.guestIds.filter(function (g) { return g !== id; });
    });
    Store.state.gifts.forEach(function (gf) { if (gf.guestId === id) gf.guestId = ''; });
    return removeGuest(id, { full: true, deletes: [{ c: 'guests', id: id }] });
  };

  /* One save for the whole batch, not one per guest. */
  Store.guests.addMany = function (rows) {
    var added = [];
    rows.forEach(function (row) {
      var g = normGuest(row);
      Store.state.guests.push(g);
      added.push(g);
    });
    Store.save('bulk:guests', {
      rows: added.map(function (g) { return { c: 'guests', id: g.id }; })
    });
    return added;
  };

  /* Parses a pasted list. One per line; optional ", family, adults, children". */
  Store.parseGuestList = function (text) {
    var existing = {};
    Store.state.guests.forEach(function (g) { existing[g.name.trim().toLowerCase()] = true; });
    var seen = {};
    var rows = [], dupes = 0;

    String(text || '').split(LINE_BREAK).forEach(function (line) {
      var parts = line.split(',');
      var name = (parts[0] || '').trim();
      if (!name) return;
      var key = name.toLowerCase();
      if (existing[key] || seen[key]) { dupes += 1; return; }
      seen[key] = true;
      rows.push({
        name: name,
        group: (parts[1] || '').trim(),
        adults: parts[2] !== undefined && String(parts[2]).trim() !== ''
          ? Math.max(0, Math.round(U.num(parts[2], 1))) : 1,
        children: parts[3] !== undefined && String(parts[3]).trim() !== ''
          ? Math.max(0, Math.round(U.num(parts[3], 0))) : 0
      });
    });
    return { rows: rows, dupes: dupes };
  };

  Store.saveSettings = function (data) {
    var s = Store.state.settings;
    s.brideName = str(data.brideName);
    s.groomName = str(data.groomName);
    s.weddingDate = dateStr(data.weddingDate);
    s.venue = str(data.venue);
    s.hashtag = str(data.hashtag);
    Store.save('settings', { c: 'singleton', id: 'settings' });
  };

  /* -------------------------------------------------------- task logic --
     A recurring task's completion is a set of dates, never a boolean. Ticking
     today can never erase yesterday. */

  Store.isTaskDoneOn = function (task, iso) {
    if (!task) return false;
    if (task.recurrence === 'none') {
      return !!task.completedAt && String(task.completedAt).slice(0, 10) <= iso;
    }
    return task.completedDates.indexOf(iso) >= 0;
  };

  Store.isTaskDoneToday = function (task) {
    return Store.isTaskDoneOn(task, U.todayISO());
  };

  Store.toggleTask = function (id, iso) {
    var task = Store.tasks.get(id);
    if (!task) return null;
    var day = iso || U.todayISO();

    if (task.recurrence === 'none') {
      if (task.completedAt) {
        task.completedAt = null;
        task.completedDates = [];
        task.status = 'Not Started';
      } else {
        task.completedAt = U.nowISO();
        task.completedDates = [day];
        task.status = 'Completed';
      }
    } else {
      var i = task.completedDates.indexOf(day);
      if (i >= 0) {
        task.completedDates.splice(i, 1);
      } else {
        task.completedDates.push(day);
        task.completedDates.sort();
      }
      task.completedAt = task.completedDates.length
        ? task.completedDates[task.completedDates.length - 1] + 'T09:00:00.000'
        : null;
    }
    Store.save('toggle:task', { c: 'tasks', id: id });
    return task;
  };

  /* Is this recurring task expected on this date? */
  Store.recursOn = function (task, iso) {
    if (task.recurrence === 'daily') return true;
    if (task.recurrence !== 'weekly') return false;
    var anchor = task.dueDate || String(task.createdAt || '').slice(0, 10);
    if (!U.isValidISODate(anchor)) return true;
    var diff = U.daysBetween(anchor, iso);
    if (diff === null) return true;
    return ((diff % 7) + 7) % 7 === 0;
  };

  Store.dailyTasks = function () {
    return Store.state.tasks.filter(function (t) { return t.recurrence === 'daily'; });
  };

  Store.weeklyTasksOn = function (iso) {
    return Store.state.tasks.filter(function (t) {
      return t.recurrence === 'weekly' && Store.recursOn(t, iso);
    });
  };

  Store.overdueTasks = function (iso) {
    var day = iso || U.todayISO();
    return Store.state.tasks.filter(function (t) {
      return t.recurrence === 'none' && t.dueDate && t.dueDate < day && !t.completedAt;
    }).sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; });
  };

  /* How much of a day's daily tasks were ticked. Tasks added later never
     retro-break an earlier day. */
  Store.dayProgress = function (iso) {
    var daily = Store.dailyTasks().filter(function (t) {
      var created = String(t.createdAt || '').slice(0, 10);
      return !U.isValidISODate(created) || created <= iso;
    });
    var done = 0;
    daily.forEach(function (t) {
      if (t.completedDates.indexOf(iso) >= 0) done += 1;
    });
    return { total: daily.length, done: done };
  };

  /* A day counts toward the streak only when every daily task was ticked —
     that is what makes the number mean anything. Partial days still show on
     the strip so a near miss does not look like nothing at all. */
  Store.dayComplete = function (iso) {
    var p = Store.dayProgress(iso);
    return p.total > 0 && p.done === p.total;
  };

  Store.currentStreak = function () {
    var today = U.todayISO();
    var cursor = Store.dayComplete(today) ? today : U.addDays(today, -1);
    var n = 0;
    while (n < 3650 && Store.dayComplete(cursor)) {
      n++;
      cursor = U.addDays(cursor, -1);
    }
    return n;
  };

  Store.longestStreak = function () {
    var days = {};
    Store.dailyTasks().forEach(function (t) {
      t.completedDates.forEach(function (d) { days[d] = true; });
    });
    var list = Object.keys(days).filter(Store.dayComplete).sort();
    var best = 0, run = 0, prev = null;
    list.forEach(function (d) {
      if (prev && U.daysBetween(prev, d) === 1) run++; else run = 1;
      if (run > best) best = run;
      prev = d;
    });
    return best;
  };

  Store.streakStrip = function (days) {
    var n = days || 30;
    var today = U.todayISO();
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = U.addDays(today, -i);
      var p = Store.dayProgress(d);
      out.push({
        date: d,
        done: p.total > 0 && p.done === p.total,
        partial: p.total > 0 && p.done > 0 && p.done < p.total,
        progress: p
      });
    }
    return out;
  };

  /* ----------------------------------------------------------- rollups -- */

  Store.taskStats = function () {
    var oneOff = Store.state.tasks.filter(function (t) { return t.recurrence === 'none'; });
    var done = oneOff.filter(function (t) { return !!t.completedAt; }).length;
    return {
      total: oneOff.length,
      done: done,
      open: oneOff.length - done,
      percent: U.pct(done, oneOff.length),
      overdue: Store.overdueTasks().length,
      recurring: Store.state.tasks.length - oneOff.length
    };
  };

  Store.budgetStats = function () {
    var list = Store.state.budget;
    var planned = U.sum(list, function (b) { return b.planned; });
    var spent = U.sum(list, function (b) { return b.actual; });
    var over = list.filter(function (b) { return b.actual > b.planned && b.planned > 0; });
    var due = U.sum(list, function (b) {
      return b.paymentStatus === 'Paid' ? 0 : Math.max(0, b.planned - b.actual);
    });
    return {
      planned: planned,
      spent: spent,
      remaining: planned - spent,
      due: due,
      overCount: over.length,
      overCategories: over,
      percent: U.pct(spent, planned),
      lines: list.length
    };
  };

  Store.guestStats = function () {
    var list = Store.state.guests;
    var heads = 0, adults = 0, children = 0;
    var rsvp = { Pending: 0, Attending: 0, 'Not Attending': 0, Maybe: 0 };
    var side = { Bride: 0, Groom: 0, Both: 0 };
    var attendingHeads = 0;
    list.forEach(function (g) {
      var h = g.adults + g.children;
      heads += h; adults += g.adults; children += g.children;
      if (rsvp[g.rsvp] === undefined) rsvp[g.rsvp] = 0;
      rsvp[g.rsvp] += 1;
      side[g.side] += 1;
      if (g.rsvp === 'Attending') attendingHeads += h;
    });
    var replied = list.length - rsvp.Pending;
    return {
      groups: list.length,
      heads: heads,
      adults: adults,
      children: children,
      rsvp: rsvp,
      side: side,
      attendingHeads: attendingHeads,
      responseRate: U.pct(replied, list.length)
    };
  };

  Store.vendorStats = function () {
    var list = Store.state.vendors;
    var live = list.filter(function (v) { return v.status !== 'Cancelled'; });
    var agreed = U.sum(live, function (v) { return Store.vendorAgreed(v); });
    var paid = U.sum(live, function (v) { return Store.vendorPaid(v); });
    var byStatus = {};
    W.OPT.vendorStatus.forEach(function (k) { byStatus[k] = 0; });
    list.forEach(function (v) { byStatus[v.status] += 1; });
    return {
      total: list.length,
      live: live.length,
      booked: byStatus.Booked,
      byStatus: byStatus,
      agreed: agreed,
      paid: paid,
      remaining: Math.max(0, agreed - paid),
      unlinked: list.filter(function (v) { return !v.budgetLineId; }).length
    };
  };

  /* A funnel counts everyone who has reached a stage or gone past it. */
  Store.vendorFunnel = function () {
    var order = W.OPT.vendorFunnel;
    var live = Store.state.vendors.filter(function (v) { return v.status !== 'Cancelled'; });
    return order.map(function (stage, i) {
      return {
        label: stage,
        value: live.filter(function (v) { return order.indexOf(v.status) >= i; }).length
      };
    });
  };

  Store.wardrobeStats = function () {
    var list = Store.state.wardrobe;
    var byStatus = {};
    W.OPT.wardrobeStatus.forEach(function (k) { byStatus[k] = 0; });
    var byPerson = { Bride: 0, Groom: 0, Family: 0 };
    list.forEach(function (w) {
      byStatus[w.status] += 1;
      byPerson[w.person] += 1;
    });
    var ready = byStatus.Ready;
    return {
      total: list.length,
      ready: ready,
      outstanding: list.length - ready,
      byStatus: byStatus,
      byPerson: byPerson,
      cost: U.sum(list, function (w) { return w.cost; })
    };
  };

  /* Each event pays for its own head count; anything not tied to an event
     falls back to the planner's guest count. */
  Store.cateringStats = function () {
    var fallback = Store.state.catering.guestCount;
    var groups = [];
    var index = {};

    function bucket(eventId) {
      if (index[eventId] === undefined) {
        var evt = eventId ? Store.events.get(eventId) : null;
        var heads = evt && evt.expectedGuests ? evt.expectedGuests : fallback;
        index[eventId] = groups.length;
        groups.push({
          eventId: eventId,
          event: evt,
          name: evt ? evt.name : '',
          heads: heads,
          fromEvent: !!(evt && evt.expectedGuests),
          items: [],
          perHead: 0,
          total: 0
        });
      }
      return groups[index[eventId]];
    }

    Store.state.catering.items.forEach(function (m) {
      var g = bucket(m.eventId || '');
      g.items.push(m);
      g.perHead += m.costPerHead;
    });
    groups.forEach(function (g) { g.total = g.perHead * g.heads; });
    groups.sort(function (a, b) {
      var ad = a.event && a.event.date ? a.event.date : '9999';
      var bd = b.event && b.event.date ? b.event.date : '9999';
      return ad < bd ? -1 : 1;
    });

    var byCourse = {};
    Store.state.catering.items.forEach(function (m) {
      byCourse[m.course] = (byCourse[m.course] || 0) + m.costPerHead;
    });

    return {
      guestCount: fallback,
      groups: groups,
      items: Store.state.catering.items.length,
      grandTotal: U.sum(groups, function (g) { return g.total; }),
      perHeadTotal: U.sum(Store.state.catering.items, function (m) { return m.costPerHead; }),
      byCourse: W.OPT.course.filter(function (c) { return byCourse[c]; })
        .map(function (c) { return { label: c, value: byCourse[c] }; })
    };
  };

  Store.shoppingStats = function () {
    var list = Store.state.shopping;
    var bought = list.filter(function (x) { return x.status === 'Bought'; });
    var cost = function (x) { return x.estimatedCost * x.quantity; };
    return {
      total: list.length,
      bought: bought.length,
      left: list.length - bought.length,
      estimated: U.sum(list, cost),
      estimatedLeft: U.sum(list.filter(function (x) { return x.status !== 'Bought'; }), cost),
      percent: U.pct(bought.length, list.length)
    };
  };

  /* -------------------------------------------------------- analytics --
     Everything below reads completedAt and the daily snapshots. Nothing new
     is stored to make these work. */

  Store.velocityByWeek = function (weeks) {
    var n = weeks || 8;
    var thisWeek = U.startOfWeek(U.todayISO());
    var buckets = [], index = {};
    for (var i = n - 1; i >= 0; i--) {
      var ws = U.addDays(thisWeek, -7 * i);
      index[ws] = buckets.length;
      buckets.push({ weekStart: ws, count: 0 });
    }
    Store.state.tasks.forEach(function (t) {
      if (t.recurrence !== 'none' || !t.completedAt) return;
      var ws = U.startOfWeek(String(t.completedAt).slice(0, 10));
      if (index[ws] !== undefined) buckets[index[ws]].count += 1;
    });
    return buckets;
  };

  Store.completedInLastDays = function (days) {
    var since = U.addDays(U.todayISO(), -(days - 1));
    return Store.state.tasks.filter(function (t) {
      return t.recurrence === 'none' && t.completedAt &&
        String(t.completedAt).slice(0, 10) >= since;
    }).length;
  };

  /* Weekly samples of tasks still open, plus the straight line down to zero
     on the wedding day. Both series share one y-axis: counts of tasks. */
  Store.burndownSeries = function () {
    var hist = Store.state.history;
    if (hist.length < 2) return null;
    var today = U.todayISO();
    var wedding = Store.state.settings.weddingDate;
    var first = U.startOfWeek(hist[0].date);
    var last = U.startOfWeek(wedding && wedding > today ? wedding : today);

    var labels = [], cursor = first;
    while (cursor <= last && labels.length < 80) {
      labels.push(cursor);
      cursor = U.addDays(cursor, 7);
    }
    if (!labels.length) labels.push(first);
    if (labels[labels.length - 1] < last) labels.push(last);

    var weekEnd = function (ws) { return U.addDays(ws, 6); };
    /* Actual readings stop at today; the pace line keeps going to the wedding. */
    var sampleOf = function (ws) {
      var end = weekEnd(ws);
      return end > today ? today : end;
    };

    var actual = labels.map(function (ws) {
      if (ws > today) return null;
      var sample = sampleOf(ws), value = null;
      for (var i = 0; i < hist.length; i++) {
        if (hist[i].date <= sample) value = Math.max(0, hist[i].tasksTotal - hist[i].tasksDone);
        else break;
      }
      return value;
    });

    var ideal = null;
    if (wedding && wedding > hist[0].date) {
      var startValue = null;
      for (var j = 0; j < actual.length; j++) {
        if (actual[j] !== null) { startValue = actual[j]; break; }
      }
      if (startValue !== null) {
        var span = U.daysBetween(weekEnd(labels[0]), wedding);
        if (span > 0) {
          ideal = labels.map(function (ws) {
            var gone = U.daysBetween(weekEnd(labels[0]), weekEnd(ws));
            return Math.max(0, Math.round(startValue * (1 - gone / span) * 10) / 10);
          });
        }
      }
    }

    var todayIndex = -1;
    for (var k = 0; k < actual.length; k++) if (actual[k] !== null) todayIndex = k;

    return {
      labels: labels,
      actual: actual,
      ideal: ideal,
      todayIndex: todayIndex,
      actualNow: todayIndex >= 0 ? actual[todayIndex] : null,
      idealNow: ideal && todayIndex >= 0 ? ideal[todayIndex] : null
    };
  };

  Store.spendSeries = function () {
    return Store.state.history.map(function (h) {
      return { date: h.date, spent: h.budgetSpent, planned: h.budgetPlanned };
    });
  };

  Store.taskCompletionByCategory = function () {
    var map = {};
    Store.state.tasks.forEach(function (t) {
      if (t.recurrence !== 'none') return;
      if (!map[t.category]) map[t.category] = { label: t.category, total: 0, done: 0 };
      map[t.category].total += 1;
      if (t.completedAt) map[t.category].done += 1;
    });
    return Object.keys(map).map(function (k) {
      var row = map[k];
      row.percent = U.pct(row.done, row.total);
      return row;
    }).sort(function (a, b) {
      if (a.percent !== b.percent) return a.percent - b.percent;
      return b.total - a.total;
    });
  };

  /* ---------------------------------------------------------- seating -- */

  Store.guestHeads = function (g) { return g ? g.adults + g.children : 0; };

  Store.tableUsage = function (table) {
    if (!table) return 0;
    var total = 0;
    table.guestIds.forEach(function (gid) {
      total += Store.guestHeads(Store.guests.get(gid));
    });
    return total;
  };

  Store.tablesForEvent = function (eventId) {
    return Store.state.tables.filter(function (tb) { return tb.eventId === eventId; })
      .sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  };

  Store.seatedGuestIds = function (eventId) {
    var map = {};
    Store.tablesForEvent(eventId).forEach(function (tb) {
      tb.guestIds.forEach(function (gid) { map[gid] = tb.id; });
    });
    return map;
  };

  Store.unseatedGuests = function (eventId) {
    var seated = Store.seatedGuestIds(eventId);
    return Store.guestsForEvent(eventId).filter(function (g) {
      return !seated[g.id] && g.rsvp !== 'Not Attending';
    });
  };

  /* Seating one guest takes them off any other table at the same event. */
  Store.setTableGuests = function (tableId, guestIds) {
    var table = Store.tables.get(tableId);
    if (!table) return null;
    var wanted = {};
    guestIds.forEach(function (g) { wanted[g] = true; });
    Store.tablesForEvent(table.eventId).forEach(function (other) {
      if (other.id === tableId) return;
      other.guestIds = other.guestIds.filter(function (g) { return !wanted[g]; });
    });
    table.guestIds = guestIds.slice();
    Store.save('seating', {
      rows: Store.tablesForEvent(table.eventId).map(function (tb) {
        return { c: 'tables', id: tb.id };
      })
    });
    return table;
  };

  Store.unseatGuest = function (tableId, guestId) {
    var table = Store.tables.get(tableId);
    if (!table) return null;
    table.guestIds = table.guestIds.filter(function (g) { return g !== guestId; });
    Store.save('seating', { c: 'tables', id: tableId });
    return table;
  };

  Store.seatingStats = function (eventId) {
    var tables = Store.tablesForEvent(eventId);
    var invited = Store.guestsForEvent(eventId);
    var over = tables.filter(function (tb) { return Store.tableUsage(tb) > tb.capacity; });
    var unseated = Store.unseatedGuests(eventId);
    return {
      tables: tables.length,
      capacity: U.sum(tables, function (tb) { return tb.capacity; }),
      seated: U.sum(tables, function (tb) { return Store.tableUsage(tb); }),
      invitedGroups: invited.length,
      invitedHeads: U.sum(invited, Store.guestHeads),
      over: over.length,
      unseatedGroups: unseated.length,
      unseatedHeads: U.sum(unseated, Store.guestHeads)
    };
  };

  /* ------------------------------------------------------ phase 3 stats -- */

  Store.invitationStats = function () {
    var list = Store.state.guests;
    var by = {};
    W.OPT.invitation.forEach(function (k) { by[k] = 0; });
    list.forEach(function (g) { by[g.invitation] += 1; });
    var sent = list.length - by['Not Sent'];
    return {
      total: list.length,
      byStatus: by,
      sent: sent,
      notSent: by['Not Sent'],
      confirmed: by.Confirmed,
      percent: U.pct(sent, list.length),
      heads: U.sum(list, Store.guestHeads)
    };
  };

  Store.decorStats = function () {
    var list = Store.state.decor;
    var by = {};
    W.OPT.decorStatus.forEach(function (k) { by[k] = 0; });
    list.forEach(function (x) { by[x.status] += 1; });
    return {
      total: list.length,
      byStatus: by,
      done: by.Done,
      cost: U.sum(list, function (x) { return x.estimatedCost; }),
      percent: U.pct(by.Done, list.length)
    };
  };

  Store.shotStats = function () {
    var list = Store.state.shots;
    var done = list.filter(function (x) { return x.done; });
    var must = list.filter(function (x) { return x.mustHave; });
    var by = {};
    list.forEach(function (x) { by[x.category] = (by[x.category] || 0) + 1; });
    return {
      total: list.length,
      done: done.length,
      left: list.length - done.length,
      must: must.length,
      mustDone: must.filter(function (x) { return x.done; }).length,
      byCategory: W.OPT.shotCategory.filter(function (c) { return by[c]; })
        .map(function (c) { return { label: c, value: by[c] }; }),
      percent: U.pct(done.length, list.length)
    };
  };

  Store.nikahStats = function () {
    var list = Store.state.nikah;
    var by = {};
    W.OPT.nikahStatus.forEach(function (k) { by[k] = 0; });
    list.forEach(function (x) { by[x.status] += 1; });
    return {
      total: list.length,
      byStatus: by,
      done: by.Done,
      percent: U.pct(by.Done, list.length)
    };
  };

  Store.honeymoonStats = function () {
    var h = Store.state.honeymoon;
    var booked = h.items.filter(function (x) { return x.status !== 'To Book'; });
    var byType = {};
    h.items.forEach(function (x) { byType[x.type] = (byType[x.type] || 0) + x.cost; });
    var nights = (h.startDate && h.endDate) ? U.daysBetween(h.startDate, h.endDate) : null;
    return {
      total: h.items.length,
      booked: booked.length,
      cost: U.sum(h.items, function (x) { return x.cost; }),
      budget: h.budget,
      left: h.budget - U.sum(h.items, function (x) { return x.cost; }),
      nights: nights !== null && nights > 0 ? nights : null,
      byType: W.OPT.honeymoonType.filter(function (k) { return byType[k]; })
        .map(function (k) { return { label: k, value: byType[k] }; })
        .sort(function (a, b) { return b.value - a.value; })
    };
  };

  Store.giftStats = function () {
    var list = Store.state.gifts;
    var thanked = list.filter(function (x) { return x.thankYouSent; });
    var byKind = {};
    list.forEach(function (x) { byKind[x.kind] = (byKind[x.kind] || 0) + 1; });
    return {
      total: list.length,
      cash: U.sum(list.filter(function (x) { return x.kind === 'Cash (salami)'; }),
        function (x) { return x.amount; }),
      value: U.sum(list, function (x) { return x.amount; }),
      thanked: thanked.length,
      toThank: list.length - thanked.length,
      percent: U.pct(thanked.length, list.length),
      byKind: W.OPT.giftKind.filter(function (k) { return byKind[k]; })
        .map(function (k) { return { label: k, value: byKind[k] }; })
    };
  };

  Store.giftFrom = function (gift) {
    if (!gift) return '';
    if (gift.guestId) {
      var g = Store.guests.get(gift.guestId);
      if (g) return g.name;
    }
    return gift.from;
  };

  Store.responsibilityStats = function () {
    var list = Store.state.responsibilities;
    var by = {};
    W.OPT.responsibilityStatus.forEach(function (k) { by[k] = 0; });
    var people = {};
    list.forEach(function (x) {
      by[x.status] += 1;
      people[x.person] = (people[x.person] || 0) + 1;
    });
    return {
      total: list.length,
      byStatus: by,
      done: by.Done,
      people: Object.keys(people).length,
      byPerson: Object.keys(people).map(function (k) { return { label: k, value: people[k] }; })
        .sort(function (a, b) { return b.value - a.value; }),
      percent: U.pct(by.Done, list.length)
    };
  };

  /* Matches an assigned person to a saved contact so a number can be shown. */
  Store.contactByName = function (name) {
    if (!name) return null;
    var needle = String(name).trim().toLowerCase();
    for (var i = 0; i < Store.state.contacts.length; i++) {
      if (Store.state.contacts[i].name.toLowerCase() === needle) return Store.state.contacts[i];
    }
    return null;
  };

  /* ------------------------------------------------------ wedding day -- */

  /* A wedding night runs past midnight, so anything before 5am belongs at the
     end of that night's running order, not the start of it. */
  function slotOrder(time) {
    var mins = parseInt(time.slice(0, 2), 10) * 60 + parseInt(time.slice(3, 5), 10);
    return time < '05:00' ? mins + 24 * 60 : mins;
  }

  Store.slotsForEvent = function (eventId) {
    return Store.state.timeline.filter(function (sl) { return sl.eventId === eventId; })
      .sort(function (a, b) { return slotOrder(a.time) - slotOrder(b.time); });
  };

  Store.dayPlan = function (eventId) {
    var slots = Store.slotsForEvent(eventId);
    var arrivals = Store.state.vendors.filter(function (v) {
      return v.status !== 'Cancelled' && (v.eventId === eventId || !v.eventId);
    }).sort(function (a, b) {
      var at = a.arrivalTime || 'zz', bt = b.arrivalTime || 'zz';
      if (at !== bt) return at < bt ? -1 : 1;
      return a.name < b.name ? -1 : 1;
    });
    var payments = Store.state.vendors.filter(function (v) {
      return v.status !== 'Cancelled' && Store.vendorRemaining(v) > 0;
    }).sort(function (a, b) { return Store.vendorRemaining(b) - Store.vendorRemaining(a); });
    var jobs = Store.state.responsibilities.filter(function (r) {
      return r.eventId === eventId || !r.eventId;
    });
    return {
      slots: slots,
      slotsDone: slots.filter(function (sl) { return sl.done; }).length,
      arrivals: arrivals,
      payments: payments,
      outstanding: U.sum(payments, function (v) { return Store.vendorRemaining(v); }),
      jobs: jobs
    };
  };

  /* --------------------------------------------------- global search --- */

  Store.search = function (query) {
    var q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    var out = [];

    function scan(label, route, list, fields, nameField) {
      var hits = [];
      list.forEach(function (item) {
        var hay = fields.map(function (f) { return item[f] || ''; }).join(' ').toLowerCase();
        if (hay.indexOf(q) >= 0) {
          hits.push({ id: item.id, title: String(item[nameField] || '').trim() || label, item: item });
        }
      });
      if (hits.length) out.push({ label: label, route: route, hits: hits.slice(0, 8), total: hits.length });
    }

    var st = Store.state;
    scan(W.t('nav.tasks'), 'tasks', st.tasks, ['title', 'category', 'notes'], 'title');
    scan(W.t('nav.guests'), 'guests', st.guests, ['name', 'group', 'phone', 'notes'], 'name');
    scan(W.t('nav.budget'), 'budget', st.budget, ['category', 'vendor', 'notes'], 'category');
    scan(W.t('nav.events'), 'events', st.events, ['name', 'type', 'venue', 'notes'], 'name');
    scan(W.t('nav.vendors'), 'vendors', st.vendors, ['name', 'category', 'contactName', 'phone', 'notes'], 'name');
    scan(W.t('nav.wardrobe'), 'wardrobe', st.wardrobe, ['outfit', 'designer', 'wearer', 'notes'], 'outfit');
    scan(W.t('nav.catering'), 'catering', st.catering.items, ['name', 'course', 'notes'], 'name');
    scan(W.t('nav.shopping'), 'shopping', st.shopping, ['item', 'category', 'assignedTo', 'notes'], 'item');
    scan(W.t('nav.contacts'), 'contacts', st.contacts, ['name', 'role', 'relation', 'phone'], 'name');
    scan(W.t('nav.decor'), 'decor', st.decor, ['description', 'area', 'palette', 'supplier', 'notes'], 'description');
    scan(W.t('nav.photos'), 'photos', st.shots, ['description', 'category', 'people', 'notes'], 'description');
    scan(W.t('nav.nikah'), 'nikah', st.nikah, ['item', 'owner', 'notes'], 'item');
    scan(W.t('nav.honeymoon'), 'honeymoon', st.honeymoon.items, ['title', 'type', 'reference', 'notes'], 'title');
    scan(W.t('nav.gifts'), 'gifts', st.gifts, ['from', 'description', 'kind', 'notes'], 'from');
    scan(W.t('nav.responsibilities'), 'responsibilities', st.responsibilities,
      ['person', 'area', 'description', 'notes'], 'person');
    scan(W.t('nav.command'), 'command', st.timeline, ['title', 'owner', 'notes'], 'title');
    return out;
  };

  /* Totals for a set of budget categories, so a tracker page can show what it
     has estimated beside what the budget actually plans for. The trackers stay
     out of the budget totals — this only puts the two numbers side by side. */
  Store.budgetFor = function (categories) {
    var wanted = {};
    categories.forEach(function (c) { wanted[c] = true; });
    var lines = Store.state.budget.filter(function (b) { return wanted[b.category]; });
    return {
      lines: lines.length,
      planned: U.sum(lines, function (b) { return b.planned; }),
      actual: U.sum(lines, function (b) { return b.actual; })
    };
  };

  /* Everything assigned to one person, across the three lists that carry an
     owner. This is what makes a shared planner worth having. */
  Store.assignedTo = function (userId) {
    if (!userId) return { tasks: [], shopping: [], responsibilities: [] };
    function mine(list) {
      return list.filter(function (x) { return x.assignee === userId; });
    }
    return {
      tasks: mine(Store.state.tasks),
      shopping: mine(Store.state.shopping),
      responsibilities: mine(Store.state.responsibilities)
    };
  };

  Store.assigneeName = function (record) {
    if (!record) return '';
    var name = record.assignee ? W.Cloud.personName(record.assignee) : '';
    return name || record.assignedTo || record.person || '';
  };

  Store.eventName = function (id) {
    var e = id ? Store.events.get(id) : null;
    return e ? e.name : '';
  };

  Store.eventStats = function () {
    var today = U.todayISO();
    var list = Store.state.events;
    return {
      total: list.length,
      upcoming: list.filter(function (e) { return !e.date || e.date >= today; }).length,
      past: list.filter(function (e) { return e.date && e.date < today; }).length
    };
  };

  Store.eventsSorted = function () {
    return Store.state.events.slice().sort(function (a, b) {
      if (!a.date && !b.date) return a.name < b.name ? -1 : 1;
      if (!a.date) return 1;
      if (!b.date) return -1;
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.startTime || '') < (b.startTime || '') ? -1 : 1;
    });
  };

  Store.eventsOn = function (iso) {
    return Store.eventsSorted().filter(function (e) { return e.date === iso; });
  };

  Store.guestsForEvent = function (eventId) {
    return Store.state.guests.filter(function (g) { return g.events.indexOf(eventId) >= 0; });
  };

  Store.coupleName = function () {
    var s = Store.state.settings;
    var b = s.brideName.trim(), g = s.groomName.trim();
    if (b && g) return b + ' & ' + g;
    return b || g || '';
  };

  Store.daysToWedding = function () {
    var d = Store.state.settings.weddingDate;
    if (!d) return null;
    return U.daysBetween(U.todayISO(), d);
  };

  Store.exportObject = function () {
    Store.logSnapshot();
    var out = U.clone(Store.state);
    out.exportedAt = U.nowISO();
    out.app = 'wedding-planner';
    return out;
  };

  /* A file is only a valid backup if it carries the shape we wrote. */
  Store.validateImport = function (raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, reason: 'not-object' };
    }
    var hasSettings = raw.settings && typeof raw.settings === 'object' && !Array.isArray(raw.settings);
    var lists = ['tasks', 'budget', 'guests', 'events', 'history'];
    var present = 0;
    for (var i = 0; i < lists.length; i++) {
      if (Array.isArray(raw[lists[i]])) present++;
    }
    if (!hasSettings || present < 3) return { ok: false, reason: 'shape' };
    return {
      ok: true,
      counts: {
        tasks: Array.isArray(raw.tasks) ? raw.tasks.length : 0,
        guests: Array.isArray(raw.guests) ? raw.guests.length : 0,
        budget: Array.isArray(raw.budget) ? raw.budget.length : 0,
        events: Array.isArray(raw.events) ? raw.events.length : 0,
        history: Array.isArray(raw.history) ? raw.history.length : 0
      }
    };
  };

  W.Store = Store;
})(window.WCC);
