// JSON contract between the pipeline, the analysis step and the PWA.
// Units are imperial everywhere: inches, °F, feet, mph. Times are ISO strings.

export type Elev = 'summit' | 'base';
export const ELEVS: Elev[] = ['summit', 'base'];

/** `aifs` is ECMWF's AI model; `nws` is the NWS forecasters' own (hand-edited) gridded forecast. */
export type ModelId = 'gfs' | 'ecmwf' | 'icon' | 'gem' | 'aifs' | 'hrrr' | 'nam' | 'nbm' | 'nws';

export type WeatherIcon = 'clear' | 'partly' | 'cloudy' | 'snow' | 'rain' | 'mix';

/** Snow quality from the snow-to-liquid ratio: higher ratio = lighter, drier snow. */
export type SnowQuality = 'excellent' | 'good' | 'okay';

export interface SourceStatus {
  /** Fetched successfully on this run. */
  ok: boolean;
  /** `data` was carried forward from an earlier run because this run's fetch failed. */
  stale: boolean;
  /** When `data` was fetched. */
  fetchedAt: string | null;
  error?: string;
}

export interface Sourced<T> {
  status: SourceStatus;
  data: T | null;
}

export interface Range {
  lo: number;
  hi: number;
}

/** A snow amount for one window at one elevation, in inches. */
export interface SnowAmount {
  /** Mean of the deterministic models, leaning on the ensemble mean beyond 72h. */
  blend: number | null;
  /** Display range: ensemble P25–P75 when available, else deterministic min–max; always contains `blend`. */
  range: Range | null;
  rangeSource: 'ensemble' | 'models' | null;
  /** Ensemble tails (P10/P90), when the ensembles cover the window. */
  p10: number | null;
  p90: number | null;
  /** Per-model totals using our temperature-based snow ratio. */
  models: Partial<Record<ModelId, number>>;
  /** Open-Meteo's own fixed-ratio snowfall, blended, for comparison. */
  rawBlend: number | null;
}

export type Confidence = 'high' | 'medium' | 'low';

export interface Period {
  kind: 'day' | 'night';
  /** Local date the period starts on (YYYY-MM-DD). */
  date: string;
  /** Local wall-clock start/end, e.g. 2026-10-23T05:00. */
  start: string;
  end: string;
  label: string;
  snow: Record<Elev, SnowAmount>;
  /** Blend liquid precipitation at the summit, inches. */
  precipIn: number | null;
  tempF: Record<Elev, { min: number | null; max: number | null }>;
  freezingLevelFt: number | null;
  snowLevelFt: number | null;
  windMph: number | null;
  gustMph: number | null;
  /** Prevailing wind direction, degrees (meteorological: where it blows from). */
  windDir: number | null;
  /** Highest hourly chance of precipitation in the period, percent. */
  popPct: number | null;
  cloudPct: number | null;
  icon: WeatherIcon;
  /** Snow-to-liquid ratio (e.g. 12 for 12:1) when there's enough snow to say. */
  slr: Record<Elev, number | null>;
  quality: Record<Elev, SnowQuality | null>;
  /** Precipitation expected with the snow level above the base. */
  rainAtBase: boolean;
}

/** The next 72 hours, hour by hour (blend), for the hourly table. Stamps are hour-ending. */
export interface HourlyData {
  time: string[];
  tempF: Record<Elev, (number | null)[]>;
  snowIn: Record<Elev, (number | null)[]>;
  precipIn: (number | null)[];
  slr: (number | null)[];
  popPct: (number | null)[];
  snowLevelFt: (number | null)[];
  windMph: (number | null)[];
  gustMph: (number | null)[];
  windDir: (number | null)[];
  cloudPct: (number | null)[];
  icon: WeatherIcon[];
}

/** A per-resort correction learned from forecast-vs-observed history. */
export interface ModelCalibration {
  /** Multiplier applied to the model's snow (1 = unchanged). */
  factor: number;
  /** Snow events it was learned from. */
  events: number;
}

export interface DaySummary {
  date: string;
  label: string;
  snow: Record<Elev, SnowAmount>;
  confidence: Confidence | null;
  tempF: Record<Elev, { min: number | null; max: number | null }>;
  snowLevelFt: { min: number | null; max: number | null };
  gustMph: number | null;
}

export interface ModelInfo {
  id: ModelId;
  label: string;
  /** Hours of forecast this model provided. */
  hours: number;
}

export interface EnsembleInfo {
  id: string;
  label: string;
  members: number;
  hours: number;
}

