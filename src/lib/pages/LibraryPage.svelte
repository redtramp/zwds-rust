<script lang="ts">
  // 古籍库主页 —— 移植自 Sample/app/library/page.tsx（书卡列表 + 搜索入口）
  // 数据源：SQLite（classics.db）；10 分类 pill + 书卡，异步加载
  import { listBooks, getStats } from "@/lib/classics";
  import type { BookSummary, LibraryStats } from "@/lib/classics";

  const CATEGORIES = ["全部", "紫微斗数", "周易", "命理", "奇门遁甲", "六壬", "堪舆风水", "占卜", "相术", "其他", "现代"];

  let query = $state("");
  let activeCat = $state("全部");
  let books = $state<BookSummary[]>([]);
  let stats = $state<LibraryStats | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let statsLoaded = $state(false);

  let gen = 0;
  async function load(cat: string) {
    const my = ++gen;
    loading = true;
    error = null;
    try {
      const list = await listBooks(cat === "全部" ? undefined : cat);
      if (my !== gen) return; // 切换已被取代
      books = list;
    } catch (e) {
      if (my !== gen) return;
      error = e instanceof Error ? e.message : String(e);
    } finally {
      if (my === gen) loading = false;
    }
  }

  $effect(() => {
    void load(activeCat);
    if (!statsLoaded) {
      statsLoaded = true;
      getStats()
        .then((s) => (stats = s))
        .catch(() => (stats = null));
    }
  });

  function doSearch() {
    const q = query.trim();
    if (!q) return;
    window.location.hash = `/library/search?q=${encodeURIComponent(q)}`;
  }
</script>

<main class="page">
  <div class="hero">
    <div class="deco"><span class="line"></span><span class="tag">SHUSHU · CLASSICS</span><span class="line"></span></div>
    <h1>数术古籍原典库</h1>
    <p class="intro">
      九大门类传世古籍全文检索<br />
      {#if stats}
        收录 <strong>{stats.bookCount}</strong> 部古籍 · 共 <strong>{stats.paragraphCount.toLocaleString()}</strong> 段原文
      {:else}
        收录中…
      {/if}
    </p>
    <input
      class="search"
      type="text"
      placeholder="搜索古籍原文，如：紫微 / 奇门 / 六壬 / 风水 / 梅花"
      bind:value={query}
      onkeydown={(e) => e.key === "Enter" && doSearch()}
    />
  </div>

  <div class="cats">
    {#each CATEGORIES as cat}
      <button class="cat-pill" class:active={activeCat === cat} onclick={() => (activeCat = cat)}>
        {cat}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="state"><span class="loading">加载中…</span></div>
  {:else if error}
    <div class="state"><span class="err">古籍库加载失败：{error}</span></div>
  {:else if books.length === 0}
    <div class="state"><span>该分类暂无收录。</span></div>
  {:else}
    <div class="books">
      {#each books as book}
        <a class="book" href="#/library/{book.slug}">
          <div class="meta">{book.category} · {book.dynasty} · {book.author.split(" ")[0]}</div>
          <div class="title">《{book.title}》</div>
          <div class="intro">{book.intro}</div>
          <div class="stats">
            <span>{book.chapterCount} 章节</span>
            <span class="dot">·</span>
            <span>{book.paragraphCount} 段原文</span>
          </div>
          <div class="go">进入查阅 →</div>
        </a>
      {/each}
    </div>
  {/if}

  <div class="about">
    <div class="about-title">关于本库</div>
    <div class="about-body">
      来源含 shushubook 术数书库（9 类 201 部）与 3 部紫微斗数精选，另含少量现代著作。<br />
      内容持续完善，如发现任何错误请联系我们。
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
  .cats {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
    margin-bottom: 28px;
  }
  .cat-pill {
    font-size: 12px;
    padding: 6px 12px;
    border-radius: 8px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--t-faint);
    letter-spacing: 0.1em;
    transition: all 0.2s;
  }
  .cat-pill:hover {
    color: var(--t-text);
  }
  .cat-pill.active {
    color: var(--t-gold);
    background: rgba(212, 168, 67, 0.1);
  }
  .state {
    text-align: center;
    padding: 60px 0;
    color: var(--t-text2);
    font-size: 14px;
  }
  .loading {
    color: var(--t-faint);
    letter-spacing: 0.2em;
  }
  .err {
    color: var(--ji);
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
