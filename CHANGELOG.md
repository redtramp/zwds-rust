# 更新日志（Changelog）

本项目（ziwei-doushu · 桌面版，Rust + Tauri 2 + Svelte 5）的所有重要变更均记录于此。

格式基于 [Keep a Changelog 1.1.0](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

## [0.2.0] - 2026-10-29

### 新增

- **奇门遁甲排盘**：时家 / 刻家 / 金函玉镜日家三盘型（金函玉镜含两种排盘方式），
  引擎 TypeScript 移植（常量表 / 历法桥接 lunar-javascript / 排盘核心）+ 九宫格盘面组件 + 排盘页
- 奇门 AI 解读：5 人设（Rust 侧逐字移植原版 system_prompts）+ 流式解读面板
- **古籍库 SQLite 化**：204 本古籍全量入藏，构建期生成 `classics.db`（约 50.8MB、21.9 万段），
  书目 / 目录 / 阅读 / 全文检索 4 页面异步化（LIKE AND 语义检索）
- 奇门回归测试（第 11 套）：1344 盘盘面铁律、四柱 JDN 双 oracle、暗干 360 键全覆盖、0 crash
- 4 种盘型均提供 AI 解读：新增日家盘面文本（局/鹤神/九宫星门/十二神）；整体解读 = 时家+刻家+日家三盘拼接
- 奇门表单 UX：年月日联动下拉框（防非法日期）、分钟 0–59 下拉框、盘型/排盘方式 2×2 卡片选择器
- UI/UX 视觉迭代：衬线展示字体（本地字体栈，不引网络字体）、墨金信息层次、全局键盘焦点环、`prefers-reduced-motion` 动效降级
- 页面常驻槽位：排盘/奇门页切换不再丢失表单/盘面/AI 会话状态

### 变更

- `classics.db` 运行时落点改为与程序同目录：三级解析（exe 同目录 → 打包资源就地读 → 应用配置目录兜底），
  启动自动拷贝并顺带清理配置目录旧版本残留
- AI 解盘输出钉住简体中文：系统 prompt 语言要求 + 前端繁→简显示层（引擎输出保持 1:1 繁体原文）

### 修复

- plugin-sql 解析锚点修正为应用配置目录（初版误用应用数据目录，构建产物运行报 does not exist）
- 打包资源候选路径解析（Tauri 保留 `bundle.resources` 相对前缀：deb 二进制 `/usr/bin/`、资源 `/usr/lib/<name>/resources/`）
- 资源解析补 exe 相对候选（tauri-utils `resource_dir` 对非构建树二进制落空）
- 数据库副本权限钉 0644（`fs::copy` 继承只读源权限会导致插件 RW 打开 EACCES）
- 奇门引擎移植缺陷 4 处（两字键错配 / 单字映射 / 中宫回退 / 负索引）；构建警告全部清理

## [0.1.0] - 2026-10-28

### 新增

- 项目初始化：ziwei-doushu（Next.js，上游 Renhuai123/ziwei-doushu）→ Rust + Tauri 2 + Svelte 5 桌面版移植
- 页面：排盘 / 合盘 / 命理百科 / 古籍库（3 本精选）/ 首页 / 预览 / 设置 / 隐私 / 条款
- AI 解读管线：Rust reqwest 对接 OpenAI 兼容提供商（DeepSeek/OpenAI/Kimi/通义/智谱 预置 + 本地 Ollama 离线），
  前端 WebView 无网络权限，API Key 仅存本机
- 回归测试 10 套（排盘引擎黄金用例）
- 上游同步工具：`UPSTREAM.md` + `scripts/sync-upstream.sh`（邻居目录 + 同步脚本）
- CI 跨平台构建：Linux/Windows/macOS 矩阵（macOS ad-hoc 签名），`app-v<version>` tag 触发 Release

### 变更

- 移植上游更新：海外时区真太阳时 + 夏令时钟表校正（基线 ff9a147）
