/* Budget — planned against actual, in PKR, per category. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, Charts = W.Charts, t = W.t;

  var filter = 'all';
  var query = '';

  var FILTERS = [
    { key: 'all', label: 'budget.filter.all' },
    { key: 'over', label: 'budget.filter.over' },
    { key: 'unpaid', label: 'budget.filter.unpaid' },
    { key: 'partial', label: 'budget.filter.partial' },
    { key: 'paid', label: 'budget.filter.paid' }
  ];

  function matchesFilter(line, key) {
    switch (key) {
      case 'over': return line.actual > line.planned && line.planned > 0;
      case 'unpaid': return line.paymentStatus === 'Unpaid';
      case 'partial': return line.paymentStatus === 'Partially Paid';
      case 'paid': return line.paymentStatus === 'Paid';
      default: return true;
    }
  }

  function matchesQuery(line, q) {
    if (!q) return true;
    return (line.category + ' ' + line.vendor + ' ' + line.notes + ' ' + line.label)
      .toLowerCase().indexOf(q) >= 0;
  }

  function visible() {
    var q = query.trim().toLowerCase();
    return S.state.budget.filter(function (b) {
      return matchesFilter(b, filter) && matchesQuery(b, q);
    }).sort(function (a, b) { return b.planned - a.planned; });
  }

  /* Chart data is aggregated by category — several lines may share one. */
  function byCategory() {
    var map = {};
    S.state.budget.forEach(function (b) {
      if (!map[b.category]) map[b.category] = { label: b.category, planned: 0, spent: 0 };
      map[b.category].planned += b.planned;
      map[b.category].spent += b.actual;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.planned - a.planned; });
  }

  /* Top five spenders plus Other — never more than six slices. */
  function topSpend() {
    var cats = byCategory().filter(function (c) { return c.spent > 0; })
      .sort(function (a, b) { return b.spent - a.spent; });
    var top = cats.slice(0, 5);
    var rest = cats.slice(5);
    var items = top.map(function (c, i) {
      return { label: c.label, value: c.spent, color: Charts.PALETTE[i] };
    });
    if (rest.length) {
      items.push({
        label: t('budget.other'),
        value: U.sum(rest, function (c) { return c.spent; }),
        color: Charts.PALETTE[5]
      });
    }
    return items;
  }

  /* --------------------------------------------------------------- form -- */

  function openForm(line) {
    var editing = !!line;
    var values = line ? U.clone(line) : {
      category: 'Venue', planned: '', actual: 0,
      paymentStatus: 'Unpaid', vendor: '', paymentDate: '', notes: ''
    };

    UI.form({
      title: editing ? t('budget.edit') : t('budget.add'),
      values: values,
      submitLabel: editing ? t('common.saveChanges') : t('common.add'),
      fields: [
        { name: 'category', label: t('budget.category'), type: 'select', options: W.OPT.budgetCategory, required: true },
        [
          { name: 'planned', label: t('budget.planned') + ' (PKR)', type: 'number', min: 0, step: 1000, required: true },
          { name: 'actual', label: t('budget.actual') + ' (PKR)', type: 'number', min: 0, step: 1000 }
        ],
        [
          { name: 'paymentStatus', label: t('budget.paymentStatus'), type: 'select', options: W.OPT.paymentStatus, required: true },
          { name: 'paymentDate', label: t('budget.paymentDate'), type: 'date' }
        ],
        { name: 'vendor', label: t('budget.vendor'), type: 'text', placeholder: t('ph.falettisGrandMarquee') },
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ],
      onSubmit: function (vals) {
        vals.planned = U.num(vals.planned);
        vals.actual = U.num(vals.actual);
        if (editing) {
          S.budget.update(line.id, vals);
          UI.toast(t('common.updated', { name: vals.category }), 'good');
        } else {
          S.budget.add(vals);
          UI.toast(t('common.added', { name: vals.category }), 'good');
        }
        return true;
      }
    });
  }

  /* --------------------------------------------------------------- view -- */

  W.Views.budget = {
    title: t('budget.title'),
    openForm: openForm,
    byCategory: byCategory,
    topSpend: topSpend,

    render: function (root) {
      var all = S.state.budget;
      var stats = S.budgetStats();
      var list = visible();

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('budget.title')) + '</h2>' +
        '<button class="btn btn-primary" data-act="add">' + U.esc(t('budget.add')) + '</button>' +
        '</div>';

      if (!all.length) {
        html += UI.emptyHTML({
          title: t('budget.empty'),
          body: t('budget.emptyBody'),
          actionLabel: t('budget.add'),
          actionAttr: 'data-act="add"'
        });
        html += '</div>';
        root.innerHTML = html;
        wire(root);
        return;
      }

      html += '<div class="grid grid-kpi">' +
        '<div class="kpi accent-maroon"><p class="kpi-label">' + U.esc(t('budget.totalPlanned')) +
        '</p><p class="kpi-value money">' + U.esc(U.fmtMoney(stats.planned)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('budget.lineCount', { n: stats.lines })) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('budget.totalSpent')) +
        '</p><p class="kpi-value money">' + U.esc(U.fmtMoney(stats.spent)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('budget.percentOfPlanned', { n: stats.percent })) + '</p></div>' +

        '<div class="kpi accent-emerald"><p class="kpi-label">' + U.esc(t('budget.remaining')) +
        '</p><p class="kpi-value money">' + U.esc(U.fmtMoney(stats.remaining)) + '</p>' +
        (stats.overCount
          ? '<p class="kpi-foot warn">' + U.esc(t('dash.overBudget', { n: stats.overCount })) + '</p>'
          : '<p class="kpi-foot">' + U.esc(t('budget.withinBudget')) + '</p>') + '</div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('budget.due')) +
        '</p><p class="kpi-value money">' + U.esc(U.fmtMoney(stats.due)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('budget.acrossUnpaid')) + '</p></div>' +
        '</div></div>';

      html += '<div class="section"><div class="grid grid-2">' +
        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('budget.ranked')) + '</h3></div>' +
        '<p class="card-sub">' + U.esc(t('budget.rankedSub')) + '</p>' +
        '<div data-chart-ranked style="margin-top:10px"></div></div>' +
        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('budget.topSpend')) + '</h3></div>' +
        '<p class="card-sub">' + U.esc(t('budget.topSpendSub')) + '</p>' +
        '<div data-chart-top style="margin-top:10px"></div></div>' +
        '</div></div>';

      html += '<div class="section"><div class="filters">';
      FILTERS.forEach(function (f) {
        var n = all.filter(function (x) { return matchesFilter(x, f.key); }).length;
        html += '<button class="filter-btn" data-act="filter" data-key="' + f.key + '" aria-pressed="' +
          (filter === f.key ? 'true' : 'false') + '">' + U.esc(t(f.label)) +
          ' <span class="filter-count">' + n + '</span></button>';
      });
      html += '<span class="spacer"></span><span class="search-wrap">' +
        '<label class="sr-only" for="budgetSearch">' + U.esc(t('budget.searchPh')) + '</label>' +
        '<input class="search-input" id="budgetSearch" type="text" data-act="search" data-fk="budgetSearch" ' +
        'placeholder="' + U.esc(t('budget.searchPh')) + '" value="' + U.esc(query) + '"></span></div>';

      if (!list.length) {
        html += UI.emptyHTML({
          title: t('common.noMatches'),
          body: t('common.noMatchesHint'),
          actionLabel: t('common.clearFilters'),
          actionAttr: 'data-act="clear"'
        });
      } else {
        var shownPlanned = U.sum(list, function (b) { return b.planned; });
        var shownSpent = U.sum(list, function (b) { return b.actual; });

        html += '<div class="table-wrap"><table><caption class="sr-only">' + U.esc(t('budget.title')) +
          '</caption><thead><tr>' +
          '<th scope="col">' + U.esc(t('budget.category')) + '</th>' +
          '<th scope="col">' + U.esc(t('budget.vendor')) + '</th>' +
          '<th scope="col" class="num">' + U.esc(t('budget.planned')) + '</th>' +
          '<th scope="col" class="num">' + U.esc(t('budget.actual')) + '</th>' +
          '<th scope="col" class="num">' + U.esc(t('budget.difference')) + '</th>' +
          '<th scope="col">' + U.esc(t('budget.paymentStatus')) + '</th>' +
          '<th scope="col">' + U.esc(t('budget.paymentDate')) + '</th>' +
          '<th scope="col"><span class="sr-only">' + U.esc(t('common.actions')) + '</span></th>' +
          '</tr></thead><tbody>';

        list.forEach(function (b) {
          var over = b.actual > b.planned && b.planned > 0;
          var diff = b.planned - b.actual;
          html += '<tr>' +
            '<td><div class="t-title">' + U.esc(b.category) + (over ? ' <span class="chip chip-danger">⚠ ' +
              U.esc(t('budget.over')) + '</span>' : '') + '</div>' +
            (b.notes ? '<div class="t-sub">' + U.esc(b.notes.slice(0, 60)) + '</div>' : '') + '</td>' +
            '<td>' + (b.vendor ? U.esc(b.vendor) : '<span class="t-sub">' + U.esc(t('common.na')) + '</span>') + '</td>' +
            '<td class="num">' + U.esc(U.fmtMoney(b.planned)) + '</td>' +
            '<td class="num">' + U.esc(U.fmtMoney(b.actual)) + '</td>' +
            '<td class="num' + (over ? ' t-over' : '') + '">' +
            U.esc(over ? t('budget.overBy', { amt: U.fmtMoney(-diff) }) : t('budget.underBy', { amt: U.fmtMoney(diff) })) +
            '</td>' +
            '<td>' + UI.statusChip(b.paymentStatus) + '</td>' +
            '<td>' + (b.paymentDate ? U.esc(U.fmtDate(b.paymentDate, 'medium'))
              : '<span class="t-sub">' + U.esc(t('common.na')) + '</span>') + '</td>' +
            '<td class="actions">' +
            '<button class="icon-btn" data-act="edit" data-id="' + U.esc(b.id) + '">' + U.esc(t('common.edit')) + '</button>' +
            '<button class="icon-btn danger" data-act="delete" data-id="' + U.esc(b.id) + '">' + U.esc(t('common.delete')) + '</button>' +
            '</td></tr>';
        });

        html += '</tbody><tfoot><tr>' +
          '<td colspan="2">' + U.esc(t('common.total')) + '</td>' +
          '<td class="num">' + U.esc(U.fmtMoney(shownPlanned)) + '</td>' +
          '<td class="num">' + U.esc(U.fmtMoney(shownSpent)) + '</td>' +
          '<td class="num">' + U.esc(U.fmtMoney(shownPlanned - shownSpent)) + '</td>' +
          '<td colspan="3"></td>' +
          '</tr></tfoot></table></div>' +
          '<p class="section-note">' + U.esc(t('common.showing', { shown: list.length, total: all.length })) + '</p>';
      }
      html += '</div>';

      root.innerHTML = html;

      Charts.render(root.querySelector('[data-chart-ranked]'), {
        type: 'pairedBars',
        title: t('budget.ranked'),
        items: byCategory(),
        fmt: U.fmtMoneyShort,
        emptyText: t('budget.empty')
      });

      Charts.render(root.querySelector('[data-chart-top]'), {
        type: 'donut',
        title: t('budget.topSpend'),
        centreValue: U.fmtMoneyShort(stats.spent),
        centreLabel: t('budget.totalSpent').toLowerCase(),
        fmt: U.fmtMoney,
        items: topSpend()
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
        openForm(S.budget.get(id));
      } else if (act === 'filter') {
        filter = btn.getAttribute('data-key');
        W.App.rerender();
      } else if (act === 'clear') {
        filter = 'all'; query = '';
        W.App.rerender();
      } else if (act === 'delete') {
        var line = S.budget.get(id);
        if (!line) return;
        UI.confirmDelete(line.category, function () {
          S.budget.remove(id);
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
