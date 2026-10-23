# Powder

A personal snow-forecast PWA, built as a replacement for OpenSnow. It covers Palisades Tahoe, Alpine, Mammoth and Big Bear, and new resorts are added with one entry in `resorts.json`.

A scheduled script pulls free public data twice a day and writes static JSON. The app reads only that JSON, so no API keys ever reach the browser.

## Setup

Requires Node 22 or newer.

```bash
npm install
npm run pipeline        # fetch everything live → public/data/
npm test                # offline tests against recorded fixtures
npm run typecheck
```

## Commands

| Command | What it does |
|---|---|
| `npm run pipeline` | Fetches every source live and writes `public/data/data.json` plus `public/data/resorts/<id>.json`. Prints a per-source status table. |
| `npm run record-fixtures` | Same as `pipeline`, but also saves every HTTP response to `test/fixtures/http/`. Re-run it when a source changes format. |
| `npm run pipeline:replay` | Runs the pipeline with no network, replaying the saved fixtures, with the clock frozen to the recording time. |
| `npm test` | Unit tests plus a full offline replay of the pipeline, including a simulated outage. |

Environment variables (all optional):

- `POWDER_OUT_DIR`: where to write the JSON. Default: `public/data`.
- `PREVIOUS_DATA_URL`: the deployed site's `/data/` URL. The previous run is read from here, for stale fallbacks. Without it, the pipeline reads whatever is already in `POWDER_OUT_DIR`.

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
