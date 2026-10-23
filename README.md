# Powder

A personal snow-forecast PWA, built as a replacement for OpenSnow. It covers Palisades Tahoe, Alpine, Mammoth and Big Bear, and new resorts are added with one entry in `resorts.json`.

A scheduled script pulls free public data twice a day and writes static JSON. The app reads only that JSON, so no API keys ever reach the browser.

## Setup

Requires Node 22 or newer.

```bash
npm install
cp .env.example .env    # then put your Anthropic API key in .env (gitignored)
npm run pipeline        # fetch everything live → public/data/
npm run analyze         # write the daily analysis into public/data/
npm test                # offline tests against recorded fixtures
npm run typecheck
```

### Secrets

The only secret is `ANTHROPIC_API_KEY`, and it's used only by the analysis step.

- **Locally** it lives in `.env`, which is gitignored.
- **In GitHub** it's an Actions secret: Settings → Secrets and variables → Actions → `ANTHROPIC_API_KEY`.
- **The app never sees it.** It reads only the static JSON.

Without a key, `npm run analyze` keeps the previous write-ups and exits cleanly, so the data still updates.

## Commands

| Command | What it does |
|---|---|
| `npm run pipeline` | Fetches every source live and writes `public/data/data.json` plus `public/data/resorts/<id>.json`. Prints a per-source status table. |
| `npm run record-fixtures` | Same as `pipeline`, but also saves every HTTP response to `test/fixtures/http/`. Re-run it when a source changes format. |
| `npm run pipeline:replay` | Runs the pipeline with no network, replaying the saved fixtures, with the clock frozen to the recording time. |
| `npm test` | Unit tests plus a full offline replay of the pipeline, including a simulated outage. |
| `npm run analyze` | Writes each resort's daily analysis and the cross-resort ranking into the JSON. Appends a line to `logs/usage.csv`. |
| `npm run analyze -- --force` | Rewrites everything regardless of schedule or change detection. |
| `npm run analyze:sample` | `--force`, and also writes `samples/analysis-sample.md` for reading the write-ups side by side. |
| `npm run calibrate` | Learns each mountain's per-model bias from `history/` and writes `history/calibration.json`, which the next pipeline run applies. See [The local edge](#the-local-edge). |
| `npm run reuse-data` | Copies the live site's data (`PREVIOUS_DATA_URL`) into `POWDER_OUT_DIR` without fetching anything. The workflow uses it for app-only pushes. It's also the quickest way to get real data for local UI work. |

Environment variables (all optional):

- `POWDER_OUT_DIR`: where to write the JSON. Default: `public/data`.
- `PREVIOUS_DATA_URL`: the deployed site's `/data/` URL. The previous run is read from here, for stale fallbacks. Without it, the pipeline reads whatever is already in `POWDER_OUT_DIR`.
- `POWDER_RECORD_HISTORY=1`: append this run's forecasts and observations to `history/`. The scheduled workflow sets it; local runs leave history alone.
- `POWDER_HISTORY_DIR`: where history and calibration live. Default: `history/`.

## The app

Svelte 5 + Vite, with no framework router. It's a static PWA that reads only `data/data.json` and `data/resorts/<id>.json`.

```bash
npm run pipeline && npm run analyze   # put fresh data in public/data
npm run dev                           # http://localhost:5173, also on your LAN (open it on the phone)
npm run build && npm run preview      # the production build, with the service worker
npm run e2e                           # browser checks + screenshots (needs `npm run build` first)
```

The layout follows OpenSnow's app, always in a dark theme:

- **Bottom tabs:**
  - **Favorites:** each starred resort with its status, last 24 hours, the next 1–5 and 6–10 days, a 10-day bar strip and the AI headline. A "best bet this week" card sits on top.
  - **Resorts:** every resort grouped by region, with search and a star to add or remove it.
  - **Forecasts:** your favorites' write-ups and local experts, with the other resorts collapsed below.
  - **Roads:** chain controls and highway cams for the drive to each favorite.
