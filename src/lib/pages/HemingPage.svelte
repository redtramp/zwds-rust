<script lang="ts">
  // 合盘页 —— 双表单起双盘 + 并排双盘展示（D5，可折叠）+ 合盘 AI 流式分析（kind: heming）。
  import BirthForm from "@/lib/components/BirthForm.svelte";
  import ChartBoard from "@/lib/components/ChartBoard.svelte";
  import { generateChart } from "@/lib/engine/algorithm";
  import type { BirthFormState } from "@/lib/engine/form-state";
  import type { ZiweiChart } from "@/lib/engine/types";
  import { activeProviderId } from "@/lib/services/providers";
  import { aiChat, aiErrorText, type AiSession, type ChatMsg } from "@/lib/services/ai";

  interface Message {
    role: "user" | "assistant";
    content: string;
  }

  const FIRST_QUESTION = "请对两人命盘做完整合盘分析：先各用一句话概括双方命格，再按方法论五步法（命格基础/夫妻宫互参/太阳太阴/飞化互参/大限同步）给出结论，最后给出缘分类型判断与实际建议。";

  let formA = $state<BirthFormState | null>(null);
  let formB = $state<BirthFormState | null>(null);
  let chartA = $state<ZiweiChart | null>(null);
  let chartB = $state<ZiweiChart | null>(null);
  let showCharts = $state(true);
  let labelA = $state("");
  let labelB = $state("");

  let messages = $state<Message[]>([]);
  let input = $state("");
  let loading = $state(false);
  let noProvider = $state(false);
  let listEl = $state<HTMLElement | null>(null);
  let session: AiSession | null = null;

  $effect(() => {
    messages;
    if (listEl) listEl.scrollTop = listEl.scrollHeight;
  });

  function validForm(f: BirthFormState | null): f is BirthFormState & { year: string; month: string; day: string } {
    if (!f) return false;
    const y = parseInt(f.year) || 0;
    const m = parseInt(f.month) || 0;
    const d = parseInt(f.day) || 0;
    if (!y || !m || !d) return false;
    if (y < 1900 || y > 2026) return false;
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }

  function stopSession() {
    session?.cancel();
    session = null;
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.content === "") {
      messages = messages.slice(0, -1);
    }
  }

  function displayName(f: BirthFormState): string {
    return f.name?.trim() || "一方";
  }

  async function startAnalyze() {
    if (!validForm(formA) || !validForm(formB)) return;
    if (loading) stopSession();

    const a = formA!;
    const b = formB!;
    labelA = displayName(a);
    labelB = displayName(b);

    const hourOf = (f: BirthFormState): number => {
      if (f.unknownTime) return 0;
      const clockMins = (parseInt(f.clockHour) || 0) * 60 + (parseInt(f.clockMinute) || 0);
      const offset = (f.longitude - 120) * 4;
      const solar = (((clockMins + offset) % 1440) + 1440) % 1440;
      if (solar >= 1380 || solar < 60) return 0;
      return Math.floor((solar - 60) / 120) + 1;
    };

    chartA = generateChart({
      year: parseInt(a.year),
      month: parseInt(a.month),
      day: parseInt(a.day),
      hour: hourOf(a),
      gender: a.gender,
      name: a.name || undefined,
      province: a.province || undefined,
      city: a.city || undefined,
      longitude: a.province ? a.longitude : undefined,
    });
    chartB = generateChart({
      year: parseInt(b.year),
      month: parseInt(b.month),
      day: parseInt(b.day),
      hour: hourOf(b),
      gender: b.gender,
      name: b.name || undefined,
      province: b.province || undefined,
      city: b.city || undefined,
      longitude: b.province ? b.longitude : undefined,
    });

    // 未配置提供商 → 引导（不发请求，§9-15 同语义）
    try {
      const id = await activeProviderId();
      if (!id) {
        noProvider = true;
        return;
      }
    } catch {
      noProvider = true;
      return;
    }
    noProvider = false;
    send(FIRST_QUESTION);
  }

  function send(text: string) {
    if (!text.trim() || loading) return;
    loading = true;
    const userMsg: Message = { role: "user", content: text };
    messages = [...messages, userMsg];
    const history: ChatMsg[] = messages.map((m) => ({ role: m.role, content: m.content }));

    session = aiChat(
      {
        kind: "heming",
        chartA,
        chartB,
        question: text,
        messages: history.slice(0, -1), // 当前问题走 question 字段
      },
      (ev) => {
        if (ev.type === "delta") {
          const last = messages[messages.length - 1];
          if (last && last.role === "assistant") {
            last.content += ev.text;
            messages = messages;
          }
        } else if (ev.type === "done") {
          loading = false;
          session = null;
        } else {
          loading = false;
          session = null;
          if (ev.code === "no_active_provider") {
            noProvider = true;
            messages = messages.slice(0, -1);
            return;
          }
          const last = messages[messages.length - 1];
          const textOut = aiErrorText(ev.code, ev.message);
          if (last && last.role === "assistant" && last.content === "") {
            last.content = textOut;
          } else {
            messages = [...messages, { role: "assistant", content: textOut }];
          }
        }
      },
    );
    messages = [...messages, { role: "assistant", content: "" }];
  }

  function sendFree() {
    const text = input.trim();
    if (!text || loading || !chartA) return;
    input = "";
    send(text);
  }

  function resetAll() {
    stopSession();
    chartA = null;
    chartB = null;
    formA = null;
    formB = null;
    messages = [];
  }

  function gotoSettings() {
    window.location.hash = "/settings";
  }
