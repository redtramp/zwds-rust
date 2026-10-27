<script lang="ts">
  // BirthForm —— 移植自 Sample/components/BirthForm.tsx（逻辑逐字对应，样式令牌化）
  import { PROVINCES } from "@/lib/engine/cities";
  import { SHICHEN } from "@/lib/engine/constants";
  import type { BirthInfo } from "@/lib/engine/types";
  import type { BirthFormState } from "@/lib/engine/form-state";
  import { theme } from "@/lib/stores/theme.svelte";

  interface Props {
    onSubmit: (info: BirthInfo) => void;
    loading?: boolean;
    initialData?: Partial<BirthFormState>;
    onFormSave?: (data: BirthFormState) => void;
    /** 隐藏内部「立即起盘」按钮（合盘等场景由父级统一触发） */
    hideSubmit?: boolean;
  }

  let { onSubmit, loading = false, initialData, onFormSave, hideSubmit = false }: Props = $props();

  const SHICHEN_NAMES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

  /** 根据北京时间 + 经度计算真太阳时时辰支 (0-11) */
  function calcTrueSolarBranch(clockHour: number, clockMinute: number, longitude: number): number {
    const clockMins = clockHour * 60 + clockMinute;
    const offset = (longitude - 120) * 4;
    const solar = (((clockMins + offset) % 1440) + 1440) % 1440;
    if (solar >= 1380 || solar < 60) return 0;
    return Math.floor((solar - 60) / 120) + 1;
  }

  /** 检查日期是否合法 */
  function isValidDate(y: number, m: number, d: number): boolean {
    if (!y || !m || !d) return false;
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }

  // 有意只捕获 initialData 的初始值：历史回填由父级 {#key} 重挂载本组件实现，
  // 组件生命周期内 initialData 不再变化，无需响应式追踪。
  // svelte-ignore state_referenced_locally
  let form = $state<BirthFormState>({
    name: initialData?.name ?? "",
    year: initialData?.year ?? "",
    month: initialData?.month ?? "",
    day: initialData?.day ?? "",
    clockHour: initialData?.clockHour ?? "8",
    clockMinute: initialData?.clockMinute ?? "0",
    unknownTime: initialData?.unknownTime ?? false,
    province: initialData?.province ?? "",
    city: initialData?.city ?? "",
    longitude: initialData?.longitude ?? 120,
    gender: initialData?.gender ?? "male",
  });

  let touched = $state<Record<string, boolean>>({});
  let submitAttempted = $state(false);

  // 表单状态变化时实时同步给父级（合盘等场景下父级靠这个收集双方数据）
  $effect(() => {
    const snapshot = $state.snapshot(form) as BirthFormState;
    onFormSave?.(snapshot);
  });

  const cityList = $derived.by(() => {
    const prov = PROVINCES.find((p) => p.name === form.province);
    return prov ? prov.cities : [];
  });

  const branch = $derived(
    form.unknownTime
      ? 0
      : calcTrueSolarBranch(parseInt(form.clockHour) || 0, parseInt(form.clockMinute) || 0, form.longitude),
  );

  const offsetMin = $derived(Math.round((form.longitude - 120) * 4));
  const shichenInfo = $derived(SHICHEN[branch]);

  const y = $derived(parseInt(form.year) || 0);
  const m = $derived(parseInt(form.month) || 0);
  const d = $derived(parseInt(form.day) || 0);

  const errors = $derived({
    year: !form.year
      ? "请选择出生年份"
      : y < 1900 || y > 2026
        ? "年份范围：1900–2026"
        : "",
    month: !form.month ? "请选择月份" : "",
    day: !form.day
      ? "请选择日期"
      : form.year && form.month && !isValidDate(y, m, d)
        ? `${m}月没有${d}日`
        : "",
  });
  const hasError = $derived(Object.values(errors).some(Boolean));

  const steps = $derived([
    !!form.year && !!form.month && !!form.day && !errors.year && !errors.month && !errors.day,
    !!form.province && !!form.city,
    form.unknownTime || (!!form.clockHour && !!form.clockMinute),
    true,
  ]);

  const showSummary = $derived(steps[0] && steps[2] && !hasError);
  const summaryText = $derived(
    showSummary
      ? [
          `${y}年${m}月${d}日`,
          form.city || form.province || "",
          form.unknownTime ? "时辰不详" : `${SHICHEN_NAMES[branch]}时`,
          form.gender === "male" ? "男" : "女",
        ]
          .filter(Boolean)
          .join(" · ")
      : "",
  );

  function handleProvince(prov: string) {
    const provData = PROVINCES.find((p) => p.name === prov);
    const firstCity = provData?.cities[0];
    form = {
      ...form,
      province: prov,
      city: firstCity?.name || "",
      longitude: firstCity?.longitude ?? 120,
    };
  }

  function handleCity(cityName: string) {
    const prov = PROVINCES.find((p) => p.name === form.province);
    const cityData = prov?.cities.find((c) => c.name === cityName);
    form = { ...form, city: cityName, longitude: cityData?.longitude ?? 120 };
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    submitAttempted = true;
    touched = { year: true, month: true, day: true };
    if (hasError) return;
    onFormSave?.($state.snapshot(form));
    onSubmit({
      year: y,
      month: m,
      day: d,
      hour: branch,
      gender: form.gender,
      name: form.name || undefined,
      province: form.province || undefined,
      city: form.city || undefined,
      longitude: form.province ? form.longitude : undefined,
    });
  }

  const showErr = (field: string) => touched[field] || submitAttempted;
  const years = Array.from({ length: 127 }, (_, i) => 2026 - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);
