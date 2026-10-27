# 紫微斗数 · 桌面应用（Rust + Tauri 2 + Svelte 5）

基于 [ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu) 开源排盘引擎（iztro 2.5.8 + lunar-javascript 1.7.3，MIT）的本地桌面版：
排盘、合盘、命理百科、古籍原典库全部本地运行；**AI 解读由 Rust 核心对接你自己配置的
OpenAI 兼容提供商**（DeepSeek / OpenAI / Kimi / 通义 / 智谱 预置一键添加，或本地 Ollama 离线）。

## 开发

```bash
npm install
npm run tauri dev      # 开发模式（窗口 + 热更新）
npm test               # 排盘引擎回归（9 套，与 Sample CI 完全一致）
cargo test --manifest-path src-tauri/Cargo.toml   # Rust 核心单测（32 条）
npm run tauri build    # 出包
```

## 目录结构（Tauri 官方模板）

```
rust/
├── src/                # Svelte 5 前端
│   ├── lib/engine/     # Sample/lib/ziwei 原样移植（仅去 server-only / 抽 BirthFormState 类型）
│   ├── lib/classics/   # 古籍数据（原样移植）
│   ├── lib/pages/      # 排盘 / 合盘 / 百科 / 古籍 / 首页 / 预览 / 设置 / 隐私 / 条款
│   ├── lib/components/ # BirthForm ChartBoard PalaceCell TimeNav InsightPanel 等
│   ├── lib/services/   # Tauri 命令封装 + AI 流式客户端
│   └── App.svelte      # hash 路由壳
├── src-tauri/          # Rust 核心
│   └── src/
│       ├── ai/         # provider / presets / client(SSE 流式) / sse / prompt / chart_text
│       ├── commands.rs # ai_chat / ai_cancel / provider_* / presets_list
│       ├── store.rs    # tauri-plugin-store 持久化
│       └── lib.rs
└── scripts/            # 图标生成（zlib 手写 PNG，零依赖）+ 回归测试
```

## AI 配置与隐私

- API Key **仅存本机**：应用配置目录 `ai-providers.json`（明文，标准桌面应用做法）；前端界面只显示掩码。
- 前端 WebView **没有网络权限**（capabilities 未授予 http scope），AI 请求一律由 Rust reqwest 发往你配置的 base_url；使用本地 Ollama 时完全离线。
- 命盘数据不写盘、不上报；本应用无任何统计/遥测组件。详见应用内「隐私政策」。

## 数据来源标注（依上游协议保留）

本项目使用了 **紫微斗数开源样本数据集 / 排盘引擎**
来源：https://github.com/Renhuai123/ziwei-doushu · 作者：王多鱼AI（代码 MIT，数据 CC BY 4.0，古籍公版）

## 上游同步

本项目为上游开源项目的移植/重写，**不是 git fork**；上游更新需按 [UPSTREAM.md](UPSTREAM.md)
记录的流程同步移植（基线 commit、目录对照表、`scripts/sync-upstream.sh` 工具，移植后以 9 套回归测试验证）。
