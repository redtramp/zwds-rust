<script lang="ts">
  // AI 提供商设置 —— G4：列表/增/改/删/设默认/测连接/预置一键添加，本地持久化（重启不丢）。
  // Key 只在 Rust 侧，前端只见掩码（hasApiKey + apiKeyMasked）。
  import {
    activeProviderId,
    presetsList,
    providerDelete,
    providerSave,
    providerSetActive,
    providerTest,
    providersList,
    type PresetView,
    type ProviderInput,
    type ProviderTestResult,
    type ProviderView,
  } from "@/lib/services/providers";
  import {
    appearance,
    FONT_OPTIONS,
    setFontFamily,
    setZoom,
    resetAppearance,
  } from "@/lib/stores/appearance.svelte";

  let providers = $state<ProviderView[]>([]);
  let presets = $state<PresetView[]>([]);
  let activeId = $state<string | null>(null);

  // 表单态
  let editingId = $state<string | null>(null); // null=新增
  let showForm = $state(false);
  let name = $state("");
  let baseUrl = $state("");
  let apiKey = $state("");
  let model = $state("");
  let maxTokens = $state(4096);
  let temperature = $state(0.7);
  let showKey = $state(false);
  let formError = $state("");
  let saving = $state(false);

  // 测连接/删除进行态
  let testingId = $state<string | null>(null);
  let testResults = $state<Record<string, ProviderTestResult>>({});
  let confirmingDeleteId = $state<string | null>(null);
  let notice = $state("");

  async function refresh() {
    try {
      [providers, presets, activeId] = await Promise.all([
        providersList(),
        presetsList(),
        activeProviderId(),
      ]);
    } catch (e) {
      notice = `加载配置失败：${String(e)}`;
    }
  }

  refresh();

  function openAdd(preset?: PresetView) {
    editingId = null;
    showForm = true;
    formError = "";
    showKey = false;
    name = preset ? preset.name : "";
    baseUrl = preset ? preset.baseUrl : "";
    model = preset ? preset.model : "";
    apiKey = "";
    maxTokens = 4096;
    temperature = 0.7;
  }

  function openEdit(p: ProviderView) {
    editingId = p.id;
    showForm = true;
    formError = "";
    showKey = false;
    name = p.name;
    baseUrl = p.baseUrl;
    model = p.model;
    apiKey = ""; // 留空 = 保留原 Key
    maxTokens = p.maxTokens;
    temperature = p.temperature;
  }

  function closeForm() {
    showForm = false;
    formError = "";
  }

  async function save() {
    formError = "";
    if (!name.trim() || !model.trim() || !baseUrl.trim()) {
      formError = "名称、base_url、模型名均不能为空";
      return;
    }
    saving = true;
    try {
      const input: ProviderInput = {
        id: editingId,
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey, // 空字符串时 Rust 端编辑保留原 Key（见下）
        model: model.trim(),
        maxTokens,
        temperature,
        isActive: editingId === null ? true : undefined,
      };
      await providerSave(input);
      showForm = false;
      await refresh();
    } catch (e) {
      formError = String(e);
    } finally {
      saving = false;
    }
  }

  async function test(p: ProviderView) {
    testingId = p.id;
    try {
      testResults = { ...testResults, [p.id]: await providerTest(p.id) };
    } catch (e) {
      testResults = { ...testResults, [p.id]: { ok: false, message: String(e) } };
    } finally {
      testingId = null;
    }
  }

  async function setActive(id: string) {
    await providerSetActive(id);
    await refresh();
  }

  async function remove(id: string) {
    if (confirmingDeleteId !== id) {
      confirmingDeleteId = id;
      return;
    }
    confirmingDeleteId = null;
    await providerDelete(id);
    await refresh();
  }

  function presetAdded(key: string): boolean {
    return presets.some((p) => p.key === key) && providers.some((p) => p.baseUrl.startsWith(presetBaseUrl(key)));
  }

  function presetBaseUrl(key: string): string {
    return presets.find((p) => p.key === key)?.baseUrl ?? "";
  }
