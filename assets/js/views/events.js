/* Events — the multi-day function list, as cards.
   Calendar and timeline views arrive in Phase 3. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, t = W.t;

  var filter = 'all';
  var query = '';
  var viewMode = 'cards';
  var monthCursor = '';

  var VIEWS = [
    { key: 'cards', label: 'events.viewCards' },
    { key: 'timeline', label: 'events.viewTimeline' },
    { key: 'calendar', label: 'events.viewCalendar' }
  ];

  var FILTERS = [
    { key: 'all', label: 'events.filter.all' },
    { key: 'upcoming', label: 'events.filter.upcoming' },
    { key: 'past', label: 'events.filter.past' }
  ];

  function matchesFilter(e, key) {
    var today = U.todayISO();
    if (key === 'upcoming') return !e.date || e.date >= today;
    if (key === 'past') return !!e.date && e.date < today;
    return true;
  }

  function matchesQuery(e, q) {
    if (!q) return true;
    return (e.name + ' ' + e.type + ' ' + e.venue + ' ' + e.address + ' ' + e.theme + ' ' +
      e.dressCode + ' ' + e.notes).toLowerCase().indexOf(q) >= 0;
  }

  function visible() {
    var q = query.trim().toLowerCase();
    return S.eventsSorted().filter(function (e) {
      return matchesFilter(e, filter) && matchesQuery(e, q);
    });
  }

  /* --------------------------------------------------------------- form -- */

  function openForm(evt) {
    var editing = !!evt;
    var values = evt ? U.clone(evt) : {
      name: '', type: 'Mehndi', date: '', startTime: '', endTime: '',
      venue: '', address: '', dressCode: '', theme: '',
      expectedGuests: '', budget: '', status: 'Planning', notes: ''
    };

    UI.form({
      title: editing ? t('events.edit') : t('events.add'),
      values: values,
      submitLabel: editing ? t('common.saveChanges') : t('common.add'),
      fields: [
        [
          { name: 'name', label: t('events.name'), type: 'text', required: true, placeholder: t('ph.mehndiAtRoyalPalm') },
          { name: 'type', label: t('events.type'), type: 'select', options: W.OPT.eventType, required: true }
        ],
        [
          { name: 'date', label: t('events.date'), type: 'date', required: true },
          { name: 'status', label: t('events.status'), type: 'select', options: W.OPT.eventStatus, required: true }
        ],
        [
          { name: 'startTime', label: t('events.start'), type: 'time' },
          { name: 'endTime', label: t('events.end'), type: 'time' }
        ],
        { name: 'venue', label: t('events.venue'), type: 'text', placeholder: t('ph.royalPalmBanquetHall') },
        { name: 'address', label: t('events.address'), type: 'text' },
        [
          { name: 'dressCode', label: t('events.dressCode'), type: 'text', placeholder: t('ph.greenAndGold') },
          { name: 'theme', label: t('events.theme'), type: 'text', placeholder: t('ph.marigoldAndMirrorWork') }
        ],
        [
          { name: 'expectedGuests', label: t('events.expected'), type: 'number', min: 0, step: 1 },
          { name: 'budget', label: t('events.budget') + ' (PKR)', type: 'number', min: 0, step: 1000 }
        ],
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ],
      onSubmit: function (vals) {
        vals.expectedGuests = U.num(vals.expectedGuests);
        vals.budget = U.num(vals.budget);
        if (editing) {
          S.events.update(evt.id, vals);
          UI.toast(t('common.updated', { name: vals.name }), 'good');
        } else {
          S.events.add(vals);
          UI.toast(t('common.added', { name: vals.name }), 'good');
        }
        return true;
      }
    });
  }

  /* --------------------------------------------------------------- view -- */

  function whenChip(e) {
    var today = U.todayISO();
    if (!e.date) return UI.chip(t('common.na'));
    if (e.date < today) return UI.chip(t('events.past'));
    var away = U.daysBetween(today, e.date);
    if (away === 0) return UI.chip(t('events.todayLabel'), 'maroon');
    if (away === 1) return UI.chip(t('events.tomorrow'), 'gold');
    return UI.chip(t('events.daysAway', { n: away }), 'gold');
  }

  function cardHTML(e) {
    var when = [U.fmtTime(e.startTime), U.fmtTime(e.endTime)].filter(Boolean).join(' – ');
    var invited = S.guestsForEvent(e.id).length;

    var rows = '';
    function row(label, value) {
      if (!value) return;
      rows += '<dt>' + U.esc(label) + '</dt><dd>' + value + '</dd>';
    }
    row(t('events.venue'), e.venue ? U.esc(e.venue) : '');
    row(t('events.address'), e.address ? U.esc(e.address) : '');
    row(t('events.dressCode'), e.dressCode ? U.esc(e.dressCode) : '');
    row(t('events.theme'), e.theme ? U.esc(e.theme) : '');
    row(t('events.expected'), e.expectedGuests ? U.esc(U.fmtNumber(e.expectedGuests)) : '');
    row(t('events.budget'), e.budget ? U.esc(U.fmtMoney(e.budget)) : '');
    row(t('guests.events'), invited ? U.esc(t('events.invited', { n: invited })) : '');

    return '<div class="event-card">' +
      '<div class="event-top">' +
      '<div class="event-type">' + U.esc(e.type) + '</div>' +
      '<h3>' + U.esc(e.name) + '</h3>' +
      '<div class="event-when">' + U.esc(e.date ? U.fmtDate(e.date) : t('common.na')) +
      (when ? ', ' + U.esc(when) : '') + '</div>' +
      '</div>' +
      '<div class="event-body">' + (rows ? '<dl>' + rows + '</dl>' : '') +
      (e.notes ? '<p style="margin-top:8px">' + U.esc(e.notes) + '</p>' : '') + '</div>' +
      '<div class="event-foot">' + whenChip(e) + UI.statusChip(e.status) +
      '<button class="icon-btn" data-act="edit" data-id="' + U.esc(e.id) + '">' + U.esc(t('common.edit')) + '</button>' +
      '<button class="icon-btn danger" data-act="delete" data-id="' + U.esc(e.id) + '">' + U.esc(t('common.delete')) + '</button>' +
      '</div></div>';
  }

  /* ------------------------------------------------------------ timeline -- */

  function timelineHTML(list) {
    var today = U.todayISO();
    var dated = list.filter(function (e) { return !!e.date; })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return (a.startTime || '') < (b.startTime || '') ? -1 : 1;
      });
    var undated = list.filter(function (e) { return !e.date; });
    if (!dated.length && !undated.length) return '';

    var wedding = S.state.settings.weddingDate;
    var html = '<ol class="tl">';
    var prev = null;

    dated.concat(undated).forEach(function (e) {
      var gap = '';
      if (e.date && prev) {
        var n = U.daysBetween(prev, e.date);
        gap = n === 0 ? t('events.sameDay')
          : (n === 1 ? t('events.dayAfter') : t('events.daysBetween', { n: n }));
      }
      var when = [U.fmtTime(e.startTime), U.fmtTime(e.endTime)].filter(Boolean).join(' – ');
      var isWedding = !!wedding && e.date === wedding;

      html += '<li class="tl-item' + (e.date && e.date < today ? ' tl-past' : '') + '">' +
        (gap ? '<div class="tl-gap">' + U.esc(gap) + '</div>' : '') +
        '<div class="tl-marker" aria-hidden="true"></div>' +
        '<div class="tl-body">' +
        '<div class="tl-date">' + U.esc(e.date ? U.fmtDate(e.date, 'weekday') : t('common.na')) +
        (when ? ', ' + U.esc(when) : '') + '</div>' +
        '<h3>' + U.esc(e.name) + '</h3>' +
        '<div class="check-meta">' + UI.chip(e.type, 'gold') +
        (isWedding ? UI.chip(t('events.weddingDay'), 'maroon') : '') +
        UI.statusChip(e.status) +
        (e.venue ? '<span>' + U.esc(e.venue) + '</span>' : '') +
        (e.expectedGuests ? '<span>' + U.esc(t('events.invited', { n: e.expectedGuests })) + '</span>' : '') +
        '</div>' +
        (e.notes ? '<p class="card-sub">' + U.esc(e.notes) + '</p>' : '') +
        '<div class="tl-actions">' +
        '<button class="icon-btn" data-act="edit" data-id="' + U.esc(e.id) + '">' +
        U.esc(t('common.edit')) + '</button>' +
        '<button class="icon-btn danger" data-act="delete" data-id="' + U.esc(e.id) + '">' +
        U.esc(t('common.delete')) + '</button></div>' +
        '</div></li>';
      if (e.date) prev = e.date;
    });
    return html + '</ol>';
  }

  /* ------------------------------------------------------------ calendar -- */

  function resolveMonth(list) {
    if (monthCursor) return monthCursor;
    var dated = list.filter(function (e) { return !!e.date; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var today = U.todayISO();
    var next = null;
    dated.forEach(function (e) { if (!next && e.date >= today) next = e.date; });
    monthCursor = U.firstOfMonth(next || (dated[0] && dated[0].date) || today) ||
      U.firstOfMonth(today);
    return monthCursor;
  }

  function calendarHTML(list) {
    var anchor = resolveMonth(list);
    var weeks = U.monthWeeks(anchor);
    var today = U.todayISO();
    var wedding = S.state.settings.weddingDate;

    var byDate = {};
    list.forEach(function (e) {
      if (!e.date) return;
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    });

    /* Count what the grid actually shows, including the leading and trailing
       days borrowed from the neighbouring months. */
    var inMonth = 0;
    weeks.forEach(function (row) {
      row.forEach(function (day) { inMonth += (byDate[day] || []).length; });
    });

    var html = '<div class="cal-head">' +
      '<button class="btn btn-sm" data-act="prev-month" aria-label="' + U.esc(t('events.prevMonth')) + '">‹</button>' +
      '<h3>' + U.esc(U.monthName(anchor)) + '</h3>' +
      '<button class="btn btn-sm" data-act="next-month" aria-label="' + U.esc(t('events.nextMonth')) + '">›</button>' +
      '<button class="btn btn-sm" data-act="this-month">' + U.esc(t('events.thisMonth')) + '</button>' +
      '<span class="spacer"></span>' +
      '<span class="section-note">' + U.esc(inMonth ? t('common.showing', { shown: inMonth, total: list.length })
        : t('events.noneInMonth')) + '</span>' +
      '</div>';

    html += '<div class="cal-wrap"><table class="cal"><caption class="sr-only">' +
      U.esc(U.monthName(anchor)) + '</caption><thead><tr>';
    U.DOW_SHORT.forEach(function (d) { html += '<th scope="col">' + U.esc(d) + '</th>'; });
    html += '</tr></thead><tbody>';

    weeks.forEach(function (row) {
      html += '<tr>';
      row.forEach(function (day) {
        var other = !U.sameMonth(day, anchor);
        var chips = (byDate[day] || []).map(function (e) {
          return '<button class="cal-chip" data-act="edit" data-id="' + U.esc(e.id) + '">' +
            (e.startTime ? '<span class="cal-time">' + U.esc(U.fmtTime(e.startTime)) + '</span> ' : '') +
            U.esc(e.name) + '</button>';
        }).join('');
        html += '<td class="cal-cell' + (other ? ' cal-other' : '') +
          (day === today ? ' cal-today' : '') +
          (wedding && day === wedding ? ' cal-wedding' : '') + '">' +
          '<div class="cal-num">' + U.parseDate(day).getDate() + '</div>' + chips + '</td>';
      });
      html += '</tr>';
    });
    return html + '</tbody></table></div>';
  }

  W.Views.events = {
    title: t('events.title'),
    openForm: openForm,

    render: function (root) {
      var all = S.state.events;
      var list = visible();

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('events.title')) + '</h2>' +
        '<button class="btn btn-primary" data-act="add">' + U.esc(t('events.add')) + '</button>' +
        '</div>';

      if (!all.length) {
        html += UI.emptyHTML({
          title: t('events.empty'),
          body: t('events.emptyBody'),
          actionLabel: t('events.add'),
          actionAttr: 'data-act="add"'
        });
        html += '</div>';
        root.innerHTML = html;
        wire(root);
        return;
      }

      html += '<div class="filters">';
      FILTERS.forEach(function (f) {
        var n = all.filter(function (x) { return matchesFilter(x, f.key); }).length;
        html += '<button class="filter-btn" data-act="filter" data-key="' + f.key + '" aria-pressed="' +
          (filter === f.key ? 'true' : 'false') + '">' + U.esc(t(f.label)) +
          ' <span class="filter-count">' + n + '</span></button>';
      });
      html += '<span class="spacer"></span><span class="search-wrap">' +
        '<label class="sr-only" for="eventSearch">' + U.esc(t('events.searchPh')) + '</label>' +
        '<input class="search-input" id="eventSearch" type="text" data-act="search" data-fk="eventSearch" ' +
        'placeholder="' + U.esc(t('events.searchPh')) + '" value="' + U.esc(query) + '"></span></div>';

      html += '<div class="filters" role="group" aria-label="' + U.esc(t('events.viewLabel')) + '">';
      VIEWS.forEach(function (v) {
        html += '<button class="filter-btn" data-act="view" data-key="' + v.key + '" aria-pressed="' +
          (viewMode === v.key ? 'true' : 'false') + '">' + U.esc(t(v.label)) + '</button>';
      });
      html += '</div>';

      if (!list.length) {
        html += UI.emptyHTML({
          title: t('common.noMatches'),
          body: t('common.noMatchesHint'),
          actionLabel: t('common.clearFilters'),
          actionAttr: 'data-act="clear"'
        });
      } else if (viewMode === 'calendar') {
        html += calendarHTML(list);
      } else if (viewMode === 'timeline') {
        html += '<p class="section-note" style="margin-bottom:12px">' + U.esc(t('events.timelineSub')) + '</p>' +
          timelineHTML(list) +
          '<p class="section-note">' + U.esc(t('common.showing', { shown: list.length, total: all.length })) + '</p>';
      } else {
        html += '<div class="grid grid-cards">' + list.map(cardHTML).join('') + '</div>' +
          '<p class="section-note">' + U.esc(t('common.showing', { shown: list.length, total: all.length })) + '</p>';
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
        openForm(null);
      } else if (act === 'edit') {
        openForm(S.events.get(id));
      } else if (act === 'filter') {
        filter = btn.getAttribute('data-key');
        W.App.rerender();
      } else if (act === 'view') {
        viewMode = btn.getAttribute('data-key');
        W.App.rerender();
      } else if (act === 'prev-month') {
        monthCursor = U.addMonths(resolveMonth(S.eventsSorted()), -1);
        W.App.rerender();
      } else if (act === 'next-month') {
        monthCursor = U.addMonths(resolveMonth(S.eventsSorted()), 1);
        W.App.rerender();
      } else if (act === 'this-month') {
        monthCursor = U.firstOfMonth(U.todayISO());
        W.App.rerender();
      } else if (act === 'clear') {
        filter = 'all'; query = '';
        W.App.rerender();
      } else if (act === 'delete') {
        var evt = S.events.get(id);
        if (!evt) return;
        UI.confirmDelete(evt.name, function () {
          S.events.remove(id);
        });
      }
    });

    root.addEventListener('input', function (e) {
      if (e.target.getAttribute && e.target.getAttribute('data-act') === 'search') {
        query = e.target.value;
        W.App.rerender();
      }
    });
  }

})(window.WCC);
