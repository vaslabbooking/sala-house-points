# SALA House Points

House points for SALA, replacing the shared Excel workbook. Four houses —
**B**ears (green), **E**agles (yellow), **S**harks (blue), **T**igers (red) —
spelling the school motto, *be your BEST*.

## What it does

- **Entry screen** (`/`) — a teacher picks their name, picks a class, and awards
  points. Also awards points to a whole house. Works on a phone or laptop,
  during the lesson or afterwards. No sign-in, no time limits.
  A points box turns **pink above 10**, matching the school guideline of no more
  than 10 points per student per lesson, and the submit bar counts how many are
  over. It is a warning only — larger amounts still submit, because batching up
  after a busy week is legitimate.
- **Leaderboard** (`/display`) — house totals in house colours, built for a
  projector in assembly, with top 5 students and top 3 classes per house.
  Refreshes itself every 20 seconds.
  Opens with an **animated reveal**: every bar empty at zero in B.E.S.T order,
  then one house at a time fills while its total counts up, sliding into its
  rank as it lands, until the row reads leader to lowest. The winning house is
  then celebrated with **repeating confetti bursts in its own colours**, which
  keep going until stopped.

  | Key | |
  |---|---|
  | **R** or space | run the reveal again |
  | **S** or Escape | stop the confetti, leaving the standings up |

  Both have on-screen buttons too. Replay matters more than it sounds — assembly
  rarely starts the moment the laptop is plugged in.

  The reveal plays on load and on replay only, never on the 20-second data
  refresh, so the bars will not empty themselves mid-assembly. The whole
  sequence, confetti included, is skipped for viewers who prefer reduced motion,
  and can be turned off in Admin → Settings.
- **Admin** (`/admin`) — roster CSV import, moving students between classes and
  houses, adding and removing teachers, per-teacher activity, and the full award
  log with the ability to reverse any submission.

## How the data works

Every award is a **row in a ledger** — who gave it, to whom, how many, when —
and all totals are calculated from those rows. Nothing stores a running total.

This is what makes the app safe where the spreadsheet was not:

- **Simultaneous use is fine.** Two teachers submitting at the same moment
  insert two rows. There is no shared cell to overwrite, so no submission can be
  silently lost.
- **Everything can be undone.** A teacher can reverse their own recent
  submissions; admin can reverse anyone's. Reversed awards stay on the record,
  marked, rather than disappearing.
- **Totals cannot drift apart.** House totals and teacher totals are two
  different views of the same rows, so they can never disagree.
- **Nothing goes stale.** There is no refresh step to forget.

### The two rules about moving students

| What happens | Effect |
|---|---|
| Student changes **class** | Their points move with them to the new class |
| Student changes **house** | Points already earned stay with the old house; new points go to the new one |

Each award row records the student's house and class at the moment it was
given, which is what makes both rules work. Both are covered by tests.

## Running it locally

```bash
npm install
npm run dev
```

With no `TURSO_DATABASE_URL` set, it uses a local SQLite file at
`data/housepoints.db` and behaves identically to production.

```bash
npm test          # ledger, concurrency and CSV import tests
npm run build     # production build
```

To fill a local database with a realistic roster for testing:

```bash
node scripts/seed-dev.mjs path/to/roster.csv path/to/teachers.csv
```

## Deploying to Netlify

1. **Create the database**

   ```bash
   turso auth login
   turso db create sala-house-points
   turso db show sala-house-points --url
   turso db tokens create sala-house-points
   ```

2. **Set environment variables** in Netlify (Site configuration →
   Environment variables) — see `.env.example`:
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `APP_SECRET`
   (`openssl rand -base64 32`).

3. **Deploy.** Push the repository and connect it in Netlify, or `netlify deploy --prod`.
   Tables are created automatically on first run.

4. **First visit to `/admin`** asks you to set an admin password. Do this
   immediately after deploying — until it is set, anyone reaching `/admin` can
   claim it.

5. **Set a staff access code** in Admin → Settings, then import the roster in
   Admin → Students.

## Class codes

Codes are `grade.campus.class` — `7.L.5I` is grade 7, class 5; the trailing
letter is a stream marker. Sorted as plain text these put grade 10 above grade
6, so every list orders them numerically instead: grade 6 at the top through to
grade 12. The ordering is applied inside the queries, so a result limit picks
the right rows rather than the alphabetically-first ones.

## Roster CSV

Three columns, in any order, with these headers:

```csv
name,class,house
TRẦN KIM PHÚC AN,6.L.1E,Sharks
NGUYỄN HÀ MINH ĐỨC,6.L.1E,Eagles
```

An optional `id` column is used if present. Alternative header spellings
(`student name`, `class code`, …) are accepted, houses are case-insensitive,
and the file is checked and previewed before anything is written — including a
warning if the houses are noticeably unbalanced.

**Replace roster** corrects the current year's student list and keeps all
points. **Start new year** resets every total to zero and opens a new year;
the previous year is closed and kept, not deleted, and stays exportable.

## Access

- **Staff access code** — one code for the school, typed once per device and
  remembered for the term. Can be switched off entirely in Settings.
- **Admin password** — separate and stronger; guards the roster and the log.
- **Leaderboard** — behind the staff code by default because it lists student
  names. Settings has a toggle to open it up for a hall or reception screen.

Changing `APP_SECRET` invalidates every access-code and admin cookie, which is
how you sign everyone out at once.
