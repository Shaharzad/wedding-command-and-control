/* Wedding-day command centre.
   One function at a time: an editable hour-by-hour running order, when each
   vendor arrives, the numbers to ring, what is still owed, and who is on what.
   Everything except the running order is read from data already entered. */
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
    /* Prefer a function that already has a running order. */
    var withSlots = pool.filter(function (e) { return S.slotsForEvent(e.id).length; });
    currentEvent = (withSlots[0] || pool[0]).id;
    return currentEvent;
  }

  /* --------------------------------------------------------------- forms -- */

  function openSlotForm(slot, eventId) {
    var editing = !!slot;
    var values = slot ? U.clone(slot) : {
      eventId: eventId, time: '18:00', title: '', owner: '', notes: ''
    };
    UI.form({
      title: editing ? t('cmd.editSlot') : t('cmd.addSlot'),
      values: values,
      submitLabel: editing ? t('common.saveChanges') : t('common.add'),
      fields: [
        [
          { name: 'time', label: t('cmd.time'), type: 'time', required: true },
          { name: 'owner', label: t('cmd.owner'), type: 'text', placeholder: t('ph.hira') }
        ],
        { name: 'title', label: t('cmd.slotTitle'), type: 'text', required: true,
          placeholder: t('ph.baraatLeavesTheHouse') },
        {
          name: 'eventId', label: t('cmd.pickEvent'), type: 'select',
          options: W.Module.eventOptions(), required: true
        },
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ],
      onSubmit: function (vals) {
        if (editing) {
          S.timeline.update(slot.id, vals);
          UI.toast(t('common.updated', { name: vals.title }), 'good');
        } else {
          S.timeline.add(vals);
          UI.toast(t('common.added', { name: vals.title }), 'good');
        }
        currentEvent = vals.eventId;
        return true;
      }
    });
  }

  function openArrivalForm(vendor) {
    UI.form({
      title: t('cmd.setArrival'),
      subtitle: vendor.name,
      values: { arrivalTime: vendor.arrivalTime || '16:00' },
      submitLabel: t('common.saveChanges'),
      fields: [
        { name: 'arrivalTime', label: t('cmd.arrivalTime'), type: 'time', required: true }
      ],
      onSubmit: function (vals) {
        S.vendors.update(vendor.id, { arrivalTime: vals.arrivalTime });
        UI.toast(t('cmd.arrivalSaved'), 'good');
        return true;
      }
    });
  }

  /* ---------------------------------------------------------------- view -- */

  function card(title, sub, bodyHTML, actionHTML) {
    return '<div class="card card-chart" style="padding:0;overflow:hidden">' +
      '<div style="padding:16px 20px 10px">' +
      '<div class="card-head"><h3>' + U.esc(title) + '</h3>' + (actionHTML || '') + '</div>' +
      (sub ? '<p class="card-sub">' + U.esc(sub) + '</p>' : '') + '</div>' +
      bodyHTML + '</div>';
  }

  function emptyRow(text) {
    return '<div class="check-list" style="border:none;border-radius:0;border-top:1px solid var(--rule)">' +
      '<div class="check-row"><div class="check-main"><div class="check-meta">' +
      U.esc(text) + '</div></div></div></div>';
  }

  W.Views.command = {
    title: t('cmd.title'),
    openSlotForm: openSlotForm,

    render: function (root) {
      var events = S.eventsSorted();

      if (!events.length) {
        root.innerHTML = '<div class="section"><div class="section-head"><h2>' +
          U.esc(t('cmd.title')) + '</h2></div>' +
          UI.emptyHTML({
            title: t('cmd.noEvents'),
            body: t('cmd.noEventsBody'),
            actionLabel: t('events.add'),
            actionAttr: 'data-act="goto-events"'
          }) + '</div>';
        wire(root);
        return;
      }

      var eventId = resolveEvent();
      var event = S.events.get(eventId);
      var plan = S.dayPlan(eventId);

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('cmd.title')) + '</h2>' +
        '<p class="section-note">' + U.esc(t('cmd.sub')) + '</p>' +
        '<button class="btn" data-act="print">' + U.esc(t('cmd.print')) + '</button>' +
        '<button class="btn btn-primary" data-act="add-slot">' + U.esc(t('cmd.addSlot')) + '</button>' +
        '</div>';

      html += '<div class="filters" role="group" aria-label="' + U.esc(t('cmd.pickEvent')) + '">';
      events.forEach(function (e) {
        var n = S.slotsForEvent(e.id).length;
        html += '<button class="filter-btn" data-act="pick-event" data-id="' + U.esc(e.id) +
          '" aria-pressed="' + (e.id === eventId ? 'true' : 'false') + '">' + U.esc(e.name) +
          ' <span class="filter-count">' + n + '</span></button>';
      });
      html += '</div>';

      /* --- the day at a glance --- */
      var when = [U.fmtTime(event.startTime), U.fmtTime(event.endTime)].filter(Boolean).join(' – ');
      html += '<div class="today-head">' +
        '<div class="today-date">' + U.esc(event.name) + '</div>' +
        '<p class="today-count">' +
        U.esc(event.date ? U.fmtDate(event.date, 'weekday') : t('common.na')) +
        (when ? ', ' + U.esc(when) : '') +
        (event.venue ? ' — ' + U.esc(event.venue) : '') + '</p>' +
        (plan.slots.length
          ? UI.progressBar(t('cmd.progress', { done: plan.slotsDone, total: plan.slots.length }),
            plan.slotsDone, plan.slots.length)
          : '') +
        '</div></div>';

      /* --- running order --- */
      var slotRows = plan.slots.map(function (sl) {
        return '<div class="check-row' + (sl.done ? ' done' : '') + '">' +
          UI.checkbox({
            done: sl.done,
            label: t(sl.done ? 'cmd.markNotDone' : 'cmd.markDone', { name: sl.title }),
            attrs: 'data-act="toggle-slot" data-id="' + U.esc(sl.id) + '" data-fk="chk_' + U.esc(sl.id) + '"'
          }) +
          '<div class="check-main"><div class="check-title">' +
          '<span class="slot-time">' + U.esc(U.fmtTime(sl.time)) + '</span> ' + U.esc(sl.title) + '</div>' +
          '<div class="check-meta">' +
          (sl.owner ? UI.chip(sl.owner, 'gold') : '') +
          (sl.notes ? '<span>' + U.esc(sl.notes) + '</span>' : '') + '</div></div>' +
          '<button class="icon-btn" data-act="edit-slot" data-id="' + U.esc(sl.id) + '">' +
          U.esc(t('common.edit')) + '</button>' +
          '<button class="icon-btn danger" data-act="delete-slot" data-id="' + U.esc(sl.id) + '">' +
          U.esc(t('common.delete')) + '</button></div>';
      }).join('');

      var timelineBody = slotRows
        ? '<div class="check-list" style="border:none;border-radius:0;border-top:1px solid var(--rule)">' +
          slotRows + '</div>'
        : '<div style="padding:0 20px 20px">' + UI.emptyHTML({
          title: t('cmd.timelineEmpty'),
          body: t('cmd.timelineEmptyBody'),
          actionLabel: t('cmd.addSlot'),
          actionAttr: 'data-act="add-slot"'
        }) + '</div>';

      html += '<div class="section">' +
        card(t('cmd.timeline'), t('cmd.timelineSub'), timelineBody) + '</div>';

      /* --- arrivals, contacts, payments, jobs --- */
      var arrivalRows = plan.arrivals.map(function (v) {
        return '<div class="check-row"><div class="check-main">' +
          '<div class="check-title">' +
          (v.arrivalTime ? '<span class="slot-time">' + U.esc(U.fmtTime(v.arrivalTime)) + '</span> ' : '') +
          U.esc(v.name) + '</div>' +
          '<div class="check-meta">' + UI.chip(v.category) +
          (v.contactName ? '<span>' + U.esc(v.contactName) + '</span>' : '') +
          (v.phone ? '<a href="tel:' + U.esc(v.phone.replace(/\s+/g, '')) + '">' + U.esc(v.phone) + '</a>' : '') +
          '</div></div>' +
          '<button class="icon-btn" data-act="set-arrival" data-id="' + U.esc(v.id) + '">' +
          U.esc(t('cmd.arrivalTime')) + '</button></div>';
      }).join('');

      var contactRows = S.state.contacts.slice(0, 12).map(function (c) {
        return '<div class="check-row"><div class="check-main">' +
          '<div class="check-title">' + U.esc(c.name) + '</div>' +
          '<div class="check-meta">' + UI.chip(c.role) +
          (c.relation ? '<span>' + U.esc(c.relation) + '</span>' : '') + '</div></div>' +
          (c.phone
            ? '<a class="btn btn-sm btn-emerald" href="tel:' + U.esc(c.phone.replace(/\s+/g, '')) +
              '" aria-label="' + U.esc(t('contacts.call', { name: c.name })) + '">' + U.esc(c.phone) + '</a>'
            : '<span class="t-sub">' + U.esc(t('contacts.noPhone')) + '</span>') +
          '</div>';
      }).join('');

      var paymentRows = plan.payments.map(function (v) {
        return '<div class="check-row"><div class="check-main">' +
          '<div class="check-title">' + U.esc(v.name) + '</div>' +
          '<div class="check-meta">' + UI.chip(v.category) +
          '<span>' + U.esc(t('vendors.paid')) + ' ' + U.esc(U.fmtMoney(S.vendorPaid(v))) + '</span>' +
          '</div></div>' +
          '<div class="t-title">' + U.esc(U.fmtMoney(S.vendorRemaining(v))) + '</div>' +
          '</div>';
      }).join('');

      var jobRows = plan.jobs.map(function (r) {
        var c = S.contactByName(r.person);
        return '<div class="check-row"><div class="check-main">' +
          '<div class="check-title">' + U.esc(r.person) + '</div>' +
          '<div class="check-meta">' + UI.chip(r.area, 'gold') +
          (r.description ? '<span>' + U.esc(r.description) + '</span>' : '') +
          (c && c.phone
            ? '<a href="tel:' + U.esc(c.phone.replace(/\s+/g, '')) + '">' + U.esc(c.phone) + '</a>' : '') +
          '</div></div>' + UI.statusChip(r.status) + '</div>';
      }).join('');

      html += '<div class="section"><div class="grid grid-wide">' +
        card(t('cmd.arrivals'), t('cmd.arrivalsSub'),
          arrivalRows
            ? '<div class="check-list" style="border:none;border-radius:0;border-top:1px solid var(--rule)">' +
              arrivalRows + '</div>'
            : emptyRow(t('cmd.noArrivals'))) +
        card(t('cmd.payments'),
          plan.payments.length ? t('cmd.paymentsSub') : '',
          paymentRows
            ? '<div class="check-list" style="border:none;border-radius:0;border-top:1px solid var(--rule)">' +
              paymentRows + '</div>'
            : emptyRow(t('cmd.noPayments')),
          (plan.outstanding
            ? '<span class="chip chip-danger">' + U.esc(U.fmtMoney(plan.outstanding)) + '</span>'
            : '') +
          '<button class="btn btn-sm" data-act="goto-vendors">' + U.esc(t('nav.vendors')) + '</button>') +
        card(t('cmd.contacts'), '',
          contactRows
            ? '<div class="check-list" style="border:none;border-radius:0;border-top:1px solid var(--rule)">' +
              contactRows + '</div>'
            : emptyRow(t('cmd.noContacts'))) +
        card(t('cmd.jobs'), '',
          jobRows
            ? '<div class="check-list" style="border:none;border-radius:0;border-top:1px solid var(--rule)">' +
              jobRows + '</div>'
            : emptyRow(t('cmd.noJobs'))) +
        '</div></div>';

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

      if (act === 'add-slot') {
        openSlotForm(null, resolveEvent());
      } else if (act === 'edit-slot') {
        openSlotForm(S.timeline.get(id), '');
      } else if (act === 'toggle-slot') {
        var sl = S.timeline.get(id);
        if (sl) S.timeline.update(id, { done: !sl.done });
      } else if (act === 'delete-slot') {
        var slot = S.timeline.get(id);
        if (!slot) return;
        UI.confirmDelete(slot.title, function () {
          S.timeline.remove(id);
        });
      } else if (act === 'set-arrival') {
        var v = S.vendors.get(id);
        if (v) openArrivalForm(v);
      } else if (act === 'pick-event') {
        currentEvent = id;
        W.App.rerender();
      } else if (act === 'goto-events') {
        window.location.hash = '#/events';
      } else if (act === 'goto-vendors') {
        window.location.hash = '#/vendors';
      } else if (act === 'print') {
        window.print();
      }
    });
  }

})(window.WCC);
