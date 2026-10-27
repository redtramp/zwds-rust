<script lang="ts">
  // App 路由壳：hash 路由 + 顶部导航 + 主题切换。
  // M4：chart 全功能；settings 为 M7、其余页为 M5/M6 占位。
  import { parseHash, type RouteInfo } from "@/lib/router";
  import { theme, applyTheme, toggleTheme } from "@/lib/stores/theme.svelte";
  import { applyAppearance } from "@/lib/stores/appearance.svelte";
  import ChartPage from "@/lib/pages/ChartPage.svelte";
  import HemingPage from "@/lib/pages/HemingPage.svelte";
  import KnowledgePage from "@/lib/pages/KnowledgePage.svelte";
  import KnowledgeStarPage from "@/lib/pages/KnowledgeStarPage.svelte";
  import LibraryPage from "@/lib/pages/LibraryPage.svelte";
  import LibrarySearchPage from "@/lib/pages/LibrarySearchPage.svelte";
  import LibraryBookPage from "@/lib/pages/LibraryBookPage.svelte";
  import LibraryChapterPage from "@/lib/pages/LibraryChapterPage.svelte";
  import HomePage from "@/lib/pages/HomePage.svelte";
  import PreviewPage from "@/lib/pages/PreviewPage.svelte";
  import PrivacyPage from "@/lib/pages/PrivacyPage.svelte";
  import TermsPage from "@/lib/pages/TermsPage.svelte";
  import SettingsPage from "@/lib/pages/SettingsPage.svelte";

  let route = $state<RouteInfo>(parseHash());
  let booted = false;

  $effect(() => {
    // 防闪烁：启动即应用持久化主题与外观（字体/字号）
    if (!booted) {
      booted = true;
      applyTheme(theme.mode);
      applyAppearance();
    }
  });

  function onHashChange() {
    route = parseHash();
    window.scrollTo(0, 0);
  }

  const NAV = [
    { hash: "/", label: "首页" },
    { hash: "/chart", label: "排盘" },
    { hash: "/heming", label: "合盘" },
    { hash: "/knowledge", label: "百科" },
    { hash: "/library", label: "古籍" },
    { hash: "/settings", label: "设置" },
  ];

  function isActive(hash: string): boolean {
    const seg = hash.replace(/^\//, "");
    if (seg === "") return route.segments.length === 0;
    return route.segments[0] === seg;
  }
</script>

<svelte:window onhashchange={onHashChange} />

<div
  class="shell"
  class:fixed={route.segments[0] === "chart" || route.segments[0] === "heming" || route.segments[0] === "knowledge"}
>
  <header class="topbar">
    <a class="brand" href="#/">紫微斗数</a>
    <nav class="nav">
      {#each NAV as item}
        <a class="nav-item" class:active={isActive(item.hash)} href="#{item.hash}">{item.label}</a>
      {/each}
    </nav>
    <button class="theme-btn" onclick={toggleTheme} title="切换主题">
      {theme.mode === "dark" ? "☾" : "☀"}
    </button>
  </header>

  <div class="content">
    {#if route.segments[0] === "chart"}
      <ChartPage />
    {:else if route.segments[0] === "heming"}
      <HemingPage />
    {:else if route.segments[0] === "knowledge"}
      {#if route.segments.length >= 2}
        <KnowledgeStarPage star={route.segments[1]} />
      {:else}
        <KnowledgePage />
      {/if}
    {:else if route.segments[0] === "library"}
      {#if route.segments[1] === "search"}
        <LibrarySearchPage />
      {:else if route.segments.length >= 3}
        <LibraryChapterPage book={route.segments[1]} chapter={route.segments[2]} />
      {:else if route.segments.length === 2}
        <LibraryBookPage book={route.segments[1]} />
      {:else}
        <LibraryPage />
      {/if}
    {:else if route.segments.length === 0}
      <HomePage />
    {:else if route.segments[0] === "preview"}
      <PreviewPage />
    {:else if route.segments[0] === "privacy"}
      <PrivacyPage />
    {:else if route.segments[0] === "terms"}
      <TermsPage />
    {:else if route.segments[0] === "settings"}
      <SettingsPage />
    {:else}
      <main class="placeholder-page">
        <h1>{route.segments[0]}</h1>
        <p>该页将于后续里程碑实现（M5/M6）。</p>
      </main>
    {/if}
  </div>
</div>

<style>
  .shell {
    /* --app-h：字体缩放（html zoom>1）时由 JS 校正为 innerHeight/zoom，
       否则 100vh 在根 zoom 下会物理放大、撑出右侧滚动条；zoom=1 时回退 100vh */
    min-height: var(--app-h, 100vh);
    display: flex;
    flex-direction: column;
  }
  /* 排盘/合盘/百科等操作页：窗口高度锁死、右侧不出现滚动条，溢出在页内各区自行滚动 */
  .shell.fixed {
    height: var(--app-h, 100vh);
    overflow: hidden;
  }
  .topbar {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 20px;
    background: color-mix(in srgb, var(--bg-page) 88%, transparent);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--t-border);
  }
  .brand {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.25em;
    color: var(--t-gold);
    text-decoration: none;
  }
  .nav {
    display: flex;
    gap: 4px;
    flex: 1;
  }
  .nav-item {
    font-size: 12px;
    padding: 6px 12px;
    border-radius: 8px;
    text-decoration: none;
    color: var(--t-faint);
    transition: all 0.2s;
  }
  .nav-item:hover {
    color: var(--t-text);
  }
  .nav-item.active {
    color: var(--t-gold);
    background: rgba(212, 168, 67, 0.1);
  }
  .theme-btn {
    border: 1px solid var(--t-border);
    background: transparent;
    color: var(--t-text2);
    border-radius: 8px;
    width: 32px;
    height: 32px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }
  .theme-btn:hover {
    color: var(--t-gold);
    border-color: rgba(212, 168, 67, 0.3);
  }
  .content {
    flex: 1;
    min-height: 0;
  }
  .shell.fixed .content {
    overflow: hidden;
  }
  .placeholder-page {
    max-width: 720px;
    margin: 0 auto;
    padding: 64px 20px;
    text-align: center;
  }
  .placeholder-page h1 {
    color: var(--t-gold);
    letter-spacing: 0.2em;
  }
  .placeholder-page p {
    color: var(--t-faint);
    font-size: 13px;
  }
</style>
