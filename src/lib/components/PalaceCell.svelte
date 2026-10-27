<script lang="ts">
  // PalaceCell：宫位格。移植自 Sample/components/PalaceCell.tsx；
  // 透传 onSiHuaClick（大限/流年视图下的叠加四化 badge 可点 → 飞化解读，设计文档 §9-14）。
  import { BRANCHES, STEMS } from "@/lib/engine/constants";
  import type { Palace, Star } from "@/lib/engine/types";

  interface Props {
    palace: Palace;
    onclick?: () => void;
    onStarClick?: (star: Star) => void;
    isSelected?: boolean;
    isSanFang?: boolean;
    delay?: number;
    /** 叠加四化：星名 → 四化类型 */
    overlayStarSiHua?: Record<string, string>;
    /** 叠加标签：'年'（流年）或 '限'（大限） */
    overlayLabel?: string;
    onSiHuaClick?: (starName: string, siHua: string) => void;
  }

  let {
    palace,
    onclick,
    onStarClick,
    isSelected = false,
    isSanFang = false,
    delay = 0,
    overlayStarSiHua,
    overlayLabel,
    onSiHuaClick,
  }: Props = $props();

  // 有意只捕获 palace 的初始值：同一宫位的单元格在组件生命周期内数据不变，
  // 新盘由父级 {#key chart} 强制重挂载。
  // svelte-ignore state_referenced_locally
  const { branch, stem, name, stars, daXianAge, isCurrentDaXian, isMingGong, isShenGong } = palace;
  const ganzhi = `${STEMS[stem]}${BRANCHES[branch]}`;

  const majorStars = stars.filter((s) => s.type === "major");
  const luckyStars = stars.filter((s) => s.type === "lucky");
  const shaStars = stars.filter((s) => s.type === "sha");

  function starClick(e: MouseEvent, star: Star) {
    e.stopPropagation();
    onStarClick?.(star);
  }

  function sihuaClick(e: MouseEvent, starName: string, siHua: string) {
    e.stopPropagation();
    onSiHuaClick?.(starName, siHua);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class="cell"
  class:current={isCurrentDaXian}
  class:selected={isSelected}
  class:sanfang={isSanFang && !isSelected}
  class:ming={isMingGong && !isCurrentDaXian && !isSelected && !isSanFang}
  style:animation-delay={`${delay}s`}
  onclick={onclick}
>
  {#if daXianAge}
    <div class="ages" class:cur={isCurrentDaXian}>{daXianAge[0]}–{daXianAge[1]}</div>
  {/if}

  <div class="name-row">
    <span class="pname" class:ming-name={isMingGong} class:shen-name={isShenGong}>{name}</span>
    {#if isMingGong}<span class="tag ming-tag">命</span>{/if}
    {#if isShenGong}<span class="tag shen-tag">身</span>{/if}
  </div>

  <div class="ganzhi">{ganzhi}</div>

  <div class="star-col">
    {#if majorStars.length === 0}
      <span class="empty">空宫</span>
    {/if}
    {#each majorStars as star}
      <div class="star-line" onclick={(e) => starClick(e, star)}>
        <span
          class="star-name"
          class:bright={star.brightness === "bright"}
          class:dimmed={star.brightness === "dim"}
        >{star.name}</span>
        {#if star.siHua}<span class="badge {star.siHua}">{star.siHua}</span>{/if}
        {#if overlayStarSiHua?.[star.name]}
          <button
            class="badge overlay {overlayStarSiHua[star.name]}"
            onclick={(e) => sihuaClick(e, star.name, overlayStarSiHua![star.name])}
          >
            {#if overlayLabel}<span class="ov-label">{overlayLabel}</span>{/if}{overlayStarSiHua[star.name]}
          </button>
        {/if}
      </div>
    {/each}
  </div>

  {#if luckyStars.length > 0}
    <div class="aux-row">
      {#each luckyStars as s}
        <span class="lucky">
          {s.name}
          {#if s.siHua}<span class="badge {s.siHua}">{s.siHua}</span>{/if}
          {#if overlayStarSiHua?.[s.name]}
            <button
              class="badge overlay {overlayStarSiHua[s.name]}"
              onclick={(e) => sihuaClick(e, s.name, overlayStarSiHua![s.name])}
            >
              {#if overlayLabel}<span class="ov-label">{overlayLabel}</span>{/if}{overlayStarSiHua[s.name]}
            </button>
          {/if}
        </span>
      {/each}
    </div>
  {/if}

  {#if shaStars.length > 0}
    <div class="aux-row">
      {#each shaStars as s}
        <span class="sha">{s.name}{#if s.siHua}<span class="badge {s.siHua}">{s.siHua}</span>{/if}</span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .cell {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 6px;
    min-height: 90px;
    height: 100%;
    cursor: pointer;
    background: var(--t-bg);
    box-shadow: none;
    transition: background 0.2s, box-shadow 0.2s;
    animation: cell-in 0.35s ease-out both;
  }
  @keyframes cell-in {
    from { opacity: 0; transform: scale(0.92); }
    to { opacity: 1; transform: scale(1); }
  }
  .cell:hover {
    filter: brightness(1.15);
  }
  .cell.current {
    background: rgba(147, 51, 234, 0.08);
    box-shadow: inset 3px 0 0 rgba(147, 51, 234, 0.5);
  }
  .cell.selected {
    background: rgba(37, 99, 235, 0.18);
    box-shadow: inset 0 0 0 1.5px rgba(37, 99, 235, 0.7);
  }
  .cell.sanfang {
    background: rgba(37, 99, 235, 0.09);
    box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.4);
  }
  .cell.ming {
    background: rgba(212, 168, 67, 0.04);
  }
  .ages {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 9px;
    font-family: var(--mono, monospace);
    color: var(--t-faint);
    opacity: 0.75;
  }
  .ages.cur {
    color: #c084fc;
    opacity: 1;
  }
  .name-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 2px;
    padding-right: 32px;
  }
  .pname {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--t-faint);
  }
  .pname.ming-name {
    color: #f59e0b;
  }
  .pname.shen-name {
    color: #0ea5e9;
  }
  .tag {
    font-size: 7px;
    padding: 0 2px;
    border-radius: 3px;
    line-height: 1.4;
  }
  .ming-tag {
    color: rgba(245, 158, 11, 0.8);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  .shen-tag {
    color: rgba(14, 165, 233, 0.8);
    border: 1px solid rgba(14, 165, 233, 0.3);
  }
  .ganzhi {
    font-size: 9px;
    font-family: var(--mono, monospace);
    margin-bottom: 4px;
    color: var(--t-faint);
    opacity: 0.75;
  }
  .star-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }
  .empty {
    font-size: 10px;
    font-style: italic;
    color: var(--t-faint);
    opacity: 0.6;
  }
  .star-line {
    display: flex;
    align-items: center;
  }
  .star-name {
    font-size: 13px;
    line-height: 1.25;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #f59e0b;
    cursor: pointer;
    transition: filter 0.15s;
  }
  .star-name:hover {
    filter: brightness(1.25);
  }
  .star-name.bright {
    color: #fcd34d;
  }
  .star-name.dimmed {
    color: rgba(180, 83, 9, 0.8);
  }
  .badge {
    display: inline-flex;
    align-items: center;
    font-size: 8px;
    padding: 0 4px;
    border-radius: 999px;
    border: 1px solid;
    line-height: 1.5;
    font-weight: 700;
    margin-left: 4px;
    flex-shrink: 0;
    background: none;
  }
  .badge.禄 { color: #4ade80; background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.3); }
  .badge.权 { color: #60a5fa; background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.3); }
  .badge.科 { color: #facc15; background: rgba(234, 179, 8, 0.1); border-color: rgba(234, 179, 8, 0.3); }
  .badge.忌 { color: #f87171; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); }
  .badge.overlay {
    border-style: dashed;
    opacity: 0.8;
    cursor: pointer;
  }
  .badge.overlay:hover {
    opacity: 1;
  }
  .ov-label {
    margin-right: 1px;
    opacity: 0.7;
  }
  .aux-row {
    display: flex;
    flex-wrap: wrap;
    column-gap: 4px;
    margin-top: 2px;
  }
  .lucky {
    display: inline-flex;
    align-items: center;
    font-size: 9px;
    color: rgba(14, 165, 233, 0.7);
    line-height: 1.3;
  }
  .lucky .badge {
    font-size: 7px;
    padding: 0 2px;
    margin-left: 2px;
  }
  .sha {
    font-size: 9px;
    color: rgba(239, 68, 68, 0.6);
    line-height: 1.3;
  }
  .sha :global(.badge) {
    font-size: 7px;
    padding: 0 2px;
  }
</style>
