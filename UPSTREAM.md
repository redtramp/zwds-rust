# 上游同步说明（UPSTREAM）

本项目是 [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu) 开源项目（Next.js）的
**重写/移植**（Tauri 2 + Svelte 5 + Rust），**不是 git fork**：两者没有共同 git 历史，
上游更新无法通过 `git pull` / `git merge` 自动带入，必须按下述流程**同步移植**。

<!-- baseline: ff9a1470ebe652e57b9d690f5d01db9a04f47aae -->

## 当前同步基线

| 项 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/Renhuai123/ziwei-doushu |
| 基线 commit | `ff9a1470ebe652e57b9d690f5d01db9a04f47aae` (2026-10-27, feat(引擎): 海外时区真太阳时 + 夏令时钟表读数换成标准时间 (#55)) |
| 上游本地 clone | `../Sample/`（本仓库的兄弟目录，仅本地工作副本，不入库） |

> 机器可读的基线以上方 HTML 注释中的 `baseline` 行为准；`scripts/sync-upstream.sh mark` 会自动改写它（连同上表基线行）。

## 目录对照表（上游 `Sample/` → 本仓库）

| 上游 | 本仓库 | 说明 |
| --- | --- | --- |
| `lib/ziwei/` | `src/lib/engine/` | 排盘引擎核心，原样移植。本仓库本地新增：`form-state.ts`（自 `BirthForm.tsx` 抽出）、`star-detail.ts`（自 `StarDetailPanel.tsx` 抽出）；上游 `history.ts` 未移植 |
| `lib/classics/` | `src/lib/classics/` | 古籍数据，原样移植 |
| `components/` | `src/lib/components/` | TSX → Svelte 5，逻辑 1:1 保留，样式令牌化 |
| `app/` | `src/lib/pages/` | Next.js 路由 → hash 路由 |
| `scripts/regression/` | `scripts/regression/` | 10 套引擎回归测试与上游 CI 完全一致（同步后的验证安全网）+ 1 套奇门引擎回归（本项目自研功能） |
| `lib/nihai/`、`lib/seo/`、`lib/site.ts` | — | 未移植（Next.js 特有 / SEO 功能，桌面版不需要） |

## 同步流程

全部命令在本仓库根目录执行：

```bash
scripts/sync-upstream.sh status   # ① 查看上游更新（基线 vs 最新，列出新 commit 与移植相关目录变更）
scripts/sync-upstream.sh diff     # ② 查看移植相关目录的完整 diff
# ③ 按上方对照表把变更移植到本仓库对应目录（人工）
npm test                          # ④ 跑回归测试验证移植（10 套引擎 + 1 套奇门）
scripts/sync-upstream.sh mark     # ⑤ 基线更新到上游最新 commit（会同时改写本文件的基线行）
git add -A && git commit          # ⑥ 提交移植结果与新的基线
```

注意事项：

- 直连 github.com 较慢时，为 git 配置代理即可：`git config --global http.proxy http://127.0.0.1:<port>`（或 `https.proxy`）；同步脚本的 `fetch` 会用到它。
- **`Sample/` 目录不入库**——它只是上游的本地工作副本，供 diff 参照；请勿把它加进本仓库。
- 移植前先看变更是否落在「已移植」范围内；上游 `history.ts`、`lib/nihai/`、`lib/seo/` 及
  Next.js 特有配置（`next.config.js`、`.github/` 等）的变更可直接跳过。
- 移植后回归测试若失败：逐文件二分定位。回归套件与上游 CI 一致，失败即代表移植偏离了上游语义。
- `mark` 只改 `UPSTREAM.md`，不会自动 commit——基线更新应与移植代码在同一次提交里。
- 上游若升级 `iztro` / `lunar-javascript` 版本，本仓库 `package.json` 需同步升级版本并全量跑回归。
