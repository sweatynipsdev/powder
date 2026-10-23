# Phase 3 resorts: Utah, Colorado and Pacific NW evidence (2026-10-23)

Three research agents (Utah, Colorado, Pacific NW) built the 19 `resorts.json` entries and checked their sources live with `curl`. They made no Open-Meteo forecast or ensemble calls; the elevation API was used for point checks. Their evidence logs follow below, unedited. The controller then reviewed every entry and changed what's listed here before merging.

## Review changes at merge

- **deervalley:** Summit point moved to the top of the Empire lift (40.6128, -111.5248; DEM 9,226 ft vs 9,570 stated). The agent's point (40.609, -111.482) sat east of the ski area. The new point is inside UAC zone 1738, so the zone now follows the summit rule instead of "nearest zone". The base point stays at Snow Park Lodge (DEM about 7,200 ft) with the resort's published 6,570 ft base, which is the bottom of the Jordanelle gondola at East Village. The lower figure is what the base forecast uses.
- **alta, snowbird, solitude, deervalley:** Dropped the generic 700 mb snow-to-water-ratio note. It isn't about this mountain, the brief carries no 700 mb temperatures for the writer to apply it to, and it invites Celsius into write-ups that should stay imperial.
- **breckenridge:** summitFt 12,998 → 12,840 (top of Imperial Express, the highest lift). Every other entry uses the top of the highest lift, and the summit point reads 12,825 ft in the DEM. 12,998 is the hike-to summit of Peak 8.
- **keystone:** Removed openingDate 2026-10-24. It came only from ticket sales (Denver Gazette); Vail Resorts officially targets "as soon as possible in October" (SnowBrains, ColoradoBiz). With no date and no lift feed, status reads "Lift status on resort site". The note was reworded to match.

## Controller verification

- **Every source, live (2026-10-23 ~23:40Z), one request per distinct source:**
  - All 15 SNOTEL stations returned 200 with 8 daily values through 2026-10-22.
  - Every avalanche.org zone (UAC 1738; NWAC 3021, 3023, 3024, 3032; COAA 2470) returned 200 with a product: a "forecast" for UAC and center-wide off-season "summary" products for NWAC and COAA. `parseAvalanche` picks the configured zone from `forecast_zone` by id.
  - All six MtnPowder feeds (Solitude 65, Deer Valley 49, A-Basin 93, Winter Park 5, Steamboat 6, Crystal 80) returned the configured stations. Crystal's `SnowReport` is still from 2026-05-18; its `openingDate` keeps status at "Opening Nov 27" until then.
  - Every `links` URL returned 200.
  - Every cam returned JPEG bytes (FF D8). Mt. Bachelor's three send no `Content-Type` header; browsers sniff JPEGs, so they render.
- **Elevations (Open-Meteo elevation API):**
  - All 16 Colorado base and summit points are within about 160 ft of the stated figures.
  - Utah and PNW were checked by their agents, and Deer Valley's summit was re-picked (see above).
- **Config:**
  - `parseConfig` accepts all 40 resorts. Regions are in order after SoCal, and no new resort is a default favorite.
  - WSDOT segments are on Crystal, Stevens and Baker; `links.avalanche` (CAIC) is on all eight Colorado resorts.
  - **No `openingDate` for three resorts.** Keystone has no announced date. A-Basin and Winter Park say "as soon as possible", but both have live MtnPowder feeds, so their status comes from the lift report.

## Known weak spots (carried from the agents, still true)

- **Opening dates that are projections, not announcements:**
  - Brighton, Snowbird, Park City and Deer Valley (Ski Utah or OnTheSnow).
  - Mt. Baker and Mt. Hood Meadows (OnTheSnow).
  - Crystal ("tentative").
- **Base elevation is defined differently by some resorts.** Most entries use the resort's published base. Exceptions:
  - Baker uses Heather Meadows (4,300 ft), not White Salmon (3,500 ft).
  - Mt. Hood Meadows uses the main lodge (5,366 ft), not the lowest lift (4,528 ft).
  - Deer Valley uses its published 6,570 ft (the East Village gondola) with the point at Snow Park Lodge (about 7,200 ft).
- **NWS summit grid cells sit well below the summit** at Vail (11,099 vs 11,570), Winter Park (11,253 vs 12,060) and Steamboat (9,728 vs 10,568). This only affects the "NWS forecasters" line.
- **`nws.ignore` lists were built from October discussions** (rain, flood and frost weeks). Re-check them in January, when the discussions talk about mountain snow.
- **Bot-walled resort sites** (vail.com, breckenridge.com, keystoneresort.com, steamboat.com, the Crystal and Stevens sites, Park City): some stats and page paths came from search results or WebFetch rather than `curl`.
- **Snowmass's SNOTEL** (Chapman Tunnel) is 26.7 km away, the farthest of any entry.

---

## Utah resorts: source evidence (2026-10-23)

Entries: `phase3-utah.json` (6 resorts). Validation: `parseConfig({resorts:[...]})` via tsx printed `valid 6`. Nothing in the repo was edited.

### Cross-cutting checks

- **NWS:** `https://api.weather.gov/points/<base lat,lon>` returned `cwa: SLC` for all six. Base grid cells (SLC x,y, nwsGridFt): Alta 108,167 / 9,800; Snowbird 107,166 / 9,298; Brighton 110,167 / 8,757; Solitude 110,168 / 8,832; Park City 113,169 / 6,919; Deer Valley 114,168 / 7,454. Summit-point cells: Alta 9,436; Snowbird 10,000; Brighton 9,442; Solitude 10,108; Park City 9,570; Deer Valley 8,258 (cell well below the summit, and the Deer Valley base cell sits above the base). No `afdOffice` needed (discussion office = SLC).
- **AFD vocabulary:** read SLC's latest AFDs (`https://api.weather.gov/products/f3a918aa-7ef9-48db-b02a-ac50980f7fd7`, 2026-10-23 19:01Z, and `.../d4bb580e-3aa3-4c59-921a-b14c1d9406b8`, 16:59Z) plus the latest 30 SLC AFDs from `https://api.weather.gov/products/types/AFD/locations/SLC`. Counts across the 30: "southern Utah" 84, "southeast Utah" 17, "eastern Utah" 9, "Four Corners" 7, "Desert Southwest" 5, "Great Basin" 11, "Capitol Reef" 5, "Zion" 5, "Bryce" 5. Zero hits (so NOT in `ignore`): Moab, Castle Country, west desert, Dixie, Boulder Mountain, Uintah Basin. `ignore` = [southern Utah, southeast Utah, eastern Utah, Four Corners, Desert Southwest, Great Basin, Capitol Reef, Zion, Bryce].
  - Deliberately NOT ignored: "southwest Wyoming" (53 hits) because it nearly always sits in the same sentence as "northern Utah" ("showers across portions of northern Utah and southwest Wyoming"); ignoring it would drop most northern-Utah sentences. "Uinta/Uintas" (6) appears in "the Wasatch and Uinta Mountains" snow sentences, and "Cottonwoods" (2) appears in "upper Cottonwoods and high Uintas". "Wasatch Front", "northern mountains", "central Utah" (67, mixed) also left in.