</script>

<main class="page">
  <div class="head">
    <h1>AI 提供商设置</h1>
    <p class="sub">
      API Key 仅保存在本机配置目录（ai-providers.json），前端界面只显示掩码；AI 请求一律经本机 Rust 核心发出。
    </p>
  </div>

  {#if notice}
    <div class="notice">{notice}</div>
  {/if}

  <!-- 提供商列表 -->
  <div class="list">
    {#if providers.length === 0}
      <div class="empty">
        <p>还没有配置 AI 提供商。</p>
        <p class="dim">从下方预置一键添加，或手动填写任意 OpenAI 兼容端点（含本地 Ollama）。</p>
      </div>
    {/if}

    {#each providers as p}
      <div class="card" class:active={p.isActive}>
        <div class="row1">
          <span class="name">{p.name}</span>
          {#if p.isActive}<span class="badge active-badge">默认</span>{/if}
          <div class="spacer"></div>
          {#if !p.isActive}
            <button class="op" onclick={() => setActive(p.id)}>设为默认</button>
          {/if}
          <button class="op" onclick={() => openEdit(p)}>编辑</button>
          <button class="op danger" onclick={() => remove(p.id)}>
            {confirmingDeleteId === p.id ? "确认删除？" : "删除"}
          </button>
        </div>
        <div class="row2">
          <span class="meta">{p.model}</span>
          <span class="meta dim">{p.baseUrl}</span>
          <span class="meta dim">{p.hasApiKey ? `Key ${p.apiKeyMasked}` : "无需 Key"}</span>
        </div>
        <div class="row3">
          <button class="test" disabled={testingId === p.id} onclick={() => test(p)}>
            {testingId === p.id ? "测试中…" : "测连接"}
          </button>
          {#if testResults[p.id]}
            {#if testResults[p.id].ok}
              <span class="result ok">✓ 连通（{testResults[p.id].latencyMs}ms）</span>
            {:else}
              <span class="result bad">✕ {testResults[p.id].message ?? "连接失败"}</span>
            {/if}
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- 表单 -->
  {#if showForm}
    <div class="form-card">
      <h2>{editingId ? "编辑提供商" : "新增提供商"}</h2>
      <div class="form-grid">
        <label>
          <span>名称</span>
          <input type="text" bind:value={name} placeholder="如：我的 DeepSeek" />
        </label>
        <label>
          <span>Base URL（OpenAI 兼容）</span>
          <input type="text" bind:value={baseUrl} placeholder="https://api.deepseek.com/v1" />
        </label>
        <label>
          <span>API Key {editingId ? "（留空保留原 Key）" : "（Ollama 等本地端点可留空）"}</span>
          <div class="key-row">
            <input type={showKey ? "text" : "password"} bind:value={apiKey} placeholder="sk-…" />
            <button class="op" type="button" onclick={() => (showKey = !showKey)}>
              {showKey ? "隐藏" : "显示"}
            </button>
          </div>
        </label>
        <label>
          <span>模型名</span>
          <input type="text" bind:value={model} placeholder="deepseek-chat" />
        </label>
        <label class="half">
          <span>max_tokens</span>
          <input type="number" bind:value={maxTokens} min="64" max="128000" />
        </label>
        <label class="half">
          <span>temperature</span>
          <input type="number" bind:value={temperature} min="0" max="2" step="0.1" />
        </label>
      </div>
      {#if formError}
        <p class="form-error">✕ {formError}</p>
      {/if}
      <div class="form-actions">
        <button class="primary" disabled={saving} onclick={save}>{saving ? "保存中…" : "保存"}</button>
        <button class="op" onclick={closeForm}>取消</button>
      </div>
    </div>
  {:else}
    <button class="add" onclick={() => openAdd()}>＋ 手动添加提供商</button>
  {/if}

  <!-- 外观：全局字体与字号 -->
  <section class="appearance">
    <h2>外观 · 全局字体与字号</h2>
    <div class="ap-grid">
      <label>
        <span>字体</span>
        <select
          value={appearance.fontFamily}
          onchange={(e) => setFontFamily(e.currentTarget.value)}
        >
          {#each FONT_OPTIONS as f}
            <option value={f.value}>{f.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>字号（全局缩放）</span>
        <div class="zoom-row">
          <input
            type="range"
            min="0.85"
            max="1.4"
            step="0.05"
            value={appearance.zoom}
            oninput={(e) => setZoom(Number(e.currentTarget.value))}
          />
          <span class="zoom-val">{Math.round(appearance.zoom * 100)}%</span>
        </div>
      </label>
    </div>
    <p class="ap-preview" style:font-family={appearance.fontFamily || undefined}>
      预览：紫微为门 · 天地人为路 · 倪海厦为师（ABC 123）
    </p>
    <button class="op" onclick={resetAppearance}>恢复默认外观</button>
  </section>

  <!-- 预置 -->
  <section class="presets">
    <h2>从预置一键添加</h2>
    <div class="preset-grid">
      {#each presets as preset}
        <button
          class="preset"
          class:added={presetAdded(preset.key)}
          onclick={() => openAdd(preset)}
        >
          <div class="p-name">
            {preset.name}
            {#if presetAdded(preset.key)}<span class="added-tag">已添加</span>{/if}
          </div>
          <div class="p-model">{preset.model}</div>
          <div class="p-hint">{preset.hint}</div>
        </button>
      {/each}
    </div>
  </section>
</main>

<style>
  .page {
    max-width: 880px;
    margin: 0 auto;
    padding: 40px 24px 96px;
  }
  h1 {
    font-size: 22px;
    color: var(--t-text);
    letter-spacing: 0.1em;
    margin: 0 0 8px;
  }
  .sub {
    font-size: 12px;
    color: var(--t-faint);
    line-height: 1.7;
    margin: 0 0 28px;
  }
  .notice {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--ji);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 12px;
    margin-bottom: 16px;
  }
  .list {
    display: grid;
    gap: 12px;
    margin-bottom: 24px;
  }
  .empty {
    text-align: center;
    padding: 40px 20px;
    border: 1px dashed var(--t-border);
    border-radius: 14px;
    color: var(--t-text2);
    font-size: 13px;
  }
  .empty p {
    margin: 0 0 6px;
  }
  .dim {
    color: var(--t-faint);
  }
  .card {
    background: var(--t-card);
    border: 1px solid var(--t-border);
    border-radius: 14px;
    padding: 16px 18px;
    transition: border-color 0.2s;
  }
  .card.active {
    border-color: rgba(212, 168, 67, 0.45);
    box-shadow: 0 2px 12px rgba(212, 168, 67, 0.08);
  }
  .row1 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .name {
    font-size: 14px;
    font-weight: 600;
    color: var(--t-text);
  }
  .badge {
    font-size: 9px;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid;
  }
  .active-badge {
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.08);
  }
  .spacer {
    flex: 1;
  }
  .op {
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 8px;
    border: 1px solid var(--t-border);
    background: transparent;
    color: var(--t-text2);
    cursor: pointer;
    transition: all 0.15s;
  }
  .op:hover {
    color: var(--t-gold);
    border-color: rgba(212, 168, 67, 0.35);
  }
  .op.danger:hover {
    color: var(--ji);
    border-color: rgba(239, 68, 68, 0.4);
  }
  .row2 {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin-bottom: 10px;
  }
  .meta {
    font-size: 11px;
    color: var(--t-text2);
  }
  .row3 {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .test {
    font-size: 11px;
    padding: 4px 12px;
    border-radius: 8px;
    border: 1px solid rgba(212, 168, 67, 0.3);
    background: rgba(212, 168, 67, 0.1);
    color: var(--t-gold);
    cursor: pointer;
  }
  .test:disabled {
    opacity: 0.5;
  }
  .result {
    font-size: 11px;
  }
  .result.ok {
    color: #10b981;
  }
  .result.bad {
    color: var(--ji);
  }
  .add {
    width: 100%;
    padding: 12px;
    border-radius: 12px;
    border: 1px dashed var(--t-border);
    background: transparent;
    color: var(--t-gold);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 32px;
  }
  .add:hover {
    border-color: rgba(212, 168, 67, 0.4);
    background: rgba(212, 168, 67, 0.05);
  }
  .form-card {
    background: var(--t-card);
    border: 1px solid var(--t-border);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 32px;
    animation: f-in 0.25s ease both;
  }
  @keyframes f-in {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .form-card h2 {
    font-size: 14px;
    color: var(--t-gold);
    letter-spacing: 0.15em;
    margin: 0 0 18px;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .form-grid label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-grid label:nth-child(3) {
    grid-column: 1 / -1;
  }
  .form-grid label.half {
    grid-column: auto;
  }
  .form-grid span {
    font-size: 11px;
    color: var(--t-faint);
    letter-spacing: 0.05em;
  }
  .form-grid input {
    background: var(--t-bg);
    border: 1px solid var(--t-border);
    color: var(--t-text);
    border-radius: 10px;
    padding: 9px 12px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }
  .form-grid input:focus {
    border-color: rgba(212, 168, 67, 0.5);
  }
  .key-row {
    display: flex;
    gap: 8px;
  }
  .key-row input {
    flex: 1;
  }
  .form-error {
    color: var(--ji);
    font-size: 12px;
    margin: 14px 0 0;
  }
  .form-actions {
    display: flex;
    gap: 10px;
    margin-top: 18px;
  }
  .primary {
    padding: 9px 24px;
    border-radius: 10px;
    border: none;
    background: linear-gradient(135deg, rgba(180, 130, 40, 0.9), rgba(240, 200, 80, 0.9));
    color: #08080a;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .primary:disabled {
    opacity: 0.5;
  }
  .presets h2 {
    font-size: 13px;
    color: var(--t-faint);
    letter-spacing: 0.2em;
    margin: 0 0 14px;
  }
  .appearance {
    background: var(--t-card);
    border: 1px solid var(--t-border);
    border-radius: 14px;
    padding: 18px 20px;
    margin-bottom: 32px;
  }
  .appearance h2 {
    font-size: 13px;
    color: var(--t-gold);
    letter-spacing: 0.2em;
    margin: 0 0 16px;
  }
  .ap-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  @media (max-width: 720px) {
    .ap-grid {
      grid-template-columns: 1fr;
    }
  }
  .ap-grid label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ap-grid span {
    font-size: 11px;
    color: var(--t-faint);
    letter-spacing: 0.05em;
  }
  .ap-grid select {
    background: var(--t-bg);
    border: 1px solid var(--t-border);
    color: var(--t-text);
    border-radius: 10px;
    padding: 9px 12px;
    font-size: 13px;
    outline: none;
  }
  .zoom-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .zoom-row input[type="range"] {
    flex: 1;
    accent-color: var(--t-gold);
  }
  .zoom-val {
    font-size: 12px;
    color: var(--t-gold);
    min-width: 44px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .ap-preview {
    font-size: 14px;
    color: var(--t-text2);
    background: var(--t-bg);
    border: 1px dashed var(--t-border);
    border-radius: 10px;
    padding: 10px 14px;
    margin: 14px 0 12px;
  }
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }
  .preset {
    text-align: left;
    background: var(--t-card);
    border: 1px solid var(--t-border);
    border-radius: 12px;
    padding: 14px 16px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .preset:hover {
    border-color: rgba(212, 168, 67, 0.4);
    transform: translateY(-2px);
  }
  .preset.added {
    opacity: 0.55;
  }
  .p-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--t-text);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .added-tag {
    font-size: 9px;
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.35);
    border-radius: 999px;
    padding: 1px 8px;
  }
  .p-model {
    font-size: 11px;
    color: var(--t-gold);
    margin: 4px 0 6px;
  }
  .p-hint {
    font-size: 11px;
    color: var(--t-faint);
    line-height: 1.6;
  }
</style>
