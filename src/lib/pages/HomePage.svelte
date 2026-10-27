<script lang="ts">
  // 首页 —— 移植自 Sample/app/page.tsx（D6 高保真：hero rAF 视差 + 区块滚动入场）。
  // FeatureVisual 装饰区简化为主星/四化数据面板（原版 160 行装饰画不做逐像素复刻）。
  import { heroParallax, reveal } from "@/lib/scroll-fx";
  import { theme } from "@/lib/stores/theme.svelte";

  const STARS = [
    "紫微", "天机", "太阳", "武曲", "天同", "廉贞", "天府",
    "太阴", "贪狼", "巨门", "天相", "天梁", "七杀", "破军",
  ];

  const SECTIONS = [
    { key: "ziwei", name: "紫微", desc: "14 主星 · 13 宫位 · AI 解读", ready: true, when: "5 月", icon: "◉", note: "" },
    { key: "tianji", name: "天纪", desc: "紫微 · 周易 · 奇门遁甲", ready: false, when: "6 月", icon: "⊙", note: "" },
    { key: "diji", name: "地纪", desc: "倪师未竟之业 · 后辈补注", ready: false, when: "6 月", icon: "⊞", note: "遗稿研读" },
    { key: "renji", name: "人纪", desc: "内经 · 伤寒 · 金匮 · 针灸", ready: false, when: "7 月", icon: "⊕", note: "" },
  ];

  const FEATURES = [
    {
      tag: "排盘体系",
      title: "倪海厦正宗\n紫微斗数",
      subtitle: "非简化版，严格遵循倪海厦老师传承",
      points: [
        "纳音五行局起盘，不采用网络简化算法",
        "命宫逆数生时、身宫顺数生时，严格对齐教学规则",
        "十四主星与四化飞星按原法推演，结构完整可复核",
      ],
      visual: "sihua" as const,
    },
    {
      tag: "命盘呈现",
      title: "完整十四主星\n四化飞星",
      subtitle: "结构清晰，一眼看懂主轴与重点",
      points: [
        "十四主星完整入宫，主星关系清楚可读",
        "辅星与煞星同屏呈现，避免关键信息缺失",
        "庙旺利陷亮度分级，快速识别强弱",
        "点击任意主星即可查看倪海厦老师对该星的详细解读",
      ],
      visual: "stars" as const,
    },
    {
      tag: "AI 解读",
      title: "深度解盘\n不止于算",
      subtitle: "倪海厦体系知识库 × 自定义 AI 提供商",
      points: [
        "命格分析：从命宫主星出发，结合三方四正，给出全面的性格与人生格局判断",
        "六大维度解读：事业方向、感情婚姻、财运模式、健康注意、家庭关系、子女缘分",
        "大限流年追踪：当前10年大限重点、今年流年宫位的具体提示与行动建议",
        "自由追问：针对你的命盘直接提问，「今年能换工作吗」「什么时候结婚运最好」",
      ],
      visual: "ai" as const,
    },
    {
      tag: "格局识别",
      title: "自动检测\n命盘格局",
      subtitle: "从星曜组合中发现你的命中注定",
      points: [
        "自动识别11种经典格局：紫府同宫、杀破狼格、机月同梁、廉相格、武曲七杀等",
        "辅弼夹命、日月夹命等特殊格局精准检测，并给出倪海厦体系下的标准解读",
        "四化入命宫迁移宫的特殊状况自动标注，提示需关注的人生议题",
        "格局按吉凶等级分层展示，让你一目了然自己命盘中的优势与挑战",
      ],
      visual: "patterns" as const,
    },
  ];

  const SIHUA_BRIEF: Record<string, { attr: string; brief: string }> = {
    化禄: { attr: "吉化·增益", brief: "福星到宫，主财运与福气增益。所在宫位事物顺遂，能力增强，是命盘中最受欢迎的化星。" },
    化权: { attr: "吉化·权威", brief: "权力星到宫，主掌控与领导力。所在宫位主强势与决断，喜入官禄宫与命宫，主事业上的实权。" },
    化科: { attr: "吉化·名誉", brief: "科名星到宫，主声誉与贵人缘。所在宫位主文名与考运，有贵人扶持，宜学术、考试与公开场合。" },
    化忌: { attr: "凶化·阻碍", brief: "劫数星到宫，主执念与阻碍。所在宫位需特别关注，该宫人生课题将成为重要考验。" },
  };

  const STAR_BRIEF: Record<string, { attr: string; brief: string }> = {
    紫微: { attr: "土·帝王星", brief: "天皇贵星，统御众星。坐命者有孤傲之气，主权威显达，天生具备领导气质，适合独当一面的领导岗位。" },
    天机: { attr: "木·智慧星", brief: "益寿星，主智谋与变动。聪慧机灵，善于筹谋，心思细腻，宜从事策划、顾问、技术类工作。" },
    太阳: { attr: "火·官禄主", brief: "官禄主星，主声誉与名望。慷慨大度，重视公众形象，利官场与公职，男命力强，入庙时光明磊落。" },
    武曲: { attr: "金·财帛主", brief: "财帛主星，主财务与决断。意志坚定，行动果敢，适合财务、金融、军警类职业，孤克之星，利晚婚。" },
  };

  const NI_TEACHINGS = [
    { title: "命宫为本，三方为用", body: "倪师始终强调，看命必先看命宫。命宫主星决定一个人的基本格局与天生性格，三方（财帛、官禄、迁移）则决定此人的「用武之地」。四宫联动才是完整的人生图景。" },
    { title: "对宫借星，不可忽视", body: "倪师的独到之处在于重视「对宫」。任何宫位若为空宫，必须借对宫星曜来论断，命宫的对面是迁移宫，两者互相影响，这是很多初学者容易忽略的关键。" },
    { title: "四化才是命运的手", body: "星曜只是基础，四化（化禄、化权、化科、化忌）才是决定运势好坏的关键。同一颗星，有化禄与有化忌，人生轨迹可以截然不同。倪师反复强调：不看四化，命盘只解了一半。" },
    { title: "大限十年，运势有节", body: "倪师将人生划分为12个大限，每个大限10年。他认为人在不同的大限宫位，际遇完全不同。了解自己现在走的是哪个大限、该宫位有何星曜，才能真正把握当下的运势。" },
  ];

  const PHILOSOPHY_LINES = [
    { text: "提前窥探命运的意义", size: "clamp(17px, 2.2vw, 28px)", delay: 0.1 },
    { text: "不在于预知未来", size: "clamp(21px, 2.6vw, 32px)", delay: 0.25 },
    { text: "而在于不断认识自己", size: "clamp(24px, 3vw, 40px)", delay: 0.34 },
  ];

  const TIANDIREN = [
    { glyph: "天", label: "先天命运", pct: "⅓", color: "var(--t-gold)", border: "rgba(212,168,67,0.3)", sub: "命盘 · 星曜 · 五行", desc: "紫微斗数所揭示的，是一个人的先天命盘格局——出生时间决定的星曜布局、五行局数、命宫主星。这只是命运的三分之一，是人生的底色，而非全貌。" },
    { glyph: "地", label: "地理环境", pct: "⅓", color: "rgba(96,165,250,0.9)", border: "rgba(96,165,250,0.3)", sub: "地域 · 风水 · 环境", desc: "你所在的地理环境、城市、国家、风水格局，乃至家庭背景与社会结构，共同构成了命运的第二个维度。同一命盘，生在不同地方，际遇可以天壤之别。" },
    { glyph: "人", label: "人心意念", pct: "⅓", color: "rgba(100,216,139,0.9)", border: "rgba(100,216,139,0.3)", sub: "意志 · 选择 · 行动", desc: "个人的意志、心态、选择与行动，才是改变命运最主动的力量。倪师强调：了解命盘是为了更好地做人，而不是坐等命运安排。精进自己，是最强的破局之道。" },
  ];

  let heroEl = $state<HTMLElement | null>(null);
  let heroY = $state(0);
  let heroOpacity = $state(1);

  $effect(() => {
    if (!heroEl) return;
    // D6 高保真：hero 视差 —— 滚出过程 translateY 0→28%、opacity 1→0（0.55 处到 0）
    return heroParallax(heroEl, (p) => {
      heroY = p * 28;
      heroOpacity = p < 0.55 ? 1 - (p / 0.55) : 0;
    });
  });

  function go(path: string) {
    window.location.hash = path;
  }
