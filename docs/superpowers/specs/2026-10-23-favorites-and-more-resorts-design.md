# Favorites and more resorts — design

Date: 2026-10-23 · Status: approved in chat (Mikey: "Yes, go")

## Goal

Friends are starting to use Powder, and the resort list is about to grow from 4 to about 35. Each phone should show only the resorts its owner picks. The update job must stay inside free limits at that size.

## Phases

1. **Favorites and scale-proofing** (this spec, in full).
2. **17 California/Nevada resorts** (this spec, in full).
3. **Utah, Colorado, Pacific Northwest and Whistler** (a separate spec later). It needs new sources and decisions about sign-up keys; see "Phase 3 outline".

## Constraints (carried from the original spec)

- No API keys in the client or the repo. No accounts and no server.
- Ask Mikey before adding any paid service or any dependency that needs an account.
- A source failing marks that source stale. It never fails the build.
- No resort data hardcoded in components; everything comes from `resorts.json`.

## Phase 1: favorites

### Behavior

- **Saved per phone** in `localStorage` under `powder.favorites`, as a JSON array of resort ids. No accounts.
- **Defaults:** resorts with `"defaultFavorite": true` in `resorts.json`: palisades, alpine, mammoth and bigbear. A phone with nothing saved gets the defaults. That covers Mikey's phone today, so it doesn't change.
- **First-time banner:** while a phone is still on the defaults (nothing saved yet), Favorites shows "Showing the default resorts · Pick yours →", linking to the Resorts tab. It disappears after the first star or unstar.
- **Order:** favorites always show in `resorts.json` order. There's no manual reordering.
- **Clean-up:** saved ids that no longer exist in the index are dropped silently.
- **Storage blocked** (private mode, storage throws): the defaults are used, stars still work for the session, and nothing crashes.
- **Unstarring everything** leaves an empty Favorites tab saying "No favorites yet" with a link to Resorts. An empty saved list stays empty; it doesn't fall back to the defaults.

### Screens

- **Tab bar** gets four tabs: Favorites, Resorts, Forecasts, Roads.
- **Resorts tab (`#/resorts`, new):**
  - A search box. Matching ignores case and punctuation, so "mt rose" matches "Mt. Rose", and it checks name, short name and region.
  - Then every resort grouped by `region` (in `resorts.json` order), one row each: name, status line, next 1–5 days at the selected elevation, and a star button.
  - Tapping the row opens the resort. Tapping the star toggles the favorite without leaving the list.
- **Resort page:** a star button in the header next to the name, with the same toggle.
- **Back button** on a resort page: if you got there by navigating inside the app, it goes back in history (so it returns to Resorts when you came from Resorts). Otherwise it goes to `#/`.
- **Favorites tab:** only favorites. The best-bet card shows the highest-ranked favorite.
- **Forecasts tab:**
  - The ranking card lists only favorites, in the AI's ranking order.
  - Below it come the favorites' write-ups and their local experts.
  - Last is a collapsed "Other resorts (N)" list of name + headline links.
- **Roads tab:** only favorites.

### Best bet

The AI ranking already lists every resort, best first, each with a day and a reason. The app shows the first entry whose resort is a favorite, using that entry's day and reason.
- The ranking `summary` sentence is no longer shown, because it can name resorts the viewer doesn't follow.
- If no favorite appears in the ranking (no ranking yet, or a just-added resort), the card is hidden.
- The ranking prompt adds a rule: each reason must stand alone and not name other resorts.

### Data loading and offline

- The Favorites and Resorts tabs use only `data.json` summaries.
- Forecasts and Roads load the per-resort files for favorites only (`ensureResorts(ids)` replaces `ensureAllResorts`).
- Once the index and favorites are known, the app loads every favorite's resort file in the background. The service worker's network-first data cache then holds all favorites for offline use, not just the visited ones.

### Pipeline and workflow scale-proofing

- **Open-Meteo budget.**
  - Free limits are 600 calls/min, 5,000/hour and 10,000/day. A request's weight is `locations × max(1, days/14) × max(1, variables/10)`, where variables = hourly variables × models (deterministic) or × ensemble members.
  - Our deterministic request is 2 × 16/14 × 72/10 ≈ 16.5. Our ensemble request is 2 × 16/14 × 164/10 ≈ 37.5. That's about 54 per resort, or about 1,900 per run at 35 resorts.
  - A pacer keeps Open-Meteo requests at **≤ 450 weighted calls per rolling 60 seconds**. It's off in fixture replay, and the run summary prints the run's total weight.
