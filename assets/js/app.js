/* App shell: routing, chrome, boot, first-run choice. */
window.WCC = window.WCC || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, t = W.t;

  var ICONS = {
    today: '<path d="M3 6h14M6 3v3M14 3v3" /><rect x="3" y="6" width="14" height="11" rx="2"/><path d="M7 12l2 2 4-4"/>',
    dashboard: '<rect x="3" y="3" width="6" height="7" rx="1.5"/><rect x="11" y="3" width="6" height="4" rx="1.5"/><rect x="3" y="12" width="6" height="5" rx="1.5"/><rect x="11" y="9" width="6" height="8" rx="1.5"/>',
    tasks: '<path d="M4 6l1.6 1.6L8.5 4.7M4 13l1.6 1.6 2.9-2.9M11 6.3h5M11 13.3h5"/>',
    budget: '<path d="M10 3v14M13.5 6.2c-.6-1-1.9-1.6-3.5-1.6-2 0-3.4.9-3.4 2.3 0 3.2 7.1 1.7 7.1 5 0 1.5-1.5 2.5-3.7 2.5-1.8 0-3.2-.7-3.8-1.8"/>',
    guests: '<circle cx="7.5" cy="7" r="2.6"/><path d="M3 16c0-2.4 2-4 4.5-4s4.5 1.6 4.5 4"/><circle cx="14" cy="7.6" r="2.1"/><path d="M13 12.2c2.3-.3 4 1.2 4 3.8"/>',
    events: '<path d="M10 2.5l1.9 4 4.4.6-3.2 3 .8 4.3-3.9-2-3.9 2 .8-4.3-3.2-3 4.4-.6z"/>',
    settings: '<path d="M4 6h12M4 10h12M4 14h12"/><circle cx="7.5" cy="6" r="1.6"/><circle cx="13" cy="10" r="1.6"/><circle cx="8.5" cy="14" r="1.6"/>',
    activity: '<path d="M2.6 10h3.2l2-5 3.4 10 2.2-5h3.9"/>',
    members: '<circle cx="7" cy="7" r="2.6"/><path d="M2.6 15.6c0-2.4 2-4 4.4-4s4.4 1.6 4.4 4"/><circle cx="14" cy="8" r="2.1"/><path d="M13 12.6c2.4-.3 4.4 1.2 4.4 3.8"/>',
    analytics: '<path d="M2.5 17h15"/><path d="M4.5 17V9.5M8.5 17V4M12.5 17v-5.5M16.5 17V7.5"/>',
    vendors: '<rect x="3" y="6.5" width="14" height="9.5" rx="2"/><path d="M7.5 6.5V5.2A1.7 1.7 0 0 1 9.2 3.5h1.6a1.7 1.7 0 0 1 1.7 1.7v1.3"/><path d="M3 10.5h14"/>',
    wardrobe: '<path d="M8.6 6.4a1.9 1.9 0 1 1 2 1.9c-.7 0-1.2.4-1.2 1"/><path d="m9.4 9.9-6 4.3a1 1 0 0 0 .6 1.8h12a1 1 0 0 0 .6-1.8l-6-4.3z"/>',
    catering: '<circle cx="8.5" cy="10" r="5.5"/><circle cx="8.5" cy="10" r="2.2"/><path d="M16.5 3.8v12.4M15 3.8v4M18 3.8v4"/>',
    shopping: '<path d="M4.6 6.6h10.8l-.9 10.4H5.5z"/><path d="M7.6 6.6V5.1a2.4 2.4 0 0 1 4.8 0v1.5"/>',
    contacts: '<rect x="5.5" y="2.8" width="11.5" height="14.4" rx="2"/><path d="M3 6.4h2.5M3 10h2.5M3 13.6h2.5"/><circle cx="11.2" cy="8.4" r="1.9"/><path d="M8.4 13.8c0-1.5 1.3-2.4 2.8-2.4s2.8.9 2.8 2.4"/>',
    invitations: '<rect x="2.5" y="5" width="15" height="10.5" rx="1.8"/><path d="m3 6 7 5.2L17 6"/>',
    seating: '<circle cx="10" cy="10" r="3.8"/><path d="M10 2.6v2.2M10 15.2v2.2M2.6 10h2.2M15.2 10h2.2M4.8 4.8l1.5 1.5M13.7 13.7l1.5 1.5M15.2 4.8l-1.5 1.5M6.3 13.7l-1.5 1.5"/>',
    decor: '<circle cx="10" cy="10" r="1.9"/><ellipse cx="10" cy="5.4" rx="2.1" ry="2.6"/><ellipse cx="10" cy="14.6" rx="2.1" ry="2.6"/><ellipse cx="5.4" cy="10" rx="2.6" ry="2.1"/><ellipse cx="14.6" cy="10" rx="2.6" ry="2.1"/>',
    photos: '<rect x="2.5" y="6" width="15" height="10" rx="2"/><circle cx="10" cy="11" r="3"/><path d="M7.4 6l.9-2h3.4l.9 2"/>',
    gifts: '<rect x="3.2" y="8.4" width="13.6" height="8.4" rx="1.5"/><path d="M2.4 5.6h15.2v2.8H2.4zM10 5.6v11.2"/><path d="M10 5.6C8.9 3.4 6.2 3.2 6.2 4.7c0 1.2 2 .9 3.8.9zM10 5.6c1.1-2.2 3.8-2.4 3.8-.9 0 1.2-2 .9-3.8.9z"/>',
    responsibilities: '<circle cx="7.4" cy="6.6" r="2.4"/><path d="M3 15.6c0-2.3 2-3.8 4.4-3.8s4.4 1.5 4.4 3.8"/><path d="m13 9.8 1.6 1.6L18 8"/>',
    nikah: '<circle cx="7.6" cy="11" r="4"/><circle cx="12.4" cy="9" r="4"/>',
    honeymoon: '<path d="M17.6 3.4 2.6 9.1l5.2 2.1 1.6 5.2z"/><path d="M17.6 3.4 7.8 11.2"/>',
    command: '<circle cx="10" cy="10" r="7"/><path d="M10 5.6V10l2.9 1.8"/>'
  };

  /* The sidebar is grouped once it grows past a handful of entries. */
  var NAV = [
    { items: ['today', 'dashboard', 'analytics'] },
    { label: 'navgroup.planning', items: ['tasks', 'budget', 'guests', 'invitations', 'events', 'seating'] },
    { label: 'navgroup.suppliers', items: ['vendors', 'catering', 'wardrobe', 'shopping', 'contacts'] },
    { label: 'navgroup.details', items: ['decor', 'photos', 'gifts', 'responsibilities', 'nikah', 'honeymoon'] },
    { label: 'navgroup.theday', items: ['command'] },
    { items: ['activity', 'members', 'settings'] }
  ];

  /* Sections that only mean anything on a shared wedding. */
  var CLOUD_ONLY = { members: true, activity: true };

  var ROUTES = [];
  NAV.forEach(function (group) {
    group.items.forEach(function (key) { ROUTES.push(key); });
  });

  var App = {};
  var current = 'today';
  var backupNudgeDismissed = false;
  var BACKUP_NAG_DAYS = 14;

  function routeFromHash() {
    var hash = String(window.location.hash || '').replace(/^#\/?/, '');
    return ROUTES.indexOf(hash) >= 0 ? hash : 'today';
  }

  /* ------------------------------------------------------------ chrome -- */

  function icon(name) {
    return '<svg class="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      (ICONS[name] || '') + '</svg>';
  }

  function paintNav() {
    var nav = document.getElementById('nav');
    var overdue = S.overdueTasks().length;
    nav.innerHTML = NAV.map(function (group) {
      var visible = group.items.filter(function (key) {
        return !CLOUD_ONLY[key] || W.Cloud.isEnabled();
      });
      if (!visible.length) return '';
      var links = visible.map(function (key) {
        var badge = (key === 'tasks' && overdue)
          ? '<span class="nav-badge" title="' + U.esc(t('today.overdueCount', { n: overdue })) + '">' + overdue + '</span>'
          : '';
        return '<a class="nav-item" href="#/' + key + '"' +
          (current === key ? ' aria-current="page"' : '') + '>' +
          icon(key) + '<span>' + U.esc(t('nav.' + key)) + '</span>' + badge + '</a>';
      }).join('');
      return '<div class="nav-group">' +
        (group.label ? '<p class="nav-group-label">' + U.esc(t(group.label)) + '</p>' : '') +
        links + '</div>';
    }).join('');
  }

  function paintHeader() {
    var couple = S.coupleName();
    var title = couple ? t('app.coupleWedding', { couple: couple }) : t('app.fallbackCouple');
    var date = S.state.settings.weddingDate;

    document.getElementById('sidebarCouple').textContent = couple || t('app.fallbackCouple');
    document.getElementById('sidebarDate').textContent = date ? U.fmtDate(date, 'medium') : t('app.noDate');
    /* The header carries the wedding; the section heading below carries the
       page name, so neither is said twice. */
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('topbarCouple').textContent = S.state.settings.venue || '';
    document.title = ((W.Views[current] && W.Views[current].title) || t('app.title')) + ' — ' + title;

    var saved = S.state.meta.savedAt;
    var note = document.getElementById('sidebarSaveNote');
    var sync = W.Cloud.status();
    if (sync.enabled && !sync.online) {
      note.textContent = t('account.offline');
    } else if (sync.enabled && sync.syncing) {
      note.textContent = t('account.syncing');
    } else if (sync.enabled && !sync.error) {
      note.textContent = t('account.synced');
    } else if (!S.lastSaveOk()) {
      note.textContent = t('settings.saveFailed');
    } else if (saved) {
      var d = new Date(saved);
      var time = isNaN(d.getTime()) ? '' : U.pad2(d.getHours()) + ':' + U.pad2(d.getMinutes());
      note.textContent = time ? t('app.savedAt', { time: time }) : t('app.savedHere');
    } else {
      note.textContent = t('app.savedHere');
    }

    var count = document.getElementById('topbarCount');
    var days = S.daysToWedding();
    if (days === null) {
      count.innerHTML = '';
    } else if (days > 0) {
      count.innerHTML = '<b>' + U.fmtNumber(days) + '</b>' + U.esc(t('count.label'));
    } else if (days === 0) {
      count.innerHTML = '<b>' + U.esc(t('count.today')) + '</b>';
    } else {
      count.innerHTML = '<span class="countdown-past">' +
        U.esc(days === -1 ? t('count.pastOne') : t('count.past', { n: U.fmtNumber(-days) })) + '</span>';
    }
  }

  /* On a phone each table row becomes a card, and every value needs its
     column heading beside it. Done here so no view has to think about it. */
  function labelTableCells(root) {
    var tables = root.querySelectorAll('.table-wrap table');
    for (var i = 0; i < tables.length; i++) {
      var heads = tables[i].querySelectorAll('thead th');
      var labels = [];
      for (var h = 0; h < heads.length; h++) {
        /* A heading that only exists for screen readers labels nothing here. */
        labels.push(heads[h].querySelector('.sr-only') ? '' : heads[h].textContent.trim());
      }
      var rows = tables[i].querySelectorAll('tbody tr');
      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].children;
        var primaryDone = false;
        for (var c = 0; c < cells.length && c < labels.length; c++) {
          if (!labels[c]) continue;
          cells[c].setAttribute('data-label', labels[c]);
          /* The first real value heads the card; repeating its column name
             there would just cost a line. */
          if (!primaryDone) {
            cells[c].setAttribute('data-primary', '');
            primaryDone = true;
          }
        }
      }
    }
  }

  /* ----------------------------------------------------------- banners --
     Two things worth interrupting for: changes that are not being stored, and
     data that has never been backed up. Nothing else goes here. */

  function paintAccount() {
    var row = document.getElementById('accountRow');
    if (!W.Cloud.isEnabled()) { row.hidden = true; row.innerHTML = ''; return; }
    var who = W.Cloud.user();
    row.hidden = false;
    row.innerHTML =
      '<p class="account-who">' +
      U.esc(t('account.signedInAs', { email: (who && who.email) || '' })) + '</p>' +
      '<p class="account-actions">' +
      '<button class="btn btn-ghost btn-sm" data-account="switch">' +
      U.esc(t('account.switchWedding')) + '</button>' +
      '<button class="btn btn-ghost btn-sm" data-account="signout">' +
      U.esc(t('account.signOut')) + '</button></p>';
  }

  function paintBanners() {
    var host = document.getElementById('banners');
    var html = '';
    var sync = W.Cloud.status();

    /* Shared weddings have their own failure modes, and they matter more than
       a local cache miss, so they come first. */
    if (sync.enabled && !sync.online) {
      html += '<div class="notice notice-danger" role="alert">' +
        '<h3>' + U.esc(t('sync.offlineTitle')) + '</h3>' +
        '<p>' + U.esc(t('sync.offlineBody')) + '</p></div>';
    } else if (sync.enabled && sync.error) {
      html += '<div class="notice notice-danger" role="alert">' +
        '<h3>' + U.esc(t('sync.errorTitle')) + '</h3>' +
        '<p>' + U.esc(t('sync.errorBody')) + '</p>' +
        '<button class="btn btn-danger" data-banner="export">' +
        U.esc(t('banner.saveFailedAction')) + '</button></div>';
    } else if (sync.enabled && !W.Cloud.canWrite()) {
      html += '<div class="notice" role="status">' +
        '<h3>' + U.esc(t('role.viewerTitle')) + '</h3>' +
        '<p>' + U.esc(t('role.viewerBody')) + '</p></div>';
    }

    if (!S.lastSaveOk()) {
      html += '<div class="notice notice-danger" role="alert">' +
        '<h3>' + U.esc(t('banner.saveFailedTitle')) + '</h3>' +
        '<p>' + U.esc(t('banner.saveFailedBody')) + '</p>' +
        '<button class="btn btn-danger" data-banner="export">' +
        U.esc(t('banner.saveFailedAction')) + '</button></div>';
    }

    var onDailySurface = current === 'today' || current === 'dashboard';
    if (onDailySurface && !backupNudgeDismissed && S.lastSaveOk() && S.hasContent()) {
      var age = S.backupAgeDays();
      if (age === null || age >= BACKUP_NAG_DAYS) {
        /* "Everything lives in this browser" stops being true the moment the
           wedding is shared, but a free project has no backups either. */
        var shared = W.Cloud && W.Cloud.isEnabled();
        html += '<div class="notice" role="status">' +
          '<h3>' + U.esc(age === null
            ? t(shared ? 'banner.backupNeverShared' : 'banner.backupNeverTitle')
            : t('banner.backupStaleTitle', { n: age })) + '</h3>' +
          '<p>' + U.esc(age === null
            ? t(shared ? 'banner.backupNeverSharedBody' : 'banner.backupNeverBody')
            : t(shared ? 'banner.backupStaleSharedBody' : 'banner.backupStaleBody')) + '</p>' +
          '<div class="btn-row"><button class="btn btn-emerald" data-banner="export">' +
          U.esc(t('banner.backupAction')) + '</button>' +
          '<button class="btn btn-ghost" data-banner="dismiss">' +
          U.esc(t('banner.dismiss')) + '</button></div></div>';
      }
    }

    host.innerHTML = html;
  }

  /* ------------------------------------------------------------ render -- */

  function render() {
    var host = document.getElementById('view');

    /* Keep focus and caret across a re-render. */
    var active = document.activeElement;
    var fk = active && active.getAttribute ? active.getAttribute('data-fk') : null;
    var caret = null;
    if (fk && active && typeof active.selectionStart === 'number') caret = active.selectionStart;

    paintNav();
    paintHeader();
    paintAccount();
    paintBanners();

    host.innerHTML = '';
    var root = document.createElement('div');
    root.className = 'view-inner';
    host.appendChild(root);

    var view = W.Views[current];
    if (view && view.render) {
      view.render(root);
      labelTableCells(root);
    } else {
      root.innerHTML = UI.emptyHTML({ title: t('common.noMatches'), body: t('common.noMatchesHint') });
    }

    if (fk) {
      var again = root.querySelector('[data-fk="' + fk.replace(/"/g, '') + '"]');
      if (again) {
        try {
          again.focus();
          if (caret !== null && again.setSelectionRange) again.setSelectionRange(caret, caret);
        } catch (err) { /* the element may not be focusable any more */ }
      }
    }
    W.Charts.hideTip();
  }

  App.rerender = render;

  /* Called once the planner is allowed on screen: straight away on a local
     device, or after signing in and choosing a wedding. */
  App.start = function () {
    if (W.Account && W.Account.ungate) W.Account.ungate();
    current = routeFromHash();
    if (!window.location.hash) window.location.hash = '#/today';
    render();
    if (!S.hasContent() && (!W.Cloud.isEnabled() || W.Cloud.canWrite())) {
      if (!W.Cloud.isEnabled() && S.state.meta.onboarded) return;
      showOnboarding();
    }
  };

  /* -------------------------------------------------------- onboarding -- */

  function showOnboarding() {
    UI.openModal({
      title: t('onboard.title'),
      subtitle: t('onboard.body'),
      dismissible: false,
      small: false,
      bodyHTML: '<div class="onboard">' + UI.medallion() +
        '<div class="onboard-choices">' +
        '<button class="onboard-choice" data-choice="sample"><b>' + U.esc(t('onboard.sample')) + '</b>' +
        '<span>' + U.esc(t('onboard.sampleBody')) + '</span></button>' +
        '<button class="onboard-choice" data-choice="fresh"><b>' + U.esc(t('onboard.fresh')) + '</b>' +
        '<span>' + U.esc(t('onboard.freshBody')) + '</span></button>' +
        '</div></div>',
      footHTML: '',
      onMount: function (node, close) {
        node.addEventListener('click', function (e) {
          var btn = e.target.closest ? e.target.closest('[data-choice]') : null;
          if (!btn) return;
          if (btn.getAttribute('data-choice') === 'sample') {
            S.replaceAll(W.Sample.build(), 'sample');
            UI.toast(t('onboard.loaded'), 'good');
            close();
          } else {
            S.state.meta.onboarded = true;
            S.save('onboard');
            UI.toast(t('onboard.freshDone'), 'good');
            close();
            W.Views.settings.openDetails();
          }
        });
      }
    });
  }

  /* -------------------------------------------------------------- menu -- */

  function closeMenu() {
    document.getElementById('app').classList.remove('menu-open');
    document.getElementById('hamburger').setAttribute('aria-expanded', 'false');
    document.getElementById('scrim').hidden = true;
  }

  function wireChrome() {
    var app = document.getElementById('app');
    var burger = document.getElementById('hamburger');
    var scrim = document.getElementById('scrim');

    burger.addEventListener('click', function () {
      var open = app.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      scrim.hidden = !open;
    });
    scrim.addEventListener('click', closeMenu);

    document.getElementById('nav').addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.nav-item')) closeMenu();
    });

    window.addEventListener('hashchange', function () {
      current = routeFromHash();
      render();
      window.scrollTo(0, 0);
      document.getElementById('view').focus({ preventScroll: true });
    });

    document.getElementById('globalSearch').addEventListener('click', function () {
      W.Search.open('');
    });

    document.getElementById('accountRow').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-account]') : null;
      if (!btn) return;
      if (btn.getAttribute('data-account') === 'signout') W.Account.signOut();
      else {
        try { window.localStorage.removeItem('wcc.lastWedding'); } catch (err) { /* private mode */ }
        W.Account.boot();
      }
    });

    document.getElementById('banners').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-banner]') : null;
      if (!btn) return;
      if (btn.getAttribute('data-banner') === 'export') W.Views.settings.exportJSON();
      else { backupNudgeDismissed = true; render(); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
      /* Ctrl+K / Cmd+K opens search from anywhere. */
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        W.Search.open('');
      }
    });
  }

  /* -------------------------------------------------------------- boot -- */

  App.boot = function () {
    wireChrome();
    S.subscribe(function () { render(); });
    /* Sync trouble shows up in the same banner as a failed local save. */
    W.Cloud.onStatus(function () { paintBanners(); });

    if (W.Account && W.Account.configured()) {
      /* The gate owns the screen until there is a wedding to show. */
      W.Account.boot();
      return;
    }

    S.load();
    S.save('boot');          /* persists today's snapshot and any repairs */
    App.start();
  };

  W.App = App;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.boot);
  } else {
    App.boot();
  }

})(window.WCC);
