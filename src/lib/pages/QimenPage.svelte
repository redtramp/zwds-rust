<script lang="ts">
  // 奇门页 —— 移植自 kinqimen Streamlit UI（盘型 × 排盘方式 正交双维度，设计 B5）
  // - 盘型 4 种：时家 / 刻家 / 金函玉鏡（日家）/ 整体三盘综合；排盘方式 2 种：拆補 / 置閏（金函玉鏡无此项，禁用）
  // - AI 解读：5 人设（Rust QIMEN_PERSONAS 逐字移植 kinqimen/data/system_prompts.json）
  //   显式点击生成 + 自由对话（与 kinqimen 的「AI分析排盘结果」+「智能问答」双按钮对齐）
  // - 4 种盘型均提供 AI 解读（T1 反转，R14：整体 = 三盘文本拼接；
  //   引擎输出繁体，发给 AI 前经 toSimp，系统 prompt 钉住简体输出）
  import QimenBoard from "@/lib/components/QimenBoard.svelte";
  import { Qimen, formatChartText, formatJinyinChartText } from "@/lib/engine/qimen/engine";
  import { lunarDateD } from "@/lib/engine/qimen/calendar";
  import { toSimp } from "@/lib/engine/qimen/simp";
  import {
    aiChat, aiErrorText,
    type AiSession, type ChatMsg, type QimenPersonaKey,
  } from "@/lib/services/ai";

  type PanKind = "shijia" | "kejia" | "jinyin" | "overall";
  interface Msg { role: "user" | "assistant"; content: string; }

  const PERSONAS: { key: QimenPersonaKey; label: string }[] = [
    { key: "master", label: "奇门大师" },
    { key: "strategist", label: "军师谋略" },
    { key: "diviner", label: "占卜师" },
    { key: "fashu", label: "法术大师" },
    { key: "soccer", label: "足球预测" },
  ];
  const KINDS: { k: PanKind; l: string; d: string }[] = [
    { k: "shijia", l: "时家奇门", d: "主流法，按时辰起盘" },
    { k: "kejia", l: "刻家奇门", d: "细分到分钟，带暗干" },
    { k: "jinyin", l: "金函玉镜 · 日家", d: "日家单盘" },
    { k: "overall", l: "整体三盘综合", d: "三盘同出" },
  ];
  const OPTS: { v: 1 | 2; l: string; d: string }[] = [
    { v: 1, l: "拆补", d: "节气交界直接换局" },
    { v: 2, l: "置闰", d: "置闰局过渡衔接" },
  ];

  const SHICHEN = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const shichenOf = (h: number) => SHICHEN[Math.floor(((h + 1) % 24) / 2)];
  const HOURS = Array.from({ length: 24 }, (_, h) => ({ h, label: `${shichenOf(h)}时 ${h}:00` }));
  const YEARS = Array.from({ length: 201 }, (_, i) => 1900 + i);
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
  const MINUTES = Array.from({ length: 60 }, (_, i) => i);

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

  // 当月天数随年月联动（2 月 31 日等不可能日期不可选；非法值兜底收敛到月末）
  const daysInMonth = $derived(new Date(year, month, 0).getDate());
  const DAYS = $derived(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  $effect(() => {
    if (day > daysInMonth) day = daysInMonth;
  });

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
      panError = `起盘失败：请检查日期是否有效（${String(e)}）`;
    }
  }

  function shijiaOrKejiaText(chart: Record<string, any>, isShijia: boolean): string {
    // formatChartText 前 4 个字符串参数为原文签名占位（实际取值以 chart 为准，见 engine.ts L928-940）
    return formatChartText(
      String(chart["干支"] ?? ""), String(chart["節氣"] ?? ""),
      lunarDateD(year, month, day).lunarMonth, String(chart["排盤方式"] ?? ""),
      chart, isShijia, year, month, day, hour, minute,
    );
  }

  /** AI 盘面文本：4 种盘型（整体 = 三盘拼接）；引擎输出为繁体，发给 AI 前统一过 toSimp */
  function buildChartText(): string {
    let raw: string;
    if (kind === "shijia") raw = shijiaOrKejiaText(shijiaChart!, true);
    else if (kind === "kejia") raw = shijiaOrKejiaText(kejiaChart!, false);
    else if (kind === "jinyin") raw = formatJinyinChartText(jinyinChart!, year, month, day, hour, minute);
    else
      raw = [
        shijiaOrKejiaText(shijiaChart!, true),
        shijiaOrKejiaText(kejiaChart!, false),
        formatJinyinChartText(jinyinChart!, year, month, day, hour, minute),
      ].join("\n\n———\n\n");
    return toSimp(raw);
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
    send([...messages, { role: "user", content: "请对当前盘局进行完整分析。" }]);
  }
  function chat() {
    const t = input.trim();
    if (!t || loading) return;
    input = "";
    send([...messages, { role: "user", content: t }]);
  }

  const shownChart = $derived<Record<string, any> | null>(
    kind === "kejia" ? kejiaChart : kind === "jinyin" ? jinyinChart : shijiaChart,
  );
  const shownKind = $derived(kind === "overall" ? "shijia" : kind);
