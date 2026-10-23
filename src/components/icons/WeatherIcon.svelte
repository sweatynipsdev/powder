<script lang="ts">
  // Line-drawn weather glyphs in the current text color. `night` swaps the sun for a moon.
  import type { WeatherIcon } from '../../../shared/types';

  interface Props {
    icon: WeatherIcon;
    night?: boolean;
    size?: number;
  }

  let { icon, night = false, size = 26 }: Props = $props();
  const LABEL: Record<WeatherIcon, string> = {
    clear: 'Clear',
    partly: 'Partly cloudy',
    cloudy: 'Cloudy',
    snow: 'Snow',
    rain: 'Rain',
    mix: 'Rain and snow',
  };
</script>

<svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={LABEL[icon]}>
  <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    {#if icon === 'clear' || icon === 'partly'}
      {#if night}
        <path d="M17 6a9 9 0 1 0 9 11a7 7 0 0 1-9-11z" />
      {:else}
        <circle cx={icon === 'partly' ? 12 : 16} cy={icon === 'partly' ? 12 : 16} r="5" />
        {#each [0, 45, 90, 135, 180, 225, 270, 315] as a (a)}
          {@const cx = icon === 'partly' ? 12 : 16}
          {@const r1 = 8}
          {@const r2 = 10.5}
          <line
            x1={cx + r1 * Math.cos((a * Math.PI) / 180)}
            y1={cx + r1 * Math.sin((a * Math.PI) / 180)}
            x2={cx + r2 * Math.cos((a * Math.PI) / 180)}
            y2={cx + r2 * Math.sin((a * Math.PI) / 180)}
          />
        {/each}
      {/if}
      {#if icon === 'partly'}
        <path d="M13 26h11a5 5 0 0 0 0-10a7 7 0 0 0-13 2a4 4 0 0 0 2 8z" fill="var(--card)" />
      {/if}
    {:else}
      <path d="M9 21h14a5 5 0 0 0 0-10a8 8 0 0 0-15 2a4.5 4.5 0 0 0 1 8z" />
      {#if icon === 'snow' || icon === 'mix'}
        <g stroke-width="1.6">
          {#each icon === 'snow' ? [10, 16, 22] : [12] as x (x)}
            <line x1={x - 2} y1="26" x2={x + 2} y2="26" />
            <line x1={x} y1="24" x2={x} y2="28" />
          {/each}
        </g>
      {/if}
      {#if icon === 'rain' || icon === 'mix'}
        {#each icon === 'rain' ? [11, 16, 21] : [20] as x (x)}
          <line x1={x} y1="24" x2={x - 1.5} y2="28" />
        {/each}
      {/if}
    {/if}
  </g>
</svg>

<style>
  svg {
    display: block;
    color: var(--text-2);
  }
</style>
