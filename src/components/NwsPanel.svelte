<script lang="ts">
  import type { AfdData, NwsData } from '../../shared/types';
  import { timeAgo } from '../lib/display';

  interface Props {
    nws: NwsData | null;
    afd: AfdData | null;
  }

  let { nws, afd }: Props = $props();
</script>

<section class="card" aria-labelledby="nws">
  <h2 id="nws">National Weather Service</h2>
  {#if nws}
    <dl>
      {#each nws.periods.slice(0, 4) as p (p.startTime)}
        <dt class="small">{p.name}</dt>
        <dd class="small secondary">{p.detailedForecast}</dd>
      {/each}
    </dl>
    <p class="small"><a href={nws.url} target="_blank" rel="noopener">Point forecast ↗</a></p>
  {/if}
  {#if afd}
    <details>
      <summary class="small">Forecast discussion · {afd.office} · {timeAgo(afd.issuedAt)}</summary>
      {#if afd.keyMessages}<p class="small secondary pre">{afd.keyMessages}</p>{/if}
      {#if afd.discussion}<p class="small secondary pre">{afd.discussion}</p>{/if}
      <p class="small muted">Excerpt; sentences about other parts of the region are left out.</p>
      <p class="small"><a href={afd.url} target="_blank" rel="noopener">Full discussion ↗</a></p>
    </details>
  {/if}
</section>

<style>
  dl {
    margin: 8px 0 0;
  }
  dt {
    font-weight: 600;
    margin-top: 6px;
  }
  dd {
    margin: 2px 0 0;
  }
  p {
    margin: 6px 0 0;
  }
  .pre {
    white-space: pre-line;
  }
  details {
    margin-top: 10px;
  }
  summary {
    cursor: pointer;
    color: var(--text-secondary);
  }
</style>