</script>

<div class="home">
  <!-- HERO（视差） -->
  <section class="hero" bind:this={heroEl}>
    <div
      class="hero-inner"
      style:transform={`translateY(${heroY}%)`}
      style:opacity={heroOpacity}
    >
      <div class="tag-row" use:reveal={{ delay: 0.1, y: 16 }}>
        <span class="h-line"></span>
        <span class="tag">紫微斗数 · 倪海厦体系</span>
        <span class="h-line"></span>
      </div>

      <h1 class="grad-text" use:reveal={{ delay: 0.2, y: 24 }}>紫微命盘</h1>

      <p class="slogan" use:reveal={{ delay: 0.45, y: 16 }}>紫微为门 · 天地人为路 · 倪海厦为师</p>
      <p class="slogan-sub" use:reveal={{ delay: 0.55, y: 0 }}>AI 答疑 · 知行合一</p>
      <p class="lead" use:reveal={{ delay: 0.65, y: 0 }}>
        输入出生年月日时，生成专属紫微斗数命盘 — 后续天纪、地纪、人纪学习模块陆续开放。
      </p>

      <div class="cta-row" use:reveal={{ delay: 0.85, y: 12 }}>
        <button class="cta" onclick={() => go("/chart")}>立即起盘</button>
      </div>

      <div class="stars-grid" use:reveal={{ delay: 1.05, y: 0 }}>
        {#each STARS as star, i}
          <div class="star-chip" style:animation-delay={`${1.05 + i * 0.03}s`}>{star}</div>
        {/each}
      </div>
    </div>

    <div class="sticky-note">
      🎁<br /><b>限时回馈</b><br />全部功能 + AI 提问 <strong>全免费</strong>
    </div>

    <div class="scroll-hint">
      <span>探索更多</span>
      <div class="hint-line"></div>
    </div>
  </section>

  <!-- 哲学引言 -->
  <section class="philosophy">
    <div class="bg-char">命</div>
    <div class="phil-inner" use:reveal={{ y: 20 }}>
      <div class="tag-row">
        <span class="h-line wide"></span>
        <span class="tag small">命 · 运 · 观</span>
        <span class="h-line wide"></span>
      </div>
      <div class="phil-lines">
        {#each PHILOSOPHY_LINES as line}
          <p class="phil-line" style:font-size={line.size} use:reveal={{ delay: line.delay, y: 16 }}>
            {line.text}
          </p>
        {/each}
        <p class="phil-final grad-text" use:reveal={{ delay: 0.45, y: 20 }}>最终书写属于自己的人生剧本</p>
      </div>
    </div>
  </section>

  <!-- 4 大学习板块时间轴 -->
  <section class="curriculum">
    <div class="section-head" use:reveal>
      <div class="tag-row">
        <span class="h-line"></span><span class="tag small">Curriculum</span><span class="h-line"></span>
      </div>
      <h2>倪师方法论 · 渐次展开</h2>
      <p class="muted">从紫微入门，逐步开放天纪 / 地纪 / 人纪学习模块</p>
    </div>

    <div class="timeline">
      <div class="connector desktop"></div>
      <div class="connector mobile"></div>
      {#each SECTIONS as s, i}
        <div class="tl-item" use:reveal={{ delay: i * 0.15, y: 20 }}>
          <div class="node" class:ready={s.ready}>
            <span class="node-icon">{s.icon}</span>
            {#if s.ready}<div class="check">✓</div>{/if}
          </div>
          <div class="tl-text">
            <div class="tl-top">
              <span class="when" class:ok={s.ready}>{s.when}</span>
              <span class="tl-name">{s.name}</span>
              {#if s.note}<span class="note">{s.note}</span>{/if}
            </div>
            <div class="tl-desc">{s.desc}</div>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- 功能详解 -->
  <section class="features">
    {#each FEATURES as feature, i}
      <div class="feature" class:alt={i % 2 === 1}>
        <div class="feature-grid" class:flip={i % 2 === 1}>
          <div class="f-text">
            <div class="f-tag" use:reveal={{ y: 12 }}><span class="h-line"></span>{feature.tag}</div>
            <h2 class="f-title grad-text" use:reveal={{ delay: 0.1, y: 20 }}>{feature.title}</h2>
            <p class="f-sub" use:reveal={{ delay: 0.2, y: 16 }}>{feature.subtitle}</p>
            <ul class="f-points">
              {#each feature.points as point, j}
                <li use:reveal={{ delay: 0.25 + j * 0.08, y: 12 }}>{point}</li>
              {/each}
            </ul>
          </div>
          <div class="f-visual-wrap" use:reveal={{ delay: 0.15, y: 20 }}>
            <div class="f-visual">
              {#if feature.visual === "sihua"}
                {#each Object.entries(SIHUA_BRIEF) as [name, v]}
                  <div class="v-row"><span class="v-name" class:ji={name === "化忌"}>{name}</span><span class="v-attr">{v.attr}</span><p class="v-brief">{v.brief}</p></div>
                {/each}
              {:else if feature.visual === "stars"}
                {#each Object.entries(STAR_BRIEF) as [name, v]}
                  <div class="v-row"><span class="v-name">{name}</span><span class="v-attr">{v.attr}</span><p class="v-brief">{v.brief}</p></div>
                {/each}
                <div class="v-more">…点击盘面任意主星查看倪师详解</div>
              {:else if feature.visual === "ai"}
                <div class="ai-visual">
                  <div class="ai-line user">我的感情运势如何？</div>
                  <div class="ai-line bot">按夫妻宫主星与三方四正……<span class="cursor"></span></div>
                  <div class="ai-line bot dim">六大维度 · 大限流年 · 自由追问</div>
                </div>
              {:else}
                <div class="ai-visual">
                  {#each ["紫府同宫", "杀破狼格", "机月同梁", "日月夹命"] as p, j}
                    <div class="p-row" style:animation-delay={`${j * 0.12}s`}>
                      <span class="p-dot" class:good={j < 2}></span>{p}
                    </div>
                  {/each}
                  <div class="v-more">11 种经典格局自动检测</div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/each}
  </section>

  <!-- 天·地·人 -->
  <section class="tdr">
    <div class="section-head" use:reveal>
      <div class="tag-row">
        <span class="h-line"></span><span class="tag small">Ni Haixia · Philosophy</span><span class="h-line"></span>
      </div>
      <h2 class="grad-text">天 · 地 · 人</h2>
      <p class="muted">
        倪海厦老师的核心命运观：命运从来不是人生的全部。<br />
        他将影响人生的力量分为三个同等重要的维度。
      </p>
    </div>
    <div class="tdr-grid">
      {#each TIANDIREN as item, i}
        <div class="tdr-card" style:border-color={item.border} use:reveal={{ delay: 0.1 + i * 0.12, y: 20 }}>
          <div class="tdr-head">
            <div class="glyph" style:color={item.color}>{item.glyph}</div>
            <div class="pct" style:color={item.color}>{item.pct}<span class="of">of life</span></div>
          </div>
          <div class="tdr-label" style:color={item.color}>{item.label}</div>
          <div class="tdr-sub">{item.sub}</div>
          <div class="divider" style:background={item.border}></div>
          <p class="tdr-desc">{item.desc}</p>
        </div>
      {/each}
    </div>
    <div class="quote" use:reveal={{ delay: 0.3 }}>
      <p>「命运不是人生的全部，加上地理位置和人念，才是。」</p>
      <p class="quote-by">— 倪海厦</p>
    </div>
  </section>

  <!-- 倪海厦介绍 -->
  <section class="master">
    <div class="section-head" use:reveal>
      <div class="tag-row">
        <span class="h-line"></span><span class="tag small">Master · 1953 – 2012</span><span class="h-line"></span>
      </div>
      <h2 class="grad-text">倪海厦老师</h2>
      <p class="muted">
        当代华人圈最具影响力的中医与术数大家之一<br />
        美国汉唐中医学院创办人 ·「人纪」「天纪」两大教学体系传世
      </p>
    </div>

    <div class="master-card" use:reveal={{ delay: 0.1 }}>
      <div class="master-stats">
        <div><div class="ms-label">生于</div><div class="ms-value">1954年</div><div class="ms-sub">台湾</div></div>
        <div><div class="ms-label">离世</div><div class="ms-value">2012年</div><div class="ms-sub">1月31日 · 享年58</div></div>
        <div><div class="ms-label">传承</div><div class="ms-value">紫微斗数</div><div class="ms-sub">经方中医 · 易经</div></div>
      </div>
      <div class="master-body">
        <p><strong>生平履历</strong>：倪海厦先生（1954–2012）出生于台湾，早年师承多位中医名家，专研经方派（《伤寒论》传承）。中年赴美行医，在美国创立<strong>汉唐中医学院</strong>，二十余年间系统传授中医与传统术数。2012 年 1 月 31 日因肝癌在台湾离世，享年 58 岁。</p>
        <p><strong>教学体系</strong>：倪师将毕生所学整理为两大公开教学系列。<strong>「人纪」</strong>涵盖《针灸大成》《神农本草经》《黄帝内经》《伤寒论》《金匮要略》——这是「人之纪」，奠定中医学习的完整路径；<strong>「天纪」</strong>涵盖紫微斗数与《易经》——这是「天之纪」，是术数研究的体系化成果。两者相合，是倪师留给后世最完整的传承。</p>
        <p><strong>紫微立场</strong>：倪师在紫微斗数上明确属<strong>南派三合派</strong>，主张「以命宫为本、以三方四正为用、以四化为纲」。他在《天纪》课程中明言：「<em>飞星（四化）飞来飞去太复杂，不搞这个，毕竟大道至简</em>」——这一立场将其与繁琐的飞星派清晰区分。</p>
        <p><strong>治学态度</strong>：倪师反对死记硬背口诀，强调「理解原理胜过背诵」「逻辑可复核胜过神秘玄学」。这种态度让紫微斗数从师徒密传的封闭体系，走向系统化、可验证、可学习的现代知识体系。</p>
        <p><strong>当代影响</strong>：倪师的讲课视频在 B 站、YouTube 与各大平台广泛流传，是新一代命理与中医爱好者公认的入门必修。他不仅是紫微斗数的传承者，更是把传统命理与中医带入现代知识体系的关键人物之一。</p>
        <p class="disclaimer">本平台所有解读基于倪师《天纪》公开教学讲义、《紫微斗数全书》明版、传统三合派古籍整理而成，仅作文化与个人成长参考。倪师本人与本平台无任何商业关联。</p>
      </div>
    </div>

    <div class="teachings">
      {#each NI_TEACHINGS as t, i}
        <div class="teaching" use:reveal={{ delay: 0.1 + i * 0.08, y: 16 }}>
          <h3><span class="t-num">{i + 1}</span>{t.title}</h3>
          <p>{t.body}</p>
        </div>
      {/each}
    </div>
  </section>

  <!-- 合盘入口 -->
  <section class="heming-cta">
    <div class="heming-box" use:reveal>
      <div class="tag-row">
        <span class="h-line"></span><span class="tag small">Compatibility · Analysis</span><span class="h-line"></span>
      </div>
      <h2 class="grad-text">紫微合盘</h2>
      <p class="muted">
        输入两个人的出生信息，AI 基于倪海厦体系分析夫妻宫互参、命宫兼容性与三方四正交互，<br class="desktop-br" />
        给出感情匹配度、合伙可行性与最佳相处建议。
      </p>
      <div class="chips">
        {#each ["感情匹配度分析", "合伙创业评估", "亲子缘分解读", "婚前相性评估"] as item}
          <span class="chip">{item}</span>
        {/each}
      </div>
      <button class="cta ghost" onclick={() => go("/heming")}>开始合盘分析</button>
    </div>
  </section>

  <!-- 最终 CTA -->
  <section class="final">
    <div use:reveal>
      <p class="final-tag">开始你的命盘之旅</p>
      <h2 class="grad-text final-title">你的紫微命盘<br />等你解读</h2>
      <p class="muted">
        输入出生年月日时，在几秒内生成你的专属命盘<br />
        再由 AI 按倪海厦体系为你深度解读
      </p>
      <button class="cta" onclick={() => go("/chart")}>免费起盘</button>
      <div class="final-links">
        <a href="#/knowledge">✦ 紫微斗数知识库 →</a>
        <a href="#/library">📜 古籍原典库 →</a>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer>
    <div class="foot-grid">
      <div class="foot-title">倪师方法论 · 学术体系</div>
      <div class="foot-cells">
        {#each SECTIONS as s}
          {#if s.ready}
            <a class="cell ready" href="#/chart">
              <div class="cell-name">{s.name}</div>
              <div class="cell-status ok">✓ 已上线</div>
            </a>
          {:else}
            <div class="cell">
              <div class="cell-name">{s.name}</div>
              <div class="cell-status">{s.when} 开放</div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
    <div class="foot-center">
      <p>紫微命盘 · 基于倪海厦正宗体系 · 仅供参考，命运掌握在自己手中</p>
      <p>本平台基于中国传统文化研究，仅提供学习参考。不构成任何医疗、投资、法律或重大决策建议。</p>
      <p class="links"><a href="#/terms">服务条款</a> · <a href="#/privacy">隐私政策</a></p>
    </div>
  </footer>
</div>

<style>
  .home {
    background: var(--bg-page);
    overflow-x: hidden;
    transition: background 0.35s ease;
  }
  h1, h2 {
    margin: 0;
  }
  .grad-text {
    background: linear-gradient(160deg, #c8993a 0%, #f0d070 40%, #c8993a 70%, #f0c755 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  :global([data-theme="light"]) .grad-text {
    background: linear-gradient(160deg, #6a4206 0%, #9a6a10 40%, #6a4206 70%, #885010 100%);
    -webkit-background-clip: text;
    background-clip: text;
  }
  .tag-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 28px;
  }
  .h-line {
    height: 1px;
    width: 48px;
  }
  .h-line:first-child {
    background: linear-gradient(to right, transparent, rgba(212, 168, 67, 0.45));
  }
  .h-line:last-child {
    background: linear-gradient(to left, transparent, rgba(212, 168, 67, 0.45));
  }
  .h-line.wide {
    width: 64px;
  }
  .tag {
    font-size: 11px;
    letter-spacing: 0.45em;
    color: rgba(212, 168, 67, 0.6);
  }
  .tag.small {
    font-size: 10px;
    letter-spacing: 0.5em;
    text-transform: uppercase;
  }
  .muted {
    font-size: 13px;
    line-height: 1.8;
    color: var(--tx-1);
  }
  .section-head {
    text-align: center;
    margin-bottom: 48px;
  }
  .section-head h2 {
    font-size: clamp(24px, 3.5vw, 40px);
    font-weight: 700;
    letter-spacing: 0.15em;
    color: var(--t-text);
    margin-bottom: 10px;
  }

  /* HERO */
  .hero {
    position: relative;
    min-height: 92vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 24px 96px;
    z-index: 10;
  }
  .hero-inner {
    max-width: 960px;
    width: 100%;
    text-align: center;
    margin-top: 40px;
    will-change: transform, opacity;
  }
  .hero-inner h1 {
    font-size: clamp(56px, 10vw, 124px);
    font-weight: 700;
    letter-spacing: 0.07em;
    line-height: 1;
    margin-bottom: 20px;
  }
  .slogan {
    font-size: 17px;
    letter-spacing: 0.18em;
    font-weight: 500;
    color: var(--t-text2);
    margin: 0 0 8px;
  }
  .slogan-sub {
    font-size: 13px;
    letter-spacing: 0.3em;
    color: var(--t-faint);
    opacity: 0.85;
    margin: 0 0 24px;
  }
  .lead {
    font-size: 14px;
    max-width: 576px;
    margin: 0 auto 40px;
    line-height: 1.7;
    color: var(--t-faint);
  }
  .cta-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .cta {
    padding: 16px 48px;
    font-weight: 600;
    font-size: 16px;
    letter-spacing: 0.2em;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    background: linear-gradient(135deg, #b8892a, #f0d070, #b8892a);
    color: #08080a;
    transition: transform 0.15s, filter 0.15s;
  }
  .cta:hover {
    transform: translateY(-2px);
    filter: brightness(1.06);
  }
  .cta:active {
    transform: scale(0.97);
  }
  .cta.ghost {
    padding: 12px 40px;
    font-size: 14px;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(212, 168, 67, 0.4);
    color: var(--t-gold);
  }
  .stars-grid {
    margin-top: 48px;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
    max-width: 540px;
    margin-inline: auto;
  }
  .star-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(212, 168, 67, 0.22);
    color: rgba(212, 168, 67, 0.7);
    font-size: 11px;
    letter-spacing: 0.05em;
    animation: chip-in 0.35s ease both;
  }
  @keyframes chip-in {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  .sticky-note {
    position: absolute;
    right: clamp(2%, 6vw, 8%);
    top: 54%;
    max-width: 240px;
    pointer-events: none;
    background: linear-gradient(135deg, #fff5e3 0%, #ffe1c0 100%);
    border: 2px dashed rgba(232, 132, 62, 0.45);
    border-radius: 16px;
    padding: 14px 18px;
    box-shadow: 0 8px 24px rgba(196, 90, 45, 0.18);
    font-size: 13px;
    line-height: 1.7;
    color: #8b3a1a;
    transform: rotate(-4deg);
    animation: note-in 0.7s 1.4s cubic-bezier(0.25, 0.1, 0.25, 1) both;
  }
  .sticky-note b {
    color: #c45a2d;
  }
  .sticky-note strong {
    color: #c45a2d;
  }
  @keyframes note-in {
    from { opacity: 0; transform: translateX(30px) rotate(0deg); }
    to { opacity: 1; transform: translateX(0) rotate(-4deg); }
  }
  @media (max-width: 1024px) {
    .sticky-note {
      display: none;
    }
  }
  .scroll-hint {
    position: absolute;
    bottom: 24px;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
    animation: fade-in 1s 2s ease both;
  }
  .scroll-hint span {
    font-size: 9px;
    letter-spacing: 0.4em;
    text-transform: uppercase;
    color: var(--t-faint);
    opacity: 0.6;
  }
  .hint-line {
    width: 1px;
    height: 32px;
    background: linear-gradient(to bottom, rgba(212, 168, 67, 0.3), transparent);
    animation: bob 2s ease-in-out infinite;
  }
  @keyframes bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(6px); }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* 哲学引言 */
  .philosophy {
    position: relative;
    overflow: hidden;
    min-height: 92vh;
    display: flex;
    align-items: center;
    padding: 72px 24px;
    z-index: 10;
    background: linear-gradient(to bottom, #020810 0%, #030a18 22%, #0d0820 40%, #0a0618 68%, #030a18 86%, #020810 100%);
  }
  :global([data-theme="light"]) .philosophy {
    background: linear-gradient(to bottom, #f5efe0 0%, #c08055 18%, #6a2810 32%, #1e0a02 50%, #1e0a02 70%, #6a2810 84%, #f5efe0 100%);
  }
  .bg-char {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: clamp(220px, 38vw, 460px);
    color: rgba(212, 168, 67, 0.012);
    line-height: 1;
    font-family: serif;
    pointer-events: none;
    user-select: none;
  }
  .phil-inner {
    position: relative;
    width: 100%;
    max-width: 840px;
    margin: 0 auto;
    text-align: center;
  }
  .phil-lines {
    display: grid;
    gap: 12px;
  }
  .phil-line {
    letter-spacing: 0.08em;
    color: rgba(215, 228, 252, 0.75);
    margin: 0;
    font-weight: 400;
  }
  :global([data-theme="light"]) .phil-line {
    color: rgba(250, 240, 220, 0.9);
  }
  .phil-final {
    font-size: clamp(24px, 3.4vw, 48px);
    font-weight: 700;
    letter-spacing: 0.05em;
    line-height: 1.35;
    margin: 0;
  }

  /* 时间轴 */
  .curriculum {
    position: relative;
    z-index: 10;
    padding: 80px 24px;
    background: linear-gradient(to bottom, transparent 0%, rgba(212, 168, 67, 0.03) 50%, transparent 100%);
  }
  .timeline {
    position: relative;
    max-width: 1080px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .connector {
    position: absolute;
    opacity: 0.6;
  }
  .connector.desktop {
    display: block;
    top: 28px;
    left: 12.5%;
    right: 12.5%;
    height: 2px;
    background: linear-gradient(90deg, #d4a843 0%, #d4a843 25%, rgba(212, 168, 67, 0.4) 25%);
  }
  .connector.mobile {
    display: none;
  }
  .tl-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0;
  }
  .node {
    position: relative;
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
    background: rgba(212, 168, 67, 0.05);
    border: 2px dashed rgba(212, 168, 67, 0.4);
    color: var(--t-faint);
    font-size: 24px;
  }
  .node.ready {
    background: linear-gradient(135deg, #d4a843 0%, rgba(212, 168, 67, 0.8) 100%);
    border: none;
    color: #fff;
    box-shadow: 0 4px 16px rgba(212, 168, 67, 0.33);
  }
  .check {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #fff;
    background: #10b981;
    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
  }
  .tl-top {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-bottom: 4px;
  }
  .when {
    font-size: 10px;
    letter-spacing: 0.25em;
    color: var(--t-faint);
    font-weight: 500;
  }
  .when.ok {
    color: #10b981;
  }
  .tl-name {
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.15em;
    color: var(--t-text);
  }
  .note {
    font-size: 9px;
    letter-spacing: 0.15em;
    padding: 2px 8px;
    border-radius: 999px;
    color: var(--t-gold);
    background: rgba(212, 168, 67, 0.1);
    border: 1px solid rgba(212, 168, 67, 0.4);
    opacity: 0.85;
  }
  .tl-desc {
    font-size: 12px;
    line-height: 1.7;
    color: var(--t-text2);
    max-width: 200px;
  }

  /* 功能详解 */
  .features {
    position: relative;
    z-index: 10;
  }
  .feature {
    display: flex;
    align-items: center;
    padding: 88px 40px;
    min-height: 92vh;
  }
  .feature.alt {
    background: rgba(255, 255, 255, 0.02);
  }
  :global([data-theme="light"]) .feature.alt {
    background: rgba(255, 255, 255, 0.4);
  }
  .feature-grid {
    display: grid;
    grid-template-columns: 0.45fr 0.55fr;
    gap: 64px;
    max-width: 1280px;
    margin: 0 auto;
    width: 100%;
    align-items: start;
  }
  .feature-grid.flip {
    grid-template-columns: 0.55fr 0.45fr;
  }
  .feature-grid.flip .f-text {
    order: 2;
  }
  .feature-grid.flip .f-visual-wrap {
    order: 1;
  }
  .f-tag {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 10px;
    letter-spacing: 0.5em;
    text-transform: uppercase;
    color: rgba(212, 168, 67, 0.6);
    margin-bottom: 24px;
  }
  .f-tag .h-line {
    width: 32px;
    background: rgba(212, 168, 67, 0.4);
  }
  .f-title {
    font-size: clamp(36px, 4vw, 56px);
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.01em;
    white-space: pre-line;
    margin-bottom: 20px;
  }
  .f-sub {
    font-size: 16px;
    margin-bottom: 32px;
    line-height: 1.7;
    color: var(--t-text2);
  }
  .f-points {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 16px;
  }
  .f-points li {
    display: flex;
    gap: 12px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--t-faint);
  }
  .f-points li::before {
    content: "";
    flex-shrink: 0;
    margin-top: 8px;
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: var(--t-gold);
    opacity: 0.6;
  }
  .f-visual-wrap {
    min-width: 0;
  }
  .f-visual {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    padding: 40px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    min-height: 440px;
    box-shadow: 0 4px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 16px;
  }
  :global([data-theme="light"]) .f-visual {
    border-color: rgba(200, 160, 60, 0.2);
    background: rgba(255, 255, 255, 0.75);
    box-shadow: 0 4px 24px rgba(140, 100, 20, 0.12);
  }
  .v-row {
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 4px 12px;
    align-items: baseline;
  }
  .v-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--t-gold);
  }
  .v-name.ji {
    color: var(--ji);
  }
  .v-attr {
    font-size: 10px;
    color: var(--t-faint);
    letter-spacing: 0.1em;
  }
  .v-brief {
    grid-column: 1 / -1;
    font-size: 12px;
    line-height: 1.7;
    color: var(--t-text2);
    margin: 0;
  }
  .v-more {
    font-size: 10px;
    color: var(--t-faint);
    letter-spacing: 0.15em;
    text-align: center;
    opacity: 0.7;
  }
  .ai-visual {
    display: grid;
    gap: 12px;
  }
  .ai-line {
    font-size: 12px;
    padding: 10px 14px;
    border-radius: 12px;
    line-height: 1.6;
  }
  .ai-line.user {
    justify-self: end;
    max-width: 70%;
    background: rgba(212, 168, 67, 0.1);
    border: 1px solid rgba(212, 168, 67, 0.2);
    color: var(--t-gold);
  }
  .ai-line.bot {
    justify-self: start;
    max-width: 85%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--t-text2);
  }
  .ai-line.bot.dim {
    border-style: dashed;
    opacity: 0.7;
  }
  .cursor {
    display: inline-block;
    width: 5px;
    height: 12px;
    margin-left: 3px;
    vertical-align: middle;
    background: var(--t-gold);
    opacity: 0.6;
    animation: blink 0.9s step-end infinite;
  }
  @keyframes blink {
    50% { opacity: 0.1; }
  }
  .p-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--t-text2);
    letter-spacing: 0.1em;
    animation: chip-in 0.4s ease both;
  }
  .p-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: rgba(248, 113, 113, 0.5);
  }
  .p-dot.good {
    background: rgba(74, 222, 128, 0.6);
  }
  @media (max-width: 1024px) {
    .feature-grid,
    .feature-grid.flip {
      grid-template-columns: 1fr;
      gap: 32px;
    }
    .feature-grid.flip .f-text {
      order: 1;
    }
    .feature-grid.flip .f-visual-wrap {
      order: 2;
    }
    .feature {
      padding: 64px 24px;
      min-height: 0;
    }
    .timeline {
      grid-template-columns: 1fr;
      gap: 20px;
      padding-left: 28px;
    }
    .connector.desktop {
      display: none;
    }
    .connector.mobile {
      display: block;
      left: 28px;
      top: 28px;
      bottom: 28px;
      width: 1px;
      background: linear-gradient(180deg, #d4a843 0%, #d4a843 22%, rgba(212, 168, 67, 0.4) 22%);
    }
    .tl-item {
      flex-direction: row;
      text-align: left;
      gap: 16px;
    }
    .tl-top {
      flex-direction: row;
      align-items: baseline;
      gap: 8px;
    }
  }

  /* 天地人 */
  .tdr {
    position: relative;
    z-index: 10;
    padding: 80px 40px;
    background: rgba(255, 255, 255, 0.02);
    min-height: 82vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  :global([data-theme="light"]) .tdr {
    background: rgba(255, 255, 255, 0.4);
  }
  .tdr-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    max-width: 1280px;
    margin: 0 auto;
  }
  .tdr-card {
    border-radius: 16px;
    padding: 28px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid;
    box-shadow: 0 4px 32px rgba(0, 0, 0, 0.5);
    transition: transform 0.15s;
  }
  .tdr-card:hover {
    transform: translateY(-4px);
  }
  :global([data-theme="light"]) .tdr-card {
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 4px 24px rgba(140, 100, 20, 0.12);
  }
  .tdr-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
  }
  .glyph {
    font-size: 48px;
    font-weight: 700;
    line-height: 1;
  }
  .pct {
    font-size: 24px;
    font-weight: 700;
    text-align: right;
  }
  .of {
    display: block;
    font-size: 9px;
    letter-spacing: 0.15em;
    color: var(--t-faint);
    margin-top: 2px;
  }
  .tdr-label {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 2px;
  }
  .tdr-sub {
    font-size: 10px;
    letter-spacing: 0.1em;
    color: var(--t-faint);
  }
  .divider {
    height: 1px;
    margin: 16px 0;
  }
  .tdr-desc {
    font-size: 12px;
    line-height: 1.8;
    color: var(--t-text2);
    margin: 0;
  }
  .quote {
    margin-top: 40px;
    text-align: center;
  }
  .quote p {
    font-size: 14px;
    line-height: 1.8;
    color: var(--t-text2);
    margin: 0 0 8px;
  }
  .quote-by {
    font-size: 10px !important;
    letter-spacing: 0.2em;
    color: rgba(212, 168, 67, 0.6) !important;
  }
  @media (max-width: 900px) {
    .tdr-grid {
      grid-template-columns: 1fr;
    }
    .tdr {
      padding: 64px 24px;
    }
  }

  /* 倪海厦介绍 */
  .master {
    position: relative;
    z-index: 10;
    padding: 80px 40px;
  }
  .master-card {
    border-radius: 16px;
    padding: 40px;
    max-width: 1280px;
    margin: 0 auto 32px;
    border: 1px solid rgba(212, 168, 67, 0.2);
    background: rgba(255, 255, 255, 0.04);
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.4);
  }
  :global([data-theme="light"]) .master-card {
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 2px 16px rgba(140, 100, 20, 0.1);
    border-color: rgba(180, 130, 40, 0.25);
  }
  .master-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 32px;
  }
  .master-stats > div {
    text-align: center;
    border-radius: 12px;
    padding: 12px 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }
  :global([data-theme="light"]) .master-stats > div {
    border-color: rgba(180, 130, 40, 0.12);
  }
  .ms-label {
    font-size: 10px;
    letter-spacing: 0.3em;
    color: var(--t-faint);
    margin-bottom: 4px;
  }
  .ms-value {
    font-size: 24px;
    font-weight: 600;
    color: var(--t-gold);
    margin-bottom: 2px;
  }
  .ms-sub {
    font-size: 11px;
    color: var(--t-faint);
  }
  .master-body {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 32px;
    max-width: 768px;
    margin: 0 auto;
  }
  :global([data-theme="light"]) .master-body {
    border-top-color: rgba(180, 130, 40, 0.12);
  }
  .master-body p {
    font-size: 14px;
    line-height: 1.9;
    color: var(--t-text2);
    margin: 0 0 16px;
  }
  .master-body strong {
    color: var(--t-gold);
  }
  .disclaimer {
    font-size: 11px !important;
    font-style: italic;
    color: var(--t-faint) !important;
  }
  .teachings {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    max-width: 1280px;
    margin: 0 auto;
  }
  .teaching {
    border-radius: 12px;
    padding: 24px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    transition: transform 0.15s;
  }
  .teaching:hover {
    transform: translateY(-3px);
  }
  :global([data-theme="light"]) .teaching {
    border-color: rgba(200, 160, 60, 0.2);
    background: rgba(255, 255, 255, 0.9);
  }
  .teaching h3 {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 14px;
    font-weight: 500;
    color: var(--t-gold);
    margin: 0 0 12px;
    line-height: 1.6;
  }
  .t-num {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    border: 1px solid rgba(212, 168, 67, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    margin-top: 2px;
  }
  .teaching p {
    font-size: 12px;
    line-height: 1.8;
    color: var(--t-text2);
    margin: 0;
    padding-left: 32px;
  }
  @media (max-width: 900px) {
    .teachings,
    .master-stats {
      grid-template-columns: 1fr;
    }
    .master {
      padding: 64px 24px;
    }
  }

  /* 合盘入口 */
  .heming-cta {
    position: relative;
    z-index: 10;
    padding: 80px 40px;
    max-width: 1280px;
    margin: 0 auto;
  }
  .heming-box {
    border-radius: 16px;
    padding: 56px 40px;
    text-align: center;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 32px rgba(0, 0, 0, 0.5);
  }
  :global([data-theme="light"]) .heming-box {
    background: rgba(255, 255, 255, 0.8);
    border-color: rgba(200, 160, 60, 0.25);
    box-shadow: 0 4px 24px rgba(140, 100, 20, 0.12);
  }
  .heming-box h2 {
    font-size: clamp(26px, 3.5vw, 40px);
    font-weight: 700;
    letter-spacing: -0.01em;
    margin-bottom: 16px;
  }
  .heming-box .muted {
    max-width: 512px;
    margin: 0 auto 32px;
  }
  .chips {
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 24px;
  }
  .chip {
    font-size: 12px;
    padding: 5px 14px;
    border-radius: 20px;
    background: rgba(212, 168, 67, 0.08);
    border: 1px solid rgba(212, 168, 67, 0.4);
    color: var(--t-gold);
  }

  /* 最终 CTA */
  .final {
    position: relative;
    z-index: 10;
    padding: 160px 24px;
    text-align: center;
    background: rgba(255, 255, 255, 0.02);
  }
  :global([data-theme="light"]) .final {
    background: rgba(255, 255, 255, 0.4);
  }
  .final-tag {
    font-size: 10px;
    letter-spacing: 0.6em;
    text-transform: uppercase;
    color: rgba(212, 168, 67, 0.6);
    margin-bottom: 24px;
  }
  .final-title {
    font-size: clamp(32px, 5vw, 60px);
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.2;
    margin-bottom: 32px;
  }
  .final .muted {
    max-width: 448px;
    margin: 0 auto 40px;
  }
  .final-links {
    margin-top: 16px;
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .final-links a {
    font-size: 12px;
    letter-spacing: 0.2em;
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid rgba(212, 168, 67, 0.4);
    color: var(--t-gold);
    text-decoration: none;
    transition: transform 0.15s;
  }
  .final-links a:hover {
    transform: scale(1.02);
  }

  /* Footer */
  footer {
    position: relative;
    z-index: 10;
    padding: 40px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  :global([data-theme="light"]) footer {
    border-top-color: rgba(200, 160, 60, 0.2);
  }
  .foot-grid {
    max-width: 896px;
    margin: 0 auto 32px;
  }
  .foot-title {
    font-size: 9px;
    letter-spacing: 0.3em;
    text-align: center;
    text-transform: uppercase;
    color: var(--t-faint);
    opacity: 0.6;
    margin-bottom: 16px;
  }
  .foot-cells {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .cell {
    border-radius: 8px;
    padding: 12px;
    text-align: center;
    text-decoration: none;
    border: 1px dashed rgba(255, 255, 255, 0.05);
    opacity: 0.5;
    cursor: not-allowed;
  }
  .cell.ready {
    border: 1px solid rgba(212, 168, 67, 0.4);
    background: rgba(255, 255, 255, 0.04);
    opacity: 1;
    cursor: pointer;
  }
  .cell-name {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--t-faint);
    margin-bottom: 2px;
  }
  .cell.ready .cell-name {
    color: var(--t-gold);
  }
  .cell-status {
    font-size: 9px;
    letter-spacing: 0.08em;
    color: var(--t-faint);
  }
  .cell-status.ok {
    color: #10b981;
  }
  .foot-center {
    text-align: center;
  }
  .foot-center p {
    font-size: 10px;
    letter-spacing: 0.05em;
    color: var(--t-faint);
    opacity: 0.8;
    margin: 0 0 12px;
    line-height: 1.8;
  }
  .foot-center .links a {
    color: var(--t-faint);
    text-decoration: underline;
  }
  @media (max-width: 640px) {
    .foot-cells {
      grid-template-columns: repeat(2, 1fr);
    }
    .desktop-br {
      display: none;
    }
  }
</style>
