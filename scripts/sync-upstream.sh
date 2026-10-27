#!/usr/bin/env bash
#
# sync-upstream.sh — 上游 (Renhuai123/ziwei-doushu) 同步工具
#
# 用法（在本仓库根目录执行）：
#   scripts/sync-upstream.sh status   查看上游更新（基线 vs 最新）[默认]
#   scripts/sync-upstream.sh diff     查看移植相关目录的完整 diff
#   scripts/sync-upstream.sh test     跑 9 套排盘引擎回归测试
#   scripts/sync-upstream.sh mark     基线更新到上游最新 commit（移植完成且测试通过后执行）
#
# 环境变量：
#   SAMPLE_DIR   上游本地 clone 路径（默认：本仓库根目录的兄弟目录 ../Sample）

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SAMPLE_DIR="${SAMPLE_DIR:-$REPO_ROOT/../Sample}"
UPSTREAM_MD="$REPO_ROOT/UPSTREAM.md"
PORTED_PATHS=("lib/ziwei" "lib/classics" "components" "app" "scripts/regression")

die() { echo "✗ $*" >&2; exit 1; }

require_sample() {
  [ -d "$SAMPLE_DIR/.git" ] || die "未找到上游 clone：$SAMPLE_DIR
  请先 git clone https://github.com/Renhuai123/ziwei-doushu.git ../Sample
  或用 SAMPLE_DIR=/path/to/clone 指定路径"
}

read_baseline() {
  local h
  h="$(sed -n 's/^<!-- baseline: \([a-f0-9]\{40\}\) -->$/\1/p' "$UPSTREAM_MD" | head -n1)"
  [ -n "$h" ] || die "无法从 UPSTREAM.md 解析基线 commit（缺少 <!-- baseline: <40位hex> --> 行）"
  echo "$h"
}

fetch() {
  (cd "$SAMPLE_DIR" && git fetch origin --quiet)
}

latest() {
  (cd "$SAMPLE_DIR" && git rev-parse origin/main)
}

cmd_status() {
  require_sample
  fetch
  local baseline latest count
  baseline="$(read_baseline)"
  latest="$(latest)"
  echo "基线: $baseline"
  echo "最新: $latest"
  if [ "$baseline" = "$latest" ]; then
    echo "✓ 已与上游同步，无需操作。"
    return 0
  fi
  count="$(cd "$SAMPLE_DIR" && git rev-list --count "$baseline..origin/main")"
  echo
  echo "上游有 $count 个新 commit："
  (cd "$SAMPLE_DIR" && git log --oneline "$baseline..origin/main")
  echo
  echo "移植相关目录的变更："
  (cd "$SAMPLE_DIR" && git diff --stat "$baseline" "origin/main" -- "${PORTED_PATHS[@]}")
  echo
  echo "下一步：scripts/sync-upstream.sh diff → 按 UPSTREAM.md 对照表移植 → npm test → scripts/sync-upstream.sh mark"
}

cmd_diff() {
  require_sample
  fetch
  local baseline
  baseline="$(read_baseline)"
  (cd "$SAMPLE_DIR" && git diff "$baseline" "origin/main" -- "${PORTED_PATHS[@]}")
}

cmd_test() {
  (cd "$REPO_ROOT" && npm test)
}

cmd_mark() {
  require_sample
  fetch
  local old new subject
  old="$(read_baseline)"
  new="$(latest)"
  if [ "$old" = "$new" ]; then
    echo "基线已是上游最新（$new），无需更新。"
    return 0
  fi
  subject="$(cd "$SAMPLE_DIR" && git log -1 --format='%ad, %s' --date=short "origin/main")"
  awk -v latest="$new" -v subject="$subject" '
    /^<!-- baseline: [a-f0-9]+ -->/ { print "<!-- baseline: " latest " -->"; next }
    /^\| 基线 commit \|/            { print "| 基线 commit | `" latest "` (" subject ") |"; next }
    { print }
  ' "$UPSTREAM_MD" > "$UPSTREAM_MD.tmp"
  mv "$UPSTREAM_MD.tmp" "$UPSTREAM_MD"
  echo "✓ 基线已更新：$old → $new"
  echo "  ($subject)"
  echo "提醒：请 git add UPSTREAM.md 并与本次移植代码一起提交。"
}

case "${1:-status}" in
  status) cmd_status ;;
  diff)   cmd_diff ;;
  test)   cmd_test ;;
  mark)   cmd_mark ;;
  *) die "未知子命令：$1（可用：status | diff | test | mark）" ;;
esac
