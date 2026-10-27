<script lang="ts">
  // ChartBoard —— 移植自 Sample/components/ChartBoard.tsx（网格布局/SVG 连线/叠加四化全保留）
  import { BRANCHES } from "@/lib/engine/constants";
  import type { Palace, Star, ZiweiChart } from "@/lib/engine/types";
  import PalaceCell from "./PalaceCell.svelte";
  import TimeNav, { type TimeView } from "./TimeNav.svelte";
  import { buildSiHuaOverlay, getYearStemIndex } from "./time-utils";

  interface Props {
    chart: ZiweiChart;
    onStarSelect?: (star: Star, palace: Palace) => void;
    onPalaceSelect?: (palace: Palace) => void;
    onSiHuaClick?: (starName: string, siHua: string, view: TimeView) => void;
  }

  let { chart, onStarSelect, onPalaceSelect, onSiHuaClick }: Props = $props();

  const BRANCH_GRID_POS: Record<number, [number, number]> = {
    5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4],
    4: [2, 1], 9: [2, 4],
    3: [3, 1], 10: [3, 4],
    2: [4, 1], 1: [4, 2], 0: [4, 3], 11: [4, 4],
  };

  const BRANCH_SVG_POS: Record<number, [number, number]> = {
    5: [12.5, 12.5], 6: [37.5, 12.5], 7: [62.5, 12.5], 8: [87.5, 12.5],
    4: [12.5, 37.5], 9: [87.5, 37.5],
    3: [12.5, 62.5], 10: [87.5, 62.5],
    2: [12.5, 87.5], 1: [37.5, 87.5], 0: [62.5, 87.5], 11: [87.5, 87.5],
  };

  const CLOCKWISE_INDEX: Record<number, number> = {
    5: 0, 6: 1, 7: 2, 8: 3, 9: 4, 10: 5, 11: 6, 0: 7, 1: 8, 2: 9, 3: 10, 4: 11,
  };

  function sortClockwise(branches: number[]): number[] {
    return [...branches].sort((a, b) => CLOCKWISE_INDEX[a] - CLOCKWISE_INDEX[b]);
  }

  /** 三方四正：本宫 + 对宫 + 两个三合宫 */
  function getSanFangSiZheng(branch: number): [number, number, number, number] {
    return [branch, (branch + 6) % 12, (branch + 4) % 12, (branch + 8) % 12];
  }

  const ANIMATION_ORDER = [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4];

  let selectedBranch = $state<number | null>(null);
  let timeView = $state<TimeView>("mingpan");
  let liunianYear = $state<number>(new Date().getFullYear());

  const palaceMap = $derived.by(() => {
    const map: Record<number, Palace> = {};
    chart.palaces.forEach((p) => (map[p.branch] = p));
    return map;
  });

  const currentDx = $derived(chart.daXians[chart.currentDaXianIndex]);
  const overlayData = $derived.by<Record<string, string>>(() => {
    if (timeView === "daxian" && currentDx) {
      const dxPalace = chart.palaces.find((p) => p.branch === currentDx.palaceBranch);
      if (dxPalace) return buildSiHuaOverlay(dxPalace.stem);
    }
    if (timeView === "liunian") {
      return buildSiHuaOverlay(getYearStemIndex(liunianYear));
    }
    return {};
  });
  const overlayLabel = $derived(
    timeView === "daxian" ? "限" : timeView === "liunian" ? "年" : undefined,
  );

  function handlePalaceClick(branch: number) {
    const isDeselecting = selectedBranch === branch;
    selectedBranch = isDeselecting ? null : branch;
    if (!isDeselecting) {
      const palace = palaceMap[branch];
      if (palace) onPalaceSelect?.(palace);
    }
  }

  const sanFangBranches = $derived(
    selectedBranch !== null ? getSanFangSiZheng(selectedBranch) : null,
  );
  const sanFangSet = $derived(sanFangBranches ? new Set(sanFangBranches) : null);

  const curDx = $derived(
    chart.currentDaXianIndex >= 0 ? chart.daXians[chart.currentDaXianIndex] : undefined,
  );
</script>

