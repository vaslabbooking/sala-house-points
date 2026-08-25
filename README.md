# SALA House Points

House points for SALA, replacing the shared Excel workbook. Four houses —
**B**ears (green), **E**agles (yellow), **S**harks (blue), **T**igers (red) —
spelling the school motto, *be your BEST*.

## What it does

- **Entry screen** (`/`) — a teacher picks their name, picks a class, and awards
  points. Also awards points to a whole house. Works on a phone or laptop,
  during the lesson or afterwards. No sign-in, no time limits.
  A points box turns **pink above 10** and **submitting is blocked** until it is
  corrected: school policy is a maximum of ten points per student in one entry.
  The cap is per entry, not per day, so a teacher catching up on a busy week
  simply submits and awards again. Whole-house awards are not capped.
  The limit is enforced in the server action as well as the screen, so it holds
  regardless of what the browser does.
- **Leaderboard** (`/display`) — house totals in house colours, built for a
  projector in assembly, with top 5 students and top 3 classes per house.
  Refreshes itself every 20 seconds.
  Opens with an **animated reveal**: every bar empty at zero in B.E.S.T order,
  then one house at a time fills while its total counts up, sliding into its
  rank as it lands, until the row reads leader to lowest. The winning house is
  then celebrated with **repeating confetti bursts in its own colours**, which
  keep going until stopped.

  The winning house's **mascot** also bursts out of the centre of the screen,
  swelling past the edges and fading as it passes.

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

## Per-screen behaviour

The settings in Admin are the **school-wide default**, shared by every screen.
To make one screen behave differently, change its URL rather than the settings —
bookmark the URL on that machine and leave everything else alone:

| URL | |
|---|---|
| `/display` | the default: full reveal, mascot, confetti |
| `/display?quiet` | standings only — no reveal, mascot or sound |
| `/display?sound=0` | the full reveal, silent |
| `/display?quiet&mascot=1` | mix and match; the URL always wins |

So a lobby screen can sit on `?quiet` showing a calm leaderboard while the
auditorium and classrooms still get the whole show. `animate`, `mascot` and
`sound` each accept `0/1`, `on/off`, `true/false` or `yes/no`.

Note that a lobby screen still needs the staff access code unless "Open without
the access code" is switched on — and that setting *is* school-wide, so turning
it on for the lobby makes the leaderboard reachable by anyone with the link.

## Mascots and sounds

Each house's mascot is a single file in `public/mascots/`, named after the house
in lower case. **It does not have to be an SVG** — `svg`, `png`, `webp`, `jpg`,
`jpeg` and `gif` all work, tried in that order:

```
public/mascots/bears.svg   eagles.svg   sharks.svg   tigers.svg
```

The four that ship are plain flat-vector heads drawn to a consistent style, and
are meant to be replaced. To use student-designed crests, save each drawing over
the matching name — `bears.png`, `eagles.png` and so on — and redeploy. Nothing
else changes. A house with no usable image is skipped silently rather than
breaking the display, so they can be swapped one at a time.

Two things matter for scanned or photographed artwork, both covered in
`public/mascots/README.txt`:

- **Transparent background** (PNG or WebP). The leaderboard is nearly black, so
  a scan on white paper shows as a white box around the crest.
- **At least 1000px on the long side.** The mascot is scaled up as it bursts
  towards the viewer and a small image goes soft. SVG stays sharp at any size,
  which is why it is tried first.

Sounds work the same way and are **not included** — `mp3`, `wav`, `ogg` and `m4a`
are all accepted. See `public/sounds/README.txt` for the convention and some
places to find audio that is free to use. Add `bears.mp3` and friends, then
switch "Mascot sound" on in Admin → Settings.

Two things worth knowing about sound:

- **Browsers refuse to play audio until the page has been clicked.** On a display
  left running unattended, the first reveal after a page load will be silent. The
  screen then offers an "Enable sound" button; one click unlocks audio for the
  rest of the session, and pressing **R** to replay counts as interaction too.
- If sound is switched on before any audio files exist, each reveal logs a
  harmless 404 in the browser console. Nothing breaks; add the files or leave the
  setting off.

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
