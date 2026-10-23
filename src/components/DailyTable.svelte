<script lang="ts">
  // Day and night rows per day: temperature, sky, snow ratio, a 12-hour snowfall bar with
  // its likely range, snow level and gusts.
  import type { Elev, ForecastData, Period } from '../../shared/types';
  import { BIG_PERIOD_IN, dayNum, fmtFt, fmtSnow, fmtSnowRange, weekdayOf } from '../lib/display';
  import WeatherIcon from './icons/WeatherIcon.svelte';

  interface Props {
    forecast: ForecastData;
    elevation: Elev;
  }

  let { forecast: f, elevation }: Props = $props();
  let showAll = $state(false);
  let days = $derived(f.days.slice(0, showAll ? f.days.length : 10));
  let max = $derived(Math.max(4, ...f.periods.slice(0, days.length * 2).map((p) => p.snow[elevation].range?.hi ?? p.snow[elevation].blend ?? 0)));

  function label(p: Period): string {
    const a = p.snow[elevation];
    if (a.blend === null) return '--';
    const r = a.range ? fmtSnowRange(a.range) : fmtSnow(a.blend);
    return a.range && a.range.hi - a.range.lo >= 1 ? `${r}"` : `${fmtSnow(a.blend)}"`;
  }
</script>

<section class="card table-card">
  <div class="hscroll">
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Temp</th>
          <th></th>
          <th class="acc">SLR</th>
          <th class="snowcol">12-Hr Snowfall</th>
          <th class="outlook">Snow Level</th>
          <th>Gust</th>
        </tr>
      </thead>
      <tbody>
        {#each days as d, i (d.date)}
          {#each [f.periods[2 * i], f.periods[2 * i + 1]] as p, k (p.start)}
            {@const a = p.snow[elevation]}
            {@const v = a.blend ?? 0}
            <tr class:night={k === 1} class:dayend={k === 1}>
              {#if k === 0}
                <th rowspan="2" class="day"><span>{weekdayOf(d.date)}</span><span class="muted">{dayNum(d.date)}</span></th>
              {/if}
              <td class="temp">{(k === 0 ? p.tempF[elevation].max : p.tempF[elevation].min) ?? '--'}°</td>
              <td class="ic"><WeatherIcon icon={p.icon} night={k === 1} size={22} /></td>
              <td class="acc">{p.slr[elevation] ? `${p.slr[elevation]}:1` : '--'}</td>
              <td class="snowcol">
                <div class="barwrap">
                  <i class:big={v >= BIG_PERIOD_IN} style:width="{v > 0.04 ? Math.max(3, (v / max) * 100) : 0}%"></i>
                  <span class:zero={v < 0.5}>{label(p)}</span>
                </div>
              </td>
              <td class="outlook">{p.snowLevelFt === null ? '--' : fmtFt(p.snowLevelFt)}</td>
              <td>{p.gustMph ?? '--'}</td>
            </tr>
          {/each}
        {/each}
      </tbody>
    </table>
  </div>
  <button class="more" onclick={() => (showAll = !showAll)}>{showAll ? 'Show 10 days' : `Show all ${f.days.length} days`}</button>
</section>

<style>
  .table-card {
    padding: 8px 0 12px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 7px 6px;
    text-align: center;
    white-space: nowrap;
  }
  thead th {
    font-size: 13px;
    color: var(--muted);
    font-weight: 700;
  }
  .day {
    text-align: left;
    padding-left: 14px;
    vertical-align: middle;
    border-bottom: 1px solid var(--hairline);
  }
  .day span {
    display: block;
    font-weight: 600;
  }
  tr.night td {
    background: color-mix(in srgb, var(--card-2) 70%, transparent);
  }
  tr.dayend td {
    border-bottom: 1px solid var(--hairline);
  }
  .temp {
    font-weight: 700;
  }
  .acc {
    color: var(--accent);
  }
  .outlook {
    color: var(--outlook);
  }
  .ic :global(svg) {
    margin: 0 auto;
  }
  .snowcol {
    min-width: 128px;
    text-align: left;
  }
  .barwrap {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 22px;
  }
  .barwrap i {
    display: block;
    height: 22px;
    max-width: 72px;
    border-radius: 0 4px 4px 0;
    background: var(--snow);
  }
  .barwrap i.big {
    background: var(--snow-big);
  }
  .barwrap span {
    font-weight: 800;
  }
  .barwrap span.zero {
    font-weight: 400;
    color: var(--muted);
  }
  .more {
    display: block;
    margin: 10px auto 0;
    border: 0;
    background: none;
    color: var(--accent);
    font-weight: 700;
    cursor: pointer;
  }
</style>