<div class="board">
  <TimeNav
    {chart}
    view={timeView}
    {liunianYear}
    onViewChange={(v) => (timeView = v)}
    onYearChange={(y) => (liunianYear = y)}
  />

  <div class="title">
    <div class="en">Zi Wei Dou Shu</div>
    <h2>{chart.birthInfo.name ? `${chart.birthInfo.name} · ` : ""}紫微斗数命盘</h2>
  </div>

  <div class="grid">
    {#each ANIMATION_ORDER as branch}
      {@const [row, col] = BRANCH_GRID_POS[branch]}
      {@const palace = palaceMap[branch]}
      {#if palace}
        <div style:grid-row={row} style:grid-column={col}>
          <PalaceCell
            palace={palace}
            onclick={() => handlePalaceClick(branch)}
            onStarClick={(star) => onStarSelect?.(star, palace)}
            isSelected={selectedBranch === branch}
            isSanFang={!!(sanFangSet?.has(branch) && selectedBranch !== branch)}
            delay={0}
            overlayStarSiHua={Object.keys(overlayData).length > 0 ? overlayData : undefined}
            {overlayLabel}
            onSiHuaClick={(starName, siHua) => onSiHuaClick?.(starName, siHua, timeView)}
          />
        </div>
      {/if}
    {/each}

    <div class="center">
      <div class="taiji">☯</div>
      <div class="facts">
        <div class="facts-title">紫微斗数</div>
        <div class="fact-row">命宫 <span class="gold">{BRANCHES[chart.mingGongBranch]}</span></div>
        <div class="fact-row">身宫 <span class="sky">{BRANCHES[chart.shenGongBranch]}</span></div>
        <div class="fact-ju">{chart.wuxingJuName}</div>
      </div>

      {#if curDx}
        <div class="daxian">
          <div class="dx-label">当前大限</div>
          <div class="dx-age">{curDx.startAge}–{curDx.endAge}岁</div>
          <div class="dx-palace">{curDx.palaceName}</div>
        </div>
      {/if}

      <div class="lunar">
        {chart.lunarInfo.lunarYear}·{chart.lunarInfo.isLeapMonth ? "闰" : ""}{chart.lunarInfo.lunarMonth}·{chart.lunarInfo.lunarDay}
      </div>
    </div>

    {#if sanFangBranches}
      {@const p0 = BRANCH_SVG_POS[sanFangBranches[0]]}
      {@const p1 = BRANCH_SVG_POS[sanFangBranches[1]]}
      {@const p2 = BRANCH_SVG_POS[sanFangBranches[2]]}
      {@const p3 = BRANCH_SVG_POS[sanFangBranches[3]]}
      <div class="svg-layer">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <line x1="{p0[0]}%" y1="{p0[1]}%" x2="{p1[0]}%" y2="{p1[1]}%" />
          <line x1="{p0[0]}%" y1="{p0[1]}%" x2="{p2[0]}%" y2="{p2[1]}%" />
          <line x1="{p2[0]}%" y1="{p2[1]}%" x2="{p3[0]}%" y2="{p3[1]}%" />
          <line x1="{p3[0]}%" y1="{p3[1]}%" x2="{p0[0]}%" y2="{p0[1]}%" />
          {#each [p0, p1, p2, p3] as p, i}
            <circle cx="{p[0]}%" cy="{p[1]}%" r="3" fill={i === 0 ? "rgba(37,99,235,0.8)" : "rgba(37,99,235,0.45)"} />
          {/each}
        </svg>
      </div>
    {/if}
  </div>

  <div class="legend">
    {#each [["化禄", "禄"], ["化权", "权"], ["化科", "科"], ["化忌", "忌"]] as [h, key]}
      <span class="lg {key}">{h}</span>
    {/each}
    <span class="lg hint-lg">点击宫位看三方四正</span>
  </div>
</div>

<style>
  .board {
    width: 100%;
    user-select: none;
  }
  .title {
    text-align: center;
    margin-bottom: 12px;
    animation: t-in 0.4s ease both;
  }
  @keyframes t-in {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .en {
    font-size: 10px;
    letter-spacing: 0.5em;
    text-transform: uppercase;
    margin-bottom: 4px;
    color: var(--t-faint);
  }
  h2 {
    font-size: 14px;
    letter-spacing: 0.25em;
    font-weight: 500;
    color: var(--t-gold);
    margin: 0;
  }
  .grid {
    position: relative;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(4, auto);
    gap: 1px;
    background: var(--t-border);
    border: 1px solid var(--t-border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 32px rgba(0, 0, 0, 0.15);
  }
  .grid > div {
    min-width: 0;
  }
  .center {
    grid-row: 2 / 4;
    grid-column: 2 / 4;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    background: var(--t-bg);
    animation: t-in 0.5s 0.3s ease both;
  }
  .taiji {
    font-size: 48px;
    line-height: 1;
    color: var(--t-gold);
    opacity: 0.12;
    filter: drop-shadow(0 0 12px rgba(180, 120, 30, 0.15));
  }
  .facts {
    text-align: center;
  }
  .facts-title {
    font-size: 9px;
    letter-spacing: 0.3em;
    font-weight: 500;
    color: var(--t-gold);
    margin-bottom: 4px;
  }
  .fact-row {
    font-size: 10px;
    color: var(--t-faint);
  }
  .fact-row .gold {
    color: var(--t-gold);
    opacity: 0.7;
  }
  .fact-row .sky {
    color: rgba(14, 165, 233, 0.7);
  }
  .fact-ju {
    font-size: 9px;
    color: var(--t-gold);
    opacity: 0.75;
  }
  .daxian {
    border: 1px solid rgba(147, 51, 234, 0.3);
    border-radius: 8px;
    padding: 6px 12px;
    text-align: center;
    background: rgba(147, 51, 234, 0.06);
  }
  .dx-label {
    font-size: 8px;
    color: rgba(192, 132, 252, 0.8);
    letter-spacing: 0.08em;
    margin-bottom: 2px;
  }
  .dx-age {
    font-size: 12px;
    color: #c084fc;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .dx-palace {
    font-size: 9px;
    color: rgba(192, 132, 252, 0.6);
  }
  .lunar {
    font-size: 8px;
    font-family: var(--mono, monospace);
    color: var(--t-faint);
    opacity: 0.75;
  }
  .svg-layer {
    position: absolute;
    inset: 0;
    z-index: 20;
    pointer-events: none;
    animation: fade 0.3s ease both;
  }
  @keyframes fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .svg-layer line {
    stroke: rgba(37, 99, 235, 0.55);
    stroke-width: 1.5;
    stroke-dasharray: 6, 5;
    stroke-linecap: round;
  }
  .legend {
    margin-top: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 9px;
    flex-wrap: wrap;
    animation: fade 0.5s 0.4s ease both;
  }
  .lg {
    border: 1px solid;
    padding: 2px 6px;
    border-radius: 999px;
    font-weight: 500;
  }
  .lg.禄 { color: #10b981; border-color: rgba(16, 185, 129, 0.3); }
  .lg.权 { color: #3b82f6; border-color: rgba(59, 130, 246, 0.3); }
  .lg.科 { color: #eab308; border-color: rgba(234, 179, 8, 0.3); }
  .lg.忌 { color: #ef4444; border-color: rgba(239, 68, 68, 0.3); }
  .hint-lg {
    color: var(--t-faint);
    border-color: var(--t-border);
  }
</style>
