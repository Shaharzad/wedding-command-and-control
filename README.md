# Wedding Planner

Everything a Pakistani multi-day wedding needs to keep straight — the functions,
the guest list, the budget in rupees, the vendors, the seating, the shopping —
in one place that the whole family can open at once.

It works two ways, and you choose:

- **Shared.** Everyone signs in with their email and sees the same wedding, live.
  Ammi ticks something off in Lahore and it is ticked off on your phone.
- **On its own.** Double-click `index.html` and it runs on that one computer with
  no account, no internet and nothing uploaded anywhere.

Sharing takes a one-time setup by someone comfortable with a dashboard —
[DEPLOY.md](DEPLOY.md) walks through it. Until then the planner behaves exactly
like the single-computer version, and nothing is lost when you switch: your
existing plan can be brought across in one click.

## Opening it

**If it has been set up for sharing,** go to the web address whoever set it up
gave you and enter your email. A sign-in link arrives by email — no password.
Open the link on the device you want to use, and you are in. Add the page to your
home screen so it opens like an app.

**If not,** double-click `index.html`. It opens in Chrome and works straight away,
offline.

On first run you choose between **Load sample data** (a fictional Lahore wedding,
so you can see how everything works) and **Start fresh**. The sample data can be
removed at any time from Settings.

## Planning it together

**People** is where the family gets added. Invite by email and pick what they can
do. The first time someone opens their invitation the app asks what to call them,
so they appear as *Ammi* on the jobs they take on rather than as an email address:

| Role | Can do |
|---|---|
| **Owner** | Everything, including inviting people and changing roles. Usually the couple. |
| **Editor** | Add, change and delete anything in the planner. |
| **Viewer** | Read everything, change nothing. |

Those limits are enforced by the database, not by hiding buttons.

**Handing out work.** Tasks, shopping and Who-does-what each take an assignee.
Pick a name and it becomes theirs: their Tasks page has a **Mine** filter and
their Today page has a **Yours / Everyone's** toggle, so nobody has to read the
whole list to find their three jobs.

**Talking about things.** Every task and every vendor has a **Discuss** button. A
thread hangs off that one record, so the argument about whether the hall is too
small lives next to the hall, not sixty messages up a WhatsApp group.

**Activity** shows every change and who made it, newest first, under a heading
per day and filterable by person. A run of the same person doing the same kind of
thing in the same few minutes reads as one line — "Ammi added 8 things" — so
loading the sample wedding does not bury the one change you were looking for. The
Dashboard carries the last few lines of it under **Lately**. It is recorded by
the database itself, so it is what actually happened rather than what the app
remembered to mention.

**Working while it syncs.** Nothing waits for the network. You type, it appears,
and the change goes out behind you. If the connection drops, a banner says so and
everything on screen keeps working as a read-only copy until it comes back.

## Backing up

**Read this bit.** The free hosting tier has **no backups**. If the project is
deleted or a mistake wipes a table, nobody can restore it for you.

**Backup:** Settings → *Export a backup*. That downloads one `.json` file holding
every task, guest, expense, event and daily snapshot. Keep it somewhere safe —
Google Drive, WhatsApp to yourself, a USB stick. The planner reminds you on the
Today and Dashboard pages if you have never backed up, or if your last backup is
more than two weeks old.

**Restore:** Settings → *Restore a backup*, pick that file, confirm. The file is
checked before anything is replaced, and a file that is not a planner backup is
refused.

Restoring is also how you move between the shared and single-computer versions in
either direction.

**Start over:** Settings → *Reset all data*. It asks you to type RESET first.

**Deleted something by mistake?** Every delete offers an **Undo** button in the
message at the bottom of the screen. It lasts about eight seconds and puts back
exactly that record and the things attached to it — a guest returns to their
table with their gift still recorded against them — without touching anything
anyone else has changed in the meantime.

## What is in each section

- **Today** — the morning view: daily habits with tick boxes, a streak, anything
  due today, anything overdue, and today's functions. **Yours** narrows it to
  what has been assigned to you.
