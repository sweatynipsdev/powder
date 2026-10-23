<script lang="ts">
  // 72 hours side by side, with a sticky label column; a stronger line marks midnight.
  import type { Elev, HourlyData } from '../../shared/types';
  import { compass, fmtFt, hourLabel, weekdayOf } from '../lib/display';
  import WeatherIcon from './icons/WeatherIcon.svelte';

  interface Props {
    hourly: HourlyData;
    elevation: Elev;
  }

  let { hourly: h, elevation }: Props = $props();
  const night = (t: string) => Number(t.slice(11, 13)) < 6 || Number(t.slice(11, 13)) >= 18;
  const midnight = (t: string) => t.slice(11, 13) === '01';
  const n = (v: number | null, digits = 0) => (v === null ? '--' : digits ? v.toFixed(digits) : String(v));
  const snowText = (v: number | null) => (v === null ? '--' : v < 0.05 ? '0' : v.toFixed(1));
</script>

<section class="card table-card">
  <div class="hscroll">
    <table>
      <thead>
        <tr>
          <th class="label"></th>
          {#each h.time as t (t)}
            <th class:mid={midnight(t)}><span class="hr">{hourLabel(t)}</span><span class="dow">{weekdayOf(t)}</span></th>
          {/each}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th class="label">Precip Chance <span class="u">%</span></th>
          {#each h.popPct as v, i (i)}
            <td class:mid={midnight(h.time[i])} class="pop">
              <span>{n(v)}</span><i style:width="{Math.max(10, v ?? 0)}%"></i>
            </td>
          {/each}
        </tr>
        <tr>
          <th class="label">Precipitation <span class="u">in</span></th>
          {#each h.precipIn as v, i (i)}<td class:mid={midnight(h.time[i])}>{v === null ? '--' : v < 0.005 ? '0' : v.toFixed(2)}</td>{/each}
        </tr>
        <tr>
          <th class="label">Snowfall <span class="u">in</span></th>
          {#each h.snowIn[elevation] as v, i (i)}<td class:mid={midnight(h.time[i])} class:snow={(v ?? 0) >= 0.1}>{snowText(v)}</td>{/each}
        </tr>
        <tr>
          <th class="label">Snow Ratio <span class="u acc">SLR</span></th>
          {#each h.slr as v, i (i)}<td class:mid={midnight(h.time[i])} class="acc">{v === null ? '--' : `${v}:1`}</td>{/each}
        </tr>
        <tr class="sep">
          <th class="label">Snow Level <span class="u">ft</span></th>
          {#each h.snowLevelFt as v, i (i)}<td class:mid={midnight(h.time[i])} class="outlook">{v === null ? '--' : fmtFt(v)}</td>{/each}
        </tr>
        <tr>
          <th class="label">Weather</th>
          {#each h.icon as ic, i (i)}<td class:mid={midnight(h.time[i])} class="ic"><WeatherIcon icon={ic} night={night(h.time[i])} size={24} /></td>{/each}
        </tr>
        <tr>
          <th class="label">Temperature <span class="u">°F</span></th>
          {#each h.tempF[elevation] as v, i (i)}<td class:mid={midnight(h.time[i])} class="strong">{n(v)}</td>{/each}
        </tr>
        <tr class="sep">
          <th class="label">Wind <span class="u">mph</span></th>
          {#each h.windMph as v, i (i)}<td class:mid={midnight(h.time[i])}>{compass(h.windDir[i])}{n(v)}</td>{/each}
        </tr>
        <tr>
          <th class="label">Wind Gust <span class="u">mph</span></th>
          {#each h.gustMph as v, i (i)}<td class:mid={midnight(h.time[i])}>{n(v)}</td>{/each}
        </tr>
        <tr class="sep">
          <th class="label">Cloud Cover <span class="u">%</span></th>
          {#each h.cloudPct as v, i (i)}<td class:mid={midnight(h.time[i])}>{n(v)}</td>{/each}
        </tr>
      </tbody>
    </table>
  </div>
  <p class="small muted note">Blend of the models at the {elevation}. Snowfall uses each hour's snow ratio, not a fixed 10:1.</p>
</section>

<style>
  .table-card {
    padding: 12px 0;
  }
  table {
    border-collapse: separate;
    border-spacing: 0;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 8px 6px;
    text-align: center;
    white-space: nowrap;
    min-width: 50px;
  }
  thead th {
    vertical-align: bottom;
  }
  .hr {
    display: block;
    font-weight: 800;
  }
  .dow {
    display: block;
    font-size: 12px;
    color: var(--muted);
    font-weight: 400;
  }
  .label {
    position: sticky;
    left: 0;
    z-index: 1;
    text-align: left;
    min-width: 128px;
    padding-left: 14px;
    background: var(--card);
    font-weight: 700;
    border-right: 1px solid var(--hairline);
  }
  .u {
    font-weight: 400;
    color: var(--muted);
  }
  .u.acc,
  .acc {
    color: var(--accent);
  }
  .outlook {
    color: var(--outlook);
  }
  td {
    color: var(--text-2);
  }
  td.strong {
    color: var(--text);
    font-weight: 600;
  }
  td.snow {
    color: var(--text);
    font-weight: 800;
  }
  .mid {
    border-left: 1px solid var(--axis);
  }
  tr.sep th,
  tr.sep td {
    border-bottom: 1px solid var(--hairline);
  }
  .pop {
    position: relative;
    color: var(--outlook);
    font-weight: 600;
  }
  .pop i {
    display: block;
    height: 4px;
    margin: 3px auto 0;
    border-radius: 2px;
    background: var(--outlook);
    max-width: 100%;
  }
  .ic :global(svg) {
    margin: 0 auto;
  }
  .note {
    margin: 8px 14px 0;
  }
</style>
