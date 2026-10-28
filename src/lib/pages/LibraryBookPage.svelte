<script lang="ts">
  // 古籍章节目录页 —— 对应 Sample/app/library/[book]/page.tsx
  // 数据源：SQLite（classics.db），异步加载
  import { getBookSummary, listChapters } from "@/lib/classics";
  import type { BookSummary, ChapterSummary } from "@/lib/classics";

  let { book: bookSlug }: { book: string } = $props();

  let book = $state<BookSummary | null>(null);
  let chapters = $state<ChapterSummary[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let gen = 0;
  $effect(() => {
    const slug = bookSlug;
    const my = ++gen;
    loading = true;
    error = null;
    (async () => {
      try {
        const [b, ch] = await Promise.all([getBookSummary(slug), listChapters(slug)]);
        if (my !== gen) return; // 路由已切走，丢弃过期结果
        book = b;
        chapters = ch;
      } catch (e) {
        if (my !== gen) return;
        error = e instanceof Error ? e.message : String(e);
      } finally {
        if (my === gen) loading = false;
      }
    })();
  });
</script>

{#if loading}
  <main class="page center-miss"><p class="loading">加载中…</p></main>
{:else if error}
  <main class="page center-miss">
    <p class="err">古籍库加载失败：{error}</p>
    <a href="#/library" class="crumb">← 返回古籍库</a>
  </main>
{:else if book}
  <main class="page">
    <div class="head">
      <a class="crumb" href="#/library">← 古籍库</a>
      <span class="mid">{book.dynasty} · {book.author}</span>
      <a class="crumb" href="#/">首页 →</a>
    </div>

    <div class="center">
      <h1>《{book.title}》</h1>
      <p class="intro">{book.intro}</p>
      <div class="count">{book.chapterCount} 章节 · {book.paragraphCount} 段原文</div>
    </div>

    <div class="chapters">
      {#each chapters as chapter}
        <a class="chapter" href="#/library/{book.slug}/{chapter.idx}">
          <span class="idx">{String(chapter.idx + 1).padStart(2, "0")}</span>
          <span class="c-title">{chapter.title}</span>
          {#if chapter.subtitle}<span class="c-sub">{chapter.subtitle}</span>{/if}
          <span class="arrow">→</span>
        </a>
      {/each}
    </div>
  </main>
{:else}
  <main class="page center-miss">
    <p>未找到该书。</p>
    <a href="#/library" class="crumb">← 返回古籍库</a>
  </main>
{/if}

<style>
  .page {
    max-width: 768px;
    margin: 0 auto;
    padding: 24px 24px 80px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--t-border);
  }
  .crumb {
    font-size: 12px;
    color: var(--t-gold);
    letter-spacing: 0.2em;
    text-decoration: none;
  }
  .mid {
    font-size: 12px;
    color: var(--t-faint);
    letter-spacing: 0.15em;
  }
  .center {
    text-align: center;
    margin: 40px 0;
  }
  h1 {
    font-size: clamp(24px, 3.5vw, 36px);
    font-weight: 700;
    color: var(--t-text);
    letter-spacing: 0.15em;
    margin: 0 0 12px;
  }
  .intro {
    font-size: 13px;
    color: var(--t-text2);
    line-height: 1.8;
    margin: 0 0 10px;
  }
  .count {
    font-size: 12px;
    color: var(--t-faint);
  }
  .chapters {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .chapter {
    display: flex;
    align-items: baseline;
    gap: 12px;
    background: var(--t-card);
    border: 1px solid var(--t-border);
    border-radius: 10px;
    padding: 14px 18px;
    text-decoration: none;
    transition: border-color 0.15s;
  }
  .chapter:hover {
    border-color: rgba(212, 168, 67, 0.4);
  }
  .idx {
    font-size: 11px;
    color: var(--t-gold);
    font-weight: 600;
  }
  .c-title {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    color: var(--t-text);
    letter-spacing: 0.05em;
  }
  .c-sub {
    font-size: 11px;
    color: var(--t-faint);
  }
  .arrow {
    color: var(--t-faint);
    font-size: 12px;
  }
  .center-miss {
    text-align: center;
    padding-top: 80px;
  }
  .loading {
    color: var(--t-faint);
    letter-spacing: 0.2em;
  }
  .err {
    color: var(--ji);
    font-size: 14px;
    margin-bottom: 16px;
  }
</style>
