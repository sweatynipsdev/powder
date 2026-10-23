# Favorites and more resorts — plan

**Goal:** each phone shows only the resorts its owner stars, and Powder grows to 21 California/Nevada resorts while staying inside free limits.

**Architecture:**
- Favorites live only in the client: `localStorage`, filtering the existing `data.json` summaries and the AI ranking. The pipeline adds a `defaultFavorite` flag, an Open-Meteo request pacer, concurrent write-ups, and a workflow path where code pushes reuse the live data.
- Phase 2 is config plus research, with `nws.afdOffice` made optional.

**Spec:** `docs/superpowers/specs/2026-10-23-favorites-and-more-resorts-design.md`

## Global constraints (verbatim from the spec)

- No API keys in the client or the repo. No accounts and no server.
- Ask Mikey before adding any paid service or any dependency that needs an account.
- `localStorage` key `powder.favorites`: a JSON array of resort ids.
- Defaults: resorts with `"defaultFavorite": true` (palisades, alpine, mammoth, bigbear).
- Open-Meteo weight = `locations × max(1, days/14) × max(1, variables/10)`, where variables = hourly variables × models (deterministic) or × ensemble members.
- Open-Meteo pacing: **≤ 450 weighted calls per rolling 60 seconds**, off in fixture replay.
- Analysis: the first write-up alone, then **4 at a time**, the ranking last.
- Workflow timeout: 30 minutes.
- Full runs are triggered by changes to `pipeline/`, `analysis/`, `shared/`, `resorts.json`, `scripts/calibrate.ts` or `.github/workflows/update.yml`.

## Risky inputs

- `localStorage` throws, or holds garbage (`"x"`, `{}`, `[1,2]`). → **T2** `loadFavorites` tests.
- A saved id was removed from `resorts.json`. → **T2**.
- The user unstars everything, so `[]` must not fall back to the defaults. → **T2**, and the e2e in **T9**.
- No ranking, or no favorite in the ranking (a resort added after the ranking was written). → **T2** `bestFavorite` tests.
- 35 resorts fire Open-Meteo requests in parallel. → **T6** pacer test.
- A code push when the live data is incomplete or unreachable. → **T8** `reuseData` test.
- Search for "mt rose" should find "Mt. Rose". → **T2** `matchesQuery` test.

---

## Phase 1

### T1 — `defaultFavorite` in config and summaries

**Files:**
- Modify: `pipeline/config.ts`, `shared/types.ts` (`ResortData`, `ResortSummary`), `pipeline/run.ts` (`buildResort`), `pipeline/summary.ts`, `resorts.json`.
- Test: `test/pipeline/pipeline.test.ts`.

**Produces:** `ResortSummary.defaultFavorite: boolean`.

- [ ] Test: the summaries' `defaultFavorite` values are `[true, true, true, true]` for the shipped config, and `parseConfig` defaults the field to `false` when it's missing.
- [ ] `config.ts`: `defaultFavorite: z.boolean().default(false)`.
- [ ] Pass it through `ResortData` and `summarize`.
- [ ] Set `"defaultFavorite": true` on the 4 resorts.
- [ ] `npm test` and `npm run typecheck`, then commit.

### T2 — favorites logic (pure) and state

**Files:**
- Create: `src/lib/favorites.ts` (pure, no runes), `src/lib/favorites.svelte.ts` (state), `test/app/favorites.test.ts`.

**Produces (from `favorites.ts`):**
- `loadFavorites(raw: string | null, resorts: { id: string; defaultFavorite: boolean }[]): { ids: string[]; chosen: boolean }`.
  - `raw` is `null` or invalid → the defaults, with `chosen: false`.
  - A valid array → its known ids in config order, with `chosen: true`. `[]` stays `[]`.
- `toggleFavorite(ids: string[], id: string, order: string[]): string[]` → the result in config order.
- `bestFavorite(ranking: Ranking | null, ids: string[]): RankingEntry | null`.
- `matchesQuery(q: string, ...fields: string[]): boolean` → lowercase, punctuation stripped, whitespace collapsed, and every query word is a prefix of some word in the fields.

**Produces (from `favorites.svelte.ts`):**
- `favorites` = `$state({ ids: string[]; chosen: boolean; ready: boolean })`.
- `initFavorites(index: DataIndex): void` → idempotent per index.
- `toggle(id: string): void` → saves with try/catch.
- `isFavorite(id: string): boolean`.

**Steps:**
- [ ] Tests for every rule above and the risky inputs listed for T2.
- [ ] Implement `favorites.ts`, then `favorites.svelte.ts`.
- [ ] `vitest.config.ts` already includes `test/**`; the tests import `src/lib/favorites.ts` directly.
- [ ] Commit.

