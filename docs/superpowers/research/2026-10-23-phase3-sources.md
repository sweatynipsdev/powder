# Phase 3 sources: Utah, Colorado, Pacific NW and Whistler (2026-10-23)

Three research agents checked the source landscape live with `curl`, before the resort list was final: state road feeds, Whistler's Canadian sources, and US avalanche, MtnPowder and NWS coverage across a superset of candidate resorts. Their evidence logs follow below, unedited except that contact email addresses were removed (the repo is public). Per-resort config research for the chosen 20 comes later and gets its own file.

## Controller checks

- **WSDOT pass reports** (`data.wsdot.wa.gov/arcgis/rest/services/TravelInformation/TravelInfoMtPassReports/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=false&f=json`): re-fetched with no key, HTTP 200. Fields `PassName, Elevation, Weather, RoadCondition, DisplayDate, TravelDirection1/2, PublicMessage1/2`. Rows include Stevens Pass US 2, Snoqualmie Pass I-90, Chinook Pass SR 410, Cayuse Pass SR 123, Crystal to Greenwater SR 410 and Mt. Baker Hwy SR 542. The service is listed in WSDOT's public GIS services directory with WSDOT's own description and copyright, so it counts as an official public feed (like Caltrans CWWP2), not scraping.
- **CAIC:** a web search found no documented CAIC API. The only developer material is a community client built on the website's undocumented endpoints (github.com/gormaniac/caicpy). Under the no-scraping rule, Colorado gets a link to CAIC, not avalanche data.
- **Open-Meteo pricing** (open-meteo.com/en/pricing): the free tier allows 600/min, 5,000/hour, 10,000/day and 300,000/month, for non-commercial use. Paid plans need Professional or higher for the ensemble API, so the free daily limit is the ceiling that sizes Phase 3.

## Decisions taken from this evidence (Mikey, 2026-10-23)

- **Scope:** "Core 20". Utah: Alta, Snowbird, Brighton, Solitude, Park City, Deer Valley. Colorado: Vail, Breckenridge, Keystone, Arapahoe Basin, Copper, Winter Park, Steamboat, Snowmass. Pacific NW: Crystal, Stevens Pass, Mt. Baker, Mt. Bachelor, Mt. Hood Meadows. British Columbia: Whistler.
- **Roads:** "I'm ok if we don't have road data for all of the resorts". WSDOT is built because it needs no key; Utah, Colorado, Oregon and BC get 511 links. No sign-up keys.

---


## Phase 3 road-condition sources: UDOT, CDOT, WSDOT, ODOT (evidence log)

Probed 2026-10-23 with `User-Agent: powder-snow/0.1 (personal forecast app)`. No accounts created, no keys requested.
"Unverified" means I could not confirm it from an official page or live call.
Caveat on season: it is late October, so winter-only feeds (WSDOT pass reports) show "No restrictions" / "reports ended". Restriction vocabularies could not be observed live.

---------------------------------------------------------------------------------------------------

### Washington (WSDOT) — the only state with a keyless official feed that carries pass conditions

