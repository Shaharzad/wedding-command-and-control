/* Today — the surface you open every morning.
   The daily band is shared with the Dashboard so ticking works in both places
   and writes to exactly one place in state. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, Charts = W.Charts, t = W.t;

  /* On a shared wedding you usually want your own jobs, not the family's. */
  var onlyMine = false;
  function canFilterByPerson() {
    return W.Cloud.isEnabled() && W.Cloud.people().length > 0;
  }
  function mineOnly(list) {
    if (!onlyMine || !canFilterByPerson()) return list;
    return list.filter(function (x) { return x.assignee && W.Cloud.isMe(x.assignee); });
  }

  /* ------------------------------------------------------- today's set -- */

  function todaySet() {
    var today = U.todayISO();
    var daily = S.dailyTasks();
    var weekly = S.weeklyTasksOn(today);
    var due = S.state.tasks.filter(function (x) {
      return x.recurrence === 'none' && x.dueDate === today;
    });
    var overdue = mineOnly(S.overdueTasks(today));
    daily = mineOnly(daily);
    weekly = mineOnly(weekly);
    due = mineOnly(due);
    var items = daily.concat(weekly, due);
    var done = items.filter(function (x) { return S.isTaskDoneOn(x, today); }).length;
    return {
      today: today,
      daily: daily,
      weekly: weekly,
      due: due,
      overdue: overdue,
      items: items,
      done: done,
      total: items.length,
      events: S.eventsOn(today)
    };
  }

  /* ------------------------------------------------------------- rows -- */

  function metaBits(task, today) {
    var bits = [];
    bits.push('<span class="chip">' + U.esc(task.category) + '</span>');
    if (task.priority === 'High') bits.push(UI.chip(task.priority, 'maroon'));
    if (task.recurrence === 'daily') bits.push(UI.chip(t('tasks.everyDay'), 'gold'));
    if (task.recurrence === 'weekly') bits.push(UI.chip(t('tasks.everyWeek'), 'gold'));
    if (task.recurrence === 'none' && task.dueDate) {
      if (task.dueDate < today) {
        var n = U.daysBetween(task.dueDate, today);
        bits.push('<span style="color:var(--danger);font-weight:600">' +
          U.esc(t('tasks.overdueBy', { n: n })) + '</span>');
      } else if (task.dueDate === today) {
        bits.push('<span>' + U.esc(t('tasks.dueToday')) + '</span>');
      }
    }
    return bits.join('');
  }

  function rowHTML(task, today) {
    var done = S.isTaskDoneOn(task, today);
    var label = done ? t('tasks.markNotDone', { name: task.title }) : t('tasks.markDone', { name: task.title });
    return '<div class="check-row' + (done ? ' done' : '') + '">' +
      UI.checkbox({
        done: done,
        label: label,
        attrs: 'data-act="toggle" data-id="' + U.esc(task.id) + '" data-fk="chk_' + U.esc(task.id) + '"'
      }) +
      '<div class="check-main"><div class="check-title">' + U.esc(task.title) + '</div>' +
      '<div class="check-meta">' + metaBits(task, today) + '</div></div>' +
      '<button class="icon-btn" data-act="edit-task" data-id="' + U.esc(task.id) + '">' +
      U.esc(t('common.edit')) + '</button>' +
      '</div>';
  }

  function listCard(title, tasks, today, extraClass, emptyText) {
    var body = tasks.length
      ? tasks.map(function (x) { return rowHTML(x, today); }).join('')
      : '<div class="check-row"><div class="check-main"><div class="check-meta">' +
        U.esc(emptyText) + '</div></div></div>';
    return '<div class="section"><div class="section-head"><h2>' + U.esc(title) + '</h2></div>' +
      '<div class="check-list' + (extraClass ? ' ' + extraClass : '') + '">' + body + '</div></div>';
  }

  /* -------------------------------------------------------------- band -- */

  var Band = {};

  Band.html = function (opts) {
    var set = todaySet();
    var days = S.daysToWedding();
    var countText;
    if (days === null) countText = t('count.noDate');
    else if (days === 0) countText = t('count.today');
    else if (days === 1) countText = t('count.tomorrow');
    else if (days > 0) countText = t('count.days', { n: U.fmtNumber(days) });
    else countText = days === -1 ? t('count.pastOne') : t('count.past', { n: U.fmtNumber(-days) });

    /* days, then weeks and months underneath — the same number, three ways. */
    var breakdown = (days !== null && days > 1)
      ? t('count.breakdown', { w: Math.floor(days / 7), m: Math.round(days / 30.4) })
      : '';

    var html = '<div class="today-head">' +
      '<div class="today-date">' + U.esc(U.fmtDate(set.today, 'weekday')) + '</div>' +
      '<p class="today-count"' + (set.total ? '' : ' style="margin-bottom:0"') + '>' +
      (days !== null && days >= 0 ? '<b>' + U.esc(countText) + '</b>' : U.esc(countText)) +
      (breakdown ? '<span class="count-breakdown">' + U.esc(breakdown) + '</span>' : '') + '</p>' +
      /* An empty bar next to an empty state says nothing twice. */
      (set.total
        ? UI.progressBar(t('today.progress', { done: set.done, total: set.total }), set.done, set.total)
        : '') +
      '</div>';

    if (opts && opts.compact) {
      /* Dashboard band: the daily rituals only, tickable in place. */
      var rows = set.daily.concat(set.weekly).map(function (x) { return rowHTML(x, set.today); }).join('');
      if (!rows) {
        rows = '<div class="check-row"><div class="check-main"><div class="check-meta">' +
          U.esc(t('today.dailyEmpty')) + '</div></div></div>';
      }
      html += '<div class="check-list" style="margin-top:-6px">' + rows +
        '<div class="streak-strip">' + streakHTML() + '</div></div>';
    }
    return html;
  };

  function streakHTML() {
    var streak = S.currentStreak();
    var longest = S.longestStreak();
    var label = streak === 0 ? t('today.streakNone')
      : (streak === 1 ? t('today.streakDay') : t('today.streakDays', { n: streak }));
    return '<div><div class="streak-num">' + (streak || '—') + '</div>' +
      '<div class="streak-label">' + U.esc(t('today.streak')) + '</div></div>' +
      '<div><div class="streak-num" style="color:var(--emerald)">' + (longest || '—') + '</div>' +
      '<div class="streak-label">' + U.esc(t('today.longest')) + '</div></div>' +
      '<div class="chart-holder" data-streak-strip></div>' +
      '<div class="streak-label" style="width:100%">' + U.esc(t('today.strip30')) +
      '<span class="sr-only"> — ' + U.esc(label) + '</span></div>';
  }

  Band.paintCharts = function (root) {
    var strip = root.querySelector('[data-streak-strip]');
    if (strip) {
      Charts.render(strip, {
        type: 'dots',
        title: t('today.strip30'),
        days: S.streakStrip(30),
        emptyText: t('today.dailyEmpty')
      });
    }
  };

  /* Shared click handling for anything the band renders. */
  Band.wire = function (root) {
    root.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!btn || !root.contains(btn)) return;
      var act = btn.getAttribute('data-act');
      var id = btn.getAttribute('data-id');

      if (act === 'toggle') {
        S.toggleTask(id);
      } else if (act === 'edit-task') {
        if (W.Views.tasks && W.Views.tasks.openForm) W.Views.tasks.openForm(S.tasks.get(id));
      } else if (act === 'add-daily') {
        if (W.Views.tasks && W.Views.tasks.openForm) {
          W.Views.tasks.openForm(null, { recurrence: 'daily' });
        }
      } else if (act === 'scope') {
        onlyMine = btn.getAttribute('data-key') === 'mine';
        W.App.rerender();
      } else if (act === 'goto-today') {
        window.location.hash = '#/today';
      }
    });
  };

  W.TodayBand = Band;

  /* -------------------------------------------------------------- view -- */

  W.Views.today = {
    title: t('today.title'),

    render: function (root) {
      var set = todaySet();
      var nothing = !set.daily.length && !set.weekly.length && !set.due.length &&
        !set.overdue.length && !set.events.length;

      var html = Band.html({ compact: false });

      if (canFilterByPerson()) {
        html += '<div class="filters" role="group" aria-label="' + U.esc(t('assign.label')) + '">' +
          '<button class="filter-btn" data-act="scope" data-key="mine" aria-pressed="' +
          (onlyMine ? 'true' : 'false') + '">' + U.esc(t('assign.yours')) + '</button>' +
          '<button class="filter-btn" data-act="scope" data-key="all" aria-pressed="' +
          (onlyMine ? 'false' : 'true') + '">' + U.esc(t('assign.everyones')) + '</button>' +
          '</div>';
      }

      if (nothing) {
        html += UI.emptyHTML({
          title: t('today.nothing'),
          body: t('today.nothingBody'),
          actionLabel: t('today.addDaily'),
          actionAttr: 'data-act="add-daily"'
        });
      } else {
        /* The streak belongs to the daily rituals, so it lives in that card. */
        html += '<div class="section"><div class="section-head"><h2>' + U.esc(t('today.daily')) + '</h2></div>' +
          '<div class="check-list">' +
          (set.daily.length || set.weekly.length
            ? set.daily.concat(set.weekly).map(function (x) { return rowHTML(x, set.today); }).join('')
            : '<div class="check-row"><div class="check-main"><div class="check-meta">' +
              U.esc(t('today.dailyEmpty')) + '</div></div></div>') +
          '<div class="streak-strip">' + streakHTML() + '</div></div></div>';
        html += listCard(t('today.due'), set.due, set.today, null, t('today.dueEmpty'));
        if (set.overdue.length) {
          html += '<div class="section"><div class="section-head"><h2>' + U.esc(t('today.overdue')) +
            '</h2><span class="chip chip-danger">' +
            U.esc(t('today.overdueCount', { n: set.overdue.length })) + '</span></div>' +
            '<div class="check-list overdue-list">' +
            set.overdue.map(function (x) { return rowHTML(x, set.today); }).join('') +
            '</div></div>';
        }
        html += '<div class="section"><div class="section-head"><h2>' + U.esc(t('today.events')) + '</h2></div>';
        if (set.events.length) {
          html += '<div class="check-list">' + set.events.map(function (e) {
            var when = [U.fmtTime(e.startTime), U.fmtTime(e.endTime)].filter(Boolean).join(' – ');
            return '<div class="check-row"><div class="check-main">' +
              '<div class="check-title">' + U.esc(e.name) + '</div>' +
              '<div class="check-meta">' + UI.chip(e.type, 'gold') +
              (when ? '<span>' + U.esc(when) + '</span>' : '') +
              (e.venue ? '<span>' + U.esc(e.venue) + '</span>' : '') + '</div></div></div>';
          }).join('') + '</div>';
        } else {
          html += '<div class="check-list"><div class="check-row"><div class="check-main">' +
            '<div class="check-meta">' + U.esc(t('today.eventsEmpty')) + '</div></div></div></div>';
        }
        html += '</div>';
      }

      root.innerHTML = html;
      Band.paintCharts(root);
      Band.wire(root);
    }
  };

})(window.WCC);
