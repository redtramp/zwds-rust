<script lang="ts">
  // InsightPanel —— 移植自 Sample/components/InsightPanel.tsx，AI 改走 Rust（services/ai.ts）。
  // D4：三类自动触发保留 1:1 —— 进页自动命格总览、点宫位自动解读、四化点选飞化解读（§9-14）。
  // §9-15：无默认提供商时不发请求，显示内联配置引导。
  // §9-16：流式中发起新解读自动取消旧的。
  import { activeProviderId } from "@/lib/services/providers";
  import { aiChat, aiErrorText, type AiSession, type ChatMsg, type InterpretIntent, type TopicKey } from "@/lib/services/ai";
  import { detectPatterns } from "@/lib/engine/patterns";
  import type { Palace, ZiweiChart } from "@/lib/engine/types";

  interface Message {
    role: "user" | "assistant";
    content: string;
    hidden?: boolean; // 不渲染 user 气泡（主题/自动消息）
  }

  export interface SelectedSiHua {
    starName: string;
    siHua: string;
    view: "daxian" | "liunian";
  }

  interface Props {
    chart: ZiweiChart;
    selectedPalace?: Palace | null;
    selectedSihua?: SelectedSiHua | null;
  }

  let { chart, selectedPalace = null, selectedSihua = null }: Props = $props();

  const TOPICS: { key: TopicKey; label: string }[] = [
    { key: "overview", label: "命格" },
    { key: "love", label: "感情" },
    { key: "career", label: "事业" },
    { key: "wealth", label: "财运" },
    { key: "health", label: "健康" },
    { key: "personality", label: "性格" },
  ];

  const TOPIC_LABELS: Record<TopicKey, string> = {
    overview: "命格总览",
    love: "感情解读",
    career: "事业解读",
    wealth: "财运解读",
    health: "健康解读",
    personality: "性格解读",
  };

  let messages = $state<Message[]>([]);
  let input = $state("");
  let loading = $state(false);
  let noProvider = $state(false);
  let activeTopic = $state<TopicKey>("overview");
  let listEl = $state<HTMLElement | null>(null);

  let session: AiSession | null = null;
  let autoLoaded = false;
  let lastPalaceBranch: number | undefined;
  let lastSihuaKey: string | undefined;

  // 自动滚动
  $effect(() => {
    messages;
    if (listEl) listEl.scrollTop = listEl.scrollHeight;
  });

  function historyMsgs(): ChatMsg[] {
    // 历史 = 全部消息（含隐藏），与原版 apiMessages 一致
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  function stopSession() {
    session?.cancel();
    session = null;
    // 收尾未完成的流：删掉空的 assistant 尾巴
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.content === "") {
      messages = messages.slice(0, -1);
    }
  }

  function finalizeError(code: string, message?: string) {
    loading = false;
    session = null;
    if (code === "no_active_provider") {
      noProvider = true;
      messages = messages.slice(0, -1); // 撤掉空 assistant
      return;
    }
    const text = aiErrorText(code, message);
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.content === "") {
      last.content = text;
    } else {
      messages = [...messages, { role: "assistant", content: text }];
    }
  }

  function startRequest(intent: InterpretIntent | null, displayText: string | null, hidden: boolean) {
    if (loading) stopSession(); // §9-16：新解读自动取消旧的
    noProvider = false;
    const userMsg: Message | null = displayText === null ? null : { role: "user", content: displayText, hidden };
    const base = userMsg ? [...messages, userMsg] : [...messages];
    messages = base;
    const history = base.map((m) => ({ role: m.role, content: m.content }));
    loading = true;

    session = aiChat(
      {
        kind: "interpret",
        intent,
        chart,
        patterns: detectPatterns(chart),
        messages: history,
      },
      (ev) => {
        if (ev.type === "delta") {
          const last = messages[messages.length - 1];
          if (last && last.role === "assistant") {
            last.content += ev.text;
            messages = messages; // 触发响应式更新
          }
        } else if (ev.type === "done") {
          loading = false;
          session = null;
        } else {
          finalizeError(ev.code, ev.message);
        }
      },
    );
    // 占位 assistant 消息
    messages = [...messages, { role: "assistant", content: "" }];
  }

  function sendTopic(topic: TopicKey, hidden = true) {
    if (loading && hidden) return; // 自动触发排队语义保留：手动点击才打断
    activeTopic = topic;
    startRequest({ topic }, TOPIC_LABELS[topic], hidden);
  }

  function sendFree() {
    const text = input.trim();
    if (!text || loading) return;
    input = "";
    startRequest(null, text, false);
  }

  // 自动触发 1：进页命格总览（无提供商 → 引导，不发请求）
  $effect(() => {
    if (autoLoaded) return;
    autoLoaded = true;
    activeProviderId()
      .then((id) => {
        if (id) sendTopic("overview");
        else noProvider = true;
      })
      .catch(() => (noProvider = true));
  });

  // 自动触发 2：点宫位自动解读
  $effect(() => {
    const p = selectedPalace;
    if (!p || p.branch === lastPalaceBranch) return;
    lastPalaceBranch = p.branch;
    startRequest({ branch: p.branch }, `宫位解读：${p.name}`, true);
  });

  // 自动触发 3：四化点选飞化解读（§9-14）
  $effect(() => {
    const s = selectedSihua;
    if (!s) return;
    const key = `${s.starName}-${s.siHua}-${s.view}`;
    if (key === lastSihuaKey) return;
    lastSihuaKey = key;
    const viewLabel = s.view === "daxian" ? "大限" : "流年";
    startRequest({ starName: s.starName, siHua: s.siHua, view: s.view }, `${viewLabel}飞化：${s.starName}化${s.siHua}`, true);
  });

  function gotoSettings() {
    window.location.hash = "/settings";
  }

  function sectionOf(line: string): string | null {
    const m = line.match(/^\*\*【(.+?)】\*\*$/);
    return m ? m[1] : null;
  }
