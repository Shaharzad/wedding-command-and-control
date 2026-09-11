/* Settings — the couple's details, and everything to do with the data itself:
   export, import, sample data and reset. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, t = W.t;

  /* --------------------------------------------------------- details -- */

  function openDetails() {
    var s = S.state.settings;
    UI.form({
      title: t('settings.couple'),
      subtitle: t('settings.coupleSub'),
      values: {
        brideName: s.brideName, groomName: s.groomName, weddingDate: s.weddingDate,
        venue: s.venue, hashtag: s.hashtag
      },
      submitLabel: t('common.saveChanges'),
      fields: [
        [
          { name: 'brideName', label: t('settings.bride'), type: 'text', placeholder: t('ph.sarah') },
          { name: 'groomName', label: t('settings.groom'), type: 'text', placeholder: t('ph.ahmed') }
        ],
        { name: 'weddingDate', label: t('settings.date'), type: 'date', hint: t('settings.dateHint') },
        { name: 'venue', label: t('settings.venue'), type: 'text', placeholder: t('ph.falettisGrandMarqueeLahore') },
        { name: 'hashtag', label: t('settings.hashtag'), type: 'text', placeholder: t('ph.sarahfoundherahmed'), hint: t('settings.hashtagHint') }
      ],
      onSubmit: function (vals) {
        S.saveSettings(vals);
        UI.toast(t('settings.saved'), 'good');
        return true;
      }
    });
  }

  /* ---------------------------------------------------------- export -- */

  function exportJSON() {
    var data = S.exportObject();
    var text = JSON.stringify(data, null, 2);
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var couple = U.slug(S.coupleName()) || 'wedding';
    var a = document.createElement('a');
    a.href = url;
    a.download = couple + '-planner-' + U.todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    S.markExported();
    UI.toast(t('settings.exported'), 'good');
  }

  /* ---------------------------------------------------------- import -- */

  function importJSON() {
    var input = document.getElementById('importFile');
    if (!input) return;
    input.value = '';
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onerror = function () { UI.toast(t('settings.importRead'), 'bad'); };
      reader.onload = function () {
        var raw = null;
        try {
          raw = JSON.parse(String(reader.result));
        } catch (err) {
          UI.toast(t('settings.importBad'), 'bad');
          return;
        }
        var check = S.validateImport(raw);
        if (!check.ok) {
          UI.toast(t('settings.importBad'), 'bad');
          return;
        }
        UI.confirm({
          title: t('settings.importConfirm'),
          body: t('settings.importBody', check.counts),
          confirmLabel: t('settings.importBtn'),
          onConfirm: function () {
            S.replaceAll(raw, 'import');
            UI.toast(t('settings.importOk'), 'good');
          }
        });
      };
      reader.readAsText(file);
    };
    input.click();
  }

  /* ----------------------------------------------------------- sample -- */

  function loadSample() {
    UI.confirm({
      title: t('settings.sampleLoadConfirm'),
      body: t('settings.sampleLoadBody'),
      confirmLabel: t('settings.sampleLoad'),
      danger: true,
      onConfirm: function () {
        S.replaceAll(W.Sample.build(), 'sample');
        UI.toast(t('onboard.loaded'), 'good');
      }
    });
  }

  function removeSample() {
    UI.confirm({
      title: t('settings.sampleRemove'),
      body: t('settings.resetSub'),
      confirmLabel: t('settings.sampleRemove'),
      danger: true,
      onConfirm: function () {
        S.reset();
        UI.toast(t('settings.sampleRemoved'));
      }
    });
  }

  function resetAll() {
    UI.confirm({
      title: t('settings.resetConfirm'),
      body: t('settings.resetBody'),
      confirmLabel: t('settings.resetBtn'),
      danger: true,
      requireText: 'RESET',
      requireLabel: t('settings.resetType'),
      mismatchMessage: t('settings.resetMismatch'),
      onConfirm: function () {
        S.reset();
        UI.toast(t('settings.resetDone'));
      }
    });
  }

  /* ------------------------------------------------------------- view -- */

  function detailRow(label, value) {
    return '<dt>' + U.esc(label) + '</dt><dd>' + (value ? U.esc(value) :
      '<span class="t-sub">' + U.esc(t('common.na')) + '</span>') + '</dd>';
  }

  W.Views.settings = {
    title: t('settings.title'),

    render: function (root) {
      var s = S.state.settings;
      var kb = Math.max(1, Math.round(S.storageBytes() / 1024));

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('settings.couple')) + '</h2>' +
        '<p class="section-note">' + U.esc(t('settings.coupleSub')) + '</p>' +
        '<button class="btn btn-primary" data-act="edit-details">' + U.esc(t('common.edit')) + '</button>' +
        '</div>' +
        '<div class="card"><div class="event-body" style="padding:0"><dl>' +
        detailRow(t('settings.bride'), s.brideName) +
        detailRow(t('settings.groom'), s.groomName) +
        detailRow(t('settings.date'), s.weddingDate ? U.fmtDate(s.weddingDate) : '') +
        detailRow(t('settings.venue'), s.venue) +
        detailRow(t('settings.hashtag'), s.hashtag) +
        '</dl></div></div></div>';

      html += '<div class="section"><div class="section-head"><h2>' + U.esc(t('settings.data')) + '</h2>' +
        '<p class="section-note">' + U.esc(t('settings.dataSub')) + '</p></div><div class="stack">';

      html += '<div class="card"><div class="data-row"><div>' +
        '<h3>' + U.esc(t('settings.export')) + '</h3><p>' + U.esc(t('settings.exportSub')) + '</p></div>' +
        '<button class="btn btn-emerald" data-act="export">' + U.esc(t('settings.exportBtn')) + '</button>' +
        '</div></div>';

      html += '<div class="card"><div class="data-row"><div>' +
        '<h3>' + U.esc(t('settings.import')) + '</h3><p>' + U.esc(t('settings.importSub')) + '</p></div>' +
        '<button class="btn" data-act="import">' + U.esc(t('settings.importBtn')) + '</button>' +
        '</div></div>';

      if (S.state.meta.seeded) {
        html += '<div class="card"><div class="data-row"><div>' +
          '<h3>' + U.esc(t('settings.sample')) + '</h3><p>' + U.esc(t('settings.sampleSub')) + '</p></div>' +
          '<button class="btn" data-act="remove-sample">' + U.esc(t('settings.sampleRemove')) + '</button>' +
          '</div></div>';
      } else {
        html += '<div class="card"><div class="data-row"><div>' +
          '<h3>' + U.esc(t('settings.sampleLoad')) + '</h3><p>' + U.esc(t('settings.sampleLoadSub')) + '</p></div>' +
          '<button class="btn" data-act="load-sample">' + U.esc(t('settings.sampleLoad')) + '</button>' +
          '</div></div>';
      }

      html += '<div class="card"><div class="data-row"><div>' +
        '<h3>' + U.esc(t('settings.reset')) + '</h3><p>' + U.esc(t('settings.resetSub')) + '</p></div>' +
        '<button class="btn btn-danger" data-act="reset">' + U.esc(t('settings.resetBtn')) + '</button>' +
        '</div></div>';

      html += '<div class="inline-note">' + U.esc(t('settings.storageSub', { kb: U.fmtNumber(kb) })) + ' ' +
        U.esc(t('settings.historyCount', { n: S.state.history.length })) + '</div>';

      html += '</div></div>';

      root.innerHTML = html;

      root.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!btn) return;
        var act = btn.getAttribute('data-act');
        if (act === 'edit-details') openDetails();
        else if (act === 'export') exportJSON();
        else if (act === 'import') importJSON();
        else if (act === 'load-sample') loadSample();
        else if (act === 'remove-sample') removeSample();
        else if (act === 'reset') resetAll();
      });
    }
  };

  W.Views.settings.loadSample = loadSample;
  W.Views.settings.exportJSON = exportJSON;
  W.Views.settings.openDetails = openDetails;

})(window.WCC);
