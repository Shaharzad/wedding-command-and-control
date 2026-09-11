/* The real backend: Supabase.

   Loaded from a CDN <script> tag, so there is still no build step anywhere in
   this project. Everything here is plumbing — all the rules live in Postgres
   (see supabase/migrations/0001_init.sql), because a rule enforced only in the
   browser is not a rule. */
window.WCC = window.WCC || {};

(function (W) {
  'use strict';

  /* PostgREST returns at most 1000 rows per request whatever you ask for, so a
     large guest list plus a year of daily snapshots has to be paged. */
  var PAGE = 1000;

  function must(res) {
    if (res && res.error) throw res.error;
    return res ? res.data : null;
  }

  /* The Supabase dashboard shows the project URL and the REST endpoint next to
     each other, and the wrong one gets copied often enough to be worth handling.
     supabase-js appends /rest/v1, /auth/v1 and /realtime/v1 itself, so a URL
     that already carries one produces a double path and 404s everything with no
     useful error. Take the origin and be done with it. */
  function projectUrl(raw) {
    var url = String(raw || '').trim();
    if (!url) return url;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      return new URL(url).origin;
    } catch (e) {
      return url.replace(/\/(rest|auth|realtime|storage)\/v[0-9]+\/?$/i, '')
        .replace(/\/+$/, '');
    }
  }

  function create(config) {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('supabase-js did not load');
    }
    var db = window.supabase.createClient(projectUrl(config.url), config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    return {
      raw: db,

      auth: {
        signIn: function (email) {
          return db.auth.signInWithOtp({
            email: email,
            options: { emailRedirectTo: window.location.href.split('#')[0] }
          }).then(must);
        },
        signOut: function () { return db.auth.signOut().then(must); },
        getUser: function () {
          return db.auth.getUser().then(function (res) {
            /* A missing session is a normal state, not an error. */
            return res && res.data ? res.data.user : null;
          }).catch(function () { return null; });
        },
        onChange: function (cb) {
          return db.auth.onAuthStateChange(function (_event, session) {
            cb(session ? session.user : null);
          });
        }
      },

      weddings: {
        list: function () {
          return db.from('members')
            .select('role, accepted_at, wedding_id, weddings(id, name, created_at)')
            .not('accepted_at', 'is', null)
            .then(must)
            .then(function (rows) {
              return (rows || []).map(function (r) {
                return {
                  id: r.wedding_id,
                  name: (r.weddings && r.weddings.name) || 'Our wedding',
                  role: r.role
                };
              });
            });
        },
        create: function (name, displayName) {
          return db.rpc('create_wedding', {
            wedding_name: name, owner_name: displayName || null
          }).then(must);
        },
        acceptInvites: function () { return db.rpc('accept_invites').then(must); }
      },

      members: {
        list: function (weddingId) {
          return db.from('members')
            .select('id, user_id, invited_email, role, display_name, accepted_at, created_at')
            .eq('wedding_id', weddingId)
            .then(must);
        },
        /* Your own row, not simply the first one the wedding returns: you can
           read the whole member list, so without the user filter this reports
           somebody else's role and somebody else's name. */
        mine: function (weddingId) {
          return db.auth.getUser().then(function (res) {
            var me = res && res.data ? res.data.user : null;
            if (!me) return null;
            return db.from('members')
              .select('id, role, display_name')
              .eq('wedding_id', weddingId)
              .eq('user_id', me.id)
              .not('accepted_at', 'is', null)
              .limit(1)
              .then(must)
              .then(function (rows) { return (rows && rows[0]) || null; });
          });
        },
        setName: function (weddingId, name) {
          return db.rpc('set_my_name', { wedding: weddingId, new_name: name })
            .then(must);
        },
        invite: function (weddingId, email, role) {
          return db.from('members')
            .insert({ wedding_id: weddingId, invited_email: email, role: role || 'editor' })
            .select()
            .then(must);
        },
        setRole: function (memberId, role) {
          return db.from('members').update({ role: role }).eq('id', memberId).then(must);
        },
        remove: function (memberId) {
          return db.from('members').delete().eq('id', memberId).then(must);
        }
      },

      records: {
        loadAll: function (weddingId) {
          var all = [];
          function page(from) {
            return db.from('records')
              .select('collection, id, data, updated_at, updated_by, deleted_at')
              .eq('wedding_id', weddingId)
              .order('collection', { ascending: true })
              .order('id', { ascending: true })
              .range(from, from + PAGE - 1)
              .then(must)
              .then(function (rows) {
                all = all.concat(rows || []);
                if (rows && rows.length === PAGE) return page(from + PAGE);
                return all;
              });
          }
          return page(0);
        },

        upsertMany: function (weddingId, rows) {
          if (!rows.length) return Promise.resolve([]);
          var payload = rows.map(function (r) {
            return {
              wedding_id: weddingId, collection: r.collection, id: r.id,
              data: r.data, deleted_at: null
            };
          });
          /* Chunked so one enormous first sync cannot exceed the request size. */
          var chunks = [];
          for (var i = 0; i < payload.length; i += 500) chunks.push(payload.slice(i, i + 500));
          return chunks.reduce(function (chain, chunk) {
            return chain.then(function () {
              return db.from('records')
                .upsert(chunk, { onConflict: 'wedding_id,collection,id' })
                .then(must);
            });
          }, Promise.resolve());
        },

        setDeleted: function (weddingId, collection, id, deleted) {
          return db.from('records')
            .update({ deleted_at: deleted ? new Date().toISOString() : null })
            .eq('wedding_id', weddingId).eq('collection', collection).eq('id', id)
            .then(must);
        },

        bump: function (weddingId, collection, id, field, delta, patch) {
          return db.rpc('bump_amount', {
            w: weddingId, coll: collection, rec: id, field: field,
            delta: delta, patch: patch || {}
          }).then(must);
        },

        /* Only used by the wedding-wide destructive actions, which are already
           behind a typed confirmation and restricted to the owner. */
        clearAll: function (weddingId) {
          return db.from('records').delete().eq('wedding_id', weddingId).then(must);
        }
      },

      comments: {
        list: function (weddingId, collection, recordId) {
          return db.from('comments')
            .select('id, collection, record_id, author_id, body, created_at')
            .eq('wedding_id', weddingId)
            .eq('collection', collection)
            .eq('record_id', recordId)
            .order('created_at', { ascending: true })
            .then(must);
        },
        add: function (weddingId, collection, recordId, body) {
          return db.auth.getUser().then(function (res) {
            var uid = res && res.data && res.data.user ? res.data.user.id : null;
            return db.from('comments').insert({
              wedding_id: weddingId, collection: collection, record_id: recordId,
              author_id: uid, body: body
            }).select().then(must);
          });
        }
      },

      activity: {
        list: function (weddingId, limit) {
          return db.from('activity')
            .select('id, actor, collection, record_id, op, summary, at')
            .eq('wedding_id', weddingId)
            .order('at', { ascending: false })
            .limit(limit || 100)
            .then(must);
        }
      },

      realtime: {
        subscribe: function (weddingId, onRow) {
          var channel = db.channel('records:' + weddingId)
            .on('postgres_changes', {
              event: '*', schema: 'public', table: 'records',
              filter: 'wedding_id=eq.' + weddingId
            }, function (payload) {
              var row = payload['new'] || payload.old;
              if (row) onRow(row);
            })
            .subscribe();
          return {
            unsubscribe: function () { db.removeChannel(channel); }
          };
        }
      }
    };
  }

  W.SupabaseBackend = { create: create, projectUrl: projectUrl };
})(window.WCC);
