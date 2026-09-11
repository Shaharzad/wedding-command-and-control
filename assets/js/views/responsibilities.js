/* Who does what — jobs handed to the family, with their number if we have it. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, M = W.Module, t = W.t;

  W.Views.responsibilities = M.list({
    key: 'resp',
    title: t('resp.title'),
    what: t('resp.what'),
    addLabel: t('resp.add'),
    editLabel: t('resp.edit'),
    headNote: t('resp.note'),
    crud: S.responsibilities,
    nameField: 'person',
    searchFields: ['person', 'area', 'description', 'notes'],
    empty: { title: t('resp.empty'), body: t('resp.emptyBody') },

    defaults: {
      person: '', area: 'Guest welcome', description: '', eventId: '',
      status: 'Assigned', notes: ''
    },

    fields: function () {
      return [
        [
          W.Cloud.isEnabled() && W.Cloud.people().length
            ? { name: 'assignee', label: t('assign.label'), type: 'member' }
            : { name: 'person', label: t('resp.person'), type: 'text', required: true, placeholder: t('ph.hira') },
          { name: 'area', label: t('resp.area'), type: 'select', options: W.OPT.responsibilityArea, required: true }
        ],
        { name: 'description', label: t('resp.description'), type: 'text',
          placeholder: t('ph.meetsGuestsAtTheGateAndPointsThemToTheHall') },
        [
          {
            name: 'eventId', label: t('resp.event'), type: 'select', options: M.eventOptions(),
            allowEmpty: true, emptyLabel: t('vendors.allEvents')
          },
          { name: 'status', label: t('resp.status'), type: 'select', options: W.OPT.responsibilityStatus, required: true }
        ],
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ];
    },

    beforeSubmit: function (vals) {
      if (vals.assignee) {
        var name = W.Cloud.personName(vals.assignee);
        if (name) vals.person = name;
      }
    },

    filters: W.OPT.responsibilityStatus.map(function (st) {
      return { key: st, label: st, test: function (x) { return x.status === st; } };
    }),

    sort: function (a, b) {
      var order = W.OPT.responsibilityStatus;
      var ai = order.indexOf(a.status), bi = order.indexOf(b.status);
      if (ai !== bi) return ai - bi;
      return a.person < b.person ? -1 : 1;
    },

    kpis: function () {
      var st = S.responsibilityStats();
      return [
        { label: t('resp.doneCount'), value: st.done + ' / ' + st.total, accent: 'emerald',
          foot: t('dash.percentComplete', { n: st.percent }) },
        { label: t('resp.person'), value: String(st.people), accent: 'maroon', foot: t('resp.byPerson') },
        { label: W.OPT.responsibilityStatus[0], value: String(st.byStatus.Assigned),
          foot: t('resp.handedOut') },
        { label: W.OPT.responsibilityStatus[1], value: String(st.byStatus.Accepted),
          foot: t('resp.confirmed') }
      ];
    },

    charts: function () {
      var st = S.responsibilityStats();
      return [{
        title: t('resp.byPerson'),
        spec: {
          type: 'bars',
          title: t('resp.byPerson'),
          items: st.byPerson.slice(0, 8),
          emptyText: t('resp.empty')
        }
      }];
    },

    noteHTML: '<div class="card"><div class="card-head"><h3>' + U.esc(t('nav.contacts')) + '</h3></div>' +
      '<p class="card-sub" style="margin-top:8px">' + U.esc(t('resp.note')) + '</p>' +
      '<div style="margin-top:12px"><button class="btn btn-sm" data-act="goto-contacts">' +
      U.esc(t('nav.contacts')) + '</button></div></div>',

    columns: [
      {
        label: t('resp.person'),
        render: function (x) {
          return '<div class="t-title">' +
            (x.assignee && W.Cloud.isMe(x.assignee)
              ? UI.chip(S.assigneeName(x), 'emerald')
              : U.esc(S.assigneeName(x) || x.person)) + '</div>' +
            (x.notes ? '<div class="t-sub">' + U.esc(String(x.notes).slice(0, 70)) + '</div>' : '');
        }
      },
      { label: t('resp.area'), render: M.Cell.plain('area') },
      { label: t('resp.description'), render: M.Cell.plain('description') },
      { label: t('resp.event'), render: M.Cell.event('eventId') },
      {
        label: t('resp.phone'),
        render: function (x) {
          var c = S.contactByName(x.person);
          if (!c || !c.phone) return '<span class="t-sub">' + U.esc(t('contacts.noPhone')) + '</span>';
          return '<a href="tel:' + U.esc(c.phone.replace(/\s+/g, '')) + '">' + U.esc(c.phone) + '</a>';
        }
      },
      { label: t('resp.status'), render: function (x) { return UI.statusChip(x.status); } }
    ],

    onAction: function (act) {
      if (act === 'goto-contacts') window.location.hash = '#/contacts';
    }
  });

})(window.WCC);
