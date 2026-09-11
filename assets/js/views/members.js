/* Who else is planning this wedding.

   Unlike every other view this one reads from the server rather than the state
   object, so it fetches once per visit and re-renders when the answer lands. */
window.WCC = window.WCC || {};
window.WCC.Views = window.WCC.Views || {};

(function (W) {
  'use strict';

  var U = W.Util, S = W.Store, UI = W.UI, t = W.t;

  var cache = null;
  var loading = false;
  var loadError = '';

  function refresh(force) {
    if (loading) return;
    if (cache && !force) return;
    loading = true;
    loadError = '';
    W.Cloud.members().then(function (rows) {
      cache = rows || [];
      loading = false;
      W.App.rerender();
    }).catch(function (e) {
      loading = false;
      loadError = String((e && e.message) || e);
      W.App.rerender();
    });
  }

  function isMe(m) {
    var me = W.Cloud.user();
    return !!(me && m.user_id === me.id);
  }

  function displayName(m) {
    return m.display_name || m.invited_email || t('members.someone');
  }

  /* --------------------------------------------------------------- forms -- */

  function openInvite() {
    UI.form({
      title: t('members.inviteTitle'),
      subtitle: t('members.inviteSub'),
      values: { email: '', role: 'editor' },
      submitLabel: t('members.inviteBtn'),
      fields: [
        {
          name: 'email', label: t('members.email'), type: 'email', required: true,
          placeholder: t('ph.emailExample'),
          validate: function (v) {
            return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? null : t('gate.emailInvalid');
          }
        },
        {
          name: 'role', label: t('members.role'), type: 'select', required: true,
          options: [
            { value: 'editor', label: t('members.roleEditor') },
            { value: 'viewer', label: t('members.roleViewer') },
            { value: 'owner', label: t('members.roleOwner') }
          ],
          hint: t('members.roleHint')
        }
      ],
      onSubmit: function (vals) {
        W.Cloud.invite(vals.email, vals.role).then(function () {
          UI.toast(t('members.invited', { email: vals.email }), 'good');
          refresh(true);
          openShare(vals.email);
        }).catch(function (e) {
          UI.toast(String((e && e.message) || e), 'bad');
        });
        return true;
      }
    });
  }

  /* The invitation is a row in a table; it reaches nobody by itself. Write out
     what to send, so the answer to "now what?" is one paste. */
  function openShare(email) {
    var message = t('members.shareMessage', {
      url: window.location.origin + window.location.pathname,
      email: email
    });

    UI.openModal({
      title: t('members.shareTitle', { name: email }),
      subtitle: t('members.shareBody'),
      bodyHTML: '<textarea class="share-box" rows="9" readonly>' +
        U.esc(message) + '</textarea>',
      footHTML: '<button class="btn" data-role="close">' +
        U.esc(t('members.shareDone')) + '</button>' +
        '<button class="btn btn-primary" data-role="copy">' +
        U.esc(t('members.shareCopy')) + '</button>',
      onMount: function (node, close) {
        var box = node.querySelector('.share-box');
        node.querySelector('[data-role="close"]').addEventListener('click', close);
        node.querySelector('[data-role="copy"]').addEventListener('click', function () {
          box.select();
          var done = false;
          try { done = document.execCommand('copy'); } catch (e) { done = false; }
          if (done) {
            UI.toast(t('members.shareCopied'), 'good');
            close();
          } else if (navigator.clipboard) {
            navigator.clipboard.writeText(message).then(function () {
              UI.toast(t('members.shareCopied'), 'good');
              close();
            }).catch(function () { UI.toast(t('members.shareFailed'), 'bad'); });
          } else {
            UI.toast(t('members.shareFailed'), 'bad');
          }
        });
        box.focus();
        box.select();
      }
    });
  }

  function openRole(member) {
    UI.form({
      title: t('members.changeRole', { name: displayName(member) }),
      values: { role: member.role },
      submitLabel: t('common.saveChanges'),
      fields: [{
        name: 'role', label: t('members.role'), type: 'select', required: true,
        options: [
          { value: 'editor', label: t('members.roleEditor') },
          { value: 'viewer', label: t('members.roleViewer') },
          { value: 'owner', label: t('members.roleOwner') }
        ],
        hint: t('members.roleHint')
      }],
      onSubmit: function (vals) {
        W.Cloud.setRole(member.id, vals.role).then(function () {
          UI.toast(t('common.saved'), 'good');
          refresh(true);
        }).catch(function (e) { UI.toast(String((e && e.message) || e), 'bad'); });
        return true;
      }
    });
  }

  /* ---------------------------------------------------------------- view -- */

  W.Views.members = {
    title: t('members.title'),

    render: function (root) {
      if (!W.Cloud.isEnabled()) {
        root.innerHTML = '<div class="section"><div class="section-head"><h2>' +
          U.esc(t('members.title')) + '</h2></div>' +
          UI.emptyHTML({
            title: t('members.localTitle'),
            body: t('members.localBody')
          }) + '</div>';
        return;
      }

      refresh(false);
      var owner = W.Cloud.role() === 'owner';

      var html = '<div class="section"><div class="section-head">' +
        '<h2>' + U.esc(t('members.title')) + '</h2>' +
        '<p class="section-note">' + U.esc(t('members.sub')) + '</p>' +
        (owner
          ? '<button class="btn btn-primary" data-act="invite">' +
            U.esc(t('members.invite')) + '</button>'
          : '') +
        '</div>';

      if (loadError) {
        html += '<div class="notice notice-danger"><h3>' + U.esc(t('members.loadFailed')) +
          '</h3><p>' + U.esc(loadError) + '</p></div>';
      } else if (!cache) {
        html += '<div class="chart-empty">' + U.esc(t('gate.loading')) + '</div>';
      } else {
        var joined = cache.filter(function (m) { return m.accepted_at; });
        var pending = cache.filter(function (m) { return !m.accepted_at; });

        html += '<div class="grid grid-kpi">' +
          '<div class="kpi accent-maroon"><p class="kpi-label">' + U.esc(t('members.joined')) +
          '</p><p class="kpi-value">' + joined.length + '</p>' +
          '<p class="kpi-foot">' + U.esc(t('members.joinedFoot')) + '</p></div>' +
          '<div class="kpi"><p class="kpi-label">' + U.esc(t('members.pending')) +
          '</p><p class="kpi-value">' + pending.length + '</p>' +
          '<p class="kpi-foot">' + U.esc(t('members.pendingFoot')) + '</p></div>' +
          '<div class="kpi accent-emerald"><p class="kpi-label">' + U.esc(t('members.yourRole')) +
          '</p><p class="kpi-value">' + U.esc(t('members.role' +
            W.Cloud.role().charAt(0).toUpperCase() + W.Cloud.role().slice(1))) + '</p>' +
          '<p class="kpi-foot">' + U.esc(t('members.roleHint')) + '</p></div>' +
          '</div></div>';

        html += '<div class="section"><div class="table-wrap"><table>' +
          '<caption class="sr-only">' + U.esc(t('members.title')) + '</caption><thead><tr>' +
          '<th scope="col">' + U.esc(t('members.person')) + '</th>' +
          '<th scope="col">' + U.esc(t('members.role')) + '</th>' +
          '<th scope="col">' + U.esc(t('members.status')) + '</th>' +
          '<th scope="col"><span class="sr-only">' + U.esc(t('common.actions')) + '</span></th>' +
          '</tr></thead><tbody>';

        cache.forEach(function (m) {
          var mine = isMe(m);
          html += '<tr>' +
            '<td><div class="t-title">' + U.esc(displayName(m)) +
            (mine ? ' ' + UI.chip(t('members.you'), 'emerald') : '') + '</div>' +
            (m.invited_email && m.display_name
              ? '<div class="t-sub">' + U.esc(m.invited_email) + '</div>' : '') + '</td>' +
            '<td>' + UI.chip(t('members.role' + m.role.charAt(0).toUpperCase() + m.role.slice(1)),
              m.role === 'owner' ? 'maroon' : (m.role === 'viewer' ? '' : 'gold')) + '</td>' +
            '<td>' + (m.accepted_at
              ? UI.chip(t('members.joinedChip'), 'emerald')
              : UI.chip(t('members.pendingChip'), 'gold')) + '</td>' +
            '<td class="actions">' +
            (owner && !mine
              ? '<button class="icon-btn" data-act="role" data-id="' + U.esc(m.id) + '">' +
                U.esc(t('members.changeRoleShort')) + '</button>' +
                '<button class="icon-btn danger" data-act="remove" data-id="' + U.esc(m.id) + '">' +
                U.esc(t('members.remove')) + '</button>'
              : '') +
            '</td></tr>';
        });

        html += '</tbody></table></div>';
        html += '<p class="section-note">' + U.esc(t('members.note')) + '</p></div>';
      }

      root.innerHTML = html;

      root.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!btn) return;
        var act = btn.getAttribute('data-act');
        var id = btn.getAttribute('data-id');
        var member = (cache || []).filter(function (m) { return m.id === id; })[0];

        if (act === 'invite') openInvite();
        else if (act === 'role' && member) openRole(member);
        else if (act === 'remove' && member) {
          UI.confirm({
            title: t('members.removeTitle', { name: displayName(member) }),
            body: t('members.removeBody'),
            confirmLabel: t('common.delete'),
            danger: true,
            onConfirm: function () {
              W.Cloud.removeMember(member.id).then(function () {
                UI.toast(t('common.deleted', { name: displayName(member) }));
                refresh(true);
              }).catch(function (err) { UI.toast(String((err && err.message) || err), 'bad'); });
            }
          });
        }
      });
    }
  };

  /* A fresh visit should always show the current list. */
  W.Views.members.invalidate = function () { cache = null; };

})(window.WCC);
