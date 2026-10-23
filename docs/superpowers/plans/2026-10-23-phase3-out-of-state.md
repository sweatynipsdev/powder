# Phase 3: out-of-state resorts — plan

**Goal:** add 20 resorts (Utah 6, Colorado 8, Pacific NW 5, Whistler) to Powder, inside free limits, without keys or scraping.

**Architecture:**
- **Batch A (T1–T8):** the 19 US resorts.
  - They reuse the existing US data path.
  - Roads become multi-agency, with a keyless WSDOT adapter.
  - New: a CAIC link card, an Open-Meteo budget guard on push runs, and Mountain-time fixes.
- **Batch B (T9–T12):** a non-US resort.
  - `country: 'CA'` makes the NWS and CPC fields nullable.
  - New adapters: ECCC alerts and Avalanche Canada.
- **Research:** per-resort config research runs in background agents while T1–T5 are built inline.

**Spec:** `docs/superpowers/specs/2026-10-23-phase3-out-of-state-design.md`. Source evidence: `docs/superpowers/research/2026-10-23-phase3-sources.md`.

## Global constraints (verbatim from the spec)

- **Resorts and regions:**
  - Utah (America/Denver): Alta, Snowbird, Brighton, Solitude, Park City, Deer Valley.
  - Colorado (America/Denver): Vail, Breckenridge, Keystone, Arapahoe Basin, Copper Mountain, Winter Park, Steamboat, Snowmass.
  - Pacific Northwest (America/Los_Angeles): Crystal Mountain, Stevens Pass, Mt. Baker, Mt. Bachelor, Mt. Hood Meadows.
  - British Columbia (America/Vancouver): Whistler Blackcomb.
  - All `defaultFavorite: false`. Regions go after SoCal, in that order.
- **Road severity order:** `unknown < clear < advisory < R-1 < R-2 < R-3 < closed`.
- **WSDOT source:** `https://data.wsdot.wa.gov/arcgis/rest/services/TravelInformation/TravelInfoMtPassReports/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=false&f=json`
- **WSDOT status:** from the direction messages only, never from `RoadCondition`. Wording the adapter doesn't recognize is `unknown`, never `clear`. A configured pass missing from the feed throws.
- **Budget guard:**
  - Estimate is `resorts × 54 × 1.15`.
  - Defer when last 24 h + estimate > **9,500** or last 60 min + estimate > **4,900**.
  - Only `push` runs that chose a full update are checked. The log is `logs/openmeteo.csv` with columns `timestamp,trigger,weighted_calls`, written only when `POWDER_OM_LOG` is set.
- **Cron times:** 13:20 and 00:20 UTC.
- **MtnPowder:**
  - Winter Park 5, Steamboat 6, Deer Valley 49: BaseArea, MidMountainArea, SummitArea.
  - Solitude 65 and Arapahoe Basin 93: MidMountainArea.
  - Crystal 80: BaseArea, MidMountainArea, SummitArea.
  - None for the rest.
- **ECCC:** `https://api.weather.gc.ca/collections/weather-alerts/items?f=json&bbox=<west>,<south>,<east>,<north>&limit=50`. Alert text is unaltered.
- **Avalanche Canada:** `https://api.avalanche.ca/forecasts/en/products/point?lat=<lat>&long=<lon>`, with `publicText: false`.
- **Rating map:** low 1, moderate 2, considerable 3, high 4, extreme 5, anything else 0.
- **Colorado avalanche:** `links.avalanche` set to CAIC (`https://avalanche.state.co.us/`). No adapter.

## Risky inputs (each pinned to a test)