</script>

<div class="page container-page">
  <div class="layout">
    <!-- 左：起盘表单 -->
    <aside class="card form-col">
      <h2 class="title">奇门遁甲</h2>
      <div class="label-section">日期</div>
      <div class="row3 date-row">
        <select class="input-base" bind:value={year} aria-label="年">
          {#each YEARS as y (y)}
            <option value={y}>{y}</option>
          {/each}
        </select>
        <select class="input-base" bind:value={month} aria-label="月">
          {#each MONTHS as m (m)}
            <option value={m}>{m}</option>
          {/each}
        </select>
        <select class="input-base" bind:value={day} aria-label="日">
          {#each DAYS as d (d)}
            <option value={d}>{d}</option>
          {/each}
        </select>
      </div>
      <div class="label-section">时辰</div>
      <div class="row2">
        <select class="input-base" bind:value={hour} aria-label="时辰">
          {#each HOURS as o (o.h)}
            <option value={o.h}>{o.label}</option>
          {/each}
        </select>
        <select class="input-base" bind:value={minute} aria-label="分">
          {#each MINUTES as mi (mi)}
            <option value={mi}>{mi}</option>
          {/each}
        </select>
      </div>
      <div class="label-section">盘型</div>
      <div class="kind-grid">
        {#each KINDS as o (o.k)}
          <label class="kind-card {kind === o.k ? "on" : ""}">
            <input type="radio" name="qk" bind:group={kind} value={o.k}>
            <span class="kind-name">{o.l}</span>
            <span class="kind-desc">{o.d}</span>
          </label>
        {/each}
      </div>
      <div class="label-section">排盘方式{kind === "jinyin" ? "（日家无此项）" : ""}</div>
      <div class="kind-grid">
        {#each OPTS as o (o.v)}
          <label class="kind-card {kind === "jinyin" ? "off" : ""} {option === o.v ? "on" : ""}">
            <input type="radio" name="qo" bind:group={option} value={o.v} disabled={kind === "jinyin"}>
            <span class="kind-name">{o.l}</span>
            <span class="kind-desc">{o.d}</span>
          </label>
        {/each}
      </div>
      <button class="btn-primary" onclick={start}>起盘</button>
      {#if panError}
        <div class="pan-err">{panError}</div>
      {/if}
    </aside>

    <!-- 中：盘面 -->
    <main class="board-col">
      {#if !shijiaChart}
        <div class="card placeholder">设置日期时间后点击「起盘」</div>
      {:else if kind === "overall"}
        <div class="card-tinted board">
          <h3 class="board-title">时家奇门 · {toSimp(String(shijiaChart["排盤方式"] ?? ""))}</h3>
          <QimenBoard kind="shijia" chart={shijiaChart} />
        </div>
        <div class="card-tinted board">
          <h3 class="board-title">刻家奇门</h3>
          <QimenBoard kind="kejia" chart={kejiaChart!} />
        </div>
        <div class="card-tinted board">
          <h3 class="board-title">金函玉镜（日家奇门）</h3>
          <QimenBoard kind="jinyin" chart={jinyinChart!} />
        </div>
      {:else}
        <div class="card-tinted board">
          {#if shownKind !== "jinyin"}
            <div class="badges">
              <span class="badge"><i>干支</i>{toSimp(String(shownChart?.["干支"] ?? ""))}</span>
              <span class="badge"><i>节气</i>{toSimp(String(shownChart?.["節氣"] ?? ""))}</span>
              <span class="badge plain">{toSimp(String(shownChart?.["排局"] ?? ""))}</span>
              <span class="badge"><i>旬首</i>{toSimp(String(shownChart?.["旬首"] ?? ""))}</span>
              <span class="badge"><i>旬空</i>{toSimp(String(shownChart?.["旬空"]?.日空 ?? ""))} / {toSimp(String(shownChart?.["旬空"]?.時空 ?? ""))}</span>
              <span class="badge"><i>值符</i>{toSimp((shownChart?.["值符值使"]?.值符星宮 ?? []).join(""))}</span>
              <span class="badge"><i>值使</i>{toSimp((shownChart?.["值符值使"]?.值使門宮 ?? []).join(""))}</span>
              <span class="badge"><i>天乙</i>{toSimp(String(shownChart?.["天乙"] ?? ""))}</span>
            </div>
          {:else}
            <div class="badges">
              <span class="badge"><i>日家局</i>{toSimp(String(shownChart?.["局"] ?? ""))}</span>
            </div>
          {/if}
          <QimenBoard kind={shownKind as "shijia" | "kejia" | "jinyin"} chart={shownChart} />
        </div>
      {/if}
    </main>

    <!-- 右：AI 面板（4 种盘型均可解盘，R14） -->
    <aside class="card ai-col">
      <h2 class="title">AI 解盘</h2>
      <div class="personas">
        {#each PERSONAS as p (p.key)}
          <button class="persona {persona === p.key ? "on" : ""}" onclick={() => (persona = p.key)}>
            {p.label}
          </button>
        {/each}
      </div>
      <div class="ai-list" bind:this={listEl} aria-live="polite">
        {#if messages.length === 0}
          <div class="ai-empty">起盘后选择人设，点击「生成解盘」</div>
        {/if}
        {#each messages as m (m)}
          <div class="msg {m.role}">{m.content}</div>
        {/each}
        {#if noProvider}
          <div class="ai-err">尚未配置 AI 提供商 —— 请先到「设置」中填写 API Key</div>
        {/if}
      </div>
      <button class="btn-primary" onclick={generate} disabled={!shijiaChart || loading}>
        生成解盘
      </button>
      <div class="ai-foot">
        <input
          class="input-base"
          placeholder="追加问题…"
          bind:value={input}
          onkeydown={(e) => e.key === "Enter" && chat()}
          disabled={loading}
        >
        {#if loading}
          <button class="btn-ghost" onclick={() => stopSession()}>停止</button>
        {:else}
          <button class="btn-ghost" onclick={chat} disabled={!input.trim()}>发送</button>
        {/if}
      </div>
    </aside>
  </div>
</div>

<style>
  .page {
    height: 100%;
    box-sizing: border-box;
    padding-top: 24px;
    padding-bottom: 40px;
    overflow-y: auto;
  }
  /* 表单列窄格：收窄横向内边距，保证 4 位年份与时辰标签完整显示 */
  .form-col .input-base {
    padding-left: 10px;
    padding-right: 10px;
  }
  /* 键盘焦点：墨金焦点环（焦点态必须可见） */
  .input-base:focus-visible,
  .btn-primary:focus-visible,
  .btn-ghost:focus-visible,
  .persona:focus-visible {
    outline: none;
    border-color: var(--ac);
    box-shadow: 0 0 0 2px var(--ac-bdr);
  }
  .layout {
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr) 330px;
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
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px;
    font-family: var(--font-serif);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--tx-0);
  }
  .title::before {
    content: "";
    flex: none;
    width: 3px;
    height: 18px;
    background: var(--ac);
    border-radius: 1px;
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
  /* 日期行：年份 4 位数字略宽，月/日 2 位收窄 */
  .date-row {
    grid-template-columns: 1.25fr 1fr 1fr;
  }
  /* 盘型 / 排盘方式：可选卡片（名称 + 说明），选中 = 墨金描边 */
  .kind-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }
  .kind-card {
    position: relative;
    display: block;
    padding: 8px 10px;
    background: var(--bg-card);
    border: 1px solid var(--bdr-med);
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .kind-card:hover {
    border-color: var(--tx-3);
  }
  .kind-card.on {
    background: var(--ac-bg);
    border-color: var(--ac);
  }
  .kind-card.off {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .kind-card.off:hover {
    border-color: var(--bdr-med);
  }
  .kind-card input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .kind-card:has(input:focus-visible) {
    border-color: var(--ac);
    box-shadow: 0 0 0 2px var(--ac-bdr);
  }
  .kind-name {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--tx-1);
  }
  .kind-card.on .kind-name {
    color: var(--ac-dim);
  }
  .kind-desc {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.4;
    color: var(--tx-3);
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
    padding: 18px;
  }
  .board-title {
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--ac-bdr);
    font-family: var(--font-serif);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--tx-0);
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
  }
  /* 徽标：标签（淡）+ 数值（强）；排局徽标墨金强调 */
  .badge {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    background: var(--bg-1);
    border: 1px solid var(--bdr);
    border-radius: var(--r-xs);
    padding: 3px 9px;
    font-size: 12px;
    color: var(--tx-1);
  }
  .badge i {
    font-style: normal;
    font-size: 11px;
    color: var(--tx-3);
  }
  .badge.plain {
    color: var(--ac-dim);
    font-weight: 600;
  }
  .placeholder {
    padding: 80px 20px;
    text-align: center;
    font-family: var(--font-serif);
    font-size: 15px;
    letter-spacing: 0.12em;
    color: var(--tx-3);
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
    transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }
  .persona:hover {
    border-color: var(--ac-bdr);
    color: var(--tx-1);
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
