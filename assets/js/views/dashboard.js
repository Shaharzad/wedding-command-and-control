/* Dashboard — every number here is derived live from the one state object. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, Charts = W.Charts, t = W.t;

  function kpi(label, value, foot, accent, isMoney) {
    return '<div class="kpi' + (accent ? ' accent-' + accent : '') + '">' +
      '<p class="kpi-label">' + U.esc(label) + '</p>' +
      '<p class="kpi-value' + (isMoney ? ' money' : '') + '">' + U.esc(value) + '</p>' +
      (foot ? '<p class="kpi-foot' + (foot.warn ? ' warn' : '') + '">' + U.esc(foot.text) + '</p>' : '') +
      '</div>';
  }

  W.Views.dashboard = {
    title: t('dash.title'),

    render: function (root) {
      var st = S.state;
      var tasks = S.taskStats();
      var budget = S.budgetStats();
      var guests = S.guestStats();
      var events = S.eventStats();
      var today = U.todayISO();

      var html = W.TodayBand.html({ compact: true });

      var isBare = !st.tasks.length && !st.budget.length && !st.guests.length && !st.events.length;
      if (isBare) {
        html += UI.emptyHTML({
          title: t('dash.nothingYet'),
          body: t('dash.nothingYetBody'),
          actionLabel: t('tasks.add'),
          actionAttr: 'data-act="add-task"'
        });
        root.innerHTML = html;
        W.TodayBand.paintCharts(root);
        W.TodayBand.wire(root);
        root.addEventListener('click', function (e) {
          var b = e.target.closest ? e.target.closest('[data-act="add-task"]') : null;
          if (b && W.Views.tasks) W.Views.tasks.openForm(null);
        });
        return;
      }

      /* --- KPI tiles ---
         The countdown already leads the band above and sits in the header, so
         it is not repeated a third time here. */
      html += '<div class="section"><div class="grid grid-kpi">' +
        kpi(t('dash.kpiTasks'), tasks.done + ' / ' + tasks.total,
          { text: t('dash.percentComplete', { n: tasks.percent }) }, 'maroon') +
        kpi(t('dash.kpiOverdue'), U.fmtNumber(tasks.overdue),
          {
            text: tasks.overdue ? t('dash.overdueSome') : t('dash.overdueNone'),
            warn: tasks.overdue > 0
          }) +
        kpi(t('dash.kpiBudget'), U.fmtMoney(budget.spent),
          { text: t('budget.spentOf', { spent: U.fmtMoneyShort(budget.spent), total: U.fmtMoneyShort(budget.planned) }) },
          null, true) +
        kpi(t('dash.kpiRemaining'), U.fmtMoney(budget.remaining),
          budget.overCount
            ? { text: t('dash.overBudget', { n: budget.overCount }), warn: true }
            : { text: t('budget.withinBudget') },
          'emerald', true) +
        kpi(t('budget.due'), U.fmtMoney(budget.due),
          { text: t('budget.acrossUnpaid') }, null, true) +
        kpi(t('dash.kpiGuests'), U.fmtNumber(guests.heads),
          { text: t('guests.countLine', { people: U.fmtNumber(guests.heads), groups: guests.groups }) }) +
        kpi(t('dash.kpiAttending'), U.fmtNumber(guests.attendingHeads),
          { text: t('guests.responseRate', { n: guests.responseRate }) }, 'emerald') +
        kpi(t('dash.kpiEvents'), U.fmtNumber(events.total),
          { text: t('dash.upcomingCount', { n: events.upcoming }) }) +
        '</div></div>';

      /* --- the three headline charts --- */
      html += '<div class="section"><div class="grid grid-3">' +

        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('dash.progress')) + '</h3></div>' +
        '<div data-chart-ring></div></div>' +

        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('dash.budgetMeter')) + '</h3></div>' +
        '<div data-chart-meter></div>' +
        '<div class="meter-note"><span>' + U.esc(t('budget.totalSpent')) + ' ' + U.esc(U.fmtMoney(budget.spent)) +
        '</span><span>' + U.esc(t('budget.remaining')) + ' ' + U.esc(U.fmtMoney(budget.remaining)) + '</span></div></div>' +

        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('dash.rsvp')) + '</h3></div>' +
        '<div data-chart-rsvp></div></div>' +

        '</div></div>';

      /* --- guests by side + budget by category --- */
      html += '<div class="section"><div class="grid grid-2">' +
        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('dash.sides')) + '</h3></div>' +
        '<div data-chart-sides></div></div>' +
        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('dash.categories')) + '</h3></div>' +
        '<p class="card-sub">' + U.esc(t('dash.categoriesSub')) + '</p>' +
        '<div data-chart-cats style="margin-top:10px"></div></div>' +
        '</div></div>';

      /* --- what everyone has been up to --- */
      if (W.Cloud.isEnabled()) {
        W.Activity.ensure();
        var recent = W.Activity.recentHTML(5);
        if (recent) {
          html += '<div class="section"><div class="section-head"><h2>' +
            U.esc(t('activity.recent')) + '</h2>' +
            '<button class="btn btn-sm" data-act="goto-activity">' +
            U.esc(t('common.viewAll')) + '</button></div>' + recent + '</div>';
        }
      }

      /* --- next events --- */
      var upcoming = S.eventsSorted().filter(function (e) { return !e.date || e.date >= today; }).slice(0, 4);
      html += '<div class="section"><div class="section-head"><h2>' + U.esc(t('dash.nextEvents')) + '</h2>' +
        '<button class="btn btn-sm" data-act="goto-events">' + U.esc(t('common.viewAll')) + '</button></div>';
      if (upcoming.length) {
        html += '<div class="check-list">' + upcoming.map(function (e) {
          var away = e.date ? U.daysBetween(today, e.date) : null;
          var awayText = away === null ? '' : (away === 0 ? t('events.todayLabel')
            : (away === 1 ? t('events.tomorrow') : t('events.daysAway', { n: away })));
          return '<div class="check-row"><div class="check-main">' +
            '<div class="check-title">' + U.esc(e.name) + '</div>' +
            '<div class="check-meta">' + UI.chip(e.type, 'gold') +
            (e.date ? '<span>' + U.esc(U.fmtDate(e.date, 'medium')) + '</span>' : '') +
            (e.venue ? '<span>' + U.esc(e.venue) + '</span>' : '') +
            (awayText ? '<span>' + U.esc(awayText) + '</span>' : '') + '</div></div></div>';
        }).join('') + '</div>';
      } else {
        html += '<div class="check-list"><div class="check-row"><div class="check-main">' +
          '<div class="check-meta">' + U.esc(t('events.empty')) + '</div></div></div></div>';
      }
      html += '</div>';

      root.innerHTML = html;

      /* --- paint the charts --- */
      W.TodayBand.paintCharts(root);

      Charts.render(root.querySelector('[data-chart-ring]'), {
        type: 'ring',
        title: t('dash.progress'),
        percent: tasks.percent,
        centreLabel: t('nav.tasks').toLowerCase(),
        caption: t('dash.progressSub', { done: tasks.done, total: tasks.total })
      });

      Charts.render(root.querySelector('[data-chart-meter]'), {
        type: 'meter',
        value: budget.spent,
        limit: budget.planned,
        fmt: U.fmtMoney,
        valueLabel: t('budget.totalSpent'),
        limitLabel: t('budget.meterLimit'),
        emptyText: t('budget.empty')
      });

      Charts.render(root.querySelector('[data-chart-rsvp]'), {
        type: 'donut',
        title: t('dash.rsvp'),
        centreValue: U.fmtNumber(guests.groups),
        centreLabel: t('dash.rsvpCentre'),
        items: W.OPT.rsvp.map(function (key) {
          return { label: key, value: guests.rsvp[key] || 0, color: Charts.RSVP_COLOURS[key] };
        })
      });

      Charts.render(root.querySelector('[data-chart-sides]'), {
        type: 'donut',
        title: t('dash.sides'),
        centreValue: U.fmtNumber(guests.groups),
        centreLabel: t('dash.rsvpCentre'),
        items: W.OPT.side.map(function (key) {
          return { label: key, value: guests.side[key] || 0, color: Charts.SIDE_COLOURS[key] };
        })
      });

      Charts.render(root.querySelector('[data-chart-cats]'), {
        type: 'pairedBars',
        title: t('dash.categories'),
        items: W.Views.budget.byCategory().slice(0, 8),
        fmt: U.fmtMoneyShort,
        emptyText: t('budget.empty')
      });

      W.TodayBand.wire(root);
      root.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!b) return;
        var act = b.getAttribute('data-act');
        if (act === 'goto-events') window.location.hash = '#/events';
        if (act === 'goto-activity') window.location.hash = '#/activity';
        if (act === 'open') window.location.hash = '#/' + b.getAttribute('data-route');
      });
    }
  };

})(window.WCC);
