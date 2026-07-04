#!/bin/bash
# Install Zed configuration by symlinking into ~/.config/zed.

XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
ZED_CONFIG_DIR="$XDG_CONFIG_HOME/zed"

mkdir -p "$ZED_CONFIG_DIR"

for f in settings.json keymap.json; do
  target="$ZED_CONFIG_DIR/$f"
  if [[ ! -e "$target" ]]; then
    ln -s "$PWD/$f" "$target"
    echo "Linked $f"
  else
    echo "$f already exists at $target, skipping"
  fi
done

echo "Zed configuration installed!"
echo ""
echo "Don't forget to:"
echo "  1. Install Zed: brew install --cask zed"
echo "  2. (Optional) Install the Cica font used in these settings"