| # | Input | Expected | Test in |
|---|---|---|---|
| 1 | WSDOT winter wording we haven't seen | `unknown`, raw text kept in `restriction` | T2 |
| 2 | "Chains required on all vehicles except all wheel drive" | `R-2`, not `R-3` | T2 |
| 3 | "Traction tires required. Chains required on vehicles towing and over 10,000 GVW." | `R-1` (passenger cars), not `R-3` | T2 |
| 4 | Mt. Baker `RoadCondition` says SR 542 is closed above the ski area; messages say "No restrictions" | `clear`, with the closure text in `notes` | T2 |
| 5 | The two directions differ | Worse direction wins; `restriction` gets a "Eastbound: " prefix | T2 |
| 6 | Caltrans entries in `resorts.json` with no `provider` | Parse as Caltrans; existing replay output unchanged | T1 |
| 7 | A phone's cached data from before Batch A (no `agencies`, `restriction`, `publicText`, `source`) | The app falls back: `['Caltrans']`, `null`, `true`, `'NWS'` | T1, T9 |
| 8 | `logs/openmeteo.csv` missing or header-only (the first run after deploy) | No defer | T4 |
| 9 | A log row exactly 24 h old | Not counted | T4 |
| 10 | Refresh caption in winter and summer | MST 6:20am / 5:20pm; MDT 7:20am / 6:20pm; PST 5:20am / 4:20pm | T5 |
| 11 | Crystal's MtnPowder report is stale since May | Before its opening date, status reads "Opening …", not "Closed" | T6 (`openingDate` required for all 19) |
| 12 | Base point outside every avalanche zone, upper mountain inside (Park City, Deer Valley) | Use the zone covering the summit point | T6 |
| 13 | Whistler's `nws`/`afd`/`cpc` are `null` | Resort page renders; brief has none of those fields | T9 |
| 14 | One ECCC alert covering several overlapping zones | Shown once | T10 |
| 15 | Avalanche Canada off-season product (`earlyseason` ratings) | Ratings 0, no throw | T11 |

---

## T1. Roads from more than one agency (contract, config, display)

**Files:**
- Modify: `shared/types.ts`, `pipeline/config.ts`, `pipeline/sources/caltrans.ts`, `pipeline/run.ts`, `src/lib/display.ts`, `src/components/RoadsPanel.svelte`, `src/components/SourcesNote.svelte`, `analysis/brief.ts`
- Create: `pipeline/sources/roads.ts`
- Test: `test/pipeline/sources.test.ts`, `test/pipeline/pipeline.test.ts`, `test/analysis/analysis.test.ts`

**Produces:**
```ts
// shared/types.ts
export type RoadStatus = 'clear' | 'advisory' | 'R-1' | 'R-2' | 'R-3' | 'closed' | 'unknown';
export interface RoadSegment { /* existing fields */ restriction: string | null }
export interface RoadsData { segments: RoadSegment[]; worst: RoadStatus; textAsOf: string | null; agencies: string[] }

// pipeline/config.ts
const caltransSegment = z.object({ provider: z.literal('caltrans').default('caltrans'), /* today's roadSegment fields */ });
const wsdotSegment = z.object({ provider: z.literal('wsdot'), label: z.string(), route: z.string(), pass: z.string().min(1) });
const roadSegment = z.union([wsdotSegment, caltransSegment]);
export type CaltransSegmentConfig = z.infer<typeof caltransSegment>;
export type WsdotSegmentConfig = z.infer<typeof wsdotSegment>;

// pipeline/sources/roads.ts
export const SEVERITY: RoadStatus[] = ['unknown', 'clear', 'advisory', 'R-1', 'R-2', 'R-3', 'closed'];
export const worse: (a: RoadStatus, b: RoadStatus) => RoadStatus;
export async function fetchRoads(r: ResortConfig): Promise<RoadsData>; // segments in config order

// pipeline/sources/caltrans.ts
export async function fetchCaltrans(segments: CaltransSegmentConfig[]): Promise<{ segments: RoadSegment[]; textAsOf: string | null }>;

// analysis/brief.ts
export function roadStatusText(s: RoadSegment): string;
```

- [x] **Tests first:**
  - A Caltrans entry with no `provider` parses with `provider: 'caltrans'`.
  - A `wsdot` entry parses.
  - A `wsdot` entry without `pass` is rejected.
  - `worse('clear', 'advisory') === 'advisory'` and `worse('advisory', 'R-1') === 'R-1'`.
  - `roadStatusText` follows the spec's wording, and a set `restriction` wins.
  - Replay: every Caltrans segment has `restriction: null`; Palisades' `roads.data.agencies` is `['Caltrans']`.
- [x] Move `SEVERITY` and `worse` from `caltrans.ts` into `roads.ts`, with `advisory` inserted. `caltrans.ts` imports them.
- [x] Split `caltrans.ts`'s `fetchRoads` into `fetchCaltrans(segments)`. `buildSegment` sets `restriction: null`.
- [x] `roads.ts` `fetchRoads`:
  - Partitions by `provider`, runs `fetchCaltrans` for Caltrans segments. The `wsdot` branch is wired in T2; until then, a `wsdot` segment throws "not implemented".
  - Reassembles in config order.
  - Sets `agencies`: `'Caltrans'` and/or `'WSDOT'`, in first-seen order.
  - Sets `worst` over all segments, and `textAsOf` from the Caltrans part.
