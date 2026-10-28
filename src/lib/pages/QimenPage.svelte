<script lang="ts">
  // 奇门页 —— 移植自 kinqimen Streamlit UI（盘型 × 排盘方式 正交双维度，设计 B5）
  // - 盘型 4 种：时家 / 刻家 / 金函玉鏡（日家）/ 整体三盘综合；排盘方式 2 种：拆補 / 置閏（金函玉鏡无此项，禁用）
  // - AI 解读：5 人设（Rust QIMEN_PERSONAS 逐字移植 kinqimen/data/system_prompts.json）
  //   显式点击生成 + 自由对话（与 kinqimen 的「AI分析排盘结果」+「智能问答」双按钮对齐）
  // - 金函玉鏡 / 整体盘型不提供 AI 解读（T1 裁决：忠实 kinqimen 行为）
  import QimenBoard from "@/lib/components/QimenBoard.svelte";
  import { Qimen, formatChartText } from "@/lib/engine/qimen/engine";
  import { lunarDateD } from "@/lib/engine/qimen/calendar";
  import {
    aiChat, aiErrorText,
    type AiSession, type ChatMsg, type QimenPersonaKey,
  } from "@/lib/services/ai";

  type PanKind = "shijia" | "kejia" | "jinyin" | "overall";
  interface Msg { role: "user" | "assistant"; content: string; }

  const PERSONAS: { key: QimenPersonaKey; label: string }[] = [
    { key: "master", label: "奇門大師" },
    { key: "strategist", label: "軍師謀略" },
    { key: "diviner", label: "占卜師" },
    { key: "fashu", label: "法術大師" },
    { key: "soccer", label: "足球預測" },
  ];
  const KINDS: { k: PanKind; l: string }[] = [
    { k: "shijia", l: "時家奇門" },
    { k: "kejia", l: "刻家奇門" },
    { k: "jinyin", l: "金函玉鏡（日家）" },
    { k: "overall", l: "整體三盤綜合" },
  ];

  const SHICHEN = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const shichenOf = (h: number) => SHICHEN[Math.floor(((h + 1) % 24) / 2)];
  const HOURS = Array.from({ length: 24 }, (_, h) => ({ h, label: `${shichenOf(h)}時 ${h}:00` }));

  // 表单默认 = 当前时间（kinqimen 即时盘口径）
  const now = new Date();
  let year = $state(now.getFullYear());
  let month = $state(now.getMonth() + 1);
  let day = $state(now.getDate());
  let hour = $state(now.getHours());
  let minute = $state(now.getMinutes());
  let kind = $state<PanKind>("shijia");
  let option = $state<1 | 2>(2); // kinqimen 默认 pai=2（置闰法）
  let panError = $state("");

  let shijiaChart = $state<Record<string, any> | null>(null);
  let kejiaChart = $state<Record<string, any> | null>(null);
  let jinyinChart = $state<Record<string, any> | null>(null);

  // —— AI 面板（复刻 InsightPanel 会话模式）——
  let persona = $state<QimenPersonaKey>("master");
  let input = $state("");
  let loading = $state(false);
  let noProvider = $state(false);
  let messages = $state<Msg[]>([]);
  let listEl = $state<HTMLElement | null>(null);
  let session: AiSession | null = null;

  $effect(() => { messages; if (listEl) listEl.scrollTop = listEl.scrollHeight; });

  function start() {
    panError = "";
    try {
      const q = new Qimen(year, month, day, hour, minute);
      shijiaChart = q.pan(option);
      kejiaChart = q.panMinute(option);
      jinyinChart = q.gpan();
      // 新盘 → AI 上下文重置（与 kinqimen 每盘独立分析一致）
      if (loading) stopSession();
      messages = [];
      noProvider = false;
    } catch (e) {
      // 无效日期（如 2 月 31 日）在历法桥接层抛错 —— 显式兜底，不崩 webview
      panError = `起盤失敗：請檢查日期是否有效（${String(e)}）`;
    }
  }

  function buildChartText(): string {
    const isShijia = kind === "shijia";
    const q = (isShijia ? shijiaChart : kejiaChart) as Record<string, any>;
    // formatChartText 前 4 个字符串参数为原文签名占位（实际取值以 q 为准，见 engine.ts L928-940）
    return formatChartText(
      String(q["干支"] ?? ""), String(q["節氣"] ?? ""),
      lunarDateD(year, month, day).lunarMonth, String(q["排盤方式"] ?? ""),
      q, isShijia, year, month, day, hour, minute,
    );
  }

  function stopSession() {
    session?.cancel();
    session = null;
    loading = false;
  }

  function send(history: Msg[]) {
    noProvider = false;
    const hist: ChatMsg[] = history.map((m) => ({ role: m.role, content: m.content }));
    loading = true;
    session = aiChat({ kind: "qimen", persona, chartText: buildChartText(), messages: hist }, (ev) => {
      if (ev.type === "delta") {
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") last.content += ev.text;
        else messages = [...messages, { role: "assistant", content: ev.text }];
        messages = messages;
      } else if (ev.type === "done") {
        loading = false; session = null;
      } else if (ev.type === "error") {
        loading = false; session = null;
        if (ev.code === "cancelled") return; // 本地停止已清理，不追加消息
        if (ev.code === "no_active_provider") { noProvider = true; return; }
        messages = [...messages, { role: "assistant", content: aiErrorText(ev.code, ev.message) }];
      }
    });
  }

  function generate() {
    if (loading) stopSession();
    send([...messages, { role: "user", content: "請對當前盤局進行完整分析。" }]);
  }
  function chat() {
    const t = input.trim();
    if (!t || loading) return;
    input = "";
    send([...messages, { role: "user", content: t }]);
  }

  const aiReady = $derived(kind === "shijia" || kind === "kejia");
  const shownChart = $derived<Record<string, any> | null>(
    kind === "kejia" ? kejiaChart : kind === "jinyin" ? jinyinChart : shijiaChart,
  );
  const shownKind = $derived(kind === "overall" ? "shijia" : kind);
