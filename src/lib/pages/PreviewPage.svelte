<script lang="ts">
  // 卷轴开场 —— 移植自 Sample/components/ScrollIntro.tsx + app/preview/page.tsx
  // 时间轴：0–1.9s 卷轴展开 → 1.9s 内容浮现 → 3.5s 开始淡出 → 4.2s onComplete（回放按钮重放）
  const BEIDOU = ["天枢", "天璇", "天玑", "天权", "玉衡", "开阳", "摇光"];

  let visible = $state(true);
  let unrolled = $state(false);
  let fading = $state(false);
  let timers: ReturnType<typeof setTimeout>[] = [];

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function play() {
    clearTimers();
    visible = true;
    fading = false;
    unrolled = false;
    timers.push(setTimeout(() => (unrolled = true), 1900));
    timers.push(setTimeout(() => (fading = true), 3500));
    timers.push(
      setTimeout(() => {
        visible = false;
      }, 4200),
    );
  }

  function skip() {
    clearTimers();
    visible = false;
  }

  function replay() {
    play();
  }

  // 组件销毁时清掉未触发的定时器
  $effect(() => () => clearTimers());

  play();
</script>

<main class="preview-page">
  <button class="back" onclick={() => (window.location.hash = "/")}>← 返回首页</button>

  {#if visible}
    <div class="overlay" class:fading role="presentation">
      <div class="stars-bg"></div>

      <div class="scroll-area">
        <!-- 宣纸 -->
        <div class="paper" class:open={unrolled}>
          <div class="edge top"></div>
          <div class="edge bottom"></div>
          <div class="texture"></div>

          <div class="paper-content" class:shown={unrolled}>
            <div class="beidou">{BEIDOU.join(" · ")}</div>
            <div class="gold-line"></div>
            <h1>紫微命盘</h1>
            <div class="kai sub">观 天 之 象 · 察 人 之 命</div>
            <div class="kai small">倪海厦《天纪》正宗体系</div>

            <div class="seal" class:stamped={unrolled}>
              <div><span>王</span><span>多</span></div>
              <div><span>鱼</span><span>印</span></div>
            </div>

            <div class="bagua">☰ ☱ ☲ ☳ ☴ ☵ ☶ ☷</div>
          </div>
        </div>

        <!-- 右卷轴杆（母轴，固定） -->
        <div class="rod right">
          <div class="cap top-cap"></div>
          <div class="cap bottom-cap"></div>
        </div>

        <!-- 左卷轴杆（被拉开） -->
        <div class="rod left" class:pulled={unrolled}>
          <div class="cap top-cap"></div>
          <div class="cap bottom-cap"></div>
        </div>
      </div>

      <button class="skip" onclick={skip}>跳 过 →</button>
    </div>
  {:else}
    <div class="replay-wrap">
      <button class="replay" onclick={replay}>↻ 重新播放卷轴</button>
    </div>
  {/if}
</main>

<style>
  .preview-page {
    min-height: 100vh;
    background: var(--bg-page);
  }
  .back {
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 20;
    padding: 6px 14px;
    border: 1px solid var(--t-border);
    border-radius: 8px;
    background: transparent;
    color: var(--t-text2);
    font-size: 12px;
    cursor: pointer;
  }
  .replay-wrap {
    min-height: 100vh;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 16px;
  }
  .replay {
    padding: 12px 28px;
    border-radius: 12px;
    border: 1px solid rgba(212, 168, 67, 0.4);
    background: rgba(212, 168, 67, 0.12);
    color: var(--t-gold);
    font-size: 13px;
    letter-spacing: 0.2em;
    cursor: pointer;
  }

  .overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: radial-gradient(ellipse at center, #1a120a 0%, #0a0604 70%, #000000 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    opacity: 1;
    transition: opacity 0.7s ease-in-out;
  }
  .overlay.fading {
    opacity: 0;
  }
  .stars-bg {
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(2px 2px at 20% 30%, rgba(255, 220, 150, 0.6), transparent),
      radial-gradient(1px 1px at 70% 20%, rgba(255, 220, 150, 0.4), transparent),
      radial-gradient(1px 1px at 35% 75%, rgba(255, 220, 150, 0.5), transparent),
      radial-gradient(1.5px 1.5px at 85% 65%, rgba(255, 220, 150, 0.4), transparent),
      radial-gradient(1px 1px at 60% 88%, rgba(255, 220, 150, 0.3), transparent),
      radial-gradient(2px 2px at 92% 40%, rgba(255, 220, 150, 0.5), transparent);
  }

  .scroll-area {
    position: relative;
    width: min(90vw, 1080px);
    height: min(60vh, 480px);
  }

  /* 宣纸：right 锚定右轴内侧，width 0 → calc(100% - 32px) */
  .paper {
    position: absolute;
    top: 8%;
    bottom: 8%;
    right: 16px;
    width: 0;
    opacity: 0.92;
    background:
      linear-gradient(180deg, rgba(120, 80, 30, 0.08) 0%, transparent 12%, transparent 88%, rgba(120, 80, 30, 0.08) 100%),
      linear-gradient(135deg, #efe1bf 0%, #e8d6ad 50%, #d6c08a 100%);
    box-shadow:
      inset 0 0 80px rgba(140, 90, 30, 0.18),
      inset 0 -2px 0 rgba(120, 80, 30, 0.15),
      0 8px 40px rgba(0, 0, 0, 0.7),
      0 16px 60px rgba(80, 40, 10, 0.4);
    overflow: hidden;
    transition: width 1.9s cubic-bezier(0.32, 0.72, 0.36, 1), opacity 1.9s ease;
  }
  .paper.open {
    width: calc(100% - 32px);
    opacity: 1;
  }
  .edge {
    position: absolute;
    left: 0;
    right: 0;
    height: 8px;
  }
  .edge.top {
    top: 0;
    background: linear-gradient(180deg, rgba(80, 50, 20, 0.35), transparent);
  }
  .edge.bottom {
    bottom: 0;
    background: linear-gradient(0deg, rgba(80, 50, 20, 0.35), transparent);
  }
  .texture {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(at 20% 30%, rgba(120, 80, 30, 0.06), transparent 50%),
      radial-gradient(at 80% 70%, rgba(120, 80, 30, 0.05), transparent 50%),
      radial-gradient(at 50% 50%, rgba(120, 80, 30, 0.04), transparent 60%);
    opacity: 0.7;
  }

  .paper-content {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 clamp(40px, 8vw, 120px);
    font-family: "Noto Serif CJK SC", "Songti SC", "SimSun", serif;
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.8s ease-out, transform 0.8s ease-out;
    white-space: nowrap;
  }
  .paper-content.shown {
    opacity: 1;
    transform: translateY(0);
  }
  .beidou {
    font-size: clamp(10px, 1.1vw, 12px);
    color: #8b5d18;
    letter-spacing: 0.45em;
    margin-bottom: clamp(20px, 3vh, 36px);
    opacity: 0.85;
  }
  .gold-line {
    width: 60px;
    height: 1px;
    background: linear-gradient(90deg, transparent, #a87a30, transparent);
    margin-bottom: clamp(16px, 2.5vh, 28px);
  }
  h1 {
    font-size: clamp(48px, 8vw, 110px);
    font-weight: 700;
    color: #1a1208;
    letter-spacing: clamp(0.18em, 0.25vw, 0.3em);
    line-height: 1.05;
    margin: 0;
    text-shadow: 0 1px 0 rgba(255, 250, 235, 0.3);
  }
  .kai {
    font-family: "Kaiti SC", "STKaiti", "Noto Serif CJK SC", serif;
  }
  .sub {
    font-size: clamp(13px, 1.5vw, 18px);
    color: #6b4818;
    letter-spacing: 0.4em;
    margin-top: clamp(16px, 2.5vh, 24px);
    margin-bottom: 6px;
  }
  .small {
    font-size: clamp(11px, 1.2vw, 14px);
    color: #8b6410;
    letter-spacing: 0.3em;
    opacity: 0.85;
  }
  .seal {
    margin-top: clamp(20px, 3vh, 32px);
    width: clamp(50px, 6vw, 64px);
    height: clamp(50px, 6vw, 64px);
    background: #a8302a;
    color: #f5ecd7;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    line-height: 1.05;
    font-size: clamp(11px, 1.2vw, 13px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3), inset 0 0 0 2px rgba(245, 236, 215, 0.15);
    opacity: 0;
    transform: scale(0.6) rotate(-15deg);
    transition: opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s,
      transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s;
  }
  .seal.stamped {
    opacity: 1;
    transform: scale(1) rotate(-4deg);
  }
  .bagua {
    margin-top: clamp(20px, 3vh, 32px);
    font-size: clamp(13px, 1.4vw, 16px);
    color: #a87a30;
    letter-spacing: 0.6em;
    opacity: 0.7;
  }

  /* 卷轴杆 */
  .rod {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 32px;
    background: linear-gradient(90deg, #4a2f0e 0%, #8b5d18 25%, #c89647 50%, #8b5d18 75%, #4a2f0e 100%);
    border-radius: 4px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.7), inset 0 0 12px rgba(0, 0, 0, 0.4);
    z-index: 2;
  }
  .rod.right {
    right: 0;
  }
  .rod.left {
    right: 0;
    z-index: 3;
    box-shadow: -2px 6px 24px rgba(0, 0, 0, 0.7), inset 0 0 12px rgba(0, 0, 0, 0.4);
    transition: right 1.9s cubic-bezier(0.32, 0.72, 0.36, 1);
  }
  .rod.left.pulled {
    right: calc(100% - 32px);
  }
  .cap {
    position: absolute;
    left: -6px;
    right: -6px;
    height: 20px;
    background: radial-gradient(ellipse at 30% 30%, #f0d090 0%, #c89647 35%, #6a4218 90%);
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }
  .cap.top-cap {
    top: -14px;
  }
  .cap.bottom-cap {
    bottom: -14px;
  }

  .skip {
    position: absolute;
    bottom: 32px;
    right: 32px;
    padding: 8px 18px;
    background: transparent;
    color: rgba(232, 220, 196, 0.55);
    border: 1px solid rgba(232, 220, 196, 0.18);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    letter-spacing: 0.25em;
    transition: border-color 0.2s, color 0.2s;
  }
  .skip:hover {
    border-color: rgba(232, 220, 196, 0.4);
    color: rgba(232, 220, 196, 0.9);
  }
</style>
