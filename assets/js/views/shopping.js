/* Shopping list — tick things off as they are bought. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, Charts = W.Charts, t = W.t;

  var filter = 'all';
  var query = '';

  var FILTERS = [
    { key: 'all', label: 'shop.filter.all' },
    { key: 'To Buy', label: 'shop.filter.toBuy' },
    { key: 'Ordered', label: 'shop.filter.ordered' },
    { key: 'Bought', label: 'shop.filter.bought' }
  ];

  function matchesFilter(x, key) {
    return key === 'all' ? true : x.status === key;
  }

  function matchesQuery(x, q) {
    if (!q) return true;
    return (x.item + ' ' + x.category + ' ' + x.assignedTo + ' ' + x.notes)
      .toLowerCase().indexOf(q) >= 0;
  }

  function visible() {
    var q = query.trim().toLowerCase();
    var order = W.OPT.shoppingStatus;
    return S.state.shopping.filter(function (x) {
      return matchesFilter(x, filter) && matchesQuery(x, q);
    }).sort(function (a, b) {
      var ai = order.indexOf(a.status), bi = order.indexOf(b.status);
      if (ai !== bi) return ai - bi;
      return a.item < b.item ? -1 : 1;
    });
  }

  function toggleBought(id) {
    var x = S.shopping.get(id);
    if (!x) return;
    if (x.status === 'Bought') {
      S.shopping.update(id, { status: 'To Buy', purchaseDate: '' });
    } else {
      S.shopping.update(id, { status: 'Bought', purchaseDate: U.todayISO() });
    }
  }

  /* --------------------------------------------------------------- form -- */

  function openForm(item) {
    var editing = !!item;
    var values = item ? U.clone(item) : {
      item: '', category: 'Other', quantity: 1, estimatedCost: '',
      status: 'To Buy', assignedTo: '', purchaseDate: '', notes: ''
    };

    UI.form({
      title: editing ? t('shop.edit') : t('shop.add'),
      values: values,
      submitLabel: editing ? t('common.saveChanges') : t('common.add'),
      fields: [
        [
          { name: 'item', label: t('shop.item'), type: 'text', required: true, placeholder: t('ph.khussaForTheBride') },
          { name: 'category', label: t('shop.category'), type: 'select', options: W.OPT.shoppingCategory, required: true }
        ],
        [
          { name: 'quantity', label: t('shop.quantity'), type: 'number', min: 1, step: 1, required: true },
          { name: 'estimatedCost', label: t('shop.estimatedCost') + ' (PKR)', type: 'number', min: 0, step: 100 }
        ],
        [
          { name: 'status', label: t('shop.status'), type: 'select', options: W.OPT.shoppingStatus, required: true },
          W.Cloud.isEnabled() && W.Cloud.people().length
            ? { name: 'assignee', label: t('assign.label'), type: 'member' }
            : { name: 'assignedTo', label: t('shop.assignedTo'), type: 'text', placeholder: t('ph.ammi') }
        ],
        { name: 'purchaseDate', label: t('shop.purchaseDate'), type: 'date' },
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ],
      onSubmit: function (vals) {
        vals.quantity = U.num(vals.quantity, 1);
        vals.estimatedCost = U.num(vals.estimatedCost);
        if (vals.assignee) {
          var who = W.Cloud.personName(vals.assignee);
          if (who) vals.assignedTo = who;
        }
        if (editing) {
          S.shopping.update(item.id, vals);
          UI.toast(t('common.updated', { name: vals.item }), 'good');
        } else {
          S.shopping.add(vals);
          UI.toast(t('common.added', { name: vals.item }), 'good');
        }
        return true;
      }
    });
  }

  /* --------------------------------------------------------------- view -- */

  W.Views.shopping = {
    title: t('shop.title'),
    openForm: openForm,

    render: function (root) {
      var all = S.state.shopping;
      var stats = S.shoppingStats();
      var list = visible();

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('shop.title')) + '</h2>' +
        '<button class="btn btn-primary" data-act="add">' + U.esc(t('shop.add')) + '</button>' +
        '</div>';

      if (!all.length) {
        html += UI.emptyHTML({
          title: t('shop.empty'),
          body: t('shop.emptyBody'),
          actionLabel: t('shop.add'),
          actionAttr: 'data-act="add"'
        });
        html += '</div>';
        root.innerHTML = html;
        wire(root);
        return;
      }

      html += '<div class="grid grid-kpi">' +
        '<div class="kpi accent-emerald"><p class="kpi-label">' + U.esc(t('shop.boughtCount')) +
        '</p><p class="kpi-value">' + stats.bought + ' / ' + stats.total + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('dash.percentComplete', { n: stats.percent })) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('shop.leftCount')) +
        '</p><p class="kpi-value">' + stats.left + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('shop.filter.toBuy')) + '</p></div>' +

        '<div class="kpi accent-maroon"><p class="kpi-label">' + U.esc(t('shop.estTotal')) +
        '</p><p class="kpi-value money">' + U.esc(U.fmtMoney(stats.estimated)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('shop.note')) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('shop.estLeft')) +
        '</p><p class="kpi-value money">' + U.esc(U.fmtMoney(stats.estimatedLeft)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('shop.leftCount')) + '</p></div>' +
        '</div></div>';

      html += '<div class="section"><div class="filters">';
      FILTERS.forEach(function (f) {
        var n = all.filter(function (x) { return matchesFilter(x, f.key); }).length;
        html += '<button class="filter-btn" data-act="filter" data-key="' + f.key + '" aria-pressed="' +
          (filter === f.key ? 'true' : 'false') + '">' + U.esc(t(f.label)) +
          ' <span class="filter-count">' + n + '</span></button>';
      });
      html += '<span class="spacer"></span><span class="search-wrap">' +
        '<label class="sr-only" for="shopSearch">' + U.esc(t('shop.searchPh')) + '</label>' +
        '<input class="search-input" id="shopSearch" type="text" data-act="search" data-fk="shopSearch" ' +
        'placeholder="' + U.esc(t('shop.searchPh')) + '" value="' + U.esc(query) + '"></span></div>';

      if (!list.length) {
        html += UI.emptyHTML({
          title: t('common.noMatches'),
          body: t('common.noMatchesHint'),
          actionLabel: t('common.clearFilters'),
          actionAttr: 'data-act="clear"'
        });
      } else {
        html += '<div class="table-wrap"><table><caption class="sr-only">' + U.esc(t('shop.title')) +
          '</caption><thead><tr>' +
          '<th scope="col"><span class="sr-only">' + U.esc(t('common.done')) + '</span></th>' +
          '<th scope="col">' + U.esc(t('shop.item')) + '</th>' +
          '<th scope="col">' + U.esc(t('shop.category')) + '</th>' +
          '<th scope="col" class="num">' + U.esc(t('shop.quantity')) + '</th>' +
          '<th scope="col" class="num">' + U.esc(t('shop.estimatedCost')) + '</th>' +
          '<th scope="col">' + U.esc(t('shop.status')) + '</th>' +
          '<th scope="col">' + U.esc(t('shop.assignedTo')) + '</th>' +
          '<th scope="col"><span class="sr-only">' + U.esc(t('common.actions')) + '</span></th>' +
          '</tr></thead><tbody>';

        list.forEach(function (x) {
          var done = x.status === 'Bought';
          html += '<tr' + (done ? ' class="is-done"' : '') + '>' +
            '<td>' + UI.checkbox({
              done: done,
              label: done ? t('shop.markToBuy', { name: x.item }) : t('shop.markBought', { name: x.item }),
              attrs: 'data-act="toggle" data-id="' + U.esc(x.id) + '" data-fk="chk_' + U.esc(x.id) + '"'
            }) + '</td>' +
            '<td><div class="t-title">' + U.esc(x.item) + '</div>' +
            (x.notes ? '<div class="t-sub">' + U.esc(x.notes.slice(0, 60)) + '</div>' : '') +
            (x.purchaseDate ? '<div class="t-sub">' + U.esc(t('shop.purchaseDate')) + ' ' +
              U.esc(U.fmtDate(x.purchaseDate, 'medium')) + '</div>' : '') + '</td>' +
            '<td>' + U.esc(x.category) + '</td>' +
            '<td class="num">' + x.quantity + '</td>' +
            '<td class="num">' + U.esc(U.fmtMoney(x.estimatedCost * x.quantity)) + '</td>' +
            '<td>' + UI.chip(x.status, done ? 'emerald' : (x.status === 'Ordered' ? 'gold' : '')) + '</td>' +
            '<td>' + (x.assignee
              ? UI.chip(S.assigneeName(x), W.Cloud.isMe(x.assignee) ? 'emerald' : '')
              : (x.assignedTo ? U.esc(x.assignedTo)
                : '<span class="t-sub">' + U.esc(t('common.na')) + '</span>')) + '</td>' +
            '<td class="actions">' +
            '<button class="icon-btn" data-act="edit" data-id="' + U.esc(x.id) + '">' + U.esc(t('common.edit')) + '</button>' +
            '<button class="icon-btn danger" data-act="delete" data-id="' + U.esc(x.id) + '">' + U.esc(t('common.delete')) + '</button>' +
            '</td></tr>';
        });

        html += '</tbody><tfoot><tr><td colspan="4">' + U.esc(t('common.total')) + '</td>' +
          '<td class="num">' + U.esc(U.fmtMoney(U.sum(list, function (x) {
            return x.estimatedCost * x.quantity;
          }))) + '</td><td colspan="3"></td></tr></tfoot></table></div>' +
          '<p class="section-note">' + U.esc(t('common.showing', { shown: list.length, total: all.length })) + '</p>';
      }
      html += '</div>';

      html += '<div class="section"><div class="card card-chart">' +
        '<div class="card-head"><h3>' + U.esc(t('shop.category')) + '</h3></div>' +
        '<div data-chart-cat style="margin-top:10px"></div></div></div>';

      root.innerHTML = html;

      var byCat = {};
      all.forEach(function (x) {
        byCat[x.category] = (byCat[x.category] || 0) + x.estimatedCost * x.quantity;
      });
      Charts.render(root.querySelector('[data-chart-cat]'), {
        type: 'bars',
        title: t('shop.category'),
        fmt: U.fmtMoney,
        items: Object.keys(byCat).map(function (k) { return { label: k, value: byCat[k] }; })
          .sort(function (a, b) { return b.value - a.value; }),
        emptyText: t('shop.empty')
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
        openForm(S.shopping.get(id));
      } else if (act === 'toggle') {
        toggleBought(id);
      } else if (act === 'filter') {
        filter = btn.getAttribute('data-key');
        W.App.rerender();
      } else if (act === 'clear') {
        filter = 'all'; query = '';
        W.App.rerender();
      } else if (act === 'delete') {
        var x = S.shopping.get(id);
        if (!x) return;
        UI.confirmDelete(x.item, function () {
          S.shopping.remove(id);
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
