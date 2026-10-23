// JSON contract between the pipeline, the analysis step and the PWA.
// Units are imperial everywhere: inches, °F, feet, mph. Times are ISO strings.

export type Elev = 'summit' | 'base';
export const ELEVS: Elev[] = ['summit', 'base'];

export type ModelId = 'gfs' | 'ecmwf' | 'icon' | 'gem' | 'hrrr' | 'nbm';

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
  /** Precipitation expected with the snow level above the base. */
  rainAtBase: boolean;
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
  /** Daily values, oldest first, ~30 days. */
  series: { date: string; depthIn: number | null; sweIn: number | null }[];
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

export interface ResortAnalysis {
  generatedAt: string;
  model: string;
  headline: string;
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
  links: { website: string | null; webcams: string | null; cams: Link[]; radar: string | null; roadCams: Link[] };
  analysis: ResortAnalysis | null;
}

export type SourceKey = 'forecast' | 'cpc' | 'snowpack' | 'nws' | 'alerts' | 'afd' | 'avalanche' | 'roads' | 'report';

export interface ResortSummary {
  id: string;
  name: string;
  shortName: string;
  region: string;
  baseFt: number;
  summitFt: number;
  windows: ForecastData['windows'] | null;
  /** Summit blend per day/night period for the first 10 days. */
  strip: { date: string; kind: 'day' | 'night'; label: string; snowIn: number | null }[];
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
  resorts: ResortSummary[];
  enso: EnsoStatus | null;
  ranking: Ranking | null;
  usage: { lastRun: UsageRun | null; monthToDateUsd: number } | null;
  sources: Record<string, Partial<Record<SourceKey, SourceStatus>>>;
}