export interface ForecastData {
  /** First period start (local). */
  startsAt: string;
  /** "Now" for the windows (local, top of the hour). */
  windowsFrom: string;
  models: ModelInfo[];
  ensembles: EnsembleInfo[];
  periods: Period[];
  days: DaySummary[];
  hourly: HourlyData;
  /** Elevations of the NWS forecasters' grid cells, when that forecast is included. */
  nwsGridFt: Record<Elev, number | null> | null;
  /** Local-model corrections applied to this resort's blend, by model. */
  calibration: Partial<Record<ModelId, ModelCalibration>>;
  /** Running total from the first period through the end of each day (the model "plume"). */
  cumulative: ({ date: string } & Record<Elev, SnowAmount>)[];
  windows: {
    next24h: Record<Elev, SnowAmount>;
    next72h: Record<Elev, SnowAmount>;
    next7d: Record<Elev, SnowAmount>;
  };
  buckets: {
    d1_5: Record<Elev, SnowAmount>;
    d6_10: Record<Elev, SnowAmount>;
    d11_16: Record<Elev, SnowAmount>;
  };
}

export type CpcCategory = 'above' | 'below' | 'normal' | 'ec';

export interface CpcCat {
  cat: CpcCategory;
  /** Probability of the favored category, percent. Null for equal chances. */
  prob: number | null;
}

export interface CpcOutlook {
  key: '6-10' | '8-14' | 'wk34' | 'month' | 'season1' | 'season2' | 'season3';
  label: string;
  /** Human valid period, e.g. "Oct 29–Nov 2" or "NDJ 2026-2027". */
  valid: string | null;
  temp: CpcCat | null;
  precip: CpcCat | null;
  /** Labeled low-confidence in the UI. */
  lowConfidence: boolean;
}

export interface EnsoStatus {
  status: string;
  synopsis: string;
  issued: string | null;
}

export interface CpcData {
  outlooks: CpcOutlook[];
  enso: EnsoStatus | null;
}

export interface SnowpackChange {
  depthIn: number | null;
  sweIn: number | null;
}

export interface SnowpackData {
  station: {
    id: string;
    name: string;
    network: 'SNOTEL' | 'CDEC' | 'CoCoRaHS';
    elevFt: number | null;
    url: string;
  };
  observedAt: string | null;
  depthIn: number | null;
  sweIn: number | null;
  tempF: number | null;
  change: { h24: SnowpackChange; h48: SnowpackChange; d7: SnowpackChange };
  /** Observer-reported new snow (CoCoRaHS only). */
  newSnow: { h24: number | null; h48: number | null; d7: number | null } | null;
  /** Daily values, oldest first, ~30 days. `newIn` is observer-measured new snow (CoCoRaHS only). */
  series: { date: string; depthIn: number | null; sweIn: number | null; newIn?: number | null }[];
  note: string | null;
}

export interface NwsPeriod {
  name: string;
  startTime: string;
  isDaytime: boolean;
  temperature: number | null;
  shortForecast: string;
  detailedForecast: string;
}

export interface NwsData {
  updatedAt: string | null;
  url: string;
  periods: NwsPeriod[];
}

export interface Alert {
  id: string;
  event: string;
  headline: string;
  severity: string;
  onset: string | null;
  ends: string | null;
  description: string;
  url: string;
  /** Winter/wind products that matter for skiing. */
  winter: boolean;
}

export interface AfdData {
  office: string;
  issuedAt: string;
  url: string;
  keyMessages: string | null;
  discussion: string | null;
}

export interface AvalancheDanger {
  /** 0 = no rating, 1 low … 5 extreme; −1 = not issued. */
  upper: number;
  middle: number;
  lower: number;
}

export interface AvalancheData {
  center: string;
  zoneName: string;
  url: string;
  productType: string;
  publishedAt: string | null;
  expiresAt: string | null;
  current: AvalancheDanger | null;
  tomorrow: AvalancheDanger | null;
  /** Highest current rating across elevation bands, −1 if none. */
  overall: number;
  overallText: string;
  bottomLine: string | null;
  /** The avalanche forecasters' weather/hazard discussion (local experts), trimmed. */
  discussion: string | null;
  problems: string[];
}

export type RoadStatus = 'clear' | 'R-1' | 'R-2' | 'R-3' | 'closed' | 'unknown';

export interface RoadSegment {
  label: string;
  route: string;
  status: RoadStatus;
  /** Chain-control stations matched to this segment. */
  stations: number;
  worst: { name: string; status: string; description: string; since: string | null } | null;
  closures: { description: string; start: string | null; end: string | null }[];
  /** Caltrans highway-conditions statements relevant to this segment. */
  notes: string[];
}

export interface RoadsData {
  segments: RoadSegment[];
  worst: RoadStatus;
  textAsOf: string | null;
}

export interface ReportArea {
  name: string;
  baseDepthIn: number | null;
  h24: number | null;
  h48: number | null;
  h72: number | null;
  d7: number | null;
}

