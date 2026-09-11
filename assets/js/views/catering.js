/* Catering — the menu by course, priced per head, totalled per event. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, Charts = W.Charts, t = W.t;

  var query = '';

  function matchesQuery(m, q) {
    if (!q) return true;
    return (m.name + ' ' + m.course + ' ' + m.notes + ' ' + S.eventName(m.eventId))
      .toLowerCase().indexOf(q) >= 0;
  }

  /* --------------------------------------------------------------- forms -- */

  function openForm(item) {
    var editing = !!item;
    var events = S.eventsSorted().map(function (e) {
      return { value: e.id, label: e.name + (e.date ? ' — ' + U.fmtDate(e.date, 'short') : '') };
    });
    var values = item ? U.clone(item) : {
      course: 'Main course', name: '', costPerHead: '', eventId: '', notes: ''
    };

    UI.form({
      title: editing ? t('cater.edit') : t('cater.add'),
      values: values,
      submitLabel: editing ? t('common.saveChanges') : t('common.add'),
      fields: [
        [
          { name: 'name', label: t('cater.dish'), type: 'text', required: true, placeholder: t('ph.muttonKarahi') },
          { name: 'course', label: t('cater.course'), type: 'select', options: W.OPT.course, required: true }
        ],
        [
          {
            name: 'costPerHead', label: t('cater.costPerHead') + ' (PKR)', type: 'number',
            min: 0, step: 10, required: true
          },
          {
            name: 'eventId', label: t('cater.event'), type: 'select', options: events,
            allowEmpty: true, emptyLabel: t('cater.anyEvent')
          }
        ],
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ],
      onSubmit: function (vals) {
        vals.costPerHead = U.num(vals.costPerHead);
        if (editing) {
          S.menu.update(item.id, vals);
          UI.toast(t('common.updated', { name: vals.name }), 'good');
        } else {
          S.menu.add(vals);
          UI.toast(t('common.added', { name: vals.name }), 'good');
        }
        return true;
      }
    });
  }

  function openGuestCount() {
    var attending = S.guestStats().attendingHeads;
    var current = S.state.catering.guestCount;
    UI.form({
      title: t('cater.setCount'),
      values: { guestCount: current || attending || '' },
      submitLabel: t('common.saveChanges'),
      fields: [
        {
          name: 'guestCount', label: t('cater.guestCount'), type: 'number',
          min: 0, step: 1, required: true,
          hint: t('cater.guestCountHint') + ' ' + t('cater.useAttending', { n: attending })
        }
      ],
      onSubmit: function (vals) {
        S.setGuestCount(vals.guestCount);
        UI.toast(t('cater.countSaved'), 'good');
        return true;
      }
    });
  }

  /* --------------------------------------------------------------- view -- */

  function groupCard(group, q) {
    var items = group.items.filter(function (m) { return matchesQuery(m, q); });
    if (!items.length) return '';

    var order = W.OPT.course;
    items.sort(function (a, b) {
      var ai = order.indexOf(a.course), bi = order.indexOf(b.course);
      if (ai !== bi) return ai - bi;
      return a.name < b.name ? -1 : 1;
    });

    var title = group.name || t('cater.anyEvent');
    var when = group.event && group.event.date ? U.fmtDate(group.event.date, 'medium') : '';

    var rows = '';
    items.forEach(function (m) {
      rows += '<tr><td>' + U.esc(m.course) + '</td>' +
        '<td><div class="t-title">' + U.esc(m.name) + '</div>' +
        (m.notes ? '<div class="t-sub">' + U.esc(m.notes) + '</div>' : '') + '</td>' +
        '<td class="num">' + U.esc(U.fmtMoney(m.costPerHead)) + '</td>' +
        '<td class="actions">' +
        '<button class="icon-btn" data-act="edit" data-id="' + U.esc(m.id) + '">' + U.esc(t('common.edit')) + '</button>' +
        '<button class="icon-btn danger" data-act="delete" data-id="' + U.esc(m.id) + '">' + U.esc(t('common.delete')) + '</button>' +
        '</td></tr>';
    });

    var perHead = U.sum(items, function (m) { return m.costPerHead; });

    return '<div class="card card-chart" style="padding:0;overflow:hidden">' +
      '<div style="padding:16px 20px 10px">' +
      '<div class="card-head"><h3>' + U.esc(title) + '</h3>' +
      (when ? UI.chip(when, 'gold') : '') + '</div>' +
      '<p class="card-sub">' + U.esc(t('cater.heads', { n: U.fmtNumber(group.heads) })) + ' — ' +
      U.esc(group.fromEvent ? t('cater.headsFrom') : t('cater.headsFallback')) + '</p></div>' +
      '<div class="table-wrap" style="border:none;border-radius:0;border-top:1px solid var(--rule)">' +
      '<table style="min-width:380px"><caption class="sr-only">' + U.esc(title) + '</caption><thead><tr>' +
      '<th scope="col">' + U.esc(t('cater.course')) + '</th>' +
      '<th scope="col">' + U.esc(t('cater.dish')) + '</th>' +
      '<th scope="col" class="num">' + U.esc(t('cater.perHead')) + '</th>' +
      '<th scope="col"><span class="sr-only">' + U.esc(t('common.actions')) + '</span></th>' +
      '</tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="2">' + U.esc(t('cater.perHead')) + ' — ' +
      U.esc(t('cater.dishes', { n: items.length })) + '</td>' +
      '<td class="num">' + U.esc(U.fmtMoney(perHead)) + '</td><td></td></tr>' +
      '<tr><td colspan="2">' + U.esc(t('cater.eventTotal')) + '</td>' +
      '<td class="num">' + U.esc(U.fmtMoney(perHead * group.heads)) + '</td><td></td></tr>' +
      '</tfoot></table></div></div>';
  }

  W.Views.catering = {
    title: t('cater.title'),
    openForm: openForm,

    render: function (root) {
      var stats = S.cateringStats();
      var q = query.trim().toLowerCase();

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('cater.title')) + '</h2>' +
        '<button class="btn" data-act="count">' + U.esc(t('cater.setCount')) + '</button>' +
        '<button class="btn btn-primary" data-act="add">' + U.esc(t('cater.add')) + '</button>' +
        '</div>';

      if (!stats.items) {
        html += UI.emptyHTML({
          title: t('cater.empty'),
          body: t('cater.emptyBody'),
          actionLabel: t('cater.add'),
          actionAttr: 'data-act="add"'
        });
        html += '</div>';
        root.innerHTML = html;
        wire(root);
        return;
      }

      html += '<div class="grid grid-kpi">' +
        '<div class="kpi accent-maroon"><p class="kpi-label">' + U.esc(t('cater.grandTotal')) +
        '</p><p class="kpi-value money">' + U.esc(U.fmtMoney(stats.grandTotal)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('cater.dishes', { n: stats.items })) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('cater.perHead')) +
        '</p><p class="kpi-value money">' + U.esc(U.fmtMoney(stats.perHeadTotal)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('cater.byCourse')) + '</p></div>' +

        '<div class="kpi accent-emerald"><p class="kpi-label">' + U.esc(t('cater.guestCount')) +
        '</p><p class="kpi-value">' + U.esc(U.fmtNumber(stats.guestCount)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('cater.guestCountHint')) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('nav.events')) +
        '</p><p class="kpi-value">' + stats.groups.length + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('cater.eventTotal')) + '</p></div>' +
        '</div></div>';

      html += '<div class="section"><div class="grid grid-2">' +
        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('cater.byCourse')) + '</h3></div>' +
        '<div data-chart-course style="margin-top:10px"></div></div>' +
        UI.reconcileCard({ tracked: stats.grandTotal, categories: ['Catering'] }) +
        '</div></div>';

      html += '<div class="section"><div class="filters">' +
        '<span class="search-wrap">' +
        '<label class="sr-only" for="caterSearch">' + U.esc(t('cater.searchPh')) + '</label>' +
        '<input class="search-input" id="caterSearch" type="text" data-act="search" data-fk="caterSearch" ' +
        'placeholder="' + U.esc(t('cater.searchPh')) + '" value="' + U.esc(query) + '"></span></div>';

      var cards = stats.groups.map(function (g) { return groupCard(g, q); }).filter(Boolean);
      if (!cards.length) {
        html += UI.emptyHTML({
          title: t('common.noMatches'),
          body: t('common.noMatchesHint'),
          actionLabel: t('common.clearFilters'),
          actionAttr: 'data-act="clear"'
        });
      } else {
        /* Two per row, so the edit and delete buttons stay on screen rather
           than hiding behind a sideways scroll inside a narrow card. */
        html += '<div class="grid grid-wide">' + cards.join('') + '</div>';
      }
      html += '</div>';

      root.innerHTML = html;

      Charts.render(root.querySelector('[data-chart-course]'), {
        type: 'bars',
        title: t('cater.byCourse'),
        items: stats.byCourse,
        fmt: U.fmtMoney,
        emptyText: t('cater.empty')
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
      } else if (act === 'edit') {
        openForm(S.menu.get(id));
      } else if (act === 'count') {
        openGuestCount();
      } else if (act === 'goto-budget') {
        window.location.hash = '#/budget';
      } else if (act === 'clear') {
        query = '';
        W.App.rerender();
      } else if (act === 'delete') {
        var m = S.menu.get(id);
        if (!m) return;
        UI.confirmDelete(m.name, function () {
          S.menu.remove(id);
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
