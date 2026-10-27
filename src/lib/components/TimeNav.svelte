<script lang="ts">
  // TimeNav：本命 / 大限 / 流年切换 + 叠加四化说明行。
  // 移植自 Sample/components/TimeNav.tsx；getYearStemIndex/buildSiHuaOverlay 在 time-utils.ts。
  import { STEMS } from "@/lib/engine/constants";
  import { buildSiHuaOverlay, getYearStemIndex } from "@/lib/components/time-utils";
  import type { ZiweiChart } from "@/lib/engine/types";

  export type TimeView = "mingpan" | "daxian" | "liunian";

  interface Props {
    chart: ZiweiChart;
    view: TimeView;
    liunianYear: number;
    onViewChange: (view: TimeView) => void;
    onYearChange: (year: number) => void;
  }

  let { chart, view, liunianYear, onViewChange, onYearChange }: Props = $props();

  const SIHUA_COLORS: Record<string, string> = {
    禄: "#4ade80",
    权: "#60a5fa",
    科: "#facc15",
    忌: "#f87171",
  };

  const currentDx = $derived(chart.daXians[chart.currentDaXianIndex]);

  const overlayInfo = $derived.by<{ stemName: string; overlay: Record<string, string> } | null>(
    () => {
      if (view === "daxian" && currentDx) {
        const dxPalace = chart.palaces.find((p) => p.branch === currentDx.palaceBranch);
        if (!dxPalace) return null;
        return {
          stemName: STEMS[dxPalace.stem],
          overlay: buildSiHuaOverlay(dxPalace.stem),
        };
      }
      if (view === "liunian") {
        const stemIndex = getYearStemIndex(liunianYear);
        return { stemName: STEMS[stemIndex], overlay: buildSiHuaOverlay(stemIndex) };
      }
      return null;
    },
  );

  const overlayList = $derived.by(() => {
    if (!overlayInfo) return [];
    return (["禄", "权", "科", "忌"] as const).map((sh) => {
      const starName = Object.keys(overlayInfo.overlay).find(
        (k) => overlayInfo.overlay[k] === sh,
      );
      return starName ? { sh, starName } : null;
    });
  });

  function yearStep(delta: number) {
    onYearChange(liunianYear + delta);
    if (view !== "liunian") onViewChange("liunian");
  }
</script>

<div class="wrap">
  <div class="tabs">
    <button class="tab" class:active={view === "mingpan"} onclick={() => onViewChange("mingpan")}>
      本命
    </button>
    <button class="tab" class:active={view === "daxian"} onclick={() => onViewChange("daxian")}>
      {currentDx ? `大限 ${currentDx.startAge}–${currentDx.endAge}` : "大限"}
    </button>
    <div class="liunian" class:active={view === "liunian"}>
      <button class="liunian-label" class:active={view === "liunian"} onclick={() => onViewChange("liunian")}>
        流年
      </button>
      <div class="year-ctl">
        <button class="ybtn" onclick={() => yearStep(-1)} aria-label="上一年">‹</button>
        <span
          class="yval"
          class:active={view === "liunian"}
          role="button"
          tabindex="0"
          onclick={() => onViewChange("liunian")}
          onkeydown={(e) => e.key === "Enter" && onViewChange("liunian")}
        >
          {liunianYear}
        </span>
        <button class="ybtn" onclick={() => yearStep(1)} aria-label="下一年">›</button>
      </div>
    </div>
  </div>

  {#if overlayInfo}
    <div class="overlay-row">
      <span class="dim">
        {view === "daxian" ? "大限" : `${liunianYear}`}·{overlayInfo.stemName}年四化：
      </span>
      {#each overlayList as item}
        {#if item}
          <span class="mark" style:color={SIHUA_COLORS[item.sh]}>{item.starName}化{item.sh}</span>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .wrap {
    margin-bottom: 12px;
  }
  .tabs {
    display: flex;
    align-items: center;
    border-radius: 12px;
    padding: 4px;
    gap: 4px;
    background: var(--t-surface);
    border: 1px solid var(--t-border);
  }
  .tab {
    flex: 1;
    padding: 6px 0;
    font-size: 10px;
    font-weight: 500;
    border-radius: 8px;
    background: transparent;
    color: var(--t-faint);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
  }
  .tab.active {
    background: rgba(212, 168, 67, 0.12);
    color: var(--t-gold);
    border-color: rgba(212, 168, 67, 0.25);
  }
  .liunian {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    padding: 4px 0;
    gap: 4px;
    border: 1px solid transparent;
    transition: all 0.2s;
  }
  .liunian.active {
    background: rgba(212, 168, 67, 0.12);
    border-color: rgba(212, 168, 67, 0.25);
  }
  .liunian-label {
    flex: 1;
    font-size: 10px;
    font-weight: 500;
    text-align: center;
    background: none;
    border: none;
    color: var(--t-faint);
    cursor: pointer;
  }
  .liunian-label.active {
    color: var(--t-gold);
  }
  .year-ctl {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .ybtn {
    font-size: 9px;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: none;
    border: none;
    color: var(--t-faint);
    cursor: pointer;
  }
  .ybtn:hover {
    color: var(--t-gold);
  }
  .yval {
    font-size: 10px;
    font-family: var(--mono, monospace);
    min-width: 28px;
    text-align: center;
    color: var(--t-faint);
    cursor: pointer;
  }
  .yval.active {
    color: var(--t-gold);
  }
  .overlay-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    padding: 0 4px;
    flex-wrap: wrap;
    animation: slide 0.2s ease both;
  }
  @keyframes slide {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .dim {
    font-size: 9px;
    color: var(--t-faint);
  }
  .mark {
    font-size: 9px;
    font-weight: 500;
  }
</style>