- **Open-Meteo elevation API** (batched, 90 m DEM; ft = m x 3.28084). Final points: Alta base 40.5885,-111.6375 = 8,560 (stated 8,530); Alta summit 40.5687,-111.6355 = 10,636 (stated 10,500); Snowbird base 40.579,-111.662 = 7,989 (7,760); Snowbird summit 40.561,-111.645 = 10,840 (11,000); Brighton base 40.598,-111.5832 = 8,793 (8,755); Brighton summit 40.59,-111.597 = 10,394 (10,500); Solitude base 40.6199,-111.5919 = 8,199 (7,994); Solitude summit 40.599,-111.609 = 10,016 (10,488); Park City base 40.6514,-111.508 = 6,972 (6,800); Park City summit 40.625,-111.567 = 9,902 (10,026); Deer Valley base 40.637,-111.4795 = 7,241 (6,570, see Weak spots); Deer Valley summit 40.609,-111.482 = 9,308 (9,570). A wide search (Open-Meteo grid, 0.003-0.004 deg step) found no higher DEM cell near the lifts for Park City or Deer Valley. Wikipedia geosearch (`en.wikipedia.org/w/api.php?action=query&list=geosearch`) gave Mount Millicent 40.5905,-111.5975, used as Brighton's summit point. The 429 rate-limit hit once on the elevation API; I waited and retried.
- **SNOTEL:** station list `https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/stations?networkCds=SNTL&stateCds=UT` (the `stateCds` filter was ignored and it returned all 4,396 stations; I filtered `stateCode==UT`, `networkCode==SNTL`, active). Nearest active UT SNTL stations were computed by haversine. Each chosen id then returned HTTP 200 on `.../data?stationTriplets=<id>&elements=SNWD&duration=DAILY&beginDate=2026-10-15&endDate=2026-10-24`: 8 daily values, last 2026-10-22, SNWD 0 in. Ids are already in the `NNN:UT:SNTL` triplet form like `784:CA:SNTL` in the existing file, with `"type": "awdb"`.
- **Avalanche:** `https://api.avalanche.org/v2/public/products/map-layer/UAC` has 9 zones (1736 Logan, 1737 Ogden, 1738 Salt Lake, 1739 Provo, 1740 Uintas, 1741 Skyline, 1742 Moab, 1743 Southwest, 1744 Abajos). Point-in-polygon (ray casting, saved geometry `uac.json`): Alta, Snowbird, Brighton, Solitude base and summit points all inside **1738 Salt Lake**. Park City base outside (about 1.8 km from the zone edge), summit inside 1738, so I used 1738. Deer Valley base and summit both outside (nearest vertex about 3.7 km and 1.6 km; nearest zone 1738). Used 1738 as the nearest zone, an assumption. `https://api.avalanche.org/v2/public/product?type=forecast&center_id=UAC&zone_id=1738` returned 200 (1737, 1739, 1740 also 200). The UAC forecast product is stale: published 2026-09-15T00:43Z, expired 2026-09-16, `danger: []`. This is early-season normal.
- **MtnPowder:** `https://www.mtnpowder.com/feed?resortId=49` 200, Name "Deer Valley", AnnualAverageSnowfallIn 300, 0/32 lifts, 0/209 trails, LastUpdate 2026-10-13, stations BaseArea ("Base"), MidMountainArea ("Mid-Mountain"), SummitArea ("Summit") all present. `resortId=65` 200, Name "Solitude", AnnualAverageSnowfallIn 500, 0/9 lifts, 0/82 trails, LastUpdate 2026-10-23T08:54, only MidMountainArea populated (BaseIn 1, Last24HoursIn 1); BaseArea and SummitArea read "--". Alta (63), Snowbird (64), Brighton (66) are name-only per the Phase 3 sources note, and Park City has no feed, so those four have no `report`.
- **Radar:** `https://api.weather.gov/radar/stations/KMTX` returns coordinates -112.448, 41.263 (Promontory Point, the Salt Lake City NWS radar). `https://radar.weather.gov/station/KMTX/standard` returns 200.
- **Roads:** `https://cottonwoodcanyons.udot.utah.gov/road-information/` (200) is UDOT's Cottonwood Canyons page ("live status feed for SR-190 and SR-210"), used for Alta, Snowbird, Brighton, Solitude. Park City and Deer Valley use `https://udottraffic.utah.gov/` (200). UDOT avalanche-closure page `https://cottonwoodcanyons.udot.utah.gov/avalanche-information/` (200): overnight closures typically start 12:30 a.m. the night before; road fully closed during mitigation; it covers SR-210 only.
- **Opening dates:** Ski Utah's resort updates page (`https://www.skiutah.com/blog/authors/dallas/2026-utah-resort-updates`) lists Alta Nov 20, Snowbird Nov 27, Solitude Nov 20, Park City Nov 20, Deer Valley Dec 5, Brighton "Opening Day TBA". Deseret (`https://www.deseret.com/lifestyle/2026/10/07/utah-ski-resorts-opening-dates-new-terrain-upgraded-chairlifts/`, 2026-10-07) lists the same dates, labelled as projected, no Brighton. All fetched with WebFetch.
- **Cams:** Only Snowbird publishes a direct still: the Snowstake cam `https://img.hdrelay.com/frames/8611e276-7ee5-42c0-b8cd-d9e1890e1cd4/default/last.jpg` (200, `image/jpeg`, linked from snowbird.com/the-mountain/webcams/). Alta uses PrismCam embeds, Solitude and Deer Valley pages use camstreamer embeds, Brighton's live cams are plain text; none of them expose a .jpg. Park City's site returns the same 1,868-byte bot-wall stub to curl.
- All URLs listed in the entries (`local.sources` and `links.*`) were fetched with `fetch` and returned 200, including Park City's .aspx pages (those return the Vail stub to every path, so the 200 proves nothing; their paths came from WebSearch on parkcitymountain.com).

### Per resort

