<script lang="ts">
  import type { DataIndex } from '../../shared/types';
  import ExpertCard from '../components/ExpertCard.svelte';
  import RankingCard from '../components/RankingCard.svelte';
  import { resortHref } from '../lib/router.svelte';
  import { ensureAllResorts, store } from '../lib/store.svelte';

  interface Props {
    index: DataIndex;
  }

  let { index }: Props = $props();
  $effect(() => {
    ensureAllResorts();
  });
  let experts = $derived(index.resorts.map((s) => store.resorts[s.id]?.expert?.data).filter((x) => !!x));
</script>

<div class="stack">
  <h1>Forecasts</h1>

  {#if index.ranking}
    <RankingCard ranking={index.ranking} resorts={index.resorts} />
  {/if}

  {#each index.resorts as s (s.id)}
    {@const a = store.resorts[s.id]?.analysis}
    {#if a}
      <ExpertCard
        author={s.name}
        role={`AI forecast · ${a.model}`}
        avatar={{ src: './favicon.svg' }}
        at={a.generatedAt}
        title={a.headline}
        text={a.summary ?? a.next5Days}
        href={resortHref(s.id, 'forecast')}
      />
    {:else if s.headline}
      <a class="card" href={resortHref(s.id, 'forecast')}><strong>{s.name}</strong><br /><span class="secondary">{s.headline}</span></a>
    {/if}
  {/each}

  {#if experts.length}
    <h2 class="section-title">Local Experts</h2>
    {#each experts as x (x!.url)}
      <ExpertCard
        author={x!.author ?? x!.source}
        role={x!.source}
        avatar={{ initials: (x!.author ?? x!.source).replace(/^the /i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() }}
        at={x!.publishedAt}
        title={x!.title}
        text={x!.excerpt}
        href={x!.url}
        external
      />
    {/each}
  {/if}
</div>

<style>
  .stack {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--gap);
  }
</style>
