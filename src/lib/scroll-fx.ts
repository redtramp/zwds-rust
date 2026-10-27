// 滚动动效工具（D6 高保真）：
// - reveal：IntersectionObserver 驱动的滚动入场（once 语义，等价原版 useInView + FadeIn）
// - heroParallax：rAF 节流的滚动联动（等价原版 useScroll + useTransform 的 hero 视差）

import type { Action } from "svelte/action";

/** 滚动入场：进入视口后加 .revealed（once）。可用 style="--reveal-y: 28px; --reveal-delay: .2s" 微调 */
export const reveal: Action<HTMLElement, { delay?: number; y?: number } | undefined> = (
  node,
  params,
) => {
  const y = params?.y ?? 28;
  const delay = params?.delay ?? 0;
  node.classList.add("reveal-init");
  node.style.setProperty("--reveal-y", `${y}px`);
  node.style.setProperty("--reveal-delay", `${delay}s`);

  let done = false;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !done) {
          done = true;
          node.classList.add("revealed");
          io.disconnect();
        }
      }
    },
    { rootMargin: "-80px 0px" },
  );
  io.observe(node);

  return {
    destroy() {
      io.disconnect();
    },
  };
};

/** hero 视差：返回清理函数。progress ∈ [0,1]（start start → end start），回调驱动样式 */
export function heroParallax(
  hero: HTMLElement,
  onProgress: (progress: number) => void,
): () => void {
  let raf = 0;
  let ticking = false;

  const update = () => {
    ticking = false;
    const rect = hero.getBoundingClientRect();
    const total = rect.height || 1;
    const progress = Math.min(1, Math.max(0, -rect.top / total));
    onProgress(progress);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    raf = requestAnimationFrame(update);
  };

  update();
  // capture: scroll 事件不冒泡，但捕获阶段可收到任意后代滚动容器（.content）的滚动
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  window.addEventListener("resize", onScroll);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("resize", onScroll);
  };
}

/* 配套全局样式（在 app.css 中注入一次） */
if (typeof document !== "undefined" && !document.getElementById("scroll-fx-style")) {
  const style = document.createElement("style");
  style.id = "scroll-fx-style";
  style.textContent = `
    .reveal-init {
      opacity: 0;
      transform: translateY(var(--reveal-y, 28px));
      transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) var(--reveal-delay, 0s),
        transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) var(--reveal-delay, 0s);
    }
    .reveal-init.revealed {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);
}
