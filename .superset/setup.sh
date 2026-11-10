#!/usr/bin/env bash
# Prepares a workspace: shared env file, its own ports, and dependencies. Safe to run again.
set -u

workspace="$(git rev-parse --show-toplevel)"
root="${SUPERSET_ROOT_PATH:-$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")}"
cd "$workspace" || exit 1

PORT_START=5100
PORTS_PER_WORKSPACE=10

link_env() {
  # A link, so a key added once reaches every workspace. Never replaces a real file.
  if [ -e .env.local ] && [ ! -L .env.local ]; then
    echo "env: keeping this workspace's own .env.local"
    return
  fi
  local source=""
  for candidate in "$root/.env.local" "$HOME/tabletop-theatre.env.local"; do
    if [ -f "$candidate" ] && [ "$candidate" != "$workspace/.env.local" ]; then
      source="$candidate"
      break
    fi
  done
  if [ -n "$source" ]; then
    ln -sfn "$source" .env.local
    echo "env: linked .env.local to $source"
  elif [ ! -e .env.local ]; then
    echo "env: no .env.local found. Art and live AI need one: add it to $root/.env.local, then rerun this script."
  fi
}

allocate_ports() {
  if [ -f .env.ports ]; then
    echo "ports: keeping $(grep '^PORT_BASE=' .env.ports)"
    return
  fi
  # Agents can start together, so only one workspace picks a port block at a time.
  local lock="$(git rev-parse --path-format=absolute --git-common-dir)/superset-ports.lock"
  local tries=0
  until mkdir "$lock" 2>/dev/null; do
    tries=$((tries + 1))
    if [ "$tries" -ge 30 ]; then
      echo "ports: removing a stale lock"
      rmdir "$lock" 2>/dev/null
      tries=0
    fi
    sleep 1
  done

  # Every worktree's .env.ports says which blocks are taken, so a deleted workspace frees its block.
  local taken="" path
  while IFS= read -r path; do
    if [ -f "${path#worktree }/.env.ports" ]; then
      taken="$taken $(sed -n 's/^PORT_BASE=//p' "${path#worktree }/.env.ports")"
    fi
  done < <(git worktree list --porcelain | grep '^worktree ')

  local base="$PORT_START"
  while [[ " $taken " == *" $base "* ]] \
    || lsof -nP -iTCP:"$base" -sTCP:LISTEN >/dev/null 2>&1 \
    || lsof -nP -iTCP:"$((base + 1))" -sTCP:LISTEN >/dev/null 2>&1; do
    base=$((base + PORTS_PER_WORKSPACE))
  done
  printf 'PORT_BASE=%s\nCLIENT_PORT=%s\nBACKEND_PORT=%s\n' "$base" "$base" "$((base + 1))" > .env.ports
  rmdir "$lock"
  echo "ports: client $base, backend $((base + 1))"
}

install_dependencies() {
  if [ -f pnpm-lock.yaml ]; then
    pnpm install --frozen-lockfile
  elif [ -f package-lock.json ]; then
    npm ci
  else
    echo "dependencies: nothing to install yet"
  fi
}

check_art_tools() {
  python3 -c "import numpy, PIL" 2>/dev/null || echo "art: art/tools/cutout.py needs numpy and Pillow (python3 -m pip install numpy pillow)"
}

link_env
allocate_ports
install_dependencies
check_art_tools
echo "Workspace ready: $workspace"