#### alta
- Elevations: base 8,530 ft ("Alta Ski Area is located at 8,530 feet", `https://www.alta.com/Ikon`, fetched); highest lift unload 10,500 ft ("skiers unload the Sugarloaf lift at 10,500 feet above sea level", `https://www.alta.com/first-time-skiing-alta`, fetched). Mt Baldy peak is about 11,068 ft but not lift-served, so not used.
- Base point is the Wildcat base area. Summit point is on the Baldy/Sugarloaf flank, the DEM reads 136 ft above the stated top.
- Snowfall: `https://www.alta.com/about` says "averaging 543 inches of snow each winter", record 903 in 2022-23.
- SNOTEL 1308:UT:SNTL Atwater, 8,750 ft, 0.3 km. Next: 766 Snowbird 2.8 km, 366 Brighton 4.9 km.
- UAC 1738 (base and summit inside).
- Opening: "Opening Day is scheduled for Friday, November 20th—conditions permitting." (`https://www.alta.com/`, fetched). 2026-11-20.
- Note on last season's slip: the GM update page (`.../stories/november-update-from-altas-gm`) says the target was moved to Dec 1; Townlift's article listed Nov 21 first.
- Links: webcams and report both `https://www.alta.com/weather` (page has anchors #mountain-cams, #snow-report, #road-conditions). `https://www.alta.com/weather/webcams` is 404.

#### snowbird
- Elevations from `https://www.snowbird.com/about` (fetched): "the lowest point on the mountain is at the bottom of Baby Thunder chairlift at 7,760 feet", "The top of the resort is 11,000-foot Hidden Peak", "Averaging more than 500 inches of annual snowfall", "Mid-November through May".
- The Snowbird Center/Plaza area reads 8,110 ft in the DEM (more than 300 ft above 7,760). I moved the base point to 40.579,-111.662 near Entry 1 (7,989 ft DEM) so it sits within 230 ft. This is approximate, not a surveyed lodge point.
- SNOTEL 766:UT:SNTL Snowbird, 9,170 ft, 1.1 km. UAC 1738 (inside). Opening Nov 27 (Ski Utah / Deseret, projected). Report page `.../the-mountain/mountain-report/`, webcams `.../the-mountain/webcams/`.

#### brighton
- `https://www.brightonresort.com/about` (fetched): "Average Annual Snowfall: 500"", "Vertical, Lift-Serviced Drop: 1,875'", "Base Elevation: 8,755'", "Top Elevation: 10,500'". Also "annual snowfall average of over 500"".
- SNOTEL 366:UT:SNTL Brighton, 8,790 ft, 0.2 km. UAC 1738 (inside).
- Opening: Brighton has not announced and Ski Utah says TBA. I used 2026-12-04, which is **OnTheSnow's projection** (seen in a WebSearch result; page not fetched), not an announcement. Last season Brighton announced on 2025-11-28 for Tue 2025-12-02 (`.../press-kit/press-releases/brighton-resort-announces-opening-day-25-26`, fetched: two runs on Majestic and Explorer lifts).
- Links: report and webcams both `https://www.brightonresort.com/conditions` (it has a "LIVE CAMS" section naming Molly Green's, Top of Crest 6, Explorer Lift, Milly Express as text). No stills.

#### solitude
- `https://www.solitudemountain.com/mountain-and-village/mountain-information/solitude-by-the-numbers` (fetched): "Bottom Elevation: 7,994 feet", "Top Elevation: 10,488 feet", "Average Snowfall: 500 inches/year", "Skiable Acres: 1,200", "Total Vertical: 2,494 feet". OnTheSnow lists 376-387 in (third party, cited in the note).
- Base point is the Solitude Village (DEM 8,199, 205 ft above stated base). The summit point is a guess, see Weak spots.
- SNOTEL 366:UT:SNTL Brighton, 8,790 ft, 2.4 km (nearest; Mill-D North 628 at 8,940 ft is 5.8 km away and in the same canyon, but farther). UAC 1738 (inside).
- Report: MtnPowder 65, stations `["MidMountainArea"]`.
- Opening: homepage announces an opening party on November 20, "conditions permitting" (WebFetch of `https://www.solitudemountain.com/`), matches Ski Utah. 2026-11-20. Last season (Townlift): aiming for Nov 14, updated list said Nov 27.

#### parkcity
- Elevations and snow from `https://www.parkcitymountain.com/the-mountain/about-the-mountain/mountain-info.aspx` (WebFetch, since curl hits the bot wall): summit 10,026 ft (3,056 m), base 6,800 ft (2,073 m), average yearly snowfall 355 in. Wikipedia lists a 6,900 ft base.
- Base point is the Mountain Village area, DEM 6,972. Summit point is a DEM search near Jupiter Peak (USGS coordinates recalled 40.6256,-111.5644 read only 9,606 ft so I used 40.625,-111.567 at 9,902).
- SNOTEL 814:UT:SNTL Thaynes Canyon, 9,260 ft, 3.8 km. There is no SNOTEL near the 6,800 ft base; this one is within 2,000 ft of the summit and mid-mountain, not the base.
- UAC 1738 (summit inside; base about 1.8 km outside). No MtnPowder feed (Vail resort).
- Opening 2026-11-20: Ski Utah and Deseret, projected. The resort itself (Vail) had not been checked for its own announcement; the Vail opening-dates article could not be reached for this resort.
- Park City is the combined resort including the former Canyons side; the base/summit and coordinates are the Park City Mountain side only.

#### deervalley
- MtnPowder feed 49 reports AnnualAverageSnowfallIn 300. Elevations: Deer Valley press kit via WebSearch snippets: base 6,570 ft (2024 kit), later kits 6,530 ft (East Village), top 9,570 ft, 300 in. I could not fetch the kit itself (`https://deervalley.com/-/media/Deer-Valley/Media/DeerValleyMediaPressKit2024.pdf` returns 404 now). Wikipedia says 6,530 ft base.
- Base point is Snow Park Lodge, about 7,200 ft in the DEM. The 6,570/6,530 ft figures belong to the lowest base area (East Village).
- Summit point: a DEM search over the ski area found a high point at 9,308 ft near 40.609,-111.482. It is not a verified top-of-lift location.
- SNOTEL 814:UT:SNTL Thaynes Canyon, 9,260 ft, 4.8 km. UAC 1738 (both points outside, nearest). Report: MtnPowder 49 with Base/MidMountain/Summit.
- Opening 2026-12-05: Ski Utah and Deseret, projected. Last season the resort planned Dec 1 (Townlift).

### Weak spots

1. **Deer Valley base elevation vs point:** base lat/lon (Snow Park Lodge, DEM 7,241) is 670 ft above `baseFt` 6,570 (the resort's own figure, for the lowest base). Either accept, or set `baseFt` near 7,200 (Snow Park Lodge; no resort page found that states it). The NWS base cell is 7,454 ft.
2. **Summit points are approximate**, from the 90 m DEM: Solitude (10,016 vs 10,488, 472 ft low and the least certain point; I could not identify the top-of-lift location), Deer Valley (9,308 vs 9,570), Park City (9,902 vs 10,026), Brighton (10,394 vs 10,500; Mount Millicent coordinate). Alta's DEM reads 136 ft above the stated top.
3. **Snowbird base point** was moved from Plaza (8,110 ft) to near Entry 1 to match the resort's 7,760 ft figure.
4. **Brighton opening date 2026-12-04 is an OnTheSnow projection**, not an announcement or a stated target. Brighton and Ski Utah say TBA.
5. **All other opening dates are Ski Utah projections** (Deseret repeats them), except Alta (alta.com says Nov 20, conditions permitting) and Solitude (opening party Nov 20). Park City's own Vail announcement was not found.
6. **Avalanche zone for Deer Valley (and Park City base)** is nearest-zone, not coverage: both Deer Valley points lie outside every UAC polygon. The UAC forecast product is expired (2026-09-16) until winter forecasts start.
7. **SNOTEL fit:** Park City and Deer Valley use Thaynes Canyon at 9,260 ft, which is 2,460 and 2,690 ft above their bases. Solitude uses Brighton SNOTEL (2.4 km, canyon over).
8. **Park City page URLs** (webcams, report) come from search results and cannot be verified with curl (bot wall). WebFetch loaded the mountain-info page only. Deer Valley press-kit PDF is unavailable, so its elevation/300-in figures rest on search snippets plus the MtnPowder feed and Wikipedia.
9. **Local notes:** lake-effect and Cottonwood notes rest on Ski Utah's 2018 DIY forecasting article; NWS Salt Lake lake-effect material (`talite0502.pdf`) concerns Salt Lake City valley lake-effect, so it is not cited for the canyons. The Park City March 2024 Jupiter closure note comes from a KPCW search snippet (URL fetched 200, article text not read). Wind-hold counts from other search snippets (17 Park City lifts, 4 Deer Valley, Jan 2022) were left out because I could not tie them to a fetched source.
10. **Ignore list:** "southwest Wyoming" is not ignored (see above), so some SLC sentences will carry Wyoming wording.
11. **No resort cams** for Alta, Brighton, Solitude, Park City, Deer Valley (embed-only); Snowbird has one still.

---

## Colorado resorts: source evidence (checked 2026-10-23)

Validation: `parseConfig({ resorts: [...8 entries] })` printed `valid 8` (tsx, repo `pipeline/config.ts`). `links.avalanche` is not yet in the schema, so zod strips it silently, as expected.

### Cross-cutting checks

- **Elevation API** (`https://api.open-meteo.com/v1/elevation?latitude=..&longitude=..`, batch). Forecast and ensemble APIs not called. DEM in ft: Vail base 8,179 / summit 11,555; Breckenridge 9,551 / 12,825; Keystone 9,278 / 12,254; A-Basin 10,804 / 12,444; Copper 9,754 / 12,280; Winter Park 9,094 / 11,959; Steamboat 6,906 / 10,446; Snowmass (39.2135,-106.9333) 8,172 / 12,487. All base points within ~100 ft of the resort's base figure; summit points within 300 ft of the resort summit figure (A-Basin explained below).
- **How summit points were picked:** OpenStreetMap lifts (Overpass `way["aerialway"]` per resort bbox), endpoints elevation-checked with the DEM, the top terminal of the highest lift used. Examples: Vail Pete's Express top (39.5730,-106.3079) 11,555 ft; Breckenridge Imperial SuperChair top 12,825 ft (the resort calls it 12,840); Keystone Bergman Express top 12,254 ft; A-Basin Lenawee Express top 12,444 ft; Copper Mountain Chief top 12,280 ft; Winter Park Panoramic Express top 11,959 ft; Steamboat Morningside top 10,446 ft; Snowmass Cirque T-Bar top 12,487 ft. The old memory-derived Breckenridge summit (DEM 9,990) is replaced.
- **NWS points** (`/points/<base>`, `properties.cwa`): GJT for Vail (GJT 174,121; grid 8,950 ft), Steamboat (162,159; 7,323), Snowmass (152,103; 8,652). BOU for Breckenridge (25,53; 9,797), Keystone (29,58; 9,396), A-Basin (32,59; 11,880), Copper (22,54; 9,800), Winter Park (37,70; 9,396). Summit-point grid elevations: Vail 11,099, Breckenridge 12,264, Keystone 11,998, A-Basin 11,880, Copper 12,093, Winter Park 11,253, Steamboat 9,728, Snowmass 12,349. So no `afdOffice` needed anywhere.
- **AFDs read** (latest of the 12 most recent, issued 2026-10-23): BOU `https://api.weather.gov/products/67e1d5ec-5508-4cb8-8ea1-7a4fd2e57d0f` (19:38Z), GJT `https://api.weather.gov/products/1f428405-b494-43da-a204-9b52a995dcd5` (20:04Z). Vocabulary counted across the 12 most recent per office (it is late October, so text is mostly flood and rain talk):
  - BOU: "plains" (48), "Denver" (41), "I-25" (11), "urban corridor", "Lincoln" (eastern plains county), "Boulder" (12), "Front Range" (4), "mountains" (21), "Mosquito Range", "Park County", "Wyoming" (7), "Utah" (7), "Four Corners" (3), "I-70" (3). **Not found:** "Palmer Divide", "northeast plains", "foothills", "high country", "Continental Divide". BOU `ignore` = plains, Denver, I-25, urban corridor, Lincoln, Boulder. Left out on purpose: Wyoming, Utah and Four Corners (they show up in sentences about the storm track that matter to the mountains) and "Front Range".
  - GJT: "San Juan(s)" (45), "Four Corners" (18+), "southeast Utah", "southwest Colorado", "southern foothills", "Pagosa Springs", "CO/NM border", "Western Colorado", "I-70" (15, mostly "south of I-70"), "Grand Junction". GJT `ignore` = San Juan, Four Corners, southeast Utah, southwest Colorado, southern foothills, Pagosa Springs, NM border. Left out: "south of I-70" (Snowmass sits south of I-70 geographically) and "Utah" alone.
  - Winter-season vocabulary is unverified; re-check in January (no Elk, Gore, Flat Tops, Sawatch, Park Range terms appeared in October).
  - `nws.area` strings are my description of each resort's piece of the region, not quoted from the AFD.
- **Snowpack:** AWDB station list `https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/stations?networkCds=SNTL&stateCds=CO` (the `activeOnly` param was ignored; filtered to CO + SNTL + endDate 2100, 118 stations). Each chosen id checked with `.../data?stationTriplets=<id>:CO:SNTL&elements=SNWD&duration=DAILY&beginDate=2026-10-15&endDate=2026-10-24`: HTTP 200, 8 daily values through 2026-10-22. SNWD all 0 in for 842, 415, 505, 1186, 669; 457 Dry Lake 0-1 in; 1101 one reading of 1 in on 10-17; 709 Rabbit Ears and 825 Tower (not used) 0-4 in.
- **MtnPowder** re-fetched `https://www.mtnpowder.com/feed?resortId=<id>` (the old `?resortId` filter is ignored by the all-resorts query but the per-id feed is fine): 5 Winter Park (Base "Village", Mid-Mountain, Summit; SnowReport.LastUpdate 2026-10-07; TotalTerrainAcres 3081; 0 in everywhere), 6 Steamboat (Base, Mid-Mountain, "Storm Peak Summit"; LastUpdate 2026-10-19; Alert text "See you on our scheduled Opening Day on Saturday, November 21!"), 93 Arapahoe Basin (only MidMountainArea has values; BaseArea and SummitArea are "--"; LastUpdate 2026-10-21; report text says "We will open ASAP"). No feed with a usable SnowReport for Vail, Breckenridge, Keystone, Copper (Name only, id 55) or Snowmass/Aspen (ids 51-54, Name only), from the earlier scan in `2026-10-23-phase3-sources.md`.
- **Radar:** `https://radar.weather.gov/station/KFTG/standard` and `.../KGJX/standard` both HTTP 200 (SPA shell). KFTG (Denver) for the BOU resorts, KGJX (Grand Junction) for the GJT resorts. Mountain beam blockage is likely at both; no closer NEXRAD exists.
- **Links:** every `website`, `webcams`, `report`, `cotrip.org` and `avalanche.state.co.us` URL returned 200 to curl with the powder UA, except vail.com, which returns 403 to every non-browser request (bot wall, same as the Vail resorts in the Tahoe round). The Vail webcam and snow-report URLs come from vail.com's own search listing (`/the-mountain/mountain-conditions/mountain-cams.aspx`, `/snow-and-weather-report.aspx`). steamboat.com returns a ~1 KB JS shell to curl for every page (200).
- **Avalanche:** no `avalanche` block for any Colorado resort; `links.avalanche` = `https://avalanche.state.co.us/` on all 8. `links.roads` = `https://www.cotrip.org/` on all 8.
- **Cams** (resort-published JPG stills, HTTP 200 `image/jpeg`, `last-modified` within minutes of the fetch): A-Basin Mountain Goat Plaza and Montezuma Bowl (labels from the cam page `https://www.arapahoebasin.com/the-mountain/webcams/`), Copper snow stake (on the copper homepage via HD Relay; HEAD returns 500, GET returns the image), Winter Park town cam (`cams.winterparkresort.com/best-western-cam.jpg`, linked from the resort's own cam page). No direct stills found for Vail, Breckenridge, Keystone (pages not fetchable or JS players), Steamboat (shell), Snowmass (Roundshot panoramas, not stills).

### Per resort

#### vail
- Core: base 39.6405,-106.3743 (Vail Village; DEM 8,179). Summit 39.5730,-106.3079. baseFt 8,120 / summitFt 11,570 from `https://news.vailresorts.com/2011-09-08-Vail-Mountain-Winter-Fast-Facts-2012-13` ("Base Elevation 8,120 ft, Peak Elevation 11,570 ft, Average Annual Snowfall 354 inches"). That is a 2012-13 sheet; vail.com's stats page is bot-walled.
- NWS: GJT. SNOTEL 842:CO:SNTL Vail Mountain, 10,290 ft, 2.6 km.
- Report: none. Opening 2026-11-13: Denver7 `https://www.denver7.com/news/local-news/vail-resorts-announces-target-opening-dates-for-2026-2027-season` (Vail Resorts' target dates released Aug 18, 2026; Vail Mountain Nov 13). Also Colorado Biz and Denver Gazette. A target, weather permitting.
- Notes: base/summit/snowfall (fast facts); northwest wind (Colorado Sun, fetched, quotes OpenSnow's COO); opening target.

#### breckenridge
- Core: base 39.4854,-106.0478 (BreckConnect Gondola, Main Street end; DEM 9,551). Summit 39.4727,-106.1013 (Imperial SuperChair top; DEM 12,825, 173 ft under the resort's 12,998 summit figure, which is a peak, not a lift). baseFt 9,603 / summitFt 12,998 and 353 in snowfall from the Breckenridge Tourism Office (`https://gobreck.com/plan-your-visit/travel-faqs/facts-stats-breckenridge/`, fetched), which also says Imperial Express tops out at 12,840 ft. Not the resort's own site (breckenridge.com serves a 1,868-byte stub to curl).
- NWS: BOU. SNOTEL 415:CO:SNTL Copper Mountain, 10,500 ft, 10.6 km (nearest; no station on the Breckenridge ski area itself; alternates Michigan Creek 937 at 10,700 ft/13 km, Hoosier Pass 531 at 11,600 ft/13.9 km).
- Report: none. Opening 2026-11-06: Denver7 (same release), target.
- Notes: gobreck facts; Colorado Sun Summit County wind and wraparound-storm paragraphs.

#### keystone
- Core: base 39.6045,-105.9565 (River Run; DEM 9,278). Summit 39.5634,-105.9147 (Bergman Express top; DEM 12,254 vs 12,408 resort summit, a hike-to). baseFt 9,280 / summitFt 12,408 from `https://news.vailresorts.com/2011-09-08-Keystone-Winter-Fast-Facts-2012-13` ("9,280 ft base, 12,408 ft summit, 235 inches average annual snowfall, 662 acres of snowmaking"). 2012-13 sheet.
- NWS: BOU. SNOTEL 505:CO:SNTL Grizzly Peak, 11,110 ft, 8.8 km (alternates Loveland Basin 602 at 11,410 ft, Summit Ranch 802 at 9,350 ft/21 km).
- Report: none. Opening 2026-10-24: Denver Gazette, Oct 15, 2026 (`.../2026/10/15/race-to-open-snowmaking-underway-at-four-colorado-ski-areas/`): "Keystone is already selling lift tickets for October 24", and hitting it "may be tight". Vail Resorts' release only says "as soon as possible in October" (Denver7). Not a firm announcement.
- Notes: fast facts, Colorado Sun, opening.

#### abasin
- Core: base 39.6413,-105.8737 (Molly Hogan bottom, Mountain Goat Plaza; DEM 10,804). Summit 39.6245,-105.8744 (Lenawee Express top; DEM 12,444). baseFt 10,780, summitFt 12,456 (A-Basin's own cam page: summit building at 12,456 ft; events pages give 10,780 ft starts). The homepage (`https://www.arapahoebasin.com/`) lists "13,050 FT Summit Elevation, 2,530 FT Vertical Drop, 1,428 acres, 73% advanced-expert, Oct 9 earliest opening, Aug 10 latest closing". 13,050 is the East Wall hike-to; the lift-served top is 12,456, and 13,050 minus 2,530 would imply a 10,520 ft base, so I used the lift-served figures that match the DEM.
- NWS: BOU (grid 11,880 ft, matches). SNOTEL 505:CO:SNTL Grizzly Peak, 0.7 km.
- Report: MtnPowder 93, `stations: ["MidMountainArea"]` (only station with data).
- Opening: not announced. Resort and MtnPowder text say "ASAP"; snowmaking has started; the Denver Gazette guessed Oct 23/24 but says it is only a guess. No `openingDate` set.
- Notes: homepage stats; Colorado Sun; wind (KDVR 2022-04-05 wind-hold list, Teton Gravity Research 2025-12-19, both fetched).

#### copper
- Core: base 39.4990,-106.1500 (Super Bee/Pitchfork base; DEM 9,754). Summit 39.4683,-106.1744 (Mountain Chief top; DEM 12,280 vs 12,441). baseFt 9,712 / summitFt 12,441, 299 in average, 379 acres snowmaking, season totals 352/340/263 from `https://www.coppercolorado.com/the-mountain/mountain-safety-stats/winter-mountain-stats/` (fetched). The same page says "Winter opening day is November 6!".
- NWS: BOU. SNOTEL 415:CO:SNTL Copper Mountain, 10,500 ft, 2.1 km.
- Report: none (MtnPowder 55 is name only). Opening 2026-11-06: resort stats page plus Unofficial Networks Sept 8, 2026 ("kick off the 2026/27 ski season on Friday, November 6th", fetched).
- Notes: stats page; Colorado Sun "in-between case"; opening.

#### winterpark
- Core: base 39.8859,-105.7631 (Gondola base in the Village; DEM 9,094). Summit 39.8443,-105.7819 (Panoramic Express top; DEM 11,959 vs 12,060). baseFt 9,000 / summitFt 12,060, 3,081 acres, "over 344.6 inches" from `https://www.winterparkresort.com/the-mountain/mountain-information/statistics` (fetched). MtnPowder lists 322 in; I used the resort's own page.
- NWS: BOU. SNOTEL 1186:CO:SNTL Fool Creek, 11,130 ft, 9.1 km (same west-of-the-Divide Fraser basin; alternate Berthoud Summit 335 at 11,300 ft/9.2 km is on the Front Range side).
- Report: MtnPowder 5 (Base/Mid/Summit).
- Opening: not announced. `https://www.winterparkresort.com/the-mountain/hours-of-operation` says "first day of skiing and riding for winter 26/27 is as soon as possible (ASAP)"; the 12/5/26 on that page is the start of extended weekend hours, not the opening. Last year's first day was Oct 31, 2025. No `openingDate` set.
- Notes: stats page; Colorado Sun (NNW down the Fraser Valley); Denver Gazette 2023-12-04 (15 in at Winter Park from northwest flow); hours page.

#### steamboat
- Core: base 40.4571,-106.8034 (Gondola Square; DEM 6,906). Summit 40.4551,-106.7441 (Morningside top; DEM 10,446 vs 10,568 resort). baseFt 6,900 comes from the resort's mountain-stats page as quoted in search results; `https://www.steamboat.com/the-mountain/mountain-stats` returns a JS shell to curl, so I could not read it directly. summitFt 10,568: Storm Peak Laboratory "at 10,568 feet atop Mount Werner" in the 2025-26 press kit (`.../press-kit-2526.pdf`, fetched, which also gives 3,741 acres and a 10-year average of 289 in).
- NWS: GJT (base grid 7,323 ft; summit grid 9,728 ft, about 840 ft under the summit, so the NWS summit line reads low). SNOTEL 457:CO:SNTL Dry Lake, 8,240 ft, 8.7 km (alternates Rabbit Ears 709 at 9,390 ft/11.3 km, Tower 825 at 10,610 ft/14 km, which had 1-4 in this week).
- Report: MtnPowder 6 (Base, Mid-Mountain, Storm Peak Summit).
- Opening 2026-11-21: resort alert in its MtnPowder feed (LastUpdate 2026-10-19): "See you on our scheduled Opening Day on Saturday, November 21!". Other outlets disagree (Denver Gazette Nov 20, Freeskier Nov 9), so I used the resort's own.
- Notes: press kit (northwesterly Pacific storms, Park Range, Champagne Powder, rime ice); Colorado Sun ("Steamboat surprise" on west/west-northwest wind, summit near 5 F); opening alert.

#### snowmass
- Core: base 39.2135,-106.9333 (Snowmass Village near Fanny Hill; DEM 8,172; the village mall point 39.2096,-106.9378 reads 8,445). Summit 39.1600,-106.9647 (Cirque T-Bar top; DEM 12,487). baseFt 8,110 / summitFt 12,510, 3,342 acres, 300 in from the resort's mountain-stats PDF (`.../25-26/aspen-snowmass-mountain-stats.pdf`, fetched and read: Snowmass base 8,110 ft, summit 12,510 ft).
- NWS: GJT (grid 8,652 ft base, 12,349 summit).
- SNOTEL: 1101:CO:SNTL Chapman Tunnel, 10,090 ft, 26.7 km. Nothing closer than 23 km: North Lost Trail 669 (9,190 ft, 23.6 km, 0 in), Schofield Pass 737 (10,640 ft, 24.3 km). Chapman Tunnel chosen for elevation (the mid-mountain is about 10,000 ft).
- Report: none (MtnPowder 51-54 name only). Opening 2026-11-26: `https://www.aspensnowmass.com/four-mountains/snowmass` and `.../snowmass/mountain-cams` both say "Snowmass Season Dates Open: November 26, 2026 Close: April 11, 2027".
- Notes: stats PDF; Colorado Sun (west and west-northwest wind); season dates.

### Weak spots

- **Two resorts have no `openingDate`:** Arapahoe Basin and Winter Park say "as soon as possible", with no date. Both have MtnPowder feeds, so status should come from the feed. Last season: Winter Park Oct 31, 2025 (resort page), A-Basin Oct 26, 2025 (reported by Unofficial Networks, not fetched).
- **Keystone's 2026-10-24 is soft:** it comes from ticket sales reported by the Denver Gazette, not an announcement. If Keystone slips, the app will show a stale "Opening Oct 24". Vail Resorts itself only says "as soon as possible in October".
- **Stats are old for Vail and Keystone** (2012-13 Vail Resorts fast-facts sheets), and Breckenridge comes from the town tourism office, because vail.com, breckenridge.com and keystoneresort.com are bot-walled. Steamboat's base 6,900 is second-hand (JS page).
- **A-Basin summitFt** is the lift-served 12,456 ft, not the resort's headline 13,050 ft (hike-to East Wall).
- **SNOTEL:** Breckenridge uses Copper Mountain's station (10.6 km, Tenmile Range, 10,500 ft); Keystone and A-Basin share Grizzly Peak; Snowmass's is 26.7 km away; Steamboat's Dry Lake sits at 8,240 ft, well below the summit. All read 0-1 in this week, so none confirms its usefulness for snow depth yet.
- **NWS grid points sit below summits** at Vail (11,099 vs 11,570), Winter Park (11,253 vs 12,060) and Steamboat (9,728 vs 10,568), so the "NWS forecasters" summit line reads low there. A-Basin's base grid cell is 11,880 ft, above its 10,780 ft base.
- **AFD vocabulary** is from a flood-and-rain week; ignore lists may need extending in winter. "Palmer Divide" and "northeast plains" never appeared, so are not in the BOU list.
- **Radar:** KFTG and KGJX are 50-150 miles away across mountains; Steamboat in particular is far from both.
- **Cams:** only A-Basin (2), Copper (snow stake) and Winter Park (a town cam) have direct stills. Copper's HD Relay URL is not a documented stable endpoint.
- **Snowfall averages differ by source** (Winter Park 344.6 vs MtnPowder 322; Breckenridge 353 vs OnTheSnow 293; Steamboat 289 ten-year vs older 314-400). Notes quote the resort's own figure and name it.

---

## Pacific Northwest resorts: source evidence (checked 2026-10-23)

Entries: `/private/tmp/claude-501/-Users-paigeschmitt-Projects-powder--claude-worktrees-build/6ebbabac-fe02-463e-a9be-8ddd5347c8c1/scratchpad/phase3-pnw.json` (5 entries, WITH `roads` arrays). Validation: `parseConfig` on `{ resorts: [...] }` with `roads` removed printed `valid 5`.

### Cross-cutting checks

- **Elevation API** (`https://api.open-meteo.com/v1/elevation`, batch points; no forecast/ensemble calls made). All chosen points are within ~125 ft of the stated elevation (table below). Summit points were found from OpenStreetMap lift geometry (Overpass) and checked against the DEM, and for Stevens by a DEM grid search.

| Resort | Base point | DEM ft | Stated base ft | Summit point | DEM ft | Stated summit ft |
|---|---|---|---|---|---|---|
| Crystal | 46.9357,-121.4749 (gondola base) | 4,383 | 4,400 | 46.9356,-121.5006 (gondola top) | 6,801 | 6,872 |
| Stevens | 47.7447,-121.0890 | 4,091 | 4,061 | 47.7310,-121.1020 (Cowboy Mtn ridge) | 5,725 | 5,845 |
| Baker | 48.8621,-121.6798 (Heather Meadows, Chair 1 bottom) | 4,235 | 4,300 | 48.8483,-121.6652 (Chair 8 top) | 5,121 | 5,089 |
| Bachelor | 43.9996,-121.7172 (Northwest Express bottom) | 5,709 | 5,700 | 43.9776,-121.6859 (Summit Express top) | 8,979 | 9,065 |
| Meadows | 45.3331,-121.6652 (main lodge, Mount Hood Express bottom) | 5,377 | 5,366 | 45.3494,-121.6818 (Cascade Express top) | 7,421 | 7,305 |

- **NWS** `https://api.weather.gov/points/<lat,lon>`: SEW (Seattle) for Crystal (grid 145,31), Stevens (165,67), Baker (157,123). PQR (Portland) for Meadows (144,89). PDT (Pendleton) for Bachelor (22,41). Each is the CWA of the base, so no `afdOffice`. Radar station returned by /points: KATX (Crystal, Stevens, Baker), KRTX (Bachelor, Meadows).
- **AFDs read** (latest at 2026-10-23): SEW `https://api.weather.gov/products/159c8a8c-0d7f-4957-949d-224870875424` (20:16Z), PQR `.../products/e102528b-571e-4099-b6e8-0a52eaa76494` (21:15Z), PDT `.../products/a905c564-560b-48cc-99cc-47984b7a609a` (21:51Z). Every `ignore` term was checked to appear in its office's text (case-insensitive).
  - SEW vocabulary: "Cascades and adjacent foothills", "Puget Sound", "Olympic Peninsula", "windward slopes of the Olympics", "coast". Ignore: Puget Sound, Olympic, coast.
  - PQR vocabulary: "Willamette", "Vernonia", "Grand Ronde", "Upper Hood River Valley", "inland valleys", "sheltered valleys", "south Washington coast", "KPDX". Deliberately did NOT ignore "coast"/"Coast Range"/"I-5 corridor" alone because the one sentence with a Cascades rain probability ("50-60% in the Cascades and foothills") shares a sentence with them. Ignore terms are sentence-level substring matches (`filterAfd`).
  - PDT vocabulary: Blue Mountains, Columbia Basin, Columbia River Gorge, Yakima Valley, "Washington Cascades", "Oregon Cascades", Ochoco-John Day Highlands. Did not ignore plain "Blue Mountains" because the useful sentence "Higher chances ... for the Oregon Cascades and northeast Blue Mountains" contains it; used the narrower phrases "northern Blue Mountains", "Blue Mountain foothills", "across the Blue Mountains".
  - This is an off-season (fall) discussion; winter text will use other vocabulary (snow levels, pass names). Re-check in November.
- **NWS grid-cell elevations** (`forecastGridData` `elevation`): Crystal 5,233 ft (base and summit share one cell), Stevens base 4,879 / summit 5,167, Baker Heather 4,265 / Chair 8 5,115, Bachelor base 5,833 / summit 7,638 (summit cell 1,400 ft below the peak), Meadows lodge 5,446 / Cascade top 6,086 (about 1,200 ft below). The Bachelor and Meadows summit values only affect the "NWS forecasters" line.
- **SNOTEL** (AWDB `stations?networkCds=SNTL&stateCds=WA,OR`, nearest by haversine from the base). Each chosen station returned HTTP 200 from `.../data?stationTriplets=<id>&elements=SNWD&duration=DAILY&beginDate=2026-10-15&endDate=2026-10-24` with 8 daily values, last 2026-10-22, SNWD 0 in.
  - Crystal: 642:WA:SNTL Morse Lake, 5,400 ft, 3.4 km (others: Cayuse Pass 1085, 8.6 km, 5,260 ft, also 200).
  - Stevens: 791:WA:SNTL Stevens Pass, 3,940 ft, 0.3 km.
  - Baker: 909:WA:SNTL Wells Creek, 4,040 ft, 8.1 km (alt: 999 Marten Ridge 3,520 ft, 11 km, 200).
  - Bachelor: 815:OR:SNTL Three Creeks Meadow, 5,680 ft, 17.2 km. Nearest station is a manual snow course (21E26:OR:SNOW New Dutchman #3, 4 km), not SNTL. 619:OR:SNTL McKenzie is 26 km, 4,770 ft.
  - Meadows: 651:OR:SNTL Mt Hood Test Site, 5,380 ft, 4.2 km.
- **Avalanche**: `https://api.avalanche.org/v2/public/products/map-layer/NWAC` and `.../COAA`, point-in-polygon (ray casting). Both base and summit points INSIDE: Crystal 3023 West Slopes South, Stevens 3024 Stevens Pass, Baker 3021 West Slopes North, Meadows 3032 Mt Hood (NOT 3027), Bachelor COAA 2470 Central Cascades (also West Village 44.002,-121.6788 inside). `https://api.avalanche.org/v2/public/product?type=forecast&center_id=NWAC&zone_id=<3023|3024|3021|3032>` returns 200, non-empty dict (19 keys), id 185514, `product_type: summary`, published 2026-09-15, expires 2026-11-21, `danger: []`. COAA 2470: 200, id 185315, published 2026-05-01, expired 2026-07-16 (season over; stale, `danger: []`).
- **WSDOT passes** (`.../TravelInfoMtPassReports/FeatureServer/0/query?where=1%3D1&outFields=PassName&returnGeometry=false&f=json`, 200): 'Crystal to Greenwater SR 410', 'Stevens Pass US 2', 'Mt. Baker Hwy SR 542' present exactly as used (single spaces; note 'White Pass  US 12' has a double space and 'Tiger Mountain SR18' no space, so copy PassName verbatim).
- **WSDOT cameras** (`.../TravelInfoCamerasWeather/FeatureServer/0/query?where=1%3D1&outFields=CameraTitle,ImageURL&returnGeometry=false&f=json`, 1,706 cameras). Stevens: 4 cameras on US 2 MP 61.9-64.6; the 3 used return 200 `image/jpeg`, Last-Modified within a minute (`Fri, 23 Oct 2026 22:38 GMT`). **No cameras near Crystal/SR 410 above Enumclaw (the nearest SR 410 cameras are MP 9-25) or on SR 542**: checked by title regex (SR 410, SR 542, Glacier, Maple Falls, Chinook, Greenwater, Nooksack) and by envelope geometry queries around both areas (0 hits). So Crystal and Baker `roadCams` are empty.
- **Radar**: `https://radar.weather.gov/station/KATX/standard` and `.../KRTX/standard` return 200. api.weather.gov/radar/stations: KATX Seattle (48.19,-122.50), KRTX Portland OR (45.71,-122.96). Bachelor's `/points` radarStation is KRTX, but it is about 215 km away (KMAX Medford is about 225 km), so coverage of the Cascade crest is poor.

### Per resort

#### crystal (Crystal Mountain, WA)
- Stats: base 4,400, gondola top 6,872 (the highest lift; Silver King peak 7,012), 348 in avg 2001-2022, 2,600 ac (2,300 lift-served), earliest opening Oct 1, 2013: `https://snowbrains.com/first-snowfall-of-the-year-at-crystal-mountain-wa/` (fetched). The resort's own `https://www.crystalmountainresort.com/media/mountain-stats-and-facts` (found by search; curl is blocked by Incapsula, WebFetch returned nothing) is reported to list the same base/summit/gondola figures and the gondola at 4,456-6,856 ft. summitFt 6,872 is the lift top, not the 7,012 ft peak, to match the gondola-top point.
- MtnPowder `https://www.mtnpowder.com/feed?resortId=80` re-fetched (200): `Name` "Crystal Mountain", top-level `LastUpdate` 2026-10-23T15:34, but **`SnowReport.LastUpdate` is 2026-05-18** and holds spring values: BaseArea base 37 in, MidMountainArea 58, SummitArea 70, 0 of 11 lifts open, 0 of 85 trails, `AnnualAverageSnowfallIn` 480, `SeasonTotalIn` 281. Lift/trail statuses all "Closed for Season" (updated April). It will refresh when the resort reopens. Stations BaseArea, MidMountainArea, SummitArea all exist.
- Opening 2026-11-27: Ikon Pass "26/27 Tentative Opening Date" column, page last updated Sept 29, 2026: `https://www.ikonpass.com/en/opening-closing-dates` (WebFetch). OnTheSnow also projects Nov 27. Tentative, not a resort announcement. 2025-26 fully opened Dec 24 after Highway 410 damage: `https://visitrainier.com/crystal-opening-day/` (fetched).
- Links: website `https://www.crystalmountainresort.com/`; webcams page `.../the-mountain/mountain-report-and-webcams/webcams` and the parent report page came from search results, **not fetched** (Incapsula blocks curl). No keyless resort JPGs found, so no `links.cams`.

#### stevens (Stevens Pass, WA)
- Stats (resort, via WebFetch of `https://www.stevenspass.com/the-mountain/about-the-mountain/mountain-info.aspx`; curl gets a Vail stub): base 4,061 ft (1,238 m), highest elevation 5,845 ft (1,782 m), avg snowfall 460 in, 1,125 ac, 13 lifts. OnTheSnow header says 329 in (outlier); Wikipedia ~472 in.
- Summit point: the highest lift top (7th Heaven, 47.7336,-121.1039) reads 5,453 ft, about 390 ft under the stated 5,845 ft, so I used the Cowboy Mountain ridge at 47.731,-121.102 (DEM 5,725). Other lift tops: Skyline 5,213, Brooks 4,826, Hogsback 4,767 (ft, DEM).
- Opening 2026-12-04: Vail's 2026-27 opening dates (published Aug 18, 2026) list Kirkwood and Stevens Pass Dec 4, subject to weather: `https://coloradobiz.com/vail-resorts-2026-27-ski-season-opening-dates-colorado/` (fetched, text quoted). OnTheSnow projects Dec 26 (estimate, not used).
- Notes: PSCZ mechanics from `https://opensnow.com/news/post/puget-sound-convergence-zone-explained` (fetched): westerly low-level flow; SW flow from the Strait of Juan de Fuca meets northerly flow from the Strait of Georgia; narrow bands to Stevens and Snoqualmie. NWAC forecast discussions (e.g. `nwac.us/mountain-weather-forecast/2746`) return 404 now, so I did not cite any NWAC statement about NW flow shifting the zone south.
- Roads: WSDOT pass "Stevens Pass US 2"; roadCams `002vc06458` (East summit), `002vc06430` (West, ski lodge), `002vc06190` (Old Faithful avalanche zone), all 200 image/jpeg.
- Links: webcams `.../the-mountain/mountain-conditions/mountain-cams.aspx` and report `.../lift-and-terrain-status.aspx` come from search results (Vail site returns a stub to curl; not fetched). No resort JPGs.

#### baker (Mt. Baker, WA)
- Stats (fetched): `https://www.mtbaker.us/the-mountain/mountain-stats/`: avg annual snowfall 688 in (15-yr avg), record 1,140 in (1998-99), Panorama Dome 5,000, top of Chair 8 5,089, Heather Meadows base 4,300, White Salmon base 3,500, vertical rise 1,500, 1,000 ac. (Another Baker FAQ page says 663 in; the stats page is the more specific.) Snow totals by season: `https://www.mtbaker.us/the-mountain/snowfall-statistics/`.
- Base choice: Heather Meadows (4,300 ft, the main day lodge); the earlier research point (3,907 ft DEM) was between the two bases. The NWS grid cell for Heather is 4,265 ft. White Salmon (3,500 ft, 48.8614,-121.6544) sits in grid cell 158,123 at 2,808 ft.
- Opening 2026-12-18: **not announced**. OnTheSnow projected date (`https://www.onthesnow.com/pacific-northwest/projected-openings`). Search found no resort announcement. Past: passholders Dec 21 / public Dec 22 in 2025 after SR 542 landslides (`https://www.cascadiadaily.com/2025/dec/17/mt-baker-ski-area-will-likely-open-this-weekend/`, fetched).
- Roads: WSDOT pass "Mt. Baker Hwy SR 542". No WSDOT camera exists on SR 542 in the layer. Baker's own FAQ says to use WSDOT for highway conditions.
- Links: `https://www.mtbaker.us/snow-report/` is 200. No webcam page (`/webcams/` and `/the-mountain/webcams/` 404; the snow-report page has no cam links), so no `links.webcams`. No MtnPowder feed.

#### bachelor (Mt. Bachelor, OR)
- Stats (resort, fetched): `https://www.mtbachelor.com/the-mountain/resort-policies-safety/mountain-stats/`: top 9,065, lowest 5,700, vertical 3,365, 4,323 ac, 124 runs, **avg snowfall 410 in**. Resort blog `https://www.mtbachelor.com/culture/blog/super-el-nino-2627/`: 462 in avg in 9 La Nina seasons, 355 in 4 El Nino, 373 in 3 neutral (last 16 years); 1982/83 opened Nov 12 with 536 in.
- Base choice: West Village lodge reads 6,361 ft in the DEM, 660 ft above the resort's "lowest elevation 5,700", and the resort lists no base figure for it. I used the Northwest Express bottom (5,709 ft) so baseFt matches the resort's number. Pine Marten mid-mountain is 7,775 ft (search snippet of the resort's hiking page).
- Opening 2026-12-04: resort's mountain report says "Opening Day, scheduled for December 4, 2026": `https://www.mtbachelor.com/the-mountain/mountain-report/` (fetched). Ikon lists Dec 4 tentative. 
- Wind note from Bend Source (fetched), quoting the resort's mountain operations director: `https://www.bendsource.com/news/mt-bachelor-upgrades-ahead-of-the-ski-season-20088239/`.
- MtnPowder feed 96 is name-only (no SnowReport), so no `report`.
- Cams: `https://api.mtbachelor.com/api/v1/cams/mtn/{3,9,13}` are the `<img src>` on the resort's webcams page (labels The Cone, Pine Marten Lodge, West Village Base). They return 200 and the body is JPEG (`file`: 1280x720 / 1920x1080), but **the response has no Content-Type header** at all. Mid-October JPEGs, not verified as live in winter.
- Radar KRTX (see cross-cutting). `links.roads` TripCheck 200.

#### hoodmeadows (Mt. Hood Meadows, OR)
- Stats from search snippets of resort pages (the site is a client-rendered Next.js app; curl/WebFetch show only nav): `https://archive.skihood.com/en/the-mountain/hours-of-operations/mountain-statistics` and `https://www.skihood.com/explore/about-meadows`: top of Cascade Express 7,305, bottom of Hood River Express 4,528, vertical 2,777, 430 in/yr, 493 in avg in La Nina, 531 in 2022-23, 2,150 ac. A "base 5,366" figure appeared in the same snippet. DEM matches the main lodge at 5,377 ft; Hood River Express bottom reads 4,566 ft. I set baseFt 5,366 (main lodge) and put the 4,528 ft lowest lift in the notes.
- Opening 2026-12-18: **not announced** (skihood.com schedule page has no date). OnTheSnow projected date. History: KOIN table of openings since 1994 (`https://digital-release.koin.com/news/oregon/slow-start-to-ski-season-every-mt-hood-meadows-opening-dates-since-1994/`, fetched): usually around Thanksgiving, earliest Oct 21 1996, latest before 2025 was Dec 22 2014. 2025-26 opened Dec 23, latest on record: KPTV (`https://www.kptv.com/2025/12/24/mount-hood-meadows-opens-with-record-late-start-after-snow-finally-arrives`, fetched).
- MtnPowder: no feed. NWAC 3032 inside (base and summit).
- Links: `https://www.skihood.com/mountain-report` 200; `https://www.skihood.com/explore/live-web-cams` 200 (cams are in a client-rendered widget; no direct JPG URLs found, so no `links.cams`). `links.roads` TripCheck 200.

### Weak spots

1. **Opening dates**: only Bachelor (resort page) and Stevens (Vail announcement) are official. Crystal is Ikon "tentative" Nov 27. Baker and Meadows (both Dec 18) are OnTheSnow projections; no resort announcement was found. Recent PNW openings have run late (Meadows Dec 23, Baker Dec 21, Crystal Dec 24 in 2025-26).
2. **Crystal and Stevens resort sites are bot-walled to curl** (Incapsula, Vail stub). Stevens stats and the Crystal gondola figure came through WebFetch/search; the Crystal webcams and report URLs are unfetched. Crystal's average snowfall conflicts (resort feed 480, SnowBrains 348).
3. **Meadows stats** come from search-engine snippets of resort pages, not a page I could render.
4. **Crystal MtnPowder** snow depths (37/58/70 in) are from May; the feed's per-area data will look like fresh snow until the resort restarts reporting. Check the `SnowReport.LastUpdate` staleness handling.
5. **No road cameras** near Crystal (SR 410) or Baker (SR 542) in the WSDOT layer.
6. **Bachelor SNOTEL** is 17 km away on the east side of the Sisters (Three Creeks Meadow, 5,680 ft); the closer station is a manual snow course. COAA product is expired (season over).
7. **Bachelor cam URLs** serve JPEG bodies but no Content-Type header.
8. **Radar**: Bachelor is ~215 km from KRTX and ~225 km from KMAX; no closer NEXRAD.
9. **NWS ignore lists** come from an October dry-spell discussion; winter AFDs name passes and snow levels and may need new terms. Sentence-level filtering will drop mixed sentences (SEW: any sentence with "coast", "Puget Sound" or "Olympic").
10. Stevens `summit` is the ridge (5,725 ft DEM), not a lift top (7th Heaven top is about 5,450 ft).
11. Two baseFt choices differ from "lowest lift": Baker 4,300 (White Salmon is 3,500) and Meadows 5,366 (Hood River Express is 4,528); Bachelor 5,700 is the Northwest Express base, not West Village.