</script>

<form class="birth-form" onsubmit={handleSubmit}>
  <h3 class="title">── 输入生辰八字 ──</h3>

  <div class="progress" aria-hidden="true">
    {#each steps as done}
      <div class="bar" class:done></div>
    {/each}
  </div>

  <div class="field">
    <label class="lbl" for="bf-name">姓名（可选）</label>
    <input id="bf-name" type="text" placeholder="请输入姓名" bind:value={form.name} />
  </div>

  <div class="field">
    <span class="lbl">出生日期（公历）</span>
    <div class="grid3">
      <div>
        <select
          bind:value={form.year}
          class:err={showErr("year") && !!errors.year}
          onchange={() => (touched = { ...touched, year: true })}
          aria-label="出生年份"
          required
        >
          <option value="">年份</option>
          {#each years as yr}<option value={String(yr)}>{yr}</option>{/each}
        </select>
        {#if showErr("year") && errors.year}<p class="err-text">✕ {errors.year}</p>{/if}
      </div>
      <div>
        <select
          bind:value={form.month}
          class:err={showErr("month") && !!errors.month}
          onchange={() => (touched = { ...touched, month: true })}
          aria-label="出生月份"
          required
        >
          <option value="">月份</option>
          {#each months as mo}<option value={String(mo)}>{mo} 月</option>{/each}
        </select>
        {#if showErr("month") && errors.month}<p class="err-text">✕ {errors.month}</p>{/if}
      </div>
      <div>
        <select
          bind:value={form.day}
          class:err={showErr("day") && !!errors.day}
          onchange={() => (touched = { ...touched, day: true })}
          aria-label="出生日期"
          required
        >
          <option value="">日期</option>
          {#each days as dy}<option value={String(dy)}>{dy} 日</option>{/each}
        </select>
        {#if showErr("day") && errors.day}<p class="err-text">✕ {errors.day}</p>{/if}
      </div>
    </div>
  </div>

  <div class="field">
    <span class="lbl">出生地点（用于真太阳时校正）</span>
    <div class="grid2">
      <select value={form.province} onchange={(e) => handleProvince(e.currentTarget.value)} aria-label="省份 / 直辖市">
        <option value="">省份 / 直辖市</option>
        {#each PROVINCES as p}<option value={p.name}>{p.name}</option>{/each}
      </select>
      <select
        value={form.city}
        onchange={(e) => handleCity(e.currentTarget.value)}
        disabled={!form.province}
        style:opacity={form.province ? 1 : 0.45}
        aria-label="城市"
      >
        <option value="">{form.province ? "城市" : "先选省份"}</option>
        {#each cityList as c}<option value={c.name}>{c.name}</option>{/each}
      </select>
    </div>
    {#if form.province}
      <p class="hint strong">
        {form.city || "（请选择城市）"} · 经度 {form.longitude.toFixed(1)}°E · 时差 {offsetMin > 0 ? "+" : ""}{offsetMin} 分钟
      </p>
    {:else}
      <p class="hint">* 倪海厦批命用真太阳时，建议填写出生地以自动校正时辰</p>
    {/if}
  </div>

  <div class="field">
    <span class="lbl">出生时间（北京时间）</span>
    <div class="time-panel" class:dim={form.unknownTime}>
      <div class="grid2" style="margin-bottom: 8px">
        <select bind:value={form.clockHour} aria-label="小时（24 小时制）">
          {#each hours as h}<option value={String(h)}>{String(h).padStart(2, "0")} 时</option>{/each}
        </select>
        <select bind:value={form.clockMinute} aria-label="分钟">
          {#each minutes as min}<option value={String(min)}>{String(min).padStart(2, "0")} 分</option>{/each}
        </select>
      </div>
      <div class="solar">
        <span class="solar-label">真太阳时 → </span>
        <span class="solar-value">{SHICHEN_NAMES[branch]}时</span>
        {#if shichenInfo}
          <span class="solar-label">（{shichenInfo.range}）</span>
        {/if}
      </div>
    </div>
    <label class="unknown">
      <input type="checkbox" bind:checked={form.unknownTime} />
      <span>不知道出生时间，以子时（23:00–01:00）起盘</span>
    </label>
  </div>

  <div class="field">
    <span class="lbl">性别</span>
    <div class="gender-row">
      {#each ["male", "female"] as g}
        {@const active = form.gender === g}
        {@const accent = g === "male" ? "37,99,235" : "225,29,72"}
        <button
          type="button"
          class="gender-btn"
          class:active
          style:border-color={active ? `rgba(${accent},0.6)` : "var(--t-border)"}
          style:background={active ? `rgba(${accent},0.08)` : "transparent"}
          style:color={active ? `rgba(${accent},0.9)` : "var(--t-faint)"}
          onclick={() => (form = { ...form, gender: g })}
        >
          {g === "male" ? "♂ 男" : "♀ 女"}
        </button>
      {/each}
    </div>
  </div>

  {#if showSummary}
    <div class="summary">
      <span class="ok">✓</span>
      <span class="text">{summaryText}</span>
    </div>
  {/if}

  {#if !hideSubmit}
    <button type="submit" class="submit" disabled={loading}>
      {#if loading}
        <span class="spinner"></span> 紫微起盘中…
      {:else}
        立即起盘 · 解命运密码
      {/if}
    </button>
  {/if}
</form>

<style>
  .birth-form {
    background: var(--t-card);
    border: 1px solid var(--t-border);
    border-radius: 24px;
    padding: 28px;
    animation: rise 0.5s ease both;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .title {
    color: var(--t-gold);
    font-size: 12px;
    letter-spacing: 0.4em;
    text-align: center;
    margin: 0 0 20px;
    font-weight: 500;
  }
  .progress {
    display: flex;
    gap: 4px;
    margin-bottom: 20px;
  }
  .bar {
    flex: 1;
    height: 2px;
    border-radius: 2px;
    background: var(--t-border);
    transition: background 0.3s;
  }
  .bar.done {
    background: var(--t-gold);
  }
  .field {
    margin-bottom: 16px;
  }
  .lbl {
    display: block;
    font-size: 11px;
    color: var(--t-faint);
    margin-bottom: 6px;
    letter-spacing: 0.05em;
  }
  input[type="text"],
  select {
    background: var(--t-bg);
    border: 1px solid var(--t-border);
    color: var(--t-text);
    border-radius: 14px;
    padding: 10px 14px;
    font-size: 13px;
    width: 100%;
    outline: none;
    transition: border-color 0.2s;
  }
  input[type="text"]:focus,
  select:focus {
    border-color: rgba(212, 168, 67, 0.5);
  }
  select.err {
    border-color: var(--ji);
  }
  .err-text {
    color: var(--ji);
    font-size: 11px;
    margin: 4px 0 0;
    animation: fade-in 0.18s ease both;
  }
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .grid3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .hint {
    font-size: 10px;
    color: var(--t-faint);
    margin: 5px 0 0;
  }
  .hint.strong {
    color: var(--t-text2);
  }
  .time-panel {
    border-radius: 14px;
    padding: 12px;
    background: var(--t-bg);
    border: 1px solid var(--t-border);
    transition: opacity 0.2s;
  }
  .time-panel.dim {
    opacity: 0.45;
    pointer-events: none;
  }
  .solar {
    text-align: center;
    padding: 4px 0;
  }
  .solar-label {
    font-size: 10px;
    color: var(--t-faint);
  }
  .solar-value {
    font-size: 15px;
    color: var(--t-gold);
    font-weight: 600;
    letter-spacing: 0.08em;
  }
  .unknown {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 8px;
    cursor: pointer;
    font-size: 10px;
    color: var(--t-faint);
  }
  .unknown input {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }
  .gender-row {
    display: flex;
    gap: 10px;
  }
  .gender-btn {
    flex: 1;
    padding: 11px;
    border-radius: 14px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid var(--t-border);
    cursor: pointer;
    transition: all 0.2s;
  }
  .gender-btn:active {
    transform: scale(0.97);
  }
  .summary {
    background: rgba(37, 99, 235, 0.12);
    border: 1px solid rgba(37, 99, 235, 0.35);
    border-radius: 12px;
    padding: 9px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    animation: fade-in 0.25s ease both;
  }
  .summary .ok {
    font-size: 12px;
    color: rgba(147, 197, 253, 0.9);
  }
  .summary .text {
    font-size: 11px;
    color: rgba(147, 197, 253, 0.9);
    letter-spacing: 0.03em;
    flex: 1;
  }
  .submit {
    width: 100%;
    padding: 14px;
    border-radius: 16px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.15em;
    border: none;
    cursor: pointer;
    background: linear-gradient(135deg, rgba(180, 130, 40, 0.9), rgba(240, 200, 80, 0.9));
    color: #08080a;
    box-shadow: 0 4px 20px rgba(212, 168, 67, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
  }
  .submit:hover:not(:disabled) {
    transform: scale(1.01);
  }
  .submit:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
  .spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