- [x] `run.ts` imports `fetchRoads` from `./sources/roads`.
- [x] `display.ts`: add `advisory: { tone: 'warning', label: 'Traction tires advised', icon: '⛓' }`.
- [x] `RoadsPanel.svelte`:
  - Segment label is `seg.restriction ?? ROAD_STATUS[seg.status].label`.
  - Caption is built from `roads.agencies ?? ['Caltrans']`: "Caltrans chain controls and highway conditions", "WSDOT mountain pass reports", joined with " · ".
- [x] `SourcesNote.svelte`: the roads label is `r.roads?.data?.agencies?.join(' + ') ?? 'Roads'`.
- [x] `brief.ts`: road status uses `roadStatusText`.
- [x] Run `npm test` and `npm run typecheck`, then commit "T1: roads from more than one agency; advisory tier; agency wording".

## T2. WSDOT pass reports (`pipeline/sources/wsdot.ts`)

**Files:**
- Create: `pipeline/sources/wsdot.ts`
- Modify: `pipeline/sources/roads.ts`
- Test: `test/pipeline/sources.test.ts`

**Consumes:** `WsdotSegmentConfig`, `RoadSegment`, `SEVERITY`/`worse` from T1.

**Produces:**
```ts
export const WSDOT_PASSES_URL = '<global constraint URL>';
export interface WsdotPass { name: string; roadCondition: string; weather: string; displayDate: string | null; directions: { direction: string; message: string }[] }
export function parseWsdot(json: unknown): WsdotPass[];              // throws without a features array
export function wsdotStatus(message: string): RoadStatus | null;    // null for empty
export function buildWsdotSegment(cfg: WsdotSegmentConfig, passes: WsdotPass[]): RoadSegment;  // throws if cfg.pass is missing
export async function fetchWsdot(segments: WsdotSegmentConfig[]): Promise<RoadSegment[]>;
```

`wsdotStatus` checks these in order, case-insensitively, after trimming:

| Order | Pattern | Status |
|---|---|---|
| 1 | empty | `null` |
| 2 | `/\bclosed\b/` | `closed` |
| 3 | `/chains? (?:are )?required on all vehicles except/` | `R-2` |
| 4 | `/chains? (?:are )?required on all vehicles/` | `R-3` |
| 5 | `/traction tires (?:are )?required/` | `R-1` |
| 6 | `/traction tires (?:are )?advised/` | `advisory` |
| 7 | `/^no restrictions\.?$/` | `clear` |
| 8 | anything else | `unknown` |

- [x] **Tests first.** An inline sample built from the live 2026-10-23 response (Stevens, Snoqualmie, Crystal to Greenwater, Mt. Baker rows, off-season text) plus made-up winter rows. They cover risky inputs 1–5:
  - each tier;
  - `"Oversize vehicles prohibited."` → `unknown`;
  - a missing pass throws;
  - `notes` holds `RoadCondition` and `Weather`, empty strings dropped;
  - `stations` is 0 and `closures` is `[]`.
- [x] `parseWsdot` reads `features[].attributes`, with `TravelDirection1/2` and `PublicMessage1/2` into `directions`. Empty or null messages are skipped.
- [x] `buildWsdotSegment`:
  - Status is the worst `wsdotStatus` over the directions, or `unknown` when none.
  - `restriction` is the worst direction's message, prefixed "<Direction>: " when the two directions' statuses differ.
  - `worst`: `{ name: PassName, status: message, description: RoadCondition, since: DisplayDate }`.
- [x] `fetchWsdot` makes one `fetchJson(WSDOT_PASSES_URL)` (the in-run cache shares it), then maps the segments.
- [x] `roads.ts` wires the `wsdot` branch.
- [x] Run `npm test`, then commit "T2: WSDOT mountain pass reports".

## T3. Avalanche link where we can't read the center

**Files:**
- Modify: `pipeline/config.ts` (`links.avalanche: z.url().optional()`), `shared/types.ts` (`links.avalanche?: string | null`), `pipeline/run.ts`, `src/routes/Resort.svelte`
- Test: `test/pipeline/pipeline.test.ts`

