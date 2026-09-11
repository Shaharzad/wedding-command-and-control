/* Contacts — the people you actually ring, with tap-to-call numbers. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, t = W.t;

  var filter = 'all';
  var query = '';

  function filters() {
    return [{ key: 'all', label: t('contacts.filter.all') }].concat(
      W.OPT.contactRole.map(function (r) { return { key: r, label: r }; })
    );
  }

  function matchesFilter(c, key) {
    return key === 'all' ? true : c.role === key;
  }

  function matchesQuery(c, q) {
    if (!q) return true;
    return (c.name + ' ' + c.role + ' ' + c.relation + ' ' + c.phone + ' ' +
      c.email + ' ' + c.notes).toLowerCase().indexOf(q) >= 0;
  }

  function visible() {
    var q = query.trim().toLowerCase();
    return S.state.contacts.filter(function (c) {
      return matchesFilter(c, filter) && matchesQuery(c, q);
    }).sort(function (a, b) {
      if (a.role !== b.role) return a.role < b.role ? -1 : 1;
      return a.name < b.name ? -1 : 1;
    });
  }

  /* --------------------------------------------------------------- form -- */

  function openForm(contact) {
    var editing = !!contact;
    var values = contact ? U.clone(contact) : {
      name: '', role: 'Family', relation: '', phone: '', email: '', notes: ''
    };

    UI.form({
      title: editing ? t('contacts.edit') : t('contacts.add'),
      values: values,
      submitLabel: editing ? t('common.saveChanges') : t('common.add'),
      fields: [
        [
          { name: 'name', label: t('contacts.name'), type: 'text', required: true, placeholder: t('ph.rukhsanaSiddiqui') },
          { name: 'role', label: t('contacts.role'), type: 'select', options: W.OPT.contactRole, required: true }
        ],
        { name: 'relation', label: t('contacts.relation'), type: 'text', placeholder: t('ph.bridesMother') },
        [
          { name: 'phone', label: t('contacts.phone'), type: 'tel', placeholder: t('ph.eg03001234567') },
          { name: 'email', label: t('contacts.email'), type: 'email' }
        ],
        { name: 'notes', label: t('common.notes'), type: 'textarea' }
      ],
      onSubmit: function (vals) {
        if (editing) {
          S.contacts.update(contact.id, vals);
          UI.toast(t('common.updated', { name: vals.name }), 'good');
        } else {
          S.contacts.add(vals);
          UI.toast(t('common.added', { name: vals.name }), 'good');
        }
        return true;
      }
    });
  }

  /* --------------------------------------------------------------- view -- */

  function cardHTML(c) {
    var tel = c.phone ? c.phone.replace(/\s+/g, '') : '';
    return '<div class="event-card">' +
      '<div class="event-top">' +
      '<div class="event-type">' + U.esc(c.role) + '</div>' +
      '<h3>' + U.esc(c.name) + '</h3>' +
      (c.relation ? '<div class="event-when">' + U.esc(c.relation) + '</div>' : '') +
      '</div>' +
      '<div class="event-body">' +
      (c.phone
        ? '<p><a class="btn btn-sm btn-emerald" href="tel:' + U.esc(tel) + '" ' +
          'aria-label="' + U.esc(t('contacts.call', { name: c.name })) + '">' + U.esc(c.phone) + '</a></p>'
        : '<p class="t-sub">' + U.esc(t('contacts.noPhone')) + '</p>') +
      (c.email ? '<p><a href="mailto:' + U.esc(c.email) + '">' + U.esc(c.email) + '</a></p>' : '') +
      (c.notes ? '<p>' + U.esc(c.notes) + '</p>' : '') +
      '</div>' +
      '<div class="event-foot">' +
      '<button class="icon-btn" data-act="edit" data-id="' + U.esc(c.id) + '">' + U.esc(t('common.edit')) + '</button>' +
      '<button class="icon-btn danger" data-act="delete" data-id="' + U.esc(c.id) + '">' + U.esc(t('common.delete')) + '</button>' +
      '</div></div>';
  }

  W.Views.contacts = {
    title: t('contacts.title'),
    openForm: openForm,

    render: function (root) {
      var all = S.state.contacts;
      var list = visible();

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('contacts.title')) + '</h2>' +
        '<p class="section-note">' + U.esc(t('contacts.fromVendors')) + '</p>' +
        '<button class="btn btn-primary" data-act="add">' + U.esc(t('contacts.add')) + '</button>' +
        '</div>';

      if (!all.length) {
        html += UI.emptyHTML({
          title: t('contacts.empty'),
          body: t('contacts.emptyBody'),
          actionLabel: t('contacts.add'),
          actionAttr: 'data-act="add"'
        });
        html += '</div>';
        root.innerHTML = html;
        wire(root);
        return;
      }

      html += '<div class="filters">';
      filters().forEach(function (f) {
        var n = all.filter(function (x) { return matchesFilter(x, f.key); }).length;
        if (!n && f.key !== 'all') return;
        html += '<button class="filter-btn" data-act="filter" data-key="' + U.esc(f.key) + '" aria-pressed="' +
          (filter === f.key ? 'true' : 'false') + '">' + U.esc(f.label) +
          ' <span class="filter-count">' + n + '</span></button>';
      });
      html += '<span class="spacer"></span><span class="search-wrap">' +
        '<label class="sr-only" for="contactSearch">' + U.esc(t('contacts.searchPh')) + '</label>' +
        '<input class="search-input" id="contactSearch" type="text" data-act="search" data-fk="contactSearch" ' +
        'placeholder="' + U.esc(t('contacts.searchPh')) + '" value="' + U.esc(query) + '"></span></div>';

      if (!list.length) {
        html += UI.emptyHTML({
          title: t('common.noMatches'),
          body: t('common.noMatchesHint'),
          actionLabel: t('common.clearFilters'),
          actionAttr: 'data-act="clear"'
        });
      } else {
        html += '<div class="grid grid-cards">' + list.map(cardHTML).join('') + '</div>' +
          '<p class="section-note">' + U.esc(t('common.showing', { shown: list.length, total: all.length })) + '</p>';
      }
      html += '</div>';

      root.innerHTML = html;
      wire(root);
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
        openForm(S.contacts.get(id));
      } else if (act === 'filter') {
        filter = btn.getAttribute('data-key');
        W.App.rerender();
      } else if (act === 'clear') {
        filter = 'all'; query = '';
        W.App.rerender();
      } else if (act === 'delete') {
        var c = S.contacts.get(id);
        if (!c) return;
        UI.confirmDelete(c.name, function () {
          S.contacts.remove(id);
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