### T3 — Resorts tab, star button, back behavior

**Files:**
- Create: `src/routes/Resorts.svelte`, `src/components/StarButton.svelte`.
- Modify: `src/lib/router.svelte.ts` (route `resorts`, plus `router.navigated`), `src/App.svelte` (4 tabs, init favorites, back button), `src/routes/Resort.svelte` (header star).

**Consumes:** T2 `favorites`, `toggle`, `isFavorite`, `initFavorites`, `matchesQuery`.

- [ ] Router: `{ name: 'resorts' }` for `#/resorts`. `router.navigated` becomes `true` after the first in-app `hashchange`.
- [ ] `StarButton`: props `{ id: string; name: string }`.
  - `aria-pressed` set, with label "Add {name} to favorites" or "Remove {name} from favorites".
  - It stops the event from reaching the surrounding link.
  - A filled `--snow-big` star when on, an outline when off.
- [ ] `Resorts.svelte`:
  - A search `<input type="search">`, then regions in config order.
  - Rows: name, status, next 1–5 days at `prefs.elevation`, and a StarButton.
  - "No resorts match" when the search filters out everything.
- [ ] App:
  - Tabbar `repeat(4, 1fr)` with tabs Favorites, Resorts (magnifier icon), Forecasts, Roads.
  - `initFavorites(store.index)` once the index loads.
  - The back link calls `history.back()` when `router.navigated` is set, otherwise goes to `#/`.
- [ ] `npm run typecheck`, then commit.

### T4 — filter Favorites, Forecasts and Roads; best bet; offline prefetch

**Files:**
- Modify: `src/routes/Favorites.svelte`, `src/routes/Forecasts.svelte`, `src/routes/Roads.svelte`, `src/components/RankingCard.svelte`, `src/lib/store.svelte.ts`, `src/App.svelte`.

**Consumes:** T2 `bestFavorite` and `favorites`.

- [ ] `store`: replace `ensureAllResorts()` with `ensureResorts(ids: string[]): Promise<void>`.
- [ ] Favorites:
  - Show only favorites.
  - The defaults banner when `!favorites.chosen`.
  - An empty state when `ids.length === 0`.
  - The best-bet card from `bestFavorite`, showing the entry's reason and dropping `ranking.summary`.
- [ ] RankingCard:
  - A `favorites: string[]` prop that filters the entries.
  - The heading is the first favorite entry.
  - No summary line.
- [ ] Forecasts:
  - The favorites' write-ups and experts.
  - `<details>` "Other resorts (N)" with name + headline links.
- [ ] Roads: only favorites.
- [ ] App: after `initFavorites`, call `ensureResorts(favorites.ids)` in the background, so the service worker caches every favorite.
- [ ] `npm run typecheck`, then commit.

### T5 — ranking reasons stand alone

**Files:** modify `analysis/prompt.ts` (`RANKING_SYSTEM`); test in `test/analysis/analysis.test.ts`.

- [ ] Add to the Output section: "Each reason must stand on its own: never name or compare with another resort, because readers may see only some of the list."
- [ ] Test: `RANKING_SYSTEM` contains "never name or compare with another resort".
- [ ] Commit.

### T6 — Open-Meteo pacer

**Files:**
- Create: `pipeline/sources/omBudget.ts`, `test/pipeline/omBudget.test.ts`.
- Modify: `pipeline/sources/openMeteo.ts` (`fetchDeterministic`, `fetchEnsemble`), `pipeline/run.ts` (print the total in the status output and the job summary).

**Produces:**
- `omWeight(p: { locations: number; days: number; variables: number }): number`.
- `class OmPacer { constructor(opts: { perMinute: number; now?: () => number; sleep?: (ms: number) => Promise<void> }); take(weight: number): Promise<void>; total: number }`.
- `export const omPacer: OmPacer`, with `perMinute` 450. `take` resolves immediately when the HTTP mode is `replay`.

**Steps:**
- [ ] Tests:
  - The deterministic shape (2 locations, 16 days, 9×8 variables) ≈ 16.46.
  - The ensemble shape (2, 16, 2×82) ≈ 37.49.
  - A fake clock: three `take(200)` calls → the third waits until the first is 60 s old.
  - `total` sums the weights.
- [ ] Implement a rolling window (a queue of `[time, weight]`).
- [ ] The fetchers call `await omPacer.take(omWeight(...))` before `fetchJson`, using `MODELS.length`, `DET_VARS.length`, `FORECAST_DAYS` and the ensemble member total (31 + 51) as constants beside `ENSEMBLES`.
- [ ] `run.ts`: `Open-Meteo: N weighted calls this run` under the status table.
- [ ] `npm test`, then commit.