- [x] **Test first:** a config with `links.avalanche` validates, and `buildResort` copies it into `links.avalanche`.
- [x] In `Resort.svelte`, where `AvalanchePanel` renders: when `r.avalanche?.data` is absent and `r.links.avalanche` is set, render a card reading "Avalanche forecast" with a link "<host> ↗". The host is from the URL, e.g. "avalanche.state.co.us".
- [x] Run `npm test` and `npm run typecheck`, then commit "T3: avalanche center link where there is no feed".

## T4. Open-Meteo budget guard

**Files:**
- Modify: `pipeline/sources/omBudget.ts`, `pipeline/run.ts`, `.github/workflows/update.yml`, `package.json` (`"om-budget": "tsx scripts/omBudget.ts"`)
- Create: `scripts/omBudget.ts`, `logs/openmeteo.csv` (header only)
- Test: `test/pipeline/omBudget.test.ts`

**Produces (`omBudget.ts`):**
```ts
export const OM_LOG_HEADER = 'timestamp,trigger,weighted_calls';
export const PER_RESORT_WEIGHT = 54, RETRY_MARGIN = 1.15, DAY_LIMIT = 9_500, HOUR_LIMIT = 4_900;
export interface OmLogRow { at: Date; trigger: string; weight: number }
export function parseOmLog(csv: string): OmLogRow[];  // skips header, blank and malformed lines
export function omLogLine(at: Date, trigger: string, weight: number): string;  // `${iso},${trigger},${Math.round(weight)}`
export function appendOmLog(path: string, at: Date, trigger: string, weight: number): void;  // writes header when the file is new
export function budgetCheck(rows: OmLogRow[], now: Date, resorts: number): { day: number; hour: number; estimate: number; defer: boolean };
```

- [x] **Tests first:**
  - `parseOmLog` on header-only, empty and malformed lines.
  - The windows: a row exactly 24 h old is excluded (risky input 9), a row 59 min old is in the hour.
  - Each threshold: day only, hour only, neither.
  - Missing log → `[]` → no defer (risky input 8).
  - `appendOmLog` writes the header once.
- [x] `run.ts`: after a live run, `if (live && process.env.POWDER_OM_LOG) appendOmLog(process.env.POWDER_OM_LOG, at, process.env.GITHUB_EVENT_NAME ?? 'local', omPacer.total)`.
- [x] `scripts/omBudget.ts`:
  - Loads the config for the resort count and reads `logs/openmeteo.csv` (missing → empty), then runs `budgetCheck(now)`.
  - Prints `Open-Meteo budget: <day> in 24 h, <hour> in 60 min, this run ≈ <estimate> → ok|defer`.
  - Writes `defer=true|false` to `$GITHUB_OUTPUT` when set.
  - On defer, appends to `$GITHUB_STEP_SUMMARY`: "Deferred: Open-Meteo used N calls in the last 24 h. This push deploys with the next scheduled run."
- [x] `update.yml`:
  - New step "Check the Open-Meteo budget", `id: budget`, after "Choose a full update or reuse", with `if: github.event_name == 'push' && steps.mode.outputs.mode == 'full'`. It runs `npm run om-budget`.
  - Every later step's `if` also requires `steps.budget.outputs.defer != 'true'`. That includes Build, configure-pages, upload and deploy, which have no `if` today.
  - The pipeline step gets `POWDER_OM_LOG: logs/openmeteo.csv`.
  - The commit step adds `logs/openmeteo.csv`.
- [x] Create `logs/openmeteo.csv` with the header line only.
- [x] Run `npm test`, and check `update.yml` with `node -e` YAML parse via the `yaml` package if present, otherwise by careful read. Commit "T4: Open-Meteo budget guard for push runs".

## T5. Time zones

**Files:**
- Create: `shared/schedule.ts`
- Modify: `src/components/SourcesNote.svelte`, `shared/status.ts`
- Test: `test/pipeline/process.test.ts` (shared logic tests live there; check first and use the file that already tests `shared/status.ts`)

**Produces:**
```ts
/** Keep in step with the cron lines in .github/workflows/update.yml (a test checks). */
export const UPDATE_TIMES_UTC: { h: number; m: number }[] = [{ h: 13, m: 20 }, { h: 0, m: 20 }];
export function refreshCaption(tz: string, ref: Date): string; // "about 6:20am and 5:20pm MST", earliest local time first
```

