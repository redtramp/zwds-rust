<script lang="ts">
  // QimenBoard —— 奇门九宫格渲染（三种盘型：时家 / 刻家 / 金函玉镜）
  // 宫位布局与 kinqimen pan_html 一致：上排 巽離坤 / 中排 震(中)兌 / 下排 艮坎乾
  // 时家天盘三形态 1:1 保留（dict 9 宫 / dict 8 宫 / tuple [aa,bb] —— 设计文档 R-DEV 节）
  interface Props {
    kind: "shijia" | "kejia" | "jinyin";
    chart: Record<string, any>;
  }
  let { kind, chart }: Props = $props();

  const GRID: { gua: string; center?: boolean }[] = [
    { gua: "巽" }, { gua: "離" }, { gua: "坤" },
    { gua: "震" }, { gua: "中", center: true }, { gua: "兌" },
    { gua: "艮" }, { gua: "坎" }, { gua: "乾" },
  ];

  // 天盘：dict 形态直查；tuple 形态（原文第二形态）取 aa（正字典）
  const skyDict = $derived.by<Record<string, string>>(() => {
    const sky = chart["天盤"];
    if (!sky) return {};
    if (Array.isArray(sky)) return (sky[0] as Record<string, string>) ?? {};
    return sky as Record<string, string>;
  });

  // 刻家暗干：原结构 {干支: 宫}，渲染时反查 宫 → 干支
  const anganByGua = $derived.by<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const [gz, gua] of Object.entries(chart["暗干"] ?? {})) m[String(gua)] = String(gz);
    return m;
  });

  const zfzs = $derived<Record<string, string[]>>(chart["值符值使"] ?? {});
  const ma = $derived<Record<string, string>>(chart["馬星"] ?? {});
  const cheng = $derived<Record<string, Record<string, Record<string, string>>>>(chart["長生運"] ?? {});

  const DI_ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const shenEntries = $derived(DI_ZHI.map((b) => [b, String((chart["神"] ?? {})[b] ?? "")] as const));

  const skyOf = (gua: string) => (skyDict as Record<string, string>)[gua] ?? "";
  const earthOf = (gua: string) => ((chart["地盤"] as Record<string, string>) ?? {})[gua] ?? "";
  const starOf = (gua: string) => ((chart["星"] as Record<string, string>) ?? {})[gua] ?? "";
  const doorOf = (gua: string) => ((chart["門"] as Record<string, string>) ?? {})[gua] ?? "";
  const godOf = (gua: string) => ((chart["神"] as Record<string, string>) ?? {})[gua] ?? "";
  function chengOf(gua: string): string {
    const inner = (cheng["地盤"] as Record<string, Record<string, string>> | undefined)?.[gua] ?? {};
    const e = Object.entries(inner)[0];
    return e ? `${e[0]}${e[1]}` : "";
  }
  // 值使门落中宫时在中宫标出（原文 pan 装配口径）
  const zhongZhishi = $derived(
    zfzs["值使門宮"]?.[1] === "中" ? zfzs["值使門宮"]?.[0] ?? "" : "",
  );
</script>

<div class="qmb animate-fade-up">
  {#if kind === "jinyin"}
    <!-- 金函玉鏡（日家奇门）：九宫 = 12 神 + 八门；下方 局 / 鹤神 / 神（12 支） -->
    <div class="grid9">
      {#each GRID as cell (cell.gua)}
        <div class="cell {cell.center ? "center" : ""}">
          <div class="big">{starOf(cell.gua) || (cell.center ? "中" : "")}</div>
          <div class="sub-line">{doorOf(cell.gua)}</div>
          <div class="corner">{cell.gua}</div>
        </div>
      {/each}
    </div>
    <div class="strip">局：{chart["局"]}</div>
    <div class="strip">
      鶴神：
      {#each Object.entries(chart["鶴神"] ?? {}) as [k, v] (k)}
        <span class="chip">{k} {v}</span>
      {/each}
    </div>
    <div class="strip">
      神：
      {#each shenEntries as [b, v] (b)}
        <span class="chip">{b} {v}</span>
      {/each}
    </div>
  {:else}
    <!-- 时家 / 刻家 -->
    <div class="grid9">
      {#each GRID as cell (cell.gua)}
        <div class="cell {cell.center ? "center" : ""}">
          {#if cell.center}
            <div class="big sky">{skyOf("中") || "中"}</div>
            <div class="sub-line">天禽 · {earthOf("中")}</div>
            {#if zhongZhishi}
              <div class="zhishi">值使 {zhongZhishi}</div>
            {/if}
          {:else}
            <div class="big sky">{skyOf(cell.gua)}</div>
            <div class="sub-line">{godOf(cell.gua)} {doorOf(cell.gua)}</div>
            <div class="split"></div>
            <div class="sub-line">
              <span class="earth">{earthOf(cell.gua)}</span>
              <span class="star">{starOf(cell.gua)}</span>
            </div>
            {#if kind === "kejia" && anganByGua[cell.gua]}
              <div class="angan">暗 {anganByGua[cell.gua]}</div>
            {/if}
          {/if}
          <div class="corner">{cell.gua}</div>
        </div>
      {/each}
    </div>
    {#if kind === "kejia"}
      <div class="strip">飛干：{chart["飛干"]}</div>
    {/if}
    <div class="strip">馬星：天馬 {ma["天馬"]}｜丁馬 {ma["丁馬"]}｜驛馬 {ma["驛馬"]}</div>
    <div class="strip">
      長生運：
      {#each GRID as cell (cell.gua)}
        {#if !cell.center && chengOf(cell.gua)}
          <span class="chip">{cell.gua} {chengOf(cell.gua)}</span>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .qmb {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 460px;
  }
  .grid9 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .cell {
    position: relative;
    aspect-ratio: 1;
    background: var(--bg-card);
    border: 1px solid var(--bdr-med);
    border-radius: var(--r-sm);
    box-shadow: var(--sh-xs);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 8px 6px 16px;
    overflow: hidden;
  }
  .cell.center {
    background: var(--ac-bg);
    border-color: var(--ac-bdr);
  }
  .big {
    font-size: 26px;
    font-weight: 600;
    line-height: 1.1;
    color: var(--tx-0);
  }
  .big.sky {
    color: var(--ac-dim);
    font-family: var(--font-mono);
  }
  [data-theme="dark"] .big.sky {
    color: var(--ac-dim);
  }
  .sub-line {
    font-size: 12px;
    color: var(--tx-2);
    display: flex;
    gap: 6px;
    align-items: baseline;
  }
  .earth {
    font-size: 15px;
    font-weight: 600;
    color: var(--tx-1);
  }
  .star {
    font-size: 12px;
    color: var(--tx-2);
  }
  .split {
    width: 70%;
    height: 1px;
    background: var(--bdr);
  }
  .angan {
    font-size: 10px;
    color: var(--tx-3);
  }
  .zhishi {
    font-size: 11px;
    color: var(--ac-dim);
  }
  .corner {
    position: absolute;
    right: 7px;
    bottom: 5px;
    font-size: 11px;
    color: var(--tx-3);
  }
  .strip {
    font-size: 12px;
    color: var(--tx-2);
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .chip {
    background: var(--bg-1);
    border: 1px solid var(--bdr);
    border-radius: var(--r-xs);
    padding: 1px 7px;
    font-size: 11px;
    color: var(--tx-2);
  }
</style>
