# California and Nevada resorts: source evidence (2026-10-23)

Three research agents (Tahoe, Eastern/Central, SoCal) checked every source live with `curl`. Their per-resort evidence follows below, unedited. Then the controller reviewed the entries and changed them as listed here before merging into `resorts.json`.

## Review changes at merge

- **China Peak:** dropped `"Valley"` from `nws.ignore`. The HNX discussion talks about the San Joaquin Valley in the same sentences that give Sierra snow levels.
- **Dodge Ridge:** dropped the local note that rested on a single 2011 forum post, along with its source.
- **Bear Mountain:**
  - Replaced the agent's self-computed "about 110 inches" average with the resort's own season range (30–243 inches, last four seasons 243/175/79/51).
  - Kept `defaultFavorite: true`; the entry now covers Bear Mountain only (MtnPowder 57), and Snow Summit is its own entry (58).
- **Short names:** Snow Summit is "Snow Summit", not "Summit", which clashes with the Summit/Base toggle. Sierra-at-Tahoe is "Sierra-at-Tahoe", not "Sierra".

## Live verification

`npm run pipeline` at 2026-10-23T19:51Z showed every configured source ✓ for all 21 resorts. It used 1,133 Open-Meteo weighted calls and took 2m04s with pacing.

Known weak spots:
- **NWS grid cell below the summit:** Dodge Ridge's summit grid cell sits at 6,739 ft, against an 8,200 ft summit. It affects only the "NWS forecasters" line.
- **Opening dates from news reports:** Mt. Rose and Boreal come from ABC7. Heavenly, Northstar and Kirkwood come from SnowBrains' report of Vail's announcement.
- **No snow-report feed:** 13 of the 17 new resorts have none (all Vail resorts and most independents), so their last 24h comes from the nearest snow station.

---

# Tahoe region evidence (checked 2026-10-23)

Validation: `parseConfig` printed `valid` for all 9 entries in tahoe.json.

## Cross-cutting checks