- **Dashboard** — the countdown, headline numbers, and the charts.
- **Analytics** — how the planning is trending: velocity, burndown against the
  wedding date, spending over time, and where each area stands. Every chart has
  a "show as table" view so nothing is readable only as colour.

**Planning**

- **Tasks** — everything to do, one-off or repeating daily/weekly, each with an
  owner and a discussion.
- **Budget** — planned against spent per category, in PKR, with payment status.
  This is the ledger: every rupee recorded anywhere ends up here.
- **Guests** — one row per invitation, with RSVP, headcount and which functions
  each family is invited to. *Add many at once* takes a pasted list — one guest
  per line, optionally `Name, family, adults, children` — which is much the
  fastest way to get a long list in. Duplicates are skipped.
- **Invitations** — the same guest list, tracked from printed to confirmed.
  Changing a status here changes the guest record; there is no second list.
- **Events** — Dholki, Mayun, Mehndi, Baraat, Nikah, Walima and anything else,
  as cards, as a timeline with the gaps between functions, or on a month calendar.
- **Seating** — tables for one function at a time. A table over its capacity is
  flagged in red with a label, and seating someone at a new table lifts them off
  the old one.

**Suppliers and shopping**

- **Vendors** — quotes, agreed prices and booking status, each with its own
  discussion. Each vendor links to one budget line, and *Record payment* writes
  straight into it, so paid and remaining are always the same numbers the Budget
  shows. Two people recording a payment at the same moment both count.
- **Wardrobe** — clothing and jewelry for the bride, the groom and the family in
  one list, with order status and fitting dates.
- **Catering** — the menu by course, priced per head, totalled for each event
  using that event's expected guest count.
- **Shopping** — the running list of things to buy, with who is buying what.
- **Contacts** — the people you ring, with tap-to-call numbers.

**The details**

- **Decor** — what each area should look like, the colours, and who is doing it.
- **Photos** — the shot list, ticked off on the day. Share it with your
  photographer beforehand.
- **Gifts** — salami and gifts as they arrive, and whether the thank-you went out.
- **Who does what** — jobs handed to the family, with their number pulled from
  Contacts where the name matches.
- **Nikah** — a checklist of things to settle. Everything on it is a prompt to
  raise with your registrar, never a statement of what the law requires.
- **Honeymoon** — the trip, its bookings and its own budget, kept separate from
  the wedding.

**The day itself**

- **Wedding day** — one function at a time: an editable hour-by-hour running
  order that ticks off as the day goes, when each vendor arrives, the numbers to
  ring, what is still owed, and who is on what. There is a print button, and the
  page prints without the sidebar or buttons.

And **Activity**, **People** and **Settings**.

**Search everything** is in the header, or press Ctrl+K (⌘K on a Mac). It looks
across every section at once; picking a result opens that item.

### About the Nikah checklist

Legal and documentation requirements for a Nikah vary by city, province and
country, and they change. Nothing in this planner is legal advice or a statement
of what is required where you are. The checklist is a set of prompts — questions
to put to your local Nikah registrar — and the page says so at the top, whether
the list is full or empty. Confirm every one of them with the registrar or the
relevant authority before relying on it.

### Which numbers are the real money

The **Budget** is the single ledger. Vendor payments write into it directly.

Costs shown on Wardrobe, Catering, Shopping and Decor are planning estimates for
those lists — they are deliberately *not* added into the budget totals, so
nothing is ever counted twice.

Instead, Wardrobe, Catering and Decor each carry an **Against the budget** card
putting the two figures side by side: what you have estimated on that page, what
the budget plans for the matching categories, and what has actually been spent.
If your estimates run over what the budget allows, it says so in red. The
honeymoon has its own budget, on purpose: it is the trip, not the functions.

## For developers

Plain HTML, CSS and JavaScript. **No build step, no framework, no bundler, no
npm at runtime.** Everything hangs off one global namespace, `window.WCC`, loaded
through ordinary `<script>` tags — ES modules are deliberately avoided because
Chrome blocks them over `file://`, and the app must keep working from a file.
`supabase-js` is vendored at `assets/vendor/supabase.js` for the same reason: it
exposes a global, so nothing about the architecture had to change to gain a
backend.

