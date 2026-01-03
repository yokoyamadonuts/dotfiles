#!/bin/bash
set -e

# スクリプトのディレクトリを取得（どこから実行しても動作する）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# XDG_CONFIG_HOME が未設定の場合は ~/.config を使用
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"

vim_path="$HOME/.vim"
nvim_path="$CONFIG_HOME/nvim"

# ディレクトリ作成
mkdir -p "$vim_path"
mkdir -p "$nvim_path"

# シンボリックリンク作成（既存の場合はスキップ）
link_file() {
  local src="$1"
  local dest="$2"
  if [[ -e "$dest" ]]; then
    echo "Already exists: $dest"
  else
    ln -s "$src" "$dest"
    echo "Linked: $src -> $dest"
  fi
}

link_file "$SCRIPT_DIR/vimrc" "$HOME/.vimrc"
link_file "$SCRIPT_DIR/init.lua" "$nvim_path/init.lua"
link_file "$SCRIPT_DIR/lua" "$nvim_path/lua"
link_file "$SCRIPT_DIR/after" "$nvim_path/after"

echo "Done!"