- NWS `/points/<base lat,lon>` (User-Agent set), `properties.cwa`: **REV** for Northstar (39.2746,-120.1210), Heavenly (38.9353,-119.9400), Homewood (39.0840,-120.1610), Mt. Rose (39.3170,-119.8870), Diamond Peak (39.2530,-119.9235). **STO** (Sacramento, not REV) for Kirkwood (grid STO 91,63), Sugar Bowl (STO 87,93), Sierra-at-Tahoe (STO 92,69), Boreal (STO 87,94).
- AFDs read: REV `https://api.weather.gov/products/4ba278b9-bd7b-48d1-8a94-03ea877d32af` (issued 2026-10-23 09:40Z). Vocabulary used: "Lake Tahoe", "Sierra crest", "Carson Range", "northeast CA-western NV". STO `https://api.weather.gov/products/d4fe1492-0dbc-48ef-bfe2-848619b01f8b` (18:51Z). Vocabulary: "western slopes of the Sierra", "Sierra", "Shasta County mountains", "Coastal Range", "southern Cascades", "Sacramento Valley", "San Joaquin Valley", "Delta". STO `ignore` list built from those.
- Open-Meteo elevation check on base points: Northstar 6,375 ft, Heavenly 6,637, Kirkwood 7,812, Sugar Bowl 6,982, Homewood 6,280, Mt. Rose lodge (39.3257,-119.8855) 8,268, Diamond Peak 6,801, Boreal 7,175. Sierra (38.8002,-120.0806, Wikipedia coordinate) reads 7,290 in the DEM against a 6,640 ft base, so treat as approximate. Summit points were chosen by DEM search; the 90 m DEM smooths peaks (e.g. Heavenly 9,944 vs 10,067) and Northstar's reads only ~7,500 ft, so **summit lat/lon for Northstar (and Kirkwood) are approximate**.
- SNOTEL candidates: AWDB station list (`stations?networkCds=SNTL&stateCds=CA,NV`), nearest by distance. Each chosen id then checked with `data?stationTriplets=<id>&elements=SNWD&duration=DAILY&beginDate=2026-10-15&endDate=2026-10-24`: HTTP 200, 8 daily values, last 2026-10-22, SNWD 0 in for all except 652:NV:SNTL (2 in on 10-21, 3 in on 10-22). Rubicon #2 (724:CA:SNTL) returned HTTP 500 once and was not used.
- Avalanche: `https://api.avalanche.org/v2/public/avalanche-center/SAC` returns 200, one zone: id 2458 "Central Sierra Nevada". `.../product?type=forecast&center_id=SAC&zone_id=2458` returns 200, product id 185551, published 2026-10-20T22:04Z, expires 2026-11-01, `danger: []` (early season). Coverage tested by point-in-polygon against `.../products/map-layer/SAC` geometry: INSIDE for Heavenly, Kirkwood (base and 9,600 ft area), Sugar Bowl, Sierra-at-Tahoe, Homewood, Mt. Rose (base and summit), Diamond Peak, Boreal. **Northstar: the zone boundary runs through the resort.** The village (39.2746,-120.121) and mid-mountain (39.268,-120.11) are outside; the upper mountain (39.2615,-120.0975) is inside. I included it; drop it if you want strict base-in-zone.
- MtnPowder: scanned `https://www.mtnpowder.com/feed?resortId=N` for N=1..400, keeping every feed with a `Name`. No feed named Northstar, Heavenly, Kirkwood, Sugar Bowl, Homewood, Mt. Rose, Diamond Peak or Boreal exists. The only Tahoe-area hit is **215 "Sierra at Tahoe"**, which returns only `Name, LastUpdate, Forecast` (no `SnowReport`, no stations), and sierraattahoe.com/weather-snow-report/ says "Powered by OpenSnow" with no mtnpowder reference (0 hits in page HTML). Not usable, so **no entry has `report`**. Resort report pages checked for "mtnpowder": skihomewood.com/snowreport (0), skirose.com/snow-report (0), diamondpeak.com/the-mountain/mountain-report (0), rideboreal.com lift-trail-status (0), sugarbowl.com/conditions (0). The Vail sites (northstarcalifornia.com, skiheavenly.com, kirkwood.com) return an identical 1,868-byte stub for every path (even `/zzznotreal`) to curl, so their pages can't be inspected; they are Vail resorts and run Vail's own feed.
- Caltrans: chain-control JSON `https://cwwp2.dot.ca.gov/data/d3/cc/ccStatusD03.json` (200) and `.../d10/cc/ccStatusD10.json` (200). `roads.dot.ca.gov/roadscell.php?roadnumber=` returned 200 with an `<h3>` for 50 (`US 50`), 88 (`SR 88`), 89 (`SR 89`), 267 (`SR 267`), 80 (`I 80`). Stations inside each bbox (route-matched): I-80 Colfax→Truckee 53, I-80 Truckee→Reno 21, SR-89 Truckee→Tahoe City 5 (copied from Palisades), SR-89 Tahoe City→Emerald Bay 9 (Tahoe City, Tahoma, Harper's Grade, Bliss, Emerald Bay, Ebrights), SR-267 5 (Truckee Airport Rd, Martis Creek, Northstar Rd, Kings Beach, Truckee bypass), US-50 26 (Placerville to Meyers), SR-88 28 (Pine Grove to Red Lake Creek, including "KIRKWOOD" and "EAST OF CAPLES LAKE - CARSON PASS").
- Road cam JPGs (`https://cwwp2.dot.ca.gov/data/d3/cctv/image/<slug>/<slug>.jpg`), all 200 `image/jpeg`: hwy267atnorthstar, hwy267atbrockwaysummit, hwy50atechosummit, hwy50atskirun, hwy50atmeyers, hwy80atdonnersummit, hwy80atcastlepeak, hwy80atsodaspringseb, hwy89athwy28, hwy89atgranlibakken. D10 cctv list has no camera on SR-88 near Kirkwood (only Pine Grove and Clements), so Kirkwood has none.
- Radar: all use `https://radar.weather.gov/station/KRGX/standard` (200), the Reno radar already used for Palisades. nvroads: `https://www.nvroads.com/` 200.
- Schema note: `links.report` is in the brief but is **not in the zod schema** (`links` has website, webcams, cams, radar). zod strips it silently, so it validates but the pipeline won't see it. I included it where the page loaded; `links.roads` for the two Nevada resorts is likewise stripped.

## Per resort

### northstar (Northstar California)
- Stats: base 6,330 / summit 8,610 / 350 in / 3,170 ac, `https://news.vailresorts.com/Northstar-California-2024-25-Winter-Tip-Sheet` (200). This is the 2024-25 tip sheet; resort site is bot-walled.
- Snowpack 834:CA:SNTL Truckee #2, 6,500 ft, 6.2 km, last data 2026-10-22.
- Avalanche SAC 2458 (partial coverage, see above).
- Roads: I-80 Colfax→Truckee, SR-267. Cams: Hwy 267 at Northstar, Brockway Summit.
- Opening 2026-11-20: SnowBrains "Vail Resorts Announces 2026-27 Opening Dates" (200) lists Heavenly Nov 20, Northstar Nov 20, Kirkwood Dec 4.
- Omitted: report (Vail, not MtnPowder), webcams link and links.cams (resort site can't be fetched; no JPG verified).

### heavenly
- Stats: Vail fast facts `https://news.vailresorts.com/2011-08-25-Heavenly-Winter-Fast-Facts-2012-13` (200): base 6,540 ft California / 7,200 ft Nevada, summit 10,067, 360 in summit / 125 in lake level, snowmaking 73%. **This is a 2011-12 page**; skiheavenly.com is bot-walled. Wikipedia lists a 6,255 ft base; I used the California-side 6,540 ft per the brief.
- Snowpack 518:CA:SNTL Heavenly Valley, 8,540 ft, 2.4 km, last 2026-10-22.
- Avalanche SAC 2458 (base and summit points inside). Roads: US-50. Cams: Hwy 50 at Echo Summit, Hwy 50 at Ski Run.
- Notes: wind closure of Gondola/Tamarack/Big Easy on 2020-02-09 (`activenorcal.com/some-tahoe-ski-resorts-closing-for-the-day-amidst-winds-up-to-100-mph/`, fetched 200); Dec 2022 Nevada-side power loss and 10 in rime (`sfstandard.com/2023/01/09/why-have-so-many-ski-lifts-been-closed-lately/`, fetched 200).
- Opening 2026-11-20 (SnowBrains).
- Omitted: report, webcams, links.cams (same reasons as Northstar).

### kirkwood
- Stats: `https://news.vailresorts.com/Kirkwood-Mountain-Resort-2024-25-Winter-Tip-Sheet` (200): base 7,800, summit 9,805 (not 9,800), vertical 2,005, 354 in, 2,300 ac, 20/38/30/12 terrain split.
- NWS office is **STO**, not REV.
- Snowpack 1067:CA:SNTL Carson Pass, 8,360 ft, 5.5 km, last 2026-10-22. Avalanche SAC 2458 (inside).
- Roads: SR-88 (District 10). No road cam. Opening 2026-12-04 (SnowBrains).
- Omitted: report (Vail), roadCams (none on D10 near Kirkwood), webcams/links.cams (unverifiable).

### sugarbowl
- Stats: `https://www.sugarbowl.com/stats` (200): 6,883 ft base, 8,383 ft peaks, 1,500 ft vertical, "500" Average Annual Snowfall", 1,650 ac, 12 lifts.
- NWS **STO**. Snowpack 428:CA:SNTL CSS Lab, 6,890 ft, 3.8 km, last 2026-10-22. Avalanche SAC 2458 (inside).
- Roads: I-80 both segments. Cams: I-80 Donner Summit, Castle Peak.
- Opening 2026-11-27: `http://www.sugarbowl.com/home` ("Friday, November 27, 2026 (conditions permitting)"; target, not firm).
- Omitted: report (not MtnPowder), links.cams (the village JPG `sugar3.sugarbowl.com/graphics/webcams/village/image261023_132155_27.jpg` has a timestamp in its name, so it isn't a stable URL).

### sierraattahoe
- Stats: `https://sierraattahoe.com/maps-and-stats/` (200): 6,640 / 8,852, vertical 2,212, 2,000 ac, 50 trails, 14 lifts.
- NWS **STO**. Snowpack 463:CA:SNTL Echo Peak, 7,650 ft, 5.5 km, last 2026-10-22. Avalanche SAC 2458 (inside).
- Roads: US-50. Road cams: Echo Summit, Meyers. Resort cam: Summit Cam `https://img.hdrelay.com/frames/f5145304-44dc-475f-a654-8a7bacee1e81/sugar/last.jpg` (200 image/jpeg, listed as "Summit Cam" on sierraattahoe.com/live-cams/; the "sugar" in the path is the vendor's name, not Sugar Bowl).
- Omitted: report (feed 215 has no SnowReport; page uses OpenSnow), openingDate (no resort-announced date found; OnTheSnow projects Dec 26, which is not an announcement).

### homewood
- Stats: `https://skihomewood.com/trailmap/` (200): 6,230 / 7,880, 1,650 ft, 1,260 ac, 7 lifts, 66 runs; Ellis Peak wind shelter quote; snowcat terrain 750+ ac to 8,740 ft.
- NWS REV. Snowpack 848:CA:SNTL Ward Creek #3, 6,750 ft, 7.6 km, last 2026-10-22. Avalanche SAC 2458 (inside).
- Roads: I-80 Colfax→Truckee, SR-89 Truckee→Tahoe City, SR-89 West Shore. Cams: Hwy 89 at Hwy 28, Granlibakken.
- Omitted: report, links.cams (webcams page has no still-image URL in its HTML), openingDate (none announced; OnTheSnow's Dec 26 is a projection).

### mtrose
- Stats: `https://skirose.com/mountain-information/` (200): base 8,260, summit 9,700, vertical 1,800, 1,200+ ac, 350 in. Snowmaking and aspect from `https://skirose.com/snow-report/`.
- NWS REV. Snowpack 652:NV:SNTL Mt Rose Ski Area, 8,810 ft, 1.4 km, SNWD 3 in on 2026-10-22. Avalanche SAC 2458 (base and summit inside).
- Cams (200 image/jpeg, from skirose.com/the-mountain-web-cams/): `player.brownrice.com/snapshot/mtrosecam` (Main Lodge), `mtrosesummit` (Summit Panoramic 9700'), `mtroseslidebowl` (Mid-Mountain Slide Bowl). `mtrose1` and `mtrosewcl` also load but are not included.
- No `roads` (NV-431); `links.roads` = nvroads.com.
- Opening 2026-11-20 from ABC7 `https://abc7news.com/post/list-tahoe-ski-resorts-2026-27-opening-dates/19704870/`. **Secondary source**: skirose.com doesn't state a date.
- Omitted: report (not MtnPowder), roadCams (Nevada).

### diamondpeak
- Stats: `https://www.diamondpeak.com/about/` (200): 6,700-8,540 ft, vertical 1,840, 655 ac, snowmaking 75%.
- NWS REV. Snowpack 615:NV:SNTL Marlette Lake, 7,860 ft, 10.2 km (nearer Little Valley, 1242:NV:SNTL, is 6,500 ft, below mid-mountain), last 2026-10-22. Avalanche SAC 2458 (inside).
- Cams (200 image/jpeg, from diamondpeak.com/the-mountain/web-cams/): hdrelay frames for Base Area, Snowflake Lodge mid-mountain, Summit. `links.roads` = nvroads.com.
- Omitted: openingDate (page says "2026-27 Opening Day = TBD", `https://www.diamondpeak.com/event/projected-opening-day/`), report, roads.

### boreal
- Stats: **Wikipedia only** (`https://en.wikipedia.org/wiki/Boreal_Mountain_Resort`: 7,200 / 7,700, 500 ft, 380 ac). rideboreal.com has no stats page I could find (the /explore pages I tried return 404), so baseFt/summitFt are less certain than the others.
- NWS **STO**. Snowpack 428:CA:SNTL CSS Lab, 6,890 ft, 2.0 km. Avalanche SAC 2458 (inside).
- Roads: I-80 both segments. Cams: I-80 Donner Summit, Soda Springs EB.
- Opening 2026-11-27 from ABC7 (secondary source, same as Mt. Rose).
- Omitted: report, links.cams (the only still on rideboreal.com's "Boreal Mountain Cam" page is a "Woodward Tahoe Cam" snapshot, which isn't a mountain cam).

## Left out, summary

- `report`: all nine. Vail trio is not on MtnPowder; Sierra's feed 215 has no snow report; the rest have no MtnPowder reference.
- `roads`: Mt. Rose and Diamond Peak by rule (Nevada access).
- `expert`, `defaultFavorite`: per brief.
# Central Sierra / Eastern Sierra research (june, bearvalley, dodgeridge, chinapeak)

All checks run 2026-10-23. NWS calls used `-A "powder-research (<contact email>)"`. Validation: `parseConfig` printed `valid`.

Notes on method: lat/lon and summit points come from OpenStreetMap lift geometry (Overpass `aerialway` ways) with elevations from Open-Meteo's elevation API (`api.open-meteo.com/v1/elevation`); base = bottom of the main lodge lift, summit = top of the highest lift. China Peak's base point is from Nominatim (37.2355859,-119.1557). Elevations in the JSON (baseFt/summitFt) come from the resort pages cited below, not the DEM.

## June Mountain (june)

- **Stats**: https://www.junemountain.com/mountain-information/trail-map -> 200. "Elevation (Base): 7,545 ft", "Elevation (Summit): 10,090 ft", Skiable 1,500 ac, Vertical 2,590 ft, Advanced 45 / Intermediate 40 / Beginner 15, Avg snowfall 250 in, season Dec-Apr, 6 lifts (2 quads, 4 doubles, 1 carpet).
- **Points**: J1 bottom 37.76792,-119.08976 (DEM 7,562 ft); J7 top 37.74029,-119.07307 (DEM 10,062 ft). Lat/lon rounded to 37.7679,-119.0898 and 37.7403,-119.0731.
- **NWS**: https://api.weather.gov/points/37.7679,-119.0898 -> cwa REV, radarStation KHNX. AFD https://api.weather.gov/products/types/AFD/locations/REV, latest 2026-10-23T09:40Z; text mentions "Mineral-Mono counties", "eastern Sierra". `area`/`ignore` follow the mammoth entry.
- **Snowpack (cdec DPO, Devils Postpile, 7,569 ft)**: https://cdec.water.ca.gov/dynamicapp/req/JSONDataServlet?Stations=DPO&SensorNums=18,3,4&dur_code=H&Start=2026-10-15&End=2026-10-24 -> 217 rows; sensor 18 last valid 2026-10-23 11:00 = 0 in, sensor 4 = 42 F; sensor 3 (SWE) is all -9999, which the pipeline treats as missing. 15 km from the base, about 1,200 ft below mid-mountain (~8,800 ft). Station list: https://cdec.water.ca.gov/dynamicapp/staSearch (sensor 18, lat/lon columns). Rejected: JMS (June Mountain Summit, 3 km), GML, GEM, MN1-3, MMT, MAM, TGP, ERY return no sensor 18 data at all; AGP and MHP (Mammoth Pass) return only -9999 or -212 in depth. TES (Tioga Pass Entry, 9,945 ft, 22 km) is a valid fallback (depth 0 at 2026-10-23 11:00). Nearest SNOTEL (Virginia Lakes Ridge 846:CA:SNTL) is 36 km away, over the 30 km limit.
- **Avalanche**: https://api.avalanche.org/v2/public/avalanche-center/ESAC -> 200, zone 128 "Eastside Region". Map layer https://api.avalanche.org/v2/public/products/map-layer: point-in-polygon puts June base and summit inside zone 128. https://api.avalanche.org/v2/public/product?type=forecast&center_id=ESAC&zone_id=128 -> returns a product (published 2026-10-23T16:01Z, summary). Same center and zone as mammoth.
- **Report**: https://www.mtnpowder.com/feed?resortId=59 -> `"Name":"June Mountain"`, OperatingStatus Closed, SnowReport LastUpdate 2026-10-23. The resort's page https://www.junemountain.com/mountain-information/mountain-report loads `//v4.mtnfeed.com/static/js/main.js`, whose code builds `https://mtnpowder.com/feed/v3.json?bearer_token=...` (the page itself uses a token; the no-key `feed?resortId=59` returns the same resort). It also links https://www.mtnpowder.com/?resort=June-Mountain. Only `BaseArea` is populated (Name "The Chalet"); `MidMountainArea` and `SummitArea` have Name "--", so `stations` is `["BaseArea"]`. Feed ids found by scanning resortId 1-130 (59 = June Mountain, 60 = Mammoth). Re-check station keys once the season starts, since the feed may add mid/summit stations.
- **Opening date**: 2026-12-19. Feed text: "Opening day is scheduled for Dec 19, 2026"; https://www.junemountain.com/things-to-do/opening-day -> 200, "December 19, 2026".
- **Roads**: https://cwwp2.dot.ca.gov/data/d9/cc/ccStatusD09.json -> 200. Stations in my bboxes: US-395 Inyokern-Bishop 21 (copied from mammoth), Bishop-Mammoth 12 (copied), new US-395 Mammoth-June Lake Jct 10 (37.645-37.90 N), SR-158 June Lake Loop 8 (incl. "June Mtn. Ski Area" 37.7704,-119.0899, "South Jct. 395", and two winter-closure-gate stations). https://roads.dot.ca.gov/roadscell.php?roadnumber=395,158 -> 200 with `<h3>` "SR 158" and "US 395" (text headings "SR 158", "US 395").
- **Road cams**: https://cwwp2.dot.ca.gov/data/d9/cctv/cctvStatusD09.json lists US-395 Crestview (37.75146,-118.98329) and US-395 Obsidian Dome (37.77493,-119.01401). Both JPGs returned 200 image/jpeg (7,641 and 18,225 bytes; the D9 image server was slow, one retry needed). No SR-158 cam exists in the feed.
- **Links**: website https://www.junemountain.com/ -> 200; webcams https://www.junemountain.com/mountain-information/live-cams -> 200; report page -> 200; radar https://radar.weather.gov/station/KHNX/standard -> 200. `cams: []`: the page embeds third-party iframes (e.g. "The Chalet webcam", "Chair J3 webcam"), no direct JPG. A guessed `media.mammothresorts.com/mmsa/june/...` URL returned 403.
- **Notes sources**: trail-map page (stats), https://bestsnow.net/calnet.htm (June Mtn: avg 275 in at 8,700 ft; exposure N 65 / E 5 / W 30 / S 0 %; "Well protected. Go here instead of Mammoth during storms."; Mammoth 356 in), https://en.wikipedia.org/wiki/June_Mountain_ski_area (tree-covered terrain), opening-day page, road-conditions page (US 395 and SR 158), ccStatusD09.json (closure gate stations).

## Bear Valley (bearvalley)

- **Stats**: the resort's own Wix pages (trail-map, conditions-updates, back, general-9) do not state elevations. Used https://www.indyskipass.com/our-resorts/bear-valley-mountain-resort -> "Vertical: 1900ft Summit: 8500ft Base: 6600ft", matched by https://en.wikipedia.org/wiki/Bear_Valley_Mountain_Resort (8,500 / 6,600 / 1,680 acres) and bestsnow.net (6,600-8,495). Not the resort's own stats page, so this is a weaker citation than the other three.
- **Points**: base hub 38.4925,-120.0450 (Mokelumne Express / Koala / Cub bottoms; wiki 38.492,-120.044); summit = Mokelumne Express top 38.48674,-120.05264 (DEM 8,448 ft), rounded 38.4867,-120.0526. The DEM shows ~7,750 ft at the lodge hub; the official 6,600 ft base is the Grizzly lift bottom (38.50038,-120.05166, DEM 6,587 ft), which is a different spot.
- **NWS**: https://api.weather.gov/points/38.4925,-120.0450 -> cwa STO, radarStation KDAX. AFD latest 2026-10-23T18:51Z. Wording used: "Sierra", "western slopes of the Sierra". Other-region phrases in the AFD: "Shasta County mountains", "Coastal Range", "southern Cascades", "Delta", "Sacramento Valley", "northern San Joaquin Valley".
- **Snowpack (cdec BLD, Bloods Creek, 7,200 ft)**: same URL pattern as above with Stations=BLD -> 217 rows; sensor 18 last valid 2026-10-23 11:00 = 0 in; sensor 3 = 0.72 in; sensor 4 = 46 F. 4.4 km from the base, ~400 ft below mid-mountain (~7,600 ft). Rejected: ALI (Lake Alpine, 3 km), WHE, UMT, SHW, GNM return no sensor 18 data. SNOTEL Blue Lakes (356:CA:SNTL) is 17 km away but +460 ft; not checked live because the CDEC station is closer and already works. (The AWDB `/stations` endpoint returned only 36 CA SNTL sites, so I did not rely on it for ranking.)
- **Avalanche (SAC zone 2458, edge case)**: https://api.avalanche.org/v2/public/avalanche-center/SAC -> zone 2458 "Central Sierra Nevada". Map-layer polygon contains both the base (38.4925,-120.045) and the summit (38.4867,-120.0526); the polygon's southern edge is 38.4586 N, so the base is about 3.8 km inside it, at the southern fringe. https://api.avalanche.org/v2/public/product?type=forecast&center_id=SAC&zone_id=2458 -> returns a product (published 2026-10-20, "Daily avalanche forecasts ... begin Dec 1 or earlier"). It is the same zone as palisades and alpine, whose forecasters are Tahoe-focused, so treat it as covering the resort by polygon only. Remove it if you want a stricter rule.
- **Report**: not on MtnPowder. resortId 1-130 scan had no match (nearest names are Alterra/Powdr resorts); the resort site's conditions page loads an OpenSnow weather icon only. Left out.
- **Opening date**: none announced. bearvalley.com posts only cover 2025-26; the only 2026-27 date found is OnTheSnow's projection (Nov 27), which does not count. Left out.
- **Roads**: https://cwwp2.dot.ca.gov/data/d10/cc/ccStatusD10.json -> 200. Stations in bboxes: SR-4 Angels Camp-Arnold 15, SR-4 Arnold-Bear Valley 12 (incl. "BEAR VALLEY" 38.4605,-120.0448 at 7,116 ft, "MOUNT REBA ROAD"), SR-207 2 ("JCT HWY 4" and "MT. REBA SUMMIT"). https://roads.dot.ca.gov/roadscell.php?roadnumber=4,207 -> 200 with headings "SR 4" and "SR 207".
- **Road cams**: none. https://cwwp2.dot.ca.gov/data/d10/cctv/cctvStatusD10.json has SR-4 cams only in Stockton. Left out.
- **Links**: https://www.bearvalley.com/ , /webcam , /conditions-updates all 200; radar KDAX 200. `cams: []`: webcam page has no direct JPGs.
- **Notes sources**: Indy Pass and Wikipedia (stats, 100 acres of snowmaking), bestsnow.net/calnet.htm (352 in at 7,750 ft; exposure N 55 / E 20 / W 23 / S 2 %; steepest runs low; no road connection to Tahoe), https://www.bearvalley.com/post/5am-snow-update-22-counting-overnight (Feb 17, year not shown: 22 in overnight; "Cub, Mokelumne Express, & Polar Express will be the only lifts spinning"), Caltrans D10 feed.

## Dodge Ridge (dodgeridge)

- **Stats**: https://dodgeridge.com/webcams/ -> 200: "Summit 8,200 ft, Mid-Mountain 7,000 ft, Base Area 6,600 ft". Vertical 1,600 ft and 862 acres from https://en.wikipedia.org/wiki/Dodge_Ridge_Ski_Area (not an official stat). Official site publishes no snowfall average, so none is claimed.
- **Points**: Motherlode bottom 38.18921,-119.95622 (DEM 6,578 ft) -> 38.1892,-119.9562; T-Bar 643 top 38.19287,-119.92021 (DEM 8,146 ft) -> 38.1929,-119.9202.
- **NWS**: https://api.weather.gov/points/38.1892,-119.9562 -> cwa STO, radarStation KDAX. Same AFD and phrases as Bear Valley.
- **Snowpack (cdec GNL, Gianelli Meadow, 8,400 ft)**: Stations=GNL -> sensor 18 last valid 2026-10-23 10:00 = 2 in; sensor 3 = -0.24; sensor 4 = 37 F. 4.6 km from the base; mid-mountain 7,000-7,400 ft, so +1,000-1,400 ft. Rejected: DDR (Dodge Ridge, 8,150 ft, 1.3 km), KRC, BEM, HRG, SAS, SA2, EGM, SPF, HCL, UKR, KIB return no sensor 18 data in CDEC. REL (Lower Relief Valley, 8,100 ft, 17 km) is a working alternate (2 in). Nearest SNOTEL (Leavitt Lake 574, Sonora Pass 771) are 30-33 km and +1,400-2,200 ft; not used.
- **Avalanche**: none. Map-layer polygons: no center zone contains Dodge Ridge (SAC's southern edge is 38.4586 N). Left out.
- **Report**: not on MtnPowder (resortId 1-130 scan, no match). https://dodgeridge.com/snow-report/ -> 200 but pulls from `api.opensnow.com` (OpenSnow), which the brief rules out. Left out.
- **Opening date**: none announced; only OnTheSnow's projection (Dec 26). Left out.
- **Roads**: Stations: SR-108 Sonora-Long Barn 15, Long Barn-Pinecrest 11 (incl. Pinecrest 38.1876,-120.0082 at 5,633 ft, Strawberry, Snow Park). https://roads.dot.ca.gov/roadscell.php?roadnumber=108 -> 200, heading "SR 108".
- **Road cams**: left out. Only SR-108 cam in D10 is "179 - EB 108 W/O Soulsbyville Rd" at 2,926 ft (image 200 image/jpeg), too low and far from the resort; no mountain cams on SR-108.
- **Links**: https://dodgeridge.com/ , /webcams/ , /snow-report/ all 200; radar KDAX 200. `cams: []`: webcams are camstreamer.com embeds, not JPGs.
- **Notes sources**: webcams page, Wikipedia (limited snowmaking since 2021/22, season, SR-108/Sonora), FirstTracks forum post https://www.firsttracksonline.com/boards/threads/dodge-ridge-ca-3-11-2011.9545/post-60135 (north-facing runs, rare wind holds; the weakest source in the file, a single 2011 user post), Caltrans D10 feed. Consider dropping that note if you want only first-party facts.

## China Peak (chinapeak)

- **Stats**: https://www.skichinapeak.com/the-mountain -> 200: "1,679 feet of vertical with a base elevation of 7,030 with a peak of just over 8,700 feet", six chairlifts (two quads, four triples), three carpets, "one of the largest snowmaking systems in the state". summitFt 8709 = 7,030 + 1,679 (matches Wikipedia 8,709). Domain is skichinapeak.com; www.chinapeak.com did not load (curl 000).
- **Points**: Nominatim 37.2355859,-119.1557; Chair 6 bottom 37.23533,-119.15735 (DEM 7,027 ft) -> base 37.2352,-119.1549; Chair 5 (Peak) top 37.21913,-119.15561 (DEM 8,576 ft) -> summit 37.2191,-119.1556. The true peak (~8,709 ft) is above the top lift.
- **NWS**: https://api.weather.gov/points/37.2352,-119.1549 -> cwa HNX, radarStation KHNX. AFD latest 2026-10-23T16:52Z; wording: "Sierra Nevada", "Valley", "Desert", "Kern County mountains". `ignore` includes "Valley", which will drop any HNX sentence that mentions the Valley (most of the AFD).
- **Snowpack (cdec HNT, Huntington Lake (USBR), 7,000 ft)**: Stations=HNT -> sensor 18 last valid 2026-10-23 10:00 = 1 in; sensor 3 = 0.21; sensor 4 = 39 F. 5.7 km away, ~900 ft below mid-mountain (~7,900 ft). Rejected: HTT, NLL, BDF, TMK, CYT return no sensor 18 data. Nearest SNOTEL (Virginia Lakes Ridge) is 94 km away.
- **Avalanche**: none; no center polygon covers it. Left out.
- **Report**: not on MtnPowder (resortId 1-130 scan, no match; no mtnpowder/mtnfeed strings on skichinapeak.com/the-mountain or /conditions). Left out.
- **Opening date**: none announced. Resort's stated goal is Thanksgiving weekend (abc30, 2019 and 2025). Left out.
- **Roads**: https://cwwp2.dot.ca.gov/data/d6/cc/ccStatusD06.json -> 200. Stations: SR-168 Prather-Shaver Lake 13, Shaver Lake-Huntington Lake 5 (incl. "19.7 MI E/O SHAVER LAKE" 37.2351,-119.1594 and "21.4 MI E/O SHAVER LAKE" in Lakeshore). https://roads.dot.ca.gov/roadscell.php?roadnumber=168 -> 200, heading "SR 168".
- **Road cams**: left out. D6 SR-168 cams are only in Fresno/Clovis plus Prather roundabout (500 ft; image 200 image/jpeg), none above Prather.
- **Links**: https://www.skichinapeak.com/ , /webcam/ , /conditions all 200; radar KHNX 200. `cams: []`: webcams are ipcamlive.com player embeds, not JPGs. `/snow-report` returns 500, so the report link is /conditions.
- **Notes sources**: the-mountain page, Wikipedia (40% snowmaking coverage), abc30 2019-11-26 (more than a million sq ft in under 40 hours; open in days instead of weeks; Thanksgiving-weekend goal), abc30 2025-11-29 (opened Friday with limited terrain, marginal temps, light natural snow, weekends through end of December), Caltrans D6 feed. Average snowfall is not stated because no first-party or measured figure was found (Wikipedia lists 300 in).

## Other flags

- `links.report` is not in the zod schema (`links` strips unknown keys), same as the brief's field list; it validates but is dropped at parse time.
- The shared tools directory `/private/tmp/.../scratchpad/tools/` was also written to by another process during this run (afd.py was replaced); my helper scripts are grepx.py, ov.py, grid.py, near.py, cdec.py, cdecq.py, cc.py, cctv.py, pip.py, pip2.py, segcount.py there. Nothing in the repo was modified.
# SoCal resorts: evidence (checked 2026-10-23)

Validation: `parseConfig` printed `valid` for socal.json (5 entries). `git status --short` in the repo was empty.

Note: `links.report` is in the entries as the brief asks, but pipeline/config.ts has no `report` key under `links`; zod strips it silently. The `local.sources`, `notes` etc. are all schema fields.

## Shared checks

- NWS /points (User-Agent sent):
  - https://api.weather.gov/points/34.2275,-116.8605 -> cwa SGX, grid SGX/78,78, radar KSOX
  - /points/34.2355,-116.8895 (Snow Summit) -> SGX 77,79, KSOX
  - /points/34.2253,-117.0398 (Snow Valley) -> SGX 72,79, KSOX
  - /points/34.3747,-117.6932 (Mountain High) -> **LOX** 177,56, KSOX
  - /points/34.26,-117.63 (Mt Baldy base) -> SGX 51,84, KSOX. Note that the Mt Baldy Village point (34.2362,-117.6597) returns LOX, but the lifts are in an SGX cell.
- AFD vocabulary:
  - https://api.weather.gov/products/types/AFD/locations/SGX, latest product KSGX 2026-10-23T18:16Z. It says "mountains of southwestern San Bernardino, Riverside, and San Diego Counties" and "San Bernardino County mountains". `area` for SGX resorts uses those words. The ignore list is the existing bigbear one.
  - .../locations/LOX, latest product KLOX 2026-10-23T17:12Z. It says "San Gabriels", "LA Mountains", "interior Ventura", "western Santa Barbara County", "Central Coast", "Santa Susana", "San Fernando and San Gabriel Valleys". Mountain High's `area` and `ignore` come from those.
- Avalanche: https://api.avalanche.org/v2/public/products/map-layer -> 200, 84 zone features. None has a vertex inside 33.5-35.0N, 118.5-116.0W. Avalanche omitted for all five.
- SNOTEL: AWDB stations?stationTriplets=*:CA:SNTL&activeOnly=true -> 200, 36 active CA stations. The southernmost is at 38.07N. No SoCal SNOTEL exists.
- Elevation/coordinates: base and summit points were chosen with Open-Meteo's elevation API (90 m DEM) as the closest match to official stats. All of these are DEM-approximated, not surveyed:
  - Snow Summit base (34.2355,-116.8895) reads 6,991 ft against an official 7,000 ft; the summit point (34.22,-116.89) reads 8,114 ft against 8,200 ft.
  - Snow Valley base (34.2253,-117.0398) reads 6,768 ft against 6,800 ft; the summit point (34.243,-117.044) reads 7,802 ft against 7,841 ft.
  - Mountain High base (34.3747,-117.6932, Wikipedia coordinates) reads 7,024 ft, which matches the West base, but baseFt is the East base (6,600 ft). The summit point (34.355,-117.68) reads 8,143 ft against 8,200 ft.
  - Mt Baldy base (34.26,-117.63) reads 6,522 ft against 6,500 ft; the summit point (34.282,-117.62) reads 8,576 ft against 8,600 ft.
  - Bear Mountain coordinates are unchanged from the existing entry (base reads 7,116 ft vs 7,140; summit 8,596 vs 8,805).
- Caltrans D8 chain controls: https://cwwp2.dot.ca.gov/data/d8/cc/ccStatusD08.json -> 200, 79 stations, all R-0. The roads.dot.ca.gov text page was checked for each route (`roadscell.php?roadnumber=` 2, 18, 38, 138, 330 -> 200, headings "SR 2", "SR 18", "SR 38", "SR 138", "SR 330").

## bigbear (Bear Mountain)

- report: https://www.mtnpowder.com/feed?resortId=57 -> 200, Name "Bear Mountain", OperatingStatus Closed, LastUpdate 2026-10-23. Keys BaseArea, MidMountainArea (value "--"), SummitArea exist, as in the existing entry. TotalLifts 7, TotalTrails 26. extraResortIds removed.
- Stats: https://www.bigbearmountainresort.com/webcams/bear-mountain says Base cam 7,140 ft, Peak cam 8,805 ft. Same as the existing entry.
- snowpack: ACIS POST StnData sid US1CASR0098 (2026-09-20 to 2026-10-23) -> "BIG BEAR CITY 0.4 W", rows through 2026-10-23 (snow 0.0 on 10-19..21, pcpn 0.11 on 10-23; snwd "M" because there is no snow). Elevation 6,777 ft from StnMeta. Kept from the existing entry.
- roads: the three existing segments are kept. Stations inside the bboxes:
  - SR-330 has four (Lower/Middle/Upper Passing Lane, Running Springs).
  - SR-18 has about ten (Running Springs through Summit Blvd).
  - SR-38 has about thirteen (Mill Creek to Navajo St).
- roadCams: none. In cctvStatusD08.json, the only SR-18 camera is "Lake Gregory" (34.228,-117.252), which is far from the Big Bear drive, and nothing on SR-330 or SR-38.
- links: webcams page https://www.bigbearmountainresort.com/webcams/bear-mountain (200). The cams are Roundshot panoramas and streams, not stills, so `cams` is []. The report link is https://www.bigbearmountainresort.com/mountain-information, the target of the site's "Mountain Report" nav item; the page is client-rendered, so I could not see the feed call in its HTML.
- notes: notes 1 and 2 are new, from our-mountains, webcams/bear-mountain and the historical-snowfall table. The 110-inch average is my arithmetic over the 2003-04 to 2025-26 SS/BM column (sum 2,563 / 23 seasons); the min 30 is 2013-14 and the max 243 is 2022-23. This replaces the old "about 100, 39-243" wording. Note 3 is verified against https://www.bigbearmountainresort.com/blog/snowmaking: low-20s overnight temps, low humidity, light wind, start early to mid November, 48-72 hours, Santa Ana winds, Bear Mountain ~62 fan guns. **Notes 4 and 5 (warm/cold storms; openings Nov 12-Dec 8) are carried over from the existing entry with its NWS PDF sources and were not re-verified this session.**
- openingDate: omitted. No 2026-27 date on the BBMR pages I read.

## snowsummit

- report: https://www.mtnpowder.com/feed?resortId=58 -> 200, Name "Snow Summit", Closed, 11 lifts, 31 trails. Same station keys as Bear.
- Stats: https://www.bigbearmountainresort.com/our-mountains says Snow Summit base 7,000 ft, peak 8,200 ft, 1,200 ft vertical.
- snowpack, roads, radar: reused from bigbear (US1CASR0098 returned data as above; the road segments are the same).
- links: webcams https://www.bigbearmountainresort.com/webcams/snow-summit -> 200. cams [].
- notes: elevation comparisons are from our-mountains; the season totals come from the historical-snowfall table (SS column: 2025-26 51, 2024-25 79, 2023-24 175, 2022-23 243); ~90 fan guns are from the snowmaking FAQ. The storm note is carried over from the existing entry.
- openingDate: omitted, none announced.

## snowvalley

- Snow Valley is now part of Big Bear Mountain Resort (https://www.bigbearmountainresort.com/blog/snow-valley-announcement -> 200, says BBMR took over operations in 2023).
- report: I scanned MtnPowder feed ids 1-259 by name (scan.txt) and found 173 = "Snow Valley" and 174 = "Snow Valley Summer". https://www.mtnpowder.com/feed?resortId=173 -> 200, Name "Snow Valley", Closed, LastUpdate 2026-10-23, 10 lifts, 32 trails, MountainAreas "Snow Valley" and "Night Session". The keys are BaseArea ("Snow Valley"), MidMountainArea ("--") and SummitArea ("Summit"). It lives in the same Alterra feed family as 57 and 58. I could not see the resort page calling the feed (client-rendered), so the match rests on the feed name only.
- Stats: our-mountains gives base 6,800 ft, peak 7,841 ft, 1,041 ft vertical.
- snowpack: US1CASR0098 at 6,777 ft, about 17 km east of the Snow Valley base, mid-mountain about 500 ft higher. It is within the 30 km / 2,000 ft rule.
- roads: SR-330 and SR-18 only (SR-38 is the east-side Big Bear approach). CC stations "Snow Valley thru to Big Bear Dam" (34.2254,-117.0337) and "Green Valley Road thru to Snow Valley" are inside the SR-18 bbox.
- links: webcams https://www.bigbearmountainresort.com/webcams/snow-valley -> 200 (Roundshot panorama, so `cams` is []).
- notes: elevations from our-mountains. Snow Valley vs Summit/Bear season totals come from the historical-snowfall table (SV 54/87/201/277 vs SS/BM 51/79/175/243). 87 fan guns and "fan guns only" are from the snowmaking FAQ. The storm note is carried over.
- openingDate: omitted, none announced. The third-party OnTheSnow "Dec 4" projection is not an announcement.

## mountainhigh

- Site: mountainhigh.com is a parked domain (redirect to /lander). The real site is https://www.mthigh.com/ (200, redirects to /site).
- Stats: https://www.mthigh.com/site/trails-and-conditions/other/mountain-stats.html. East peak 8,200 ft, East base 6,600 ft, West peak 8,000 ft, West base 7,000 ft, 12 lifts, 270 skiable acres, average 117 in (23-year), snowmaking 80%, early Nov to late Apr. baseFt 6,600 and summitFt 8,200 are the overall low and high.
- report: omitted. The resort runs its own conditions page (https://www.mthigh.com/site/trails-and-conditions/conditions/snow-and-weather-report, 200, last update May 21, 2026), and a scan of MtnPowder ids 1-259 found no Mountain High feed.
- snowpack: omitted. ACIS station search around Wrightwood (bbox -117.85,34.15,-116.7,34.45) found WRIGHTWOOD 1.1 W (US1CASR0101) and WRIGHTWOOD 1.2 WNW (US1CASR0003) with daily data that ends in 2025 and 2013 respectively, and the StnData check for US1CASR0101 returned all "M" through 2026-10-23. There is no SoCal SNOTEL, and I found no CDEC depth sensor.
- roads: https://cwwp2.dot.ca.gov/data/d8/cc/ccStatusD08.json. SR-2 stations "LA/SBD Co Line thru to Jct SR 138" (34.3661,-117.6525) and "5 miles West of Big Pines thru to LA/SBD Co" (34.3735,-117.7515) are inside the SR-2 bbox. SR-138 stations "2.3 Miles East of Jct SR 2 thru to Jct SR..." (34.3703,-117.5437) and "LA/SBD Co Line thru to 2.3 Miles East of Jct" (34.4519,-117.6601) are inside the SR-138 bbox. roadscell for 2 and 138 returns text for both. The SR-2 text currently reports a closure west of Big Pines in Los Angeles Co. (Islip Saddle side), which is why textMatch includes Islip Saddle.
- roadCams: https://cwwp2.dot.ca.gov/data/d8/cctv/cctvStatusD08.json lists SR-2 (379) Wrightwood Fire Station -> .../sr2379wrightwoodfirestation.jpg returned 200 image/jpeg 61,723 bytes; SR-138 (384) 0.15 mi East of SR-2 -> .../sr138384015mileseastofsr2.jpg returned 200 image/jpeg 16,459 bytes (the first request timed out once, the retry succeeded).
- cams: https://www.mthigh.com/site/mountain/mountain-info/livecams/{westbasecam,playgroundcam,chisolmcam,borderlinecam} each returned 200 image/jpeg, 700x394 JPEG, Last-Modified 2026-10-23 19:19Z (57-130 KB). The page also embeds camstreamer streams, which were not used.
- notes: all from the mthigh.com pages named in sources. The 2025-26 season-total note uses the May 21, 2026 report values (49 in base, 61 in top). The December 2025 closure rests on the CBS headline "reopens for skiing after damaging December storms"; I did not read the article body, so the note does not give dates.
- openingDate: omitted. A web search found no 2026-27 announcement (2025-26 opened Nov 22-24).

## mtbaldy

- Sites: https://mtbaldyskilifts.com/ (200) and https://www.mtbaldyresort.com/ (200). Stats on mtbaldyskilifts.com: 6,500 ft base, 8,600 ft summit, 2,100 ft vertical, four double chairs.
- report: omitted. The resort has its own mountain report page (https://www.mtbaldyresort.com/mountain-report, 200) and no MtnPowder feed (the id scan found none).
- snowpack: omitted. ACIS shows only old Baldy stations (MOUNT BALDY NOTCH ended 1971, MOUNT BALDY FC 85 G ended 1976). The nearest active CoCoRaHS station in the box is CRESTLINE 1.4 ESE at 4,577 ft, which is far too low.
- roads: omitted. Mt Baldy Rd is a county road. The D7 and D8 chain-control feeds have no Mt Baldy Rd or San Antonio Canyon station.
- roadCams: none. cwwp2 D7 and D8 camera feeds have nothing near Mt Baldy Road.
- cams: https://mtbaldyresort.com/web-cam (200) is a set of YouTube embeds (youtube-nocookie.com), not stills, so `cams` is [].
- notes: all from the mtbaldyskilifts.com home page and the mtbaldyresort.com ski-and-ride page, which says "Chains may be required on Mt Baldy Road" and that West Side "needs a big storm to open".
- openingDate: omitted. A web search found no 2026-27 announcement; OnTheSnow's Nov 27 date is a projection.

## Left out, summary

| Resort | Left out | Reason |
|---|---|---|
| all | avalanche | No avalanche.org zone covers SoCal |
| mountainhigh | report | Not on MtnPowder (id scan 1-259) |
| mountainhigh | snowpack | Wrightwood CoCoRaHS stations are dormant and there is no SNOTEL |
| mountainhigh | openingDate | None announced |
| mtbaldy | report | Not on MtnPowder |
| mtbaldy | snowpack | No active station nearby |
| mtbaldy | roads, roadCams | County road, not in the Caltrans chain-control or camera feeds |
| mtbaldy | cams | Webcams are YouTube streams |
| bear/summit/valley | cams | Roundshot panoramas only |
| bear/summit/valley | roadCams | No Caltrans camera on the drive |
| all except none | openingDate | No resort-announced 2026-27 dates found |