- [x] **Tests first (risky input 10):**
  - `refreshCaption('America/Denver', 2026-12-01)` → "about 6:20am and 5:20pm MST".
  - The same in July → "about 7:20am and 6:20pm MDT".
  - `America/Los_Angeles` in December → "about 5:20am and 4:20pm PST".
  - `update.yml` contains `'20 13 * * *'` and `'20 0 * * *'`, matching `UPDATE_TIMES_UTC`.
- [x] `SourcesNote.svelte` uses `refreshCaption(r.tz, new Date())`.
- [x] `status.ts`: `StatusOptions.tz` becomes required (`tz: string`), and the Pacific default goes. Both callers already pass it.
- [x] Run `npm test` and `npm run typecheck`, then commit "T5: refresh times and status in the resort's time zone".

## T6. Research and config for the 19 US resorts

Research starts **before T1**, in background agents, so it runs while T1–T5 are built.

**Files:**
- Modify: `resorts.json` (hand-formatted: small objects and arrays on one line)
- Create: `docs/superpowers/research/2026-10-23-phase3-resorts.md`

**Agent briefs** (three agents: Utah, Colorado, Pacific NW; general-purpose, mid-tier model):
- Read `resorts.json` (the Mammoth and Palisades entries), `pipeline/config.ts`, the Phase 2 evidence file and the Phase 3 sources file.
- For each resort, produce a `resorts.json` entry plus evidence, verified with `curl`. Same rules as Phase 2: no scraping, no sign-ups, and **no Open-Meteo forecast or ensemble calls**. The elevation API (`api.open-meteo.com/v1/elevation`) is fine.
- Fields:
  - Base and summit lat/lon, checked against Open-Meteo elevation. `baseFt`/`summitFt` from the resort's own site.
  - `tz`, `region`.
  - `nws.area` and `nws.ignore` from the office's current discussion.
  - Nearest SNOTEL (AWDB) within ~30 km and 2,000 ft, checked for recent data.
  - Avalanche zone by point-in-polygon. Use the summit point when the base is outside (risky input 12). Mt. Hood uses NWAC 3032. Colorado gets `links.avalanche: "https://avalanche.state.co.us/"`, not `avalanche`.
  - `report` only per the MtnPowder table.
  - **`local.openingDate` for 2026-27 for every resort** (risky input 11), cited.
  - `local.notes` (3–5, cited).
  - `links`: website, webcams, report, radar (`radar.weather.gov/station/<K…>/standard`), and roads:
    - Utah: `https://udottraffic.utah.gov/`
    - Colorado: `https://www.cotrip.org/`
    - Oregon: `https://www.tripcheck.com/`
  - **Roads (Washington only):** `{ "provider": "wsdot", "label", "route", "pass" }` with `pass` exactly "Crystal to Greenwater SR 410", "Stevens Pass US 2" or "Mt. Baker Hwy SR 542".
  - **`roadCams`:** WSDOT stills from `TravelInfoCamerasWeather` near each pass.
  - Resort `cams` only for direct keyless JPGs.
- Write evidence and entries to the scratchpad. Return a short summary.

**Controller steps:**
- [x] Dispatch the three agents in background before starting T1.
- [x] When they return, check every entry:
  - It parses (`parseConfig`).
  - Base and summit elevations from the elevation API are within 300 ft of the stated ones, or there's a noted reason.
  - One `curl` per avalanche zone, SNOTEL station and MtnPowder id.
  - Opening dates are cited.
  - `nws.ignore` terms appear in that office's discussion.
- [x] Merge into `resorts.json` after the SoCal entries, in region order, hand-formatted.
- [x] Write the evidence file: agent logs unedited (emails removed), plus a "Review changes at merge" section listing every controller change.
- [x] Run `npm test`. Replay will fail for missing fixtures until T7; that's expected, so commit with config-validation tests passing. Commit "T6: 19 US resorts, each source checked live".

## T7. Fixtures, tests at 40 resorts, write-up check

- [x] `npm run record-fixtures`: a full live run, about 2,200 Open-Meteo calls from the local IP.
  - Read its status table. Every configured source should be ✓.
  - Note each ✗ with its cause in the evidence file, and fix config errors.