- **Favorites are per phone,** kept in `localStorage` (`powder.favorites`) with no account.
  - A phone that hasn't picked any starts with the resorts marked `"defaultFavorite": true` and sees a "pick yours" banner.
  - The best bet is the highest-ranked of your favorites in the AI ranking, which covers every resort.
  - All favorites are fetched in the background, so they all work offline, not just the ones you've opened.
- **Resort page tabs:**
  - **Weather:** right now, hourly table (72h), daily day/night table, and the temperature / snow level / wind charts.
  - **Snow Summary:** the snow timeline (previous 5 days observed, the last 24 hours, then the next 16 days grouped 1–5 / 6–10 / 11–16; tap a day for details), cams, the AI and local-expert forecasts, the model comparison chart, and the CPC outlook.
  - **Snow Report:** recent snow, the live snow station, avalanche danger, roads, and the local-knowledge notes.
  - **Forecast:** the full written forecast, styled like an OpenSnow Daily Snow post.

- **Offline:** the service worker precaches the app shell. Forecast JSON is network-first with a 4-second timeout, then falls back to the last cached copy. Offline, a banner shows how old that copy is; if data is over 14h old even when online, a banner says updates may have stopped.
- **Add to Home Screen** (iPhone, Safari): open the site, then Share → Add to Home Screen. It launches full-screen with its own icon. Icons come from `public/favicon.svg` via `npx pwa-assets-generator`.
- **Charts** follow a validated colorblind-safe palette. Blue is always "our blend"; the models take the next four slots in fixed order. Every chart has hover, tap and arrow-key readouts, plus a Table view with every value. Temperature, snow level and wind are three small charts sharing one time axis, never one chart with two y-axes.
- **Summit/Base** toggle switches every snow number and chart. The choice is remembered on the device.
- `npm run e2e` checks every screen with WebKit at iPhone size (no page errors, no sideways scrolling, dark even in light mode, a timeline tap opens a day, a chart tap shows its tooltip, a cam loads) and then checks offline loading in Chromium. Screenshots go to `screens/`. To debug one route at iPhone size, run `npx tsx scripts/debug-page.ts '#/r/palisades'`.

## Data sources

All are free and need no key or account.

