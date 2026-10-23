<script lang="ts">
  // The snow summary strip: what fell, the last 24 hours, then the next 16 days in
  // groups, scrolled so "Last 24 Hours" leads. Tap a day for its details.
  import type { Elev, ForecastData, Last24, SnowAmount, SnowQuality } from '../../shared/types';
  import {
    BIG_DAY_IN,
    clockTime,
    dayNum,
    fmtDay,
    fmtFt,
    fmtSnow,
    fmtSnowRange,
    isWeekend,
    QUALITY_LABEL,
    weekdayOf,
  } from '../lib/display';

  interface Props {
    forecast: ForecastData;
    elevation: Elev;
    observed: { date: string; inches: number | null }[];
    last24: Last24;
    tz: string;
  }

  let { forecast: f, elevation, observed, last24, tz }: Props = $props();

  const BAR_H = 92;

  interface Col {
    date: string;
    inches: number | null;
    amount?: SnowAmount;
    quality?: SnowQuality | null;
    index?: number;
  }

  function qualityOfDay(i: number): SnowQuality | null {
    const [d, n] = [f.periods[2 * i], f.periods[2 * i + 1]];
    if (!d || !n) return null;
    const pick = (d.snow[elevation].blend ?? 0) >= (n.snow[elevation].blend ?? 0) ? d : n;
    return (f.days[i].snow[elevation].blend ?? 0) >= 1 ? pick.quality[elevation] : null;
  }

  const forecastCols = (from: number, to: number): Col[] =>
    f.days.slice(from, to + 1).map((d, k) => ({
      date: d.date,
      inches: d.snow[elevation].blend,
      amount: d.snow[elevation],
      quality: qualityOfDay(from + k),
      index: from + k,
    }));

  let groups = $derived([
    { key: 'd1_5', label: 'Next 1–5 Days', total: f.buckets.d1_5[elevation], cols: forecastCols(0, 4), outlook: false },
    { key: 'd6_10', label: 'Next 6–10 Days', total: f.buckets.d6_10[elevation], cols: forecastCols(5, 9), outlook: true },
    { key: 'd11_16', label: 'Next 11–16 Days', total: f.buckets.d11_16[elevation], cols: forecastCols(10, 15), outlook: true },
  ]);
  let prevCols = $derived<Col[]>(observed.slice(-5));
  let prevTotal = $derived(prevCols.some((c) => c.inches !== null) ? prevCols.reduce((s, c) => s + (c.inches ?? 0), 0) : null);
  let max = $derived(
    Math.max(6, ...f.days.map((d) => Math.max(d.snow[elevation].blend ?? 0, d.snow[elevation].range?.hi ?? 0)), ...prevCols.map((c) => c.inches ?? 0)),
  );

  let selected = $state<number | null>(null);
  let scroller = $state<HTMLDivElement>();
  let nowBox = $state<HTMLElement>();

  // Open on "Last 24 Hours", with the previous days a swipe to the left.
  $effect(() => {
    // Measured against the scroller itself; offsetLeft would count the card's padding too.
    if (scroller && nowBox)
      scroller.scrollLeft = nowBox.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft - 6;
  });

  let detail = $derived.by(() => {
    if (selected === null) return null;
    const d = f.days[selected];
    const day = f.periods[2 * selected];
    const night = f.periods[2 * selected + 1];
    return {
      title: fmtDay(d.date),
      amount: d.snow[elevation],
      day: day?.snow[elevation].blend ?? null,
      night: night?.snow[elevation].blend ?? null,
      confidence: d.confidence,
      snowLevel: d.snowLevelFt,
      quality: qualityOfDay(selected),
    };
  });
</script>