- **Code pushes reuse live data.**
  - A push to `main` that changes none of `pipeline/`, `analysis/`, `shared/`, `resorts.json`, `scripts/calibrate.ts` or `.github/workflows/update.yml` rebuilds the app against the data already on the live site. It doesn't fetch sources or call the AI.
  - If the live data can't be read in full, the job falls back to a full run.
  - Scheduled runs and manual runs are always full.
- **Analysis concurrency.** The first write-up runs alone, to write the prompt cache. The rest then run **4 at a time**, and the ranking runs last.
- **Workflow timeout:** 30 minutes.

### Testing

- **Unit tests:**
  - Favorites logic: defaults, an invalid saved value, unknown ids dropped, an empty list kept, toggling keeps config order, best-favorite selection, and search matching.
  - The Open-Meteo weight for our two request shapes.
  - Pacer delays under a fake clock.
  - Analysis concurrency (≤ 4 in flight, the first call finishes before the others start).
  - Reusing live data: a complete set is written, and a missing resort raises an error.
- **e2e (iPhone WebKit):**
  - Unstar Big Bear on its page → Favorites no longer shows it → still gone after a reload → star it again from the Resorts tab → it's back.
  - Resorts search filters the list.
  - The four-tab bar fits without horizontal scroll.

## Phase 2: California and Nevada resorts

### Resorts

| Region | Resorts |
|---|---|
| Tahoe | Northstar, Heavenly, Kirkwood, Sugar Bowl, Sierra-at-Tahoe, Homewood, Mt. Rose, Diamond Peak, Boreal |
| Eastern Sierra / Central CA | June Mountain, Bear Valley, Dodge Ridge, China Peak |
| SoCal | Snow Summit (split from the Big Bear entry), Snow Valley, Mountain High, Mt. Baldy |

**Big Bear:** the existing `bigbear` entry becomes Bear Mountain only (MtnPowder 57), and `snowsummit` gets its own entry (MtnPowder 58). `bigbear` keeps its id, so saved favorites and history stay valid.

### Per resort, each source verified live before it goes in

- **Core config:** base lat/lon, `summit` lat/lon, `baseFt`/`summitFt`, `tz`, `region`, and `nws.area` / `nws.ignore` where the forecast discussion covers several areas.
- **NWS office:** `nws.afdOffice` becomes optional. When it's left out, the office comes from the base point's `/points` response (`properties.cwa`).
- **Snowpack:** the nearest representative SNOTEL, CDEC pillow or CoCoRaHS station, chosen by distance and elevation. Leave it out when nothing is within about 30 km and 2,000 ft.
- **Avalanche center and zone,** where one covers the resort: SAC for Tahoe, ESAC for June, and the rest checked one by one. Leave it out otherwise.
- **Snow report:** the MtnPowder id where the resort is on MtnPowder; otherwise leave it out. The app already falls back to the station estimate and a link to the resort's report page. Scraping resort pages is out of scope.
- **Roads:** Caltrans segments for California routes. Nevada-only access (Mt. Rose on NV-431, Diamond Peak) gets no roads panel, because NDOT's API needs a sign-up key; the resort's `links` carry a link to NV 511 instead.
- **Cams:** direct still-image URLs where the resort publishes them.
- **Local notes and opening dates:** cited, as for the first four.

### Cost and limits at 21 resorts

- **Open-Meteo:** about 1,150 weighted calls per run.
- **AI write-ups:** about $0.0025 per resort, so about $0.05 per morning run. Afternoon runs rewrite only resorts that changed.

### Testing

- `npm run pipeline` live: every configured source ✓ for every resort.
- Fixtures re-recorded, and the full test suite green.
- `analyze:sample` reviewed for three new resorts: one Tahoe, one Central CA, one SoCal.

## Phase 3 outline (not designed here)

Utah, Colorado, the Pacific Northwest and Whistler. Mikey will need to decide on:

- **Road data:** UDOT, CDOT, WSDOT and ODOT need free sign-up keys, and DriveBC (BC) is open. The default is a link to each state's 511 site unless Mikey approves the keys.
- **Avalanche:** UAC, CAIC, NWAC and Avalanche Canada each publish differently.
- **Whistler:** no NWS (alerts, forecast discussion and grids) and no CPC outlooks. Environment Canada is the candidate replacement, and Open-Meteo covers it already.
- **Snow reports:** MtnPowder covers the Alterra resorts (e.g. Deer Valley, Solitude, Steamboat, Winter Park). Vail resorts would have only the station estimate and a link.

## Out of scope

- Accounts or cross-device sync.
- Reordering favorites.
- Push alerts.
- Scraping resort sites.
