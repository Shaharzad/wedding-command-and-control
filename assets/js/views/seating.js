/* Seating plan — tables for one function at a time, with capacity warnings.
   A guest sits at one table per event; seating them somewhere new lifts them
   off the old table automatically. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, t = W.t;

  var currentEvent = '';

  function resolveEvent() {
    var events = S.eventsSorted();
    if (!events.length) return '';
    var found = false;
    events.forEach(function (e) { if (e.id === currentEvent) found = true; });
    if (found) return currentEvent;
    var today = U.todayISO();
    var upcoming = events.filter(function (e) { return !e.date || e.date >= today; });
    var pool = upcoming.length ? upcoming : events;
    /* Land on a function that already has tables, so returning to the page
       shows the work rather than an empty state. */
    var withTables = pool.filter(function (e) { return S.tablesForEvent(e.id).length; });
    currentEvent = (withTables[0] || pool[0]).id;
    return currentEvent;
  }

  /* --------------------------------------------------------------- forms -- */

  function openTableForm(table, eventId) {
    var editing = !!table;
    var values = table ? U.clone(table) : {
      name: '', capacity: 10, eventId: eventId, notes: ''
    };
    UI.form({
      title: editing ? t('seat.editTable') : t('seat.addTable'),
      values: values,
      submitLabel: editing ? t('common.saveChanges') : t('common.add'),
      fields: [
        [
          { name: 'name', label: t('seat.tableName'), type: 'text', required: true, placeholder: t('ph.table1') },
          { name: 'capacity', label: t('seat.capacity'), type: 'number', min: 1, step: 1, required: true }
        ],
        {
          name: 'eventId', label: t('seat.event'), type: 'select',
          options: W.Module.eventOptions(), required: true
        },
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ],
      onSubmit: function (vals) {
        vals.capacity = U.num(vals.capacity, 10);
        if (editing) {
          S.tables.update(table.id, vals);
          UI.toast(t('common.updated', { name: vals.name }), 'good');
        } else {
          S.tables.add(vals);
          UI.toast(t('common.added', { name: vals.name }), 'good');
        }
        currentEvent = vals.eventId;
        return true;
      }
    });
  }

  function openAssign(table) {
    var invited = S.guestsForEvent(table.eventId).filter(function (g) {
      return g.rsvp !== 'Not Attending';
    }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });

    var seatedElsewhere = S.seatedGuestIds(table.eventId);
    var options = invited.map(function (g) {
      var heads = S.guestHeads(g);
      var at = seatedElsewhere[g.id];
      var suffix = ' (' + heads + ')';
      if (at && at !== table.id) {
        var other = S.tables.get(at);
        if (other) suffix += ' — ' + other.name;
      }
      return { value: g.id, label: g.name + suffix };
    });

    UI.form({
      title: t('seat.assignTitle', { name: table.name }),
      subtitle: t('seat.assignSub'),
      values: { guestIds: table.guestIds.slice() },
      submitLabel: t('common.saveChanges'),
      fields: [
        {
          name: 'guestIds', label: t('seat.assign'), type: 'checkgroup',
          options: options, emptyText: t('seat.noGuests')
        }
      ],
      onSubmit: function (vals) {
        S.setTableGuests(table.id, vals.guestIds || []);
        UI.toast(t('common.saved'), 'good');
        return true;
      }
    });
  }

  /* ---------------------------------------------------------------- view -- */

  function tableCard(table) {
    var used = S.tableUsage(table);
    var over = used > table.capacity;
    var pct = table.capacity > 0 ? U.clamp(Math.round(used / table.capacity * 100), 0, 100) : 0;

    var guests = table.guestIds.map(function (id) { return S.guests.get(id); })
      .filter(Boolean)
      .sort(function (a, b) { return a.name < b.name ? -1 : 1; });

    var rows = guests.map(function (g) {
      return '<div class="check-row"><div class="check-main">' +
        '<div class="check-title">' + U.esc(g.name) + '</div>' +
        '<div class="check-meta"><span>' + S.guestHeads(g) + '</span>' +
        (g.group ? '<span>' + U.esc(g.group) + '</span>' : '') + '</div></div>' +
        '<button class="icon-btn danger" data-act="unseat" data-table="' + U.esc(table.id) +
        '" data-id="' + U.esc(g.id) + '" aria-label="' +
        U.esc(t('seat.remove', { name: g.name })) + '">' + U.esc(t('common.delete')) + '</button>' +
        '</div>';
    }).join('');

    if (!rows) {
      rows = '<div class="check-row"><div class="check-main"><div class="check-meta">' +
        U.esc(t('seat.unseated')) + '</div></div></div>';
    }

    return '<div class="event-card">' +
      '<div class="event-top">' +
      '<div class="event-type">' +
      U.esc(guests.length === 1 ? t('seat.guestOne') : t('seat.guestsHere', { n: guests.length })) +
      '</div>' +
      '<h3>' + U.esc(table.name) + '</h3>' +
      '<div class="event-when">' + U.esc(t('seat.seated', { used: used, capacity: table.capacity })) +
      '</div>' +
      '<div class="track" style="margin-top:8px"><span style="width:' + pct + '%' +
      (over ? ';background:var(--danger)' : '') + '"></span></div>' +
      '<div style="margin-top:8px">' +
      (over
        ? '<span class="chip chip-danger">⚠ ' + U.esc(t('seat.over', { n: used - table.capacity })) + '</span>'
        : (used === table.capacity
          ? UI.chip(t('seat.full'), 'gold')
          : UI.chip(t('seat.free', { n: table.capacity - used }), 'emerald'))) +
      '</div></div>' +
      '<div class="event-body" style="padding:0">' +
      '<div class="check-list" style="border:none;border-radius:0">' + rows + '</div>' +
      (table.notes ? '<p style="padding:10px 18px 0">' + U.esc(table.notes) + '</p>' : '') +
      '</div>' +
      '<div class="event-foot">' +
      '<button class="btn btn-sm" data-act="assign" data-id="' + U.esc(table.id) + '">' +
      U.esc(t('seat.assign')) + '</button>' +
      '<button class="icon-btn" data-act="edit" data-id="' + U.esc(table.id) + '">' +
      U.esc(t('common.edit')) + '</button>' +
      '<button class="icon-btn danger" data-act="delete" data-id="' + U.esc(table.id) + '">' +
      U.esc(t('common.delete')) + '</button>' +
      '</div></div>';
  }

  W.Views.seating = {
    title: t('seat.title'),
    openTableForm: openTableForm,

    render: function (root) {
      var events = S.eventsSorted();

      if (!events.length) {
        root.innerHTML = '<div class="section"><div class="section-head"><h2>' +
          U.esc(t('seat.title')) + '</h2></div>' +
          UI.emptyHTML({
            title: t('seat.noEvents'),
            body: t('seat.noEventsBody'),
            actionLabel: t('seat.addEvent'),
            actionAttr: 'data-act="goto-events"'
          }) + '</div>';
        wire(root);
        return;
      }

      var eventId = resolveEvent();
      var stats = S.seatingStats(eventId);
      var tables = S.tablesForEvent(eventId);
      var unseated = S.unseatedGuests(eventId);

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('seat.title')) + '</h2>' +
        '<p class="section-note">' + U.esc(t('seat.sub')) + '</p>' +
        '<button class="btn btn-primary" data-act="add">' + U.esc(t('seat.addTable')) + '</button>' +
        '</div>';

      html += '<div class="filters" role="group" aria-label="' + U.esc(t('seat.pickEvent')) + '">';
      events.forEach(function (e) {
        var n = S.tablesForEvent(e.id).length;
        html += '<button class="filter-btn" data-act="pick-event" data-id="' + U.esc(e.id) +
          '" aria-pressed="' + (e.id === eventId ? 'true' : 'false') + '">' + U.esc(e.name) +
          ' <span class="filter-count">' + n + '</span></button>';
      });
      html += '</div>';

      html += '<div class="grid grid-kpi">' +
        '<div class="kpi accent-maroon"><p class="kpi-label">' + U.esc(t('seat.totalSeats')) +
        '</p><p class="kpi-value">' + stats.capacity + '</p>' +
        '<p class="kpi-foot">' +
        U.esc(stats.tables === 1 ? t('seat.tableOne') : t('seat.tableCount', { n: stats.tables })) +
        '</p></div>' +

        '<div class="kpi accent-emerald"><p class="kpi-label">' + U.esc(t('seat.totalSeated')) +
        '</p><p class="kpi-value">' + stats.seated + ' / ' + stats.invitedHeads + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('dash.percentComplete', {
          n: U.pct(stats.seated, stats.invitedHeads)
        })) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('seat.unseated')) +
        '</p><p class="kpi-value">' + stats.unseatedHeads + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('seat.unseatedCount', {
          n: stats.unseatedGroups, heads: stats.unseatedHeads
        })) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('seat.overCount')) +
        '</p><p class="kpi-value">' + stats.over + '</p>' +
        (stats.over
          ? '<p class="kpi-foot warn">⚠ ' + U.esc(t('seat.tablesOver', { n: stats.over })) + '</p>'
          : '<p class="kpi-foot">' + U.esc(t('seat.tablesOk')) + '</p>') + '</div>' +
        '</div></div>';

      if (!tables.length) {
        html += '<div class="section">' + UI.emptyHTML({
          title: t('seat.empty'),
          body: t('seat.emptyBody'),
          actionLabel: t('seat.addTable'),
          actionAttr: 'data-act="add"'
        }) + '</div>';
      } else {
        html += '<div class="section"><div class="grid grid-cards">' +
          tables.map(tableCard).join('') + '</div></div>';
      }

      html += '<div class="section"><div class="section-head"><h2>' + U.esc(t('seat.unseated')) + '</h2>' +
        '<p class="section-note">' + U.esc(t('seat.unseatedCount', {
          n: stats.unseatedGroups, heads: stats.unseatedHeads
        })) + '</p></div>';
      if (!unseated.length) {
        html += '<div class="check-list"><div class="check-row"><div class="check-main">' +
          '<div class="check-meta">' + U.esc(t('seat.allSeated')) + '</div></div></div></div>';
      } else {
        html += '<div class="check-list">' + unseated.map(function (g) {
          return '<div class="check-row"><div class="check-main">' +
            '<div class="check-title">' + U.esc(g.name) + '</div>' +
            '<div class="check-meta"><span>' + S.guestHeads(g) + '</span>' +
            (g.group ? '<span>' + U.esc(g.group) + '</span>' : '') +
            UI.statusChip(g.rsvp) + '</div></div></div>';
        }).join('') + '</div>';
      }
      html += '</div>';

      root.innerHTML = html;
      wire(root);
    }
  };

  function wire(root) {
    root.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      var id = btn.getAttribute('data-id');

      if (act === 'add') {
        openTableForm(null, resolveEvent());
      } else if (act === 'edit') {
        openTableForm(S.tables.get(id), '');
      } else if (act === 'assign') {
        var table = S.tables.get(id);
        if (table) openAssign(table);
      } else if (act === 'unseat') {
        S.unseatGuest(btn.getAttribute('data-table'), id);
      } else if (act === 'pick-event') {
        currentEvent = id;
        W.App.rerender();
      } else if (act === 'goto-events') {
        window.location.hash = '#/events';
      } else if (act === 'delete') {
        var tb = S.tables.get(id);
        if (!tb) return;
        UI.confirmDelete(tb.name, function () {
          S.tables.remove(id);
        });
      }
    });
  }

})(window.WCC);