```
index.html
_headers                      security headers Cloudflare Pages serves
assets/css/app.css
assets/js/util.js             dates, PKR formatting, escaping
assets/js/strings.js          every user-facing string, plus the option lists
assets/js/config.js           your Supabase project, or blank for local-only
assets/js/cloud.js            sync: flatten/hydrate, push queue, realtime, people
assets/js/cloud-supabase.js   the real backend
assets/js/cloud-fake.js       a test double: localStorage + BroadcastChannel
assets/js/store.js            the single state object, persistence, snapshots
assets/js/charts.js           hand-rolled SVG charts (donut, ring, meter, bars, line, dots)
assets/js/ui.js               modals, forms, validation, confirmations, toasts
assets/js/module.js           a declarative list module: KPIs, charts, filters, table, form
assets/js/account.js          sign in, pick a wedding, migrate a local one
assets/js/comments.js         a discussion thread on any record
assets/js/search.js           global search across every collection
assets/js/sample.js           the sample wedding, generated relative to today
assets/js/app.js              routing, shell, banners, first-run flow
assets/js/views/*.js          one file per section
supabase/migrations/          the schema, the security rules and the triggers
worker/                       the scheduled ping that stops the project pausing
```

### State

One object — settings, events, tasks, budget, guests, vendors, wardrobe,
catering, shopping, contacts, seating, history and the rest — held in memory,
cached in localStorage under `wcc.wedding.v1` (or `wcc.cache.<weddingId>` when
shared), saved on every mutation and normalised on load. Corrupt or partial data
falls back to a valid empty state rather than a blank screen. Every figure on
screen is derived from that object; nothing is stored twice.

A daily snapshot (`{date, tasksTotal, tasksDone, budgetPlanned, budgetSpent,
guestsTotal, guestsConfirmed, vendorsBooked}`) is written once per day and kept
in `history`, which is what the Analytics trend charts read. Recurring tasks
store the **set of dates** they were completed on, never a boolean, so ticking
today never erases yesterday.

### Sync

The important property is that **state stays synchronous**. `view.render(root)`
is synchronous in all 24 views and none of them know a network exists. Only the
layer underneath is async.

- Every collection becomes rows in one `records` table, keyed by
  `(wedding_id, collection, id)` with the body in `jsonb`. Ids are still minted
  by the client (`U.uid()`), so a record has its identity before any write.
- `Store.save(reason, change)` writes the cache synchronously and hands the change
  descriptor to a retrying push queue. The UI never waits for the server.
- A realtime subscription patches affected records **in place** and calls the
  existing `notify()`. In place matters: views hold live object references across
  renders, so the state graph is never swapped out from under them.
- Loading fetches **all** records for a wedding atomically before normalising,
  because `normalise()` deletes seating and running-order rows whose event no
  longer exists. Against a partial load that would silently destroy a seating
  plan, so it never runs against one, and its pruning is off while adopting.
- Deletes are soft (`deleted_at`) and undo clears the flag, so undo restores one
  record instead of rolling the whole document back over someone else's work.
- `recordVendorPayment` pushes a Postgres-side increment rather than a whole-row
  overwrite, so two people paying the same vendor at the same moment both count.
- Activity is written by a database trigger, not by the client.

### Everything else

On screens narrower than 640px every table turns into a card: `labelTableCells()`
in `app.js` stamps each cell with its column heading after render, and CSS does
the rest, so no view has to know about it.

Seating lives on the table (`tables[].guestIds`), scoped to one event, and the
store enforces one table per guest per event on write and on load. Invitations
are a view over `guests[].invitation`, not a collection. A wedding night runs
past midnight, so timeline slots before 5am sort to the end of that night.

A vendor stores a `budgetLineId` and nothing else about money that the budget
already knows: `paid` and `remaining` are computed from the linked line, and
`recordVendorPayment` is the only writer. Backups written by an earlier version
import cleanly — missing collections normalise to empty.

`WCC.Util.setToday('2026-09-11')` from the console overrides today's date — useful
for checking date-dependent behaviour such as the daily rollover.
