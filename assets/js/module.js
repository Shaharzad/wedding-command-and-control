/* A list module: KPI tiles, charts, filters, search, a table and a modal form.
   Six of the Phase 3 trackers are the same shape, so they are declared rather
   than written out six times. Anything bespoke still writes its own view. */
window.WCC = window.WCC || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, Charts = W.Charts, t = W.t;

  function eventOptions() {
    return S.eventsSorted().map(function (e) {
      return { value: e.id, label: e.name + (e.date ? ' — ' + U.fmtDate(e.date, 'short') : '') };
    });
  }

  /* cfg — see the modules in views/ for worked examples. */
  function list(cfg) {
    var filter = 'all';
    var query = '';

    function matchesFilter(item, key) {
      if (key === 'all') return true;
      var f = null;
      (cfg.filters || []).forEach(function (x) { if (x.key === key) f = x; });
      return f ? f.test(item) : true;
    }

    function matchesQuery(item, q) {
      if (!q) return true;
      var hay = (cfg.searchFields || []).map(function (f) {
        var v = item[f];
        return v === undefined || v === null ? '' : String(v);
      }).join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    }

    function visible() {
      var q = query.trim().toLowerCase();
      var out = cfg.crud.all().filter(function (item) {
        return matchesFilter(item, filter) && matchesQuery(item, q);
      });
      return cfg.sort ? out.sort(cfg.sort) : out;
    }

    function openForm(item) {
      var editing = !!item;
      var values = item ? U.clone(item) : U.clone(cfg.defaults);
      /* Stored shapes that the form cannot hold directly — a boolean behind a
         yes/no select, say — are mapped here and back in beforeSubmit. */
      if (cfg.toForm) cfg.toForm(values);
      UI.form({
        title: editing ? cfg.editLabel : cfg.addLabel,
        subtitle: cfg.formSubtitle,
        values: values,
        submitLabel: editing ? t('common.saveChanges') : t('common.add'),
        fields: cfg.fields(item),
        onSubmit: function (vals) {
          if (cfg.beforeSubmit) cfg.beforeSubmit(vals);
          var saved = editing ? cfg.crud.update(item.id, vals) : cfg.crud.add(vals);
          var name = saved ? String(saved[cfg.nameField] || '') : '';
          UI.toast(t(editing ? 'common.updated' : 'common.added', { name: name }), 'good');
          return true;
        }
      });
    }

    function kpiHTML(k) {
      return '<div class="kpi' + (k.accent ? ' accent-' + k.accent : '') + '">' +
        '<p class="kpi-label">' + U.esc(k.label) + '</p>' +
        '<p class="kpi-value' + (k.money ? ' money' : '') + '">' + U.esc(k.value) + '</p>' +
        (k.foot ? '<p class="kpi-foot' + (k.warn ? ' warn' : '') + '">' + U.esc(k.foot) + '</p>' : '') +
        '</div>';
    }

    function render(root) {
      var all = cfg.crud.all();
      var rows = visible();

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(cfg.title) + '</h2>' +
        (cfg.headNote ? '<p class="section-note">' + U.esc(cfg.headNote) + '</p>' : '') +
        (cfg.extraButtons || '') +
        '<button class="btn btn-primary" data-act="add">' + U.esc(cfg.addLabel) + '</button>' +
        '</div>';

      if (cfg.topHTML) html += cfg.topHTML();

      if (!all.length) {
        html += UI.emptyHTML({
          title: cfg.empty.title,
          body: cfg.empty.body,
          actionLabel: cfg.addLabel,
          actionAttr: 'data-act="add"'
        });
        html += '</div>';
        root.innerHTML = html;
        wire(root);
        if (cfg.afterRender) cfg.afterRender(root);
        return;
      }

      var kpis = cfg.kpis ? cfg.kpis() : [];
      if (kpis.length) {
        html += '<div class="grid grid-kpi">' + kpis.map(kpiHTML).join('') + '</div>';
      }
      html += '</div>';

      var charts = cfg.charts ? cfg.charts() : [];
      if (charts.length || cfg.noteHTML) {
        html += '<div class="section"><div class="grid grid-2">';
        charts.forEach(function (c, i) {
          html += '<div class="card card-chart"><div class="card-head"><h3>' + U.esc(c.title) + '</h3></div>' +
            (c.sub ? '<p class="card-sub">' + U.esc(c.sub) + '</p>' : '') +
            '<div data-modchart="' + i + '" style="margin-top:10px"></div></div>';
        });
        if (cfg.noteHTML) {
          html += (typeof cfg.noteHTML === 'function') ? cfg.noteHTML() : cfg.noteHTML;
        }
        html += '</div></div>';
      }

      html += '<div class="section"><div class="filters">';
      var filters = [{ key: 'all', label: t('common.all') }].concat(cfg.filters || []);
      filters.forEach(function (f) {
        var n = all.filter(function (x) { return matchesFilter(x, f.key); }).length;
        html += '<button class="filter-btn" data-act="filter" data-key="' + U.esc(f.key) + '" aria-pressed="' +
          (filter === f.key ? 'true' : 'false') + '">' + U.esc(f.label) +
          ' <span class="filter-count">' + n + '</span></button>';
      });
      var searchId = cfg.key + 'Search';
      var searchPh = t('mod.searchPh', { what: cfg.what });
      html += '<span class="spacer"></span><span class="search-wrap">' +
        '<label class="sr-only" for="' + searchId + '">' + U.esc(searchPh) + '</label>' +
        '<input class="search-input" id="' + searchId + '" type="text" data-act="search" data-fk="' + searchId + '" ' +
        'placeholder="' + U.esc(searchPh) + '" value="' + U.esc(query) + '"></span></div>';

      if (!rows.length) {
        html += UI.emptyHTML({
          title: t('common.noMatches'),
          body: t('common.noMatchesHint'),
          actionLabel: t('common.clearFilters'),
          actionAttr: 'data-act="clear"'
        });
      } else {
        html += '<div class="table-wrap"><table><caption class="sr-only">' + U.esc(cfg.title) +
          '</caption><thead><tr>';
        if (cfg.toggle) {
          html += '<th scope="col"><span class="sr-only">' + U.esc(t('common.done')) + '</span></th>';
        }
        cfg.columns.forEach(function (c) {
          html += '<th scope="col"' + (c.num ? ' class="num"' : '') + '>' + U.esc(c.label) + '</th>';
        });
        html += '<th scope="col"><span class="sr-only">' + U.esc(t('common.actions')) + '</span></th>' +
          '</tr></thead><tbody>';

        rows.forEach(function (item) {
          var done = cfg.toggle ? !!item[cfg.toggle.field] : false;
          html += '<tr' + (done ? ' class="is-done"' : '') + '>';
          if (cfg.toggle) {
            html += '<td>' + UI.checkbox({
              done: done,
              label: cfg.toggle.label(item, done),
              attrs: 'data-act="toggle" data-id="' + U.esc(item.id) + '" data-fk="chk_' + U.esc(item.id) + '"'
            }) + '</td>';
          }
          cfg.columns.forEach(function (c) {
            html += '<td' + (c.num ? ' class="num"' : '') + '>' + c.render(item) + '</td>';
          });
          html += '<td class="actions">' +
            (cfg.discuss ? W.Comments.button(cfg.discuss, item.id, item[cfg.nameField]) : '') +
            '<button class="icon-btn" data-act="edit" data-id="' + U.esc(item.id) + '">' +
            U.esc(t('common.edit')) + '</button>' +
            '<button class="icon-btn danger" data-act="delete" data-id="' + U.esc(item.id) + '">' +
            U.esc(t('common.delete')) + '</button></td></tr>';
        });

        html += '</tbody>' + (cfg.footer ? cfg.footer(rows) : '') + '</table></div>' +
          '<p class="section-note">' + U.esc(t('common.showing', { shown: rows.length, total: all.length })) + '</p>';
      }
      html += '</div>';

      root.innerHTML = html;

      charts.forEach(function (c, i) {
        Charts.render(root.querySelector('[data-modchart="' + i + '"]'), c.spec);
      });

      wire(root);
      if (cfg.discuss) W.Comments.wire(root);
      if (cfg.afterRender) cfg.afterRender(root);
    }

    function wire(root) {
      root.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!btn) return;
        var act = btn.getAttribute('data-act');
        var id = btn.getAttribute('data-id');

        if (act === 'add') {
          openForm(null);
        } else if (act === 'edit') {
          openForm(cfg.crud.get(id));
        } else if (act === 'toggle' && cfg.toggle) {
          var item = cfg.crud.get(id);
          if (!item) return;
          var patch = {};
          patch[cfg.toggle.field] = !item[cfg.toggle.field];
          if (cfg.toggle.onSet) cfg.toggle.onSet(patch, !item[cfg.toggle.field], item);
          cfg.crud.update(id, patch);
        } else if (act === 'filter') {
          filter = btn.getAttribute('data-key');
          W.App.rerender();
        } else if (act === 'clear') {
          filter = 'all'; query = '';
          W.App.rerender();
        } else if (act === 'delete') {
          var target = cfg.crud.get(id);
          if (!target) return;
          var name = String(target[cfg.nameField] || '');
          UI.confirmDelete(name, function () {
            cfg.crud.remove(id);
          });
        } else if (cfg.onAction) {
          cfg.onAction(act, id, btn);
        }
      });

      root.addEventListener('input', function (e) {
        if (e.target.getAttribute && e.target.getAttribute('data-act') === 'search') {
          query = e.target.value;
          W.App.rerender();
        }
      });
    }

    return {
      title: cfg.title,
      openForm: openForm,
      render: render,
      resetFilters: function () { filter = 'all'; query = ''; }
    };
  }

  /* Small shared cell renderers. */
  var Cell = {};
  Cell.text = function (field, subField) {
    return function (item) {
      return '<div class="t-title">' + U.esc(item[field]) + '</div>' +
        (subField && item[subField]
          ? '<div class="t-sub">' + U.esc(String(item[subField]).slice(0, 70)) + '</div>' : '');
    };
  };
  Cell.plain = function (field) {
    return function (item) {
      return item[field] ? U.esc(item[field]) : '<span class="t-sub">' + U.esc(t('common.na')) + '</span>';
    };
  };
  Cell.money = function (field) {
    return function (item) { return U.esc(U.fmtMoney(item[field])); };
  };
  Cell.date = function (field) {
    return function (item) {
      return item[field] ? U.esc(U.fmtDate(item[field], 'medium'))
        : '<span class="t-sub">' + U.esc(t('common.na')) + '</span>';
    };
  };
  Cell.chip = function (field, kindFor) {
    return function (item) {
      return UI.chip(item[field], kindFor ? kindFor(item[field], item) : '');
    };
  };
  Cell.event = function (field) {
    return function (item) {
      var name = S.eventName(item[field]);
      return name ? U.esc(name) : '<span class="t-sub">' + U.esc(t('vendors.allEvents')) + '</span>';
    };
  };

  W.Module = { list: list, Cell: Cell, eventOptions: eventOptions };
})(window.WCC);
