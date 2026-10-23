<script lang="ts">
  import { fmtFt } from '../lib/display';
  import { prefs, setElevation } from '../lib/prefs.svelte';

  interface Props {
    summitFt?: number;
    baseFt?: number;
  }

  let { summitFt, baseFt }: Props = $props();
  let options = $derived([
    { value: 'summit' as const, label: summitFt ? `Summit ${fmtFt(summitFt)} ft` : 'Summit' },
    { value: 'base' as const, label: baseFt ? `Base ${fmtFt(baseFt)} ft` : 'Base' },
  ]);
</script>

<div class="seg" role="radiogroup" aria-label="Forecast elevation">
  {#each options as o (o.value)}
    <button role="radio" aria-checked={prefs.elevation === o.value} class:on={prefs.elevation === o.value} onclick={() => setElevation(o.value)}>
      {o.label}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    background: var(--card-2);
    border: 1px solid var(--hairline);
    border-radius: 999px;
    padding: 3px;
  }
  button {
    border: 0;
    background: none;
    padding: 5px 13px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 700;
    color: var(--text-2);
    cursor: pointer;
    white-space: nowrap;
  }
  button.on {
    background: var(--accent);
    color: #fff;
  }
</style>