- [x] Update tests that depend on fixture timing or counts, keeping each assertion's intent. Run `npm test` until green.
- [x] `npm run analyze:sample` (forced, all 40, about $0.10).
  - Confirm the ranking call ended `end_turn`. If it hit `max_tokens`, give the ranking call its own higher cap, rerun, and record a ruling.
  - Read Alta, Vail and Crystal in `samples/analysis-sample.md`: numbers grounded, no CA-isms, roads wording right.
- [x] `git checkout -- logs/usage.csv` (local runs don't commit it).
- [x] Commit "T7: fixtures for 40 resorts; tests updated".

## T8. Browser checks for Batch A

**Files:** `scripts/e2e.ts`

- [x] Add checks:
  - The Resorts tab has section headings Utah, Colorado and Pacific Northwest.
  - `#/resort/alta` renders the summary with no roads panel and a link to `udottraffic.utah.gov`.
  - `#/resort/vail` shows the "Avalanche forecast" card linking to `avalanche.state.co.us`.
  - Star Crystal, open Roads: a segment labeled from WSDOT is listed and the caption says "WSDOT mountain pass reports". Then unstar it so later checks see the default favorites.
- [x] Run `npm run build && npm run e2e`, look at the new screenshots, and commit "T8: e2e for the new regions, WSDOT and the CAIC link".

**Batch A is complete here.** Run the whole-suite check (test, typecheck, build, e2e) and offer Mikey a push of Batch A before Batch B.

---

## T9. A resort outside NWS and CPC coverage (contract)

**Files:**
- Modify: `pipeline/config.ts`, `shared/types.ts`, `pipeline/run.ts`, `pipeline/summary.ts`, `pipeline/sources/nws.ts` (alert `source: 'NWS'`), `pipeline/sources/avalanche.ts` (`publicText: true`), `src/routes/Resort.svelte`, `src/components/ForecastPost.svelte`, `src/components/SourcesNote.svelte`, `src/components/AvalanchePanel.svelte`, `analysis/brief.ts`, `analysis/prompt.ts`
- Test: `test/pipeline/pipeline.test.ts`, `test/analysis/analysis.test.ts`

**Produces:**
```ts
// config
country: z.enum(['US', 'CA']).default('US'),
nws: z.object({ ... }).optional(),                 // refine: required for 'US', absent for 'CA'
eccc: z.object({ bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]) }).optional(), // refine: required for 'CA'; [south, west, north, east]
avalanche: z.union([z.object({ provider: z.literal('avcan') }), z.object({ center: z.string(), zoneId: z.number().int() })]).optional(),

// shared/types.ts
cpc: Sourced<CpcData> | null; nws: Sourced<NwsData> | null; afd: Sourced<AfdData> | null;
interface Alert { /* existing */ source?: 'NWS' | 'ECCC' }
interface AvalancheData { /* existing */ publicText?: boolean }   // absent = true (old cached data)
```

- [x] **Tests first:**
  - A `'CA'` resort without `nws` and with `eccc` validates.
  - `'CA'` with `nws` is rejected, and `'US'` without `nws` is rejected.
  - `buildResort` for a `'CA'` resort (with T10 and T11 stubbed via fail patterns) gives `nws`, `afd` and `cpc` of `null`, and no grid model.
  - The brief for that resort has no NWS discussion, NWS forecast or CPC keys.
  - `RESORT_SYSTEM` contains the spec's outside-NWS line.
- [x] `run.ts`:
  - `'CA'` skips `fetchCpc`, `fetchNwsForecast`, the discussion and `fetchNwsGrid` (all `null`). Alerts come from `fetchEcccAlerts` (T10; until then, `[]`).
  - `nwsArea` is `r.nws?.area ?? r.region`. *Ruling:* it stays required and isn't made optional as the spec said, to avoid churn. Same effect.
- [x] `summary.ts`: stale sources and the status table skip `null` sources (`–`).
- [x] App:
  - `Resort.svelte` renders `CpcStrip` only when `r.cpc`, and `NwsPanel` only when `r.nws || r.afd`.
  - `ForecastPost.svelte` uses `r.afd?.data`.
  - `SourcesNote.svelte` labels:
    - alerts: "ECCC alerts" when any alert has `source === 'ECCC'` or `r.nws === null`, else "NWS alerts";
    - avalanche: `r.avalanche?.data?.center ?? 'avalanche.org'`.
  - `AvalanchePanel.svelte` hides `bottomLine` when `publicText === false` (risky inputs 7 and 13).
- [x] `brief.ts`: leave out the NWS and CPC fields when `null`. `prompt.ts`: add the spec's static line to `RESORT_SYSTEM`.
- [x] Run `npm test` and `npm run typecheck`, then commit "T9: resorts outside NWS and CPC coverage".

## T10. ECCC alerts (`pipeline/sources/eccc.ts`)

**Produces:**
```ts
export const ecccAlertsUrl: (bbox: [number, number, number, number]) => string; // takes [s,w,n,e], emits bbox=w,s,e,n
export function parseEcccAlerts(json: unknown, now: Date): Alert[];
export async function fetchEcccAlerts(r: ResortConfig): Promise<Alert[]>;
```

- [x] **Tests first:**
  - The URL puts the bbox in `w,s,e,n` order.
  - An empty FeatureCollection → `[]`.
  - A made-up feature set (one active snowfall warning in two zones, one ended, one expired) → one alert (risky input 14). Its `description` is byte-identical to `alert_text_en`, `winter` is true, and `source` is `'ECCC'`.
- [x] Mapping:
  - `id`: `${alert_code}|${alert_name_en}|${publication_datetime}`, which is also the dedupe key.
  - `event`: `alert_name_en`. `headline`: `${alert_name_en} · ${feature_name_en}`.
  - `severity`: `risk_colour_en`. `onset`: `validity_datetime`. `ends`: `event_end_datetime`.
  - `url`: `https://weather.gc.ca/warnings/index_e.html?prov=bc`.
  - `winter`: true when `alert_short_name_en` (lowercased) matches snowfall, winter storm, blizzard, snow squall, freezing rain, freezing drizzle, extreme cold, wind chill, arctic outflow or wind.
- [x] Wire it into `run.ts` for `'CA'`. Commit "T10: ECCC weather alerts".

## T11. Avalanche Canada (`pipeline/sources/avcan.ts`)

**Produces:**
```ts
export const avcanPointUrl: (lat: number, lon: number) => string;
export function parseAvcan(json: unknown): AvalancheData;   // publicText: false
export async function fetchAvcan(r: ResortConfig): Promise<AvalancheData>;  // summit point if set, else base
```

- [x] **Tests first:**
  - A sample built from the live 2026-10-23 off-season response: all ratings 0, no throw (risky input 15).
  - A made-up in-season product built from the documented schema: `alp/tln/btl` map to upper/middle/lower for today and tomorrow, `highlights` HTML is stripped into `bottomLine`, `summaries` joined into `discussion`, `problems[].type` listed, `publicText` false.
- [x] Reuse the overall-rating and overall-text logic from `avalanche.ts`; export it from there if it's private.
- [x] `run.ts` dispatches: `'provider' in r.avalanche ? fetchAvcan : fetchAvalanche`.
- [x] Commit "T11: Avalanche Canada danger ratings".

## T12. Whistler config, fixtures, checks

- [ ] The controller researches Whistler itself (one resort):
  - Base and summit from the resort, checked against Open-Meteo elevation.
  - `country: 'CA'`, `eccc.bbox: [50.05, -123.0, 50.15, -122.9]`, `avalanche: { provider: 'avcan' }`.
  - 2026-27 `openingDate`, cited. 3–5 cited local notes.
  - `links`: website, webcams, `https://www.drivebc.ca/`, and the ECCC radar page.
  - Resort cams only as direct keyless JPGs.
  - Add the evidence to the T6 evidence file.
- [ ] Run `npm run record-fixtures` again (about 2,250 calls) and read the table. Then `npm test` green, and commit.
- [ ] Add an e2e check: `#/resort/whistler` renders, has no NWS panel and no CPC strip, and its avalanche card shows a rating and link but no bottom-line text. Then `npm run build && npm run e2e`.
- [ ] Run `npm run analyze:sample`, read Whistler's write-up (no NWS mentions, numbers grounded), then `git checkout -- logs/usage.csv`.
- [ ] Commit "T12: Whistler".

## Finish

- [ ] Whole-branch review (`code-review` skill), pointed at the Rulings below. Fix every finding in one batch and re-check that batch.
- [ ] Full suite on the final tree (`npm test`, `npm run typecheck`, `npm run build`, `npm run e2e`), with output shown.
- [ ] Report: what shipped, the evidence, every ruling with its cost if wrong. Offer push or keep. Update the vault.

## Rulings

- Ruling: `nwsArea` stays required and falls back to `region` for Whistler, rather than becoming optional as the spec says — same effect, less churn in types and the app — cost if wrong: none visible; one field holds a region name.
- Ruling: if a reuse run fails and falls back to a full update, the budget check doesn't run for it — that fallback is rare and only happens when the live data is broken — cost if wrong: one unguarded full run, about 2,550 calls.
- Ruling: the severity order and `worse()` live in `pipeline/sources/roadStatus.ts`, not `roads.ts` as planned — `caltrans.ts` needs them and `roads.ts` imports `caltrans.ts`, so keeping them in `roads.ts` would make a circular import — cost if wrong: none; one extra small module.
- Ruling: vitest `testTimeout` raised to 30 s for every test (in `vitest.config.ts`) — the outage test replays the pipeline twice and took 5.5 s at 21 resorts with the suite running in parallel; at 40 it would fail every run — cost if wrong: a hung test takes 30 s to report.
- Ruling: AFD section headings may carry a comma suffix (`.DISCUSSION, Issued 1059 AM MDT…`) — Salt Lake City writes them that way, and the strict heading regex made all six Utah discussions fail in the T7 recording — cost if wrong: a heading with a stray comma elsewhere would be read as a section; it only ever narrows to the name before the comma.
- Ruling: Alta's summit point moved to the top of the Supreme lift (grid cell 10,000 ft) — the agent's point fell in a lower NWS grid cell than the base, which inverted the "NWS forecasters" line and failed the summit ≥ base invariant — cost if wrong: none found; the point is 64 ft from the stated summit on the DEM.
- Ruling: only Alta's fixtures were re-recorded after its fix (scratchpad `record-one.mts`, 54 Open-Meteo calls), not the full set — a full re-record is about 2,230 calls — cost if wrong: Alta's fixtures are about 40 minutes newer than the rest; replay freezes the clock at the original recording time, and all tests pass.
- Ruling: the ranking call gets its own `max_tokens` of 16,000 (write-ups keep 8,000) — at 40 resorts the ranking used 6,868 output tokens including thinking, and at 8,000 it was cut off mid-JSON in the forced sample — cost if wrong: at most about $0.004 more per ranking at Haiku's output price.

### Batch A review (2026-10-23)

A whole-branch review (code-review, high) on `origin/main...HEAD` found 10 issues; all 10 checked out against the code and were fixed in one batch:
- The budget check reads main's current log.
- The usage-log commit runs whenever the fetch ran.
- WSDOT: unknown outranks clear, heavy-vehicle rules don't count as car-wide, "None" means clear, and the worst line carries the restriction rather than repeating the report.
- `writtenFor` and station times use the resort's own zone.
- Favorites row and ranking brief: agency wording.
- The run weight comes from `openMeteo.ts`.
- `roads.ts` interleaves with counters.

It confirmed all eight rulings above.

- Ruling: in WSDOT segments only, `unknown` outranks `clear`; Caltrans keeps `unknown` lowest — for Caltrans, unknown means "no stations matched the segment", while for WSDOT it means wording we couldn't read, which must not hide behind "No restrictions" the other way — cost if wrong: a pass shows "unknown" where "clear" was right, until its wording is added.
- Ruling: station times without an offset (SNOTEL, CDEC, CoCoRaHS) take the zone's standard offset all year — the old `-08:00` was that rule hard-coded to Pacific, and SNOTEL and CDEC keep standard time — cost if wrong: CoCoRaHS's 7am readings show an hour off in summer, as they did before.
- Ruling: outside the US, `cpc` stays a source carrying ENSO only (`outlooks: []`) instead of becoming `null` as the spec says — the spec also says ENSO is global and stays, and ENSO arrives inside the CPC record, so `null` would drop it from the writer's brief and the app; keeping the type non-null also avoids churn — cost if wrong: none visible; the CPC strip says NOAA's outlooks cover the US only and shows the ENSO line.
- Ruling: ECCC alerts are deduped on the feature id before "_" (the alert's own id; the part after is the forecast zone), not the planned `code|name|published` key — the live collection shows one feature per zone sharing that prefix, so it identifies the alert exactly — cost if wrong: two different alerts with the same id would show once; ECCC ids are unique per alert.
