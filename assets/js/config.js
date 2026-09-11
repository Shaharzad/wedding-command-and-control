/* Your Supabase project. Two values from the dashboard, on two pages:

     url      Project Settings -> Data API -> Project URL
              (or read it off the dashboard address bar: the project reference
               in .../dashboard/project/REF is REF, and the URL is
               https://REF.supabase.co)

     anonKey  Project Settings -> API Keys -> the PUBLIC one. Supabase has
              renamed it over the years, so it is labelled "publishable"
              (sb_publishable_...) on newer projects and "anon" or "public"
              (a long eyJ... token) on older ones. Either works here.

              NOT the key labelled "secret" or "service_role". That one
              bypasses every security rule and must never reach a browser.

   The public key belongs in the browser: it names the project, it does not
   grant access. Who may read or write what is decided by the row level
   security policies in supabase/migrations/0001_init.sql. That is why this
   file is committed rather than hidden.

   Leave these blank and the planner runs exactly as it always did: on this
   device only, no account, no sharing. */
window.WCC = window.WCC || {};

window.WCC.CONFIG = {
  supabase: {
    url: '',
    anonKey: ''
  }
};
