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

if [[ ! -e $HOME/.claude/settings.json ]]; then
  ln -s $PWD/settings.json $HOME/.claude/settings.json
fi

if [[ ! -e $HOME/.claude/skills ]]; then
  ln -s $PWD/skills $HOME/.claude/skills
fi

if [[ ! -e $HOME/.claude/rules ]]; then
  ln -s $PWD/rules $HOME/.claude/rules
fi

# MCP configuration (user scope: ~/.config/claude/)
MCP_CONFIG_DIR="$HOME/.config/claude"
MCP_CONFIG_FILE="$MCP_CONFIG_DIR/mcp.json"

if [[ ! -e $MCP_CONFIG_DIR ]]; then
  mkdir -p $MCP_CONFIG_DIR
fi

if [[ ! -e $MCP_CONFIG_FILE ]]; then
  # Generate mcp.json from template with environment variable substitution
  if command -v envsubst &> /dev/null; then
    envsubst < $PWD/mcp.json.template > $MCP_CONFIG_FILE
    echo "Created $MCP_CONFIG_FILE from template"
  else
    cp $PWD/mcp.json.template $MCP_CONFIG_FILE
    echo "Created $MCP_CONFIG_FILE (envsubst not found, copied without substitution)"
  fi
else
  echo "MCP config already exists at $MCP_CONFIG_FILE, skipping"
fi
