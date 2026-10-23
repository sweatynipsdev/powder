# Phase 3: Utah, Colorado, Pacific NW and Whistler — design

Date: 2026-10-23 · Status: approved in chat (Mikey: "looks good")

## Goal

Add 20 out-of-state resorts, so Powder covers the places Mikey and friends travel to, without paid services, sign-up keys or scraping, and inside Open-Meteo's free daily limit.

## Decisions (Q&A, 2026-10-23)

- **Scope: "Core 20"** (below). That makes 41 resorts, about 2,200 Open-Meteo weighted calls per run.
- **Roads:** "I'm ok if we don't have road data for all of the resorts." WSDOT gets built because it needs no key. Utah, Colorado, Oregon and BC get a link to their 511 site. No sign-up keys.
- **Colorado avalanche:** a link to CAIC only. CAIC has no documented API, so reading it would be scraping.
- **Avalanche Canada:** the app shows danger ratings and a link. Their text goes to the writer only, because their terms say content "may not be reproduced".
- **No local forecasters** for the new resorts.

Evidence for all of this is in `docs/superpowers/research/2026-10-23-phase3-sources.md`.

## Constraints (carried)

- No API keys in the client or the repo. No accounts and no server.
- No scraping. Only official, documented, public feeds.
- A source failing marks that source stale and carries its last value forward. It never fails the run.
- No resort data hardcoded in components; everything comes from `resorts.json`.
- Open-Meteo free limits: 600/min, 5,000/hour, 10,000/day.
- Imperial units in the JSON.
- AI prompts stay static. Every number in a write-up must come from the brief.

## Resorts

| Region (as shown in the Resorts tab) | Resorts | Time zone |
|---|---|---|
| Utah | Alta, Snowbird, Brighton, Solitude, Park City, Deer Valley | America/Denver |
| Colorado | Vail, Breckenridge, Keystone, Arapahoe Basin, Copper Mountain, Winter Park, Steamboat, Snowmass | America/Denver |
| Pacific Northwest | Crystal Mountain, Stevens Pass, Mt. Baker, Mt. Bachelor, Mt. Hood Meadows | America/Los_Angeles |
| British Columbia | Whistler Blackcomb | America/Vancouver |

- Every new resort has `defaultFavorite: false`.
- The regions follow the existing ones in `resorts.json` in the order above, so the Resorts tab lists them after SoCal.

## Batches

- **Batch A: the 19 US resorts.** They use the existing US data path (Open-Meteo, NWS, CPC, SNOTEL, avalanche.org, MtnPowder), plus WSDOT for roads and a budget guard.
- **Batch B: Whistler.** It needs the contract to allow a resort with no NWS or CPC coverage, plus two Canadian adapters.

