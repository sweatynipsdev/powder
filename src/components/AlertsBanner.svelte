<script lang="ts">
  // NWS alerts. Winter products (storm warnings, high wind) lead; others are listed quietly.
  import type { Alert } from '../../shared/types';

  interface Props {
    alerts: Pick<Alert, 'event' | 'headline' | 'winter'>[];
    detailed?: Alert[];
  }

  let { alerts, detailed }: Props = $props();
  let sorted = $derived([...alerts].sort((a, b) => Number(b.winter) - Number(a.winter)));
  const tone = (a: { event: string; winter: boolean }) =>
    /warning/i.test(a.event) ? 'critical' : a.winter ? 'serious' : 'neutral';
</script>

{#if sorted.length}
  <section class="alerts" aria-label="Weather alerts">
    {#each sorted as a, i (a.headline + i)}
      {@const full = detailed?.find((d) => d.headline === a.headline)}
      <details class="alert {tone(a)}">
        <summary>
          <span class="status {tone(a)}"><span class="dot"></span>{a.event}</span>
        </summary>
        <p class="small secondary">{a.headline}</p>
        {#if full?.description}<p class="small secondary">{full.description}</p>{/if}
      </details>
    {/each}
  </section>
{/if}

<style>
  .alerts {
    display: grid;
    gap: 6px;
  }
  .alert {
    background: var(--card);
    border: 1px solid var(--hairline);
    border-radius: 12px;
    padding: 8px 12px;
  }
  .alert.critical {
    border-color: color-mix(in srgb, var(--critical) 55%, transparent);
  }
  summary {
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  p {
    margin: 6px 0 0;
  }
</style>
