#!/usr/bin/env bash
# Florin's presence (planner-unattended.md § Auto mode): AWAY <min> when his last message is ≥ IDLE (default 30)
# minutes old, otherwise HERE <min>. No stamp → HERE (never work on a guess).
IDLE=${1:-30}
F="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)/florin-last-seen"
S=$(cat "$F" 2>/dev/null); [[ "$S" =~ ^[0-9]+$ ]] || { echo "HERE no-stamp"; exit 1; }
M=$(( ($(date +%s) - S) / 60 ))
if (( M >= IDLE )); then echo "AWAY $M"; exit 0; else echo "HERE $M"; exit 1; fi