</script>

<main class="page">
  {#if !chartA || !chartB}
    <h1>合盘 · 双盘比对</h1>
    <p class="sub">
      输入双方出生信息，按倪海厦体系合盘方法论（双宫联参：夫妻宫 + 福德宫 + 命宫）做 AI 流式分析。
    </p>
    <div class="forms">
      <section class="side">
        <h2>甲方</h2>
        <BirthForm
          hideSubmit
          onFormSave={(f) => (formA = f)}
        />
      </section>
      <section class="side">
        <h2>乙方</h2>
        <BirthForm
          hideSubmit
          onFormSave={(f) => (formB = f)}
        />
      </section>
    </div>
    <div class="actions">
      <button class="go" disabled={!validForm(formA) || !validForm(formB)} onclick={startAnalyze}>
        起双盘 · 开始合盘分析
      </button>
      <p class="tip" class:ok={validForm(formA) && validForm(formB)}>
        {validForm(formA) && validForm(formB)
          ? "双方信息已齐备，可以开始分析"
          : "请先补全双方出生日期（1900–2026）"}
      </p>
    </div>
  {:else if chartA && chartB}
    <div class="head">
      <button class="back" onclick={resetAll}>← 重新输入</button>
      <button class="fold" onclick={() => (showCharts = !showCharts)}>
        {showCharts ? "收起双盘" : "展开双盘"}
      </button>
    </div>

    {#if showCharts}
      <div class="charts" class:collapsed={!showCharts}>
        <section class="chart-side">
          <h2 class="who">{labelA}</h2>
          <ChartBoard chart={chartA} />
        </section>
        <section class="chart-side">
          <h2 class="who">{labelB}</h2>
          <ChartBoard chart={chartB} />
        </section>
      </div>
    {/if}

    {#if noProvider}
      <div class="guide">
        <p>尚未配置 AI 提供商，合盘分析不可用。</p>
        <button class="guide-btn" onclick={gotoSettings}>去设置页配置 AI</button>
      </div>
    {/if}

    <section class="analysis">
      <h2 class="ai-title"><span class="mark">✦</span> 合盘分析</h2>
      <div class="msgs" bind:this={listEl}>
        {#if messages.length === 0}
          <p class="placeholder">{noProvider ? "配置 AI 后开始分析" : "分析生成中…"}</p>
        {/if}
        {#each messages as msg, i}
          {#if msg.role === "user"}
            <div class="row end"><div class="bubble">{msg.content}</div></div>
          {:else}
            <div class="row">
              <div class="content">
                {#each msg.content.split("\n") as line}
                  {@const section = line.match(/^\*\*【(.+?)】\*\*$/)}
                  {#if section}
                    <div class="section">【{section[1]}】</div>
                  {:else if line.trim() === ""}
                    <div class="sp"></div>
                  {:else}
                    <div class="line">
                      {#each line.split(/\*\*(.+?)\*\*/) as part, j}
                        {#if j % 2 === 0}{part}{:else}<strong>{part}</strong>{/if}
                      {/each}
                      {#if loading && i === messages.length - 1}
                        <span class="cursor"></span>
                      {/if}
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}
        {/each}
      </div>
      <div class="input-row">
        <input
          type="text"
          bind:value={input}
          onkeydown={(e) => e.key === "Enter" && !e.shiftKey && sendFree()}
          placeholder="继续追问，如：两人适合合作创业吗？"
          disabled={loading || !chartA}
        />
        {#if loading}
          <button class="stop" onclick={stopSession}>停止</button>
        {:else}
          <button class="send" onclick={sendFree} disabled={!input.trim()}>追问</button>
        {/if}
      </div>
    </section>
  {/if}
</main>

<style>
  .page {
    max-width: 1440px;
    margin: 0 auto;
    padding: 32px 16px;
    /* fixed 路由：页面锁满内容区高度，超出内容在此内部滚动，右侧不出现页面滚动条 */
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto;
  }
  h1 {
    font-size: 24px;
    color: var(--t-text);
    margin: 0 0 8px;
  }
  .sub {
    color: var(--t-faint);
    font-size: 13px;
    margin: 0 0 24px;
    line-height: 1.7;
  }
  .forms {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    align-items: start;
  }
  @media (max-width: 900px) {
    .forms {
      grid-template-columns: 1fr;
    }
  }
  .side h2,
  .who {
    font-size: 13px;
    letter-spacing: 0.2em;
    color: var(--t-gold);
    margin: 0 0 10px;
  }
  .actions {
    margin-top: 20px;
    text-align: center;
  }
  .go {
    padding: 12px 32px;
    border-radius: 14px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.12em;
    background: linear-gradient(135deg, rgba(180, 130, 40, 0.9), rgba(240, 200, 80, 0.9));
    color: #08080a;
  }
  .go:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .tip {
    font-size: 11px;
    color: var(--t-faint);
    margin-top: 10px;
  }
  .tip.ok {
    color: var(--lu);
  }
  .head {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }
  .back,
  .fold {
    padding: 6px 14px;
    cursor: pointer;
    border: 1px solid var(--t-border);
    border-radius: 8px;
    background: transparent;
    color: var(--t-text2);
    font-size: 12px;
  }
  .back:hover,
  .fold:hover {
    border-color: rgba(212, 168, 67, 0.3);
    color: var(--t-gold);
  }
  .charts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
    animation: ch-in 0.3s ease both;
  }
  @media (max-width: 1200px) {
    .charts {
      grid-template-columns: 1fr;
    }
  }
  @keyframes ch-in {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .guide {
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: rgba(37, 99, 235, 0.1);
    border: 1px solid var(--t-border);
    border-radius: 12px;
    margin-bottom: 14px;
  }
  .guide p {
    margin: 0;
    font-size: 11px;
    color: var(--t-text2);
  }
  .guide-btn {
    font-size: 11px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(212, 168, 67, 0.3);
    background: rgba(212, 168, 67, 0.12);
    color: var(--t-gold);
    cursor: pointer;
    flex-shrink: 0;
  }
  .analysis {
    border: 1px solid var(--t-border);
    border-radius: 16px;
    background: var(--t-card);
    overflow: hidden;
  }
  .ai-title {
    font-size: 12px;
    letter-spacing: 0.15em;
    color: var(--t-gold);
    margin: 0;
    padding: 12px 16px;
    border-bottom: 1px solid var(--t-border);
  }
  .ai-title .mark {
    opacity: 0.5;
  }
  .msgs {
    padding: 16px;
    max-height: 520px;
    overflow-y: auto;
  }
  .placeholder {
    text-align: center;
    color: var(--t-faint);
    font-size: 11px;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .row {
    margin-bottom: 14px;
    animation: m-in 0.25s ease both;
  }
  @keyframes m-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .row.end {
    display: flex;
    justify-content: flex-end;
  }
  .bubble {
    max-width: 85%;
    border-radius: 12px;
    padding: 8px 12px;
    font-size: 11px;
    background: rgba(212, 168, 67, 0.08);
    border: 1px solid rgba(212, 168, 67, 0.18);
    color: var(--t-gold);
  }
  .content .section {
    padding-top: 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--t-gold);
  }
  .content .section:first-child {
    padding-top: 0;
  }
  .content .sp {
    height: 4px;
  }
  .content .line {
    font-size: 11px;
    line-height: 1.7;
    color: var(--t-text2);
  }
  .content strong {
    font-weight: 500;
    color: var(--t-text);
  }
  .cursor {
    display: inline-block;
    width: 6px;
    height: 12px;
    margin-left: 2px;
    vertical-align: middle;
    background: var(--t-gold);
    opacity: 0.6;
    animation: blink 0.9s step-end infinite;
  }
  @keyframes blink {
    50% { opacity: 0.1; }
  }
  .input-row {
    display: flex;
    gap: 8px;
    padding: 8px 16px 14px;
    border-top: 1px solid var(--t-border);
  }
  .input-row input {
    flex: 1;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 11px;
    outline: none;
    background: var(--t-bg);
    border: 1px solid var(--t-border);
    color: var(--t-text);
  }
  .send,
  .stop {
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 11px;
    cursor: pointer;
  }
  .send {
    background: rgba(212, 168, 67, 0.15);
    border: 1px solid rgba(212, 168, 67, 0.25);
    color: var(--t-gold);
  }
  .send:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .stop {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
  }
</style>
