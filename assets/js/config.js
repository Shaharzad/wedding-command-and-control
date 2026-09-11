/* Your Supabase project. Both values come from the dashboard, under
   Project Settings -> API.

   The anon key belongs in the browser: it names the project, it does not grant
   access. Who may read or write what is decided by the row level security
   policies in supabase/migrations/0001_init.sql. That is why this file is
   committed rather than hidden.

   Leave these blank and the planner runs exactly as it always did: on this
   device only, no account, no sharing. */
window.WCC = window.WCC || {};

window.WCC.CONFIG = {
  supabase: {
    url: '',
    anonKey: ''
  }
};
