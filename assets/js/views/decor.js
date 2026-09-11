/* Decor and theme notes — what each area should look like, and who is doing it. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, M = W.Module, t = W.t;

  function countAreas() {
    var seen = {}, n = 0;
    S.state.decor.forEach(function (d) {
      if (!seen[d.area]) { seen[d.area] = true; n += 1; }
    });
    return n;
  }

  W.Views.decor = M.list({
    key: 'decor',
    title: t('decor.title'),
    what: t('decor.what'),
    addLabel: t('decor.add'),
    editLabel: t('decor.edit'),
    crud: S.decor,
    nameField: 'description',
    searchFields: ['description', 'area', 'palette', 'supplier', 'notes'],
    empty: { title: t('decor.empty'), body: t('decor.emptyBody') },

    defaults: {
      area: 'Stage', eventId: '', description: '', palette: '',
      status: 'Idea', supplier: '', estimatedCost: '', notes: ''
    },

    fields: function () {
      return [
        [
          { name: 'description', label: t('decor.description'), type: 'text', required: true, placeholder: t('ph.marigoldArchOverTheStage') },
          { name: 'area', label: t('decor.area'), type: 'select', options: W.OPT.decorArea, required: true }
        ],
        [
          { name: 'palette', label: t('decor.palette'), type: 'text', placeholder: t('ph.marigoldIvoryMirrorWork') },
          {
            name: 'eventId', label: t('ward.event'), type: 'select', options: M.eventOptions(),
            allowEmpty: true, emptyLabel: t('vendors.allEvents')
          }
        ],
        [
          { name: 'status', label: t('decor.status'), type: 'select', options: W.OPT.decorStatus, required: true },
          { name: 'supplier', label: t('decor.supplier'), type: 'text', placeholder: t('ph.gulzarDecorators') }
        ],
        { name: 'estimatedCost', label: t('decor.cost') + ' (PKR)', type: 'number', min: 0, step: 1000 },
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ];
    },

    beforeSubmit: function (vals) { vals.estimatedCost = U.num(vals.estimatedCost); },

    filters: W.OPT.decorStatus.map(function (st) {
      return { key: st, label: st, test: function (x) { return x.status === st; } };
    }),

    sort: function (a, b) {
      var order = W.OPT.decorStatus;
      var ai = order.indexOf(a.status), bi = order.indexOf(b.status);
      if (ai !== bi) return ai - bi;
      return a.area < b.area ? -1 : 1;
    },

    kpis: function () {
      var st = S.decorStats();
      return [
        { label: t('decor.doneCount'), value: st.done + ' / ' + st.total, accent: 'emerald',
          foot: t('dash.percentComplete', { n: st.percent }) },
        { label: t('decor.cost'), value: U.fmtMoney(st.cost), money: true, accent: 'maroon',
          foot: t('decor.note') },
        { label: t('decor.status'), value: st.byStatus.Idea + ' / ' + st.byStatus.Agreed,
          foot: W.OPT.decorStatus.slice(0, 2).join(' / ') },
        { label: t('decor.area'), value: String(countAreas()), foot: t('decor.areasUsed') }
      ];
    },

    charts: function () {
      var st = S.decorStats();
      return [{
        title: t('decor.byStatus'),
        spec: {
          type: 'bars',
          hue: 'emerald',
          title: t('decor.byStatus'),
          items: W.OPT.decorStatus.map(function (k) { return { label: k, value: st.byStatus[k] || 0 }; }),
          emptyText: t('decor.empty')
        }
      }];
    },

    noteHTML: function () {
      return UI.reconcileCard({
        tracked: S.decorStats().cost,
        categories: ['Decor & Flowers', 'Stage & Lighting']
      });
    },

    columns: [
      { label: t('decor.description'), render: M.Cell.text('description', 'notes') },
      { label: t('decor.area'), render: M.Cell.plain('area') },
      { label: t('ward.event'), render: M.Cell.event('eventId') },
      { label: t('decor.palette'), render: M.Cell.plain('palette') },
      { label: t('decor.supplier'), render: M.Cell.plain('supplier') },
      { label: t('decor.cost'), num: true, render: M.Cell.money('estimatedCost') },
      { label: t('decor.status'), render: function (x) { return UI.statusChip(x.status); } }
    ],

    onAction: function (act) {
      if (act === 'goto-budget') window.location.hash = '#/budget';
    }
  });

})(window.WCC);
