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

Environment variables (all optional):

- `POWDER_OUT_DIR`: where to write the JSON. Default: `public/data`.
- `PREVIOUS_DATA_URL`: the deployed site's `/data/` URL. The previous run is read from here, for stale fallbacks. Without it, the pipeline reads whatever is already in `POWDER_OUT_DIR`.

## The app

Svelte 5 + Vite, with no framework router. It's a static PWA that reads only `data/data.json` and `data/resorts/<id>.json`.

```bash
npm run pipeline && npm run analyze   # put fresh data in public/data
npm run dev                           # http://localhost:5173, also on your LAN (open it on the phone)
npm run build && npm run preview      # the production build, with the service worker
npm run e2e                           # browser checks + screenshots (needs `npm run build` first)
```

- **Offline:** the service worker precaches the app shell. Forecast JSON is network-first with a 4-second timeout, then falls back to the last cached copy. Offline, a banner shows how old that copy is; if data is over 14h old even when online, a banner says updates may have stopped.
- **Add to Home Screen** (iPhone, Safari): open the site, then Share → Add to Home Screen. It launches full-screen with its own icon. Icons come from `public/favicon.svg` via `npx pwa-assets-generator`.
- **Charts** follow a validated colorblind-safe palette. Blue is always "our blend"; the models take the next four slots in fixed order. Every chart has hover, tap and arrow-key readouts, plus a Table view with every value. Temperature, snow level and wind are three small charts sharing one time axis, never one chart with two y-axes.
- **Summit/Base** toggle switches every snow number and chart. The choice is remembered on the device.
- `npm run e2e` checks with WebKit at iPhone size (no page errors, no sideways scrolling, chart tooltip on tap) and then checks offline loading in Chromium. Screenshots go to `screens/`. To debug one route at iPhone size, run `npx tsx scripts/debug-page.ts '#/r/palisades'`.

## Data sources

All are free and need no key or account.

| Source | Used for |
|---|---|
| [Open-Meteo](https://open-meteo.com) forecast API | Hourly precip, temperature, freezing level and wind from GFS, ECMWF, ICON, GEM, HRRR and NBM, at base and summit elevation |
| Open-Meteo ensemble API | GEFS (31 members) + ECMWF ENS (51 members), for ranges and confidence |
| NOAA CPC | 6–10 day, 8–14 day, week 3–4, monthly and seasonal outlooks, plus ENSO status |
| NRCS AWDB (SNOTEL), CDEC, ACIS (CoCoRaHS) | Observed snow depth, SWE and recent change |
| NWS api.weather.gov | Point forecast, active alerts, and the Area Forecast Discussion |
| avalanche.org | Avalanche danger by elevation band |
| Caltrans CWWP2 + roads.dot.ca.gov | Chain controls, full closures and highway conditions on the drive |
| MtnPowder (the resorts' own snow-report feed) | Reported new snow, base depth, lifts and trails open |

When a source fails, the last good value is carried forward and marked stale, and the app shows its age. A run never fails because one source is down.

## How the snow numbers are made

- **Snowfall comes from liquid precipitation and temperature at each elevation.** It doesn't use Open-Meteo's fixed ~7:1 snowfall. The ratio runs from about 8:1 at 32°F to about 17:1 in very cold air, with rain and snow mixing between 32°F and 35°F. See `pipeline/process/slr.ts`.
- **Periods follow OpenSnow:** day runs 5am–5pm and night runs 5pm–5am. They're grouped into days and into 1–5, 6–10 and 11–16 day buckets.
- **Blend:** the mean of the models covering each hour, with HRRR and NBM counted only in the first 48h. Past 72h it leans on the ensemble mean, up to 70% by day 7. Every total is a sum of the same hourly blend, so days, buckets and windows always add up.
- **Range:** ensemble P25–P75, widened to include the blend. Without ensembles, it's the spread of the deterministic models. **Confidence** comes from how wide that range is.

## The daily analysis

`analysis/` writes an OpenSnow-style post per resort: headline, next 5 days, days 6–16, model agreement with a confidence level, and what to watch. It also writes one "best day / best resort this week" ranking.

- **Model:** `claude-haiku-5-5` at effort `medium`. Override with `POWDER_MODEL` / `POWDER_EFFORT`. A run costs about $0.005–0.01, so the season costs well under $1/month. `high` effort cost about 3× more in testing without clearly better writing.
- **Input:** a compact brief (`analysis/brief.ts`) with every number pre-formatted the way the app shows it. It spells out conclusions like "snow level above the summit: rain on the whole mountain" and "not open yet: 0 of 25 lifts" rather than leaving them to inference. The NWS forecast discussion is included, minus sentences about other parts of the office's region (`nws.ignore`).
- **No invented numbers:** the prompt says to use only numbers in the brief. `analysis/grounding.ts` then checks every unit-tagged number in the output against brief numbers of the same unit. A snow claim must match a snow number; it can't borrow a temperature. Any miss, or a mention of "the brief" or a field name, triggers one retry that names the problem. If it still fails, the text is published with the offending numbers listed in `ungrounded`.
- **Cost control:**
  - The static system prompt is cached, so calls 2–4 of a run read it from cache.
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
  "baseFt": 7800, "summitFt": 9800,
  "tz": "America/Los_Angeles",
  "nws": { "afdOffice": "REV" }     // NWS office whose forecast discussion covers it
}
```

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
- `roadCams`, `links.cams`: `[{ "label", "url" }]` still images.
- `links.webcams`, `links.radar`, `links.website`: page links.

Then run `npm run pipeline` and check the status table. Run `npm run record-fixtures` afterwards so the tests cover the new resort.
