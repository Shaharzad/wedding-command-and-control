/* Guests — one row per invitation, counted live by every dimension. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, Charts = W.Charts, t = W.t;

  var filter = 'all';
  var query = '';

  var FILTERS = [
    { key: 'all', label: 'guests.filter.all' },
    { key: 'attending', label: 'guests.filter.attending' },
    { key: 'pending', label: 'guests.filter.pending' },
    { key: 'declined', label: 'guests.filter.declined' },
    { key: 'maybe', label: 'guests.filter.maybe' },
    { key: 'bride', label: 'guests.filter.bride' },
    { key: 'groom', label: 'guests.filter.groom' }
  ];

  function matchesFilter(g, key) {
    switch (key) {
      case 'attending': return g.rsvp === 'Attending';
      case 'pending': return g.rsvp === 'Pending';
      case 'declined': return g.rsvp === 'Not Attending';
      case 'maybe': return g.rsvp === 'Maybe';
      case 'bride': return g.side === 'Bride' || g.side === 'Both';
      case 'groom': return g.side === 'Groom' || g.side === 'Both';
      default: return true;
    }
  }

  function matchesQuery(g, q) {
    if (!q) return true;
    return (g.name + ' ' + g.group + ' ' + g.phone + ' ' + g.notes + ' ' + g.meal)
      .toLowerCase().indexOf(q) >= 0;
  }

  function visible() {
    var q = query.trim().toLowerCase();
    return S.state.guests.filter(function (g) {
      return matchesFilter(g, filter) && matchesQuery(g, q);
    }).sort(function (a, b) {
      if (a.group !== b.group) return (a.group || 'zz') < (b.group || 'zz') ? -1 : 1;
      return a.name < b.name ? -1 : 1;
    });
  }

  /* --------------------------------------------------------------- form -- */

  function openForm(guest) {
    var editing = !!guest;
    var eventOptions = S.eventsSorted().map(function (e) {
      return { value: e.id, label: e.name + (e.date ? ' — ' + U.fmtDate(e.date, 'short') : '') };
    });

    var values = guest ? U.clone(guest) : {
      name: '', group: '', side: 'Both', phone: '',
      adults: 1, children: 0, rsvp: 'Pending', invitation: 'Not Sent',
      events: eventOptions.map(function (o) { return o.value; }),
      meal: 'No preference', notes: ''
    };

    UI.form({
      title: editing ? t('guests.edit') : t('guests.add'),
      values: values,
      submitLabel: editing ? t('common.saveChanges') : t('common.add'),
      fields: [
        [
          { name: 'name', label: t('guests.name'), type: 'text', required: true, placeholder: t('ph.fatimaSiddiqui') },
          { name: 'group', label: t('guests.group'), type: 'text', placeholder: t('ph.siddiquiFamily') }
        ],
        [
          { name: 'side', label: t('guests.side'), type: 'select', options: W.OPT.side, required: true },
          { name: 'phone', label: t('guests.phone'), type: 'tel', placeholder: t('ph.eg03001234567') }
        ],
        [
          { name: 'adults', label: t('guests.adults'), type: 'number', min: 0, step: 1, required: true },
          { name: 'children', label: t('guests.children'), type: 'number', min: 0, step: 1 }
        ],
        [
          { name: 'rsvp', label: t('guests.rsvp'), type: 'select', options: W.OPT.rsvp, required: true },
          { name: 'invitation', label: t('guests.invitation'), type: 'select', options: W.OPT.invitation, required: true }
        ],
        {
          name: 'events', label: t('guests.events'), type: 'checkgroup',
          options: eventOptions, emptyText: t('guests.noEvents')
        },
        { name: 'meal', label: t('guests.meal'), type: 'select', options: W.OPT.meal, required: true },
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ],
      onSubmit: function (vals) {
        vals.adults = U.num(vals.adults);
        vals.children = U.num(vals.children);
        if (editing) {
          S.guests.update(guest.id, vals);
          UI.toast(t('common.updated', { name: vals.name }), 'good');
        } else {
          S.guests.add(vals);
          UI.toast(t('common.added', { name: vals.name }), 'good');
        }
        return true;
      }
    });
  }

  /* ----------------------------------------------------------- bulk add --
     Entering a 400-name list one modal at a time is the worst job in the app,
     so this takes a pasted list in one go. */

  function bulkSummary(text) {
    var r = S.parseGuestList(text);
    if (!r.rows.length && !r.dupes) {
      return '<p class="hint">' + U.esc(t('guests.bulkNone')) + '</p>';
    }
    return '<p class="hint"><b>' + U.esc(t('guests.bulkPreview', { n: r.rows.length })) + '</b>' +
      (r.dupes ? '<br>' + U.esc(t('guests.bulkDupes', { n: r.dupes })) : '') + '</p>';
  }

  function openBulk() {
    var taId = U.uid('bulk');
    UI.openModal({
      title: t('guests.bulkTitle'),
      subtitle: t('guests.bulkSub'),
      bodyHTML: '<div class="field">' +
        '<label for="' + taId + '">' + U.esc(t('guests.bulkLabel')) + '</label>' +
        '<textarea id="' + taId + '" style="min-height:200px" placeholder="' +
        U.esc(t('ph.bulkGuests')) + '"></textarea>' +
        '<p class="hint">' + U.esc(t('guests.bulkFormat')) + '</p></div>' +
        '<div data-preview>' + bulkSummary('') + '</div>' +
        '<p class="hint">' + U.esc(t('guests.bulkAfter')) + '</p>',
      footHTML: '<button class="btn" data-role="cancel">' + U.esc(t('common.cancel')) + '</button>' +
        '<button class="btn btn-primary" data-role="ok">' + U.esc(t('guests.bulkAdd')) + '</button>',
      onMount: function (node, close) {
        var ta = node.querySelector('#' + taId);
        var preview = node.querySelector('[data-preview]');
        ta.addEventListener('input', function () {
          preview.innerHTML = bulkSummary(ta.value);
        });
        node.querySelector('[data-role="cancel"]').addEventListener('click', close);
        node.querySelector('[data-role="ok"]').addEventListener('click', function () {
          var parsed = S.parseGuestList(ta.value);
          if (!parsed.rows.length) { ta.focus(); return; }
          S.guests.addMany(parsed.rows);
          close();
          UI.toast(t('guests.bulkDone', { n: parsed.rows.length }), 'good');
        });
        ta.focus();
      }
    });
  }

  /* --------------------------------------------------------------- view -- */

  W.Views.guests = {
    title: t('guests.title'),
    openForm: openForm,
    openBulk: openBulk,

    render: function (root) {
      var all = S.state.guests;
      var stats = S.guestStats();
      var list = visible();

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('guests.title')) + '</h2>' +
        '<button class="btn" data-act="bulk">' + U.esc(t('guests.bulkAdd')) + '</button>' +
        '<button class="btn btn-primary" data-act="add">' + U.esc(t('guests.add')) + '</button>' +
        '</div>';

      if (!all.length) {
        html += UI.emptyHTML({
          title: t('guests.empty'),
          body: t('guests.emptyBody'),
          actionLabel: t('guests.add'),
          actionAttr: 'data-act="add"'
        });
        html += '<p class="section-note" style="text-align:center;margin-top:12px">' +
          '<button class="btn btn-sm" data-act="bulk">' + U.esc(t('guests.bulkAdd')) + '</button></p>';
        html += '</div>';
        root.innerHTML = html;
        wire(root);
        return;
      }

      html += '<div class="grid grid-kpi">' +
        '<div class="kpi accent-maroon"><p class="kpi-label">' + U.esc(t('guests.totalHeads')) +
        '</p><p class="kpi-value">' + U.esc(U.fmtNumber(stats.heads)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('guests.acrossInvites', { n: stats.groups })) + '</p></div>' +

        '<div class="kpi accent-emerald"><p class="kpi-label">' + U.esc(t('guests.filter.attending')) +
        '</p><p class="kpi-value">' + U.esc(U.fmtNumber(stats.attendingHeads)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('guests.ofInvited', { n: U.fmtNumber(stats.heads) })) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('guests.adultsChildren')) +
        '</p><p class="kpi-value">' + U.esc(U.fmtNumber(stats.adults)) + ' / ' + U.esc(U.fmtNumber(stats.children)) +
        '</p><p class="kpi-foot">' + U.esc(t('guests.adultsChildrenKey')) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('guests.repliesReceived')) +
        '</p><p class="kpi-value">' + stats.responseRate + '%</p>' +
        '<p class="kpi-foot">' + U.esc(t('guests.repliedOf', {
          replied: stats.groups - (stats.rsvp.Pending || 0), total: stats.groups
        })) + '</p></div>' +
        '</div></div>';

      html += '<div class="section"><div class="grid grid-2">' +
        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('guests.rsvpChart')) + '</h3></div>' +
        '<div data-chart-rsvp style="margin-top:10px"></div></div>' +
        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('guests.sideChart')) + '</h3></div>' +
        '<div data-chart-side style="margin-top:10px"></div></div>' +
        '</div></div>';

      html += '<div class="section"><div class="filters">';
      FILTERS.forEach(function (f) {
        var n = all.filter(function (x) { return matchesFilter(x, f.key); }).length;
        html += '<button class="filter-btn" data-act="filter" data-key="' + f.key + '" aria-pressed="' +
          (filter === f.key ? 'true' : 'false') + '">' + U.esc(t(f.label)) +
          ' <span class="filter-count">' + n + '</span></button>';
      });
      html += '<span class="spacer"></span><span class="search-wrap">' +
        '<label class="sr-only" for="guestSearch">' + U.esc(t('guests.searchPh')) + '</label>' +
        '<input class="search-input" id="guestSearch" type="text" data-act="search" data-fk="guestSearch" ' +
        'placeholder="' + U.esc(t('guests.searchPh')) + '" value="' + U.esc(query) + '"></span></div>';

      if (!list.length) {
        html += UI.emptyHTML({
          title: t('common.noMatches'),
          body: t('common.noMatchesHint'),
          actionLabel: t('common.clearFilters'),
          actionAttr: 'data-act="clear"'
        });
      } else {
        html += '<div class="table-wrap"><table><caption class="sr-only">' + U.esc(t('guests.title')) +
          '</caption><thead><tr>' +
          '<th scope="col">' + U.esc(t('guests.name')) + '</th>' +
          '<th scope="col">' + U.esc(t('guests.side')) + '</th>' +
          '<th scope="col">' + U.esc(t('guests.phone')) + '</th>' +
          '<th scope="col" class="num">' + U.esc(t('guests.adults')) + '</th>' +
          '<th scope="col" class="num">' + U.esc(t('guests.children')) + '</th>' +
          '<th scope="col" class="num">' + U.esc(t('guests.headcount')) + '</th>' +
          '<th scope="col">' + U.esc(t('guests.rsvp')) + '</th>' +
          '<th scope="col">' + U.esc(t('guests.invitation')) + '</th>' +
          '<th scope="col">' + U.esc(t('guests.events')) + '</th>' +
          '<th scope="col"><span class="sr-only">' + U.esc(t('common.actions')) + '</span></th>' +
          '</tr></thead><tbody>';

        list.forEach(function (g) {
          html += '<tr>' +
            '<td><div class="t-title">' + U.esc(g.name) + '</div>' +
            (g.group ? '<div class="t-sub">' + U.esc(g.group) + '</div>' : '') +
            (g.meal && g.meal !== 'No preference' ? '<div class="t-sub">' + U.esc(g.meal) + '</div>' : '') + '</td>' +
            '<td>' + U.esc(g.side) + '</td>' +
            '<td>' + (g.phone ? '<a href="tel:' + U.esc(g.phone.replace(/\s+/g, '')) + '">' + U.esc(g.phone) + '</a>'
              : '<span class="t-sub">' + U.esc(t('common.na')) + '</span>') + '</td>' +
            '<td class="num">' + g.adults + '</td>' +
            '<td class="num">' + g.children + '</td>' +
            '<td class="num"><b>' + (g.adults + g.children) + '</b></td>' +
            '<td>' + UI.statusChip(g.rsvp) + '</td>' +
            '<td>' + UI.chip(g.invitation, g.invitation === 'Not Sent' ? '' : 'emerald') + '</td>' +
            '<td>' + U.esc(t('events.invited', { n: g.events.length })) + '</td>' +
            '<td class="actions">' +
            '<button class="icon-btn" data-act="edit" data-id="' + U.esc(g.id) + '">' + U.esc(t('common.edit')) + '</button>' +
            '<button class="icon-btn danger" data-act="delete" data-id="' + U.esc(g.id) + '">' + U.esc(t('common.delete')) + '</button>' +
            '</td></tr>';
        });

        var shownHeads = U.sum(list, function (g) { return g.adults + g.children; });
        html += '</tbody><tfoot><tr><td colspan="3">' + U.esc(t('common.total')) + '</td>' +
          '<td class="num">' + U.sum(list, function (g) { return g.adults; }) + '</td>' +
          '<td class="num">' + U.sum(list, function (g) { return g.children; }) + '</td>' +
          '<td class="num">' + shownHeads + '</td>' +
          '<td colspan="4"></td></tr></tfoot></table></div>' +
          '<p class="section-note">' + U.esc(t('common.showing', { shown: list.length, total: all.length })) + '</p>';
      }
      html += '</div>';

      root.innerHTML = html;

      Charts.render(root.querySelector('[data-chart-rsvp]'), {
        type: 'donut',
        title: t('guests.rsvpChart'),
        centreValue: U.fmtNumber(stats.groups),
        centreLabel: t('dash.rsvpCentre'),
        items: W.OPT.rsvp.map(function (key) {
          return { label: key, value: stats.rsvp[key] || 0, color: Charts.RSVP_COLOURS[key] };
        })
      });

      Charts.render(root.querySelector('[data-chart-side]'), {
        type: 'donut',
        title: t('guests.sideChart'),
        centreValue: U.fmtNumber(stats.groups),
        centreLabel: t('dash.rsvpCentre'),
        items: W.OPT.side.map(function (key) {
          return { label: key, value: stats.side[key] || 0, color: Charts.SIDE_COLOURS[key] };
        })
      });

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
      } else if (act === 'bulk') {
        openBulk();
      } else if (act === 'edit') {
        openForm(S.guests.get(id));
      } else if (act === 'filter') {
        filter = btn.getAttribute('data-key');
        W.App.rerender();
      } else if (act === 'clear') {
        filter = 'all'; query = '';
        W.App.rerender();
      } else if (act === 'delete') {
        var g = S.guests.get(id);
        if (!g) return;
        UI.confirmDelete(g.name, function () {
          S.guests.remove(id);
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
