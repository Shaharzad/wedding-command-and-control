/* Keeps the Supabase project awake.

   A free Supabase project pauses after seven days with no API requests, and a
   paused project can only be restarted from the dashboard. The family would
   open the planner one morning to a dead database and no way to fix it.

   So this pings the REST endpoint twice a week. The request is authenticated
   with the anon key and returns no rows — row level security sees to that —
   but it counts as activity, which is the whole point. */

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(ping(env));
  },

  /* Visiting the worker's URL runs the same check by hand, so you can tell
     whether it is working without waiting for a Thursday. */
  async fetch(request, env) {
    const result = await ping(env);
    return new Response(JSON.stringify(result, null, 2), {
      status: result.ok ? 200 : 502,
      headers: { 'content-type': 'application/json' }
    });
  }
};

async function ping(env) {
  const url = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = env.SUPABASE_ANON_KEY || '';
  if (!url || !key) {
    return { ok: false, error: 'SUPABASE_URL and SUPABASE_ANON_KEY are not set' };
  }

  const at = new Date().toISOString();
  try {
    const res = await fetch(url + '/rest/v1/weddings?select=id&limit=1', {
      headers: { apikey: key, authorization: 'Bearer ' + key, accept: 'application/json' }
    });
    /* 200 and 401 both mean the project answered. Only a network failure or a
       5xx means it is unreachable. */
    const awake = res.status < 500;
    if (!awake) console.error('supabase keep-alive got ' + res.status + ' at ' + at);
    return { ok: awake, status: res.status, at: at };
  } catch (err) {
    console.error('supabase keep-alive failed at ' + at + ': ' + err.message);
    return { ok: false, error: String(err.message || err), at: at };
  }
}
