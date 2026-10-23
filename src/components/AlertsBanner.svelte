<script lang="ts">
  // Weather alerts (NWS, or ECCC in Canada). Winter products (storm warnings, high wind) lead; others are listed quietly.
  import type { Alert } from '../../shared/types';

  interface Props {
    alerts: Pick<Alert, 'event' | 'headline' | 'winter' | 'source'>[];
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
        <!-- ECCC alerts are shown exactly as issued and credited, as their licence asks. -->
        {#if full?.description}<p class="small secondary text">{full.description}</p>{/if}
        {#if (full?.source ?? a.source) === 'ECCC'}<p class="small muted">Source: Environment and Climate Change Canada</p>{/if}
      </details>
    {/each}
  </section>
{/if}

<style>
  .alerts {
    display: grid;
    gap: 6px;
  }
  .text {
    white-space: pre-line;
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
