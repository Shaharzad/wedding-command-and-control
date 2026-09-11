/* Clothing and jewelry — one list with a person field, not three modules. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, Charts = W.Charts, t = W.t;

  var filter = 'all';
  var query = '';

  var FILTERS = [
    { key: 'all', label: 'ward.filter.all' },
    { key: 'Bride', label: 'ward.filter.bride' },
    { key: 'Groom', label: 'ward.filter.groom' },
    { key: 'Family', label: 'ward.filter.family' },
    { key: 'outstanding', label: 'ward.filter.outstanding' },
    { key: 'fittings', label: 'ward.filter.fittings' }
  ];

  function matchesFilter(w, key) {
    if (key === 'all') return true;
    if (key === 'outstanding') return w.status !== 'Ready';
    if (key === 'fittings') return !!w.fittingDate;
    return w.person === key;
  }

  function matchesQuery(w, q) {
    if (!q) return true;
    return (w.outfit + ' ' + w.designer + ' ' + w.wearer + ' ' + w.kind + ' ' +
      w.notes + ' ' + S.eventName(w.eventId)).toLowerCase().indexOf(q) >= 0;
  }

  function visible() {
    var q = query.trim().toLowerCase();
    var order = W.OPT.wardrobeStatus;
    return S.state.wardrobe.filter(function (w) {
      return matchesFilter(w, filter) && matchesQuery(w, q);
    }).sort(function (a, b) {
      var ai = order.indexOf(a.status), bi = order.indexOf(b.status);
      if (ai !== bi) return ai - bi;
      return a.outfit < b.outfit ? -1 : 1;
    });
  }

  function fittingCell(w) {
    if (!w.fittingDate) return '<span class="t-sub">' + U.esc(t('common.na')) + '</span>';
    var today = U.todayISO();
    if (w.fittingDate === today) {
      return '<span class="chip chip-maroon">' + U.esc(t('ward.fittingToday')) + '</span>';
    }
    if (w.fittingDate < today) {
      return '<span class="t-sub">' + U.esc(U.fmtDate(w.fittingDate, 'medium')) + '</span>';
    }
    return U.esc(U.fmtDate(w.fittingDate, 'medium'));
  }

  /* --------------------------------------------------------------- form -- */

  function openForm(item) {
    var editing = !!item;
    var events = S.eventsSorted().map(function (e) {
      return { value: e.id, label: e.name + (e.date ? ' — ' + U.fmtDate(e.date, 'short') : '') };
    });
    var values = item ? U.clone(item) : {
      person: 'Bride', wearer: '', kind: 'Outfit', outfit: '', designer: '',
      cost: '', status: 'To Buy', fittingDate: '', eventId: '', notes: ''
    };

    UI.form({
      title: editing ? t('ward.edit') : t('ward.add'),
      values: values,
      submitLabel: editing ? t('common.saveChanges') : t('common.add'),
      fields: [
        [
          { name: 'outfit', label: t('ward.outfit'), type: 'text', required: true, placeholder: t('ph.bridalJoraRedAndGold') },
          { name: 'kind', label: t('ward.kind'), type: 'select', options: W.OPT.wardrobeKind, required: true }
        ],
        [
          { name: 'person', label: t('ward.person'), type: 'select', options: W.OPT.person, required: true },
          { name: 'wearer', label: t('ward.wearer'), type: 'text', placeholder: t('ph.ammi'), hint: t('ward.wearerHint') }
        ],
        [
          { name: 'designer', label: t('ward.designer'), type: 'text', placeholder: t('ph.rimshaStudio') },
          { name: 'cost', label: t('ward.cost') + ' (PKR)', type: 'number', min: 0, step: 1000 }
        ],
        [
          { name: 'status', label: t('ward.status'), type: 'select', options: W.OPT.wardrobeStatus, required: true },
          { name: 'fittingDate', label: t('ward.fitting'), type: 'date' }
        ],
        {
          name: 'eventId', label: t('ward.event'), type: 'select', options: events,
          allowEmpty: true, emptyLabel: t('vendors.allEvents')
        },
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ],
      onSubmit: function (vals) {
        vals.cost = U.num(vals.cost);
        if (editing) {
          S.wardrobe.update(item.id, vals);
          UI.toast(t('common.updated', { name: vals.outfit }), 'good');
        } else {
          S.wardrobe.add(vals);
          UI.toast(t('common.added', { name: vals.outfit }), 'good');
        }
        return true;
      }
    });
  }

  /* --------------------------------------------------------------- view -- */

  W.Views.wardrobe = {
    title: t('ward.title'),
    openForm: openForm,

    render: function (root) {
      var all = S.state.wardrobe;
      var stats = S.wardrobeStats();
      var list = visible();

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('ward.title')) + '</h2>' +
        '<button class="btn btn-primary" data-act="add">' + U.esc(t('ward.add')) + '</button>' +
        '</div>';

      if (!all.length) {
        html += UI.emptyHTML({
          title: t('ward.empty'),
          body: t('ward.emptyBody'),
          actionLabel: t('ward.add'),
          actionAttr: 'data-act="add"'
        });
        html += '</div>';
        root.innerHTML = html;
        wire(root);
        return;
      }

      html += '<div class="grid grid-kpi">' +
        '<div class="kpi accent-maroon"><p class="kpi-label">' + U.esc(t('ward.totalCost')) +
        '</p><p class="kpi-value money">' + U.esc(U.fmtMoney(stats.cost)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('ward.itemCount', { n: stats.total })) + '</p></div>' +

        '<div class="kpi accent-emerald"><p class="kpi-label">' + U.esc(t('ward.readyCount')) +
        '</p><p class="kpi-value">' + stats.ready + ' / ' + stats.total + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('dash.percentComplete', { n: U.pct(stats.ready, stats.total) })) +
        '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('ward.outstandingCount')) +
        '</p><p class="kpi-value">' + stats.outstanding + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('ward.filter.outstanding')) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('ward.person')) +
        '</p><p class="kpi-value">' + stats.byPerson.Bride + ' / ' + stats.byPerson.Groom +
        ' / ' + stats.byPerson.Family + '</p>' +
        '<p class="kpi-foot">' + U.esc(W.OPT.person.join(' / ')) + '</p></div>' +
        '</div></div>';

      html += '<div class="section"><div class="grid grid-2">' +
        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('ward.byStatus')) + '</h3></div>' +
        '<div data-chart-status style="margin-top:10px"></div></div>' +
        UI.reconcileCard({
          tracked: stats.cost,
          categories: ['Bridal Outfits', 'Groom Outfits', 'Jewelry']
        }) +
        '</div></div>';

      html += '<div class="section"><div class="filters">';
      FILTERS.forEach(function (f) {
        var n = all.filter(function (x) { return matchesFilter(x, f.key); }).length;
        html += '<button class="filter-btn" data-act="filter" data-key="' + f.key + '" aria-pressed="' +
          (filter === f.key ? 'true' : 'false') + '">' + U.esc(t(f.label)) +
          ' <span class="filter-count">' + n + '</span></button>';
      });
      html += '<span class="spacer"></span><span class="search-wrap">' +
        '<label class="sr-only" for="wardSearch">' + U.esc(t('ward.searchPh')) + '</label>' +
        '<input class="search-input" id="wardSearch" type="text" data-act="search" data-fk="wardSearch" ' +
        'placeholder="' + U.esc(t('ward.searchPh')) + '" value="' + U.esc(query) + '"></span></div>';

      if (!list.length) {
        html += UI.emptyHTML({
          title: t('common.noMatches'),
          body: t('common.noMatchesHint'),
          actionLabel: t('common.clearFilters'),
          actionAttr: 'data-act="clear"'
        });
      } else {
        html += '<div class="table-wrap"><table><caption class="sr-only">' + U.esc(t('ward.title')) +
          '</caption><thead><tr>' +
          '<th scope="col">' + U.esc(t('ward.outfit')) + '</th>' +
          '<th scope="col">' + U.esc(t('ward.person')) + '</th>' +
          '<th scope="col">' + U.esc(t('ward.kind')) + '</th>' +
          '<th scope="col">' + U.esc(t('ward.event')) + '</th>' +
          '<th scope="col" class="num">' + U.esc(t('ward.cost')) + '</th>' +
          '<th scope="col">' + U.esc(t('ward.status')) + '</th>' +
          '<th scope="col">' + U.esc(t('ward.fitting')) + '</th>' +
          '<th scope="col"><span class="sr-only">' + U.esc(t('common.actions')) + '</span></th>' +
          '</tr></thead><tbody>';

        list.forEach(function (w) {
          var event = S.eventName(w.eventId);
          html += '<tr' + (w.status === 'Ready' ? ' class="is-done"' : '') + '>' +
            '<td><div class="t-title">' + U.esc(w.outfit) + '</div>' +
            (w.designer ? '<div class="t-sub">' + U.esc(w.designer) + '</div>' : '') + '</td>' +
            '<td>' + U.esc(w.person) + (w.wearer ? '<div class="t-sub">' + U.esc(w.wearer) + '</div>' : '') + '</td>' +
            '<td>' + U.esc(w.kind) + '</td>' +
            '<td>' + (event ? U.esc(event) : '<span class="t-sub">' + U.esc(t('vendors.allEvents')) + '</span>') + '</td>' +
            '<td class="num">' + U.esc(U.fmtMoney(w.cost)) + '</td>' +
            '<td>' + UI.chip(w.status, w.status === 'Ready' ? 'emerald'
              : (w.status === 'To Buy' ? '' : 'gold')) + '</td>' +
            '<td>' + fittingCell(w) + '</td>' +
            '<td class="actions">' +
            '<button class="icon-btn" data-act="edit" data-id="' + U.esc(w.id) + '">' + U.esc(t('common.edit')) + '</button>' +
            '<button class="icon-btn danger" data-act="delete" data-id="' + U.esc(w.id) + '">' + U.esc(t('common.delete')) + '</button>' +
            '</td></tr>';
        });

        html += '</tbody><tfoot><tr><td colspan="4">' + U.esc(t('common.total')) + '</td>' +
          '<td class="num">' + U.esc(U.fmtMoney(U.sum(list, function (w) { return w.cost; }))) + '</td>' +
          '<td colspan="3"></td></tr></tfoot></table></div>' +
          '<p class="section-note">' + U.esc(t('common.showing', { shown: list.length, total: all.length })) + '</p>';
      }
      html += '</div>';

      root.innerHTML = html;

      Charts.render(root.querySelector('[data-chart-status]'), {
        type: 'bars',
        title: t('ward.byStatus'),
        hue: 'emerald',
        items: W.OPT.wardrobeStatus.map(function (s) {
          return { label: s, value: stats.byStatus[s] || 0 };
        }),
        emptyText: t('ward.empty')
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
        openForm(S.wardrobe.get(id));
      } else if (act === 'goto-budget') {
        window.location.hash = '#/budget';
      } else if (act === 'filter') {
        filter = btn.getAttribute('data-key');
        W.App.rerender();
      } else if (act === 'clear') {
        filter = 'all'; query = '';
        W.App.rerender();
      } else if (act === 'delete') {
        var w = S.wardrobe.get(id);
        if (!w) return;
        UI.confirmDelete(w.outfit, function () {
          S.wardrobe.remove(id);
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
