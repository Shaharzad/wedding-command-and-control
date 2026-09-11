# Putting it online

Follow this once. It takes about half an hour and costs nothing. At the end the
family opens one web address and everyone sees the same wedding.

Until you do this the planner still works — double-click `index.html` and it runs
on that one computer, exactly as before. Nothing here is required. It is only
required for **sharing**.

You need two free accounts: [Supabase](https://supabase.com) (the database) and
[Cloudflare](https://dash.cloudflare.com/sign-up) (the web address).

---

## 1. Create the database

1. In Supabase, **New project**. Pick any name. Choose the region closest to the
   family — for Pakistan that is usually `ap-south-1` (Mumbai) or `ap-southeast-1`
   (Singapore). Set a database password and keep it somewhere safe.
2. Wait for the project to finish provisioning.
3. Open **SQL Editor** → **New query**. Paste the entire contents of
   `supabase/migrations/0001_init.sql` and run it.

That one file creates all five tables, the security rules that decide who can
read and write what, the trigger that records who changed what, and the handful
of functions the app calls by name. Run it once; running it again is harmless.

You should see five tables under **Table Editor**: `weddings`, `members`,
`records`, `comments`, `activity`.

## 2. Turn on email sign-in

People sign in with a link emailed to them — no passwords to forget, which
matters when two of your users are mothers who will not be creating a password
manager.

1. **Authentication** → **Providers** → **Email**. Make sure it is enabled, and
   turn **Confirm email** on.
2. **Authentication** → **URL Configuration**:
   - **Site URL**: your Cloudflare address from step 4, e.g.
     `https://sarah-ahmed.pages.dev`
   - **Redirect URLs**: add the same address.

   You do not have this address yet. Come back and fill it in after step 4 — the
   sign-in emails will not work until you do.

> Supabase's built-in mail server sends a small number of messages per hour. For
> a family of five that is plenty. If invitations stop arriving, that limit is
> why, and **Authentication → Emails** lets you point it at your own SMTP.

## 3. Point the planner at it

**Project Settings** → **API** gives you two values. Put them in
`assets/js/config.js`:

```js
window.WCC.CONFIG = {
  supabase: {
    url: 'https://abcdefghijkl.supabase.co',
    anonKey: 'eyJhbGciOi...'
  }
};
```

That file is committed to the repository on purpose. The anon key is meant to be
in the browser — it names the project, it does not grant access. Who can read and
write what is decided entirely by the security rules in the migration. The key to
keep secret is the **service role** key, which this app never uses and you should
never paste anywhere.

Leave both blank and the planner goes back to being a single-computer app.

## 4. Put the site online

Cloudflare Pages deploys from a GitHub repository, so push this folder to GitHub
first (a private repository is fine).

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**, and pick the repository.
2. Build settings — there is no build step, so leave them empty:

   | Setting | Value |
   |---|---|
   | Framework preset | None |
   | Build command | *(leave empty)* |
   | Build output directory | `/` |

3. **Save and Deploy.** A minute later you have
   `https://your-project.pages.dev`.
4. Go back to Supabase step 2 and paste that address into **Site URL** and
   **Redirect URLs**.

Every push to the repository redeploys automatically.

`_headers` in the repository root sets the security headers Cloudflare serves,
including a content security policy that limits the page to its own files and
your Supabase project. If you ever move to a custom domain, nothing there needs
changing.

The `supabase/` and `worker/` folders get uploaded along with everything else and
are readable at their URLs. Nothing in them is secret — the schema and its
security rules are not a password — but if that bothers you, move them to a
separate repository.

## 5. Keep the project awake

**This is the step people skip and regret.** A free Supabase project pauses after
**seven days with no API requests**, and only the dashboard can wake it. Come back
from a fortnight of not planning and the app will not load.

`worker/` is a scheduled Cloudflare Worker that pings the project on Mondays and
Thursdays.

```sh
cd worker
# put your own values in wrangler.toml first
npx wrangler deploy
```

Visit the worker's URL once afterwards. It runs the same ping on the spot and
answers with the result, so you can tell it works without waiting for Thursday:

```json
{ "ok": true, "status": 200, "at": "2026-09-11T18:43:00.000Z" }
```

If you would rather not use Wrangler, any free uptime monitor (UptimeRobot,
Cron-job.org) pointed at `https://<project>.supabase.co/rest/v1/` with an
`apikey` header does the same job.

## 6. Invite the family

Open the site, sign in with your own email, create the wedding, then **People** →
**Invite**. Each person gets a link by email; when they sign in with that address
they land in the same wedding.

Three roles:

| Role | Can do |
|---|---|
| **Owner** | Everything, including inviting people and changing roles. Usually the couple. |
| **Editor** | Add, change and delete anything in the planner. Everyone else. |
| **Viewer** | Read everything and change nothing — not even a comment. Useful for relatives who want to see the plan but should not be moving tables. |

Roles are enforced by the database, not by hiding buttons. A viewer who opens the
developer console still cannot write, and the app tells them so rather than
letting them type into a form that will be rejected.

---

## What the free tier actually gives you

| | Free tier | What a wedding uses |
|---|---|---|
| Database | 500 MB | A large wedding is under 5 MB |
| Monthly active users | 50,000 | Five |
| Realtime connections | 200 at once | One per open tab |
| **Backups** | **None** | — |
| Pause | After 7 days idle | Step 5 |

**There are no backups on the free tier.** If the project is deleted, or a
mistake wipes a table, Supabase cannot restore it for you.

So the **Settings → Export a backup** button is not a nicety, it is the backup
strategy. It downloads one JSON file containing every task, guest, rupee, event
and daily snapshot. Do it monthly, and in the last fortnight before the wedding,
do it weekly. The planner nags you on the Today page if it has been more than two
weeks.

Restoring that file into a fresh project is **Settings → Restore a backup**.

## When something is wrong

**"That would not open" or "No connection to the server"** — the project is
paused, or the URL in `config.js` is wrong. Open the Supabase dashboard; a paused
project says so, with a Restore button.

**The sign-in email never arrives** — check the Redirect URLs in step 2 match the
site exactly, including `https://`. Then check the rate limit; the dashboard's
**Authentication → Logs** shows rejected sends.

**Someone sees "You have view-only access"** — they are a viewer. An owner can
change that under People.

**Changes are not showing up for the other person** — the banner at the top of
the page says either "You are offline" or "Changes are not reaching the others",
and the account row in the sidebar counts anything still waiting. Live updates
travel over a WebSocket, which some office and hotel networks block; a page
refresh always fetches the current state regardless.
