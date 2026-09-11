/* Tasks — one-off and recurring.
   A recurring task's completion is a set of dates, never a boolean, so ticking
   today can never erase yesterday and the task returns tomorrow. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, Charts = W.Charts, t = W.t;

  var filter = 'all';
  var query = '';

  var FILTERS = [
    { key: 'all', label: 'tasks.filter.all' },
    { key: 'today', label: 'tasks.filter.today' },
    { key: 'week', label: 'tasks.filter.week' },
    { key: 'overdue', label: 'tasks.filter.overdue' },
    { key: 'completed', label: 'tasks.filter.completed' },
    { key: 'high', label: 'tasks.filter.high' },
    { key: 'recurring', label: 'tasks.filter.recurring' }
  ];

  /* Only offered once there are people to assign work to. */
  function shared() { return W.Cloud.isEnabled() && W.Cloud.people().length > 0; }

  function matchesFilter(task, key) {
    var today = U.todayISO();
    switch (key) {
      case 'mine':
        return !!task.assignee && W.Cloud.isMe(task.assignee);
      case 'unassigned':
        return !task.assignee;
      case 'today':
        if (task.recurrence === 'daily') return true;
        if (task.recurrence === 'weekly') return S.recursOn(task, today);
        return task.dueDate === today;
      case 'week':
        if (task.recurrence !== 'none') return true;
        return !!task.dueDate && task.dueDate >= U.startOfWeek(today) && task.dueDate <= U.endOfWeek(today);
      case 'overdue':
        return task.recurrence === 'none' && !!task.dueDate && task.dueDate < today && !task.completedAt;
      case 'completed':
        return task.recurrence === 'none' ? !!task.completedAt : task.completedDates.length > 0;
      case 'high':
        return task.priority === 'High';
      case 'recurring':
        return task.recurrence !== 'none';
      default:
        return true;
    }
  }

  function matchesQuery(task, q) {
    if (!q) return true;
    var hay = (task.title + ' ' + task.category + ' ' + task.notes + ' ' + task.priority + ' ' + task.status).toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function visible() {
    var q = query.trim().toLowerCase();
    return S.state.tasks.filter(function (x) {
      return matchesFilter(x, filter) && matchesQuery(x, q);
    }).sort(function (a, b) {
      var ad = S.isTaskDoneToday(a) ? 1 : 0, bd = S.isTaskDoneToday(b) ? 1 : 0;
      if (ad !== bd) return ad - bd;
      var ax = a.dueDate || '9999-12-31', bx = b.dueDate || '9999-12-31';
      if (ax !== bx) return ax < bx ? -1 : 1;
      return a.title < b.title ? -1 : 1;
    });
  }

  /* --------------------------------------------------------------- form -- */

  function openForm(task, preset) {
    var editing = !!task;
    var values = task ? U.clone(task) : {
      title: '',
      category: 'Other',
      priority: 'Medium',
      status: 'Not Started',
      dueDate: '',
      notes: '',
      recurrence: (preset && preset.recurrence) || 'none'
    };

    UI.form({
      title: editing ? t('tasks.edit') : t('tasks.add'),
      values: values,
      submitLabel: editing ? t('common.saveChanges') : t('common.add'),
      fields: [
        { name: 'title', label: t('tasks.name'), type: 'text', required: true, placeholder: t('ph.callTheDecoratorAboutTheStage') },
        [
          { name: 'category', label: t('tasks.category'), type: 'select', options: W.OPT.taskCategory, required: true },
          { name: 'priority', label: t('tasks.priority'), type: 'select', options: W.OPT.priority, required: true }
        ],
        [
          { name: 'status', label: t('tasks.status'), type: 'select', options: W.OPT.taskStatus, required: true },
          { name: 'dueDate', label: t('tasks.due'), type: 'date' }
        ],
        {
          name: 'recurrence', label: t('tasks.recurrence'), type: 'select',
          options: W.OPT.recurrence, required: true, hint: t('tasks.recurringNote')
        }
      ].concat(shared()
        ? [{ name: 'assignee', label: t('assign.label'), type: 'member' }]
        : []).concat([
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ]),
      onSubmit: function (vals) {
        if (editing) {
          S.tasks.update(task.id, vals);
          UI.toast(t('common.updated', { name: vals.title }), 'good');
        } else {
          S.tasks.add(vals);
          UI.toast(t('common.added', { name: vals.title }), 'good');
        }
        return true;
      }
    });
  }

  /* --------------------------------------------------------------- view -- */

  function statusCounts() {
    var out = {};
    W.OPT.taskStatus.forEach(function (s) { out[s] = 0; });
    S.state.tasks.forEach(function (x) { out[x.status] = (out[x.status] || 0) + 1; });
    return out;
  }

  function categoryCounts() {
    var map = {};
    S.state.tasks.forEach(function (x) {
      if (x.recurrence !== 'none') return;
      if (!map[x.category]) map[x.category] = { total: 0, done: 0 };
      map[x.category].total += 1;
      if (x.completedAt) map[x.category].done += 1;
    });
    return Object.keys(map).map(function (k) {
      return { label: k, value: map[k].total, done: map[k].done };
    }).sort(function (a, b) { return b.value - a.value; });
  }

  W.Views.tasks = {
    title: t('tasks.title'),
    openForm: openForm,

    render: function (root) {
      var all = S.state.tasks;
      var list = visible();
      var stats = S.taskStats();
      var today = U.todayISO();

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('tasks.title')) + '</h2>' +
        '<p class="section-note">' + U.esc(t('dash.progressSub', { done: stats.done, total: stats.total })) +
        (stats.recurring ? '<br>' + U.esc(t('dash.recurringCount', { n: stats.recurring })) : '') + '</p>' +
        '<button class="btn btn-primary" data-act="add">' + U.esc(t('tasks.add')) + '</button>' +
        '</div>';

      if (!all.length) {
        html += UI.emptyHTML({
          title: t('tasks.empty'),
          body: t('tasks.emptyBody'),
          actionLabel: t('tasks.add'),
          actionAttr: 'data-act="add"'
        });
        html += '</div>';
        root.innerHTML = html;
        wire(root);
        return;
      }

      html += '<div class="filters">';
      var filters = shared()
        ? FILTERS.concat([
          { key: 'mine', label: 'assign.mine' },
          { key: 'unassigned', label: 'assign.unassigned' }
        ])
        : FILTERS;
      filters.forEach(function (f) {
        var n = all.filter(function (x) { return matchesFilter(x, f.key); }).length;
        html += '<button class="filter-btn" data-act="filter" data-key="' + f.key + '" aria-pressed="' +
          (filter === f.key ? 'true' : 'false') + '">' + U.esc(t(f.label)) +
          ' <span class="filter-count">' + n + '</span></button>';
      });
      html += '<span class="spacer"></span><span class="search-wrap">' +
        '<label class="sr-only" for="taskSearch">' + U.esc(t('tasks.searchPh')) + '</label>' +
        '<input class="search-input" id="taskSearch" type="text" data-act="search" data-fk="taskSearch" ' +
        'placeholder="' + U.esc(t('tasks.searchPh')) + '" value="' + U.esc(query) + '"></span>';
      html += '</div>';

      if (!list.length) {
        html += UI.emptyHTML({
          title: t('common.noMatches'),
          body: t('common.noMatchesHint'),
          actionLabel: t('common.clearFilters'),
          actionAttr: 'data-act="clear"'
        });
      } else {
        html += '<div class="table-wrap"><table><caption class="sr-only">' + U.esc(t('tasks.title')) + '</caption><thead><tr>' +
          '<th scope="col"><span class="sr-only">' + U.esc(t('common.done')) + '</span></th>' +
          '<th scope="col">' + U.esc(t('tasks.name')) + '</th>' +
          '<th scope="col">' + U.esc(t('tasks.category')) + '</th>' +
          '<th scope="col">' + U.esc(t('tasks.priority')) + '</th>' +
          '<th scope="col">' + U.esc(t('tasks.status')) + '</th>' +
          (shared() ? '<th scope="col">' + U.esc(t('assign.label')) + '</th>' : '') +
          '<th scope="col">' + U.esc(t('tasks.due')) + '</th>' +
          '<th scope="col"><span class="sr-only">' + U.esc(t('common.actions')) + '</span></th>' +
          '</tr></thead><tbody>';

        list.forEach(function (x) {
          var done = S.isTaskDoneToday(x);
          var dueCell;
          if (x.recurrence !== 'none') {
            dueCell = '<span class="t-sub">' + U.esc(t('tasks.doneCount', { n: x.completedDates.length })) + '</span>';
          } else if (!x.dueDate) {
            dueCell = '<span class="t-sub">' + U.esc(t('tasks.noDue')) + '</span>';
          } else if (x.dueDate < today && !x.completedAt) {
            dueCell = '<span class="t-over">' + U.esc(U.fmtDate(x.dueDate, 'medium')) +
              '<b class="t-over-tag">' + U.esc(t('tasks.overdueTag')) + '</b></span>';
          } else {
            dueCell = U.esc(U.fmtDate(x.dueDate, 'medium'));
          }

          html += '<tr' + (done ? ' class="is-done"' : '') + '>' +
            '<td>' + UI.checkbox({
              done: done,
              label: done ? t('tasks.markNotDone', { name: x.title }) : t('tasks.markDone', { name: x.title }),
              attrs: 'data-act="toggle" data-id="' + U.esc(x.id) + '" data-fk="chk_' + U.esc(x.id) + '"'
            }) + '</td>' +
            '<td><div class="t-title">' + U.esc(x.title) + '</div>' +
            (x.notes ? '<div class="t-sub">' + U.esc(x.notes.slice(0, 70)) + (x.notes.length > 70 ? '…' : '') + '</div>' : '') +
            (x.recurrence !== 'none' ? '<div class="t-sub">' +
              U.esc(x.recurrence === 'daily' ? t('tasks.repeatsDaily') : t('tasks.repeatsWeekly')) + '</div>' : '') +
            '</td>' +
            '<td>' + U.esc(x.category) + '</td>' +
            '<td>' + UI.priorityChip(x.priority) + '</td>' +
            '<td>' + UI.statusChip(x.status) + '</td>' +
            (shared()
              ? '<td>' + (x.assignee
                ? UI.chip(S.assigneeName(x), W.Cloud.isMe(x.assignee) ? 'emerald' : '')
                : '<span class="t-sub">' + U.esc(t('assign.nobody')) + '</span>') + '</td>'
              : '') +
            '<td>' + dueCell + '</td>' +
            '<td class="actions">' +
            W.Comments.button('tasks', x.id, x.title) +
            '<button class="icon-btn" data-act="edit" data-id="' + U.esc(x.id) + '">' + U.esc(t('common.edit')) + '</button>' +
            '<button class="icon-btn danger" data-act="delete" data-id="' + U.esc(x.id) + '">' + U.esc(t('common.delete')) + '</button>' +
            '</td></tr>';
        });

        html += '</tbody></table></div>' +
          '<p class="section-note">' + U.esc(t('common.showing', { shown: list.length, total: all.length })) + '</p>';
      }
      html += '</div>';

      /* --- two supporting charts: bars, never a 17-slice pie --- */
      var counts = statusCounts();
      html += '<div class="section"><div class="grid grid-2">' +
        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('tasks.byStatus')) + '</h3></div>' +
        '<div data-chart-status style="margin-top:8px"></div></div>' +
        '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(t('tasks.byCategory')) + '</h3></div>' +
        '<div data-chart-cat style="margin-top:8px"></div></div>' +
        '</div></div>';

      root.innerHTML = html;

      Charts.render(root.querySelector('[data-chart-status]'), {
        type: 'bars',
        title: t('tasks.byStatus'),
        hue: 'emerald',
        items: W.OPT.taskStatus.map(function (s) { return { label: s, value: counts[s] || 0 }; }),
        emptyText: t('tasks.empty')
      });

      Charts.render(root.querySelector('[data-chart-cat]'), {
        type: 'bars',
        title: t('tasks.byCategory'),
        items: categoryCounts().slice(0, 8),
        emptyText: t('tasks.empty')
      });

      wire(root);
      W.Comments.wire(root, function (c, id) {
        var task = S.tasks.get(id);
        return task ? task.title : '';
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
        openForm(S.tasks.get(id));
      } else if (act === 'toggle') {
        S.toggleTask(id);
      } else if (act === 'filter') {
        filter = btn.getAttribute('data-key');
        W.App.rerender();
      } else if (act === 'clear') {
        filter = 'all'; query = '';
        W.App.rerender();
      } else if (act === 'delete') {
        var task = S.tasks.get(id);
        if (!task) return;
        UI.confirmDelete(task.title, function () {
          S.tasks.remove(id);
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