#### 1. Official developer API (keyed)
- Docs: https://wsdot.wa.gov/traffic/api/ (Traveler Information API; WSDL, REST JSON/XML, RSS and KML for Mountain Pass Conditions, Highway Alerts, Highway Cameras, and more).
- Key: "Access Code", passed as `?AccessCode=`. Page says: "To use WSDL services you must be assigned an Access Code" — you type an email address on that page and the code is emailed. Email is "used only to notify you of changes to our services". No approval wait described; no ToS click-through described on the page. Rate limit: not stated. Reuse/attribution terms: not stated on the API page.
- Live: `GET https://wsdot.wa.gov/Traffic/api/MountainPassConditions/MountainPassConditionsREST.svc/GetMountainPassConditionsAsJson` -> HTTP 401 "The supplied access code was missing or invalid."
- Fields (https://wsdot.wa.gov/Traffic/api/Documentation/class_pass_condition.html): MountainPassId, MountainPassName, Latitude, Longitude, DateUpdated, TemperatureInFahrenheit, ElevationInFeet, WeatherCondition, RoadCondition, TravelAdvisoryActive, RestrictionOne / RestrictionTwo (each TravelRestriction = TravelDirection + RestrictionText). 15 passes.

#### 2. Keyless official feeds (verified)
WSDOT's own GIS server, ArcGIS REST, query-only, no token:
- Directory: `https://data.wsdot.wa.gov/arcgis/rest/services?f=json` -> 200 (folders incl. TravelInformation, EOC_TrafficEvents, WorkZone, Maintenance).
- `https://data.wsdot.wa.gov/arcgis/rest/services/TravelInformation?f=json` -> 200; FeatureServer + MapServer for TravelInfoMtPassReports, TravelInfoRoadAlerts, TravelInfoCamerasWeather, TravelInfoTruckRestrictions, TravelInfoBorderCrossingTimes.
- **Mountain Pass Reports**: `https://data.wsdot.wa.gov/arcgis/rest/services/TravelInformation/TravelInfoMtPassReports/FeatureServer/0/query?where=1%3D1&outFields=*&f=json&outSR=4326` -> HTTP 200 application/json, ~9 KB.
  - Service description (WSDOT's words): "A point layer designed to assist in safe travel through Washington's beautiful mountains by providing information such as roadway conditions, weather, temperature, and any restrictions... updated periodically throughout the day." copyrightText "Washington State Department of Transportation". Capabilities: Query. maxRecordCount 2000. Contact in metadata: [contact email removed] / [contact email removed].
  - Fields: OBJECTID (=MountainPassId), PassName, Elevation, ElevationUnit, Weather, RoadCondition, DisplayDate, TravelDirection1, PublicMessage1, TravelDirection2, PublicMessage2. Geometry is a point (outSR=4326 gives lon/lat).
  - Records returned (all 15+): Blewett Pass US 97, Cayuse Pass SR 123, **Chinook Pass SR 410** (5430 ft), Crystal to Greenwater SR 410, **Mt. Baker Hwy SR 542** (4250), North Cascade Hwy SR 20, Manastash Ridge I-82, Satus Pass US 97, Sherman Pass SR 20, **Stevens Pass US 2** (4061), **Snoqualmie Pass I-90** (3022), White Pass US 12, Loup Loup, Disautel, Wauconda, Tiger Mountain SR 18.
  - Sample today: `{"PassName":"Stevens Pass US 2","RoadCondition":"Reports have ended for this season. Traditionally weather and road conditions are reported on this page from November 1 to April 1...","TravelDirection1":"Eastbound","PublicMessage1":"No restrictions",...}`; Satus Pass: `"Weather":"Clear skies","RoadCondition":"Bare and dry"`. North Cascade/Loup Loup etc. have `PublicMessage1: null/"None"`.
  - Gap vs the keyed API: no temperature, no TravelAdvisoryActive flag, no per-pass update timestamp except DisplayDate (null off-season).
- **Road Alerts (closures)**: `.../TravelInfoRoadAlerts/FeatureServer/0/query?where=RoadClosedFlag%3D1&outFields=Road,RoadDirection,HeadlineMessage,EventCategoryDescription,RoadClosedFlag&f=json` -> 200. Fields: TravelCenterPriorityId, EventCategoryDescription, EventCategoryTypeDescription, EventPriorityID, Road, RoadDirection, HeadlineMessage, LastModifiedDate, RoadClosedFlag. Sample: `{"Road":"SR 504","RoadDirection":"Both Directions","HeadlineMessage":"...remain CLOSED at the winter gate..."}`. Filter on `Road` ("SR 542", "US 2", "I-90", "SR 410").
- **Cameras**: `.../TravelInfoCamerasWeather/FeatureServer/0/query?...` -> 200, 1,706 cameras; fields CameraTitle, ImageURL, CompassDirection. Samples: `US 2 at MP 64.6: East Stevens Pass Summit -> https://images.wsdot.wa.gov/nc/002vc06458.jpg`; `US 2 at MP 64.3: West Stevens Pass - Ski Lodge -> .../nc/002vc06430.jpg`; `I-90 at MP 52: Snoqualmie Summit -> https://images.wsdot.wa.gov/sc/090VC05200.jpg`; `I-90 at MP 53.4: East Snoqualmie Summit`. `HEAD https://images.wsdot.wa.gov/nc/002vc06458.jpg` -> 200 image/jpeg, no auth, Last-Modified within 1 minute (live). I did not find Chinook/SR 542 cameras in a quick title filter (unverified; search the layer by bbox).
- Layer also contains some Oregon cams hosted at `https://www.tripcheck.com/RoadCams/cams/*.jpg` (HEAD of `i205pres_pid542.jpg` -> 200 image/jpeg keyless).
- Terms: WSDOT disclaimer https://wsdot.wa.gov/about/policies/travel-information-disclaimer says info is "as-is / as available", do not rely solely on it; footer "© WSDOT All Rights Reserved". It does not state reuse or hot-linking terms. The open-data policy page (https://wsdot.wa.gov/about/policies/open-data-policy) also states none. => Reuse/embedding terms for camera images: **unverified**; recommend link-out rather than embedding, or ask WSDOT.
- Undocumented, not used: none needed.

#### 3. Traction/chain expression
WSDOT ladder (from news/WSDOT-derived coverage, e.g. KOMO, Fox13; official vocabulary not observable off-season, so wording is **unverified against the live feed**):
1. "Traction tires advised" (recommended, not required)
2. "Traction tires required" (M+S/all-season/snowflake)
3. "Chains required on all vehicles except all-wheel drive" (AWD/4WD must still carry chains)
4. "Chains required on all vehicles" (even 4WD/AWD; last step before closure)
Separate weight rule: vehicles over 10,000 lb GVW must chain whenever chains are required. Closure is "Closed" / `RoadClosedFlag=1` in alerts.
Mapping to Caltrans scale: advised/required traction tires -> R-1 (snow tires or chains); "chains except AWD" -> R-2 (exact Caltrans R-2 semantics); "chains all vehicles" -> R-3; closed -> closed. "Traction tires advised" is weaker than R-1: either map to clear + note, or add a level (see section "Scale").

#### 4. Cameras
Keyless, public image URLs (above). Terms on embedding unverified.

#### 5. 511 / fallback links
- https://wsdot.com/travel/real-time/mountainpasses (200). Per pass e.g. https://wsdot.wa.gov/travel/real-time/mountainpasses/stevens -> 302 -> https://wsdot.com/travel/real-time/mountainpasses/stevens (200). Statewide map: https://wsdot.com/travel/real-time/map (not fetched; unverified).

#### Corridor coverage
US-2 Stevens, I-90 Snoqualmie, SR-410 Chinook/Cayuse/Crystal-to-Greenwater, SR-542 Mt. Baker Hwy: all present in the keyless layer. Verified.

---------------------------------------------------------------------------------------------------

### Utah (UDOT) — all road-condition data is behind a key

#### 1. Official developer API (keyed)
- Docs: https://udottraffic.utah.gov/developers/doc (fetched, HTTP 200). Verbatim: "Requires a developer key. For most calls, query string 'key' parameter is required. Throttling is enabled. Ten calls every 60 seconds." "A registered account is needed before you can sign up for a Developer API key. For new users, sign up for an account; otherwise log in and then you can request for an API key here."
- Resources listed: Current Road Weather Conditions, Cameras, Weather Stations, Overhead Digital Signs, Rest Areas, Mountain Passes, Events, Alerts, Snow Plows, Forecasted Road Weather Conditions.
- Live: `https://www.udottraffic.utah.gov/api/v2/get/roadconditions?key=x` -> HTTP 400 `<Error><Message>Invalid Key</Message></Error>`; same for `/api/v2/get/mountainpasses?key=x` and `/api/v2/get/cameras` (no key).
- Friction: create a UDOT Traffic account (email/password form), then a key-request form on the doc page. Approval wait: **unverified**. Terms on reuse/attribution: no explicit API terms found; the Disclaimer URL I guessed returned 404 (unverified). Field names for roadconditions/mountainpasses: **unverified** (not shown on the doc page; need a key to inspect).
- Hostname `developer.udot.utah.gov` does not resolve; the developer page is the one above. Same Iteris/IBI 511 platform as AZ511/NV Roads/Idaho.

#### 2. Keyless official feeds
- UDOT ArcGIS: `https://maps.udot.utah.gov/central/rest/services?f=json` -> 200 (folders AADT, Assets, AVL, Construction, Maintenance, TOC, UDOT, ...). Folder `Traffic` -> `{"error":{"code":499,"details":[],"message":"Token Required"}}`. Public folders (TOC, Maintenance, UDOT) hold only static assets (express lanes, ramp meters, avalanche slide paths/no-parking zones, districts, bridges). **No live road-condition or traction layer found.**
- WZDx work-zone feed: `https://udottraffic.utah.gov/wzdx/udot/v40/data` -> HTTP 200 application/json, 617 KB, license https://creativecommons.org/publicdomain/zero/1.0/ (CC0). But: 744 features, all `event_type: work-zone`, `update_date` 2023-03-19, entries ended 2022-2023, no hit for SR-210/SR-190/Cottonwood. Stale and construction-only. **Not usable for conditions.**
- Utah AGRC open data (https://opendata.gis.utah.gov/, 200) not searched further for road conditions: unverified.
- Undocumented: the udottraffic.utah.gov map JS calls internal endpoints (not probed; would be scraping). Not usable.
- cottonwoodcanyons.udot.utah.gov (200) shows canyon status/traction law as a web page; its traction-law page states no API or data feed. Scraping it is out.

#### 3. Traction/chain expression
UDOT traction law (admin rule R920-6; https://cottonwoodcanyons.udot.utah.gov/traction-law/, fetched) for SR-210 and SR-190 (also US-189 Provo Canyon and others when announced):
- Class 1: vehicles >= 12,000 lb GVWR: traction devices on rear drive tires, or AWD/4WD with M+S/3PMSF.
- Class 2: traction devices on at least two drive tires, or AWD/4WD with M+S/3PMSF; under 12,000 lb 2WD with 3PMSF also qualifies.
- Class 3 (new, Cottonwood Canyons, stricter, announced Nov 2025 by TownLift/UDOT): chains/traction devices on >= 2 drive tires, or AWD/4WD with M+S/3PMSF with >= 5/32" tread; 2WD needs 3PMSF on all wheels or chains. Active when canyon beacons flash; can be imposed 24 h ahead of a storm. Enforcement officers deployed.
Mapping: Class 2/3 traction law ~ R-2 (chains required except AWD/4WD with snow tires) is the closest fit; Class 1 ~ R-1. Utah has no "R-3" equivalent; "closed" is a canyon closure (avalanche control), expressed separately. Which field in the keyed API exposes this (restriction text vs. event) is **unverified**.

#### 4. Cameras
Camera list needs the key (`/api/v2/get/cameras` -> Invalid Key). Image URL pattern/terms unverified.

#### 5. 511 link
https://udottraffic.utah.gov/ (200); canyon page https://cottonwoodcanyons.udot.utah.gov/ (200).

#### Corridor coverage
Unverified (cannot call the keyed API). The UDOT site itself lists "Road Restrictions" and "Mountain Passes", and the Cottonwood Canyons are the main restriction use-case, so coverage of SR-210/SR-190 is very likely but not confirmed; I-80 Parleys, SR-224, SR-39/158 unverified.

---------------------------------------------------------------------------------------------------

### Colorado (CDOT / COtrip) — official JSON API exists, needs registration; no keyless conditions feed

#### 1. Official developer API (keyed)
- Portal: https://manage-api.cotrip.org/ ("DataSharingManagement", Angular SPA; HTTP 200, the HTML only contains the app shell). Registration page content, approval, rate limits, terms: **unverified** (SPA needs login).
- CDOT published a screenshot "Json APIs Access URLs for COtrip" (https://www.codot.gov/assets/json-apis-access-urls-for-cotrip.png/view; downloaded and read). It shows the API Management page https://manage-api.cotrip.org/subscriber/jsonApiDetails with JSON endpoints: Incidents, **Road Conditions** ("Latest Reported road conditions on many Colorado roads"), Planned Events ("Construction, Restrictions, Special Events and Planned Closures"), Weather Stations, Snow Plows, Destinations (travel times), Signs, Connected Work Zone, WZDx. **No Cameras endpoint is listed.**
- Third-party README (https://github.com/jfredrickson/cotrip-feed) corroborates: "sign up for an API key" at manage-api.cotrip.org; XML feed specs at https://www.cotrip.org/xmlFeed.htm (which now just serves the new SPA shell).
- Live: `https://data.cotrip.org/api/v1/roadConditions` -> HTTP 403 "Not Authorized: <timestamp>"; with `?apiKey=x` -> same 403. `https://data.cotrip.org/` -> 404 JSON `{"code":404,"message":"The current request is not defined by this API."}`. Exact production URL/param name for keyed calls is **unverified** (shown only behind the login).

#### 2. Keyless official feeds
- CDOT ArcGIS Hub: https://data-cdot.opendata.arcgis.com/ (200). Hub search for "road condition" returns only "Highways: Drivability Life" (pavement drivability class; `https://dtdapps.codot.gov/server/rest/services/Webapps/open_data_sde/FeatureServer/10`, fields PRIDLCLASS/ROUTE/PRIRDL; 200, keyless) — not real-time. Searches "traction", "chain", "cotrip" return nothing.
- `https://dtdapps.codot.gov/server/rest/services?f=json` -> 200 (folders ATMS, MapView, OTIS, Webapps, ...). `ATMS/ATMS/MapServer` layers: Routes_Legacy_ATMS, Intersections, Mountain_Pass_point_ATMS, CDOT_Cameras_ATMS, LEA, LAW... Layer 3 query returns only `OBJECTID, LOCATION` ("Gypsum Pass", "Douglas Pass", ...) — names only, no conditions. Description: "For new CDOT ATMS development and testing" (not a published product). Do not rely on it.
- Old host `dtdapps.coloradodot.info` -> HTTP 522 timeout.
- **Undocumented, not usable (scraping):** `https://api-511x-co.carsprogram.org/` -> 200 `{"healthy":true}`. This is the backend of the new cotrip.org SPA (511.cotrip.org uses it). A third-party plugin claims "no key, no account", but it is not documented by CDOT. Per AGENTS.md rules this is scraping; I did not query its data endpoints.

#### 3. Traction/chain expression (https://www.codot.gov/travel/winter-driving/TractionLaw, fetched)
- Passenger Vehicle Traction Law: tires with 3/16" tread and an all-weather/winter/M+S rating (snowflake, M+S or M/S), or chains/approved traction device. (A 2025 CDOT release and a 2026 report on HB26-1237 disagree on whether it now covers 2WD; unverified — check page.)
- Passenger Vehicle Chain Law: "the final safety measure before the highway is closed"; every vehicle must have chains or an approved alternative traction device (this removes the AWD exemption).
- I-70 Morrison to Dotsero: traction law Sept 1 to May 31 (or other times if conditions require); can be implemented on any state highway; announced via signs and COtrip.
- Commercial chain codes: not on that page (unverified).
Mapping: Traction Law ~ R-1; Chain Law ~ R-3 (all vehicles chains); closed ~ closed. There is no R-2. Colorado road *surface* conditions (dry, wet, slushy, snow packed, icy) are a separate field that has no Caltrans analogue. How CDOT's JSON exposes traction law (a restriction in Road Conditions or Planned Events) is unverified.

#### 4. Cameras
Not in the official API list (above). The COtrip camera images are served by the same carsprogram backend; undocumented, so not usable. Embedding terms: unverified.

#### 5. 511 link
https://www.cotrip.org/ (200; new COtrip 511 SPA). Winter road conditions layer is toggled in its config (`showWinterRoadConditions: true` in https://511.cotrip.org/configs/main.json).

#### Corridor coverage
Unverified (cannot call the keyed API). CDOT says laws can apply to any state highway, and "Road Conditions" covers "many Colorado roads"; I-70, US-6, US-40, SR-9, SR-82, US-160 unconfirmed.

---------------------------------------------------------------------------------------------------

### Oregon (ODOT / TripCheck) — keyed API, self-serve; no keyless conditions feed found

#### 1. Official developer API (keyed)
- Portal: https://apiportal.odot.state.or.us/ (Azure API Management developer portal, HTTP 200). Product page: https://apiportal.odot.state.or.us/product/tripcheck-data-api. Overview: https://tripcheck.com/Pages/API (200). Getting started: https://www.tripcheck.com/pdfs/TripCheckAPI_Getting_Started_GuideV5.pdf (dated Oct 2020; downloaded and read).
- Base URL: `https://api.odot.state.or.us/tripcheck/...`; live: `GET https://api.odot.state.or.us/tripcheck/Rwis/Inventory` -> HTTP 401 `{"statusCode":401,"message":"Access denied due to missing subscription key..."}`.
- Key: Azure APIM subscription key. Process per the guide: (1) sign up on the portal with a form, email-verification link; (2) Products -> TripCheck Data -> enter a subscription name, read Terms of Use and select "I agree", click Subscribe; key appears on User Profile (primary + secondary key); header `Ocp-Apim-Subscription-Key` is autopopulated in the portal's try-it. Instant, self-serve, no approval step described. ODOT says data is provided "at no cost to subscribers". Rate limit: not stated (429 "Too Many Requests: Message request rate limit exceeded" exists). Terms text itself: **unverified** (behind the "Show" button after sign-in). Attribution: unverified.
- Dataset list (guide + site): Incidents (30 s to 2 min), Local Incidents, **Road and Weather Reports** (5 min; "Current road conditions as reported by ODOT crews. This includes weather observations and tire chain restrictions."), Metadata: Road and Weather (enumerated values, 24 h), RWIS Inventory/Status, Camera (CCTV) Inventory, DMS, Traffic Detectors, WZDx Activities. Field names for Road and Weather Reports: **unverified** (needs key).

#### 2. Keyless official feeds
- None found. `https://gis.odot.state.or.us/arcgis1/rest/services` -> 404; Oregon GeoHub searches ("tripcheck", "chain") returned nothing relevant; web search found only static highway-network layers. A guessed `tripcheck.com/Scripts/map/data/roadConditions.json` -> 404 (and would be undocumented anyway).

#### 3. Traction/chain expression
ODOT tiers (from secondary sources only; official TripCheck legend not found, so **unverified**): "Carry chains or traction tires" (advisory; must have them in vehicle), "Chains or traction tires required" (must be installed, stop at chain-up area), "Chains required" on vehicles towing/commercial; stricter step "chains required on all vehicles not 4WD/AWD". Official: vehicles over 10,000 lb GVW must carry chains when Snow Zone signs are posted (https://www.oregon.gov/odot/pages/winter-commercial-vehicles.aspx, via search result). Enumerated values will be in "Metadata: Road and Weather" once a key exists.
Tentative mapping: "carry chains or traction tires" -> R-1 or a weaker "advisory"; "chains required" -> R-2; "chains required all vehicles (incl. 4WD)" -> R-3; closed -> closed.

#### 4. Cameras
Image URLs are public and keyless in practice: `HEAD https://www.tripcheck.com/RoadCams/cams/i205pres_pid542.jpg` -> 200 image/jpeg, Last-Modified within a minute. The official CCTV Inventory (to find Government Camp / Mt Hood / Century Drive cams) needs the key; WSDOT's open layer lists some tripcheck.com URLs. Terms on linking/embedding: unverified.

#### 5. 511 link
https://www.tripcheck.com/ (200).

#### Corridor coverage
Unverified (can't call API). US-26 / OR-35 / OR-372 are state highways; ODOT crews report conditions on Mt. Hood passes, but I could not confirm the feed lists them.

---------------------------------------------------------------------------------------------------

### Does the Caltrans adapter generalize?

What it does today (pipeline/sources/caltrans.ts, pipeline/config.ts `roadSegment`, shared/types.ts):
- Three inputs fetched per resort: CWWP2 chain-control stations (point status per station), lane-closure feed (full mainline closures filtered by time), and roads.dot.ca.gov HTML text. Normalization is Caltrans-specific (`normalizeChainStatus` regexes "R-1".."R-3"). Segment matching is by `route` + `aliases` + `bbox` against station lat/lon, with `district` (1-12) picking the file. Output `RoadSegment` has `status`, `stations` (count), `worst` (station), `closures`, `notes`; `RoadsData` has segments, `worst`, `textAsOf`. `RoadStatus` = clear|R-1|R-2|R-3|closed|unknown, with SEVERITY ordering.
- Reusable as-is: bbox/route matching idea, `worse()`, SEVERITY, closure filtering, notes with `textMatch`, "failed source = stale, carry forward" in the caller, `RoadsData` shape.
- Caltrans-only: `district`, `textRoute` (roads.dot.ca.gov HTML text), CWWP2 URLs, the R-n parser, the "stations" concept (WSDOT/CDOT/UDOT report per pass or per road segment, not per station).

What a multi-state adapter needs:
1. A `provider` discriminator on `roadSegment` (`caltrans | wsdot | udot | cdot | odot`) and provider-specific fields (`district` only for Caltrans; WSDOT: `passId`/`passName`; UDOT/CDOT/ODOT: route name + mile/bbox filter). Make `district` and `textRoute` optional.
2. An adapter interface like `fetchRoads(segments): { segments: RoadSegment[]; textAsOf }` per provider with its own parse/normalize, all returning the same `RoadSegment`. One shared fetch for a state (each WSDOT/UDOT call returns all passes) cached across resorts, so a 10-calls/60 s UDOT limit or a keyed quota is respected.
3. Status scale: keep `RoadStatus` for the colour/severity, but add a raw, provider-worded restriction string (`worst.status` already holds a raw string, good) plus a tiny extra level for "traction advised / carry chains" and a separate `surface` field (bare/wet/snow/ice) because WSDOT and CDOT report it. Don't remap R-2 semantics across states; label by the state's own wording and use the R-scale only for sorting/severity.
4. Add `provider` and an official fallback `url` (the 511 link) to `RoadsData` so the UI can say "Source: WSDOT" and link out where a state has no feed. `links.roads` already exists for this.
5. Attribution/disclaimer per provider (WSDOT "as-is"), and a keyed-provider flag so the pipeline skips cleanly (status `unknown` + 511 link) when the secret is absent.

Scale recommendation: keep the current `clear | R-1 | R-2 | R-3 | closed | unknown` internally for ordering, but add `advisory` (between clear and R-1) and show the state's own wording. Only Caltrans and ODOT use "R"-like level semantics, Colorado is two-level (traction / chain), Utah is three "classes" for tires, WSDOT is four steps.

---------------------------------------------------------------------------------------------------

### Comparison

| State | Keyless official data? | Key needed for what | Sign-up friction | Covers our corridors? |
|---|---|---|---|---|
| WA (WSDOT) | **Yes**: ArcGIS FeatureServer `TravelInfoMtPassReports` (pass road condition + per-direction restriction text), `TravelInfoRoadAlerts` (closures), `TravelInfoCamerasWeather` (camera image URLs); all HTTP 200, no token | Only the REST/WSDL/RSS/KML API (adds temp + advisory flag); not needed | Access Code emailed on entering an email (no approval described); not needed for the ArcGIS route | Yes, verified: US-2 Stevens, I-90 Snoqualmie, SR-410 Chinook/Cayuse/Crystal-Greenwater, SR-542 |
| UT (UDOT) | **No** (WZDx CC0 feed is construction only and stale since 2023; ArcGIS has no live conditions) | Everything: road conditions, mountain passes, events, cameras | Create site account, then request key; 10 calls/60 s; approval time unverified | Unverified (can't call); likely SR-210/190 |
| CO (CDOT) | **No** (only static/pavement layers); undocumented `api-511x-co.carsprogram.org` exists but is scraping | Road Conditions, Planned Events, Incidents, Weather Stations, Snow Plows, WZDx via manage-api.cotrip.org | Registration on manage-api.cotrip.org; approval/terms/limits unverified; no camera endpoint | Unverified (can't call) |
| OR (ODOT) | **No** | Road and Weather Reports (incl. chain restrictions), incidents, RWIS, CCTV inventory via api.odot.state.or.us | Self-serve: email-verified portal account, accept Terms, Subscribe; instant, free; limits unstated | Unverified (can't call) |

### Recommendation
1. **Build Washington now**: no key, official, covers all four WA corridors. Use `TravelInfoMtPassReports` for status + `TravelInfoRoadAlerts` for closures; link to wsdot.com pass pages. Re-check the PublicMessage vocabulary in November when winter reports start (it's "No restrictions" today, so the restriction strings are unverified).
2. **Oregon next if Mikey approves a key**: lowest friction of the three keyed states (instant, self-serve, free, email + Terms click), and it carries chain restrictions. Need to read the Terms and the Road and Weather metadata after signup to confirm coverage of US-26/OR-35/OR-372.
3. **Colorado and Utah**: ask for approval of two keys only if wanted; both are account-then-request flows with unverified wait times, and UDOT is limited to 10 calls/60 s. Fallback for these (and any keyed state without a key): `unknown` status plus a link to the state's 511 site (udottraffic.utah.gov, cotrip.org). Do not use `api-511x-co.carsprogram.org` or the sites' internal JSON; that is scraping.
4. Store any key only as a GitHub secret; keyed providers must skip cleanly when the secret is absent (stale/unknown, never fail the run).

---

## Whistler Blackcomb: Canadian data sources (evidence log, 2026-10-23)

All calls used `User-Agent: powder-snow/0.1 (personal forecast app)`. Raw responses are in the scratchpad dirs `om/`, `ca/`, `bc/`, `rd/`.

### 0. Location (UNVERIFIED coordinates, confirm before adding to resorts.json)
- tz America/Vancouver. Base (Whistler Village) about 50.116N, -122.957W, 675 m (2214 ft). Summit = Blackcomb Peak 2284 m (7494 ft); Whistler Peak is 2181 m (7156 ft). These come from memory, not a checked source.
- For the Open-Meteo test I used a single midpoint lat/lon 50.098, -122.954 with elevation=2284,675 (m). ECCC's own Whistler point is 50.12N -122.96W (citypage geometry); ECCC's reference elevation for Whistler is 658 m (FPCN11 text).
- Note: base-to-summit is a 1,609 m drop. Open-Meteo applies a lapse-rate correction from the `elevation` param.

### 1. Alerts: ECCC MSC GeoMet OGC API `weather-alerts` (WORKS)
- `GET https://api.weather.gc.ca/collections/weather-alerts/items?f=json&bbox=-123.0,50.05,-122.9,50.15&limit=20` -> 200, FeatureCollection, `numberMatched: 0` (no active Whistler alert today). The same query shape on a Saskatchewan bbox (`bbox=-108,56,-106,58`) returned 4 alerts, so the query mechanism works. `province=BC` returned 1 (North Vancouver Island, Wind).
- Properties: `alert_code` (e.g. SPS), `alert_type` (statement/warning/watch/advisory), `alert_name_en`, `alert_short_name_en` (e.g. "Snowfall"), `publication_datetime`, `validity_datetime`, `event_end_datetime`, `expiration_datetime`, `alert_text_en` (full text), `risk_colour_en` (yellow/orange/red), `confidence_en`, `impact_en`, `feature_name_en` (zone name), `feature_id` (e.g. fea1-1876), `province`, `status_en` (issued / continued / ended). Geometry is the zone polygon. Filterable: any queryable above plus `bbox`.
- Whistler's public forecast zone: `GET /collections/public-standard-forecast-zones/items?f=json&bbox=-123.0,50.05,-122.9,50.15` -> 200: NAME "Whistler", CLC 082400, FEATURE_ID fea1-2325, AREA 6693 km2, BC. Querying alerts by `feature_id=fea1-2325` returned 0 (consistent with no alert, but the id match between zone and alert layers is UNVERIFIED because no live Whistler alert exists). A point/bbox query is the safe method. Filter out `status_en=ended`.
- Datamart alternative: `https://dd.weather.gc.ca/today/alerts/cap/` -> 200 (CAP XML directory; not parsed). `bulletins/alphanumeric/20261023/WW/CWVR/17/WWCN11_...` ("YELLOW WARNING - WIND FOR COASTAL BRITISH COLUMBIA") also works as plain text, but the OGC API is easier.
- Licence: "Environment and Climate Change Canada Data Services End-use Licence" v2.1.1 (Aug 2026), https://eccc-msc.github.io/open-data/licence/readme_en/ . Free, worldwide, perpetual, commercial OK, no key. Conditions: attribute ("Data Source: Environment and Climate Change Canada" or "Contains information licenced under the Data Server End-use Licence of Environment and Climate Change Canada"); **weather alerts must be reproduced without altering content or intent**; no implied endorsement. This is ECCC's own licence, not literally OGL-Canada.
- Rate limits: none stated in what I read (UNVERIFIED).

### 2. Point forecast: ECCC citypage weather (WORKS, site `bc-86`)
- `GET https://api.weather.gc.ca/collections/citypageweather-realtime/items/bc-86?f=json` -> 200, 33,965 B, `lastUpdated 2026-10-23T21:02:53Z`. name "Whistler", region "Whistler", Point [-122.96, 50.12]. Collection is labelled "[experimental]". (bc-45 = Kamloops, shown for comparison only.)
- Top-level keys: `currentConditions` (obs station "Whistler" code `wae`, temp 9.9 C), `forecastGroup` (13 periods + `regionalNormals`), `hourlyForecastGroup` (24 hourly rows: condition, temperature, iconCode, `lop` = likelihood of precip, wind, UV), `warnings` (empty array now), `riseSet`.
- Each forecast period: `period.textForecastName`, `temperatures` (high/low + text), `winds`, `cloudPrecip.textSummary`, `precipitation` (when present), `snowLevel` (seen on the Kamloops sample, not on Whistler's today), `abbreviatedForecast` (condition text + pop), `relativeHumidity`, `uv`, `textSummary` (e.g. "Periods of rain. Rain at times mixed with light wet snow in the morning. Wind becoming north 20 km/h gusting to 40 near noon. High plus 5."). Metric units, bilingual `{en, fr}` leaves, so values need converting to imperial.
- Bulletin text alternative: Datamart `FPCN11 CWVR` "FORECASTS FOR THE SOUTH COAST OF BRITISH COLUMBIA" (https://dd.weather.gc.ca/today/bulletins/alphanumeric/20261023/FP/CWVR/11/FPCN11_CWVR_231145___43107), lists "WHISTLER: 658 METRES" as a reference elevation. Public, no key.
- No separate mountain-elevation point forecast from ECCC: the Whistler forecast is valley-level (658 m) text. Mountain numbers must come from Open-Meteo.
- Licence: same ECCC End-use Licence.

### 3. Forecaster discussion: nothing equivalent to the NWS AFD
- ECCC publishes no public land-area forecaster discussion. Datamart bulletins dirs checked: `FX/` holds only CWAO (Canada) plus US NWS offices; `FP/CWVR` (Pacific Storm Prediction Centre) hours 11 and 21 hold only forecast text, nothing with "synopsis". `FQ/CWVR/17/FQCN10_CWVR_231715___40033` is a "TECHNICAL MARINE SYNOPSIS FOR THE PACIFIC WATERS" (22 lines, marine only, ocean area, not the mountains). `metnotes` collection: numberMatched 0. Closest weather-synopsis-like text: the marine synopsis (marginal for Whistler).
- Avalanche Canada Mountain Weather Forecast (human-written, Synopsis / Day 3-4 / Day 5-7 text): page https://avalanche.ca/weather/forecast says "The Mountain Weather Forecast has ended for the season" (as of 2026-10-23). It returns later in season (date UNVERIFIED). The documented API (below, `docs` at https://avalanche.ca/api-docs) lists only forecasts/* and weather *stations* endpoints. I found NO documented endpoint for the Mountain Weather Forecast text (`api.avalanche.ca/weather/en/products` and `.../mountain-weather-forecast` both 404). The page is HTML for the website, so reading it is scraping: **not usable** unless Avalanche Canada says otherwise ([contact email removed] per their docs).
- So the best writer-input replacement for the AFD is the Avalanche Canada forecast `highlights` + `summaries` text (section 4), in season only.

### 4. Avalanche: Avalanche Canada public API (WORKS, off-season right now)
- Official docs: https://avalanche.ca/api-docs ("Documentation for Avalanche Canada's public APIs"). Forecast base `https://avcan-services-api.prod.avalanche.ca` ; `https://api.avalanche.ca` serves the same paths (both worked in my calls via api.avalanche.ca). Endpoints: `GET /forecasts/{lang}/areas` (GeoJSON), `/forecasts/{lang}/metadata`, `/forecasts/{lang}/products`, `/forecasts/{lang}/products/point?lat=..&long=..`, `/forecasts/{lang}/products/{id}`, plus weather-station base `https://weather.prod.avalanche.ca` with `GET /stations`, `GET /stations/{stationId}/measurements`. No key.
- Live calls: `https://api.avalanche.ca/forecasts/en/areas` -> 200 (8 area features), `.../metadata` -> 200 (8), `.../products/point?lat=50.1163&long=-122.9574` -> 200, 3.7 KB.
- **Current state:** the whole province is a single "off-season" product: area id 53bb614c...f33ed covers Whistler (point-in-polygon on both Whistler points). `report.dateIssued 2026-10-01`, `validUntil 2026-11-26`, `highlights`: "Avalanche hazard may exist where there is snow... Daily avalanche forecasts will begin November 25 at 4 PM." `dangerRatings` all `earlyseason` for alp/tln/btl, `problems: []`. Once daily forecasts start the areas should split into regions (Sea to Sky etc.). **The in-season shape was not observable today (UNVERIFIED)**, and the area id for Sea to Sky is unknown until then, so use the `products/point` lookup rather than a hard-coded id.
- Schema from the docs (report): `highlights` (HTML), `confidence.rating`, `summaries[]` (type: avalanche / snowpack / weather summary etc., HTML `content`), `dangerRatings[]` (per date; `ratings.alp|tln|btl` each with `rating.value` and `display`), `problems[]`, `terrainAndTravelAdvice[]`, `dateIssued`, `validUntil`, `forecaster`, `title`, `url`. Danger is three elevation bands (alpine / treeline / below treeline) over multiple days (3 here).
- Mapping to the US `AvalancheData`: `upper/middle/lower` <- alp/tln/btl; `current`/`tomorrow` <- dangerRatings[0]/[1]; `bottomLine` <- `highlights` (stripped HTML); `discussion` <- `summaries` (avalanche + snowpack + weather); `problems` <- `problems[].type`. Danger scale text is the North American one (1 Low ... 5 Extreme), but offseason value `earlyseason`/`noRating` must map to -1/0. Product type (`avalancheforecast`) differs from avalanche.org's `forecast`/`summary`.
- Terms: https://avalanche.ca/terms-of-use is the general website terms: "The material on this site may not be reproduced or copied without prior written consent" . It does not mention the API. The Data Sharing Policy (https://avalanche.ca/data-sharing-policy, updated 2026-02-12) says "Public Users: ... we encourage users to explore available data on our website or through our public APIs". The API docs give no licence, rate limit or attribution rule. So: documented public keyless API, **licence for redistribution unclear**; the text would be writer input only (not shown), danger ratings/links shown with attribution. Recommend emailing [contact email removed] if Mikey wants certainty.
- Weather stations (`weather.prod.avalanche.ca/stations`, 154 stations: 107 BC MoTI, 28 Parks Canada, 8 Avalanche Canada ...). Nearest to Whistler: Brandywine (3 BRNWRW, 496 m, 13 km) and Tantalus (320 m); both low-elevation highway stations, no alpine station near Whistler.

### 5. Observed snowpack (WORKS for nearby stations; none on the ski hill)
- BC River Forecast Centre ASWS current-season CSVs, keyless, hourly: `https://www.env.gov.bc.ca/wsd/data_searches/snow/asws/data/` (directory listing, 200). Files: `SD.csv` snow depth (hourly, 252 KB, cm), `SW.csv` snow water equivalent (hourly, mm), `SWDaily.csv` (daily), `TA.csv` air temp, `PC.csv` precip, and `*_Archive.csv`, `allmss_current.csv` (manual snow surveys). First column `DATE(UTC)`; one column per station named `<id> <name>`. Fetched SD/SW/SWDaily -> 200. Updated 2026-10-23 14:16 (local server time), data rows to 2026-10-23 21:00.
- Station metadata: BC WFS `https://openmaps.gov.bc.ca/geo/pub/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=pub:WHSE_WATER_MANAGEMENT.SSL_SNOW_ASWS_STNS_SP&outputFormat=application/json&srsName=EPSG:4326&count=400` -> 200, 180 stations; props `LOCATION_ID, LOCATION_NAME, ELEVATION, STATUS, LATITUDE, LONGITUDE, OPERATOR`.
- Nearest to Whistler (distance from 50.10N -122.95W): **3A20P Callaghan Creek**, 1017 m, 50.137N -123.103W, BC Hydro, ~12 km (Whistler Olympic Park valley); 3A25P Squamish River Upper, 1360 m, ~35 km; 1D06P Tenquille Lake, 1680 m, ~48 km (Pemberton side); 3A28P Tetrahedron (in the CSV; coordinates not extracted, south of Squamish, far). The ASWS set has no station on Whistler or Blackcomb mountain. Latest values 2026-10-23: Callaghan SD 0.0 cm, SW 1 mm; Tetrahedron SD 2 cm, SW 15 mm; Tenquille SD 3 cm, SW 0.
- Licence: Open Government Licence - British Columbia (BC Data Catalogue, "Current Season Automated Snow Weather Station Data", package 3a34bdd1-61b2-4687-8b55-c5db5e13ff50, license_id "2"). Attribution to BC River Forecast Centre / station operator (BC Hydro etc.) recommended.
- ECCC stations near Whistler (GeoMet `swob-stations`, `climate-stations`, `swob-realtime`): WHISTLER - NESTERS (msc 1100875, 662 m, 50.129N -122.955W, automated). SWOB realtime `snw_dpth` exists but is -1/0 at the moment (valley, no snow). CALLAGHAN VALLEY (1101300, 887 m, SWOB id CVOD). WHISTLER ROUNDHOUSE climate id 1108906, 1835 m, daily series 1972-11 to 2026-09-24 but the latest rows returned null for snow fields; whether it reports snow depth in season is UNVERIFIED. Blackcomb Mountain 1540 / 1860 and Whistler Mountain stations exist only as historical (ended 1994 / 2010).
- Comparable to the US `SnowpackData` network: a new network 'BC-ASWS' would be needed in `shared/types.ts` (not 'SNOTEL'|'CDEC'|'CoCoRaHS'); the "Roundhouse" near-resort station isn't live.

### 6. Open-Meteo coverage (ONE call each, as instructed)
- Deterministic: `https://api.open-meteo.com/v1/forecast?latitude=50.098,50.098&longitude=-122.954,-122.954&elevation=2284,675&timezone=America%2FVancouver&forecast_days=16&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&hourly=precipitation,snowfall,temperature_2m,freezing_level_height,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,precipitation_probability&models=gfs_seamless,ecmwf_ifs,icon_seamless,gem_seamless,ecmwf_aifs025_single,ncep_hrrr_conus,ncep_nam_conus,ncep_nbm_conus` -> HTTP 200, 2 locations, 384 hourly timestamps each, returned elevations 2284 and 675 m.
- Non-null hours (identical at both elevations), precipitation/temperature/snowfall:
  - gfs_seamless 384, ecmwf_ifs 366, icon_seamless 186, gem_seamless 246, ecmwf_aifs025_single 366 (temp 371), ncep_hrrr_conus 60, ncep_nam_conus 72, ncep_nbm_conus 276.
  - **All 8 models return data**; the three CONUS models still cover this BC point (HRRR/NAM only 60/72 h, so the short-range blend works as for US resorts). Parsing in `parseDeterministic` would yield all 8 models.
- Ensemble: `https://ensemble-api.open-meteo.com/v1/ensemble?...&hourly=precipitation,temperature_2m&models=gfs025,ecmwf_ifs025` (same location params) -> HTTP 200. Both ensembles return members at both elevations: `ncep_gefs025` 31 members (246 non-null hours), `ecmwf_ifs025_ensemble` 51 members (354 hours).
- `gem_seamless` and HRDPS: the response does not label the underlying sub-model. Per Open-Meteo documentation (not re-verified here) `gem_seamless` blends GEM global (10 days), regional and the HRDPS continental (2.5 km, 48 h) domain, which covers southwest BC. The 246-hour (10.25 day) length matches the global run. Whether HRDPS was used here is **UNVERIFIED** (would need a separate gem_hrdps_continental request, which I did not make per the budget instruction).
- Caveat: models are 9-25 km grids, so Whistler's complex terrain is smoothed; the elevation param only corrects temperature.

### 7. Long-range outlook (CPC replacement), brief
- ECCC CanSIPS in the OGC API: `weather:cansips:100km:forecast:seasonal-products` and `...:monthly-products` collections exist (global 1 deg grid, 360x180, `reference_time` 2025-06 .. 2026-10, periods P00M-P02M ... P09M-P11M). Parameters per the schema: `AirTemp-ProbAboveNormal / NearNormal / BelowNormal` (and precipitation equivalents), i.e. tercile probabilities, like CPC.
- `GET .../seasonal-products/coverage?f=json` -> 200 returns the whole global grid as CoverageJSON (1.2 MB for the default parameter). A point `subset=` request returned 400 "Invalid axis name" for lat/Lon, Lat/Long and x/y spellings, so server-side point extraction is **not working as I tried**; the workable method is to download the grid and index the cell locally (x index = lon + 180.5, y index = 90 - lat, 1 deg). Cell extraction not tested. WMS `GetFeatureInfo` on `CanSIPS_100km_AirTempAnomaly` -> "Layer not available" in my attempt (layer name mismatch, UNVERIFIED).
- ECCC does not publish a 6-10/8-14 day or week 3-4 outlook comparable to CPC's by point (UNVERIFIED; not found in the collections list). The 16-day Open-Meteo ensemble covers the 6-14 day window.
- CPC ENSO: `https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml` -> 200, still fine (global).

### 8. Roads: DriveBC Open511 (WORKS) and webcams
- Discovery `https://api.open511.gov.bc.ca/` -> 200 (services: events, areas). Docs `https://api.open511.gov.bc.ca/help` -> 200: governed by "Open Government Licence - British Columbia"; refers to an "API Terms of Use" (text not read; rate limit UNVERIFIED). Max `limit` 500, `offset` pagination. Filters: `status`, `event_type`, `event_subtype`, `severity`, `road_name`, `area_id`, `bbox`, `updated`, `geography`+`tolerance`.
- `GET https://api.open511.gov.bc.ca/events?format=json&status=ACTIVE&road_name=Highway%2099&limit=50` -> 200, 14 events, all road "Highway 99". Bbox `-123.3,49.6,-122.8,50.3` -> 200, 6 events (Whistler end). Event fields: `id` (drivebc.ca/RIDE-103726), `headline`, `status`, `created`, `updated`, `description`, `+ivr_message`, `+linear_reference_km`, `schedule.intervals`, `event_type`, `event_subtypes`, `severity` (MINOR/MODERATE/MAJOR), `geography` (LineString), `roads[].name`, `areas[]`. Today's Highway 99 events are all CONSTRUCTION/MINOR (tree pruning at Lorimer Road, utility work Horseshoe Bay to Whistler, paving).
- Province-wide today (limit=500): 289 events: CONSTRUCTION 260, ROAD_CONDITION 16 (e.g. "Slushy sections between ..."), INCIDENT 13 (5 MAJOR). Subtypes seen: ROAD_MAINTENANCE, PLANNED_EVENT, ROAD_CONSTRUCTION, HAZARD, FIRE, ALMOST_IMPASSABLE, OBSTRUCTION. The docs' example closure is an INCIDENT/HAZARD with MAJOR severity and text "The road is closed". **There is no structured "closed" flag nor chain-up/winter-tire field**: closures and road-surface condition come as free text in `description` (ROAD_CONDITION events describe slush/ice). Mapping a Highway 99 closure would need text matching of `description` (UNVERIFIED on a live Hwy 99 closure, none active). Winter-tire rules for Sea-to-Sky (Hwy 99 signed zone, 1 Oct - 30 Apr) are regulation, not in the feed.
- One transient `HTTP 500` on `event_type=WEATHER_CONDITION&road_name=Highway 99`; filtering client-side worked. Treat as stale-source case.
- Webcams: `https://www.drivebc.ca/api/webcams/` -> 200, 1.2 MB JSON (id, name, caption, `links.imageDisplay` `/images/<id>.jpg?t=...`, highway, region, stale flags). It is the backend of the DriveBC website UI and has no documentation or terms I could find: **not usable**. The Open511 help mentions a "cameras" service type in the spec but the discovery document lists only events and areas. BC Data Catalogue search "drivebc webcam" returned no datasets. `images.drivebc.ca` did not resolve (DNS failure).

### 9. Snow report (lifts / new snow)
- The MtnPowder all-resorts feed `https://www.mtnpowder.com/feed` -> 200, 2.3 MB, 147 entries, `Resorts[].Name`. It includes Revelstoke, Cypress Mountain, Sun Peaks, Lake Louise, Panorama, Red Mountain, Silverstar, Mt Norquay, Sunshine Village but **no Whistler or Blackcomb**. Confirmed no keyless official feed for Whistler Blackcomb lifts/new snow. Not scraping whistlerblackcomb.com. Status must come from `local.openingDate` (as for the other Vail resorts without a feed) and the season dates (UNVERIFIED, check the resort's published opening date by hand).

### Summary table

| US source | Whistler replacement | Keyless? | Verified live? | Gaps |
|---|---|---|---|---|
| NWS alerts | ECCC `api.weather.gc.ca` collection `weather-alerts` (bbox/point query, zone "Whistler" fea1-2325) | Yes | Query yes, 0 active Whistler alerts today so no Whistler sample | Zone id link unverified; ECCC licence requires unaltered alert text and attribution |
| NWS point forecast / grid | ECCC citypage `bc-86` (13 text periods, 24 h hourly, current obs); Open-Meteo for mountain elevations | Yes | Yes | Valley (658 m) text only; metric, bilingual; "experimental" collection |
| NWS AFD (forecaster discussion) | None found. Maybe Avalanche Canada summaries (in season) | n/a | No equivalent; Mountain Weather Forecast ended for season and has no documented API | Mountain Weather Forecast text is website-only (scraping = not usable) |
| avalanche.org | Avalanche Canada API `api.avalanche.ca/forecasts/en/products/point` | Yes | Yes, but only the off-season product (early season ratings) | In-season schema and region id unverified; redistribution licence unclear |
| SNOTEL/CDEC snowpack | BC RFC ASWS CSVs (Callaghan Creek 3A20P, 1017 m, ~12 km) | Yes | Yes (values 0 cm) | No station on the ski hill; Roundhouse climate station null snow; OGL-BC |
| Open-Meteo | Same endpoints, same models | Yes | Yes: 8/8 deterministic (60-384 h), both ensembles (31 + 51 members) | HRDPS use inside `gem_seamless` unverified |
| CPC outlooks | ECCC CanSIPS monthly/seasonal on OGC API (global grid) | Yes | Collection and coverage download yes; point subset failed | No 6-14 day or week 3-4 equivalent found; CPC ENSO still OK (200) |
| Caltrans roads | DriveBC Open511 `api.open511.gov.bc.ca/events` (Hwy 99) | Yes | Yes (6 to 14 construction events) | No structured closure/chain field; text parsing; webcam API not usable |
| MtnPowder report | None | n/a | Confirmed absent (147 resorts, no Whistler) | Status from opening date only |

---

## Phase 3 data sources: Utah, Colorado, Pacific NW (checked 2026-10-23)

All requests used `User-Agent: powder-snow/0.1 (personal forecast app)`, at most 4 in flight, 0.3-0.5 s pauses. One mistake: an unfiltered `https://api.avalanche.org/v2/public/products?avalanche_center_id=CAIC` returned 142 MB (the whole archive). Never call that endpoint without filters. Raw responses are in `.../scratchpad/av/`, `.../scratchpad/mp/` (one file per MtnPowder id), AFD texts in `.../scratchpad/afd_<OFFICE>.txt`.

What the adapters consume (read first): `pipeline/sources/avalanche.ts` calls `GET https://api.avalanche.org/v2/public/product?type=forecast&center_id=<C>&zone_id=<Z>` and needs `product_type` (throws if absent), `published_time`, `expires_time`, `danger[]` rows with `valid_day` `current`/`tomorrow` and `upper/middle/lower`, `bottom_line`, `hazard_discussion`, `weather_discussion`, `forecast_avalanche_problems[].name`, `forecast_zone[]`. Config is `avalanche: {center, zoneId}`. `pipeline/sources/report.ts` calls `https://www.mtnpowder.com/feed?resortId=N`, needs `Name`, `SnowReport` (throws otherwise), station keys listed in `report.stations`, optional `MountainAreas[].Name` for split resorts, and `TotalOpenLifts/TotalLifts/TotalOpenTrails/TotalTrails`.

### Summary of findings

1. **avalanche.org works for UAC, NWAC, COAA. It does NOT work for CAIC.** CAIC's avalanche.org entry is stale 2022 data plus ~200 junk/disabled zones. CAIC publishes through its own keyless endpoint `https://avalanche.state.co.us/avid/products/all` (not documented anywhere I could find; found in the CAIC site's own map JS). Needs a new adapter.
2. Everything is in early-season/off-season state today, so none of the four centers has `danger` rows yet. In-season product shape could not be checked for these centers (only the CA centers' shape is known from the existing adapter).
3. **MtnPowder:** 143 feeds have a Name out of ids 1..400 (257 returned 404). For the candidates: usable reports for Winter Park (5), Steamboat (6), Deer Valley (49), Solitude (65), Arapahoe Basin (93), Crystal Mountain (80). Name-only (no SnowReport, so unusable): Alta, Snowbird, Brighton, Snowbasin, Copper, Eldora, Aspen x4, Summit at Snoqualmie, Mt Bachelor. No feed at all: Park City, Powder Mountain, all other Vail resorts, Telluride, Crested Butte, Wolf Creek, Loveland, Stevens, Baker, Timberline, Hood Meadows.
4. **NWS offices:** SLC (Utah), GJT (Vail, Beaver Creek, Steamboat, Aspen, Telluride, Crested Butte), BOU (Breck, Keystone, A-Basin, Copper, Loveland, Winter Park, Eldora), PUB (Wolf Creek), SEW (Crystal, Stevens, Baker, Snoqualmie), PQR (Timberline, Hood Meadows), PDT (Mt Bachelor, Bend is Pendleton's, not Portland's).

### 1. Avalanche

#### 1a. avalanche.org `avalanche-center/<ID>`
| Center | URL | HTTP | Result |
|---|---|---|---|
| UAC | https://api.avalanche.org/v2/public/avalanche-center/UAC | 200 | name "Utah Avalanche Center", `off_season:false`, 9 zones (1736 Logan, 1737 Ogden, 1738 Salt Lake, 1739 Provo, 1740 Uintas, 1741 Skyline, 1742 Moab, 1743 Southwest, 1744 Abajos), all `active` |
| NWAC | https://api.avalanche.org/v2/public/avalanche-center/NWAC | 200 | `off_season:true`; active zones 3020 Olympics, 3021 West Slopes North, 3022 West Slopes Central, 3023 West Slopes South, 3024 Stevens Pass, 3028 Snoqualmie Pass, 3029 East Slopes North, 3030 East Slopes Central, 3031 East Slopes South, 3032 Mt Hood. Disabled legacy: 3025, 3026, 3027 (Mt Hood old id) |
| COAA | https://api.avalanche.org/v2/public/avalanche-center/COAA | 200 | `off_season:false`; zones 2470 Central Cascades, 2471 Newberry |
| CAIC | https://api.avalanche.org/v2/public/avalanche-center/CAIC | 200 | 200+ zones, almost all `disabled` or uuid-named; the 10 legacy zones (2496 Steamboat, 2497 Sangre de Cristo, 2498 Front Range, 2499 Vail Summit, 2500 Sawatch, 2501 Aspen, 2502 Gunnison, 2503 Grand Mesa, 2504 N San Juan, 2505 S San Juan) are all `disabled` |

#### 1b. avalanche.org `product?type=forecast&center_id=<ID>&zone_id=<Z>`
| Request | Result |
|---|---|
| UAC zones 1737, 1738, 1739, 1740 | 200, `product_type:"forecast"`, published 2026-09-15T00:4x, **expires 2026-09-16 (expired, ~5 weeks stale)**, `danger:[]`, no bottom line, `forecast_zone` = just that zone. The adapter would parse it fine and show "No rating yet"; `expiresAt` is in the past. |
| NWAC 3020, 3021, 3022, 3023, 3024, 3028, 3032 | 200, **identical center-wide product id 185514**, `product_type:"summary"`, published 2026-09-15, expires 2026-11-21, `danger:[]`, `hazard_discussion` = "2026 Early Season Avalanche Statement" (author Dallas Glass), `forecast_zone` lists all 10 zones. Adapter picks the zone by id so name/url come out right. |
| NWAC 3027 (disabled Mt Hood) | 200 but empty object without `product_type` -> `parseAvalanche` would throw. Use 3032. |
| COAA 2470 | 200, `product_type:"summary"`, published 2026-05-01, expires 2026-07-16 (season concluded; stale), `danger:[]` |
| CAIC 2496, 2499, 2500, 2501 | 200 but `product_type:"forecast"` published **2022-06-05**, expired 2022-06-06, `danger:[]`. Useless. |
| CAIC map layer https://api.avalanche.org/v2/public/products/map-layer/CAIC | 200, one feature "CAIC zone" (id 2755) covering the whole state bbox (-108.44,36.99,-104.89,41.00), `danger_level:-1`, start 2026-10-23T21:15 end 2026-10-31T22:30: avalanche.org mirrors only a single statewide summary. No per-zone data. |

Map layers (zone geometry for point-in-polygon): `https://api.avalanche.org/v2/public/products/map-layer/UAC` (9 features), `.../NWAC` (10), `.../COAA` (2). All currently `danger: "no rating"`.

#### 1c. CAIC official API (keyless)
Found by reading the CAIC site's own JS bundle (`https://avalanche.state.co.us/_astro/HomepageMapWrapper.CeLULHZ9.js` sets `avidBaseUrl = https://avalanche.state.co.us/avid`; `ForecastMap-*.js` lists the paths). Not documented publicly as far as I could find (web search found only an unofficial client, https://github.com/gormaniac/caic-python, "undocumented HTTP APIs"). No key, no cookies. Unknown paths under `/avid/` return 403, so it is an allow-list gateway. Treat as undocumented and subject to change; ask Mikey before relying on it.
- `GET https://avalanche.state.co.us/avid/products/all` -> 200 JSON array of products. Today 2 products:
  - id `35358a81-...`, `type:"avalancheforecast"`, `areaId` `a141d5b6...`, `polygons[]` = 125 zone-polygon uuids (same uuids as the active zones in the avalanche.org CAIC listing), `issueDateTime 2026-10-23T21:15Z`, `expiryDateTime 2026-10-31T22:30Z`, `avalancheSummary.days[0].content` (HTML, early-season statewide summary), `media.Images[]`, `dangerRatings.days[]` = `{position, alp, tln, btl, date}` with `earlySeason` today (also `noForecast`; in season expect low/moderate/considerable/high/extreme, unverified), `avalancheProblems.days[[],[]]`. "Daily forecasts resume November 1, 2026" is in the summary text.
  - id `d3db3b46-...`, `areaId` `894e51d2...`, 22 polygons, `noForecast` (edge zones, e.g. Uinta, Roan Plateau, Book Cliffs).
- `GET https://avalanche.state.co.us/avid/products/all/area` -> GeoJSON FeatureCollection, one feature per `areaId` (today 2, merged shapes, `properties.centroid`). In season there should be one area per forecast zone (unverified). Point-in-polygon on these features gives the product for a resort via `areaId`.
- Filters seen in the JS: `products/all?productType=avalancheforecast|regionaldiscussion|specialproduct` and `products/all/area?productType=...`. `regionaldiscussion` and `specialproduct` return `[]` today.
- Result for the adapter: needs a separate `fetchCaic` that point-in-polygons the resort against `/all/area` features (cache geometry), finds the product with that `areaId`, and maps `alp/tln/btl` to upper/middle/lower. Zone names are not in these two responses (only uuids): unverified how to get "Vail & Summit County" etc. Name would have to be hardcoded in resorts.json.

#### 1d. Resort -> zone (point in polygon; base and summit points; script `scratchpad/pip.mjs`)
Summit points below are rough (see section 4), so the base result is the one to trust.
| Resort | Result |
|---|---|
| Alta, Snowbird, Brighton, Solitude | UAC 1738 Salt Lake (base and summit). The points sit 0.1-2 km from the zone edge (summit points are rough), so a neighbouring zone is possible; unverified. |
| Park City | base point 1.6 km OUTSIDE every UAC polygon; summit point in 1738 Salt Lake. UAC covers Park City ridgeline in Salt Lake; use 1738 (nearest). |
| Deer Valley | both points outside (1.6-1.8 km from nearest). Same: 1738 nearest. unverified which UAC zone UAC itself lists for Deer Valley. |
| Snowbasin, Powder Mountain | UAC 1737 Ogden (base and summit) |
| Colorado (all 14) | CAIC area `a141d5b6` (the active statewide product) for every point except Steamboat, where both points fall 0-2.2 km outside every area polygon (it sits on the edge of the Park Range / Steamboat zone). |
| Crystal | NWAC 3023 West Slopes South (3.1 km from the edge) |
| Stevens Pass | NWAC 3024 Stevens Pass |
| Mt. Baker | NWAC 3021 West Slopes North |
| Summit at Snoqualmie | NWAC 3028 Snoqualmie Pass |
| Timberline, Hood Meadows | NWAC 3032 Mt Hood |
| Mt. Bachelor | COAA 2470 Central Cascades |

### 2. MtnPowder scan (ids 1..400, `https://www.mtnpowder.com/feed?resortId=N`)
Log: 143 HTTP 200 with a Name, 257 HTTP 404 (68-byte body). Every 200 had a Name. "SnowReport? no" means the feed has a Name and nothing else (no `SnowReport`, `MountainAreas` empty): `fetchReport` would throw, so unusable. Many resorts have a separate "<name> Summer" feed (ids 7-12, 50, 88-91, 95, 131, 174, 218, 275, 276); don't use those. Station key list is `BaseArea`, `MidMountainArea`, `SummitArea` for every feed with a SnowReport; the "stations with data" column shows which of them have a Name or values (others are `"--"`). Early season, so most snow numbers are 0.

Candidate resorts (details; sample station object `{Name, BaseIn, Last24HoursIn, Last48HoursIn, Last72HoursIn, Last7DaysIn, ...Cm}`):
| Candidate | id | Usable? | Stations / notes |
|---|---|---|---|
| Winter Park | 5 | yes | BaseArea "Village", MidMountainArea "Mid-Mountain", SummitArea "Summit"; 0/24 lifts, 0/171 trails; MountainAreas: Mary Jane, Eagle Wind, Parsenn Bowl, Terrain Park, The Cirque, Vasquez Ridge, Winter Park; last update 2026-10-07 |
| Steamboat | 6 | yes | Base, Mid-Mountain, "Storm Peak Summit"; 0/23 lifts, 0/184 trails; updated 2026-10-19 |
| Deer Valley | 49 | yes | Base, Mid-Mountain, Summit; 0/32 lifts, 0/209 trails; updated 2026-10-13. MountainAreas include lowercase-duplicate "BASE"/"MID-MOUNTAIN"/"SUMMIT" entries with no lifts |
| Solitude | 65 | partial | only MidMountainArea has data (BaseIn 1, 24h 1 in, season 13); lifts 0/9, trails 0/82; updated 2026-10-23 |
| Arapahoe Basin | 93 | partial | only MidMountainArea has data (base 0); 0/9 lifts, 0/147 trails; updated 2026-10-21; season total 5 |
| Crystal Mountain | 80 | stale | Base (37 in), Mid-Mountain (58), Summit (70), 0/11 lifts; **last update 2026-05-18** (will be fresh when it reopens) |
| Alta 63, Snowbird 64, Brighton 66, Snowbasin 132, Copper 55, Eldora 56, Aspen Highlands 51, Aspen Mountain 52, Buttermilk 53, Snowmass 54, Summit at Snoqualmie 79, Alpental 211, Mt Bachelor 96 | | no | name only, no SnowReport |
| Park City, Powder Mountain, Vail, Beaver Creek, Breckenridge, Keystone, Loveland, Telluride, Crested Butte, Wolf Creek, Stevens Pass, Mt. Baker, Timberline, Hood Meadows | none | | no feed with that name in 1..400 |

Full id -> name list (all 143 feeds):

| id | Name | SnowReport? | OperatingStatus | stations with data | lifts | trails | LastUpdate |
|---|---|---|---|---|---|---|---|
| 1 | Stratton | yes | Closed | Base=Base, MidMountain=Mid Mountain, Summit=Summit | 0/14 | 0/99 | 2026-04-12T19:21:02-0400 |
| 2 | Snowshoe | yes | Closed | Base=Snowshoe, MidMountain=Silver Creek, Summit=Summit | 0/13 | 0/61 | 2026-10-17T13:59:51-0400 |
| 3 | Blue | yes | Open | Base=Base, MidMountain=Mid, Summit=Summit | 11/11 | 38/43 | 2026-08-13T12:02:30-0400 |
| 4 | Tremblant | yes | Open | Base=Village, MidMountain=Mid, Summit=Summit | 0/15 | 0/103 | 2026-10-19T11:53:42-0400 |
| 5 | Winter Park | yes | Closed | Base=Village, MidMountain=Mid-Mountain, Summit=Summit | 0/24 | 0/171 | 2026-10-07T14:37:49-0600 |
| 6 | Steamboat | yes | Closed | Base=Base, MidMountain=Mid-Mountain, Summit=Storm Peak Summit | 0/23 | 0/184 | 2026-10-19T11:56:24-0600 |
| 7 | Stratton Summer | yes | Open | Base=Base, MidMountain=Mid-Mountain, Summit=Summit | 0/3 | 0/21 | 2026-10-19T09:14:50-0400 |
| 8 | Snowshoe Summer | yes | Closed | Base=Base, MidMountain=--, Summit=-- | 1/2 | 0/59 | 2026-10-17T13:54:37-0400 |
| 9 | Blue Summer | yes | high-uv | Base=Base, MidMountain=Mid, Summit=Summit | 1/1 | 31/40 | 2026-07-19T06:54:23-0400 |
| 10 | Tremblant Summer | yes | Open | Base=Village, MidMountain=Mid, Summit=Summit | 0/3 | 10/13 | 2026-10-18T10:39:54-0400 |
| 11 | Winter Park Summer | yes | Closed | Base=Winter Park Base, MidMountain=Mid-Mountain, Summit=Summit | 0/4 | 0/75 | 2024-09-18T14:12:58-0600 |
| 12 | Steamboat Summer | yes | Closed | Base=Base, MidMountain=Mid-Mountain, Summit=Summit | 0/2 | 20/40 | 2026-10-05T09:21:39-0600 |
| 49 | Deer Valley | yes | Closed | Base=Base, MidMountain=Mid-Mountain, Summit=Summit | 0/32 | 0/209 | 2026-10-13T12:58:30-0600 |
| 50 | Deer Valley Summer | yes | Closed | Base=Base | 0/3 | 53/58 | 2026-09-19T07:04:09-0600 |
| 51 | Aspen Highlands | no (name only) |  |  |  |  |  |
| 52 | Aspen Mountain | no (name only) |  |  |  |  |  |
| 53 | Buttermilk | no (name only) |  |  |  |  |  |
| 54 | Snowmass | no (name only) |  |  |  |  |  |
| 55 | Copper Mountain | no (name only) |  |  |  |  |  |
| 56 | Eldora | no (name only) |  |  |  |  |  |
| 57 | Bear Mountain | yes | Closed | Base=Bear Mountain , Summit=Summit | 0/7 | 0/26 | 2026-10-07T13:50:22-0700 |
| 58 | Snow Summit | yes | Closed | Base=Snow Summit, Summit=Summit | 0/11 | 0/31 | 2026-05-04T10:16:22-0700 |
| 59 | June Mountain | yes | Closed | Base=The Chalet | 0/7 | 0/42 | 2026-10-23T08:50:49-0700 |
| 60 | Mammoth Mountain | yes | Closed | Base=Main Lodge, MidMountain=McCoy Station, Summit=The Summit | 0/25 | 0/181 | 2026-10-23T08:37:14-0700 |
| 61 | Palisades Tahoe | yes | Open | Base=Palisades Base, el. 6200', MidMountain=Palisades Mid-Mountain, el. 8000', Summit=Palisades Siberia Crest, el. 8700' | 0/39 | 0/296 | 2026-06-08T10:02:25-0700 |
| 62 | Palisades Tahoe - Alpine Meadows Legacy | no (name only) |  |  |  |  |  |
| 63 | Alta | no (name only) |  |  |  |  |  |
| 64 | Snowbird | no (name only) |  |  |  |  |  |
| 65 | Solitude | yes | Closed | MidMountain=Mid-Mountain | 0/9 | 0/82 | 2026-10-23T08:54:30-0600 |
| 66 | Brighton | no (name only) |  |  |  |  |  |
| 67 | Jackson Hole | no (name only) |  |  |  |  |  |
| 68 | Big Sky | no (name only) |  |  |  |  |  |
| 69 | Killington | no (name only) |  |  |  |  |  |
| 70 | Sugarbush | yes | Open | Base=Base, MidMountain=Mid-Mountain, Summit=Summit | 0/16 | 0/111 | 2026-10-22T08:00:19-0400 |
| 71 | Loon Mountain | no (name only) |  |  |  |  |  |
| 72 | Sugarloaf | no (name only) |  |  |  |  |  |
| 73 | Sunday River | no (name only) |  |  |  |  |  |
| 74 | Lake Louise | no (name only) |  |  |  |  |  |
| 75 | Mt Norquay | no (name only) |  |  |  |  |  |
| 76 | Sunshine Village | no (name only) |  |  |  |  |  |
| 77 | Revelstoke | no (name only) |  |  |  |  |  |
| 78 | Taos | no (name only) |  |  |  |  |  |
| 79 | Summit at Snoqualmie | no (name only) |  |  |  |  |  |
| 80 | Crystal Mountain | yes | Open | Base=Base, MidMountain=Mid-Mountain, Summit=Summit | 0/11 | 0/85 | 2026-05-18T12:41:48-0700 |
| 81 | Cypress Mountain | no (name only) |  |  |  |  |  |
| 82 | Boyne Highlands | no (name only) |  |  |  |  |  |
| 83 | Boyne Mountain | no (name only) |  |  |  |  |  |
| 84 | Niseko Annupuri | no (name only) |  |  |  |  |  |
| 85 | Niseko Grand Hirafu | no (name only) |  |  |  |  |  |
| 86 | Niseko Hanazano | no (name only) |  |  |  |  |  |
| 87 | Niseko Village | no (name only) |  |  |  |  |  |
| 88 | Bear Mountain Summer | yes | Open | Base=Bear Mountain, MidMountain=Mid, Summit=Summit | 0/0 | 0/0 | 2026-10-23T11:01:02-0700 |
| 89 | Snow Summit Summer | yes | Closed | Base=Snow Summit, MidMountain=Mid, Summit=Summit | 0/3 | 0/19 | 2026-10-19T15:31:48-0700 |
| 90 | Mammoth Mountain Summer | yes | Closed | Base=Main Lodge, MidMountain=McCoy Station, Summit=The Summit | 0/5 | 0/52 | 2026-10-15T08:57:38-0700 |
| 91 | June Mountain Summer | no (name only) |  |  |  |  |  |
| 93 | Arapahoe Basin | yes | Closed | MidMountain=Mid-Mountain | 0/9 | 0/147 | 2026-10-21T08:20:05-0600 |
| 94 | Pico Mountain | no (name only) |  |  |  |  |  |
| 95 | Solitude Summer | yes | Closed | MidMountain=Mid-Mountain | 0/3 | 0/14 | 2026-10-07T14:58:23-0600 |
| 96 | Mt Bachelor | no (name only) |  |  |  |  |  |
| 97 | Windham Mountain | no (name only) |  |  |  |  |  |
| 98 | RED Mountain | no (name only) |  |  |  |  |  |
| 131 | Sugarbush Summer | yes | Open | Base=Base | 0/0 | 0/0 | 2026-05-21T07:49:27-0600 |
| 132 | Snowbasin Resort | no (name only) |  |  |  |  |  |
| 134 | Chamonix | no (name only) |  |  |  |  |  |
| 135 | Tamarack Cross Country Ski Center | yes | Closed | Base=-- | 0/0 | 6/28 | 2025-03-13T09:23:21-0700 |
| 168 | Schweitzer | yes | Closed | Base=Village, Summit=Summit | 0/10 | 0/92 | 2026-10-12T15:05:38-0700 |
| 169 | Lotte Arai | no (name only) |  |  |  |  |  |
| 170 | Panorama Mountain Resort | no (name only) |  |  |  |  |  |
| 171 | Sun Peaks | no (name only) |  |  |  |  |  |
| 172 | Grandvilara | no (name only) |  |  |  |  |  |
| 173 | Snow Valley | yes | Closed | Base=Snow Valley, Summit=Summit | 1/10 | 0/32 | 2026-03-31T20:07:43-0700 |
| 174 | Snow Valley Summer | yes | Open | Base=Snow Valley | 1/1 | 6/10 | 2026-10-23T12:54:39-0700 |
| 175 | Alyeska | no (name only) |  |  |  |  |  |
| 176 | Blue Mountain (PA) | no (name only) |  |  |  |  |  |
| 177 | Camelback | no (name only) |  |  |  |  |  |
| 178 | Mt Bueller | no (name only) |  |  |  |  |  |
| 179 | Coronet Peak | no (name only) |  |  |  |  |  |
| 180 | The Remarkables | no (name only) |  |  |  |  |  |
| 181 | Mt Hutt | no (name only) |  |  |  |  |  |
| 182 | Thredbo | no (name only) |  |  |  |  |  |
| 183 | Valle Nevado | no (name only) |  |  |  |  |  |
| 185 | Cortina d'Ampezzo | no (name only) |  |  |  |  |  |
| 186 | Kronplatz/Plan de Corones | no (name only) |  |  |  |  |  |
| 187 | Alta Badia | no (name only) |  |  |  |  |  |
| 188 | Val Gardena/Alpe de Siusi | no (name only) |  |  |  |  |  |
| 190 | Val di Fassa/Carezza | no (name only) |  |  |  |  |  |
| 193 | Arabba/Marmolada | no (name only) |  |  |  |  |  |
| 195 | 3 Peaks Dolomites | no (name only) |  |  |  |  |  |
| 196 | Val di Fiemme/Obereggen | no (name only) |  |  |  |  |  |
| 198 | San Martino di Castrozza/Rolle Pass | no (name only) |  |  |  |  |  |
| 202 | Civetta | no (name only) |  |  |  |  |  |
| 206 | Kitzbühel | no (name only) |  |  |  |  |  |
| 208 | St Moritz | no (name only) |  |  |  |  |  |
| 211 | Alpental | no (name only) |  |  |  |  |  |
| 212 | Zermatt Matterhorn | no (name only) |  |  |  |  |  |
| 213 | Rio Pusteria - Bressanone | no (name only) |  |  |  |  |  |
| 214 | Alpe Lusia - San Pellegrino | no (name only) |  |  |  |  |  |
| 215 | Sierra at Tahoe | no (name only) |  |  |  |  |  |
| 216 | Ischgl | no (name only) |  |  |  |  |  |
| 217 | Le Massif | no (name only) |  |  |  |  |  |
| 218 | Schweitzer Summer | yes | Closed | Base=Village | 0/1 | 0/40 | 2026-09-07T16:57:08-0700 |
| 219 | Mt. T | no (name only) |  |  |  |  |  |
| 221 | Nekoma | no (name only) |  |  |  |  |  |
| 222 | Yunding Snow Park | no (name only) |  |  |  |  |  |
| 223 | Cervino Ski Paradise | no (name only) |  |  |  |  |  |
| 224 | Courmayeur Mont Blanc | no (name only) |  |  |  |  |  |
| 225 | Espace San Bernardo | no (name only) |  |  |  |  |  |
| 226 | Monterosa Ski | no (name only) |  |  |  |  |  |
| 227 | Pila | no (name only) |  |  |  |  |  |
| 241 | Yakebitaiyama Ski Area | no (name only) |  |  |  |  |  |
| 242 | Okushiga Kogen Ski Area | no (name only) |  |  |  |  |  |
| 243 | Kumanoyu Ski Area | no (name only) |  |  |  |  |  |
| 244 | Yokoteyama Ski Area | no (name only) |  |  |  |  |  |
| 248 | Sun Valley | no (name only) |  |  |  |  |  |
| 249 | Megeve | no (name only) |  |  |  |  |  |
| 250 | Mona Yongpyong | no (name only) |  |  |  |  |  |
| 251 | Furano Ski Resort | no (name only) |  |  |  |  |  |
| 252 | Appi Kogen Resort | no (name only) |  |  |  |  |  |
| 253 | Zao Onsen Ski Resort | no (name only) |  |  |  |  |  |
| 254 | Sun Valley Ski Area | no (name only) |  |  |  |  |  |
| 255 | Maruike Ski Area | no (name only) |  |  |  |  |  |
| 256 | Hasuike Ski Area | no (name only) |  |  |  |  |  |
| 257 | Giant Ski Area | no (name only) |  |  |  |  |  |
| 258 | Nishidateyama Ski Area | no (name only) |  |  |  |  |  |
| 259 | Higashidateyama Ski Area | no (name only) |  |  |  |  |  |
| 260 | Hoppo Bunadaira Ski Area | no (name only) |  |  |  |  |  |
| 261 | Terakoya Ski Area | no (name only) |  |  |  |  |  |
| 262 | Takamagahara Mommoth Ski Area | no (name only) |  |  |  |  |  |
| 264 | Tannenomori Okojo Ski Area | no (name only) |  |  |  |  |  |
| 265 | Ichinose Family Ski Area | no (name only) |  |  |  |  |  |
| 266 | Ichinose Diamond Ski Area | no (name only) |  |  |  |  |  |
| 267 | Ichinose Yamanokami Ski Area | no (name only) |  |  |  |  |  |
| 269 | Shibutoge Ski Area | no (name only) |  |  |  |  |  |
| 270 | Myoko Suginohara | no (name only) |  |  |  |  |  |
| 271 | Lusten | no (name only) |  |  |  |  |  |
| 272 | SnowRiver | no (name only) |  |  |  |  |  |
| 273 | Granite Peak | no (name only) |  |  |  |  |  |
| 274 | Silverstar | no (name only) |  |  |  |  |  |
| 275 | Palisades Tahoe Summer | yes | Closed | Base=The Village | 0/1 | 0/0 | 2026-09-08T09:50:24-0700 |
| 276 | Crystal Mountain Summer | yes | Open  | Base=Base, Summit=Summit | 0/1 | 0/0 | 2026-09-20T18:14:28-0700 |
| 309 | Beidahu Ski Resort | no (name only) |  |  |  |  |  |
| 310 | Madarao | no (name only) |  |  |  |  |  |
| 311 | Lake Songhua | no (name only) |  |  |  |  |  |

### 3. NWS offices

`https://api.weather.gov/points/<lat>,<lon>` at each base point gave `cwa` and grid (table in section 5). Latest AFD per office (`/products/types/AFD/locations/<OFFICE>`, then the first product):
| Office | Product URL | Issued |
|---|---|---|
| SLC | https://api.weather.gov/products/f3a918aa-7ef9-48db-b02a-ac50980f7fd7 | 2026-10-23 19:01Z |
| GJT | https://api.weather.gov/products/1f428405-b494-43da-a204-9b52a995dcd5 | 2026-10-23 20:04Z |
| BOU | https://api.weather.gov/products/67e1d5ec-5508-4cb8-8ea1-7a4fd2e57d0f | 2026-10-23 19:38Z |
| PUB | https://api.weather.gov/products/2ca50232-016f-4c41-82d7-e2efda20392f | 2026-10-23 19:17Z |
| SEW | https://api.weather.gov/products/159c8a8c-0d7f-4957-949d-224870875424 | 2026-10-23 20:16Z |
| PDT | https://api.weather.gov/products/a905c564-560b-48cc-99cc-47984b7a609a | 2026-10-23 21:51Z |
| PQR | https://api.weather.gov/products/e102528b-571e-4099-b6e8-0a52eaa76494 | 2026-10-23 21:15Z |

Area vocabulary. Caveat: it is late October, so these AFDs are mostly about plains, valleys, floods and frost, with few mountain-specific passages. Phrases below are from today's AFD plus the 10 most recent AFDs per office (counts from `scratchpad/vocab.mjs`, 2026-10-19..23). Winter-season vocabulary is unverified; re-check in January.
- **SLC** (Utah, SW Wyoming): "northern Utah", "southwest Wyoming", "southern and eastern Utah", "southeast Utah", "Great Basin", "Great Salt Lake", "Desert Southwest", "the Wasatch" (5 of 10), "Uintas / Uinta Mountains" (3), "Boulder Mountain", "Cottonwood" (1). Mountain-specific prose is sparse; ski-area text will mostly sit under "northern Utah" / "Wasatch". Unlikely keywords to ignore: "southern Utah", "Moab", "Great Basin".
- **GJT** (W Colorado + E Utah): "San Juans" / "San Juan mountains" (22+15), "southern San Juan", "southeast Utah", "southwest Colorado", "south central Colorado", "highway 160 corridor", "along and south of I-70", "the mountains", "valleys". Flood-heavy text now. Elk/Gore/Flat Tops/Sawatch terms did not appear (unverified for winter).
- **BOU** (N Colorado, Front Range): "the plains", "eastern plains", "northern plains", "Denver metro", "I-25 corridor", "Lincoln county", "high country", "mountains" (10 of 10), "Front Range" (4), "Mosquito Range", "Palmer Divide". To keep only mountain text, ignore "plains", "Denver", "I-25", "Palmer Divide".
- **PUB** (S Colorado): "Continental Divide" (24), "San Juans / San Juan Mountains / San Juan Mtns / San Juan Range" (18/14/10/4), "San Luis Valley" (6), "Sangres" (3), "Southern Mtns" / "Southwest Mtns" (2 each), "central mountains", "northern Sangres", "Pikes Peak region", "Monument Hill", "I-25 corridor", "eastern plains". Wolf Creek is in PUB's San Juan Mountains text. Note the abbreviation "Mtns".
- **SEW** (W Washington): "the Cascades" (5), "Cascades and adjacent foothills", "Puget Sound", "Olympic Peninsula", "windward slopes of the Olympics", "mountain snow" (hazards outlook), "Snoqualmie" (1). Today's text says nothing about passes by name; winter text likely names "Snoqualmie Pass", "Stevens Pass", "Mt. Baker Ski Area" (unverified).
- **PDT** (E Oregon/E Washington, Bend and Mt Bachelor): "Blue Mountains" (15), "Columbia River Gorge", "Columbia Basin", "Yakima Valley", "Ochoco-John Day Highlands", "Washington Cascades", "Oregon Cascades", "Eastern Mountains", "Foothills". Central Oregon / Bend prose will sit under "Oregon Cascades" / "Cascades"; ignore "Blue Mountains", "Gorge", "Basin".
- **PQR** (NW Oregon, SW Washington): "Cascades" (17), "Cascades and foothills", "Cascade Foothills", "Oregon Cascades", "SW WA Cascades", "Coast Range" (13), "Columbia River Gorge", "Upper Hood River Valley", "Mt. Hood" (2), "I-5 corridor", "Willamette Valley". Ignore "Coast Range", "I-5", "coast".

NWS gridpoint elevation vs base (the Dodge Ridge-style gotcha; `nwsGridFt` from `/gridpoints/<office>/<x>,<y>` `properties.elevation`): see table in section 5. Cells are mostly higher than the base; far above for Deer Valley and Powder Mountain (my base points are suspect), and below the summit everywhere.

### 4. Coordinates and elevations (source and confidence)
- Base lat/lon: base-village / main-lodge coordinates written from memory, with Wikipedia's coordinate for some (Deer Valley 40.6228,-111.4894; Winter Park; Solitude; Wolf Creek) as a cross-check (https://en.wikipedia.org/w/api.php?action=query&prop=coordinates ... , 29 titles, 7 had no coordinate). Wikipedia's coordinates are inconsistent (some are a lodge, some a peak), so not used as primary.
- baseFt / summitFt: resort-published figures as I remember them (alta.com, snowbird.com, vail.com etc.), NOT re-checked on resort sites this session. Treat as **unverified**; the owner should confirm against each resort's mountain-stats page.
- Check I did run: Open-Meteo DEM elevation at each point (`https://api.open-meteo.com/v1/elevation?latitude=...&longitude=...`, 90 m DEM). Base points within ~300 ft of stated baseFt for most. Exceptions (point or figure suspect): **Deer Valley** (DEM 8,140 vs 6,570: my point is up the hill), **Powder Mountain** (8,248 vs 6,900; resort has several bases), **Mt. Bachelor** (6,558 vs 5,700 base; West Village is ~6,300), **Mt. Baker** (3,907 vs 3,500), **Hood Meadows** (5,367 vs 4,600), **Snowbird** (8,163 vs 7,760), **Telluride/Aspen** fine.
- Summit points: the DEM smooths peaks, but several of mine read far below summitFt (Crested Butte 8,881 vs 12,162, Stevens 4,281 vs 5,845, Breckenridge 9,990 vs 12,998, Baker 4,196, Timberline 6,417 vs 8,540): the summit lat/lon are **wrong guesses** for those and must be re-picked (DEM search or resort trail map) before going into resorts.json. They only mattered here for the avalanche zone check, where base results are the ones to trust.
- Raw numbers: `scratchpad/geo-out.json` (base/summit lat/lon, DEM feet, cwa, grid, forecast zone, county, nwsGridFt).

### 5. Per-resort table
`NWS grid` = `<office> x,y` and gridFt (NWS cell elevation). Avalanche column: `center zone-id name` (CAIC rows use the `/avid` API with area lookup by point; zone name unknown).

| Resort | State | NWS office (grid, gridFt) | Avalanche center/zone | MtnPowder id | Notes |
|---|---|---|---|---|---|
| Alta | UT | SLC (108,167; 9,800) | UAC 1738 Salt Lake | none usable (63, name only) | base 8,530 / summit 10,550 (unverified); expired Sep forecast, no danger |
| Snowbird | UT | SLC (107,166; 9,298) | UAC 1738 Salt Lake | none usable (64, name only) | base 7,760 / 11,000 (unverified) |
| Brighton | UT | SLC (110,167; 8,757) | UAC 1738 Salt Lake | none usable (66, name only) | base 8,755 / 10,500 |
| Solitude | UT | SLC (110,168; 8,832) | UAC 1738 Salt Lake | 65: MidMountainArea only | report live 2026-10-23, lifts 0/9 |
| Park City | UT | SLC (113,169; 6,919) | UAC 1738 Salt Lake (nearest, point 1.6 km outside) | none | Vail resort, no feed; opening date needed |
| Deer Valley | UT | SLC (113,167; 8,796) | UAC 1738 Salt Lake (nearest, outside) | 49: Base/Mid/Summit | base point wrong (DEM 8,140 vs 6,570), NWS cell 8,796 ft |
| Snowbasin | UT | SLC (104,196; 6,352) | UAC 1737 Ogden | none usable (132, name only) | summit point guessed |
| Powder Mountain | UT | SLC (108,203; 8,488) | UAC 1737 Ogden | none | multiple bases, base point DEM 8,248 |
| Vail | CO | GJT (174,121; 8,950) | CAIC statewide area a141d5b6 (zone name unverified) | none | Vail resort, opening-date status |
| Beaver Creek | CO | GJT (168,120; 8,314) | CAIC area a141d5b6 | none | Vail resort |
| Breckenridge | CO | BOU (26,53; 9,797) | CAIC area a141d5b6 | none | Vail resort; summit point wrong (DEM 9,990 vs 12,998) |
| Keystone | CO | BOU (29,58; 9,396) | CAIC area a141d5b6 | none | Vail resort |
| Arapahoe Basin | CO | BOU (32,59; 11,880) | CAIC area a141d5b6 | 93: MidMountainArea only | report 2026-10-21, 0/9 lifts |
| Copper Mountain | CO | BOU (22,54; 9,800) | CAIC area a141d5b6 | none usable (55, name only) | |
| Loveland | CO | BOU (31,61; 11,677) | CAIC area a141d5b6 | none | |
| Winter Park | CO | BOU (37,70; 9,396) | CAIC area a141d5b6 | 5: Base(Village)/Mid/Summit | areas Winter Park + Mary Jane etc. (single resort, no split needed) |
| Steamboat | CO | GJT (162,159; 7,323) | CAIC area (point 0-2 km outside polygons; Park Range zone expected, unverified) | 6: Base/Mid/"Storm Peak Summit" | |
| Aspen Snowmass | CO | GJT (152,103; 8,652) | CAIC area a141d5b6 | none usable (51, 52, 53, 54 name only) | four mountains; only Snowmass base point checked |
| Telluride | CO | GJT (116,49; 9,393) | CAIC area a141d5b6 | none | independent; summit point guessed |
| Crested Butte | CO | GJT (150,89; 9,531) | CAIC area a141d5b6 | none | summit point wrong (DEM 8,881) |
| Wolf Creek | CO | PUB (15,36; 10,843) | CAIC area a141d5b6 | none | PUB talks about San Juans / Continental Divide |
| Eldora | CO | BOU (43,72; 9,521) | CAIC area a141d5b6 | none usable (56, name only) | |
| Crystal Mountain | WA | SEW (145,31; 5,233) | NWAC 3023 West Slopes South | 80: Base/Mid/Summit (stale, 2026-05-18) | |
| Stevens Pass | WA | SEW (165,67; 4,879) | NWAC 3024 Stevens Pass | none | Vail resort; summit point wrong |
| Mt. Baker | WA | SEW (157,122; 5,115) | NWAC 3021 West Slopes North | none | base point DEM 3,907 vs 3,500 |
| Summit at Snoqualmie | WA | SEW (152,54; 3,087) | NWAC 3028 Snoqualmie Pass | none usable (79 Summit at Snoqualmie, 211 Alpental: name only) | |
| Mt. Bachelor | OR | PDT (22,38; 6,243) | COAA 2470 Central Cascades (season over, summary expired 2026-07-16) | none usable (96, name only) | PDT, not PQR |
| Timberline | OR | PQR (142,89; 6,339) | NWAC 3032 Mt Hood | none | baseFt set to 5,970 (lodge); lowest lift lower |
| Mt. Hood Meadows | OR | PQR (144,88; 5,003) | NWAC 3032 Mt Hood | none | |

---

