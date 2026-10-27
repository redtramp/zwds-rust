<script lang="ts">
  // 命理百科 · 主星详情页（8 字段：倪师观点/古诀/最佳宫/注意宫/事业/感情/财运/健康）
  // 内容取自 engine/star-detail.ts（StarDetailPanel 的 STAR_DETAIL 逐字移植）+ STAR_DESCRIPTIONS
  import { STAR_DETAIL } from "@/lib/engine/star-detail";
  import { STAR_DESCRIPTIONS } from "@/lib/engine/constants";

  let { star: starName }: { star: string } = $props();

  const detail = $derived(STAR_DETAIL[starName] ?? null);
  const desc = $derived(STAR_DESCRIPTIONS[starName] ?? null);

  const CARDS = [
    { label: "事业方向", icon: "◈", key: "career" as const },
    { label: "感情特质", icon: "♡", key: "relationship" as const },
    { label: "财运分析", icon: "◆", key: "wealth" as const },
    { label: "健康提示", icon: "☯", key: "health" as const },
  ];
</script>

{#if detail}
  <main class="page">
    <div class="head">
      <a class="crumb" href="#/knowledge">← 命理百科</a>
    </div>

    <div class="hero">
      <h1>{starName}</h1>
      {#if desc}
        <div class="tags">
          <span class="chip">五行 · {desc.element}</span>
          <span class="chip">性质 · {desc.nature}</span>
          {#each desc.keywords.split("·") as k}
            <span class="chip gold">{k.trim()}</span>
          {/each}
        </div>
      {/if}
    </div>

    <section class="classical">
      <div class="label">古书原文</div>
      <p class="text">{detail.classical}</p>
    </section>

    <section class="ni">
      <div class="label">倪海厦老师解读</div>
      <p class="text">{detail.niHaixia}</p>
    </section>

    <div class="grid">
      {#each CARDS as c}
        <div class="card">
          <div class="card-label"><span class="icon">{c.icon}</span> {c.label}</div>
          <p class="card-text">{detail[c.key]}</p>
        </div>
      {/each}
    </div>

    <div class="palaces">
      <div class="palace good">
        <div class="p-label">最佳宫位</div>
        <div class="p-value">{detail.bestPalace}</div>
      </div>
      <div class="palace bad">
        <div class="p-label">注意宫位</div>
        <div class="p-value">{detail.worstPalace}</div>
      </div>
    </div>
  </main>
{:else}
  <main class="page miss">
    <p>未收录「{starName}」。</p>
    <a href="#/knowledge" class="crumb">← 返回百科</a>
  </main>
{/if}

<style>
  .page {
    max-width: 768px;
    margin: 0 auto;
    padding: 24px 24px 80px;
    /* fixed 路由：页面锁满内容区高度，超出内容在此内部滚动，右侧不出现页面滚动条 */
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto;
  }
  .head {
    padding-bottom: 16px;
    border-bottom: 1px solid var(--t-border);
  }
  .crumb {
    font-size: 12px;
    color: var(--t-gold);
    letter-spacing: 0.2em;
    text-decoration: none;
  }
  .hero {
    text-align: center;
    margin: 36px 0;
  }
  h1 {
    font-size: clamp(30px, 5vw, 44px);
    font-weight: 700;
    color: var(--t-gold);
    letter-spacing: 0.3em;
    margin: 0 0 14px;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }
  .chip {
    font-size: 10px;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--t-border);
    color: var(--t-text2);
  }
  .chip.gold {
    color: var(--t-gold);
    border-color: rgba(212, 168, 67, 0.2);
    background: rgba(212, 168, 67, 0.06);
  }
  .classical {
    background: rgba(212, 168, 67, 0.04);
    border: 1px solid rgba(212, 168, 67, 0.12);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
  }
  .classical .text {
    font-size: 12px;
    font-style: italic;
    line-height: 1.9;
    color: var(--t-gold);
    opacity: 0.85;
    margin: 0;
  }
  .ni {
    margin-bottom: 16px;
  }
  .ni .text {
    font-size: 13px;
    line-height: 1.9;
    color: var(--t-text2);
    margin: 0;
  }
  .label {
    font-size: 10px;
    letter-spacing: 0.2em;
    color: var(--t-faint);
    margin-bottom: 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }
  @media (max-width: 640px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .card {
    background: var(--t-card);
    border: 1px solid var(--t-border);
    border-radius: 10px;
    padding: 14px;
  }
  .card-label {
    font-size: 10px;
    color: var(--t-faint);
    margin-bottom: 6px;
  }
  .icon {
    color: var(--t-gold);
    opacity: 0.6;
  }
  .card-text {
    font-size: 11px;
    line-height: 1.8;
    color: var(--t-text2);
    margin: 0;
  }
  .palaces {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .palace {
    padding: 12px;
    border-radius: 10px;
    font-size: 10px;
  }
  .palace.good {
    border: 1px solid rgba(74, 222, 128, 0.15);
    background: rgba(74, 222, 128, 0.05);
  }
  .palace.bad {
    border: 1px solid rgba(248, 113, 113, 0.15);
    background: rgba(248, 113, 113, 0.05);
  }
  .p-label {
    font-weight: 500;
    margin-bottom: 4px;
  }
  .good .p-label,
  .good .p-value {
    color: #10b981;
  }
  .bad .p-label,
  .bad .p-value {
    color: #ef4444;
  }
  .miss {
    text-align: center;
    padding-top: 80px;
  }
</style>
