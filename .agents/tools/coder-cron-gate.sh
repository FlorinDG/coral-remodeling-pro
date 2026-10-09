#!/usr/bin/env bash
# The coder's cron gate (coder-cron-protocol.md). Run it from the coder's worktree at the start of EVERY run.
#   prints  WORK <ITEM> | <state> | <directive>   exit 0  → build that item (one item, then end the run)
#   prints  WAIT <reason>                          exit 1  → end the run, do nothing
# It reads the Planner's STATUS block from origin/develop, never a local copy. QUEUE_FILE=<path> overrides (tests only).
set -u
REF=origin/develop
QUEUE_PATH=.agents/workflows/CODER-QUEUE.md

git fetch -q origin 2>/dev/null || { echo "WAIT git fetch failed"; exit 1; }
if [ -n "${QUEUE_FILE:-}" ]; then QUEUE=$(cat "$QUEUE_FILE"); else QUEUE=$(git show "$REF:$QUEUE_PATH" 2>/dev/null); fi
[ -n "$QUEUE" ] || { echo "WAIT cannot read $QUEUE_PATH on $REF"; exit 1; }

# 1 · the switch: "UNATTENDED: ON until YYYY-MM-DD HH:MM"
SWITCH=$(printf '%s\n' "$QUEUE" | grep -m1 '^UNATTENDED:' || true)
case "$SWITCH" in
  "UNATTENDED: ON until "*)
    UNTIL=${SWITCH#UNATTENDED: ON until }
    NOW=$(date +"%Y-%m-%d %H:%M")
    if [[ "$NOW" > "$UNTIL" ]]; then echo "WAIT unattended window ended ($UNTIL)"; exit 1; fi ;;
  *) echo "WAIT unattended is OFF"; exit 1 ;;
esac

# 2 · develop must be green
if [ -z "${QUEUE_FILE:-}" ]; then
  CI=$(gh run list --branch develop --limit 1 --json status,conclusion -q '.[0].status+" "+(.[0].conclusion // "")' 2>/dev/null || echo "unknown")
  case "$CI" in
    "completed success") ;;
    "completed "*) echo "WAIT develop CI is red ($CI) — the Planner fixes it"; exit 1 ;;
    *) echo "WAIT develop CI not finished ($CI)"; exit 1 ;;
  esac
fi

report_exists() { [ -n "${QUEUE_FILE:-}" ] && { [ -f ".agents/reports/$1.md" ]; return; }; git cat-file -e "$REF:.agents/reports/$1.md" 2>/dev/null; }

# 3 · the table: | n | `ITEM` | STATE | directive | note |
ROWS=$(printf '%s\n' "$QUEUE" | awk '/^## ⚙️ STATUS/{on=1} on && /^\| *[0-9]+ *\|/{print} on && /^---/{exit}')
field() { printf '%s' "$1" | cut -d'|' -f"$2"; }
# 3 · the first GO row whose report doesn't exist yet. A finished GO row (its report exists, the Planner hasn't
#     set ACCEPTED yet) blocks the next one, unless that one is marked parallel-ok. Corrections are always a NEW row.
WAITING=""
while IFS= read -r row; do
  [ -n "$row" ] || continue
  ITEM=$(printf '%s' "$row" | cut -d'|' -f3 | sed -E 's/.*`([^`]+)`.*/\1/' | sed -E 's/^ +| +$//g')
  STATE=$(printf '%s' "$row" | cut -d'|' -f4 | sed -E 's/\*//g; s/^ +| +$//g')
  DIRECTIVE=$(printf '%s' "$row" | cut -d'|' -f5 | sed -E 's/`//g; s/^ +| +$//g')
  ID=$(printf '%s' "$ITEM" | tr ' ' '-')
  case "$STATE" in
    GO*)
      if report_exists "$ID"; then WAITING="$ITEM"; continue; fi
      if [ -n "$WAITING" ] && [[ "$STATE" != *parallel-ok* ]]; then
        echo "WAIT $WAITING is done and awaits the Planner's review"; exit 1
      fi
      echo "WORK $ITEM | $STATE | $DIRECTIVE"; exit 0 ;;
  esac
done <<< "$ROWS"
[ -n "$WAITING" ] && { echo "WAIT $WAITING is done and awaits the Planner's review"; exit 1; }
echo "WAIT no row is GO"; exit 1
