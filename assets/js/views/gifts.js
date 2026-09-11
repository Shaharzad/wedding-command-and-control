/* Gifts and salami — what came in, from whom, and whether the thank-you went out. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, M = W.Module, t = W.t;

  W.Views.gifts = M.list({
    key: 'gift',
    title: t('gift.title'),
    what: t('gift.what'),
    addLabel: t('gift.add'),
    editLabel: t('gift.edit'),
    crud: S.gifts,
    nameField: 'from',
    searchFields: ['from', 'description', 'kind', 'notes'],
    empty: { title: t('gift.empty'), body: t('gift.emptyBody') },

    defaults: {
      guestId: '', from: '', kind: 'Cash (salami)', description: '',
      amount: '', eventId: '', date: '', thankYouSent: false, notes: ''
    },

    fields: function () {
      var guests = S.state.guests.slice()
        .sort(function (a, b) { return a.name < b.name ? -1 : 1; })
        .map(function (g) { return { value: g.id, label: g.name + (g.group ? ' — ' + g.group : '') }; });
      return [
        {
          name: 'guestId', label: t('gift.fromGuest'), type: 'select', options: guests,
          allowEmpty: true, emptyLabel: t('gift.fromOther')
        },
        [
          { name: 'from', label: t('gift.from'), type: 'text', placeholder: t('ph.nadiaAunty'),
            hint: t('gift.fromOther') },
          { name: 'kind', label: t('gift.kind'), type: 'select', options: W.OPT.giftKind, required: true }
        ],
        [
          { name: 'amount', label: t('gift.amount') + ' (PKR)', type: 'number', min: 0, step: 500 },
          { name: 'date', label: t('gift.date'), type: 'date' }
        ],
        { name: 'description', label: t('gift.description'), type: 'text', placeholder: t('ph.dinnerSet') },
        {
          name: 'eventId', label: t('gift.event'), type: 'select', options: M.eventOptions(),
          allowEmpty: true, emptyLabel: t('vendors.allEvents')
        },
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ];
    },

    beforeSubmit: function (vals) {
      vals.amount = U.num(vals.amount);
      /* A picked guest wins; the free-text name is the fallback. */
      if (vals.guestId) {
        var g = S.guests.get(vals.guestId);
        if (g) vals.from = g.name;
      }
      if (!vals.from) vals.from = t('common.na');
    },

    toggle: {
      field: 'thankYouSent',
      label: function (item, done) {
        return t(done ? 'gift.markNotThanked' : 'gift.markThanked', { name: S.giftFrom(item) });
      }
    },

    filters: [
      { key: 'notThanked', label: t('gift.filter.notThanked'), test: function (x) { return !x.thankYouSent; } },
      { key: 'thanked', label: t('gift.filter.thanked'), test: function (x) { return x.thankYouSent; } }
    ].concat(W.OPT.giftKind.map(function (k) {
      return { key: k, label: k, test: function (x) { return x.kind === k; } };
    })),

    sort: function (a, b) {
      if (a.thankYouSent !== b.thankYouSent) return a.thankYouSent ? 1 : -1;
      return (b.date || '') < (a.date || '') ? -1 : 1;
    },

    kpis: function () {
      var st = S.giftStats();
      return [
        { label: t('gift.totalCash'), value: U.fmtMoney(st.cash), money: true, accent: 'maroon',
          foot: t('gift.countGifts') + ': ' + st.total },
        { label: t('gift.thankYouCount'), value: st.thanked + ' / ' + st.total, accent: 'emerald',
          foot: t('dash.percentComplete', { n: st.percent }) },
        { label: t('gift.thankYouLeft'), value: String(st.toThank),
          foot: t('gift.filter.notThanked'), warn: st.toThank > 0 },
        { label: t('gift.kind'), value: String(st.byKind.length), foot: t('gift.byKind') }
      ];
    },

    charts: function () {
      var st = S.giftStats();
      return [{
        title: t('gift.byKind'),
        spec: {
          type: 'bars',
          title: t('gift.byKind'),
          items: st.byKind,
          emptyText: t('gift.empty')
        }
      }];
    },

    columns: [
      {
        label: t('gift.from'),
        render: function (x) {
          return '<div class="t-title">' + U.esc(S.giftFrom(x)) + '</div>' +
            (x.description ? '<div class="t-sub">' + U.esc(x.description) + '</div>' : '');
        }
      },
      { label: t('gift.kind'), render: M.Cell.plain('kind') },
      { label: t('gift.amount'), num: true, render: M.Cell.money('amount') },
      { label: t('gift.event'), render: M.Cell.event('eventId') },
      { label: t('gift.date'), render: M.Cell.date('date') },
      {
        label: t('gift.thankYou'),
        render: function (x) {
          return x.thankYouSent ? UI.chip(t('common.yes'), 'emerald') : UI.chip(t('common.no'), 'gold');
        }
      }
    ],

    footer: function (rows) {
      return '<tfoot><tr><td colspan="3">' + U.esc(t('common.total')) + '</td>' +
        '<td class="num">' + U.esc(U.fmtMoney(U.sum(rows, function (x) { return x.amount; }))) + '</td>' +
        '<td colspan="4"></td></tr></tfoot>';
    }
  });

})(window.WCC);