| Source | Used for |
|---|---|
| [Open-Meteo](https://open-meteo.com) forecast API | Hourly precip, temperature, freezing level, wind, cloud and precip chance from GFS, ECMWF IFS (9 km), ICON, GEM, ECMWF AIFS, HRRR, NAM 3km and NBM, at base and summit elevation |
| Open-Meteo ensemble API | GEFS (31 members) + ECMWF ENS (51 members), for ranges and confidence |
| NOAA CPC | 6–10 day, 8–14 day, week 3–4, monthly and seasonal outlooks, plus ENSO status |
| NRCS AWDB (SNOTEL), CDEC, ACIS (CoCoRaHS) | Observed snow depth, SWE and recent change |
| NWS api.weather.gov | Point forecast, active alerts, the Area Forecast Discussion, and the forecasters' gridded snowfall at the base and summit points |
| Local forecasters' pages (e.g. [The Mammoth Snowman](https://www.mammothsnowman.com/mammoth-mountain-weather-forecast/)) via the site's public WordPress API | Their latest discussion, read by the AI writer only. The app shows who, when and a link, never their text |
| avalanche.org | Avalanche danger by elevation band |
| Caltrans CWWP2 + roads.dot.ca.gov | Chain controls, full closures and highway conditions on the drive |
| MtnPowder (the resorts' own snow-report feed) | Reported new snow, base depth, lifts and trails open |

When a source fails, the last good value is carried forward and marked stale, and the app shows its age. A run never fails because one source is down.

**Open-Meteo's free tier** allows 600 calls a minute and 10,000 a day, counted by size: `locations × days/14 × variables/10`, where every model or ensemble member counts its variables. A resort's two requests weigh about 54 calls (16.5 deterministic plus 37.5 ensemble), so 35 resorts are about 1,900 per run.
- `pipeline/sources/omBudget.ts` paces requests to 450 a minute, and the run summary prints the total.
- A push that changes only the app doesn't refetch anything: the workflow rebuilds against the live data (`npm run reuse-data`). It falls back to a full run if that data is incomplete.
- Scheduled runs, manual runs, and pushes touching `pipeline/`, `analysis/`, `shared/`, `resorts.json`, `scripts/calibrate.ts` or the update workflow always do a full update.

## How the snow numbers are made

- **Snowfall comes from liquid precipitation and temperature at each elevation.** It doesn't use Open-Meteo's fixed ~7:1 snowfall. The ratio runs from about 8:1 at 32°F to about 17:1 in very cold air, with rain and snow mixing between 32°F and 35°F. See `pipeline/process/slr.ts`.
- **Periods follow OpenSnow:** day runs 5am–5pm and night runs 5pm–5am. They're grouped into days and into 1–5, 6–10 and 11–16 day buckets.
- **Blend:** the mean of the models covering each hour, with HRRR, NAM 3km and NBM counted only in the first 48h, and the NWS forecasters' grid counted as one more model. Past 72h it leans on the ensemble mean, up to 70% by day 7. Every total is a sum of the same hourly blend, so days, buckets and windows always add up.
- **Range:** ensemble P25–P75, widened to include the blend. Without ensembles, it's the spread of the deterministic models. **Confidence** comes from how wide that range is.

## The local edge

OpenSnow's best feature is local knowledge: forecasters who know each mountain, plus models tuned to it. Powder gets as close as free data allows:

- **NWS forecaster numbers.** The NWS offices hand-edit a 2.5 km forecast grid. Its snowfall at the base and summit points shows up as the "NWS forecasters" line next to the models (about 7 days out), and the writer treats it as the local professionals' call. The grid cell's own elevation is recorded in `nwsGridFt`.
- **Sharper models.** ECMWF uses the 9 km IFS run, plus ECMWF's AI model (AIFS). NAM 3km joins HRRR and NBM for the first 48 hours.
- **Local knowledge notes.** `local.notes` in `resorts.json` holds facts about each mountain: which storm tracks favor it, which lifts go on wind hold, how warm storms behave. The writer uses them where they explain the forecast, and the Snow Report tab lists them (their sources stay in `resorts.json`).
- **Local experts.** A resort's `expert` block reads a local forecaster's page. The writer compares its forecast with theirs and credits them. The app links to their site and never republishes their text. Only Mammoth has one so far: The Mammoth Snowman.
- **The local model.** Every scheduled run appends what each model forecast for the next 7 days, and what the resort or station then observed, to `history/` (committed by the workflow). `npm run calibrate` runs before each pipeline. It pairs each morning's observed 24h snow with the forecasts made one and two mornings earlier, and learns a per-mountain, per-model multiplier: for example, ×1.3 for a model that runs 30% low at Mammoth. A model needs 6 snow events (2"+ forecast or observed) before it gets a correction, and corrections are clamped to ×0.6–×1.6. Until then the blend is unadjusted. Expect the first corrections a few storms into the season.

## The daily analysis

`analysis/` writes an OpenSnow-style post per resort: headline, a 2–3 sentence summary, next 5 days, days 6–16, model agreement with a confidence level, and what to watch. It also writes one "best day / best resort this week" ranking.

- **Model:** `claude-haiku-5-5` at effort `medium`. Override with `POWDER_MODEL` / `POWDER_EFFORT`. A run costs about $0.005–0.01, so the season costs well under $1/month. `high` effort cost about 3× more in testing without clearly better writing.
- **Input:** a compact brief (`analysis/brief.ts`) with every number pre-formatted the way the app shows it. It spells out conclusions like "snow level above the summit: rain on the whole mountain" and "not open yet: 0 of 25 lifts" rather than leaving them to inference. The NWS forecast discussion is included, minus sentences about other parts of the office's region (`nws.ignore`).
- **Local input:** the brief also carries the resort's `local.notes` and, when it's under 4 days old, the local expert's discussion. The writer must say whether that call agrees with the models and credit it by name and site.
- **No invented numbers:** the prompt says to use only numbers in the brief. `analysis/grounding.ts` then checks every unit-tagged number in the output against brief numbers of the same unit. A snow claim must match a snow number; it can't borrow a temperature. Any miss, or a mention of "the brief" or a field name, triggers one retry that names the problem. If it still fails, the text is published with the offending numbers listed in `ungrounded`.
- **Cost control:**
  - The static system prompt is cached. The first write-up runs alone to write the cache, and the rest run 4 at a time reading it, so 35 resorts finish well inside the job's 30-minute limit.
  - Morning runs rewrite everything; afternoon runs rewrite only resorts whose forecast materially changed (`analysis/fingerprint.ts`).
  - A failed or declined call keeps the previous write-up.
  - Token usage and cost for every run go to `logs/usage.csv`.

## Adding a resort

Add an object to `resorts.json`. Only the core fields are required:

```jsonc
{
  "id": "kirkwood",                 // lowercase, used in URLs and file names
  "name": "Kirkwood Mountain Resort",
  "shortName": "Kirkwood",
  "region": "Tahoe",
  "lat": 38.684, "lon": -120.065,   // base area
  "summit": { "lat": 38.677, "lon": -120.081 },  // optional: where to read the NWS forecasters' summit grid
  "baseFt": 7800, "summitFt": 9800,
  "tz": "America/Los_Angeles",
  "nws": { "afdOffice": "REV" }     // NWS office whose forecast discussion covers it
}
```

Add `"defaultFavorite": true` to put a resort on the Favorites tab of phones that haven't picked their own yet.

`nws.area` (e.g. `"Lake Tahoe and the Sierra crest near I-80"`) tells the write-up which part of the office's discussion applies. `nws.ignore` drops discussion sentences that mention other places (e.g. `"Oregon border"`). Both are optional but worth setting.

Optional blocks turn on more panels. Each panel hides when its block is missing:

- `snowpack`: `{ "type": "awdb" | "cdec" | "acis", "id", "name", "elevFt" }`.
  - SNOTEL triplets (e.g. `784:CA:SNTL`) use `awdb`.
  - California snow pillows (e.g. `MHP`) use `cdec`.
  - CoCoRaHS observers (e.g. `US1CASR0098`) use `acis`.
- `avalanche`: `{ "center": "SAC", "zoneId": 2458 }`. Zone ids come from `https://api.avalanche.org/v2/public/avalanche-center/<CENTER>`.
- `report`: `{ "adapter": "mtnpowder", "resortId": 61, "stations": ["BaseArea", "MidMountainArea", "SummitArea"] }`. Optional fields:
  - `areas`: count lifts only in these mountain areas.
  - `extraResortIds`: sum in a sister resort's lifts.
- `roads`: `[{ "label", "route": "SR-89", "district": 3, "bbox": [south, west, north, east], "textRoute": "SR 89", "textMatch": ["Truckee", …] }]`.
  - Chain-control stations inside `bbox` on that route set the segment's status.
  - `textMatch` picks the relevant lines from Caltrans' highway-conditions text.
- `local`: `{ "notes": ["…"], "sources": [{ "label", "url" }], "openingDate": "2026-11-13" }`. The notes feed the writer and the Snow Report tab. Until `openingDate`, the status reads "Opening Nov 13".
- `expert`: `{ "adapter": "wordpress-page", "source": "The Mammoth Snowman", "author": "Steve Taylor", "api": "https://…/wp-json/wp/v2/pages/<id>?_fields=modified_gmt,link,title,content", "url": "<page link>", "cutAt": "<heading where the forecast ends>" }`. Works for any forecaster whose site runs WordPress. The post time comes from their dateline ("Wednesday, October 21st, 2026 @ 2 PM"), falling back to the page's edit time.
- `roadCams`, `links.cams`: `[{ "label", "url" }]` still images.
- `links.webcams`, `links.radar`, `links.website`: page links.

Then run `npm run pipeline` and check the status table. Run `npm run record-fixtures` afterwards so the tests cover the new resort.
