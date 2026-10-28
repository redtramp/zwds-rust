<script lang="ts">
  // 古籍章节阅读页 —— 移植自 Sample/app/library/[book]/[chapter]/page.tsx
  // 支持段落锚点跳转（#/library/:book/:chapter#:paraId）
  // 数据源：SQLite（classics.db），异步加载
  import { getChapterContent, listChapters } from "@/lib/classics";
  import type { BookSummary, ChapterSummary, Paragraph } from "@/lib/classics";

  let { book: bookSlug, chapter: chapterIdx }: { book: string; chapter: string } = $props();

  let book = $state<BookSummary | null>(null);
  let chapter = $state<ChapterSummary | null>(null);
  let paragraphs = $state<Paragraph[]>([]);
  let chapters = $state<ChapterSummary[]>([]);
  let idx = $state(0);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let gen = 0;
  $effect(() => {
    const slug = bookSlug;
    const ci = parseInt(chapterIdx);
    const my = ++gen;
    loading = true;
    error = null;
    (async () => {
      try {
        const [content, all] = await Promise.all([getChapterContent(slug, ci), listChapters(slug)]);
        if (my !== gen) return; // 路由已切走，丢弃过期结果
        if (!content) return;
        book = content.book;
        chapter = content.chapter;
        paragraphs = content.paragraphs;
        chapters = all;
        idx = ci;
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
{:else if book && chapter}
  <main class="page">
    <div class="head">
      <a class="crumb" href="#/library/{book.slug}">← 《{book.title}》目录</a>
      <span class="mid">{chapter.title}</span>
      <a class="crumb" href="#/library">古籍库 →</a>
    </div>

    <div class="center">
      <div class="book-meta">《{book.title}》· {book.dynasty}</div>
      <h1>{chapter.title}</h1>
      {#if chapter.subtitle}
        <div class="subtitle">{chapter.subtitle}</div>
      {/if}
    </div>

    <div class="body">
      {#each paragraphs as p, i}
        <div class="para" id={p.id}>
          <div class="para-row">
            <span class="p-idx">{String(p.idx).padStart(2, "0")}</span>
            <p class="p-text">{p.text}</p>
          </div>
          {#if p.translation}
            <div class="note translation"><span class="n-tag">白话</span>{p.translation}</div>
          {/if}
          {#if p.niNote}
            <div class="note ni-note"><span class="n-tag ji">倪师注</span>{p.niNote}</div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="nav">
      {#if idx > 0}
        <a class="chapter-nav" href="#/library/{book.slug}/{idx - 1}">
          <div class="cn-label">← 上一章</div>
          <div class="cn-title">{chapters[idx - 1]?.title}</div>
        </a>
      {:else}
        <div class="spacer"></div>
      {/if}
      {#if idx < chapters.length - 1}
        <a class="chapter-nav right" href="#/library/{book.slug}/{idx + 1}">
          <div class="cn-label">下一章 →</div>
          <div class="cn-title">{chapters[idx + 1]?.title}</div>
        </a>
      {:else}
        <div class="spacer"></div>
      {/if}
    </div>
  </main>
{:else}
  <main class="page center-miss">
    <p>章节不存在。</p>
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
    margin: 36px 0;
  }
  .book-meta {
    font-size: 11px;
    color: var(--t-faint);
    letter-spacing: 0.25em;
    margin-bottom: 8px;
  }
  h1 {
    font-size: clamp(24px, 3.5vw, 36px);
    font-weight: 700;
    color: var(--t-text);
    letter-spacing: 0.15em;
    margin: 0 0 8px;
  }
  .subtitle {
    font-size: 13px;
    color: var(--t-text2);
    letter-spacing: 0.1em;
  }
  .body {
    background: var(--t-card);
    border-radius: 14px;
    border: 1px solid var(--t-border);
    padding: 32px 28px;
  }
  .para {
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px dashed rgba(212, 168, 67, 0.15);
    scroll-margin-top: 80px;
  }
  .para:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
  .para-row {
    display: flex;
    gap: 12px;
    align-items: baseline;
  }
  .p-idx {
    font-size: 11px;
    color: var(--t-gold);
    font-weight: 600;
    letter-spacing: 0.1em;
    min-width: 24px;
  }
  .p-text {
    flex: 1;
    margin: 0;
    font-size: 16px;
    color: var(--t-text);
    line-height: 2;
    letter-spacing: 0.04em;
    font-family: "Noto Serif CJK SC", "Songti SC", serif;
  }
  .note {
    margin: 8px 0 0 36px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--t-text2);
    line-height: 1.8;
  }
  .translation {
    background: rgba(212, 168, 67, 0.05);
  }
  .ni-note {
    background: rgba(196, 90, 45, 0.05);
  }
  .n-tag {
    font-size: 10px;
    color: var(--t-gold);
    margin-right: 6px;
  }
  .n-tag.ji {
    color: var(--ji);
  }
  .nav {
    margin-top: 24px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .chapter-nav {
    flex: 1;
    padding: 14px 18px;
    background: var(--t-card);
    border: 1px solid var(--t-border);
    border-radius: 10px;
    text-decoration: none;
    color: var(--t-text);
  }
  .chapter-nav.right {
    text-align: right;
  }
  .chapter-nav:hover {
    border-color: rgba(212, 168, 67, 0.4);
  }
  .cn-label {
    font-size: 10px;
    color: var(--t-faint);
    letter-spacing: 0.2em;
    margin-bottom: 2px;
  }
  .cn-title {
    font-size: 13px;
    font-weight: 500;
  }
  .spacer {
    flex: 1;
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
