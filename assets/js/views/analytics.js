/* Analytics — every chart here is derived from completedAt and the daily
   snapshots. Nothing extra is stored to make these work.

   Each block declares both a chart and a table of the same numbers, so the
   "show as table" toggle never leaves anything readable only as colour. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, Charts = W.Charts, t = W.t;

  var showTable = false;

  /* ------------------------------------------------------------ helpers -- */

  function card(id, title, sub, lead, leadWarn) {
    return '<div class="card card-chart">' +
      '<div class="card-head"><h3>' + U.esc(title) + '</h3></div>' +
      (lead ? '<p class="card-lead' + (leadWarn ? ' over' : '') + '">' + U.esc(lead) + '</p>' : '') +
      (sub ? '<p class="card-sub">' + U.esc(sub) + '</p>' : '') +
      '<div data-an="' + id + '" style="margin-top:12px"></div></div>';
  }

  function tableHTML(columns, rows) {
    if (!rows.length) {
      return '<div class="chart-empty">' + U.esc(t('chart.noData')) + '</div>';
    }
    var html = '<div class="table-wrap"><table><thead><tr>';
    columns.forEach(function (c) {
      html += '<th scope="col"' + (c.num ? ' class="num"' : '') + '>' + U.esc(c.label) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr>';
      columns.forEach(function (c, i) {
        html += '<td' + (c.num ? ' class="num"' : '') + '>' + U.esc(r[i]) + '</td>';
      });
      html += '</tr>';
    });
    return html + '</tbody></table></div>';
  }

  /* A block is a chart spec plus the same numbers as columns and rows. */
  function paintBlock(root, id, block) {
    var el = root.querySelector('[data-an="' + id + '"]');
    if (!el) return;
    if (showTable) {
      /* Drop the chart marker so a window resize does not redraw over it. */
      el.removeAttribute('data-chart');
      el.__spec = null;
      el.innerHTML = tableHTML(block.columns, block.rows());
    } else if (block.chart) {
      Charts.render(el, block.chart);
    } else {
      el.innerHTML = tableHTML(block.columns, block.rows());
    }
  }

  /* ------------------------------------------------------------- blocks -- */

  function buildBlocks() {
    var blocks = {};
    var tasks = S.taskStats();
    var budget = S.budgetStats();
    var guests = S.guestStats();
    var history = S.state.history;

    /* --- planning velocity, from completedAt --- */
    var weeks = S.velocityByWeek(8);
    blocks.velocity = {
      chart: {
        type: 'line',
        title: t('an.velocity'),
        color: Charts.MAROON,
        minPoints: 3,
        labels: weeks.map(function (b) { return U.fmtDate(b.weekStart, 'short'); }),
        series: [{
          name: t('an.tableCompleted'),
          color: Charts.MAROON,
          values: weeks.map(function (b) { return b.count; }),
          tips: weeks.map(function (b) {
            return U.fmtDate(b.weekStart, 'medium') + ': ' + b.count + ' completed';
          })
        }],
        emptyText: t('an.noTasks')
      },
      columns: [{ label: t('an.tableWeek') }, { label: t('an.tableCompleted'), num: true }],
      rows: function () {
        return weeks.map(function (b) {
          return [U.fmtDate(b.weekStart, 'medium'), U.fmtNumber(b.count)];
        });
      }
    };

    /* --- burndown: two series, one y-axis (counts of tasks) --- */
    var burn = S.burndownSeries();
    if (burn) {
      var series = [{
        name: t('an.burndownActual'),
        color: Charts.MAROON,
        values: burn.actual
      }];
      if (burn.ideal) {
        series.push({
          name: t('an.burndownIdeal'),
          color: Charts.GOLD_LINE,
          values: burn.ideal,
          dashed: true
        });
      }
      blocks.burndown = {
        chart: {
          type: 'line',
          title: t('an.burndown'),
          minPoints: 2,
          height: 250,
          labels: burn.labels.map(function (l) { return U.fmtDate(l, 'short'); }),
          series: series
        },
        columns: [
          { label: t('an.tableWeek') },
          { label: t('an.tableRemaining'), num: true },
          { label: t('an.tablePace'), num: true }
        ],
        rows: function () {
          return burn.labels.map(function (l, i) {
            return [
              U.fmtDate(l, 'medium'),
              burn.actual[i] === null ? t('common.na') : U.fmtNumber(burn.actual[i]),
              burn.ideal ? U.fmtNumber(Math.round(burn.ideal[i])) : t('common.na')
            ];
          });
        }
      };
    }

    /* --- cumulative spend, one y-axis, budget as a limit line --- */
    var spend = S.spendSeries();
    blocks.spend = {
      chart: {
        type: 'line',
        title: t('an.spend'),
        color: Charts.EMERALD,
        fmt: U.fmtMoneyShort,
        limit: budget.planned || 0,
        limitLabel: budget.planned ? t('an.spendLimit') : '',
        height: 250,
        labels: spend.map(function (h) { return U.fmtDate(h.date, 'short'); }),
        series: [{
          name: t('an.tableSpent'),
          color: Charts.EMERALD,
          values: spend.map(function (h) { return h.spent; }),
          tips: spend.map(function (h) {
            return U.fmtDate(h.date, 'medium') + ': ' + U.fmtMoney(h.spent);
          })
        }],
        emptyText: t('an.noBudget')
      },
      columns: [{ label: t('an.tableDate') }, { label: t('an.tableSpent'), num: true }],
      rows: function () {
        return spend.slice().reverse().map(function (h) {
          return [U.fmtDate(h.date, 'medium'), U.fmtMoney(h.spent)];
        });
      }
    };

    /* --- budget by category --- */
    var cats = W.Views.budget.byCategory();
    blocks.categories = {
      chart: {
        type: 'pairedBars',
        title: t('an.categories'),
        items: cats,
        fmt: U.fmtMoneyShort,
        emptyText: t('an.noBudget')
      },
      columns: [
        { label: t('an.tableCategory') },
        { label: t('an.tablePlanned'), num: true },
        { label: t('an.tableSpent'), num: true },
        { label: t('budget.difference'), num: true }
      ],
      rows: function () {
        return cats.map(function (c) {
          return [
            c.label + (c.spent > c.planned && c.planned > 0 ? ' (' + t('budget.over') + ')' : ''),
            U.fmtMoney(c.planned), U.fmtMoney(c.spent), U.fmtMoney(c.planned - c.spent)
          ];
        });
      }
    };

    /* --- top five spenders plus Other --- */
    var top = W.Views.budget.topSpend();
    blocks.topSpend = {
      chart: {
        type: 'donut',
        title: t('an.topSpend'),
        centreValue: U.fmtMoneyShort(budget.spent),
        centreLabel: t('budget.totalSpent').toLowerCase(),
        fmt: U.fmtMoney,
        items: top
      },
      columns: [
        { label: t('an.tableCategory') },
        { label: t('an.tableSpent'), num: true },
        { label: t('an.tableShare'), num: true }
      ],
      rows: function () {
        return top.map(function (i) {
          return [i.label, U.fmtMoney(i.value), U.pct(i.value, budget.spent) + '%'];
        });
      }
    };

    /* --- guests --- */
    blocks.rsvp = {
      chart: {
        type: 'donut',
        title: t('guests.rsvpChart'),
        centreValue: U.fmtNumber(guests.groups),
        centreLabel: t('dash.rsvpCentre'),
        items: W.OPT.rsvp.map(function (k) {
          return { label: k, value: guests.rsvp[k] || 0, color: Charts.RSVP_COLOURS[k] };
        }),
        emptyText: t('an.noGuests')
      },
      columns: [
        { label: t('guests.rsvp') },
        { label: t('an.tableCount'), num: true },
        { label: t('an.tableShare'), num: true }
      ],
      rows: function () {
        return W.OPT.rsvp.map(function (k) {
          return [k, U.fmtNumber(guests.rsvp[k] || 0), U.pct(guests.rsvp[k] || 0, guests.groups) + '%'];
        });
      }
    };

    blocks.sides = {
      chart: {
        type: 'donut',
        title: t('guests.sideChart'),
        centreValue: U.fmtNumber(guests.groups),
        centreLabel: t('dash.rsvpCentre'),
        items: W.OPT.side.map(function (k) {
          return { label: k, value: guests.side[k] || 0, color: Charts.SIDE_COLOURS[k] };
        }),
        emptyText: t('an.noGuests')
      },
      columns: [
        { label: t('guests.side') },
        { label: t('an.tableCount'), num: true },
        { label: t('an.tableShare'), num: true }
      ],
      rows: function () {
        return W.OPT.side.map(function (k) {
          return [k, U.fmtNumber(guests.side[k] || 0), U.pct(guests.side[k] || 0, guests.groups) + '%'];
        });
      }
    };

    blocks.adults = {
      chart: {
        type: 'bars',
        title: t('an.adultsChildren'),
        items: [
          { label: t('guests.adults'), value: guests.adults },
          { label: t('guests.children'), value: guests.children }
        ],
        emptyText: t('an.noGuests')
      },
      columns: [{ label: t('an.tableCategory') }, { label: t('an.tableCount'), num: true }],
      rows: function () {
        return [
          [t('guests.adults'), U.fmtNumber(guests.adults)],
          [t('guests.children'), U.fmtNumber(guests.children)]
        ];
      }
    };

    var replied = guests.groups - (guests.rsvp.Pending || 0);
    blocks.rsvpRate = {
      chart: {
        type: 'ring',
        title: t('an.rsvpRate'),
        percent: guests.responseRate,
        centreLabel: t('an.rsvpRateCentre'),
        caption: t('guests.repliedOf', { replied: replied, total: guests.groups })
      },
      columns: [{ label: t('an.tableStatus') }, { label: t('an.tableCount'), num: true }],
      rows: function () {
        return [
          [t('an.rsvpRateCentre'), U.fmtNumber(replied)],
          [t('guests.filter.pending'), U.fmtNumber(guests.rsvp.Pending || 0)],
          [t('an.tablePercent'), guests.responseRate + '%']
        ];
      }
    };

    /* --- task completion by category, lowest first --- */
    var byCat = S.taskCompletionByCategory();
    blocks.taskCats = {
      chart: {
        type: 'bars',
        title: t('an.taskCategories'),
        items: byCat.map(function (c) {
          return {
            label: c.label,
            value: c.percent,
            valueLabel: c.percent + '%',
            tipText: c.done + ' of ' + c.total + ' done'
          };
        }),
        emptyText: t('an.noTasks')
      },
      columns: [
        { label: t('an.tableCategory') },
        { label: t('an.tableDone'), num: true },
        { label: t('an.tableTotal'), num: true },
        { label: t('an.tablePercent'), num: true }
      ],
      rows: function () {
        return byCat.map(function (c) {
          return [c.label, U.fmtNumber(c.done), U.fmtNumber(c.total), c.percent + '%'];
        });
      }
    };

    /* --- vendor funnel --- */
    var funnel = S.vendorFunnel();
    blocks.funnel = {
      chart: {
        type: 'bars',
        title: t('an.funnel'),
        items: funnel,
        emptyText: t('an.noVendors')
      },
      columns: [{ label: t('an.tableStage') }, { label: t('an.tableVendors'), num: true }],
      rows: function () {
        return funnel.map(function (f) { return [f.label, U.fmtNumber(f.value)]; });
      }
    };

    /* --- daily consistency --- */
    var strip = S.streakStrip(30);
    blocks.consistency = {
      chart: {
        type: 'dots',
        title: t('an.consistency'),
        days: strip,
        emptyText: t('today.dailyEmpty')
      },
      columns: [{ label: t('an.tableDate') }, { label: t('an.tableDayDone') }],
      rows: function () {
        return strip.slice().reverse().map(function (d) {
          return [U.fmtDate(d.date, 'medium'), d.done ? t('common.yes') : t('common.no')];
        });
      }
    };

    blocks.__context = {
      tasks: tasks, budget: budget, guests: guests, history: history,
      burn: burn, weeks: weeks, byCat: byCat, funnel: funnel
    };
    return blocks;
  }

  /* --------------------------------------------------------------- view -- */

  W.Views.analytics = {
    title: t('an.title'),

    render: function (root) {
      var blocks = buildBlocks();
      var ctx = blocks.__context;
      var thin = ctx.history.length < 3;

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('an.trends')) + '</h2>' +
        '<p class="section-note">' + U.esc(t('an.sub')) + '<br>' +
        U.esc(t('an.daysRecorded', { n: ctx.history.length })) + '</p>' +
        '<button class="btn" data-act="toggle-table" aria-pressed="' + (showTable ? 'true' : 'false') + '">' +
        U.esc(showTable ? t('an.showCharts') : t('an.showTable')) + '</button>' +
        '</div>';

      /* --- trends --- */
      if (thin) {
        html += '<div class="empty">' + UI.medallion() +
          '<h3>' + U.esc(t('an.thin')) + '</h3><p>' +
          U.esc(t('an.thinBody', {
            n: t('an.daysRecorded', { n: ctx.history.length }),
            verb: ctx.history.length === 1 ? t('an.thinIs') : t('an.thinAre')
          })) + '</p></div>';
      } else {
        var velocityLead = ctx.tasks.done
          ? t('an.velocityLead', { n: S.completedInLastDays(7) })
          : t('an.noTasks');
        var avg = Math.round(U.sum(ctx.weeks, function (b) { return b.count; }) / ctx.weeks.length * 10) / 10;

        html += '<div class="grid grid-2">' +
          card('velocity', t('an.velocity'), t('an.velocitySub') + ' ' +
            t('an.velocityAvg', { n: avg }), velocityLead) +
          card('burndown', t('an.burndown'), burndownSub(ctx), burndownLead(ctx),
            burndownBehind(ctx)) +
          '</div>';

        html += '<div class="grid" style="margin-top:16px">' +
          card('spend', t('an.spend'), t('an.spendSub'),
            t('an.spendLead', {
              spent: U.fmtMoney(ctx.budget.spent), planned: U.fmtMoney(ctx.budget.planned)
            })) +
          '</div>';
      }
      html += '</div>';

      /* --- budget --- */
      html += '<div class="section"><div class="section-head"><h2>' + U.esc(t('nav.budget')) + '</h2></div>' +
        '<div class="grid grid-2">' +
        card('categories', t('an.categories'), t('dash.categoriesSub'),
          U.fmtMoney(ctx.budget.spent) + ' / ' + U.fmtMoney(ctx.budget.planned)) +
        card('topSpend', t('an.topSpend'), t('budget.topSpendSub'),
          U.fmtMoney(ctx.budget.spent)) +
        '</div></div>';

      /* --- guests --- */
      html += '<div class="section"><div class="section-head"><h2>' + U.esc(t('an.guests')) + '</h2></div>' +
        '<div class="grid grid-4">' +
        card('rsvp', t('guests.rsvpChart'), '', U.fmtNumber(ctx.guests.groups) + ' ' + t('dash.rsvpCentre')) +
        card('sides', t('guests.sideChart'), '', U.fmtNumber(ctx.guests.groups) + ' ' + t('dash.rsvpCentre')) +
        card('rsvpRate', t('an.rsvpRate'), '', ctx.guests.responseRate + '%') +
        card('adults', t('an.adultsChildren'), '',
          U.fmtNumber(ctx.guests.adults) + ' / ' + U.fmtNumber(ctx.guests.children)) +
        '</div>' +
        '<div class="grid" style="margin-top:16px">' +
        card('taskCats', t('an.taskCategories'), t('an.taskCategoriesSub'), laggingLead(ctx)) +
        '</div></div>';

      /* --- vendors and consistency --- */
      var vs = S.vendorStats();
      html += '<div class="section"><div class="section-head"><h2>' + U.esc(t('nav.vendors')) + '</h2></div>' +
        '<div class="grid grid-2">' +
        card('funnel', t('an.funnel'), t('an.funnelSub'),
          t('vendors.bookedCount') + ': ' + U.fmtNumber(vs.booked)) +
        card('consistency', t('an.consistency'), t('an.consistencySub'),
          t('an.days', { n: S.currentStreak() })) +
        '</div></div>';

      root.innerHTML = html;

      Object.keys(blocks).forEach(function (id) {
        if (id === '__context') return;
        if (thin && (id === 'burndown' || id === 'spend' || id === 'velocity')) return;
        paintBlock(root, id, blocks[id]);
      });

      root.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-act="toggle-table"]') : null;
        if (!btn) return;
        showTable = !showTable;
        W.App.rerender();
      });
    }
  };

  function burndownSub(ctx) {
    if (!S.state.settings.weddingDate) return t('an.burndownNoDate');
    return t('an.burndownSub');
  }

  function burndownLead(ctx) {
    if (!ctx.burn || ctx.burn.actualNow === null) return t('chart.noData');
    if (ctx.burn.actualNow === 0) return t('an.burndownDone');
    if (ctx.burn.idealNow === null || ctx.burn.idealNow === undefined) {
      return t('an.tableRemaining') + ': ' + U.fmtNumber(ctx.burn.actualNow);
    }
    var gap = Math.round(ctx.burn.idealNow - ctx.burn.actualNow);
    if (gap > 0) return t('an.burndownAhead', { n: gap });
    if (gap < 0) return t('an.burndownBehind', { n: -gap });
    return t('an.burndownOnPace');
  }

  function burndownBehind(ctx) {
    return !!(ctx.burn && ctx.burn.idealNow !== null && ctx.burn.actualNow !== null &&
      ctx.burn.actualNow > ctx.burn.idealNow);
  }

  function laggingLead(ctx) {
    if (!ctx.byCat.length) return t('an.noTasks');
    var worst = ctx.byCat[0];
    return worst.label + ': ' + worst.percent + '%';
  }

})(window.WCC);
