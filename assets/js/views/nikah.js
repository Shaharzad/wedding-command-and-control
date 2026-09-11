/* Nikah checklist.

   Deliberately written as prompts to raise with a registrar, never as claims
   about what the law requires. Requirements differ by city, province and
   country and change over time, so the page says so, prominently, always. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, M = W.Module, t = W.t;

  function disclaimerHTML() {
    return '<div class="notice" role="note">' +
      '<h3>' + U.esc(t('nikah.disclaimerTitle')) + '</h3>' +
      '<p>' + U.esc(t('nikah.disclaimer')) + '</p></div>';
  }

  W.Views.nikah = M.list({
    key: 'nikah',
    title: t('nikah.title'),
    what: t('nikah.what'),
    addLabel: t('nikah.add'),
    editLabel: t('nikah.edit'),
    crud: S.nikah,
    nameField: 'item',
    searchFields: ['item', 'owner', 'notes'],
    empty: { title: t('nikah.empty'), body: t('nikah.emptyBody') },

    /* Shown above everything, on the empty state as well as the full list. */
    topHTML: disclaimerHTML,
    formSubtitle: t('nikah.disclaimerTitle'),

    defaults: { item: '', status: 'To Do', owner: '', dueDate: '', notes: '' },

    fields: function () {
      return [
        { name: 'item', label: t('nikah.item'), type: 'text', required: true,
          placeholder: t('ph.askTheRegistrarWhatTheyNeedFromUs') },
        [
          { name: 'status', label: t('nikah.status'), type: 'select', options: W.OPT.nikahStatus, required: true },
          { name: 'owner', label: t('nikah.owner'), type: 'text', placeholder: t('ph.abbu') }
        ],
        { name: 'dueDate', label: t('nikah.due'), type: 'date' },
        { name: 'notes', label: t('common.notes'), type: 'textarea',
          hint: t('nikah.disclaimerTitle') }
      ];
    },

    filters: W.OPT.nikahStatus.map(function (st) {
      return { key: st, label: st, test: function (x) { return x.status === st; } };
    }),

    sort: function (a, b) {
      var order = W.OPT.nikahStatus;
      var ai = order.indexOf(a.status), bi = order.indexOf(b.status);
      if (ai !== bi) return ai - bi;
      return (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1;
    },

    kpis: function () {
      var st = S.nikahStats();
      return [
        { label: t('nikah.doneCount'), value: st.done + ' / ' + st.total, accent: 'emerald',
          foot: t('dash.percentComplete', { n: st.percent }) },
        { label: W.OPT.nikahStatus[0], value: String(st.byStatus['To Do']), foot: t('nikah.notStarted') },
        { label: W.OPT.nikahStatus[1], value: String(st.byStatus['In Progress']), foot: t('nikah.beingChased') },
        { label: t('an.tableTotal'), value: String(st.total), foot: t('nikah.onList') }
      ];
    },

    charts: function () {
      var st = S.nikahStats();
      return [{
        title: t('nikah.byStatus'),
        spec: {
          type: 'bars',
          hue: 'emerald',
          title: t('nikah.byStatus'),
          items: W.OPT.nikahStatus.map(function (k) { return { label: k, value: st.byStatus[k] || 0 }; }),
          emptyText: t('nikah.empty')
        }
      }];
    },

    columns: [
      { label: t('nikah.item'), render: M.Cell.text('item', 'notes') },
      { label: t('nikah.owner'), render: M.Cell.plain('owner') },
      { label: t('nikah.due'), render: M.Cell.date('dueDate') },
      { label: t('nikah.status'), render: function (x) { return UI.statusChip(x.status); } }
    ]
  });

})(window.WCC);