export interface ReportData {
  name: string;
  updatedAt: string | null;
  /** Updated within the last 36h. */
  fresh: boolean;
  operatingStatus: string | null;
  conditions: string | null;
  areas: ReportArea[];
  /** Best single "new snow" numbers (summit area, else first area with data). */
  h24: number | null;
  h48: number | null;
  d7: number | null;
  baseDepthIn: number | null;
  seasonTotalIn: number | null;
  liftsOpen: number | null;
  liftsTotal: number | null;
  trailsOpen: number | null;
  trailsTotal: number | null;
}

export interface Link {
  label: string;
  url: string;
}

/** The latest post from a local human forecaster (e.g. the Mammoth Snowman). */
export interface ExpertPost {
  source: string;
  author: string | null;
  title: string;
  url: string;
  publishedAt: string | null;
  /** A short excerpt for the card; the full text only goes to the writer. */
  excerpt: string;
  text: string;
}

export interface ResortAnalysis {
  generatedAt: string;
  model: string;
  headline: string;
  /** 2–3 sentence overview (older analyses may not have it). */
  summary?: string;
  next5Days: string;
  extended6to16: string;
  modelAgreement: { summary: string; confidence: Confidence };
  whatToWatch: string;
  /** Numbers in the text that weren't found in the input data (should be empty). */
  ungrounded: string[];
  fingerprint: string;
}

export interface ResortData {
  id: string;
  name: string;
  shortName: string;
  region: string;
  /** Starred on a phone that hasn't picked its own favorites yet. */
  defaultFavorite: boolean;
  tz: string;
  lat: number;
  lon: number;
  baseFt: number;
  summitFt: number;
  /** The part of the NWS office's region this resort is in. */
  nwsArea: string;
  generatedAt: string;
  forecast: Sourced<ForecastData>;
  cpc: Sourced<CpcData>;
  snowpack: Sourced<SnowpackData> | null;
  nws: Sourced<NwsData>;
  alerts: Sourced<Alert[]>;
  afd: Sourced<AfdData>;
  avalanche: Sourced<AvalancheData> | null;
  roads: Sourced<RoadsData> | null;
  report: Sourced<ReportData> | null;
  /** A local human forecaster's latest post, for resorts that have one configured. */
  expert?: Sourced<ExpertPost> | null;
  /** Hand-written local knowledge for this mountain (from resorts.json). */
  localNotes?: string[];
  /** Scheduled opening day, YYYY-MM-DD. */
  openingDate?: string;
  links: {
    website: string | null;
    webcams: string | null;
    cams: Link[];
    radar: string | null;
    roadCams: Link[];
    /** The resort's snow-report page, and a road-conditions page where Caltrans doesn't reach. */
    report?: string | null;
    roads?: string | null;
  };
  analysis: ResortAnalysis | null;
}

export type SourceKey = 'forecast' | 'cpc' | 'snowpack' | 'nws' | 'alerts' | 'afd' | 'avalanche' | 'roads' | 'report' | 'expert';

export type OpenState = 'open' | 'not-open' | 'closed' | 'unknown';

export interface ResortStatus {
  state: OpenState;
  text: string;
}

/** Snow in the last 24h: the resort's report when current, otherwise a station estimate. */
export interface Last24 {
  inches: number | null;
  source: 'reported' | 'estimated' | null;
  at: string | null;
}

export interface ResortSummary {
  id: string;
  name: string;
  shortName: string;
  region: string;
  defaultFavorite: boolean;
  baseFt: number;
  summitFt: number;
  status: ResortStatus;
  last24: Last24;
  windows: ForecastData['windows'] | null;
  buckets: Pick<ForecastData['buckets'], 'd1_5' | 'd6_10'> | null;
  /** Daily (5am-5am) blend for the first 10 days, both elevations. */
  days: { date: string; summit: number | null; base: number | null }[];
  reported: { h24: number | null; updatedAt: string | null; fresh: boolean } | null;
  alerts: { event: string; headline: string; winter: boolean }[];
  avalanche: { overall: number; text: string } | null;
  roads: RoadStatus | null;
  headline: string | null;
  staleSources: SourceKey[];
}

export interface RankingEntry {
  resortId: string;
  day: string;
  reason: string;
}

export interface Ranking {
  generatedAt: string;
  model: string;
  bestDay: string;
  bestResort: string;
  summary: string;
  entries: RankingEntry[];
  ungrounded: string[];
}

export interface UsageRun {
  at: string;
  model: string;
  calls: number;
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface DataIndex {
  generatedAt: string;
  /** The commit whose pipeline built this data (GITHUB_SHA), so an app-only push can tell what changed since. */
  builtFrom?: string | null;
  resorts: ResortSummary[];
  enso: EnsoStatus | null;
  ranking: Ranking | null;
  usage: { lastRun: UsageRun | null; monthToDateUsd: number } | null;
  sources: Record<string, Partial<Record<SourceKey, SourceStatus>>>;
}
