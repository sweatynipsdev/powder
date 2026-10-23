import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureHttp, describeFetchError, fetchText } from '../../pipeline/http';

/** What Node's fetch throws when the server hangs up mid-request. */
const dropped = () =>
  new TypeError('fetch failed', { cause: Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' }) });

describe('live fetch', () => {
  const fetch = vi.fn();

  beforeEach(() => {
    fetch.mockReset();
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    configureHttp({ mode: 'live', failPattern: null, retryDelaysMs: [0] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries a dropped connection with the delays the request asks for, and says why it gave up', async () => {
    fetch.mockRejectedValue(dropped());
    await expect(fetchText('https://api.example.com/a?x=1', { retryDelaysMs: [0, 0, 0] })).rejects.toThrow(
      'fetch failed (UND_ERR_SOCKET: other side closed)',
    );
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(console.warn).toHaveBeenCalledTimes(3);
    expect(vi.mocked(console.warn).mock.calls[0][0]).toBe(
      '  retry 1/3 in 0s: api.example.com/a: fetch failed (UND_ERR_SOCKET: other side closed)',
    );
  });

  it('runs every attempt through the gate', async () => {
    fetch.mockRejectedValueOnce(dropped()).mockResolvedValueOnce(new Response('ok', { headers: { 'content-type': 'text/plain' } }));
    let gated = 0;
    const gate = <T>(request: () => Promise<T>) => {
      gated++;
      return request();
    };
    await expect(fetchText('https://api.example.com/b', { gate })).resolves.toBe('ok');
    expect(gated).toBe(2);
  });

  it("doesn't retry a 404", async () => {
    fetch.mockResolvedValue(new Response('missing', { status: 404 }));
    await expect(fetchText('https://api.example.com/c', { retryDelaysMs: [0, 0] })).rejects.toThrow('HTTP 404');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('fetch error text', () => {
  it('keeps the message alone when there is no cause', () => {
    expect(describeFetchError(new Error('The operation was aborted due to timeout'))).toBe('The operation was aborted due to timeout');
  });

  it('uses the code when the cause has no message (refused on every address)', () => {
    const cause = Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' });
    expect(describeFetchError(new TypeError('fetch failed', { cause }))).toBe('fetch failed (ECONNREFUSED)');
  });
});
