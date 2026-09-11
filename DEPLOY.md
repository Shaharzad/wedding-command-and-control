# From this folder to a wedding the whole family is planning

Nine steps. About an hour of real work, most of it waiting for things to
provision. It costs nothing.

You do steps 1 to 6 once, and you are the only one who does them. Everyone else
joins at step 8 by opening a link.

Each step ends with **You know it worked when** — do not move on until that is
true, because every later step assumes the earlier ones took.

> **Nothing is at risk while you do this.** Until step 4 the planner carries on
> working exactly as it does now: open `index.html` from disk, no account, no
> network. Stop halfway and you have lost nothing.

**What you need:** a GitHub account, a [Supabase](https://supabase.com) account
and a [Cloudflare](https://dash.cloudflare.com/sign-up) account — all free — plus
Node installed, for two `npx` commands.

---

## 1. Put the code on GitHub

Cloudflare builds the site from a Git repository, so the code has to live in one.

The commits are already made, on a branch called `main`. Sign in from your
terminal first:

```sh
cd E:/Projects/WeddingCommandAndControl
gh auth login          # GitHub.com, HTTPS, authenticate in the browser
```

**If you already made an empty repository on GitHub**, point at it and push.
Substitute your own username and repository name:

```sh
git remote add origin https://github.com/YOUR-USERNAME/wedding-command-and-control.git
git push -u origin main
```

**If you have not made one yet**, this does both at once:

```sh
gh repo create wedding-command-and-control --private --source=. --remote=origin --push
```

Private is the right default. Nothing in here is secret — see step 4 — but the
guest list and the budget are nobody else's business, and Cloudflare reads a
private repository perfectly well once you connect it.

> **If the push is rejected** with *"updates were rejected"*, the repository was
> not quite empty — GitHub adds a README or a licence if you tick those boxes. Do
> `git pull --rebase origin main` to put its commit underneath yours, then push
> again.

**You know it worked when** `gh repo view --web` opens your repository and the
file list shows `index.html`, `assets/`, `supabase/` and `worker/`.

> The repository name has nothing to do with the web address. That comes from
> what you name the **Cloudflare project** in step 5 — pick something the family
> can type.

## 2. Create the database

1. In Supabase, **New project**. Any name. Pick the region closest to the family
   — for Pakistan that is usually `ap-south-1` (Mumbai) or `ap-southeast-1`
   (Singapore). Set a database password and put it somewhere you will find it
   again. This app never needs it, but you will the day you want to poke at the
   database directly.
2. Wait for provisioning to finish. A couple of minutes.
3. **SQL Editor** → **New query**. Open `supabase/migrations/0001_init.sql`, copy
   the whole file, paste, **Run**.

That one file creates the five tables, the row-level-security rules deciding who
may read and write what, the trigger that records who changed what, and the
functions the app calls by name. It is safe to run twice — every statement is
guarded — so if you paste half of it by mistake, just run the whole thing again.

**You know it worked when** the editor says *Success. No rows returned*, and
**Table Editor** lists five tables: `weddings`, `members`, `records`, `comments`,
`activity`.

## 3. Turn on sign-in by email

People sign in with a link emailed to them. No password, which matters when some
of your users are mothers who are not going to run a password manager.

1. **Authentication** → **Sign In / Providers** → **Email**: enabled, with
   **Confirm email** on.
2. **Authentication** → **URL Configuration**. You need the web address before
   you can fill this in — and you get to choose it, because whatever you name the
   Cloudflare project in step 5 becomes `https://THAT-NAME.pages.dev`. So decide
   now. Say `sarah-ahmed-wedding`:
   - **Site URL**: `https://sarah-ahmed-wedding.pages.dev`
   - **Redirect URLs**: add `https://sarah-ahmed-wedding.pages.dev/**`

Use that exact name in step 5. Change your mind later and you must come back and
change both of these, or sign-in links bounce.

**You know it worked when** both fields show your address and you have saved.
Nothing to test yet — the site does not exist until step 5.

## 4. Point the planner at your project

Two values, and Supabase keeps them on two different pages.

**The URL:** **Project Settings** → **Data API** → **Project URL**. It looks like
`https://abcdefghijkl.supabase.co`. If you cannot find that page, read it off the
dashboard's own address bar — `.../dashboard/project/abcdefghijkl` means your URL
is `https://abcdefghijkl.supabase.co`.

**The key:** **Project Settings** → **API Keys** → the public one. Newer projects
call it **publishable** and it starts `sb_publishable_`; older ones call it
**anon** or **public** and it is a long `eyJ...` token. Either works.

Put them in [assets/js/config.js](assets/js/config.js):

```js
window.WCC.CONFIG = {
  supabase: {
    url: 'https://abcdefghijkl.supabase.co',
    anonKey: 'eyJhbGciOi...'
  }
};
```

Then:

```sh
git add assets/js/config.js
git commit -m "Point at our Supabase project"
git push
```

### Why that file is not a secret

The anon key is designed to sit in the browser. It names the project; it grants
nothing. Who may read and write what is decided entirely by the rules you ran in
step 2, which resolve every request through the `members` table. That is why the
file is committed rather than hidden — and why a private repository is about your
guest list, not about this key.

The key never to paste anywhere is the one labelled **secret** or **service
role**. It bypasses every rule. This app does not use it and never will.

**You know it worked when** you open `index.html` from disk and it asks you to
sign in instead of showing the planner. Sign-in will not actually complete from
`file://` — that is expected, and step 5 fixes it. If you still see the planner,
the file did not save.

## 5. Put the site online

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**. Authorise GitHub, pick your repository.
2. Name the project **exactly** what you decided in step 3.
3. Build settings — there is no build step, so they stay empty:

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | *(leave empty)* |
   | Build output directory | `/` |

4. **Save and Deploy**, and wait about a minute.

Every `git push` to `main` redeploys from now on.

`_headers` in the repository root sets the security headers Cloudflare serves,
including a content security policy confining the page to its own files and your
Supabase project. You never need to touch it, including if you add a custom
domain later.

<details>
<summary>If the dashboard fights you, deploy from the terminal instead</summary>

```sh
npx wrangler pages deploy . --project-name=sarah-ahmed-wedding
```

That publishes immediately and creates the project. Connect it to GitHub
afterwards under the project's **Settings** → **Builds & deployments**.
</details>

**You know it worked when** `https://your-name.pages.dev` loads the sign-in
screen — a gold medallion, "Sign in to your wedding", one email box, and no
sidebar behind it.

## 6. Stop the database going to sleep

**This is the step people skip and regret.** A free Supabase project **pauses
after seven days with no API requests**, and only the dashboard can wake it. Go
quiet over Eid, come back, and the app will not load for anybody.

`worker/` is a scheduled Cloudflare Worker that pings the project on Mondays and
Thursdays — twice a week, so one failed run cannot let the seven-day clock run
out.

Put the same two values from step 4 into `SUPABASE_URL` and `SUPABASE_ANON_KEY`
in [worker/wrangler.toml](worker/wrangler.toml), then:

```sh
cd worker
npx wrangler deploy --config wrangler.toml
cd ..
git add worker/wrangler.toml && git commit -m "Keep-alive worker" && git push
```

> **`--config` is not optional.** Wrangler searches upwards for a configuration
> file. Leave it off and it finds the site's `wrangler.jsonc` in the repository
> root and redeploys the site instead — reporting success, for the wrong Worker.
> Check the name in its output: you want `wedding-keepalive`.

Wrangler prints the worker's URL when it finishes. **Open it.** It runs the same
ping on the spot and reports the result, so you find out now rather than on a
Thursday in December:

```json
{ "ok": true, "status": 200, "at": "2026-09-11T18:43:00.000Z" }
```

`"ok": false` means the URL or key is wrong. Fix `wrangler.toml`, deploy again.

<details>
<summary>Without Wrangler</summary>

Any free uptime monitor — UptimeRobot, Cron-job.org — pointed at
`https://YOUR-PROJECT.supabase.co/rest/v1/` with an `apikey` header set to your
anon key, checked every few days, does the same job.
</details>

**You know it worked when** the worker's URL returns `"ok": true` and the
Cloudflare dashboard shows it with two cron triggers.

## 7. Create the wedding, and bring your plan across

Open your `pages.dev` address.

1. Enter your email. The link arrives in seconds. Open it **on the device you
   want to use**.
2. You land on **Start your wedding**. Name it, and give your own name — that is
   what the family sees on everything you do, so "Sarah", not "admin".
3. If this browser already holds a wedding, the app offers to **bring it across**.
   Say yes. Everything moves: every guest, rupee, table, ticked task and daily
   snapshot.
4. If it is a fresh start you get the usual choice — **Load sample data** to see
   how it works, or **Start fresh**.

> **If your real plan is on a different computer**, step 3 will not see it. On
> the old machine use **Settings → Export a backup**. On the new one, sign in,
> create the wedding, then **Settings → Restore a backup** and pick that file.

**You know it worked when** the planner opens with your wedding's name in the
title bar, the sidebar shows **Activity** and **People** near the bottom, and the
bottom-left of the sidebar reads *Saved for everyone* rather than *Saved on this
device*.

## 8. Bring the family in

**People** → **Invite someone**. Enter their email and choose what they can do:

| Role | Can do | Give it to |
|---|---|---|
| **Owner** | Everything, including inviting people and changing roles | The couple |
| **Editor** | Add, change and delete anything in the planner | Both mothers, siblings, anyone actually doing the work |
| **Viewer** | Read everything and change nothing, not even a comment | Relatives who want to watch but should not be moving tables |

These limits are enforced by the database, not by hiding buttons. A viewer who
opens the browser console still cannot write.

**What to send each person**, more or less word for word:

> I have put the whole wedding plan online. Go to
> **https://your-name.pages.dev**, put in this email address, and it will send
> you a link. Open the link on your phone, then add the page to your home screen
> — it works like an app after that. It will ask what to call you: put your name,
> because that is what shows up on the jobs you take on.

That last sentence matters. The app asks each new arrival for a name the first
time they open it. Anyone who rushes past it shows up as an email address on
every job, comment and line of the activity feed.

**You know it worked when** **People** shows each person as *Joined* under their
real name, and Activity attributes their changes to them.

## 9. Now actually use it

The app only earns its keep if the work gets handed out. Three habits:

**Give every job an owner.** Tasks, Shopping and Who-does-what all take an
assignee. A job with nobody's name on it is a job nobody is doing. Each person
then has a **Mine** filter on Tasks and a **Yours** toggle on Today — three jobs
instead of thirty.

**Argue in the app, not in WhatsApp.** Every task and vendor has a **Discuss**
button. Why you chose that caterer, and the price they actually agreed to, belong
attached to the caterer — not sixty messages up a group chat nobody can search in
March.

**Today in the morning, Dashboard at night.** Today is what is due and overdue.
Dashboard has the countdown, the money, and **Lately** — what everyone else
changed since you last looked.

---

## Backing up, which is not optional

**The free tier has no backups.** None. If the project is deleted, or somebody
makes a mess of a table, Supabase cannot put it back for you. That is the one
real cost of free hosting, and you should plan around it rather than hope.

So **Settings → Export a backup** is not a nicety, it is the backup strategy. One
JSON file holding every task, guest, rupee, event and daily snapshot. Keep it in
Google Drive, or WhatsApp it to yourself.

- **Monthly** while planning.
- **Weekly** in the last month.
- **The day before** each function.

The planner nags you on Today and Dashboard if it has been more than a fortnight.
Do not dismiss it twice running.

Restoring is **Settings → Restore a backup**. It checks the file before replacing
anything, and refuses one that is not a planner backup.

## What the free tier gives you

| | Free tier | What a wedding uses |
|---|---|---|
| Database | 500 MB | A large wedding is under 5 MB |
| Monthly active users | 50,000 | Five |
| Realtime connections | 200 at once | One per open tab |
| **Backups** | **None** | — |
| Pause | After 7 days idle | Step 6 |

You will not come near any limit except the pause and the backups — step 6, and
the section above.

## When something is wrong

**"That would not open" / "No connection to the server"** — the project is
paused, or the URL in `config.js` is wrong. Open the Supabase dashboard; a paused
project says so, with a Restore button. Then check step 6 is actually running.

**The sign-in email never arrives** — three usual causes, in order: it is in
spam; the **Redirect URLs** in step 3 do not match the site exactly, including
the `https://`; or you have hit the built-in mail limit, which is a handful of
messages an hour. **Authentication → Logs** shows which. For more volume,
**Authentication → Emails** points it at your own SMTP.

**Somebody sees "You have view-only access"** — they are a Viewer. An owner
changes that under People.

**Changes are not reaching the other person** — the banner at the top says either
*You are offline* or *Changes are not reaching the others*, and the sidebar
counts anything still waiting. Live updates travel over a WebSocket, which some
office and hotel networks block; a refresh always fetches the current state
regardless, so nothing is lost but the liveness.

**Somebody is showing as an email address** — they got in before the app could
ask for a name, which happens if their first visit was with no connection.
Signing out and back in asks again.

**Everything broke right after a push** — check the Cloudflare deployment log for
that commit. A half-saved `config.js` is the usual culprit. `git revert` the bad
commit and push.

## Afterwards

The wedding ends; the data does not have to. Two things in the week after:

1. Export one last backup and keep it with the photographs.
2. Either leave the project running — the keep-alive costs nothing — or delete it
   from the Supabase dashboard once you have that file.

And the planner still opens from disk with no account at all. Clear the two
values out of `config.js`, double-click `index.html`, restore the backup: a
complete offline copy of the whole wedding that needs nothing from anybody, ever
again.
