<script lang="ts">
  // 古籍搜索结果页 —— 移植自 Sample/app/library/search/page.tsx（hash 带 ?q=）
  import { getParagraphById, searchClassics } from "@/lib/classics";

  let q = $state("");
  let hits = $state<ReturnType<typeof searchClassics>>([]);

  function runQuery() {
    const raw = window.location.hash.split("?q=")[1] ?? "";
    q = decodeURIComponent(raw).trim();
    hits = q ? searchClassics(q, 50) : [];
  }

  runQuery();
  $effect(() => {
    // hash 变化时重新查询
    void window.location.hash;
    runQuery();
  });

  function chapterOf(paragraphId: string): number {
    return getParagraphById(paragraphId)?.chapterIdx ?? 0;
  }
</script>

<main class="page">
  <div class="head">
    <a class="crumb" href="#/library">← 古籍库</a>
    <span class="mid">搜索结果</span>
    <a class="crumb" href="#/">首页 →</a>
  </div>

  <div class="center">
    <div class="kw-label">搜索关键词</div>
    <h1>「{q || "（空）"}」</h1>
    <div class="count">共找到 <strong>{hits.length}</strong> 条古籍原文匹配</div>
  </div>

  {#if hits.length === 0}
    <div class="empty">
      <div class="icon">📜</div>
      {#if q}
        <div class="e1">暂未在已收录古籍中找到这个关键词</div>
        <div class="e2">
          我们持续补充内容中。可尝试搜索：<br />
          <span class="sug">七杀朝斗 / 双禄朝垣 / 化忌 / 紫微 / 命宫 / 机月同梁</span>
        </div>
      {:else}
        <div class="e1">请输入要搜索的关键词</div>
      {/if}
    </div>
  {:else}
    <div class="hits">
      {#each hits as hit}
        <a
          class="hit"
          href="#/library/{hit.bookSlug}/{chapterOf(hit.paragraphId)}#{hit.paragraphId}"
        >
          <div class="hit-meta">
            <span class="book-name">《{hit.bookTitle}》</span>
            <span class="dot">·</span>
            <span>{hit.chapterTitle}</span>
          </div>
          <!-- snippet 由 searchClassics 生成，已做 HTML 转义（含 <mark>） -->
          {@html hit.snippet}
        </a>
      {/each}
    </div>
  {/if}
</main>

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
    letter-spacing: 0.2em;
  }
  .center {
    text-align: center;
    margin: 40px 0;
  }
  .kw-label {
    font-size: 13px;
    color: var(--t-faint);
    letter-spacing: 0.15em;
    margin-bottom: 4px;
  }
  h1 {
    font-size: clamp(22px, 3.5vw, 32px);
    font-weight: 700;
    color: var(--t-text);
    letter-spacing: 0.1em;
    margin: 0 0 8px;
  }
  .count {
    font-size: 12px;
    color: var(--t-faint);
  }
  .count strong {
    color: var(--t-gold);
  }
  .empty {
    background: var(--t-card);
    padding: 40px 20px;
    border-radius: 12px;
    text-align: center;
    color: var(--t-text2);
    border: 1px solid var(--t-border);
  }
  .icon {
    font-size: 40px;
    margin-bottom: 12px;
    opacity: 0.4;
  }
  .e1 {
    font-size: 14px;
    margin-bottom: 6px;
  }
  .e2 {
    font-size: 11px;
    color: var(--t-faint);
    line-height: 1.7;
  }
  .sug {
    color: var(--t-gold);
  }
  .hits {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .hit {
    display: block;
    background: var(--t-card);
    padding: 16px 20px;
    border-radius: 10px;
    border: 1px solid var(--t-border);
    text-decoration: none;
    color: var(--t-text);
    font-size: 14px;
    line-height: 1.9;
    letter-spacing: 0.02em;
    transition: border-color 0.15s;
  }
  .hit:hover {
    border-color: rgba(212, 168, 67, 0.4);
  }
  .hit-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--t-faint);
    margin-bottom: 8px;
    letter-spacing: 0.1em;
  }
  .book-name {
    color: var(--t-gold);
    font-weight: 600;
  }
  .dot {
    opacity: 0.5;
  }
  .hit :global(mark) {
    background: rgba(212, 168, 67, 0.3);
    color: var(--t-gold);
    padding: 0 2px;
    border-radius: 2px;
    font-weight: 600;
  }
</style>
