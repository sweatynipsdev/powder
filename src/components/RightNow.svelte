<script lang="ts">
  import type { Elev, ForecastData, SnowpackData } from '../../shared/types';
  import { compass, hourLabel, weekdayOf } from '../lib/display';
  import WeatherIcon from './icons/WeatherIcon.svelte';

  interface Props {
    forecast: ForecastData;
    elevation: Elev;
    station: SnowpackData | null;
  }

  let { forecast: f, elevation, station }: Props = $props();
  const SKY = { clear: 'Clear', partly: 'Partly cloudy', cloudy: 'Cloudy', snow: 'Snow', rain: 'Rain', mix: 'Rain and snow' } as const;
  let h = $derived(f.hourly);
  let t = $derived(h.time[0]);
  let night = $derived(t ? Number(t.slice(11, 13)) < 6 || Number(t.slice(11, 13)) >= 18 : false);
</script>

{#if t}
  <section class="card now">
    <div class="row">
      <div class="big">
        <WeatherIcon icon={h.icon[0]} {night} size={40} />
        <strong>{h.tempF[elevation][0] ?? '—'}</strong><span class="unit">°F</span>
      </div>
      <div class="big">
        <svg width="34" height="24" viewBox="0 0 34 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 8h20a4 4 0 1 0-4-4" /><path d="M2 14h26a4 4 0 1 1-4 4" /></g></svg>
        <strong>{h.windMph[0] ?? '—'}</strong><span class="unit">mph</span>
      </div>
    </div>
    <div class="row sub secondary">
      <span>{SKY[h.icon[0]]}{h.popPct[0] !== null ? ` · ${h.popPct[0]}% precip` : ''}</span>
      <span>{compass(h.windDir[0])} gusts to <strong>{h.gustMph[0] ?? '—'}</strong> mph</span>
    </div>
    <footer class="small muted">
      Forecast for {hourLabel(t)} {weekdayOf(t)} at the {elevation}{station?.tempF !== null && station?.tempF !== undefined
        ? ` · ${station.station.name} reads ${station.tempF}°F`
        : ''}
    </footer>
  </section>
{/if}

<style>
  .now {
    display: grid;
    gap: 6px;
    padding-bottom: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: center;
  }
  .big {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text);
  }
  .big strong {
    font-size: 40px;
    font-weight: 800;
    line-height: 1;
  }
  .unit {
    font-size: 24px;
    color: var(--muted);
  }
  .sub {
    font-size: 15px;
  }
  footer {
    margin: 6px -16px 0;
    padding: 10px 16px 12px;
    border-top: 1px solid var(--hairline);
  }
</style>
