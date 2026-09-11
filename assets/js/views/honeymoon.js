/* Honeymoon — the trip itself, kept separate from the wedding budget. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, M = W.Module, t = W.t;

  function openTripForm() {
    var h = S.state.honeymoon;
    UI.form({
      title: t('hm.trip'),
      subtitle: t('hm.tripSub'),
      values: {
        destination: h.destination, startDate: h.startDate, endDate: h.endDate,
        budget: h.budget || '', notes: h.notes
      },
      submitLabel: t('common.saveChanges'),
      fields: [
        { name: 'destination', label: t('hm.destination'), type: 'text', placeholder: t('ph.hunzaAndSkardu') },
        [
          { name: 'startDate', label: t('hm.start'), type: 'date' },
          { name: 'endDate', label: t('hm.end'), type: 'date' }
        ],
        { name: 'budget', label: t('hm.budget') + ' (PKR)', type: 'number', min: 0, step: 5000 },
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ],
      onSubmit: function (vals) {
        S.saveHoneymoon(vals);
        UI.toast(t('hm.tripSaved'), 'good');
        return true;
      }
    });
  }

  function tripHTML() {
    var h = S.state.honeymoon;
    var st = S.honeymoonStats();
    var wedding = S.state.settings.weddingDate;
    var after = (wedding && h.startDate) ? U.daysBetween(wedding, h.startDate) : null;

    var rows = '';
    function row(label, value) {
      rows += '<dt>' + U.esc(label) + '</dt><dd>' + (value ||
        '<span class="t-sub">' + U.esc(t('common.na')) + '</span>') + '</dd>';
    }
    row(t('hm.destination'), h.destination ? U.esc(h.destination) : '');
    row(t('hm.start'), h.startDate ? U.esc(U.fmtDate(h.startDate)) : '');
    row(t('hm.end'), h.endDate ? U.esc(U.fmtDate(h.endDate)) : '');
    row(t('hm.budget'), h.budget ? U.esc(U.fmtMoney(h.budget)) : '');
    if (st.nights) row(t('hm.nightsLabel'), U.esc(String(st.nights)));
    if (after !== null && after >= 0) row(t('hm.afterWedding'), U.esc(String(after)));

    return '<div class="card" style="margin-bottom:16px"><div class="card-head"><h3>' +
      U.esc(t('hm.trip')) + '</h3></div>' +
      '<p class="card-sub">' + U.esc(h.notes || t('hm.note')) + '</p>' +
      '<div class="event-body" style="padding:12px 0 0"><dl>' + rows + '</dl></div></div>';
  }

  W.Views.honeymoon = M.list({
    key: 'hm',
    title: t('hm.title'),
    what: t('hm.what'),
    addLabel: t('hm.add'),
    editLabel: t('hm.edit'),
    crud: S.honeymoonItems,
    nameField: 'title',
    searchFields: ['title', 'type', 'reference', 'notes'],
    empty: { title: t('hm.empty'), body: t('hm.emptyBody') },

    extraButtons: '<button class="btn" data-act="edit-trip">' + W.Util.esc(W.t('hm.editTrip')) + '</button>',
    topHTML: tripHTML,

    defaults: {
      type: 'Flight', title: '', date: '', cost: '', status: 'To Book', reference: '', notes: ''
    },

    fields: function () {
      return [
        [
          { name: 'title', label: t('hm.itemTitle'), type: 'text', required: true, placeholder: t('ph.flightsToGilgit') },
          { name: 'type', label: t('hm.type'), type: 'select', options: W.OPT.honeymoonType, required: true }
        ],
        [
          { name: 'date', label: t('hm.date'), type: 'date' },
          { name: 'cost', label: t('hm.cost') + ' (PKR)', type: 'number', min: 0, step: 1000 }
        ],
        [
          { name: 'status', label: t('hm.status'), type: 'select', options: W.OPT.honeymoonStatus, required: true },
          { name: 'reference', label: t('hm.reference'), type: 'text', placeholder: t('ph.pk8842') }
        ],
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ];
    },

    beforeSubmit: function (vals) { vals.cost = U.num(vals.cost); },

    filters: W.OPT.honeymoonStatus.map(function (st) {
      return { key: st, label: st, test: function (x) { return x.status === st; } };
    }),

    sort: function (a, b) {
      return (a.date || '9999') < (b.date || '9999') ? -1 : 1;
    },

    kpis: function () {
      var st = S.honeymoonStats();
      return [
        { label: t('hm.spent'), value: U.fmtMoney(st.cost), money: true, accent: 'maroon',
          foot: st.booked + ' / ' + st.total },
        { label: t('hm.leftToBook'), value: U.fmtMoney(st.left), money: true, accent: 'emerald',
          foot: st.budget ? t('budget.percentOfPlanned', { n: U.pct(st.cost, st.budget) }) : t('hm.budget'),
          warn: st.budget > 0 && st.left < 0 },
        { label: t('hm.nightsLabel'), value: st.nights ? String(st.nights) : t('common.na'),
          foot: st.nights ? t('hm.nights', { n: st.nights }) : t('hm.noDates') },
        { label: t('an.tableTotal'), value: String(st.total), foot: t('hm.what') }
      ];
    },

    charts: function () {
      var st = S.honeymoonStats();
      return [{
        title: t('hm.byType'),
        spec: {
          type: 'bars',
          title: t('hm.byType'),
          fmt: U.fmtMoney,
          items: st.byType,
          emptyText: t('hm.empty')
        }
      }];
    },

    noteHTML: '<div class="card"><div class="card-head"><h3>' + U.esc(W.t('nav.budget')) + '</h3></div>' +
      '<p class="card-sub" style="margin-top:8px">' + U.esc(W.t('hm.note')) + '</p></div>',

    columns: [
      { label: t('hm.itemTitle'), render: M.Cell.text('title', 'notes') },
      { label: t('hm.type'), render: M.Cell.plain('type') },
      { label: t('hm.date'), render: M.Cell.date('date') },
      { label: t('hm.reference'), render: M.Cell.plain('reference') },
      { label: t('hm.cost'), num: true, render: M.Cell.money('cost') },
      { label: t('hm.status'), render: function (x) { return UI.statusChip(x.status); } }
    ],

    footer: function (rows) {
      return '<tfoot><tr><td colspan="4">' + U.esc(t('common.total')) + '</td>' +
        '<td class="num">' + U.esc(U.fmtMoney(U.sum(rows, function (x) { return x.cost; }))) + '</td>' +
        '<td colspan="2"></td></tr></tfoot>';
    },

    onAction: function (act) {
      if (act === 'edit-trip') openTripForm();
    }
  });

  W.Views.honeymoon.openTripForm = openTripForm;

})(window.WCC);
