#!/bin/bash

if [ ! -e $HOME/.claude ]; then
  mkdir -p $HOME/.claude
fi

if [[ ! -e $HOME/.claude/commands ]]; then
  ln -s $PWD/commands $HOME/.claude/commands
fi

if [[ ! -e $HOME/.claude/hooks ]]; then
  ln -s $PWD/hooks $HOME/.claude/hooks
fi

if [[ ! -e $HOME/.claude/agents ]]; then
  ln -s $PWD/agents $HOME/.claude/agents
fi

# settings.json: Claude Code writes preferences (/config, /model, /effort) into
# ~/.claude/settings.json itself. If a plain file already exists there, the
# repo copy and the live file drift apart and the repo's hooks never run.
# Never overwrite silently: show the diff and the commands to adopt the repo copy.
if [[ -L $HOME/.claude/settings.json ]]; then
  : # already linked
elif [[ ! -e $HOME/.claude/settings.json ]]; then
  ln -s $PWD/settings.json $HOME/.claude/settings.json
else
  echo "WARNING: $HOME/.claude/settings.json is a regular file, not a symlink to $PWD/settings.json."
  echo "  Compare:  diff $HOME/.claude/settings.json $PWD/settings.json"
  echo "  Adopt:    mv $HOME/.claude/settings.json $HOME/.claude/settings.json.bak-$(date +%Y%m%d) && ln -s $PWD/settings.json $HOME/.claude/settings.json"
fi

if [[ ! -e $HOME/.claude/skills ]]; then
  ln -s $PWD/skills $HOME/.claude/skills
fi

if [[ ! -e $HOME/.claude/rules ]]; then
  ln -s $PWD/rules $HOME/.claude/rules
fi

# Second account (`c2` alias = CLAUDE_CONFIG_DIR=~/.claude-sub). Auth, plugins
# and ~/.claude-sub/.claude.json stay per account; the repo-managed layers and
# projects/ (sessions + auto memory) are shared with ~/.claude so both accounts
# see the same memory and can --resume each other's sessions.
SUB=$HOME/.claude-sub
mkdir -p "$SUB"
for name in commands hooks agents skills rules settings.json; do
  if [[ ! -e $SUB/$name ]]; then
    ln -s "$PWD/$name" "$SUB/$name"
  fi
done
if [[ -L $SUB/projects ]]; then
  : # already shared
elif [[ ! -e $SUB/projects ]]; then
  mkdir -p "$HOME/.claude/projects"
  ln -s "$HOME/.claude/projects" "$SUB/projects"
else
  echo "WARNING: $SUB/projects is a real directory, so memory is not shared with ~/.claude."
  echo "  Merge:  rsync -a $SUB/projects/ $HOME/.claude/projects/ && mv $SUB/projects $SUB/projects.bak-$(date +%Y%m%d) && ln -s $HOME/.claude/projects $SUB/projects"
fi

# MCP servers are not managed here. Claude Code stores user-scope servers in
# ~/.claude.json (`claude mcp add --scope user ...`) and project servers in the
# project's .mcp.json. See MCP.md.

# Optional dependency check for vcsdd-lite skill scripts
if ! command -v deno &> /dev/null; then
  echo ""
  echo "Note: 'deno' not found. The hooks in settings.json (format / notify / skill-memory) and the vcsdd-lite / reviewing-skills scripts require Deno."
  echo "Install: curl -fsSL https://deno.land/install.sh | sh"
  echo "(Skills work without the scripts; hooks silently fail open without Deno.)"
fi
