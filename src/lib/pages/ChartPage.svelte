<script lang="ts">
  // 排盘页 —— 移植自 Sample/app/chart/page.tsx
  // 修②：出生信息历史 —— 起盘即存、下次进入预填最近一次、历史列表一键回填。
  import BirthForm from "@/lib/components/BirthForm.svelte";
  import ChartBoard from "@/lib/components/ChartBoard.svelte";
  import InsightPanel, { type SelectedSiHua } from "@/lib/components/InsightPanel.svelte";
  import { generateChart } from "@/lib/engine/algorithm";
  import type { BirthFormState } from "@/lib/engine/form-state";
  import type { Palace, ZiweiChart } from "@/lib/engine/types";
  import { addBirthHistory, birthHistory, clearBirthHistory, removeBirthHistory } from "@/lib/stores/birth-history.svelte";

  let chart = $state<ZiweiChart | null>(null);
  let selectedPalace = $state<Palace | null>(null);
  let selectedSihua = $state<SelectedSiHua | null>(null);

  // 表单状态跟踪与历史回填
  let lastForm = $state<BirthFormState | null>(null);
  let formNonce = $state(0);
  let initialForm = $state<Partial<BirthFormState> | undefined>(birthHistory.list[0]?.state);

  function start(info: Parameters<typeof generateChart>[0]) {
    chart = generateChart(info);
    selectedPalace = null;
    selectedSihua = null;
    // 修②：本次成功起盘的表单入历史（onFormSave 已持续跟踪最新快照）
    if (lastForm) addBirthHistory(lastForm);
  }

  function reset() {
    chart = null;
    selectedPalace = null;
    selectedSihua = null;
  }

  function loadHistory(state: BirthFormState) {
    initialForm = state;
    formNonce++; // {#key} 重挂载 BirthForm，使 initialData 生效
  }
</script>

{#if !chart}
  <main class="form-page">
    <h1>紫微斗数排盘</h1>
    <p class="sub">
      输入出生年月日时，开源排盘引擎即时生成命盘。
      <br />
      排盘内核完全开放（lib/ziwei 原样移植，10 套回归钉住行为一致）。
    </p>

    {#if birthHistory.list.length > 0}
      <div class="history">
        <div class="h-head">
          <span class="h-title">历史出生信息</span>
          <button class="h-clear" onclick={clearBirthHistory}>清空</button>
        </div>
        <div class="h-chips">
          {#each birthHistory.list as h (h.id)}
            <span class="chip-wrap">
              <button class="h-chip" onclick={() => loadHistory(h.state)} title="点击回填到表单">
                {h.label}
              </button>
              <button class="h-del" onclick={() => removeBirthHistory(h.id)} aria-label="删除该条历史">×</button>
            </span>
          {/each}
        </div>
      </div>
    {/if}

    {#key formNonce}
      <BirthForm
        onSubmit={start}
        initialData={initialForm}
        onFormSave={(f) => (lastForm = f)}
      />
    {/key}
  </main>
{:else}
  <main class="chart-page">
    <button class="reset" onclick={reset}>← 重新起盘</button>

    <div class="layout">
      {#key chart}
        <div class="board-scroll">
          <ChartBoard
            chart={chart}
            onPalaceSelect={(p) => (selectedPalace = p)}
            onSiHuaClick={(starName, siHua, view) => (selectedSihua = { starName, siHua, view })}
          />
        </div>
        <!-- 面板占满内容区高度：消息只在 .msgs 内部滚动，页面框架不变形 -->
        <div class="panel-wrap">
          <InsightPanel chart={chart} {selectedPalace} {selectedSihua} />
        </div>
      {/key}
    </div>
  </main>
{/if}

<style>
  .form-page {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 20px;
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto;
  }
  .form-page h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 8px;
    color: var(--t-text);
  }
  .sub {
    color: var(--t-faint);
    margin: 0 0 24px;
    font-size: 14px;
    line-height: 1.7;
  }
  .history {
    margin-bottom: 20px;
    background: var(--t-card);
    border: 1px solid var(--t-border);
    border-radius: 14px;
    padding: 14px 16px;
  }
  .h-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .h-title {
    font-size: 11px;
    letter-spacing: 0.2em;
    color: var(--t-faint);
  }
  .h-clear {
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 8px;
    border: 1px solid var(--t-border);
    background: transparent;
    color: var(--t-faint);
    cursor: pointer;
  }
  .h-clear:hover {
    color: var(--ji);
    border-color: rgba(239, 68, 68, 0.35);
  }
  .h-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip-wrap {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--t-border);
    border-radius: 999px;
    overflow: hidden;
    transition: border-color 0.15s;
  }
  .chip-wrap:hover {
    border-color: rgba(212, 168, 67, 0.45);
  }
  .h-chip {
    border: none;
    background: transparent;
    color: var(--t-text2);
    font-size: 11px;
    padding: 6px 4px 6px 12px;
    cursor: pointer;
    white-space: nowrap;
  }
  .h-chip:hover {
    color: var(--t-gold);
  }
  .h-del {
    border: none;
    background: transparent;
    color: var(--t-faint);
    font-size: 13px;
    line-height: 1;
    padding: 6px 10px 6px 4px;
    cursor: pointer;
  }
  .h-del:hover {
    color: var(--ji);
  }
  .chart-page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 24px 16px;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .reset {
    margin-bottom: 16px;
    padding: 6px 14px;
    cursor: pointer;
    border: 1px solid var(--t-border);
    border-radius: 8px;
    background: transparent;
    color: var(--t-text2);
    font-size: 12px;
    transition: border-color 0.2s, color 0.2s;
  }
  .reset:hover {
    border-color: rgba(212, 168, 67, 0.3);
    color: var(--t-gold);
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 380px);
    gap: 20px;
    margin-top: 16px;
    flex: 1;
    min-height: 0;
  }
  .layout > * {
    min-height: 0;
  }
  /* 命盘超出可用高度时在此内部滚动 */
  .board-scroll {
    overflow-y: auto;
  }
  /* 面板占满剩余高度，消息只在 .msgs 内部滚动 */
  .panel-wrap {
    height: 100%;
  }
  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
</style>