### T7 — concurrent write-ups

**Files:** modify `analysis/run.ts` (`analyze`); test in `test/analysis/analysis.test.ts`.

**Produces:** the same `AnalyzeResult` as today, with `out` in input order whatever order calls finish in.

- [ ] Tests (the fake caller tracks in-flight calls):
  - Max in flight ≤ 4.
  - The first resort's call resolves before any second call starts.
  - `res.resorts` keeps the input order.
  - The ranking call is last.
- [ ] Update the existing "sequentially" test to compare label sets and check that the ranking is last.
- [ ] Implement:
  - Split the resorts into skipped and to-write.
  - Write the first one alone.
  - Then run a pool of 4 workers over the rest.
  - Reassemble in input order.
- [ ] Commit.

### T8 — code pushes reuse live data; workflow timeout

**Files:**
- Create: `scripts/reuse-data.ts`, `test/pipeline/reuse.test.ts`.
- Modify: `package.json` (script `reuse-data`), `.github/workflows/update.yml`.

**Produces:** `reuseData(ids: string[], source: { url?: string; dir?: string }, outDir: string): Promise<void>`. It builds on `loadPrevious`, throws `Error('live data incomplete: missing <ids>')` when the index or any resort is missing, and otherwise calls `writeOutput`.

- [ ] Tests, with a temp dir as the source:
  - A complete set is written.
  - A missing resort throws, naming it.
- [ ] Workflow:
  - `actions/checkout` with `fetch-depth: 0`.
  - A `mode` step. A push sets `full` when `git diff --name-only ${{ github.event.before }} ${{ github.sha }}` touches a full-run path, or when `before` is all zeros; otherwise `reuse`. Schedule and dispatch are always `full`.
  - In `reuse` mode: run `npm run reuse-data`, and on failure set mode to `full`.
  - Calibrate, pipeline, analysis and the history commit run only when mode is `full`.
  - `timeout-minutes: 30`.
- [ ] Commit.

### T9 — e2e and docs

**Files:** modify `scripts/e2e.ts` and `README.md`.

- [ ] e2e (WebKit iPhone):
  - Unstar Big Bear on `#/r/bigbear`, then go to `#/`: Big Bear is absent.
  - Reload: still absent.
  - On `#/resorts`, tap Big Bear's star, then go to `#/`: it's present.
  - Searching "mam" on `#/resorts` shows Mammoth and not Palisades.
  - Screenshot `resorts.png`.
- [ ] README:
  - Favorites, and `defaultFavorite`.
  - The Resorts tab.
  - Open-Meteo budget math.
  - Reuse-on-push.
- [ ] `npm run build && npm run e2e`.
- [ ] Look at the screenshots.
- [ ] Commit.

---

## Phase 2

### T10 — `nws.afdOffice` optional

**Files:** modify `pipeline/config.ts`, `pipeline/sources/nws.ts` (export `fetchOffice(r): Promise<string>` reading `properties.cwa` from `pointsUrl(r)`, so the HTTP cache shares the request with `fetchNwsForecast`) and `pipeline/run.ts` (the AFD source uses `r.nws.afdOffice ?? await fetchOffice(r)`). Test in `test/pipeline/sources.test.ts`.

- [ ] Test: with `afdOffice` removed from a palisades config copy, the AFD office resolves to `REV` (from the recorded points fixture).
- [ ] Implement.
- [ ] Commit.

### T11 — research and add the 17 resorts

**Files:**
- Modify: `resorts.json`.
- Create: `docs/superpowers/research/2026-10-23-ca-nv-resorts.md`, holding the evidence (each URL checked live and the value read).

- [ ] Research by region (Tahoe 9; Eastern/Central 4; SoCal 4 including the Snow Summit split), per the spec's "per resort" list. Each entry needs, per source, the live-checked URL and what it returned.
- [ ] Split Big Bear: `bigbear` becomes Bear Mountain (MtnPowder 57 only), and `snowsummit` is new (58).
- [ ] `npm run pipeline` live: every configured source ✓ for all 21 resorts. Fix or drop any source that fails.
- [ ] Commit.

### T12 — fixtures, tests, sample

- [ ] `npm run record-fixtures`, then fix the tests that assume 4 resorts (ranking brief ids, summary counts).
- [ ] `npm test` and `npm run typecheck`.
- [ ] `npm run analyze:sample`: read three new resorts (one Tahoe, one Central, one SoCal) and record the cost.
- [ ] `npm run build && npm run e2e`.
- [ ] Commit.

## Rulings
