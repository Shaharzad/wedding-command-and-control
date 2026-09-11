/* Discussion attached to a record.

   Decisions about a vendor or a budget line normally happen in WhatsApp and are
   lost by the time anyone needs them. This keeps them next to the thing. */
window.WCC = window.WCC || {};

(function (W) {
  'use strict';

  var U = W.Util, UI = W.UI, t = W.t;
  var Comments = {};

  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var day = U.toISO(d);
    var clock = U.pad2(d.getHours()) + ':' + U.pad2(d.getMinutes());
    return day === U.todayISO() ? clock : U.fmtDate(day, 'medium') + ', ' + clock;
  }

  function threadHTML(rows) {
    if (!rows.length) {
      return '<p class="hint">' + U.esc(t('comments.empty')) + '</p>';
    }
    return '<div class="thread">' + rows.map(function (c) {
      var who = W.Cloud.personName(c.author_id) || t('members.someone');
      var mine = W.Cloud.isMe(c.author_id);
      return '<div class="thread-item' + (mine ? ' thread-mine' : '') + '">' +
        '<p class="thread-who">' + U.esc(who) +
        '<span class="thread-when">' + U.esc(when(c.created_at)) + '</span></p>' +
        '<p class="thread-body">' + U.esc(c.body) + '</p></div>';
    }).join('') + '</div>';
  }

  /* Opens the discussion for one record. */
  Comments.open = function (collection, recordId, heading) {
    if (!W.Cloud.isEnabled()) return;
    var boxId = U.uid('cm');

    UI.openModal({
      title: t('comments.title'),
      subtitle: heading,
      bodyHTML: '<div data-thread>' +
        '<p class="hint">' + U.esc(t('gate.loading')) + '</p></div>' +
        (W.Cloud.canWrite()
          ? '<div class="field" style="margin-top:14px">' +
            '<label for="' + boxId + '">' + U.esc(t('comments.add')) + '</label>' +
            '<textarea id="' + boxId + '" placeholder="' + U.esc(t('ph.commentExample')) +
            '"></textarea></div>'
          : '<p class="hint">' + U.esc(t('comments.readOnly')) + '</p>'),
      footHTML: '<button class="btn" data-role="close">' + U.esc(t('common.close')) + '</button>' +
        (W.Cloud.canWrite()
          ? '<button class="btn btn-primary" data-role="post">' +
            U.esc(t('comments.post')) + '</button>'
          : ''),
      onMount: function (node, close) {
        var thread = node.querySelector('[data-thread]');
        var box = node.querySelector('#' + boxId);

        function load() {
          W.Cloud.comments(collection, recordId).then(function (rows) {
            thread.innerHTML = threadHTML(rows || []);
            thread.scrollTop = thread.scrollHeight;
          }).catch(function (e) {
            thread.innerHTML = '<p class="gate-error">' +
              U.esc(String((e && e.message) || e)) + '</p>';
          });
        }
        load();

        node.querySelector('[data-role="close"]').addEventListener('click', close);
        var post = node.querySelector('[data-role="post"]');
        if (post) {
          post.addEventListener('click', function () {
            var body = String(box.value || '').trim();
            if (!body) { box.focus(); return; }
            box.value = '';
            W.Cloud.addComment(collection, recordId, body).then(function () {
              load();
            }).catch(function (e) {
              UI.toast(String((e && e.message) || e), 'bad');
            });
          });
        }
        if (box) box.focus();
      }
    });
  };

  /* The button that opens it, for any row that wants one. */
  Comments.button = function (collection, recordId, label) {
    if (!W.Cloud.isEnabled()) return '';
    return '<button class="icon-btn" data-act="discuss" data-collection="' +
      U.esc(collection) + '" data-id="' + U.esc(recordId) + '" aria-label="' +
      U.esc(t('comments.openFor', { name: label || '' })) + '">' +
      U.esc(t('comments.short')) + '</button>';
  };

  /* Shared click handling so each view does not repeat it. */
  Comments.wire = function (root, titleFor) {
    root.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-act="discuss"]') : null;
      if (!btn) return;
      var collection = btn.getAttribute('data-collection');
      var id = btn.getAttribute('data-id');
      Comments.open(collection, id, titleFor ? titleFor(collection, id) : '');
    });
  };

  W.Comments = Comments;
})(window.WCC);