{#snippet column(c: Col, observedCol: boolean)}
  {@const v = c.inches ?? 0}
  {@const big = v >= BIG_DAY_IN}
  <button
    class="col"
    class:sel={c.index !== undefined && selected === c.index}
    disabled={c.index === undefined}
    onclick={() => (selected = selected === c.index ? null : (c.index ?? null))}
    aria-label={`${fmtDay(c.date)}: ${fmtSnow(c.inches)} inches${c.amount?.range ? `, likely ${fmtSnowRange(c.amount.range)}` : ''}`}
  >
    <div class="bararea" style:height="{BAR_H}px">
      {#if c.amount?.range && c.amount.range.hi - c.amount.range.lo >= 1}
        <div class="range" style:height="{(c.amount.range.hi / max) * BAR_H}px"></div>
      {/if}
      {#if v >= 0.5}<span class="val" style:bottom="{Math.min(BAR_H - 14, (v / max) * BAR_H + 2)}px">{fmtSnow(v)}"</span>{/if}
      <div class="bar" class:big class:obs={observedCol} style:height="{v > 0.04 ? Math.max(3, (v / max) * BAR_H) : 0}px"></div>
    </div>
    <span class="dow" class:weekend={isWeekend(c.date)}>{weekdayOf(c.date)[0]}</span>
    <span class="dnum" class:weekend={isWeekend(c.date)}>{dayNum(c.date)}</span>
    <span class="q {c.quality ?? ''}" title={c.quality ? QUALITY_LABEL[c.quality] : ''}></span>
  </button>
{/snippet}

<section class="card wrap" aria-label="Snow summary">
  <div class="timeline hscroll" bind:this={scroller}>
    <div class="seg">
      <div class="seghead">
        <span class="seglabel">Prev 1–5 Days</span>
        <div class="bracket"><span class="line"></span><strong>{prevTotal === null ? '—' : `${fmtSnow(prevTotal)}"`}</strong><span class="line"></span></div>
      </div>
      <div class="cols">
        {#each prevCols as c (c.date)}{@render column(c, true)}{/each}
      </div>
    </div>

    <div class="now" bind:this={nowBox}>
      <span class="nowlabel">Last 24 Hours</span>
      <div class="nowval">{last24.inches === null ? '—' : `${fmtSnow(last24.inches)}"`}</div>
      <span class="small muted">{last24.at ? clockTime(last24.at.length <= 16 ? `${last24.at}:00-08:00` : last24.at, tz) : ''}</span>
      {#if last24.source === 'estimated'}<span class="badge">Estimated</span>{:else if last24.source === 'reported'}<span class="badge reported">Reported</span>{/if}
    </div>

    {#each groups as g (g.key)}
      <div class="seg">
        <div class="seghead">
          <span class="seglabel">{g.label}</span>
          <div class="bracket" class:outlook={g.outlook}>
            <span class="line"></span><strong>{fmtSnow(g.total.blend)}"</strong><span class="line"></span>
          </div>
        </div>
        <div class="cols">
          {#each g.cols as c (c.date)}{@render column(c, false)}{/each}
        </div>
      </div>
    {/each}
  </div>

  {#if detail}
    <div class="detail">
      <div class="dhead">
        <strong>{detail.title}</strong>
        <span>{fmtSnow(detail.amount.blend)}" {#if detail.amount.range && fmtSnowRange(detail.amount.range) !== fmtSnow(detail.amount.blend)}<span class="muted">likely {fmtSnowRange(detail.amount.range)}"</span>{/if}</span>
      </div>
      <div class="dgrid small">
        <span class="muted">Day 5a–5p</span><span>{fmtSnow(detail.day)}"</span>
        <span class="muted">Night 5p–5a</span><span>{fmtSnow(detail.night)}"</span>
        {#if detail.confidence}<span class="muted">Confidence</span><span>{detail.confidence}</span>{/if}
        {#if detail.snowLevel.min !== null}<span class="muted">Snow level</span><span>{fmtFt(detail.snowLevel.min)}–{fmtFt(detail.snowLevel.max)} ft</span>{/if}
        {#if detail.quality}<span class="muted">Powder quality</span><span>{QUALITY_LABEL[detail.quality]}</span>{/if}
      </div>
    </div>
  {:else}
    <p class="hint small muted">Tap a day for details · <span class="qkey excellent"></span> Excellent <span class="qkey good"></span> Good <span class="qkey okay"></span> Okay powder · orange bars are 6"+ days</p>
  {/if}
</section>

<style>
  .wrap {
    padding: 14px 0 12px;
  }
  .timeline {
    display: flex;
    align-items: stretch;
    gap: 6px;
    padding: 0 12px;
  }
  .seg {
    flex: none;
    display: grid;
    align-content: start;
  }
  .seghead {
    display: grid;
    justify-items: center;
    gap: 2px;
    margin-bottom: 4px;
  }
  .seglabel {
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
  }
  .bracket {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    font-size: 18px;
  }
  .bracket.outlook strong {
    color: var(--outlook);
  }
  .bracket .line {
    flex: 1;
    height: 3px;
    border-radius: 2px;
    background: var(--axis);
  }
  .cols {
    display: flex;
  }
  .col {
    width: 40px;
    display: grid;
    justify-items: center;
    gap: 1px;
    padding: 0 0 4px;
    border: 0;
    background: none;
    border-radius: 8px;
    cursor: pointer;
  }
  .col:disabled {
    cursor: default;
  }
  .col.sel {
    background: var(--card-3);
  }
  .bararea {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    border-bottom: 1px solid var(--axis);
  }
  .bar {
    width: 22px;
    border-radius: 4px 4px 0 0;
    background: var(--snow);
    position: relative;
    z-index: 1;
  }
  .bar.big {
    background: var(--snow-big);
  }
  .bar.obs {
    background: color-mix(in srgb, var(--snow) 55%, var(--muted));
  }
  .range {
    position: absolute;
    bottom: 0;
    width: 30px;
    border-radius: 5px 5px 0 0;
    background: var(--wash-1);
  }
  .val {
    position: absolute;
    z-index: 2;
    font-size: 11px;
    font-weight: 800;
    color: var(--text);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .dow {
    margin-top: 3px;
    font-size: 13px;
    color: var(--text-2);
  }
  .dnum {
    font-size: 13px;
    color: var(--muted);
  }
  .dow.weekend,
  .dnum.weekend {
    color: var(--text);
    font-weight: 800;
  }
  .q {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    margin-top: 2px;
  }
  .q.excellent,
  .qkey.excellent {
    background: var(--snow-big);
  }
  .q.good,
  .qkey.good {
    background: var(--snow);
  }
  .q.okay,
  .qkey.okay {
    background: var(--muted);
  }
  .qkey {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin: 0 2px 0 6px;
  }
  .now {
    flex: none;
    width: 150px;
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 4px;
    padding: 10px 8px;
    background: var(--card-2);
    border-radius: 12px;
  }
  .nowlabel {
    font-size: 15px;
    font-weight: 800;
  }
  .nowval {
    display: grid;
    place-items: center;
    width: 100%;
    padding: 12px 0;
    border-radius: 10px;
    background: var(--card-3);
    font-size: 44px;
    font-weight: 900;
    line-height: 1;
  }
  .badge.reported {
    color: var(--open);
  }
  .hint {
    margin: 10px 14px 0;
  }
  .detail {
    margin: 10px 12px 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--card-2);
  }
  .dhead {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .dgrid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 14px;
  }
</style>
