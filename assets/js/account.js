/* Signing in, and choosing which wedding you are working on.

   This is the gate in front of the planner when the app is configured against a
   Supabase project. With no config the whole thing is skipped and the app runs
   on this device only, exactly as it always did. */
window.WCC = window.WCC || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, t = W.t;
  var Account = {};

  var pendingEmail = '';
  var pendingCouple = null;

  /* Every gate screen is a handful of inputs and one button. Enter should do
     what the button does, everywhere, without a form element per screen. */
  function submitOnEnter(inputs, run) {
    inputs.forEach(function (el) {
      if (!el) return;
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); run(); }
      });
    });
  }

  function config() {
    var c = (W.CONFIG && W.CONFIG.supabase) || {};
    return (c.url && c.anonKey) ? c : null;
  }

  /* Test seam: the browser suites stand a fake backend up before boot so the
     whole shared-wedding path can be exercised without a live project. */
  Account.configured = function () { return !!(W.TEST_BACKEND || config()); };

  /* --------------------------------------------------------------- shell -- */

  function host() { return document.getElementById('view'); }

  function screen(bodyHTML) {
    var el = host();
    /* Nothing of the planner belongs behind the gate: there is no wedding open
       to show a title, a menu or a save state for. */
    document.getElementById('app').classList.add('gated');
    document.getElementById('app').classList.remove('menu-open');
    el.innerHTML = '<div class="view-inner"><div class="gate">' + bodyHTML + '</div></div>';
    return el.querySelector('.gate');
  }

  /* Called the moment a wedding is actually open. */
  Account.ungate = function () {
    document.getElementById('app').classList.remove('gated');
  };

  function chrome(title, sub) {
    return '<div class="gate-head">' + UI.medallion() +
      '<h1>' + U.esc(title) + '</h1>' +
      (sub ? '<p>' + U.esc(sub) + '</p>' : '') + '</div>';
  }

  function busy(message) {
    screen(chrome(message || t('gate.loading'), ''));
  }

  function fail(message) {
    return '<p class="gate-error" role="alert">' + U.esc(message) + '</p>';
  }

  /* ------------------------------------------------------------- sign in -- */

  function signInScreen(errorText) {
    var gate = screen(
      chrome(t('gate.signInTitle'), t('gate.signInBody')) +
      (errorText ? fail(errorText) : '') +
      '<div class="field">' +
      '<label for="gateEmail">' + U.esc(t('gate.email')) + '</label>' +
      '<input type="email" id="gateEmail" autocomplete="email" inputmode="email" ' +
      'placeholder="' + U.esc(t('ph.emailExample')) + '">' +
      '<p class="err" hidden></p></div>' +
      '<button class="btn btn-primary btn-wide" data-act="send">' +
      U.esc(t('gate.sendLink')) + '</button>' +
      '<p class="gate-note">' + U.esc(t('gate.magicNote')) + '</p>'
    );

    var input = gate.querySelector('#gateEmail');
    var err = gate.querySelector('.err');

    function send() {
      var email = String(input.value || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        err.textContent = t('gate.emailInvalid');
        err.hidden = false;
        input.focus();
        return;
      }
      pendingEmail = email;
      busy(t('gate.sending'));
      W.Cloud.signIn(email).then(function () {
        checkEmailScreen(email);
      }).catch(function (e) {
        signInScreen(readableError(e));
      });
    }

    gate.querySelector('[data-act="send"]').addEventListener('click', send);
    submitOnEnter([input], send);
    input.focus();
  }

  function checkEmailScreen(email) {
    var gate = screen(
      chrome(t('gate.checkTitle'), t('gate.checkBody', { email: email })) +
      '<button class="btn btn-wide" data-act="again">' + U.esc(t('gate.differentEmail')) + '</button>'
    );
    gate.querySelector('[data-act="again"]').addEventListener('click', function () {
      signInScreen('');
    });
  }

  /* ------------------------------------------------------- pick a wedding -- */

  function pickerScreen(list) {
    var cards = list.map(function (w) {
      return '<button class="gate-choice" data-open="' + U.esc(w.id) + '">' +
        '<b>' + U.esc(w.name) + '</b><span>' + U.esc(t('gate.roleIs', { role: w.role })) +
        '</span></button>';
    }).join('');

    var gate = screen(
      chrome(t('gate.pickTitle'), t('gate.pickBody')) +
      '<div class="gate-choices">' + cards + '</div>' +
      '<button class="btn btn-wide" data-act="new">' + U.esc(t('gate.createAnother')) + '</button>' +
      signOutRow()
    );

    gate.addEventListener('click', function (e) {
      var open = e.target.closest ? e.target.closest('[data-open]') : null;
      if (open) { Account.openWedding(open.getAttribute('data-open')); return; }
      if (e.target.closest('[data-act="new"]')) createScreen();
      if (e.target.closest('[data-act="signout"]')) Account.signOut();
    });
  }

  function createScreen(errorText) {
    var gate = screen(
      chrome(t('gate.createTitle'), t('gate.createBodyNew')) +
      (errorText ? fail(errorText) : '') +
      /* A wedding is two names joined, so the form is shaped like one. */
      '<div class="couple-pair">' +
      '<div class="field"><label for="gateBride">' + U.esc(t('gate.brideName')) + '</label>' +
      '<input type="text" id="gateBride" maxlength="40" autocomplete="off" placeholder="' +
      U.esc(t('ph.sarah')) + '"></div>' +
      '<span class="couple-amp" aria-hidden="true">' + U.esc(t('gate.amp')) + '</span>' +
      '<div class="field"><label for="gateGroom">' + U.esc(t('gate.groomName')) + '</label>' +
      '<input type="text" id="gateGroom" maxlength="40" autocomplete="off" placeholder="' +
      U.esc(t('ph.ahmed')) + '"></div>' +
      '</div>' +
      '<p class="gate-note gate-note-tight">' + U.esc(t('gate.coupleHint')) + '</p>' +
      '<div class="field"><label for="gateWho">' + U.esc(t('gate.yourName')) + '</label>' +
      '<input type="text" id="gateWho" maxlength="60" autocomplete="name" placeholder="' +
      U.esc(t('ph.sarah')) + '">' +
      '<p class="hint">' + U.esc(t('gate.yourNameHint')) + '</p>' +
      '<p class="err" hidden></p></div>' +
      '<button class="btn btn-primary btn-wide" data-act="create">' +
      U.esc(t('gate.createBtn')) + '</button>' +
      signOutRow()
    );

    var bride = gate.querySelector('#gateBride');
    var groom = gate.querySelector('#gateGroom');
    var who = gate.querySelector('#gateWho');
    var err = gate.querySelector('#gateWho').parentNode.querySelector('.err');

    function create() {
      var b = bride.value.trim(), g = groom.value.trim(), me = who.value.trim();
      /* Your own name is the one thing that is not optional: without it every
         job you take on is signed with an email address. */
      if (!me) {
        err.textContent = t('gate.yourNameRequired');
        err.hidden = false;
        who.focus();
        return;
      }
      var label = (b && g) ? (b + ' \u0026 ' + g) : (b || g || t('gate.defaultName'));
      /* Held until the wedding is open, then written into settings so the
         sidebar says their names rather than "Your Wedding". */
      pendingCouple = { brideName: b, groomName: g };
      busy(t('gate.creating'));
      W.Cloud.createWedding(label, me).then(function (id) {
        return Account.openWedding(id, true);
      }).catch(function (e) {
        pendingCouple = null;
        createScreen(readableError(e));
      });
    }

    gate.querySelector('[data-act="create"]').addEventListener('click', create);
    submitOnEnter([bride, groom, who], create);
    gate.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="signout"]')) Account.signOut();
    });
    bride.focus();
  }

  function signOutRow() {
    return '<p class="gate-note">' +
      '<button class="btn btn-ghost btn-sm" data-act="signout">' +
      U.esc(t('gate.signOut')) + '</button></p>';
  }

  /* Every route into the planner goes through here, so nobody reaches it
     without a name — the migration offer used to slip past this. */
  function finishOpening() {
    if (!W.Cloud.myName()) { nameScreen(''); return true; }
    W.App.start();
    return true;
  }

  /* Somebody who joined by invitation has no name yet, and would otherwise
     appear as their email address on every job, comment and entry in the
     activity trail. Ask once, before the planner opens. */
  function nameScreen(errorText) {
    var gate = screen(
      chrome(t('gate.nameTitle'), t('gate.nameBody')) +
      (errorText ? fail(errorText) : '') +
      '<div class="field">' +
      '<label for="gateMyName">' + U.esc(t('gate.nameLabel')) + '</label>' +
      '<input type="text" id="gateMyName" maxlength="60" autocomplete="name" ' +
      'placeholder="' + U.esc(t('ph.nameExample')) + '">' +
      '<p class="err" hidden></p></div>' +
      '<button class="btn btn-primary btn-wide" data-act="savename">' +
      U.esc(t('gate.nameSave')) + '</button>'
    );

    var input = gate.querySelector('#gateMyName');
    var err = gate.querySelector('.err');

    function save() {
      var name = String(input.value || '').trim();
      if (!name) {
        err.textContent = t('gate.nameRequired');
        err.hidden = false;
        input.focus();
        return;
      }
      busy(t('gate.opening'));
      W.Cloud.setMyName(name).then(function () {
        W.App.start();
      }).catch(function (e) { nameScreen(readableError(e)); });
    }

    gate.querySelector('[data-act="savename"]').addEventListener('click', save);
    submitOnEnter([input], save);
    input.focus();
  }

  /* ---------------------------------------------------------- opening up -- */

  /* fresh = a wedding just created, so offer to carry local data across. */
  Account.openWedding = function (id, fresh) {
    busy(t('gate.opening'));
    S.setCacheKey('wcc.cache.' + id);

    return W.Cloud.open(id).then(function (raw) {
      S.adopt(raw);
      W.Cloud.listen(function (change) { S.applyRemote(change); });

      /* saveSettings writes the whole object, so merge rather than replace. */
      if (pendingCouple && (pendingCouple.brideName || pendingCouple.groomName)) {
        var cur = S.state.settings;
        S.saveSettings({
          brideName: pendingCouple.brideName || cur.brideName,
          groomName: pendingCouple.groomName || cur.groomName,
          weddingDate: cur.weddingDate, venue: cur.venue, hashtag: cur.hashtag
        });
      }
      pendingCouple = null;

      if (fresh && Account.localDataAvailable()) return offerMigration();
      return finishOpening();
    }).catch(function (e) {
      /* No connection: fall back to the copy cached on this device. */
      var cached = null;
      try { cached = window.localStorage.getItem(S.cacheKey()); } catch (err) { cached = null; }
      if (cached) {
        S.load();
        W.Cloud.listen(function (change) { S.applyRemote(change); });
        W.App.start();
        UI.toast(t('gate.offlineCopy'), 'bad');
        return true;
      }
      screen(chrome(t('gate.cannotOpen'), '') + fail(readableError(e)) +
        '<button class="btn btn-primary btn-wide" data-act="retry">' +
        U.esc(t('gate.retry')) + '</button>');
      host().querySelector('[data-act="retry"]').addEventListener('click', function () {
        Account.openWedding(id, fresh);
      });
      return false;
    });
  };

  /* Data left over from before this became a shared app. */
  Account.localDataAvailable = function () {
    try {
      var raw = window.localStorage.getItem('wcc.wedding.v1');
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      return !!parsed && (
        (parsed.tasks || []).length + (parsed.guests || []).length +
        (parsed.budget || []).length + (parsed.events || []).length
      ) > 0;
    } catch (err) { return false; }
  };

  function offerMigration() {
    return new Promise(function (resolve) {
      UI.confirm({
        title: t('gate.migrateTitle'),
        body: t('gate.migrateBody'),
        confirmLabel: t('gate.migrateBtn'),
        onConfirm: function () {
          var raw = null;
          try { raw = JSON.parse(window.localStorage.getItem('wcc.wedding.v1')); } catch (e) { raw = null; }
          if (raw) {
            S.replaceAll(raw, 'import');
            UI.toast(t('gate.migrated'), 'good');
          }
          finishOpening();
          resolve(true);
        },
        onClose: function () { finishOpening(); resolve(true); }
      });
    });
  }

  /* -------------------------------------------------------------- boot ---- */

  Account.signOut = function () {
    W.Cloud.signOut().then(function () {
      pendingEmail = '';
      signInScreen('');
    });
  };

  /* Resolves once the planner is ready to render, or never — because the gate
     owns the screen until someone signs in. */
  Account.boot = function () {
    W.Cloud.use(W.TEST_BACKEND || W.SupabaseBackend.create(config()));
    busy(t('gate.loading'));

    return W.Cloud.restoreSession().then(function (user) {
      if (!user) { signInScreen(''); return false; }
      /* Anyone who was invited by email becomes a member the moment they arrive. */
      return W.Cloud.acceptInvites().catch(function () { return 0; })
        .then(function () { return W.Cloud.listWeddings(); })
        .then(function (list) {
          if (!list.length) { createScreen(); return false; }
          var remembered = null;
          try { remembered = window.localStorage.getItem('wcc.lastWedding'); } catch (e) { remembered = null; }
          var match = null;
          list.forEach(function (w) { if (w.id === remembered) match = w; });
          if (list.length === 1 || match) {
            var chosen = match || list[0];
            try { window.localStorage.setItem('wcc.lastWedding', chosen.id); } catch (e) { /* private mode */ }
            return Account.openWedding(chosen.id);
          }
          pickerScreen(list);
          return false;
        });
    }).catch(function (e) {
      signInScreen(readableError(e));
      return false;
    });
  };

  function readableError(e) {
    var msg = String((e && (e.message || e.error_description)) || e || '');
    if (/row-level security/i.test(msg)) return t('gate.notAllowed');
    if (/fetch|network|Failed to fetch/i.test(msg)) return t('gate.noConnection');
    return msg || t('gate.unknownError');
  }

  W.Account = Account;
})(window.WCC);
