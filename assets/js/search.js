/* Global search — one box over every collection.
   Picking a result goes to that section and opens the item, so finding
   something and fixing it is one move. */
window.WCC = window.WCC || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, t = W.t;

  /* Where a result opens, when the module has a form for it. */
  var OPENERS = {
    tasks: function (item) { W.Views.tasks.openForm(item); },
    guests: function (item) { W.Views.guests.openForm(item); },
    budget: function (item) { W.Views.budget.openForm(item); },
    events: function (item) { W.Views.events.openForm(item); },
    vendors: function (item) { W.Views.vendors.openForm(item); },
    wardrobe: function (item) { W.Views.wardrobe.openForm(item); },
    catering: function (item) { W.Views.catering.openForm(item); },
    shopping: function (item) { W.Views.shopping.openForm(item); },
    contacts: function (item) { W.Views.contacts.openForm(item); },
    decor: function (item) { W.Views.decor.openForm(item); },
    photos: function (item) { W.Views.photos.openForm(item); },
    nikah: function (item) { W.Views.nikah.openForm(item); },
    honeymoon: function (item) { W.Views.honeymoon.openForm(item); },
    gifts: function (item) { W.Views.gifts.openForm(item); },
    responsibilities: function (item) { W.Views.responsibilities.openForm(item); },
    command: function (item) { W.Views.command.openSlotForm(item, item.eventId); }
  };

  var found = {};

  function resultsHTML(query) {
    found = {};
    var groups = S.search(query);
    if (!query || query.trim().length < 2) {
      return '<p class="hint">' + U.esc(t('search.hint')) + '</p>';
    }
    if (!groups.length) {
      return '<div class="empty" style="padding:26px 16px">' +
        '<h3>' + U.esc(t('search.none', { q: query })) + '</h3>' +
        '<p>' + U.esc(t('search.noneBody')) + '</p></div>';
    }

    var total = 0;
    groups.forEach(function (g) { total += g.total; });

    var html = '<p class="hint">' + U.esc(t('search.results', { n: total })) + '</p>';
    groups.forEach(function (g) {
      html += '<div class="search-group"><p class="search-group-label">' + U.esc(g.label) +
        ' <span class="filter-count">' + g.total + '</span></p><div class="check-list">';
      g.hits.forEach(function (hit) {
        var key = g.route + '|' + hit.id;
        found[key] = { route: g.route, item: hit.item };
        html += '<button class="check-row search-hit" data-hit="' + U.esc(key) + '">' +
          '<span class="check-main"><span class="check-title">' + U.esc(hit.title) + '</span>' +
          '<span class="check-meta"><span>' + U.esc(g.label) + '</span></span></span></button>';
      });
      html += '</div></div>';
    });
    return html;
  }

  function open(initial) {
    var inputId = U.uid('gs');
    UI.openModal({
      title: t('search.title'),
      subtitle: t('search.shortcut'),
      bodyHTML: '<div class="field" style="margin-bottom:10px">' +
        '<label class="sr-only" for="' + inputId + '">' + U.esc(t('search.placeholder')) + '</label>' +
        '<input type="text" id="' + inputId + '" autocomplete="off" placeholder="' +
        U.esc(t('search.placeholder')) + '" value="' + U.esc(initial || '') + '"></div>' +
        '<div data-results>' + resultsHTML(initial || '') + '</div>',
      footHTML: '<button class="btn" data-role="close">' + U.esc(t('common.close')) + '</button>',
      onMount: function (node, close) {
        var input = node.querySelector('#' + inputId);
        var results = node.querySelector('[data-results]');

        input.addEventListener('input', function () {
          results.innerHTML = resultsHTML(input.value);
        });

        node.addEventListener('click', function (e) {
          var closeBtn = e.target.closest ? e.target.closest('[data-role="close"]') : null;
          if (closeBtn) { close(); return; }

          var hit = e.target.closest ? e.target.closest('[data-hit]') : null;
          if (!hit) return;
          var entry = found[hit.getAttribute('data-hit')];
          if (!entry) return;
          close();
          window.location.hash = '#/' + entry.route;
          /* Let the route render before the item's form opens on top of it. */
          window.setTimeout(function () {
            var opener = OPENERS[entry.route];
            if (opener) {
              try { opener(entry.item); } catch (err) { /* view may not offer a form */ }
            }
          }, 60);
        });

        input.focus();
        input.select();
      }
    });
  }

  W.Search = { open: open };
})(window.WCC);
