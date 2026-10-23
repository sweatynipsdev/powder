<script lang="ts">
  import type { DataIndex } from '../../shared/types';
  import RoadsPanel from '../components/RoadsPanel.svelte';
  import { ensureAllResorts, store } from '../lib/store.svelte';

  interface Props {
    index: DataIndex;
  }

  let { index }: Props = $props();
  $effect(() => {
    ensureAllResorts();
  });
</script>

<div class="stack">
  <h1>Roads</h1>
  <p class="muted small sub">Caltrans chain controls, closures and highway cams for the drive to each resort.</p>
  {#each index.resorts as s (s.id)}
    {@const r = store.resorts[s.id]}
    <h2 class="section-title">{s.name}</h2>
    {#if r?.roads}
      <RoadsPanel roads={r.roads.data} status={r.roads.status} cams={r.links.roadCams} />
    {:else if r}
      <p class="card muted">No routes configured.</p>
    {:else}
      <p class="card muted">Loading…</p>
    {/if}
  {/each}
</div>

<style>
  .stack {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--gap);
  }
  .sub {
    margin: -8px 2px 0;
  }
  .stack > :global(.section-title) {
    margin-bottom: -4px;
  }
</style>
