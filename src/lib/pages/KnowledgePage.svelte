<script lang="ts">
  // 命理百科 · 14 主星列表（数据：engine/star-detail.ts + constants 的 STAR_DESCRIPTIONS）
  import { STAR_DETAIL } from "@/lib/engine/star-detail";
  import { STAR_DESCRIPTIONS } from "@/lib/engine/constants";

  const stars = $derived(
    Object.keys(STAR_DETAIL).map((name) => ({
      name,
      desc: STAR_DESCRIPTIONS[name],
      detail: STAR_DETAIL[name],
    })),
  );
</script>

<main class="page">
  <div class="hero">
    <div class="deco"><span class="line"></span><span class="tag">ZI WEI · 14 MAJOR STARS</span><span class="line"></span></div>
    <h1>命理百科 · 十四主星</h1>
    <p class="intro">倪海厦体系主星详解：倪师观点 · 古诀原文 · 最佳/注意宫位 · 事业 感情 财运 健康</p>
  </div>

  <div class="cards">
    {#each stars as s}
      <a class="card" href="#/knowledge/{s.name}">
        <div class="name">{s.name}</div>
        {#if s.desc}
          <div class="nature">{s.desc.element} · {s.desc.nature}</div>
        {/if}
        <p class="brief">{s.detail.niHaixia.slice(0, 56)}…</p>
        <div class="go">查看详解 →</div>
      </a>
    {/each}
  </div>
</main>

<style>
  .page {
    max-width: 1024px;
    margin: 0 auto;
    padding: 40px 24px 80px;
    /* fixed 路由：页面锁满内容区高度，超出内容在此内部滚动，右侧不出现页面滚动条 */
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto;
  }
  .hero {
    text-align: center;
    margin-bottom: 40px;
  }
  .deco {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .line {
    height: 1px;
    width: 48px;
    background: linear-gradient(to right, transparent, rgba(212, 168, 67, 0.4));
  }
  .tag {
    font-size: 11px;
    color: var(--t-gold);
    letter-spacing: 0.4em;
  }
  h1 {
    font-size: clamp(24px, 4vw, 38px);
    font-weight: 700;
    color: var(--t-text);
    letter-spacing: 0.15em;
    margin: 0 0 12px;
  }
  .intro {
    font-size: 13px;
    color: var(--t-faint);
    letter-spacing: 0.08em;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }
  .card {
    display: block;
    background: var(--t-card);
    border: 1px solid var(--t-border);
    border-radius: 14px;
    padding: 20px;
    text-decoration: none;
    transition: all 0.2s;
  }
  .card:hover {
    border-color: rgba(212, 168, 67, 0.45);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(212, 168, 67, 0.1);
  }
  .name {
    font-size: 22px;
    font-weight: 700;
    color: var(--t-gold);
    letter-spacing: 0.15em;
    margin-bottom: 4px;
  }
  .nature {
    font-size: 11px;
    color: var(--t-faint);
    margin-bottom: 10px;
    letter-spacing: 0.08em;
  }
  .brief {
    font-size: 12px;
    color: var(--t-text2);
    line-height: 1.7;
    margin: 0 0 12px;
  }
  .go {
    font-size: 11px;
    color: var(--t-gold);
    letter-spacing: 0.12em;
  }
</style>
