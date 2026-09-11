#!/usr/bin/env bash
# Installs the demo-production skill (and optionally its reference implementation) into
# another repository, or into your personal skills folder.
#
#   ./install.sh --target-repo ../some-other-project
#   ./install.sh --target-repo ../some-other-project --target claude --with-reference-implementation
#   ./install.sh --personal                 # ~/.agents, ~/.claude and ~/.copilot
#
# The PowerShell twin (install.ps1) does the same thing on Windows.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_NAME="demo-production"

target_repo=""
target="github"
with_ri=0
personal=0
force=0

usage() {
  sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --target-repo) target_repo="${2:?--target-repo needs a path}"; shift 2 ;;
    --target) target="${2:?--target needs github|claude|agents|all}"; shift 2 ;;
    --with-reference-implementation) with_ri=1; shift ;;
    --personal) personal=1; shift ;;
    --force) force=1; shift ;;
    -h|--help) usage 0 ;;
    *) echo "unknown option: $1" >&2; usage 1 ;;
  esac
done

install_to() {
  local dest="$1/$SKILL_NAME"
  if [ -e "$dest" ] && [ "$force" -eq 0 ]; then
    echo "$dest already exists. Pass --force to overwrite." >&2
    exit 1
  fi
  rm -rf "$dest"
  mkdir -p "$dest"
  cp -R "$ROOT/$SKILL_NAME/." "$dest/"
  echo "Installed the skill to $dest"
}

if [ "$personal" -eq 1 ]; then
  # Every tool reads its own folder; the files are identical, so installing to all of them
  # costs nothing and means the skill is there whichever one you happen to open.
  for d in "$HOME/.agents/skills" "$HOME/.claude/skills" "$HOME/.copilot/skills"; do
    mkdir -p "$d"
    install_to "$d"
  done
  exit 0
fi

if [ -z "$target_repo" ]; then
  echo "--target-repo is required (or use --personal)" >&2
  usage 1
fi
if [ ! -d "$target_repo" ]; then
  echo "Target repo folder not found: $target_repo" >&2
  exit 1
fi

case "$target" in
  github) folders=(".github/skills") ;;
  claude) folders=(".claude/skills") ;;
  agents) folders=(".agents/skills") ;;
  all)    folders=(".github/skills" ".claude/skills" ".agents/skills") ;;
  *) echo "--target must be github, claude, agents or all" >&2; exit 1 ;;
esac

for folder in "${folders[@]}"; do
  mkdir -p "$target_repo/$folder"
  install_to "$target_repo/$folder"
done

if [ "$with_ri" -eq 1 ]; then
  dest="$target_repo/demo"
  if [ -e "$dest" ] && [ "$force" -eq 0 ]; then
    echo "$dest already exists — skipping (pass --force to overwrite it too)." >&2
  else
    rm -rf "$dest"
    mkdir -p "$dest"
    cp -R "$ROOT/reference-implementation/." "$dest/"
    echo "Installed the reference implementation to $dest"
    echo "Run 'npm install' in $dest, then read $dest/CONFIGURE.md."
  fi
fi

echo
echo "Commit these into $target_repo so the whole team gets them on their next pull."
