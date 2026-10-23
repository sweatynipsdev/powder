<script lang="ts">
  // Stat tiles for the windows and buckets: best estimate up front, likely range under it.
  import { confidenceOf } from '../../pipeline/process/blend';
  import type { Elev, ForecastData, SnowAmount } from '../../shared/types';
  import { fmtSnow, fmtSnowRange } from '../lib/display';

  interface Props {
    forecast: ForecastData;
    elevation: Elev;
  }

  let { forecast: f, elevation }: Props = $props();

  let tiles = $derived<{ label: string; a: SnowAmount; showConfidence: boolean }[]>([
    { label: 'Next 24h', a: f.windows.next24h[elevation], showConfidence: false },
    { label: 'Next 72h', a: f.windows.next72h[elevation], showConfidence: false },
    { label: 'Next 7 days', a: f.windows.next7d[elevation], showConfidence: false },
    { label: 'Days 1–5', a: f.buckets.d1_5[elevation], showConfidence: true },
    { label: 'Days 6–10', a: f.buckets.d6_10[elevation], showConfidence: true },
    { label: 'Days 11–16', a: f.buckets.d11_16[elevation], showConfidence: true },
  ]);
</script>

<section class="tiles" aria-label="Snowfall totals">
  {#each tiles as t (t.label)}
    {@const c = t.showConfidence ? confidenceOf(t.a) : null}
    <div class="tile">
      <span class="small muted">{t.label}</span>
      <span class="value">{fmtSnow(t.a.blend)}"</span>
      <span class="small secondary tabular">{t.a.range && fmtSnowRange(t.a.range) !== fmtSnow(t.a.blend) ? `likely ${fmtSnowRange(t.a.range)}"` : ''}</span>
      {#if c}<span class="small muted">{c} confidence</span>{/if}
    </div>
  {/each}
</section>

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .tile {
    display: grid;
    background: var(--surface-1);
    border: 1px solid var(--hairline);
    border-radius: 12px;
    padding: 10px 12px;
  }
  .value {
    font-size: 28px;
    font-weight: 650;
    line-height: 1.15;
  }
</style>
