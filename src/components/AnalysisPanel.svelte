<script lang="ts">
  import type { ResortAnalysis } from '../../shared/types';
  import { timeAgo } from '../lib/display';

  interface Props {
    analysis: ResortAnalysis | null;
  }

  let { analysis: a }: Props = $props();
  const TONE = { high: 'good', medium: 'warning', low: 'serious' } as const;
</script>

<article class="card analysis">
  {#if a}
    <p class="small muted">Daily Snow · {timeAgo(a.generatedAt)}</p>
    <h2 class="headline">{a.headline}</h2>

    <h3>Next 5 days</h3>
    {#each a.next5Days.split(/\n\n+/) as para, i (i)}<p>{para}</p>{/each}

    <h3>Days 6–16</h3>
    <p>{a.extended6to16}</p>

    <h3>
      Model agreement
      <span class="status {TONE[a.modelAgreement.confidence]}"><span class="dot"></span>{a.modelAgreement.confidence} confidence</span>
    </h3>
    <p>{a.modelAgreement.summary}</p>

    <h3>What to watch</h3>
    <p>{a.whatToWatch}</p>

    {#if a.ungrounded.length}
      <p class="small warn">⚠ Contains numbers not found in the forecast data: {a.ungrounded.join(', ')}</p>
    {/if}
    <p class="small muted">Written by {a.model} from the data on this page.</p>
  {:else}
    <h2>Daily Snow</h2>
    <p class="muted">No written analysis yet. It's added on the next scheduled update.</p>
  {/if}
</article>

<style>
  .analysis p {
    margin: 0 0 10px;
    color: var(--text-secondary);
  }
  .analysis .headline {
    font-size: 21px;
    margin: 2px 0 12px;
  }
  h3 {
    font-size: 14px;
    font-weight: 650;
    margin: 14px 0 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .warn {
    color: var(--text-primary);
  }
  .analysis p.muted {
    color: var(--text-muted);
    margin: 0;
  }
</style>
