<script lang="ts">
  import { untrack } from 'svelte';
  import type { DataIndex, ResortData } from '../shared/types';
  import { loadIndex, loadResort } from './lib/data';
  import { clockTime, timeAgo } from './lib/display';
  import { router } from './lib/router.svelte';
  import Home from './routes/Home.svelte';
  import Resort from './routes/Resort.svelte';

  /** Data older than this means scheduled updates have stopped. */
  const STALE_HOURS = 14;

  let index = $state<DataIndex | null>(null);
  let resort = $state<ResortData | null>(null);
  let error = $state<string | null>(null);
  let online = $state(navigator.onLine);

  window.addEventListener('online', () => (online = true));
  window.addEventListener('offline', () => (online = false));

  $effect(() => {
    loadIndex()
      .then((d) => (index = d))
      .catch((e) => (error = String(e)));
  });

  $effect(() => {
    const route = router.route;
    if (route.name !== 'resort') return;
    // Only the route drives this effect; reading `resort` here must not re-trigger it.
    if (untrack(() => resort?.id) !== route.id) resort = null;
    loadResort(route.id)
      .then((d) => (resort = d))
      .catch((e) => (error = String(e)));
  });

  let generatedAt = $derived(index?.generatedAt ?? resort?.generatedAt ?? null);
  let ageHours = $derived(generatedAt ? (Date.now() - Date.parse(generatedAt)) / 3_600_000 : 0);
</script>

<div class="topbar">
  {#if router.route.name === 'resort'}
    <a class="back" href="#/" aria-label="All resorts">‹ Resorts</a>
  {:else}
    <span class="brand">Powder</span>
  {/if}
</div>

<main>
  {#if !online}
    <p class="banner small">Offline · showing data from {clockTime(generatedAt)}</p>
  {:else if ageHours > STALE_HOURS}
    <p class="banner small">Data is {timeAgo(generatedAt)} old. Updates may have stopped.</p>
  {/if}

  {#if router.route.name === 'home'}
    {#if index}
      <Home {index} />
    {:else if error}
      <p class="card">Couldn't load forecasts. {online ? 'Try again in a minute.' : "You're offline and nothing is cached yet."}</p>
    {:else}
      <p class="muted loading">Loading…</p>
    {/if}
  {:else if resort}
    <Resort {resort} />
  {:else if error}
    <p class="card">Couldn't load this resort.</p>
  {:else}
    <p class="muted loading">Loading…</p>
  {/if}
</main>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    height: calc(env(safe-area-inset-top) + 52px);
    padding: env(safe-area-inset-top) 16px 0;
    display: flex;
    align-items: center;
    background: color-mix(in srgb, var(--page) 92%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--hairline);
  }
  .brand {
    font-weight: 750;
    font-size: 19px;
    letter-spacing: -0.01em;
  }
  .back {
    text-decoration: none;
    font-weight: 600;
    color: var(--series-1);
  }
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 14px 16px calc(env(safe-area-inset-bottom) + 32px);
    padding-left: max(16px, env(safe-area-inset-left));
    padding-right: max(16px, env(safe-area-inset-right));
  }
  .banner {
    margin: 0 0 12px;
    padding: 8px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--warning) 20%, transparent);
  }
  .loading {
    padding: 40px 0;
    text-align: center;
  }
</style>
