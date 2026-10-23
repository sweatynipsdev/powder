# Powder

Mikey's personal OpenSnow replacement: an installable, always-dark PWA covering 21 California/Nevada resorts. Each phone stars its own favorites, with no accounts.
- **Update job:** GitHub Actions runs twice a day. It fetches free, no-key sources, builds snow forecasts, has Claude Haiku write a forecast per resort plus a ranking, then deploys static JSON plus the app to GitHub Pages.
- **Links:** live at https://sweatynipsdev.github.io/powder/ · repo `sweatynipsdev/powder` (public) · vault note `~/Documents/mikey-brain/projects/powder.md` (read its CURRENT STATE first).

## Where things are
- `resorts.json`: every resort and its sources. Adding a resort means adding one object here, checking each source live, then running `npm run record-fixtures`. See "Adding a resort" in `README.md`.
- `pipeline/`: Node/TS data job (`run.ts`).
  - `sources/`: one fetcher per source.
  - `process/`: snow ratio, day/night periods, blend.
  - `history.ts`: the local model.
- `analysis/`: the AI write-ups. `brief.ts` builds the input, `prompt.ts` holds the static, cached prompts, and `grounding.ts` rejects invented numbers.
- `shared/`: the data contract (`types.ts`), plus the open/closed status logic and number formatting used by the update job, the write-ups and the app alike.
- `src/`: Svelte 5 + Vite app with a hash router.
  - Routes: Favorites, Resorts, Forecasts, Roads, and resort pages with Weather / Snow Summary / Snow Report / Forecast tabs.
  - Favorites live in `src/lib/favorites*.ts`.
- `docs/superpowers/`: specs, plans (with a **Rulings** section) and research evidence, one set per feature.
- `history/`: the local model's forecast/observation log. Only the workflow writes it.
- `logs/usage.csv`: AI cost log. Only the workflow writes it.

## Commands
- `npm test` (vitest, offline replay of recorded fixtures) · `npm run typecheck` (tsc + svelte-check, must be 0 errors and 0 warnings).
- `npm run pipeline`: live fetch into `public/data/` and print a status table. `npm run pipeline:replay`: the same from fixtures, no network.
- `npm run record-fixtures`: re-record every HTTP response into `test/fixtures/http/`. Run it after adding a resort or when a source changes. It is a full live run.
- `npm run analyze` / `npm run analyze:sample -- --force`: write the forecasts. Needs `ANTHROPIC_API_KEY` in `.env`. A forced run of all 21 resorts costs about $0.05.
- `npm run reuse-data`: copy the live site's data into `public/data/`. This is the cheapest way to get real data for UI work.
- `npm run build && npm run e2e`: browser checks plus screenshots in `screens/`. Set `E2E_URL=https://sweatynipsdev.github.io/powder/` to check the live site.
- `npm run calibrate`: rebuild `history/calibration.json`. The workflow runs it before every update.

## Rules
- **No API keys in the app or the repo.** `ANTHROPIC_API_KEY` lives only in GitHub secrets and a gitignored `.env`. The repo is public, so never commit emails, keys or tokens either.
- **Ask Mikey before adding any paid service or any dependency that needs an account.** That includes the free road APIs for Utah, Colorado, Washington and Oregon, which need sign-up keys.
- **No scraping.** Not OpenSnow, and not resort websites. Resort snow reports come only from the no-key MtnPowder feed.
- **Local forecasters' text is input for the writer only.** The app shows who wrote it, when, and a link, never their words.
- **A failing source marks that source stale and carries its last value forward.** It never fails the run. No resort data is hardcoded in components.
- **Open-Meteo's free tier is 10,000 calls a day,** counted by request size. One full update at 21 resorts is about 1,100–1,500.
  - A push touching `pipeline/`, `analysis/`, `shared/`, `resorts.json`, `scripts/calibrate.ts` or `update.yml` triggers a full update. Other pushes reuse the live data.
  - Every local `pipeline` or `record-fixtures` run also counts against the daily limit.
- **The AI prompts stay static so they cache.** Anything that changes per run goes in the user message. Every number in a write-up must come from the brief.
- **Imperial units everywhere,** stored that way in the JSON.
- **`resorts.json` is hand-formatted:** small objects and arrays stay on one line. Don't rewrite it with `JSON.stringify`.
- **Don't commit `logs/usage.csv` changes from local runs.** Restore the file instead (`git checkout -- logs/usage.csv`), because the workflow bot appends to it and a local change would conflict.

## Workflow
- **Work in a git worktree** (`.claude/worktrees/`). The only `.env` is in `.claude/worktrees/build`, and the root checkout may be behind `main`.
- **Real features** go through the `build` skill: spec, then plan, then tasks with tests, then a whole-branch review.
- **Pushing to `main` deploys.** Only push when Mikey says so.
- **Before saying something is done,** run `npm test`, `npm run typecheck`, `npm run build` and `npm run e2e`, and look at the screenshots. Full-page screenshots show the fixed tab bar halfway down the page, which is expected.
- **Charts follow the dataviz skill's validated palette.** One y-axis per chart.

## Gotchas
- **Resorts with no MtnPowder feed** (13, including every Vail resort) get their status from `local.openingDate`. Keep opening dates current each season.
- **Some NWS forecast-grid points sit well below the summit,** e.g. the Dodge Ridge and Palisades summit points. Read `nwsGridFt`.
- **Some Tahoe resorts belong to the Sacramento office (STO), not Reno (REV).** `nws.afdOffice` is optional and defaults to the office covering the base.
- **Caltrans and Open-Meteo occasionally drop connections.** One source going stale on a run is normal.
- **Next up:** Phase 3 (Utah, Colorado, Pacific NW, Whistler) needs its own spec first. Whistler has no NWS coverage or CPC outlooks.
