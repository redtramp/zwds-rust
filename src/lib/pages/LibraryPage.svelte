<script lang="ts">
  // 古籍库主页 —— 移植自 Sample/app/library/page.tsx（书卡列表 + 搜索入口）
  import { ALL_BOOKS, TOTAL_PARAGRAPHS } from "@/lib/classics";

  let query = $state("");

  function doSearch() {
    const q = query.trim();
    if (!q) return;
    window.location.hash = `/library/search?q=${encodeURIComponent(q)}`;
  }
</script>

<main class="page">
  <div class="hero">
    <div class="deco"><span class="line"></span><span class="tag">NI HAI XIA · CURRICULUM</span><span class="line"></span></div>
    <h1>倪师方法论 · 古籍原典库</h1>
    <p class="intro">
      紫微斗数权威古籍全文检索<br />
      收录 <strong>{ALL_BOOKS.length}</strong> 部古籍 · 共 <strong>{TOTAL_PARAGRAPHS}</strong> 段精华
    </p>
    <input
      class="search"
      type="text"
      placeholder="搜索古籍原文，如：七杀朝斗 / 化忌 / 机月同梁"
      bind:value={query}
      onkeydown={(e) => e.key === "Enter" && doSearch()}
    />
  </div>

  <div class="books">
    {#each ALL_BOOKS as book}
      <a class="book" href="#/library/{book.slug}">
        <div class="meta">{book.dynasty} · {book.author.split(" ")[0]}</div>
        <div class="title">《{book.title}》</div>
        <div class="intro">{book.intro}</div>
        <div class="stats">
          <span>{book.chapters.length} 章节</span>
          <span class="dot">·</span>
          <span>{book.chapters.reduce((s, c) => s + c.paragraphs.length, 0)} 段精华</span>
        </div>
        <div class="go">进入查阅 →</div>
      </a>
    {/each}
  </div>

  <div class="about">
    <div class="about-title">关于本库</div>
    <div class="about-body">
      所收录古籍均为公版（明代刊本）。<br />
      内容持续完善，未来将补全《紫微斗数全集》全本与倪海厦《天纪》引证目录。<br />
      如发现任何错误请联系我们。
    </div>
  </div>
</main>

<style>
  .page {
    max-width: 1024px;
    margin: 0 auto;
    padding: 40px 24px 80px;
  }
  .hero {
    text-align: center;
    margin-bottom: 48px;
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
  .deco .tag {
    font-size: 11px;
    color: var(--t-gold);
    letter-spacing: 0.4em;
  }
  h1 {
    font-size: clamp(26px, 4vw, 40px);
    font-weight: 700;
    color: var(--t-text);
    letter-spacing: 0.15em;
    margin: 0 0 12px;
  }
  .intro {
    font-size: 14px;
    color: var(--t-text2);
    letter-spacing: 0.1em;
    line-height: 1.7;
  }
  .intro strong {
    color: var(--t-gold);
  }
  .search {
    margin-top: 24px;
    width: min(480px, 100%);
    padding: 12px 18px;
    border-radius: 12px;
    border: 1px solid var(--t-border);
    background: var(--t-card);
    color: var(--t-text);
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }
  .search:focus {
    border-color: rgba(212, 168, 67, 0.5);
  }
  .books {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }
  .book {
    display: block;
    background: var(--t-card);
    border: 1px solid var(--t-border);
    border-radius: 14px;
    padding: 24px;
    text-decoration: none;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(212, 168, 67, 0.06);
  }
  .book:hover {
    box-shadow: 0 6px 20px rgba(212, 168, 67, 0.12);
    transform: translateY(-2px);
  }
  .meta {
    font-size: 11px;
    color: var(--t-faint);
    letter-spacing: 0.2em;
    margin-bottom: 6px;
  }
  .title {
    font-size: 20px;
    font-weight: 600;
    color: var(--t-text);
    margin-bottom: 10px;
    letter-spacing: 0.1em;
  }
  .intro {
    font-size: 12px;
    color: var(--t-text2);
    line-height: 1.7;
    margin-bottom: 14px;
  }
  .stats {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: var(--t-faint);
  }
  .dot {
    color: rgba(212, 168, 67, 0.4);
  }
  .go {
    display: inline-flex;
    margin-top: 14px;
    font-size: 11px;
    color: var(--t-gold);
    letter-spacing: 0.15em;
    font-weight: 500;
  }
  .about {
    margin-top: 60px;
    padding: 24px;
    background: rgba(212, 168, 67, 0.05);
    border-radius: 10px;
    text-align: center;
  }
  .about-title {
    font-size: 11px;
    color: var(--t-gold);
    font-weight: 600;
    letter-spacing: 0.15em;
    margin-bottom: 8px;
  }
  .about-body {
    font-size: 12px;
    color: var(--t-text2);
    line-height: 1.8;
  }
</style>
