<script lang="ts">
  import { prefs, setElevation } from '../lib/prefs.svelte';
</script>

<div class="seg" role="radiogroup" aria-label="Forecast elevation">
  {#each [['summit', 'Summit'], ['base', 'Base']] as [value, label] (value)}
    <button
      role="radio"
      aria-checked={prefs.elevation === value}
      class:on={prefs.elevation === value}
      onclick={() => setElevation(value as 'summit' | 'base')}>{label}</button
    >
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    background: var(--surface-2);
    border: 1px solid var(--hairline);
    border-radius: 999px;
    padding: 2px;
  }
  button {
    border: 0;
    background: none;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
  }
  button.on {
    background: var(--surface-1);
    color: var(--text-primary);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
</style>
