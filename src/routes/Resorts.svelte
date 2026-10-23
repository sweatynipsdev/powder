<script lang="ts">
  // Every resort, grouped by region, with a star to add it to this phone's Favorites.
  import type { DataIndex } from '../../shared/types';
  import StarButton from '../components/StarButton.svelte';
  import { matchesQuery } from '../lib/favorites';
  import { favorites } from '../lib/favorites.svelte';
  import { fmtSnow } from '../lib/display';
  import { prefs } from '../lib/prefs.svelte';
  import { resortHref } from '../lib/router.svelte';

  interface Props {
    index: DataIndex;
  }

  let { index }: Props = $props();
  let query = $state('');

  let matches = $derived(index.resorts.filter((r) => matchesQuery(query, r.name, r.shortName, r.region)));
  // Regions in resorts.json order.
  let regions = $derived([...new Set(matches.map((r) => r.region))].map((region) => ({ region, resorts: matches.filter((r) => r.region === region) })));
</script>

<div class="stack">
  <h1>Resorts</h1>
  <p class="small muted sub">Star a resort to add it to Favorites. {favorites.ids.length} of {index.resorts.length} starred.</p>

  <input class="search" type="search" placeholder="Search resorts" aria-label="Search resorts" bind:value={query} />

  {#each regions as g (g.region)}
    <section aria-label={g.region}>
      <h2 class="section-title">{g.region}</h2>
      <ul class="card list">
        {#each g.resorts as r (r.id)}
          {@const next5 = r.buckets?.d1_5[prefs.elevation]?.blend ?? null}
          <li>
            <a href={resortHref(r.id)}>
              <span class="name">{r.name}</span>
              <span class="small st {r.status.state}"><span class="dot"></span>{r.status.text}</span>
            </a>
            <span class="next" title="Next 1–5 days">
              <strong>{fmtSnow(next5)}"</strong>
              <span class="small muted">1–5 days</span>
            </span>
            <StarButton id={r.id} name={r.name} />
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="card muted">No resorts match "{query}".</p>
  {/each}
</div>

<style>
  .stack {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--gap);
  }
  h1 {
    margin-bottom: 0;
  }
  .sub {
    margin: -8px 2px 0;
  }
  .search {
    width: 100%;
    padding: 11px 14px;
    border-radius: 12px;
    border: 1px solid var(--hairline);
    background: var(--card);
    color: var(--text);
    font: inherit;
    font-size: 16px; /* 16px stops iOS zooming into the field */
  }
  .search::placeholder {
    color: var(--muted);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0 4px 0 14px;
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 8px;
    min-height: 60px;
    border-top: 1px solid var(--hairline);
  }
  li:first-child {
    border-top: 0;
  }
  a {
    display: grid;
    gap: 2px;
    padding: 8px 0;
    color: inherit;
    text-decoration: none;
    min-width: 0;
  }
  .name {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .st {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
  }
  .st .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--muted);
    flex: none;
  }
  .st.open {
    color: var(--open);
  }
  .st.open .dot {
    background: var(--open);
  }
  .st.closed .dot,
  .st.not-open .dot {
    background: var(--closed);
  }
  .next {
    display: grid;
    justify-items: end;
    line-height: 1.15;
  }
  .next strong {
    font-size: 17px;
  }
</style>
