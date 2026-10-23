<script lang="ts">
  // CPC outlooks as a strip of tiles. Each reads as words first (arrow + category + odds);
  // the colored dot is a secondary cue from a warm/cool or wet/dry diverging pair.
  import type { CpcCat, CpcData, SourceStatus } from '../../shared/types';
  import StaleChip from './StaleChip.svelte';

  interface Props {
    cpc: CpcData | null;
    status: SourceStatus;
  }

  let { cpc, status }: Props = $props();

  const ARROW = { above: '▲', below: '▼', normal: '●', ec: '–' } as const;
  const WORD = { above: 'Above', below: 'Below', normal: 'Near', ec: 'Equal chances' } as const;

  function text(c: CpcCat | null) {
    if (!c) return 'n/a';
    return c.cat === 'ec' ? WORD.ec : `${WORD[c.cat]} normal${c.prob ? ` · ${c.prob}%` : ''}`;
  }
</script>

<section class="card" aria-labelledby="cpc">
  <div class="head">
    <h2 id="cpc">Long-range outlook</h2>
    <StaleChip {status} hasData={!!cpc} />
  </div>
  {#if cpc}
    <div class="strip">
      {#each cpc.outlooks as o (o.key)}
        <div class="tile" class:low={o.lowConfidence}>
          <span class="small"><strong>{o.label}</strong></span>
          <span class="small muted">{o.valid ?? ''}</span>
          <span class="row small">
            <span class="dot temp {o.temp?.cat ?? 'ec'}"></span>
            <span class="muted">Temp</span>
            {ARROW[o.temp?.cat ?? 'ec']}
            {text(o.temp)}
          </span>
          <span class="row small">
            <span class="dot precip {o.precip?.cat ?? 'ec'}"></span>
            <span class="muted">Precip</span>
            {ARROW[o.precip?.cat ?? 'ec']}
            {text(o.precip)}
          </span>
          {#if o.lowConfidence}<span class="small muted">low confidence</span>{/if}
        </div>
      {/each}
    </div>
    <p class="small muted">NOAA Climate Prediction Center odds of above or below normal, not amounts.</p>
    {#if cpc.enso}
      <p class="small secondary"><strong>{cpc.enso.status}.</strong> {cpc.enso.synopsis}</p>
    {/if}
  {/if}
</section>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    margin: 10px -4px 0;
    padding: 0 4px 4px;
    scroll-snap-type: x proximity;
  }
  .tile {
    flex: 0 0 150px;
    display: grid;
    gap: 2px;
    align-content: start;
    background: var(--surface-2);
    border-radius: 10px;
    padding: 8px 10px;
    scroll-snap-align: start;
  }
  .tile.low {
    opacity: 0.85;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
    background: var(--text-muted);
  }
  /* Diverging pairs from the palette: warm/cool for temperature, wet/dry for precipitation. */
  .dot.temp.above {
    background: #e66767;
  }
  .dot.temp.below {
    background: var(--series-1);
  }
  .dot.precip.above {
    background: #008300;
  }
  .dot.precip.below {
    background: var(--series-2);
  }
  p {
    margin: 8px 0 0;
  }
</style>
