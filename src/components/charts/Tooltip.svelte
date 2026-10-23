<script lang="ts">
  // One tooltip per chart. Values lead (strong), labels follow; rows keyed with a short
  // line of the series color, never a filled box.
  export interface TipRow {
    label: string;
    value: string;
    color?: string;
  }

  interface Props {
    x: number;
    width: number;
    title: string;
    rows: TipRow[];
  }

  let { x, width, title, rows }: Props = $props();
  let el = $state<HTMLDivElement>();
  let tipWidth = $derived(el?.offsetWidth ?? 160);
  // Sit beside the crosshair, flipping to the left near the right edge.
  let left = $derived(x + 12 + tipWidth > width ? Math.max(0, x - 12 - tipWidth) : x + 12);
</script>

<div class="tip" bind:this={el} style:left="{left}px" role="status" aria-live="polite">
  <div class="title small">{title}</div>
  {#each rows as row (row.label)}
    <div class="row">
      {#if row.color}<span class="key" style:background={row.color}></span>{/if}
      <strong class="tabular">{row.value}</strong>
      <span class="label">{row.label}</span>
    </div>
  {/each}
</div>

<style>
  .tip {
    position: absolute;
    top: 4px;
    z-index: 2;
    pointer-events: none;
    background: var(--card-2);
    border: 1px solid var(--hairline);
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 13px;
    min-width: 120px;
    max-width: 220px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }
  .title {
    color: var(--muted);
    margin-bottom: 4px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    line-height: 1.5;
  }
  .key {
    width: 10px;
    height: 2px;
    border-radius: 1px;
    flex: none;
  }
  strong {
    color: var(--text);
  }
  .label {
    color: var(--text-2);
  }
</style>
