<script lang="ts">
  // 隐私政策（桌面版口径：无服务器、无账号，数据全部在本机）
</script>

<main class="page">
  <h1>隐私政策</h1>
  <p class="updated">更新日期：2026-10-27 · 本应用为本地桌面应用</p>

  <section>
    <h2>我们收集什么</h2>
    <p><strong>什么都不收集。</strong>本应用不内置任何统计、上报或遥测组件；没有用户账号体系，不需要注册登录。</p>
  </section>

  <section>
    <h2>数据存在哪里</h2>
    <p>全部数据仅保存在你自己的电脑上：</p>
    <ul>
      <li><strong>出生信息与命盘</strong>：仅在内存中计算与展示，不写入磁盘（除非你将来使用导出/历史功能）。</li>
      <li><strong>AI 提供商配置（含 API Key）</strong>：明文保存在本机应用配置目录 <code>ai-providers.json</code>。该文件不会同步、不会上传，前端界面只显示掩码（如 <code>sk-…abcd</code>）。</li>
    </ul>
  </section>

  <section>
    <h2>网络请求发往哪里</h2>
    <p>唯一会发出的网络请求是 <strong>AI 解读</strong>：应用把命盘结构化数据与你的问题发送给你自己在设置页配置的 AI 服务商端点（如 DeepSeek、OpenAI 或本地 Ollama）。除此之外应用不连接任何服务器。使用本地 Ollama 时，请求完全不出你的电脑。</p>
  </section>

  <section>
    <h2>你的控制权</h2>
    <ul>
      <li>随时可在设置页删除提供商配置（Key 一并删除）。</li>
      <li>卸载应用即删除全部本地数据（配置目录除外，可手动删除）。</li>
      <li>不想让命盘数据离开本机：配置并使用本地 Ollama 即可完全离线解读。</li>
    </ul>
  </section>
</main>

<style>
  .page {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 24px 96px;
  }
  h1 {
    color: var(--t-text);
    letter-spacing: 0.1em;
    margin: 0 0 6px;
  }
  .updated {
    font-size: 12px;
    color: var(--t-faint);
    margin: 0 0 36px;
  }
  h2 {
    font-size: 15px;
    color: var(--t-gold);
    letter-spacing: 0.1em;
    margin: 28px 0 10px;
  }
  p,
  li {
    font-size: 13px;
    line-height: 1.9;
    color: var(--t-text2);
  }
  ul {
    padding-left: 20px;
  }
  strong {
    color: var(--t-text);
  }
  code {
    background: var(--t-bg);
    border: 1px solid var(--t-border);
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 12px;
  }
</style>