Batch A can be pushed on its own (on Mikey's go) before Batch B is done.

## Batch A: the 19 US resorts

### A1. Roads from more than one agency

**Config.** Each `roads` item is one of two shapes, told apart by `provider`:

- `caltrans` (the default when `provider` is absent, so existing entries don't change): today's fields `label, route, aliases, district, bbox, textRoute, textMatch`.
- `wsdot`: `{ provider: 'wsdot', label, route, pass }`, where `pass` is WSDOT's `PassName` exactly as the feed writes it, e.g. `"Stevens Pass US 2"`.

**Data contract** (`shared/types.ts`):

- `RoadStatus` gains `'advisory'`. The severity order becomes `unknown < clear < advisory < R-1 < R-2 < R-3 < closed`.
- `RoadSegment` gains `restriction: string | null`: the agency's own words for the current restriction, shown instead of the generic label. Caltrans segments set it to `null`, since "Chains R-2" is already Caltrans's own wording.
- `RoadsData` gains `agencies: string[]` (e.g. `["Caltrans"]`, `["WSDOT"]`), for the panel caption and attribution.

**WSDOT adapter** (`pipeline/sources/wsdot.ts`):

- Source: `https://data.wsdot.wa.gov/arcgis/rest/services/TravelInformation/TravelInfoMtPassReports/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=false&f=json`. It's one request per run; the in-run cache shares it across resorts.
- Each configured pass maps to one `RoadSegment`. Its status is the worse of the two directions' `PublicMessage1/2`, matched case-insensitively.
  - Status comes only from the direction messages, never from the `RoadCondition` text. Mt. Baker's report can say SR 542 is closed *above* the ski area (to Artist Point) all winter while the road *to* it is open.

  | WSDOT wording | Status |
  |---|---|
  | contains "closed" | `closed` |
  | "No restrictions" | `clear` |
  | "Traction tires advised" | `advisory` |
  | "Traction tires required" | `R-1` |
  | "Chains required on all vehicles except all wheel drive" | `R-2` |
  | "Chains required on all vehicles" | `R-3` |
  | anything else non-empty | `unknown` |
  | empty or null | ignored for that direction |

- **Wording the adapter doesn't recognize is never `clear`.** The winter wording above comes from news coverage (pass reports start Nov 1), so it gets re-checked against the live feed in November.
- `restriction` is the worst direction's message. When the two directions differ, it's prefixed with that direction (e.g. "Eastbound: Traction tires required").
- `notes` holds the `RoadCondition` and `Weather` texts, when non-empty, so a closure described only there is still visible. `worst.since` comes from `DisplayDate`.
- A configured `pass` missing from the response throws. That's a config error, and the status table should show it.

**Dispatch:** `pipeline/sources/roads.ts` splits a resort's segments by provider, runs `caltrans` and/or `wsdot`, and merges the segments. `worst` covers all of them. `textAsOf` comes from Caltrans; it's `null` when no Caltrans segment exists.

**App and brief:**

- A segment's label is `restriction ?? ROAD_STATUS[status].label`.
- `advisory` gets the `warning` tone and the label "Traction tires advised".
- The Roads panel caption names its agencies: "Caltrans chain controls and highway conditions" and/or "WSDOT mountain pass reports".
- In the brief, a segment's status reads `restriction` when set. Otherwise: `clear` → "no restrictions", `advisory` → "traction tires advised", `R-n` → "chain control R-n", `closed` → "CLOSED", `unknown` → "unknown".
- Resorts with no `roads` keep today's behavior: the `links.roads` page (Utah, Colorado and Oregon 511 sites) is shown in its place, as Mt. Rose's NV 511 link is today.

### A2. Avalanche link where we can't read the center

- `links` gains `avalanche?: url`: the center's forecast page, for resorts whose center has no feed we may read. That's Colorado, linking to CAIC.
- When `avalanche` data is absent and `links.avalanche` is set, the resort page shows a one-line "Avalanche forecast: CAIC ↗" card where the avalanche panel would be. The brief adds nothing.

### A3. Open-Meteo budget guard

- **Log.** On CI full runs, the pipeline appends `timestamp,trigger,weighted_calls` to `logs/openmeteo.csv`. The workflow sets `POWDER_OM_LOG=logs/openmeteo.csv`; `trigger` is `GITHUB_EVENT_NAME`. The existing bot commit adds that file next to `logs/usage.csv`. Local runs don't write it (no env var), so the rule against committing local log changes stays simple.
- **Check.** `scripts/omBudget.ts` (`npm run om-budget`) reads the log and sums the last 24 hours and the last 60 minutes. Its estimate is `resorts × 54 × 1.15`. The 1.15 is the retry margin: retries added 15% on the 2026-10-23 21:49 run (178 of 1,311). It prints the numbers, and reports "defer" when either is true:
  - last 24 h + estimate > **9,500**
  - last 60 min + estimate > **4,900**
- **Workflow.**
  - Only `push` runs that chose a full update run the check.
  - On "defer", the job skips fetch, analysis, deploy and the commit step. It still succeeds, and its summary says: "Deferred: Open-Meteo used N calls in the last 24 h. This push deploys with the next scheduled run."
  - Scheduled and manual runs never defer.

### A4. Time zones

- The "refreshes about 5am and 4pm Pacific" caption (`SourcesNote.svelte`) shows the two update times in the resort's own time zone, e.g. "about 6:20am and 5:20pm MDT".
  - The times come from a shared constant of the cron times (13:20 and 00:20 UTC).
  - A test asserts that `update.yml` still contains them.
- `shared/status.ts` loses its Pacific default. `tz` becomes required, and every caller passes the resort's `tz`.

### A5. Per-resort config, each source verified live

Three research agents (Utah, Colorado, Pacific NW) gather these fields. The controller verifies each one live before it goes into `resorts.json`, and the evidence goes in `docs/superpowers/research/` (the Phase 2 pattern).

- **Core:**
  - Base and summit lat/lon, checked against Open-Meteo's elevation model. The source research had wrong points for 8 candidates.
  - `baseFt`/`summitFt` from the resort itself.
  - `tz`, `region`.
- **NWS:** the office comes from `/points` (SLC; BOU or GJT; SEW; PDT or PQR). `nws.area` and `nws.ignore` are built from each office's discussion vocabulary.
  - October discussions are thin on mountain wording, so these lists get re-checked in January.
- **Snowpack:** the nearest representative SNOTEL within about 30 km and 2,000 ft (the Phase 2 rule).
- **Avalanche:** UAC, NWAC or COAA zone from point-in-polygon against the center's map layer.
  - When the base sits outside every zone but the upper mountain is inside, use that zone (the Northstar precedent).
  - Mt. Hood uses NWAC zone 3032, not 3027.
  - Colorado gets `links.avalanche` (CAIC) instead.
- **Lift report (MtnPowder):**

  | Resort | MtnPowder id | Stations |
  |---|---|---|
  | Winter Park | 5 | BaseArea, MidMountainArea, SummitArea |
  | Steamboat | 6 | BaseArea, MidMountainArea, SummitArea |
  | Deer Valley | 49 | BaseArea, MidMountainArea, SummitArea |
  | Solitude | 65 | MidMountainArea |
  | Arapahoe Basin | 93 | MidMountainArea |
  | Crystal Mountain | 80 | BaseArea, MidMountainArea, SummitArea (last updated May; expected to resume in season) |

  The other 13 have none.
- **Opening dates (2026-27)** for every resort, cited. These drive status for the 13 without a lift report.
- **Roads:**
  - WSDOT segments for Crystal ("Crystal to Greenwater SR 410"), Stevens Pass ("Stevens Pass US 2") and Mt. Baker ("Mt. Baker Hwy SR 542").
  - `links.roads` for Utah (udottraffic.utah.gov), Colorado (cotrip.org) and Oregon (tripcheck.com).
- **Cams:**
  - WSDOT camera stills (`images.wsdot.wa.gov`, from the `TravelInfoCamerasWeather` layer) as `roadCams` for the three Washington resorts.
  - Resort cams only where the resort publishes direct keyless stills.
  - No UDOT or CDOT cams; their camera lists need a key or are undocumented.
- **Local notes** with sources, and `links` (website, webcams, report page, radar station).

### A6. Scale

- **Ranking:** the brief grows from 21 to 40 entries.
  - One forced `npm run analyze -- --force` over all 40 (about $0.10) confirms the ranking finishes with `end_turn` inside `MAX_TOKENS` (8,000).
  - If it doesn't, `MAX_TOKENS` is raised for the ranking call only.
- **Fixtures** grow from about 5.5 MB to about 11 MB.
- **Workflow timeout** stays at 30 minutes. Fetching takes about 5 minutes at 450/min, and the write-ups about 3.

### Testing (Batch A)

- **Unit tests:**
  - Road config parsing: a Caltrans entry without `provider` still parses; a `wsdot` entry parses; a `wsdot` entry without `pass` is rejected.
  - The WSDOT parser on the recorded off-season fixture.
  - The mapping table on made-up winter rows: every tier, differing directions, unmatched wording → `unknown`, "closed" in `RoadCondition` → `closed`, a missing pass throws.
  - Severity ordering with `advisory`.
  - The budget guard: the 24 h and 60 min windows, both thresholds, an empty or missing log.
  - The pipeline writes the CSV row only when `POWDER_OM_LOG` is set.
  - The update-time caption in Mountain and Pacific time, and the cron-times test against `update.yml`.
- **Config:** all 40 resorts validate (the existing config test).
- **Replay:** pipeline replay over all 40 (the existing pipeline test, updated counts).
- **e2e:**
  - The Resorts tab shows Utah, Colorado and Pacific Northwest groups.
  - Alta's page renders with its UDOT link and no roads panel.
  - Vail's page shows the CAIC avalanche link.
  - With Crystal starred, the Roads tab shows its WSDOT segment.
- **Live:**
  - `npm run pipeline`: every configured source ✓, or each gap noted in the evidence file.
  - `npm run record-fixtures`, and the full suite green.
  - `analyze:sample` for Alta, Vail and Crystal, read and reviewed before calling it done.

## Batch B: Whistler

### B1. A resort outside NWS and CPC coverage

- **Config:**
  - `country: 'US' | 'CA'` (default `'US'`).
  - A `'CA'` resort has no `nws` block (a schema refine enforces it) and requires `eccc: { bbox: [south, west, north, east] }`.
  - `avalanche` becomes one of `{ center, zoneId }` (avalanche.org, as today) or `{ provider: 'avcan' }` (Avalanche Canada, looked up by point).
- **Data contract:**
  - `ResortData.nws`, `.afd` and `.cpc` become `Sourced<…> | null`, where `null` means not covered for this resort. `nwsArea` becomes optional.
  - `Alert` gains `source: 'NWS' | 'ECCC'`.
  - `AvalancheData` gains `publicText: boolean`. When false, the app doesn't show `bottomLine` or `discussion`; the brief still uses them.
- **Pipeline:** a `'CA'` resort skips the NWS point forecast, the discussion, the forecasters' grid and CPC (all `null`), and gets alerts from ECCC. Its status-table cells for those read `–`. ENSO is global and stays.
- **App:**
  - The resort page hides the CPC strip and NWS panel when those fields are `null`.
  - The forecast post's source list handles a missing discussion.
  - The sources note credits "Environment and Climate Change Canada" and "Avalanche Canada" where used.
- **Brief and prompt:**
  - The brief leaves out the NWS discussion, NWS forecast and CPC fields when they're `null`.
  - `RESORT_SYSTEM` gains one static line: "Some resorts are outside NWS coverage and have no forecast discussion or forecasters' grid; for those, explain the forecast from the models and ensembles and don't mention the NWS."

### B2. ECCC alerts (`pipeline/sources/eccc.ts`)

- **Source:** `https://api.weather.gc.ca/collections/weather-alerts/items?f=json&bbox=<west>,<south>,<east>,<north>&limit=50`. Keyless, under the ECCC Data Services End-use Licence.
- **Filtering:** drop features with `status_en` "ended" or an `expiration_datetime` in the past. Dedupe on alert identity (the same alert can cover overlapping zones).
- **Mapping** to `Alert`:
  - `event` ← `alert_name_en`
  - `headline` ← `alert_name_en` + `feature_name_en`
  - `description` ← `alert_text_en`, **unaltered**, as the licence requires
  - `severity` ← `risk_colour_en`
  - `onset` / `ends` ← `validity_datetime` / `event_end_datetime`
  - `url` ← `https://weather.gc.ca/warnings/index_e.html?prov=bc`, the BC warnings page
  - `winter` is true for snowfall, winter storm, blizzard, snow squall, freezing rain, extreme cold, wind chill and wind
  - `source` ← `'ECCC'`

### B3. Avalanche Canada (`pipeline/sources/avcan.ts`)

- **Source:** `https://api.avalanche.ca/forecasts/en/products/point?lat=<lat>&long=<lon>`, at the resort's summit point. Documented at avalanche.ca/api-docs, keyless.
- **Mapping** to `AvalancheData`:
  - `upper/middle/lower` ← `alp/tln/btl`. `current` / `tomorrow` ← `dangerRatings[0]` / `[1]`.
  - Rating values: low 1, moderate 2, considerable 3, high 4, extreme 5. `earlyseason`, `norating` and anything unrecognized become 0 (no rating).
  - `bottomLine` ← `highlights`, and `discussion` ← `summaries[].content`, both with HTML stripped.
  - `problems` ← `problems[].type`. `center` is "Avalanche Canada", and `url` ← the product's `url`.
  - `publicText: false`.
- **Shape caveat:** today the API returns one province-wide off-season product. The in-season shape (daily from Nov 25) is unverified, so the parser reads fields defensively. A fixture recorded after Nov 25 confirms the mapping.

### B4. What Whistler gets, and doesn't

- **Gets:**
  - The Open-Meteo forecast (all 8 models and both ensembles return data there).
  - ECCC alerts and Avalanche Canada danger ratings.
  - Status from its opening date.
  - Links: website, webcams, DriveBC, and the ECCC radar page.
- **Doesn't get:**
  - Snowpack: the nearest station is 12 km away and well below the base.
  - A long-range outlook.
  - A lift report, road data, or a forecaster discussion.
  - Its "last 24h" stays empty.

### Testing (Batch B)

- **Unit tests:**
  - Config: a `'CA'` resort without `nws` validates, and one with `nws` is rejected.
  - The ECCC parser on a recorded fixture plus a made-up active alert: ended and expired dropped, deduped, text unaltered.
  - The Avalanche Canada parser on the recorded off-season fixture and a made-up in-season product.
  - The brief has no NWS or CPC fields for Whistler.
- **Replay** over all 41.
- **e2e:** Whistler's page renders with no NWS panel, no CPC strip, and no avalanche text, only the rating and link.
- **Live:** `npm run pipeline` and `analyze:sample` for Whistler, read and reviewed.

## Cost and limits at 41 resorts

- **Open-Meteo:** about 2,200 weighted calls per run before retries, about 2,550 with them. The two scheduled runs use about 5,100 a day.
  - That leaves room for **one full push a day**. A second one defers to the next scheduled run, unless earlier runs have aged out of the 24-hour window.
  - App-only pushes don't count, because they reuse the live data.
- **AI write-ups** (Haiku 5.5 at $0.10 / $0.50 per million tokens, from `logs/usage.csv`): about $0.0025 per resort. That's about $0.10 per morning run, and $0.02–0.05 per afternoon run, which rewrites only changed forecasts. About **$3–6 a month**, against about $1.50–3 at 21 resorts and about $0.50 at the original 4.

## Failure handling

The existing rules hold: each source is isolated, a failed source is stale with its last value carried forward, and nothing fails the run. Additions:
- WSDOT wording the adapter doesn't recognize → `unknown` with the raw text shown, never `clear`.
- A configured WSDOT pass missing from the feed → that source fails, visible in the status table.
- Over the Open-Meteo budget → a push run defers with a summary note. It never fails, and it never deploys half-built data.
- Avalanche Canada's off-season or unrecognized ratings → 0 (no rating), never a guessed level.

## Out of scope

- Keyed road APIs (UDOT, CDOT, ODOT), until Mikey gets keys.
- CAIC data, unless CAIC publishes a documented API or Mikey waives the rule for it.
- Local forecasters for the new resorts.
- Whistler snowpack (BC River Forecast Centre), the ECCC city forecast, and ECCC's CanSIPS outlooks.
- Resorts beyond the Core 20.
