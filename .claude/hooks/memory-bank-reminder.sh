#!/bin/bash
# Stop hook：当项目改动比 memory-bank/activeContext.md 更新时，
# 拦截本次停止并提示 AI 先更新记忆银行再收尾。

input=$(cat)

# 已被本 hook 拦截过一次后再次停止时直接放行，避免死循环
stop_active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)
[ "$stop_active" = "true" ] && exit 0

root="$(cd "$(dirname "$0")/../.." && pwd)"
ctx="$root/memory-bank/activeContext.md"

# 尚未生成记忆银行时不打扰
[ -f "$ctx" ] || exit 0

ctx_mtime=$(stat -f %m "$ctx" 2>/dev/null || stat -c %Y "$ctx")

stale=0

# 信号一：最近一次 commit 晚于 activeContext.md 的更新时间
last_commit=$(git -C "$root" log -1 --format=%ct 2>/dev/null || echo 0)
[ "$last_commit" -gt "$ctx_mtime" ] && stale=1

# 信号二：工作区存在比 activeContext.md 更新的改动文件（不含 memory-bank 与 .claude 自身）
if [ "$stale" -eq 0 ]; then
  while IFS= read -r f; do
    case "$f" in memory-bank/*|.claude/*) continue ;; esac
    [ -f "$root/$f" ] || continue
    m=$(stat -f %m "$root/$f" 2>/dev/null || stat -c %Y "$root/$f")
    if [ "$m" -gt "$ctx_mtime" ]; then
      stale=1
      break
    fi
  done < <(git -C "$root" status --porcelain 2>/dev/null | cut -c4-)
fi

[ "$stale" -eq 0 ] && exit 0

cat <<'EOF'
{"decision":"block","reason":"收尾前请先更新 memory-bank/activeContext.md（当前状态、活跃文件、已做决策、下一步、阻塞）；如本次有里程碑或架构变更，同步更新 memory-bank/progress.md。更新完成后即可正常结束，无需做其他改动。"}
EOF
