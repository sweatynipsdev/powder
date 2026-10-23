<script lang="ts">
  // The OpenSnow-style 5-day grid: daytime and overnight snow, temps, snow level, gusts.
  import type { Elev, ForecastData } from '../../shared/types';
  import { fmtFt, fmtSnow } from '../lib/display';

  interface Props {
    forecast: ForecastData;
    elevation: Elev;
  }

  let { forecast: f, elevation }: Props = $props();
  let days = $derived(
    f.days.slice(0, 5).map((d, i) => ({ d, day: f.periods[2 * i], night: f.periods[2 * i + 1] })),
  );
  const big = (x: number | null) => (x ?? 0) >= 1;
</script>

<section class="card" aria-labelledby="five-day">
  <h2 id="five-day">Next 5 days</h2>
  <div class="scroll">
    <table class="data grid">
      <thead>
        <tr>
          <th scope="col"><span class="visually-hidden">Period</span></th>
          {#each days as { d } (d.date)}<th scope="col">{d.label}</th>{/each}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Day snow</th>
          {#each days as { day } (day.start)}
            <td class:big={big(day.snow[elevation].blend)}>{fmtSnow(day.snow[elevation].blend)}"</td>
          {/each}
        </tr>
        <tr>
          <th scope="row">Night snow</th>
          {#each days as { night } (night.start)}
            <td class:big={big(night.snow[elevation].blend)}>{fmtSnow(night.snow[elevation].blend)}"</td>
          {/each}
        </tr>
        <tr>
          <th scope="row">Hi / Lo °F</th>
          {#each days as { d } (d.date)}<td>{d.tempF[elevation].max ?? '—'} / {d.tempF[elevation].min ?? '—'}</td>{/each}
        </tr>
        <tr>
          <th scope="row">Snow level</th>
          {#each days as { d } (d.date)}<td>{d.snowLevelFt.min === null ? '—' : `${fmtFt(Math.round(d.snowLevelFt.min / 100) * 100)}`}</td>{/each}
        </tr>
        <tr>
          <th scope="row">Max gust</th>
          {#each days as { d } (d.date)}<td>{d.gustMph ?? '—'}</td>{/each}
        </tr>
        <tr>
          <th scope="row">Rain at base</th>
          {#each days as { day, night } (day.start)}<td>{day.rainAtBase || night.rainAtBase ? 'yes' : '—'}</td>{/each}
        </tr>
      </tbody>
    </table>
  </div>
  <p class="small muted">Day 5am–5pm, night 5pm–5am. Snow level is the lowest that day, in feet; gusts in mph.</p>
</section>

<style>
  h2 {
    margin-bottom: 6px;
  }
  .scroll {
    overflow-x: auto;
  }
  .grid th[scope='row'] {
    text-align: left;
    color: var(--text-muted);
    font-weight: 500;
    white-space: nowrap;
  }
  .grid td {
    color: var(--text-secondary);
  }
  .grid td.big {
    color: var(--text-primary);
    font-weight: 700;
  }
  p {
    margin: 8px 0 0;
  }
</style>
