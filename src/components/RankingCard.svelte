<script lang="ts">
  import type { Ranking, ResortSummary } from '../../shared/types';
  import { fmtDay, timeAgo } from '../lib/display';
  import { resortHref } from '../lib/router.svelte';

  interface Props {
    ranking: Ranking;
    resorts: ResortSummary[];
  }

  let { ranking, resorts }: Props = $props();
  const name = (id: string) => resorts.find((r) => r.id === id)?.shortName ?? id;
</script>

<section class="card ranking">
  <p class="small muted">Best bet this week</p>
  <h2>{name(ranking.bestResort)} · {fmtDay(ranking.bestDay)}</h2>
  <p class="summary">{ranking.summary}</p>
  <ol>
    {#each ranking.entries as e (e.resortId)}
      <li>
        <a href={resortHref(e.resortId)}><strong>{name(e.resortId)}</strong></a>
        <span class="muted small">{fmtDay(e.day)}</span>
        <p class="small secondary">{e.reason}</p>
      </li>
    {/each}
  </ol>
  <p class="small muted">Written {timeAgo(ranking.generatedAt)} by {ranking.model}</p>
</section>

<style>
  .ranking {
    display: grid;
    gap: 6px;
  }
  .ranking > p {
    margin: 0;
  }
  .summary {
    color: var(--text-2);
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
