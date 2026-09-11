/* What everyone has been doing.

   Written by a database trigger rather than the client, so it records what
   actually happened rather than what the app remembered to report.

   Loading the sample wedding, or bringing a plan across from a laptop, produces
   a hundred entries in the same second. Listed one per line that buries the one
   thing you actually wanted to see, so a run of the same person doing the same
   kind of thing in the same few minutes is shown as a single line. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, UI = W.UI, t = W.t;
  var Activity = {};

  var cache = null;
  var loading = false;
  var loadError = '';
  var who = 'all';

  /* Two entries belong together if the same person did the same kind of thing
     to the same section within a few minutes. */
  var BURST_MS = 5 * 60 * 1000;

  function refresh(force) {
    if (loading || (cache && !force)) return;
    loading = true;
    loadError = '';
    W.Cloud.activity(150).then(function (rows) {
      cache = rows || [];
      loading = false;
      W.App.rerender();
    }).catch(function (e) {
      loading = false;
      loadError = String((e && e.message) || e);
      W.App.rerender();
    });
  }

  /* The collection key is the app's own vocabulary; show the section name. */
  var SECTION = {
    tasks: 'nav.tasks', guests: 'nav.guests', budget: 'nav.budget',
    events: 'nav.events', vendors: 'nav.vendors', wardrobe: 'nav.wardrobe',
    menu: 'nav.catering', shopping: 'nav.shopping', contacts: 'nav.contacts',
    tables: 'nav.seating', decor: 'nav.decor', shots: 'nav.photos',
    nikah: 'nav.nikah', gifts: 'nav.gifts', responsibilities: 'nav.responsibilities',
    timeline: 'nav.command', honeymoonItems: 'nav.honeymoon'
  };

  var ROUTE = {
    tasks: 'tasks', guests: 'guests', budget: 'budget', events: 'events',
    vendors: 'vendors', wardrobe: 'wardrobe', menu: 'catering', shopping: 'shopping',
    contacts: 'contacts', tables: 'seating', decor: 'decor', shots: 'photos',
    nikah: 'nikah', gifts: 'gifts', responsibilities: 'responsibilities',
    timeline: 'command', honeymoonItems: 'honeymoon'
  };

  function sectionName(collection) {
    return SECTION[collection] ? t(SECTION[collection]) : collection;
  }

  function opLabel(op) {
    return t('activity.op' + op.charAt(0).toUpperCase() + op.slice(1));
  }

  function ms(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function clock(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return U.pad2(d.getHours()) + ':' + U.pad2(d.getMinutes());
  }

  function dayOf(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '' : U.toISO(d);
  }

  function dayName(day) {
    if (day === U.todayISO()) return t('activity.today');
    if (day === U.addDays(U.todayISO(), -1)) return t('activity.yesterday');
    return U.fmtDate(day, 'long');
  }

  /* Rows come back newest first. Fold each run into one entry. */
  Activity.fold = function (rows) {
    var out = [];
    (rows || []).forEach(function (a) {
      var last = out[out.length - 1];
      if (last && last.actor === a.actor && last.op === a.op &&
          last.collection === a.collection &&
          Math.abs(ms(last.at) - ms(a.at)) <= BURST_MS) {
        last.count += 1;
        return;
      }
      out.push({
        actor: a.actor, op: a.op, collection: a.collection,
        recordId: a.record_id, summary: a.summary || '', at: a.at, count: 1
      });
    });
    return out;
  };

  /* "Ammi changed 6 things" / "Sarah added Chai station" */
  function sentence(entry) {
    var name = W.Cloud.personName(entry.actor) || t('members.someone');
    var what = entry.count > 1
      ? '<b>' + U.esc(t('activity.many', { n: entry.count })) + '</b>'
      : (entry.summary ? '<b>' + U.esc(entry.summary) + '</b>' : '');
    return U.esc(name) + ' ' + U.esc(opLabel(entry.op)) + (what ? ' ' + what : '');
  }

  function rowHTML(entry, meta) {
    var route = ROUTE[entry.collection];
    return '<div class="check-row"' +
      (route ? ' data-act="open" data-route="' + U.esc(route) + '"' : '') + '>' +
      '<div class="check-main">' +
      '<div class="check-title">' + sentence(entry) + '</div>' +
      '<div class="check-meta">' + UI.chip(sectionName(entry.collection)) +
      '<span>' + U.esc(meta) + '</span></div></div></div>';
  }

  /* ------------------------------------------------- the dashboard card --- */

  Activity.recentHTML = function (limit) {
    if (!W.Cloud.isEnabled() || !cache) return '';
    var rows = Activity.fold(cache).slice(0, limit || 5);
    if (!rows.length) return '';
    return '<div class="check-list">' + rows.map(function (e) {
      var day = dayOf(e.at);
      var meta = day === U.todayISO() ? t('activity.todayAt', { time: clock(e.at) })
        : (day === U.addDays(U.todayISO(), -1)
          ? t('activity.yesterdayAt', { time: clock(e.at) })
          : U.fmtDate(day, 'medium') + ', ' + clock(e.at));
      return rowHTML(e, meta);
    }).join('') + '</div>';
  };

  /* Lets the dashboard pull the feed in without owning the loading. */
  Activity.ensure = function () { refresh(false); };

  /* ---------------------------------------------------------- the page --- */

  W.Views.activity = {
    title: t('activity.title'),

    render: function (root) {
      if (!W.Cloud.isEnabled()) {
        root.innerHTML = '<div class="section"><div class="section-head"><h2>' +
          U.esc(t('activity.title')) + '</h2></div>' +
          UI.emptyHTML({
            title: t('members.localTitle'),
            body: t('activity.localBody')
          }) + '</div>';
        return;
      }

      refresh(false);
      var people = W.Cloud.people();

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('activity.title')) + '</h2>' +
        '<p class="section-note">' + U.esc(t('activity.sub')) + '</p>' +
        '<button class="btn btn-sm" data-act="reload">' + U.esc(t('activity.reload')) + '</button>' +
        '</div>';

      if (people.length > 1) {
        html += '<div class="filters">' +
          '<button class="filter-btn" data-act="who" data-key="all" aria-pressed="' +
          (who === 'all' ? 'true' : 'false') + '">' + U.esc(t('common.all')) + '</button>' +
          people.map(function (p) {
            return '<button class="filter-btn" data-act="who" data-key="' + U.esc(p.id) +
              '" aria-pressed="' + (who === p.id ? 'true' : 'false') + '">' +
              U.esc(p.name || t('members.someone')) + '</button>';
          }).join('') + '</div>';
      }

      if (loadError) {
        html += '<div class="notice notice-danger"><h3>' + U.esc(t('activity.failed')) +
          '</h3><p>' + U.esc(loadError) + '</p></div>';
      } else if (!cache) {
        html += '<div class="chart-empty">' + U.esc(t('gate.loading')) + '</div>';
      } else {
        var rows = Activity.fold(cache.filter(function (a) {
          return who === 'all' || a.actor === who;
        }));
        if (!rows.length) {
          html += UI.emptyHTML({
            title: t('activity.empty'),
            body: t('activity.emptyBody')
          });
        } else {
          /* One heading per day, so a month of planning is scannable. */
          var day = null;
          rows.forEach(function (e, i) {
            var d = dayOf(e.at);
            if (d !== day) {
              if (i) html += '</div>';
              day = d;
              html += '<h3 class="day-head">' + U.esc(dayName(d)) + '</h3>' +
                '<div class="check-list">';
            }
            html += rowHTML(e, clock(e.at));
          });
          html += '</div>';
          html += '<p class="section-note">' +
            U.esc(t('activity.showing', { n: rows.length })) + '</p>';
        }
      }

      html += '</div>';
      root.innerHTML = html;

      root.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!btn) return;
        var act = btn.getAttribute('data-act');
        if (act === 'reload') { refresh(true); return; }
        if (act === 'who') { who = btn.getAttribute('data-key'); W.App.rerender(); return; }
        if (act === 'open') { window.location.hash = '#/' + btn.getAttribute('data-route'); }
      });
    }
  };

  W.Views.activity.invalidate = function () { cache = null; };
  W.Activity = Activity;

})(window.WCC);
