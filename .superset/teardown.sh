#!/usr/bin/env bash
# Stops this workspace's dev servers. Its port block frees itself when the worktree is removed.
set -u

workspace="$(git rev-parse --show-toplevel)"
ports_file="$workspace/.env.ports"
[ -f "$ports_file" ] || exit 0

base="$(sed -n 's/^PORT_BASE=//p' "$ports_file")"
[ -n "$base" ] || exit 0

for port in $(seq "$base" "$((base + 9))"); do
  for pid in $(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null); do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    # Only stop servers started from this workspace.
    case "$cwd" in
      "$workspace"*) kill "$pid" 2>/dev/null && echo "stopped process $pid on port $port" ;;
    esac
  done
done
exit 0
