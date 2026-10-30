<script lang="ts">
  import { untrack } from 'svelte';
  import type { Cam } from '../../shared/types';

  interface Props {
    cams: Cam[];
    start: number;
    onclose: () => void;
  }

  let { cams, start, onclose }: Props = $props();

  /** How often a still reloads. Most cam hosts publish a new frame every minute or few. */
  const REFRESH_MS = 60_000;
  // iPhone Safari plays HLS itself. Elsewhere a `video` cam shows its still instead.
  const nativeHls = document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== '';

  // The viewer opens on the tapped cam, then keeps its own place.
  let index = $state(untrack(() => start));
  let cam = $derived(cams[index]);
  /** Streams that failed this session, and stills whose host rejected the refresh query. */
  let deadVideo = $state<string[]>([]);
  let plainStill = $state<string[]>([]);
  let now = $state(Date.now());
  let closeButton: HTMLButtonElement;
  let touchX: number | null = null;

  let mode = $derived<'video' | 'player' | 'still'>(cam.video && nativeHls && !deadVideo.includes(cam.video) ? 'video' : cam.player ? 'player' : 'still');
  let still = $derived(plainStill.includes(cam.url) ? cam.url : fresh(cam.url, now));

  /** The still's URL with a query that changes each refresh, so the browser can't reuse an old frame. */
  function fresh(url: string, t: number): string {
    const u = new URL(url);
    u.searchParams.set('t', String(Math.floor(t / REFRESH_MS)));
    return u.toString();
  }

  const step = (d: number) => (index = (index + d + cams.length) % cams.length);

  $effect(() => {
    if (mode !== 'still') return;
    const timer = setInterval(() => (now = Date.now()), REFRESH_MS);
    return () => clearInterval(timer);
  });

  // The page behind stays put while the viewer is open.
  $effect(() => {
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    closeButton.focus();
    return () => {
      root.style.overflow = before;
    };
  });

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  }

  // Swipe between stills. A video or player keeps its own touches for its controls.
  function ontouchstart(e: TouchEvent) {
    touchX = mode === 'still' ? e.touches[0].clientX : null;
  }
  function ontouchend(e: TouchEvent) {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchX = null;
  }
</script>

<svelte:window {onkeydown} />

<div class="viewer" role="dialog" aria-modal="true" aria-label={cam.label}>
  <header>
    <span class="count small">{index + 1} / {cams.length}</span>
    <strong>{cam.label}</strong>
    {#if mode !== 'still'}<span class="live">LIVE</span>{/if}
    <button type="button" class="close" aria-label="Close" onclick={onclose} bind:this={closeButton}>✕</button>
  </header>

  <div class="stage" role="group" aria-label="Cam" {ontouchstart} {ontouchend}>
    {#key cam.url}
      {#if mode === 'video'}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video src={cam.video} poster={cam.url} autoplay muted playsinline controls onerror={() => (deadVideo = [...deadVideo, cam.video!])}></video>
      {:else if mode === 'player'}
        <iframe src={cam.player} title={cam.label} allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
      {:else}
        <img src={still} alt={cam.label} onerror={() => !plainStill.includes(cam.url) && (plainStill = [...plainStill, cam.url])} />
      {/if}
    {/key}
    {#if cams.length > 1}
      <button type="button" class="nav prev" aria-label="Previous cam" onclick={() => step(-1)}>‹</button>
      <button type="button" class="nav next" aria-label="Next cam" onclick={() => step(1)}>›</button>
    {/if}
  </div>

  <footer class="small muted">
    {#if mode === 'video'}
      Live video · full screen from the player's controls
    {:else if mode === 'player'}
      Live from the camera's own player · full screen from its controls
    {:else}
      Still image · reloads every minute
    {/if}
  </footer>
</div>

<style>
  .viewer {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    background: #000;
    color: var(--text);
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 6px 6px 16px;
  }
  strong {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    color: var(--muted);
  }
  .live {
    padding: 2px 6px;
    border-radius: 6px;
    background: var(--closed);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .close {
    width: 44px;
    height: 44px;
    border: 0;
    background: none;
    color: var(--text);
    font-size: 22px;
  }
  .stage {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 0;
  }
  img,
  video,
  iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }
  img,
  video {
    object-fit: contain;
  }
  .nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    font-size: 28px;
    line-height: 1;
  }
  .prev {
    left: 8px;
  }
  .next {
    right: 8px;
  }
  footer {
    padding: 10px 16px 14px;
  }
</style>
