// fetch with timeout + retries, an in-run cache (shared feeds like Caltrans districts
// are requested by several resorts), and fixture record/replay for tests.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { setNow } from './clock';

export type FixtureMode = 'live' | 'record' | 'replay';

export const USER_AGENT = 'powder-snow/0.1 (personal forecast app; +https://github.com/sweatynipsdev/powder)';

const DEFAULT_DIR = fileURLToPath(new URL('../test/fixtures/http', import.meta.url));

interface HttpConfig {
  mode: FixtureMode;
  dir: string;
  /** Requests whose URL matches fail (used to simulate an outage). */
  failPattern: RegExp | null;
  retryDelaysMs: number[];
}

const cfg: HttpConfig = {
  mode: (process.env.POWDER_FIXTURES as FixtureMode) || 'live',
  dir: process.env.POWDER_FIXTURE_DIR || DEFAULT_DIR,
  failPattern: process.env.POWDER_FAIL_URLS ? new RegExp(process.env.POWDER_FAIL_URLS) : null,
  retryDelaysMs: [1500, 4000],
};

const inflight = new Map<string, Promise<Response>>();

interface StoredResponse {
  url: string;
  method: string;
  body: string | null;
  status: number;
  contentType: string;
  encoding: 'utf8' | 'base64';
  data: string;
}

/** Shape the rest of the pipeline sees; independent of fetch/fixtures. */
interface Response {
  status: number;
  contentType: string;
  bytes: Uint8Array;
}

export function configureHttp(next: Partial<HttpConfig>): void {
  Object.assign(cfg, next);
  inflight.clear();
}

export function httpMode(): FixtureMode {
  return cfg.mode;
}

/** In replay mode, freeze the clock to when the fixtures were recorded. */
export function initClockForMode(): void {
  if (cfg.mode !== 'replay') return;
  const meta = join(cfg.dir, 'meta.json');
  if (existsSync(meta)) setNow(new Date(JSON.parse(readFileSync(meta, 'utf8')).recordedAt));
}

/** Record mode starts clean so fixtures for old (date-stamped) URLs don't pile up. */
export function clearFixtures(): void {
  rmSync(cfg.dir, { recursive: true, force: true });
  mkdirSync(cfg.dir, { recursive: true });
}

export function writeRecordingMeta(recordedAt: Date): void {
  mkdirSync(cfg.dir, { recursive: true });
  writeFileSync(join(cfg.dir, 'meta.json'), JSON.stringify({ recordedAt: recordedAt.toISOString() }, null, 2) + '\n');
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly url: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

function fixtureKey(method: string, url: string, body: string | undefined): string {
  return createHash('sha1')
    .update(`${method} ${url} ${body ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

function isText(contentType: string): boolean {
  return /json|text|xml|html|javascript/i.test(contentType);
}

function readFixture(key: string, url: string): Response {
  const path = join(cfg.dir, `${key}.json.gz`);
  if (!existsSync(path)) throw new HttpError(`no fixture for ${url}`, null, url);
  const stored: StoredResponse = JSON.parse(gunzipSync(readFileSync(path)).toString('utf8'));
  const bytes = stored.encoding === 'base64' ? Buffer.from(stored.data, 'base64') : Buffer.from(stored.data, 'utf8');
  return { status: stored.status, contentType: stored.contentType, bytes: new Uint8Array(bytes) };
}

function writeFixture(key: string, method: string, url: string, body: string | undefined, res: Response): void {
  mkdirSync(cfg.dir, { recursive: true });
  const text = isText(res.contentType);
  const stored: StoredResponse = {
    url,
    method,
    body: body ?? null,
    status: res.status,
    contentType: res.contentType,
    encoding: text ? 'utf8' : 'base64',
    data: text ? Buffer.from(res.bytes).toString('utf8') : Buffer.from(res.bytes).toString('base64'),
  };
  writeFileSync(join(cfg.dir, `${key}.json.gz`), gzipSync(JSON.stringify(stored), { level: 9 }));
  const indexPath = join(cfg.dir, 'index.json');
  const index: Record<string, string> = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};
  index[key] = `${method} ${url}`;
  const sorted = Object.fromEntries(Object.entries(index).sort(([, a], [, b]) => a.localeCompare(b)));
  writeFileSync(indexPath, JSON.stringify(sorted, null, 2) + '\n');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Most 4xx won't fix themselves, but rate limits (429) do, and government firewalls (NRCS
 * did this on 2026-10-23) sometimes return a 403 that clears seconds later.
 */
const retryable = (status: number) => status >= 500 || status === 429 || status === 403;

async function liveFetch(url: string, opts: RequestOptions): Promise<Response> {
  let lastError: unknown;
  const attempts = cfg.retryDelaysMs.length + 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(cfg.retryDelaysMs[attempt - 1]);
    try {
      const res = await fetch(url, {
        method: opts.method ?? 'GET',
        body: opts.body,
        headers: { 'User-Agent': USER_AGENT, ...opts.headers },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!res.ok) {
        const err = new HttpError(`HTTP ${res.status} for ${url}`, res.status, url);
        if (!retryable(res.status)) throw err;
        lastError = err;
        continue;
      }
      return { status: res.status, contentType: res.headers.get('content-type') ?? '', bytes };
    } catch (e) {
      if (e instanceof HttpError && e.status !== null && !retryable(e.status)) throw e;
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new HttpError(String(lastError), null, url);
}

async function request(url: string, opts: RequestOptions = {}): Promise<Response> {
  const method = opts.method ?? 'GET';
  const key = fixtureKey(method, url, opts.body);
  const cached = inflight.get(key);
  if (cached) return cached;

  const p = (async () => {
    if (cfg.failPattern?.test(url)) throw new HttpError(`simulated outage for ${url}`, null, url);
    if (cfg.mode === 'replay') return readFixture(key, url);
    const res = await liveFetch(url, opts);
    if (cfg.mode === 'record') writeFixture(key, method, url, opts.body, res);
    return res;
  })();
  inflight.set(key, p);
  return p;
}

export async function fetchBytes(url: string, opts?: RequestOptions): Promise<Uint8Array> {
  return (await request(url, opts)).bytes;
}

export async function fetchText(url: string, opts?: RequestOptions): Promise<string> {
  return Buffer.from((await request(url, opts)).bytes).toString('utf8');
}

export async function fetchJson<T = unknown>(url: string, opts?: RequestOptions): Promise<T> {
  const text = await fetchText(url, opts);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(`invalid JSON from ${url}: ${text.slice(0, 120)}`, null, url);
  }
}

/** Build a query string, keeping commas readable (Open-Meteo lists). */
export function qs(params: Record<string, string | number | (string | number)[]>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : String(v)).replace(/%2C/g, ',')}`)
    .join('&');
}
