/* Modals, forms, confirmations, toasts and the shared bits of markup.
   Every add and edit goes through a real labelled form — nobody ever edits JSON. */
window.WCC = window.WCC || {};

(function (W) {
  'use strict';

  var U = W.Util;
  var t = W.t;
  var UI = {};

  /* -------------------------------------------------------------- toast -- */

  /* action (optional): {label, onClick, onExpire} — adds a button to the toast. */
  UI.toast = function (message, kind, action) {
    var stack = document.getElementById('toastStack');
    if (!stack) return;
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '') + (action ? ' has-action' : '');
    var text = document.createElement('span');
    text.textContent = message;
    el.appendChild(text);

    var done = false;
    function finish(ranAction) {
      if (done) return;
      done = true;
      if (el.parentNode) el.parentNode.removeChild(el);
      if (action && action.onExpire && !ranAction) action.onExpire();
    }

    if (action) {
      var btn = document.createElement('button');
      btn.className = 'toast-action';
      btn.type = 'button';
      btn.textContent = action.label;
      btn.addEventListener('click', function () {
        finish(true);
        action.onClick();
      });
      el.appendChild(btn);
    }

    stack.appendChild(el);
    setTimeout(function () { finish(false); }, action ? 8000 : 3200);
  };

  /* ------------------------------------------------------------- markup -- */

  UI.medallion = function () {
    return '<svg class="empty-medallion" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<g fill="none" stroke="currentColor" stroke-width="1.3">' +
      '<rect x="22" y="22" width="56" height="56"/>' +
      '<rect x="22" y="22" width="56" height="56" transform="rotate(45 50 50)"/>' +
      '<circle cx="50" cy="50" r="20"/>' +
      '<circle cx="50" cy="50" r="10"/>' +
      '<path d="M50 30 60 50 50 70 40 50Z"/>' +
      '<path d="M30 50 50 40 70 50 50 60Z"/>' +
      '</g></svg>';
  };

  UI.emptyHTML = function (opts) {
    var btn = '';
    if (opts.actionLabel) {
      btn = '<button class="btn btn-primary" ' + (opts.actionAttr || '') + '>' + U.esc(opts.actionLabel) + '</button>';
    }
    return '<div class="empty">' + UI.medallion() +
      '<h3>' + U.esc(opts.title) + '</h3>' +
      '<p>' + U.esc(opts.body) + '</p>' + btn + '</div>';
  };

  UI.tick = function () {
    return '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<path d="M2.5 8.5 6 12l7.5-8" fill="none" stroke="currentColor" stroke-width="2.4" ' +
      'stroke-linecap="round" stroke-linejoin="round"/></svg>';
  };

  UI.checkbox = function (opts) {
    return '<button type="button" class="check-box" aria-pressed="' + (opts.done ? 'true' : 'false') +
      '" aria-label="' + U.esc(opts.label) + '" ' + (opts.attrs || '') + '>' + UI.tick() + '</button>';
  };

  UI.chip = function (text, kind) {
    return '<span class="chip' + (kind ? ' chip-' + kind : '') + '">' + U.esc(text) + '</span>';
  };

  UI.progressBar = function (label, done, total) {
    var pct = U.pct(done, total);
    return '<div class="progress-line"><span>' + U.esc(label) + '</span><b>' + pct + '%</b></div>' +
      '<div class="track"><span style="width:' + pct + '%"></span></div>';
  };

  /* -------------------------------------------------------------- modal -- */

  var openStack = [];

  function focusables(root) {
    var sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.filter.call(root.querySelectorAll(sel), function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  function closeTop() {
    var top = openStack.pop();
    if (!top) return;
    var root = document.getElementById('modalRoot');
    if (top.node && top.node.parentNode) top.node.parentNode.removeChild(top.node);
    if (top.backdrop && top.backdrop.parentNode) top.backdrop.parentNode.removeChild(top.backdrop);
    if (!openStack.length) root.hidden = true;
    document.removeEventListener('keydown', top.keyHandler, true);
    if (top.returnFocus && top.returnFocus.focus) {
      try { top.returnFocus.focus(); } catch (e) { /* element may be gone after a re-render */ }
    }
    if (top.onClose) top.onClose();
  }

  /* opts: {title, subtitle, bodyHTML, footHTML, small, onMount(node, close), onClose} */
  UI.openModal = function (opts) {
    var root = document.getElementById('modalRoot');
    root.hidden = false;

    var dismissible = opts.dismissible !== false;
    var backdrop = document.createElement('button');
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('aria-label', dismissible ? t('common.close') : t('app.title'));
    backdrop.tabIndex = dismissible ? 0 : -1;
    if (dismissible) backdrop.addEventListener('click', function () { closeTop(); });

    var node = document.createElement('div');
    node.className = 'modal' + (opts.small ? ' modal-sm' : '');
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    var titleId = U.uid('mt');
    node.setAttribute('aria-labelledby', titleId);
    node.innerHTML =
      '<div class="modal-head"><h2 id="' + titleId + '">' + U.esc(opts.title) + '</h2>' +
      (opts.subtitle ? '<p>' + U.esc(opts.subtitle) + '</p>' : '') + '</div>' +
      '<div class="modal-body">' + (opts.bodyHTML || '') + '</div>' +
      '<div class="modal-foot">' + (opts.footHTML || '') + '</div>';

    var entry = {
      node: node,
      backdrop: backdrop,
      returnFocus: document.activeElement,
      onClose: opts.onClose
    };

    entry.keyHandler = function (e) {
      if (openStack[openStack.length - 1] !== entry) return;
      if (e.key === 'Escape' && dismissible) { e.preventDefault(); closeTop(); return; }
      if (e.key === 'Tab') {
        var items = focusables(node);
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', entry.keyHandler, true);

    root.appendChild(backdrop);
    root.appendChild(node);
    openStack.push(entry);

    if (opts.onMount) opts.onMount(node, closeTop);

    var firstField = node.querySelector('input, select, textarea, button.btn-primary, button');
    if (firstField) firstField.focus();

    return { node: node, close: closeTop };
  };

  /* ------------------------------------------------------------ confirm -- */

  /* opts: {title, body, confirmLabel, danger, requireText, requireLabel, mismatchMessage, onConfirm} */
  UI.confirm = function (opts) {
    var inputId = U.uid('cf');
    var body = '<p>' + U.esc(opts.body || '') + '</p>';
    if (opts.requireText) {
      body += '<div class="field"><label for="' + inputId + '">' +
        U.esc(opts.requireLabel || ('Type ' + opts.requireText + ' to confirm')) + '</label>' +
        '<input type="text" id="' + inputId + '" autocomplete="off"><p class="err" hidden></p></div>';
    }
    var foot = '<button class="btn" data-role="cancel">' + U.esc(t('common.cancel')) + '</button>' +
      '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-role="ok">' +
      U.esc(opts.confirmLabel || t('common.yes')) + '</button>';

    UI.openModal({
      title: opts.title,
      bodyHTML: body,
      footHTML: foot,
      small: true,
      onClose: opts.onClose,
      onMount: function (node, close) {
        node.querySelector('[data-role="cancel"]').addEventListener('click', close);
        node.querySelector('[data-role="ok"]').addEventListener('click', function () {
          if (opts.requireText) {
            var input = node.querySelector('#' + inputId);
            var err = node.querySelector('.err');
            if (input.value.trim() !== opts.requireText) {
              err.textContent = opts.mismatchMessage || 'That does not match';
              err.hidden = false;
              input.focus();
              return;
            }
          }
          close();
          if (opts.onConfirm) opts.onConfirm();
        });
      }
    });
  };

  /* --------------------------------------------------------------- form -- */

  function optionList(options, value) {
    var html = '';
    (options || []).forEach(function (o) {
      var val = typeof o === 'string' ? o : o.value;
      var label = typeof o === 'string' ? o : o.label;
      html += '<option value="' + U.esc(val) + '"' + (String(val) === String(value) ? ' selected' : '') + '>' +
        U.esc(label) + '</option>';
    });
    return html;
  }

  function fieldHTML(f, values) {
    var id = 'f_' + f.name + '_' + Math.random().toString(36).slice(2, 6);
    f.__id = id;
    var v = values && values[f.name] !== undefined ? values[f.name] : (f.value !== undefined ? f.value : '');
    var labelText = U.esc(f.label) + (f.required ? ' <span class="req" aria-hidden="true">*</span>' : '');
    var control = '';

    if (f.type === 'textarea') {
      control = '<textarea id="' + id + '" name="' + f.name + '"' +
        (f.placeholder ? ' placeholder="' + U.esc(f.placeholder) + '"' : '') +
        (f.required ? ' required' : '') + '>' + U.esc(v) + '</textarea>';
    } else if (f.type === 'select') {
      control = '<select id="' + id + '" name="' + f.name + '"' + (f.required ? ' required' : '') + '>' +
        (f.allowEmpty ? '<option value=""' + (v ? '' : ' selected') + '>' +
          U.esc(f.emptyLabel || t('common.none')) + '</option>' : '') +
        optionList(f.options, v) + '</select>';
    } else if (f.type === 'member') {
      /* Only meaningful on a shared wedding; elsewhere the free-text name
         field next to it does the job. */
      var people = W.Cloud.people();
      control = '<select id="' + id + '" name="' + f.name + '">' +
        '<option value=""' + (v ? '' : ' selected') + '>' +
        U.esc(f.emptyLabel || t('assign.nobody')) + '</option>' +
        people.map(function (p) {
          return '<option value="' + U.esc(p.id) + '"' +
            (String(p.id) === String(v) ? ' selected' : '') + '>' +
            U.esc(p.name || t('members.someone')) + '</option>';
        }).join('') + '</select>';
    } else if (f.type === 'checkgroup') {
      var chosen = Array.isArray(v) ? v : [];
      if (!f.options || !f.options.length) {
        control = '<p class="hint">' + U.esc(f.emptyText || t('common.none')) + '</p>';
      } else {
        control = '<div class="checkgroup" role="group" aria-labelledby="' + id + '_lbl">';
        f.options.forEach(function (o, i) {
          var val = typeof o === 'string' ? o : o.value;
          var label = typeof o === 'string' ? o : o.label;
          var cid = id + '_' + i;
          control += '<label for="' + cid + '"><input type="checkbox" id="' + cid + '" name="' + f.name +
            '" value="' + U.esc(val) + '"' + (chosen.indexOf(val) >= 0 ? ' checked' : '') + '>' +
            U.esc(label) + '</label>';
        });
        control += '</div>';
      }
    } else {
      var type = f.type || 'text';
      control = '<input type="' + type + '" id="' + id + '" name="' + f.name + '" value="' + U.esc(v) + '"' +
        (f.placeholder ? ' placeholder="' + U.esc(f.placeholder) + '"' : '') +
        (f.min !== undefined ? ' min="' + f.min + '"' : '') +
        (f.max !== undefined ? ' max="' + f.max + '"' : '') +
        (f.step !== undefined ? ' step="' + f.step + '"' : '') +
        (f.required ? ' required' : '') +
        (type === 'text' || type === 'tel' ? ' autocomplete="off"' : '') + '>';
    }

    var labelTag = f.type === 'checkgroup'
      ? '<span class="field-label" id="' + id + '_lbl">' + labelText + '</span>'
      : '<label for="' + id + '">' + labelText + '</label>';

    return '<div class="field" data-field="' + f.name + '">' + labelTag + control +
      (f.hint ? '<p class="hint">' + U.esc(f.hint) + '</p>' : '') +
      '<p class="err" hidden></p></div>';
  }

  function readField(node, f) {
    if (f.type === 'checkgroup') {
      var boxes = node.querySelectorAll('input[name="' + f.name + '"]:checked');
      return Array.prototype.map.call(boxes, function (b) { return b.value; });
    }
    var el = node.querySelector('[name="' + f.name + '"]');
    if (!el) return '';
    if (f.type === 'number') {
      return el.value === '' ? '' : Number(el.value);
    }
    return el.value.trim ? el.value.trim() : el.value;
  }

  function validate(f, value) {
    if (f.required) {
      if (value === '' || value === null || value === undefined ||
        (Array.isArray(value) && !value.length)) {
        return t('common.fieldRequired');
      }
    }
    if (f.type === 'number' && value !== '') {
      if (typeof value !== 'number' || !isFinite(value)) return t('common.fieldNumber');
      if (f.min !== undefined && value < f.min) return t('common.fieldNumber');
    }
    if (f.type === 'date' && value) {
      if (!U.isValidISODate(value)) return t('common.fieldDate');
    }
    if (f.validate) return f.validate(value) || null;
    return null;
  }

  /* opts: {title, subtitle, fields (flat, or nested arrays for a two-up row),
            values, submitLabel, onSubmit(values) -> true|{errors} } */
  UI.form = function (opts) {
    var flat = [];
    var body = '';
    (opts.fields || []).forEach(function (item) {
      if (Array.isArray(item)) {
        body += '<div class="field-row">';
        item.forEach(function (f) { flat.push(f); body += fieldHTML(f, opts.values); });
        body += '</div>';
      } else {
        flat.push(item);
        body += fieldHTML(item, opts.values);
      }
    });
    if (opts.noteHTML) body = opts.noteHTML + body;

    var foot = '<button type="button" class="btn" data-role="cancel">' + U.esc(t('common.cancel')) + '</button>' +
      '<button type="submit" class="btn btn-primary" data-role="submit">' +
      U.esc(opts.submitLabel || t('common.save')) + '</button>';

    UI.openModal({
      title: opts.title,
      subtitle: opts.subtitle,
      bodyHTML: '<form id="modalForm" novalidate>' + body + '</form>',
      footHTML: foot,
      onMount: function (node, close) {
        var form = node.querySelector('#modalForm');

        function submit() {
          var values = {}, errors = {}, firstBad = null;
          flat.forEach(function (f) {
            var val = readField(node, f);
            values[f.name] = val;
            var err = validate(f, val);
            if (err) { errors[f.name] = err; if (!firstBad) firstBad = f; }
          });

          function paint(errs) {
            flat.forEach(function (f) {
              var wrap = node.querySelector('[data-field="' + f.name + '"]');
              if (!wrap) return;
              var p = wrap.querySelector('.err');
              if (errs[f.name]) {
                wrap.classList.add('invalid');
                p.textContent = errs[f.name];
                p.hidden = false;
              } else {
                wrap.classList.remove('invalid');
                p.hidden = true;
              }
            });
          }

          if (Object.keys(errors).length) {
            paint(errors);
            var bad = node.querySelector('[data-field="' + firstBad.name + '"] input, [data-field="' +
              firstBad.name + '"] select, [data-field="' + firstBad.name + '"] textarea');
            if (bad) bad.focus();
            return;
          }

          var result = opts.onSubmit ? opts.onSubmit(values) : true;
          if (result && result.errors) { paint(result.errors); return; }
          close();
        }

        form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
        node.querySelector('[data-role="submit"]').addEventListener('click', submit);
        node.querySelector('[data-role="cancel"]').addEventListener('click', close);
      }
    });
  };

  /* ------------------------------------------------------------ helpers -- */

  /* Every delete goes through here, so every delete gets the same undo offer. */
  UI.confirmDelete = function (name, onConfirm) {
    UI.confirm({
      title: t('common.deleteConfirm', { name: name }),
      body: t('common.deleteWarn'),
      confirmLabel: t('common.delete'),
      danger: true,
      onConfirm: function () {
        onConfirm();
        var gone = t('common.deleted', { name: name });
        if (!W.Store.canUndo()) {
          UI.toast(gone);
          return;
        }
        UI.toast(gone, null, {
          label: t('common.undo'),
          onClick: function () {
            if (W.Store.undo()) UI.toast(t('common.undone', { name: name }), 'good');
            else UI.toast(t('common.undoFailed'), 'bad');
          },
          /* Offer expires with the toast so it cannot reach back too far. */
          onExpire: function () { W.Store.clearUndo(); }
        });
      }
    });
  };

  /* opts: {tracked, categories} — a tracker's own estimate beside the budget. */
  UI.reconcileCard = function (opts) {
    var S = W.Store, U2 = W.Util;
    var b = S.budgetFor(opts.categories);
    var gap = opts.tracked - b.planned;

    var verdict;
    if (!b.lines) verdict = '<p class="card-sub">' + U2.esc(t('recon.noLines')) + '</p>';
    else if (gap > 0) {
      verdict = '<p class="card-sub t-over">\u26a0 ' +
        U2.esc(t('recon.over', { amt: U2.fmtMoney(gap) })) + '</p>';
    } else if (gap < 0) {
      verdict = '<p class="card-sub">' + U2.esc(t('recon.under', { amt: U2.fmtMoney(-gap) })) + '</p>';
    } else {
      verdict = '<p class="card-sub">' + U2.esc(t('recon.level')) + '</p>';
    }

    return '<div class="card"><div class="card-head"><h3>' + U2.esc(t('recon.title')) + '</h3></div>' +
      '<div class="recon">' +
      '<div><p class="kpi-label">' + U2.esc(t('recon.tracked')) + '</p>' +
      '<p class="card-lead">' + U2.esc(U2.fmtMoney(opts.tracked)) + '</p></div>' +
      '<div><p class="kpi-label">' + U2.esc(t('recon.planned')) + '</p>' +
      '<p class="card-lead">' + U2.esc(U2.fmtMoney(b.planned)) + '</p></div>' +
      '<div><p class="kpi-label">' + U2.esc(t('recon.spent')) + '</p>' +
      '<p class="card-lead">' + U2.esc(U2.fmtMoney(b.actual)) + '</p></div>' +
      '</div>' + verdict +
      '<p class="card-sub">' + U2.esc(t('recon.lines', { list: opts.categories.join(', ') })) + '</p>' +
      '<p class="card-sub">' + U2.esc(t('recon.note')) + '</p>' +
      '<div style="margin-top:12px"><button class="btn btn-sm" data-act="goto-budget">' +
      U2.esc(t('nav.budget')) + '</button></div></div>';
  };

  UI.priorityChip = function (p) {
    var kind = p === 'High' ? 'maroon' : (p === 'Low' ? '' : 'gold');
    return UI.chip(p, kind);
  };

  var CHIP_EMERALD = ['Completed', 'Paid', 'Confirmed', 'Attending', 'Done', 'Ready', 'Bought'];
  var CHIP_GOLD = ['In Progress', 'Partially Paid', 'Planning', 'Maybe', 'Ordered', 'Agreed',
    'Booked', 'Accepted', 'Received', 'At Tailor', 'Alterations', 'Quoted', 'Contacted', 'Delivered', 'Sent'];
  var CHIP_DANGER = ['Cancelled', 'Not Attending'];

  UI.statusChip = function (s) {
    var kind = CHIP_EMERALD.indexOf(s) >= 0 ? 'emerald'
      : (CHIP_GOLD.indexOf(s) >= 0 ? 'gold'
        : (CHIP_DANGER.indexOf(s) >= 0 ? 'danger' : ''));
    return UI.chip(s, kind);
  };

  W.UI = UI;
})(window.WCC);