</script>

<div class="page container-page">
  <div class="layout">
    <!-- 左：起盘表单 -->
    <aside class="card form-col">
      <h2 class="title">奇門遁甲</h2>
      <div class="label-section">日期</div>
      <div class="row3">
        <input class="input-base" type="number" bind:value={year} min={1900} max={2100} aria-label="年">
        <input class="input-base" type="number" bind:value={month} min={1} max={12} aria-label="月">
        <input class="input-base" type="number" bind:value={day} min={1} max={31} aria-label="日">
      </div>
      <div class="label-section">时辰</div>
      <div class="row2">
        <select class="input-base" bind:value={hour} aria-label="时辰">
          {#each HOURS as o (o.h)}
            <option value={o.h}>{o.label}</option>
          {/each}
        </select>
        <input class="input-base" type="number" bind:value={minute} min={0} max={59} aria-label="分">
      </div>
      <div class="label-section">盘型</div>
      {#each KINDS as o (o.k)}
        <label class="opt">
          <input type="radio" name="qk" bind:group={kind} value={o.k}>
          <span>{o.l}</span>
        </label>
      {/each}
      <div class="label-section">排盘方式{kind === "jinyin" ? "（日家无此项）" : ""}</div>
      <div class="row2 opt-row">
        <label class="opt">
          <input type="radio" name="qo" bind:group={option} value={1} disabled={kind === "jinyin"}>
          <span>拆補</span>
        </label>
        <label class="opt">
          <input type="radio" name="qo" bind:group={option} value={2} disabled={kind === "jinyin"}>
          <span>置閏</span>
        </label>
      </div>
      <button class="btn-primary" onclick={start}>起盤</button>
      {#if panError}
        <div class="pan-err">{panError}</div>
      {/if}
    </aside>

    <!-- 中：盘面 -->
    <main class="board-col">
      {#if !shijiaChart}
        <div class="card placeholder">設定日時後點擊「起盤」</div>
      {:else if kind === "overall"}
        <div class="card-tinted board">
          <h3 class="board-title">時家奇門 · {shijiaChart["排盤方式"]}</h3>
          <QimenBoard kind="shijia" chart={shijiaChart} />
        </div>
        <div class="card-tinted board">
          <h3 class="board-title">刻家奇門</h3>
          <QimenBoard kind="kejia" chart={kejiaChart!} />
        </div>
        <div class="card-tinted board">
          <h3 class="board-title">金函玉鏡（日家奇門）</h3>
          <QimenBoard kind="jinyin" chart={jinyinChart!} />
        </div>
      {:else}
        <div class="card-tinted board">
          {#if shownKind !== "jinyin"}
            <div class="badges">
              <span class="badge">干支 {shownChart?.["干支"]}</span>
              <span class="badge">節氣 {shownChart?.["節氣"]}</span>
              <span class="badge">{shownChart?.["排局"]}</span>
              <span class="badge">旬首 {shownChart?.["旬首"]}</span>
              <span class="badge">旬空 {shownChart?.["旬空"]?.日空} / {shownChart?.["旬空"]?.時空}</span>
              <span class="badge">值符 {shownChart?.["值符值使"]?.值符星宮?.join("")}</span>
              <span class="badge">值使 {shownChart?.["值符值使"]?.值使門宮?.join("")}</span>
              <span class="badge">天乙 {shownChart?.["天乙"]}</span>
            </div>
          {:else}
            <div class="badges">
              <span class="badge">日家局 {shownChart?.["局"]}</span>
            </div>
          {/if}
          <QimenBoard kind={shownKind as "shijia" | "kejia" | "jinyin"} chart={shownChart} />
        </div>
      {/if}
    </main>

    <!-- 右：AI 面板 -->
    <aside class="card ai-col">
      <h2 class="title">AI 解盤</h2>
      {#if !aiReady}
        <div class="ai-disabled">金函玉鏡 / 整體盤型不提供 AI 解讀（與 kinqimen 行為一致）</div>
      {:else}
        <div class="personas">
          {#each PERSONAS as p (p.key)}
            <button class="persona {persona === p.key ? "on" : ""}" onclick={() => (persona = p.key)}>
              {p.label}
            </button>
          {/each}
        </div>
        <div class="ai-list" bind:this={listEl}>
          {#if messages.length === 0}
            <div class="ai-empty">起盤後選擇人設，點擊「生成解盤」</div>
          {/if}
          {#each messages as m (m)}
            <div class="msg {m.role}">{m.content}</div>
          {/each}
          {#if noProvider}
            <div class="ai-err">尚未配置 AI 提供商 —— 請先到「設置」中填寫 API Key</div>
          {/if}
        </div>
        <button class="btn-primary" onclick={generate} disabled={!shijiaChart || loading}>
          生成解盤
        </button>
        <div class="ai-foot">
          <input
            class="input-base"
            placeholder="追加問題…"
            bind:value={input}
            onkeydown={(e) => e.key === "Enter" && chat()}
            disabled={loading}
          >
          {#if loading}
            <button class="btn-ghost" onclick={() => stopSession()}>停止</button>
          {:else}
            <button class="btn-ghost" onclick={chat} disabled={!input.trim()}>發送</button>
          {/if}
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .page {
    padding-top: 24px;
    padding-bottom: 40px;
  }
  .layout {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr) 330px;
    gap: 16px;
    align-items: start;
  }
  @media (max-width: 1100px) {
    .layout {
      grid-template-columns: 1fr 1fr;
    }
    .ai-col {
      grid-column: 1 / -1;
    }
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .title {
    margin: 0 0 14px;
    font-size: 18px;
    font-weight: 600;
    color: var(--tx-0);
  }
  .form-col,
  .ai-col {
    padding: 18px;
    position: sticky;
    top: 16px;
  }
  @media (max-width: 760px) {
    .form-col,
    .ai-col {
      position: static;
    }
  }
  .row3,
  .row2 {
    display: grid;
    gap: 8px;
    margin-bottom: 12px;
  }
  .row3 {
    grid-template-columns: repeat(3, 1fr);
  }
  .row2 {
    grid-template-columns: 1fr 1fr;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--tx-1);
    padding: 6px 0;
    cursor: pointer;
  }
  .opt input[type="radio"] {
    accent-color: var(--ac);
  }
  .opt-row .opt {
    flex: 1;
  }
  .opt-row .opt:has(input:disabled) {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn-primary {
    width: 100%;
    margin-top: 8px;
    background: var(--ac);
    color: #fff;
    border: none;
    border-radius: var(--r-sm);
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }
  .btn-primary:hover:not(:disabled) {
    opacity: 0.88;
  }
  .btn-primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .btn-ghost {
    background: transparent;
    color: var(--tx-1);
    border: 1px solid var(--bdr-med);
    border-radius: var(--r-sm);
    padding: 9px 14px;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn-ghost:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .pan-err {
    color: var(--ji);
    font-size: 12px;
    margin-top: 8px;
  }
  .board-col {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }
  .board {
    padding: 16px;
  }
  .board-title {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--tx-0);
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
  }
  .badge {
    background: var(--bg-1);
    border: 1px solid var(--bdr);
    border-radius: var(--r-xs);
    padding: 2px 9px;
    font-size: 12px;
    color: var(--tx-2);
  }
  .placeholder {
    padding: 60px 20px;
    text-align: center;
    color: var(--tx-3);
    font-size: 14px;
  }
  .personas {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }
  .persona {
    background: var(--bg-1);
    color: var(--tx-2);
    border: 1px solid var(--bdr);
    border-radius: var(--r-pill);
    padding: 4px 12px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .persona.on {
    background: var(--ac-bg);
    color: var(--ac-dim);
    border-color: var(--ac-bdr);
    font-weight: 600;
  }
  .ai-list {
    height: 380px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px 2px;
    margin-bottom: 12px;
  }
  .ai-empty {
    color: var(--tx-3);
    font-size: 13px;
    text-align: center;
    margin-top: 120px;
  }
  .msg {
    border-radius: var(--r-sm);
    padding: 10px 12px;
    font-size: 13px;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .msg.user {
    background: var(--ac-bg);
    border: 1px solid var(--ac-bdr);
    color: var(--tx-1);
    align-self: flex-end;
    max-width: 92%;
  }
  .msg.assistant {
    background: var(--bg-1);
    border: 1px solid var(--bdr);
    color: var(--tx-1);
    align-self: flex-start;
    max-width: 100%;
  }
  .ai-err {
    color: var(--ji);
    font-size: 12px;
    text-align: center;
    padding: 8px;
  }
  .ai-disabled {
    color: var(--tx-3);
    font-size: 13px;
    text-align: center;
    padding: 40px 8px;
  }
  .ai-foot {
    display: flex;
    gap: 8px;
  }
  .ai-foot .input-base {
    flex: 1;
    min-width: 0;
    padding: 9px 12px;
    font-size: 13px;
  }
</style>
