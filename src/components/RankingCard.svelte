<script lang="ts">
  // The AI ranks every resort; this shows only the phone's favorites, in that order. The
  // ranking's overall summary is left out because it can name resorts the reader doesn't follow.
  import type { Ranking, ResortSummary } from '../../shared/types';
  import { fmtDay, timeAgo } from '../lib/display';
  import { resortHref } from '../lib/router.svelte';

  interface Props {
    ranking: Ranking;
    resorts: ResortSummary[];
    favorites: string[];
  }

  let { ranking, resorts, favorites }: Props = $props();
  const name = (id: string) => resorts.find((r) => r.id === id)?.shortName ?? id;
  let entries = $derived(ranking.entries.filter((e) => favorites.includes(e.resortId)));
  let best = $derived(entries[0]);
  let bestStatus = $derived(best ? resorts.find((r) => r.id === best.resortId)?.status : undefined);
</script>

{#if best}
  <section class="card ranking">
    <p class="small muted">{bestStatus?.state === 'open' ? 'Best bet this week' : 'Best snow this week'}</p>
    <h2>{name(best.resortId)} · {fmtDay(best.day)}</h2>
    {#if bestStatus && bestStatus.state !== 'open'}<p class="small muted">{bestStatus.text}</p>{/if}
    <ol>
      {#each entries as e (e.resortId)}
        <li>
          <a href={resortHref(e.resortId)}><strong>{name(e.resortId)}</strong></a>
          <span class="muted small">{fmtDay(e.day)}</span>
          <p class="small secondary">{e.reason}</p>
        </li>
      {/each}
    </ol>
    <p class="small muted">Written {timeAgo(ranking.generatedAt)} by {ranking.model}</p>
  </section>
{/if}

<style>
  .ranking {
    display: grid;
    gap: 6px;
  }
  .ranking > p {
    margin: 0;
  }
  ol {
    margin: 4px 0;
    padding-left: 20px;
    display: grid;
    gap: 8px;
  }
  li p {
    margin: 2px 0 0;
  }
  a {
    text-decoration: none;
  }
</style>
