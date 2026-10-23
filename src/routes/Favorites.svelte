<script lang="ts">
  import type { DataIndex } from '../../shared/types';
  import AlertsBanner from '../components/AlertsBanner.svelte';
  import ElevationToggle from '../components/ElevationToggle.svelte';
  import FavoriteRow from '../components/FavoriteRow.svelte';
  import { fmtDay, timeAgo } from '../lib/display';
  import { bestFavorite } from '../lib/favorites';
  import { favorites } from '../lib/favorites.svelte';
  import { resortHref } from '../lib/router.svelte';

  interface Props {
    index: DataIndex;
  }

  let { index }: Props = $props();
  let shown = $derived(index.resorts.filter((r) => favorites.ids.includes(r.id)));
  let best = $derived(bestFavorite(index.ranking, favorites.ids));
  let alerts = $derived(
    [...new Map(shown.flatMap((r) => r.alerts.filter((a) => a.winter)).map((a) => [a.headline, a])).values()],
  );
  const name = (id: string) => index.resorts.find((r) => r.id === id)?.shortName ?? id;
</script>

<div class="stack">
  <div class="head">
    <h1>Favorites</h1>
    <ElevationToggle />
  </div>
  <p class="updated small muted">Updated {timeAgo(index.generatedAt)} · refreshes about 5am and 4pm</p>

  <AlertsBanner {alerts} />

  {#if favorites.ready && !favorites.chosen}
    <a class="card hint" href="#/resorts">Showing the default resorts · <strong>Pick yours →</strong></a>
  {/if}

  {#if best}
    <a class="card best" href={resortHref(best.resortId)}>
      <span class="small label">Best bet this week</span>
      <strong>{name(best.resortId)} · {fmtDay(best.day)}</strong>
      <span class="secondary small">{best.reason}</span>
    </a>
  {/if}

  {#each shown as r (r.id)}
    <FavoriteRow resort={r} />
  {/each}

  {#if favorites.ready && shown.length === 0}
    <div class="card empty">
      <strong>No favorites yet</strong>
      <a href="#/resorts">Star some resorts →</a>
    </div>
  {/if}

  {#if index.enso || index.usage?.lastRun}
    <footer class="small muted">
      {#if index.enso}<p>{index.enso.status}: {index.enso.synopsis}</p>{/if}
      {#if index.usage?.lastRun}<p>Forecasts written by {index.usage.lastRun.model} · ${index.usage.monthToDateUsd.toFixed(2)} this month</p>{/if}
    </footer>
  {/if}
</div>

<style>
  .stack {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--gap);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .updated {
    margin: -8px 2px 0;
  }
  .best {
    display: grid;
    gap: 3px;
    color: inherit;
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .best .label {
    color: var(--accent);
    font-weight: 700;
  }
  .best strong {
    font-size: 18px;
  }
  .hint {
    color: var(--text-2);
    font-size: 14px;
    border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .hint strong {
    color: var(--accent);
  }
  .empty {
    display: grid;
    gap: 6px;
    justify-items: start;
    padding: 24px 18px;
  }
  footer p {
    margin: 4px 2px;
  }
</style>