</script>

<div class="panel">
  {#if noProvider}
    <div class="guide">
      <p>尚未配置 AI 提供商，解读功能不可用。</p>
      <button class="guide-btn" onclick={gotoSettings}>去设置页配置 AI</button>
    </div>
  {/if}

  <div class="topics">
    {#each TOPICS as t}
      <button
        class="topic"
        class:active={activeTopic === t.key}
        disabled={loading}
        onclick={() => sendTopic(t.key, false)}
      >
        {t.label}
      </button>
    {/each}
  </div>

  <div class="msgs" bind:this={listEl}>
    {#if messages.length === 0}
      <div class="placeholder">
        <div class="star">✦</div>
        <p>{noProvider ? "配置 AI 提供商后开始解读" : "命格解读生成中…"}</p>
      </div>
    {/if}

    {#each messages as msg, i}
      {#if !(msg.role === "user" && msg.hidden)}
        {#if msg.role === "user"}
          <div class="row end">
            <div class="bubble user">{msg.content}</div>
          </div>
        {:else}
          <div class="row">
            <div class="label"><span class="mark">✦</span> 命理解读</div>
            <div class="content">
              {#each msg.content.split("\n") as line}
                {@const section = sectionOf(line)}
                {#if section}
                  <div class="section">【{section}】</div>
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
      {/if}
    {/each}
  </div>

  <div class="input-row">
    <input
      type="text"
      bind:value={input}
      onkeydown={(e) => e.key === "Enter" && !e.shiftKey && sendFree()}
      placeholder="继续追问，如：今年适合换工作吗？"
      disabled={loading}
    />
    {#if loading}
      <button class="stop" onclick={stopSession}>停止</button>
    {:else}
      <button class="send" onclick={sendFree} disabled={!input.trim()}>追问</button>
    {/if}
  </div>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-radius: 12px;
    overflow: hidden;
    background: var(--t-card);
    border: 1px solid var(--t-border);
  }
  .guide {
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: space-between;
    background: rgba(37, 99, 235, 0.1);
    border-bottom: 1px solid var(--t-border);
    animation: g-in 0.25s ease both;
  }
  @keyframes g-in {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .guide p {
    margin: 0;
    font-size: 11px;
    color: var(--t-text2);
  }
  .guide-btn {
    flex-shrink: 0;
    font-size: 11px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(212, 168, 67, 0.3);
    background: rgba(212, 168, 67, 0.12);
    color: var(--t-gold);
    cursor: pointer;
  }
  .topics {
    flex-shrink: 0;
    padding: 10px 8px;
    border-bottom: 1px solid var(--t-border);
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
  }
  .topic {
    padding: 6px 0;
    font-size: 10px;
    font-weight: 500;
    border-radius: 8px;
    background: transparent;
    border: 1px solid var(--t-border);
    color: var(--t-faint);
    cursor: pointer;
    transition: all 0.15s;
  }
  .topic:disabled {
    opacity: 0.4;
  }
  .topic.active {
    background: rgba(212, 168, 67, 0.12);
    border-color: rgba(212, 168, 67, 0.3);
    color: var(--t-gold);
  }
  .msgs {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    min-height: 0;
  }
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
  }
  .placeholder .star {
    font-size: 36px;
    color: var(--t-gold);
    opacity: 0.1;
    margin-bottom: 12px;
  }
  .placeholder p {
    font-size: 10px;
    color: var(--t-faint);
    animation: pulse 1.5s ease-in-out infinite;
    margin: 0;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .row {
    margin-bottom: 16px;
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
  .bubble.user {
    max-width: 85%;
    border-radius: 12px;
    padding: 8px 12px;
    font-size: 11px;
    background: rgba(212, 168, 67, 0.08);
    border: 1px solid rgba(212, 168, 67, 0.18);
    color: var(--t-gold);
  }
  .label {
    font-size: 9px;
    letter-spacing: 0.15em;
    margin-bottom: 8px;
    color: var(--t-faint);
  }
  .label .mark {
    color: var(--t-gold);
    opacity: 0.4;
  }
  .content .section {
    padding-top: 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
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
    border-radius: 2px;
    vertical-align: middle;
    background: var(--t-gold);
    opacity: 0.6;
    animation: blink 0.9s step-end infinite;
  }
  @keyframes blink {
    50% { opacity: 0.1; }
  }
  .input-row {
    flex-shrink: 0;
    padding: 8px 12px 12px;
    border-top: 1px solid var(--t-border);
    display: flex;
    gap: 8px;
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
    transition: border-color 0.2s;
  }
  .input-row input:focus {
    border-color: rgba(212, 168, 67, 0.5);
  }
  .input-row input:disabled {
    opacity: 0.6;
  }
  .send,
  .stop {
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
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
