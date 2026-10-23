<script lang="ts">
  import type { DataIndex } from '../../shared/types';
  import ExpertCard from '../components/ExpertCard.svelte';
  import RankingCard from '../components/RankingCard.svelte';
  import { bestFavorite } from '../lib/favorites';
  import { favorites } from '../lib/favorites.svelte';
  import { resortHref } from '../lib/router.svelte';
  import { ensureResorts, store } from '../lib/store.svelte';

  interface Props {
    index: DataIndex;
  }

  let { index }: Props = $props();
  let favs = $derived(index.resorts.filter((s) => favorites.ids.includes(s.id)));
  let others = $derived(index.resorts.filter((s) => !favorites.ids.includes(s.id)));
  $effect(() => {
    ensureResorts(favorites.ids);
  });
  let experts = $derived(favs.map((s) => store.resorts[s.id]?.expert?.data).filter((x) => !!x));
</script>

<div class="stack">
  <h1>Forecasts</h1>

  {#if index.ranking && bestFavorite(index.ranking, favorites.ids)}
    <RankingCard ranking={index.ranking} resorts={index.resorts} favorites={favorites.ids} />
  {/if}

  {#if favorites.ready && favs.length === 0}
    <p class="card muted">No favorites yet. <a href="#/resorts">Star some resorts →</a></p>
  {/if}

  {#each favs as s (s.id)}
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

  {#if favorites.ready && others.length}
    <details class="card others">
      <summary><strong>Other resorts</strong> <span class="muted small">({others.length})</span></summary>
      <ul>
        {#each others as s (s.id)}
          <li>
            <a href={resortHref(s.id, 'forecast')}><strong>{s.name}</strong></a>
            {#if s.headline}<p class="small secondary">{s.headline}</p>{/if}
          </li>
        {/each}
      </ul>
    </details>
  {/if}
</div>

<style>
  .stack {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--gap);
  }
  .others summary {
    cursor: pointer;
  }
  .others ul {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  .others p {
    margin: 2px 0 0;
  }
  .others a {
    text-decoration: none;
  }
</style>
