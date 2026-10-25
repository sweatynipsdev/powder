<script lang="ts">
  import { untrack } from 'svelte';
  import { clockTime, timeAgo } from './lib/display';
  import { router } from './lib/router.svelte';
  import { favorites, initFavorites } from './lib/favorites.svelte';
  import { ensureIndex, ensureResort, ensureResorts, store } from './lib/store.svelte';
  import Favorites from './routes/Favorites.svelte';
  import Forecasts from './routes/Forecasts.svelte';
  import Resort from './routes/Resort.svelte';
  import Resorts from './routes/Resorts.svelte';
  import Roads from './routes/Roads.svelte';

  /** Data older than this means scheduled updates have stopped. The runs are 9 and 15 hours
   *  apart, and GitHub starts them a few hours late by varying amounts. */
  const STALE_HOURS = 24;

  let online = $state(navigator.onLine);
  window.addEventListener('online', () => (online = true));
  window.addEventListener('offline', () => (online = false));

  $effect(() => {
    ensureIndex();
  });
  $effect(() => {
    const r = router.route;
    if (r.name === 'resort') ensureResort(r.id);
  });
  $effect(() => {
    const index = store.index;
    // Untracked: initFavorites reads the favorites it writes.
    if (index) untrack(() => initFavorites(index));
  });
  // Load every favorite in the background so the service worker caches them for offline,
  // not just the ones opened.
  $effect(() => {
    if (favorites.ready) ensureResorts(favorites.ids);
  });

  // Back returns to wherever you came from in the app (Favorites, Resorts, Forecasts…);
  // opened straight from a link or the home screen, it goes to Favorites.
  function back(e: MouseEvent) {
    if (!router.navigated) return;
    e.preventDefault();
    history.back();
  }

  let generatedAt = $derived(store.index?.generatedAt ?? null);
  let ageHours = $derived(generatedAt ? (Date.now() - Date.parse(generatedAt)) / 3_600_000 : 0);
  let tab = $derived(router.route.name === 'resort' ? 'favorites' : router.route.name);

  const TABS = [
    { id: 'favorites', label: 'Favorites', href: '#/' },
    { id: 'resorts', label: 'Resorts', href: '#/resorts' },
    { id: 'forecasts', label: 'Forecasts', href: '#/forecasts' },
    { id: 'roads', label: 'Roads', href: '#/roads' },
  ] as const;
</script>

<header class="topbar">
  {#if router.route.name === 'resort'}
    <a class="back" href="#/" aria-label="Back" onclick={back}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </a>
  {/if}
  <a class="brand" href="#/">
    <img src="./favicon.svg" alt="" width="30" height="30" />
    <span>POWDER</span>
  </a>
</header>

<main>
  {#if !online}
    <p class="banner">Offline · showing data from {clockTime(generatedAt)}</p>
  {:else if ageHours > STALE_HOURS}
    <p class="banner">Last update was {timeAgo(generatedAt)}. Updates may have stopped.</p>
  {/if}

  {#if router.route.name === 'resort'}
    {@const id = router.route.id}
    {#if store.resorts[id]}
      <Resort resort={store.resorts[id]} tab={router.route.tab} summary={store.index?.resorts.find((s) => s.id === id) ?? null} />
    {:else if store.resortErrors[id]}
      <p class="card">Couldn't load this resort. {online ? 'Try again in a minute.' : "You're offline and it isn't cached yet."}</p>
    {:else}
      <p class="loading muted">Loading…</p>
    {/if}
  {:else if store.index}
    {#if router.route.name === 'favorites'}
      <Favorites index={store.index} />
    {:else if router.route.name === 'resorts'}
      <Resorts index={store.index} />
    {:else if router.route.name === 'forecasts'}
      <Forecasts index={store.index} />
    {:else}
      <Roads index={store.index} />
    {/if}
  {:else if store.error}
    <p class="card">Couldn't load forecasts. {online ? 'Try again in a minute.' : "You're offline and nothing is cached yet."}</p>
  {:else}
    <p class="loading muted">Loading…</p>
  {/if}
</main>

<nav class="tabbar" aria-label="Sections">
  {#each TABS as t (t.id)}
    <a href={t.href} class:on={tab === t.id} aria-current={tab === t.id ? 'page' : undefined}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
          {#if t.id === 'favorites'}
            <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
          {:else if t.id === 'resorts'}
            <circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" />
          {:else if t.id === 'forecasts'}
            <path d="M6 3.5h9l3 3v14H6z" /><path d="M9 10h6M9 13.5h6M9 17h4" />
          {:else}
            <path d="M8 3.5L4.5 20.5M16 3.5l3.5 17" /><path d="M12 5v2.5M12 11v2.5M12 17v2.5" />
          {/if}
        </g>
      </svg>
      <span>{t.label}</span>
    </a>
  {/each}
</nav>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    height: calc(env(safe-area-inset-top) + 54px);
    padding: env(safe-area-inset-top) 12px 0;
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bar);
    border-bottom: 1px solid var(--hairline);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    color: #fff;
    font-weight: 900;
    font-size: 21px;
    letter-spacing: 0.04em;
  }
  .brand img {
    border-radius: 8px;
  }
  .back {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    color: #fff;
    margin-left: -6px;
  }
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 16px 16px calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 24px);
    padding-left: max(16px, env(safe-area-inset-left));
    padding-right: max(16px, env(safe-area-inset-right));
  }
  .banner {
    margin: 0 0 12px;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 14px;
    background: color-mix(in srgb, var(--warning) 22%, transparent);
  }
  .loading {
    padding: 48px 0;
    text-align: center;
  }
  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: color-mix(in srgb, var(--bar) 94%, transparent);
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--hairline);
  }
  .tabbar a {
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 2px;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
  }
  .tabbar a.on {
    color: var(--accent);
  }
</style>
