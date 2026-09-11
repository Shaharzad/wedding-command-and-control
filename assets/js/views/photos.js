/* Photo shot list — the pictures you do not want missed, ticked off on the day. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, M = W.Module, t = W.t;

  W.Views.photos = M.list({
    key: 'photo',
    title: t('photo.title'),
    what: t('photo.what'),
    addLabel: t('photo.add'),
    editLabel: t('photo.edit'),
    headNote: t('photo.note'),
    crud: S.shots,
    nameField: 'description',
    searchFields: ['description', 'category', 'people', 'notes'],
    empty: { title: t('photo.empty'), body: t('photo.emptyBody') },

    defaults: {
      category: 'Family', description: '', people: '', eventId: '',
      mustHave: false, done: false, notes: ''
    },

    fields: function () {
      return [
        [
          { name: 'description', label: t('photo.description'), type: 'text', required: true, placeholder: t('ph.brideWithHerGrandmother') },
          { name: 'category', label: t('photo.category'), type: 'select', options: W.OPT.shotCategory, required: true }
        ],
        [
          { name: 'people', label: t('photo.people'), type: 'text', placeholder: t('ph.sarahRukhsanaBegum') },
          {
            name: 'eventId', label: t('ward.event'), type: 'select', options: M.eventOptions(),
            allowEmpty: true, emptyLabel: t('vendors.allEvents')
          }
        ],
        {
          name: 'mustHave', label: t('photo.mustHave'), type: 'select',
          options: [{ value: 'yes', label: t('common.yes') }, { value: 'no', label: t('common.no') }]
        },
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ];
    },

    toForm: function (vals) { vals.mustHave = vals.mustHave ? 'yes' : 'no'; },

    beforeSubmit: function (vals) {
      vals.mustHave = vals.mustHave === 'yes' || vals.mustHave === true;
    },

    toggle: {
      field: 'done',
      label: function (item, done) {
        return t(done ? 'photo.markNotDone' : 'photo.markDone', { name: item.description });
      }
    },

    filters: [
      { key: 'must', label: t('photo.filter.must'), test: function (x) { return x.mustHave; } },
      { key: 'left', label: t('photo.filter.left'), test: function (x) { return !x.done; } }
    ].concat(W.OPT.shotCategory.map(function (c) {
      return { key: c, label: c, test: function (x) { return x.category === c; } };
    })),

    sort: function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.mustHave !== b.mustHave) return a.mustHave ? -1 : 1;
      return a.category < b.category ? -1 : 1;
    },

    kpis: function () {
      var st = S.shotStats();
      return [
        { label: t('photo.doneCount'), value: st.done + ' / ' + st.total, accent: 'emerald',
          foot: t('dash.percentComplete', { n: st.percent }) },
        { label: t('photo.mustCount'), value: st.mustDone + ' / ' + st.must, accent: 'maroon',
          foot: t('photo.filter.must') },
        { label: t('photo.filter.left'), value: String(st.left), foot: t('photo.stillToGet') },
        { label: t('photo.category'), value: String(st.byCategory.length), foot: t('photo.byCategory') }
      ];
    },

    charts: function () {
      var st = S.shotStats();
      return [{
        title: t('photo.byCategory'),
        spec: {
          type: 'bars',
          title: t('photo.byCategory'),
          items: st.byCategory,
          emptyText: t('photo.empty')
        }
      }];
    },

    noteHTML: '<div class="card"><div class="card-head"><h3>' + U.esc(t('nav.vendors')) + '</h3></div>' +
      '<p class="card-sub" style="margin-top:8px">' + U.esc(t('photo.note')) + '</p>' +
      '<div style="margin-top:12px"><button class="btn btn-sm" data-act="goto-vendors">' +
      U.esc(t('nav.vendors')) + '</button></div></div>',

    columns: [
      { label: t('photo.description'), render: M.Cell.text('description', 'notes') },
      { label: t('photo.category'), render: M.Cell.plain('category') },
      { label: t('photo.people'), render: M.Cell.plain('people') },
      { label: t('ward.event'), render: M.Cell.event('eventId') },
      {
        label: t('photo.mustHave'),
        render: function (x) {
          return x.mustHave ? UI.chip(t('photo.mustHave'), 'maroon')
            : '<span class="t-sub">' + U.esc(t('common.na')) + '</span>';
        }
      }
    ],

    onAction: function (act) {
      if (act === 'goto-vendors') window.location.hash = '#/vendors';
    }
  });

})(window.WCC);
