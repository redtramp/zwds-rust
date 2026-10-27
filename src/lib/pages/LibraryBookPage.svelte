<script lang="ts">
  // 古籍章节目录页 —— 对应 Sample/app/library/[book]/page.tsx
  import { getBookBySlug } from "@/lib/classics";

  let { book: bookSlug }: { book: string } = $props();

  const book = $derived(getBookBySlug(bookSlug));
</script>

{#if book}
  <main class="page">
    <div class="head">
      <a class="crumb" href="#/library">← 古籍库</a>
      <span class="mid">{book.dynasty} · {book.author}</span>
      <a class="crumb" href="#/">首页 →</a>
    </div>

    <div class="center">
      <h1>《{book.title}》</h1>
      <p class="intro">{book.intro}</p>
      <div class="count">{book.chapters.length} 章节 · {book.chapters.reduce((s, c) => s + c.paragraphs.length, 0)} 段精华</div>
    </div>

    <div class="chapters">
      {#each book.chapters as chapter, i}
        <a class="chapter" href="#/library/{book.slug}/{i}">
          <span class="idx">{String(i + 1).padStart(2, "0")}</span>
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
</style>
