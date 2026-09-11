/* Vendors.
   A vendor never stores what it has been paid. Each one links to a single
   budget line, and every payment is written into that line — so there is one
   ledger, not two. Paid and remaining on this page are derived from it. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, Charts = W.Charts, t = W.t;

  var NEW_LINE = '__new__';
  var filter = 'all';
  var query = '';

  var FILTERS = [
    { key: 'all', label: 'vendors.filter.all' },
    { key: 'Researching', label: 'vendors.filter.researching' },
    { key: 'Contacted', label: 'vendors.filter.contacted' },
    { key: 'Quoted', label: 'vendors.filter.quoted' },
    { key: 'Booked', label: 'vendors.filter.booked' },
    { key: 'unlinked', label: 'vendors.filter.unlinked' }
  ];

  function matchesFilter(v, key) {
    if (key === 'all') return true;
    if (key === 'unlinked') return !v.budgetLineId;
    return v.status === key;
  }

  function matchesQuery(v, q) {
    if (!q) return true;
    return (v.name + ' ' + v.category + ' ' + v.contactName + ' ' + v.phone + ' ' +
      v.email + ' ' + v.website + ' ' + v.notes).toLowerCase().indexOf(q) >= 0;
  }

  function visible() {
    var q = query.trim().toLowerCase();
    var order = W.OPT.vendorStatus;
    return S.state.vendors.filter(function (v) {
      return matchesFilter(v, filter) && matchesQuery(v, q);
    }).sort(function (a, b) {
      var ai = order.indexOf(a.status), bi = order.indexOf(b.status);
      if (ai !== bi) return bi - ai;
      return a.name < b.name ? -1 : 1;
    });
  }

  function lineOptions() {
    return S.state.budget.map(function (b) {
      return {
        value: b.id,
        label: b.category + ' — ' + U.fmtMoneyShort(b.planned) +
          (b.vendor ? ' (' + b.vendor + ')' : '')
      };
    }).concat([{ value: NEW_LINE, label: t('vendors.budgetNew') }]);
  }

  /* --------------------------------------------------------------- form -- */

  function openForm(vendor) {
    var editing = !!vendor;
    var events = S.eventsSorted().map(function (e) {
      return { value: e.id, label: e.name + (e.date ? ' — ' + U.fmtDate(e.date, 'short') : '') };
    });
    var values = vendor ? U.clone(vendor) : {
      name: '', category: 'Venue', contactName: '', phone: '', email: '', website: '',
      quotedPrice: '', finalPrice: '', status: 'Researching', eventId: '',
      budgetLineId: '', notes: ''
    };

    UI.form({
      title: editing ? t('vendors.edit') : t('vendors.add'),
      values: values,
      submitLabel: editing ? t('common.saveChanges') : t('common.add'),
      fields: [
        [
          { name: 'name', label: t('vendors.name'), type: 'text', required: true, placeholder: t('ph.gulzarDecorators') },
          { name: 'category', label: t('vendors.category'), type: 'select', options: W.OPT.budgetCategory, required: true }
        ],
        [
          { name: 'contactName', label: t('vendors.contactName'), type: 'text' },
          { name: 'phone', label: t('vendors.phone'), type: 'tel', placeholder: t('ph.eg03001234567') }
        ],
        [
          { name: 'email', label: t('vendors.email'), type: 'email' },
          { name: 'website', label: t('vendors.website'), type: 'text', placeholder: t('ph.gulzardecor') }
        ],
        [
          { name: 'quotedPrice', label: t('vendors.quoted') + ' (PKR)', type: 'number', min: 0, step: 1000 },
          { name: 'finalPrice', label: t('vendors.final') + ' (PKR)', type: 'number', min: 0, step: 1000 }
        ],
        [
          { name: 'status', label: t('vendors.status'), type: 'select', options: W.OPT.vendorStatus, required: true },
          {
            name: 'eventId', label: t('vendors.event'), type: 'select', options: events,
            allowEmpty: true, emptyLabel: t('vendors.allEvents')
          }
        ],
        {
          name: 'budgetLineId', label: t('vendors.budgetLine'), type: 'select',
          options: lineOptions(), allowEmpty: true, emptyLabel: t('vendors.budgetNone'),
          hint: t('vendors.budgetLineHint')
        },
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ],
      onSubmit: function (vals) {
        var choice = vals.budgetLineId;
        vals.quotedPrice = U.num(vals.quotedPrice);
        vals.finalPrice = U.num(vals.finalPrice);
        vals.budgetLineId = (choice === NEW_LINE) ? '' : choice;

        var saved = editing ? S.vendors.update(vendor.id, vals) : S.vendors.add(vals);
        if (!saved) return true;

        if (choice === NEW_LINE) {
          var line = S.createBudgetLineForVendor(saved);
          S.linkVendorToLine(saved.id, line.id);
        } else if (choice) {
          S.linkVendorToLine(saved.id, choice);
        }
        UI.toast(t(editing ? 'common.updated' : 'common.added', { name: saved.name }), 'good');
        return true;
      }
    });
  }

  function openPayment(vendor) {
    var line = S.vendorLine(vendor);
    if (!line) {
      UI.confirm({
        title: t('vendors.linkNeeded'),
        body: t('vendors.linkNeededBody', { name: vendor.name }),
        confirmLabel: t('common.edit'),
        onConfirm: function () { openForm(vendor); }
      });
      return;
    }

    UI.form({
      title: t('vendors.paymentTitle', { name: vendor.name }),
      subtitle: t('vendors.paymentSub', { category: line.category }),
      values: { amount: '', date: U.todayISO() },
      submitLabel: t('vendors.recordPayment'),
      noteHTML: '<p class="inline-note" style="margin-bottom:14px">' +
        U.esc(t('vendors.paidSoFar', {
          paid: U.fmtMoney(S.vendorPaid(vendor)),
          remaining: U.fmtMoney(S.vendorRemaining(vendor))
        })) + '</p>',
      fields: [
        {
          name: 'amount', label: t('vendors.paymentAmount') + ' (PKR)', type: 'number',
          min: 1, step: 1000, required: true
        },
        { name: 'date', label: t('vendors.paymentDate'), type: 'date' }
      ],
      onSubmit: function (vals) {
        S.recordVendorPayment(vendor.id, U.num(vals.amount), vals.date);
        UI.toast(t('vendors.paymentSaved', {
          amount: U.fmtMoney(U.num(vals.amount)), category: line.category
        }), 'good');
        return true;
      }
    });
  }

  /* --------------------------------------------------------------- view -- */

  W.Views.vendors = {
    title: t('vendors.title'),
    openForm: openForm,

    render: function (root) {
      var all = S.state.vendors;
      var stats = S.vendorStats();
      var list = visible();

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('vendors.title')) + '</h2>' +
        '<button class="btn btn-primary" data-act="add">' + U.esc(t('vendors.add')) + '</button>' +
        '</div>';

      if (!all.length) {
        html += UI.emptyHTML({
          title: t('vendors.empty'),
          body: t('vendors.emptyBody'),
          actionLabel: t('vendors.add'),
          actionAttr: 'data-act="add"'
        });
        html += '</div>';
        root.innerHTML = html;
        wire(root);
        return;
      }

      html += '<div class="grid grid-kpi">' +
        '<div class="kpi accent-maroon"><p class="kpi-label">' + U.esc(t('vendors.totalAgreed')) +
        '</p><p class="kpi-value money">' + U.esc(U.fmtMoney(stats.agreed)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('vendors.ofTotal', { n: stats.total })) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('vendors.totalPaid')) +
        '</p><p class="kpi-value money">' + U.esc(U.fmtMoney(stats.paid)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('budget.percentOfPlanned', { n: U.pct(stats.paid, stats.agreed) })) +
        '</p></div>' +

        '<div class="kpi accent-emerald"><p class="kpi-label">' + U.esc(t('vendors.totalRemaining')) +
        '</p><p class="kpi-value money">' + U.esc(U.fmtMoney(stats.remaining)) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('budget.acrossUnpaid')) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('vendors.bookedCount')) +
        '</p><p class="kpi-value">' + stats.booked + ' / ' + stats.live + '</p>' +
        (stats.unlinked
          ? '<p class="kpi-foot warn">' + stats.unlinked + ' ' + U.esc(t('vendors.notLinked').toLowerCase()) + '</p>'
          : '<p class="kpi-foot">' + U.esc(t('budget.withinBudget')) + '</p>') + '</div>' +
        '</div></div>';

      html += '<div class="section"><div class="grid grid-2">' +
        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('an.funnel')) + '</h3></div>' +
        '<p class="card-sub">' + U.esc(t('an.funnelSub')) + '</p>' +
        '<div data-chart-funnel style="margin-top:10px"></div></div>' +
        '<div class="card"><div class="card-head"><h3>' + U.esc(t('nav.budget')) + '</h3></div>' +
        '<p class="card-sub" style="margin-top:8px">' + U.esc(t('vendors.ledgerNote')) + '</p>' +
        '<div style="margin-top:12px"><button class="btn btn-sm" data-act="goto-budget">' +
        U.esc(t('nav.budget')) + '</button></div></div>' +
        '</div></div>';

      html += '<div class="section"><div class="filters">';
      FILTERS.forEach(function (f) {
        var n = all.filter(function (x) { return matchesFilter(x, f.key); }).length;
        html += '<button class="filter-btn" data-act="filter" data-key="' + f.key + '" aria-pressed="' +
          (filter === f.key ? 'true' : 'false') + '">' + U.esc(t(f.label)) +
          ' <span class="filter-count">' + n + '</span></button>';
      });
      html += '<span class="spacer"></span><span class="search-wrap">' +
        '<label class="sr-only" for="vendorSearch">' + U.esc(t('vendors.searchPh')) + '</label>' +
        '<input class="search-input" id="vendorSearch" type="text" data-act="search" data-fk="vendorSearch" ' +
        'placeholder="' + U.esc(t('vendors.searchPh')) + '" value="' + U.esc(query) + '"></span></div>';

      if (!list.length) {
        html += UI.emptyHTML({
          title: t('common.noMatches'),
          body: t('common.noMatchesHint'),
          actionLabel: t('common.clearFilters'),
          actionAttr: 'data-act="clear"'
        });
      } else {
        html += '<div class="table-wrap"><table><caption class="sr-only">' + U.esc(t('vendors.title')) +
          '</caption><thead><tr>' +
          '<th scope="col">' + U.esc(t('vendors.name')) + '</th>' +
          '<th scope="col">' + U.esc(t('vendors.phone')) + '</th>' +
          '<th scope="col">' + U.esc(t('vendors.status')) + '</th>' +
          '<th scope="col" class="num">' + U.esc(t('vendors.final')) + '</th>' +
          '<th scope="col" class="num">' + U.esc(t('vendors.paid')) + '</th>' +
          '<th scope="col" class="num">' + U.esc(t('vendors.remaining')) + '</th>' +
          '<th scope="col">' + U.esc(t('vendors.budgetLine')) + '</th>' +
          '<th scope="col"><span class="sr-only">' + U.esc(t('common.actions')) + '</span></th>' +
          '</tr></thead><tbody>';

        list.forEach(function (v) {
          var line = S.vendorLine(v);
          var event = v.eventId ? S.eventName(v.eventId) : '';
          var agreed = S.vendorAgreed(v);
          var paid = S.vendorPaid(v);
          var overpaid = agreed > 0 && paid > agreed;
          html += '<tr>' +
            '<td><div class="t-title">' + U.esc(v.name) + '</div>' +
            '<div class="t-sub">' + U.esc(v.category) +
            (v.contactName ? ' — ' + U.esc(v.contactName) : '') + '</div>' +
            (event ? '<div class="t-sub">' + U.esc(event) + '</div>' : '') + '</td>' +
            '<td>' + (v.phone
              ? '<a href="tel:' + U.esc(v.phone.replace(/\s+/g, '')) + '">' + U.esc(v.phone) + '</a>'
              : '<span class="t-sub">' + U.esc(t('common.na')) + '</span>') + '</td>' +
            '<td>' + UI.statusChip(v.status) + '</td>' +
            '<td class="num">' + U.esc(U.fmtMoney(agreed)) + '</td>' +
            '<td class="num' + (overpaid ? ' t-over' : '') + '">' + U.esc(U.fmtMoney(paid)) +
            (overpaid ? '<div class="t-sub t-over">⚠ ' + U.esc(t('vendors.overpaid')) + '</div>' : '') +
            '</td>' +
            '<td class="num">' + U.esc(U.fmtMoney(S.vendorRemaining(v))) + '</td>' +
            '<td>' + (line
              ? '<span class="chip chip-emerald">' + U.esc(line.category) + '</span>'
              : '<span class="chip chip-gold">' + U.esc(t('vendors.notLinked')) + '</span>') + '</td>' +
            '<td class="actions">' +
            W.Comments.button('vendors', v.id, v.name) +
            '<button class="icon-btn" data-act="pay" data-id="' + U.esc(v.id) + '">' +
            U.esc(t('vendors.recordPayment')) + '</button>' +
            '<button class="icon-btn" data-act="edit" data-id="' + U.esc(v.id) + '">' + U.esc(t('common.edit')) + '</button>' +
            '<button class="icon-btn danger" data-act="delete" data-id="' + U.esc(v.id) + '">' + U.esc(t('common.delete')) + '</button>' +
            '</td></tr>';
        });

        html += '</tbody></table></div>' +
          '<p class="section-note">' + U.esc(t('common.showing', { shown: list.length, total: all.length })) + '</p>';
      }
      html += '</div>';

      root.innerHTML = html;

      Charts.render(root.querySelector('[data-chart-funnel]'), {
        type: 'bars',
        title: t('an.funnel'),
        items: S.vendorFunnel(),
        emptyText: t('an.noVendors')
      });

      wire(root);
      W.Comments.wire(root, function (c, id) {
        var v = S.vendors.get(id);
        return v ? v.name : '';
      });
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
        openForm(S.vendors.get(id));
      } else if (act === 'pay') {
        openPayment(S.vendors.get(id));
      } else if (act === 'goto-budget') {
        window.location.hash = '#/budget';
      } else if (act === 'filter') {
        filter = btn.getAttribute('data-key');
        W.App.rerender();
      } else if (act === 'clear') {
        filter = 'all'; query = '';
        W.App.rerender();
      } else if (act === 'delete') {
        var v = S.vendors.get(id);
        if (!v) return;
        UI.confirmDelete(v.name, function () {
          S.vendors.remove(id);
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
