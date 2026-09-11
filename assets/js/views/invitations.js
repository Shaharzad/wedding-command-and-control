/* Invitations — a working view over the guest list, not a second copy of it.
   Changing a status here changes the guest record, and nothing else. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, Charts = W.Charts, t = W.t;

  var filter = 'all';
  var query = '';

  var FILTERS = [{ key: 'all', label: t('inv.filter.all') }].concat(
    W.OPT.invitation.map(function (k) { return { key: k, label: k }; })
  );

  function matchesFilter(g, key) {
    return key === 'all' ? true : g.invitation === key;
  }

  function matchesQuery(g, q) {
    if (!q) return true;
    return (g.name + ' ' + g.group + ' ' + g.phone).toLowerCase().indexOf(q) >= 0;
  }

  function visible() {
    var q = query.trim().toLowerCase();
    var order = W.OPT.invitation;
    return S.state.guests.filter(function (g) {
      return matchesFilter(g, filter) && matchesQuery(g, q);
    }).sort(function (a, b) {
      var ai = order.indexOf(a.invitation), bi = order.indexOf(b.invitation);
      if (ai !== bi) return ai - bi;
      return a.name < b.name ? -1 : 1;
    });
  }

  function nextStatus(current) {
    var i = W.OPT.invitation.indexOf(current);
    if (i < 0 || i >= W.OPT.invitation.length - 1) return null;
    return W.OPT.invitation[i + 1];
  }

  function advance(id) {
    var g = S.guests.get(id);
    if (!g) return;
    var next = nextStatus(g.invitation);
    if (!next) return;
    var patch = { invitation: next };
    /* The first move out of "Not Sent" is when it actually went out. */
    if (g.invitation === 'Not Sent' && !g.invitationDate) patch.invitationDate = U.todayISO();
    S.guests.update(id, patch);
    UI.toast(t('inv.advance', { name: g.name, status: next }), 'good');
  }

  W.Views.invitations = {
    title: t('inv.title'),

    render: function (root) {
      var all = S.state.guests;
      var stats = S.invitationStats();
      var list = visible();

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('inv.title')) + '</h2>' +
        '<p class="section-note">' + U.esc(t('inv.sub')) + '<br>' + U.esc(t('inv.note')) + '</p>' +
        '<button class="btn btn-primary" data-act="add-guest">' + U.esc(t('inv.addGuest')) + '</button>' +
        '</div>';

      if (!all.length) {
        html += UI.emptyHTML({
          title: t('inv.empty'),
          body: t('inv.emptyBody'),
          actionLabel: t('inv.addGuest'),
          actionAttr: 'data-act="add-guest"'
        });
        html += '</div>';
        root.innerHTML = html;
        wire(root);
        return;
      }

      html += '<div class="grid grid-kpi">' +
        '<div class="kpi accent-maroon"><p class="kpi-label">' + U.esc(t('inv.progress')) +
        '</p><p class="kpi-value">' + stats.sent + ' / ' + stats.total + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('dash.percentComplete', { n: stats.percent })) + '</p></div>' +

        '<div class="kpi accent-emerald"><p class="kpi-label">' + U.esc(t('inv.confirmed')) +
        '</p><p class="kpi-value">' + stats.confirmed + '</p>' +
        '<p class="kpi-foot">' + U.esc(W.OPT.invitation[3]) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('inv.notSent')) +
        '</p><p class="kpi-value">' + stats.notSent + '</p>' +
        '<p class="kpi-foot' + (stats.notSent ? ' warn' : '') + '">' + U.esc(W.OPT.invitation[0]) + '</p></div>' +

        '<div class="kpi"><p class="kpi-label">' + U.esc(t('guests.totalHeads')) +
        '</p><p class="kpi-value">' + U.fmtNumber(stats.heads) + '</p>' +
        '<p class="kpi-foot">' + U.esc(t('inv.headsInvited', { n: U.fmtNumber(stats.heads) })) + '</p></div>' +
        '</div></div>';

      html += '<div class="section"><div class="grid grid-2">' +
        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('inv.progress')) + '</h3></div>' +
        '<div data-chart-ring></div>' +
        '<p class="card-sub" style="text-align:center">' +
        U.esc(t('inv.progressSub', { sent: stats.sent, total: stats.total })) + '</p></div>' +
        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('inv.byStatus')) + '</h3></div>' +
        '<div data-chart-bars style="margin-top:10px"></div></div>' +
        '</div></div>';

      html += '<div class="section"><div class="filters">';
      FILTERS.forEach(function (f) {
        var n = all.filter(function (x) { return matchesFilter(x, f.key); }).length;
        html += '<button class="filter-btn" data-act="filter" data-key="' + U.esc(f.key) + '" aria-pressed="' +
          (filter === f.key ? 'true' : 'false') + '">' + U.esc(f.label) +
          ' <span class="filter-count">' + n + '</span></button>';
      });
      html += '<span class="spacer"></span><span class="search-wrap">' +
        '<label class="sr-only" for="invSearch">' + U.esc(t('inv.searchPh')) + '</label>' +
        '<input class="search-input" id="invSearch" type="text" data-act="search" data-fk="invSearch" ' +
        'placeholder="' + U.esc(t('inv.searchPh')) + '" value="' + U.esc(query) + '"></span></div>';

      if (!list.length) {
        html += UI.emptyHTML({
          title: t('common.noMatches'),
          body: t('common.noMatchesHint'),
          actionLabel: t('common.clearFilters'),
          actionAttr: 'data-act="clear"'
        });
      } else {
        html += '<div class="table-wrap"><table><caption class="sr-only">' + U.esc(t('inv.title')) +
          '</caption><thead><tr>' +
          '<th scope="col">' + U.esc(t('guests.name')) + '</th>' +
          '<th scope="col">' + U.esc(t('guests.side')) + '</th>' +
          '<th scope="col" class="num">' + U.esc(t('guests.headcount')) + '</th>' +
          '<th scope="col">' + U.esc(t('inv.status')) + '</th>' +
          '<th scope="col">' + U.esc(t('inv.sentDate')) + '</th>' +
          '<th scope="col">' + U.esc(t('guests.rsvp')) + '</th>' +
          '<th scope="col"><span class="sr-only">' + U.esc(t('common.actions')) + '</span></th>' +
          '</tr></thead><tbody>';

        list.forEach(function (g) {
          var next = nextStatus(g.invitation);
          html += '<tr>' +
            '<td><div class="t-title">' + U.esc(g.name) + '</div>' +
            (g.group ? '<div class="t-sub">' + U.esc(g.group) + '</div>' : '') + '</td>' +
            '<td>' + U.esc(g.side) + '</td>' +
            '<td class="num">' + (g.adults + g.children) + '</td>' +
            '<td>' + UI.statusChip(g.invitation) + '</td>' +
            '<td>' + (g.invitationDate ? U.esc(U.fmtDate(g.invitationDate, 'medium'))
              : '<span class="t-sub">' + U.esc(t('common.na')) + '</span>') + '</td>' +
            '<td>' + UI.statusChip(g.rsvp) + '</td>' +
            '<td class="actions">' +
            (next
              ? '<button class="icon-btn" data-act="advance" data-id="' + U.esc(g.id) + '" aria-label="' +
                U.esc(t('inv.advance', { name: g.name, status: next })) + '">' +
                U.esc(t('inv.moveTo', { status: next })) + '</button>'
              : '') +
            '<button class="icon-btn" data-act="edit" data-id="' + U.esc(g.id) + '">' +
            U.esc(t('common.edit')) + '</button>' +
            '</td></tr>';
        });

        html += '</tbody></table></div>' +
          '<p class="section-note">' + U.esc(t('common.showing', { shown: list.length, total: all.length })) + '</p>';
      }
      html += '</div>';

      root.innerHTML = html;

      Charts.render(root.querySelector('[data-chart-ring]'), {
        type: 'ring',
        title: t('inv.progress'),
        percent: stats.percent,
        centreLabel: t('inv.status').toLowerCase()
      });

      Charts.render(root.querySelector('[data-chart-bars]'), {
        type: 'bars',
        title: t('inv.byStatus'),
        hue: 'emerald',
        items: W.OPT.invitation.map(function (k) {
          return { label: k, value: stats.byStatus[k] || 0 };
        }),
        emptyText: t('inv.empty')
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

      if (act === 'add-guest') {
        W.Views.guests.openForm(null);
      } else if (act === 'edit') {
        W.Views.guests.openForm(S.guests.get(id));
      } else if (act === 'advance') {
        advance(id);
      } else if (act === 'filter') {
        filter = btn.getAttribute('data-key');
        W.App.rerender();
      } else if (act === 'clear') {
        filter = 'all'; query = '';
        W.App.rerender();
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
