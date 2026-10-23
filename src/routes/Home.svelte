<script lang="ts">
  import type { DataIndex } from '../../shared/types';
  import AlertsBanner from '../components/AlertsBanner.svelte';
  import ElevationToggle from '../components/ElevationToggle.svelte';
  import RankingCard from '../components/RankingCard.svelte';
  import ResortCard from '../components/ResortCard.svelte';
  import { timeAgo } from '../lib/display';

  interface Props {
    index: DataIndex;
  }

  let { index }: Props = $props();

  // One banner entry per alert, even when it covers several resorts.
  let alerts = $derived(
    [...new Map(index.resorts.flatMap((r) => r.alerts.filter((a) => a.winter)).map((a) => [a.headline, a])).values()],
  );
</script>

<div class="stack">
  <div class="filters">
    <ElevationToggle />
    <span class="small muted">Updated {timeAgo(index.generatedAt)}</span>
  </div>

  <AlertsBanner {alerts} />

  {#if index.ranking}
    <RankingCard ranking={index.ranking} resorts={index.resorts} />
  {/if}

  {#each index.resorts as r (r.id)}
    <ResortCard resort={r} />
  {/each}

  <footer class="small muted">
    {#if index.enso}<p>{index.enso.status}: {index.enso.synopsis}</p>{/if}
    {#if index.usage?.lastRun}
      <p>Analysis by {index.usage.lastRun.model}. This month: ${index.usage.monthToDateUsd.toFixed(2)}.</p>
    {/if}
    <p>Forecast data: Open-Meteo, NOAA (NWS, CPC), NRCS, CDEC, CoCoRaHS, avalanche.org, Caltrans, resort reports.</p>
  </footer>
</div>

<style>
  .stack {
    display: grid;
    /* minmax(0, 1fr): sideways-scrolling children scroll inside their card instead of widening the page. */
    grid-template-columns: minmax(0, 1fr);
    gap: var(--gap);
  }
  .filters {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  footer p {
    margin: 4px 4px;
  }
</style>
