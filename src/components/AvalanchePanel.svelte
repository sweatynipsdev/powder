<script lang="ts">
  import type { AvalancheData, SourceStatus } from '../../shared/types';
  import { avalancheTone, DANGER_LABEL, timeAgo } from '../lib/display';
  import StaleChip from './StaleChip.svelte';

  interface Props {
    avalanche: AvalancheData | null;
    status: SourceStatus;
  }

  let { avalanche: a, status }: Props = $props();
  let bands = $derived(
    a?.current
      ? [
          { label: 'Above treeline', v: a.current.upper },
          { label: 'Near treeline', v: a.current.middle },
          { label: 'Below treeline', v: a.current.lower },
        ]
      : [],
  );
</script>

<section class="card" aria-labelledby="avy">
  <div class="head">
    <h2 id="avy">Avalanche</h2>
    <StaleChip {status} hasData={!!a} />
  </div>
  {#if a}
    <p class="small muted">{a.center} · {a.zoneName}{a.publishedAt ? ` · ${timeAgo(a.publishedAt)}` : ''}</p>
    {#if bands.length}
      <ul>
        {#each bands as b (b.label)}
          <li>
            <span class="small secondary">{b.label}</span>
            <span class="status {avalancheTone(b.v)}"><span class="dot"></span>{b.v > 0 ? `${b.v} · ${DANGER_LABEL[b.v]}` : DANGER_LABEL[0]}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p><span class="status neutral"><span class="dot"></span>{a.overallText}</span></p>
    {/if}
    {#if a.problems.length}<p class="small secondary">Problems: {a.problems.join(', ')}</p>{/if}
    {#if a.bottomLine}<p class="small secondary">{a.bottomLine}</p>{/if}
    <p class="small"><a href={a.url} target="_blank" rel="noopener">Full forecast ↗</a></p>
  {/if}
</section>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  p {
    margin: 6px 0 0;
  }
  ul {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
</style>
