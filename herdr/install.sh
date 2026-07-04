#!/bin/bash
# Install herdr configuration by symlinking into ~/.config/herdr.

XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
HERDR_CONFIG_DIR="$XDG_CONFIG_HOME/herdr"

mkdir -p "$HERDR_CONFIG_DIR"

target="$HERDR_CONFIG_DIR/config.toml"
if [[ ! -e "$target" ]]; then
  ln -s "$PWD/config.toml" "$target"
  echo "Linked config.toml"
else
  echo "config.toml already exists at $target, skipping"
fi

echo "herdr configuration installed!"
echo ""
echo "Don't forget to:"
echo "  1. Install herdr: brew install herdr"
echo "  2. Start it: herdr   (or 'herdr server' / 'brew services start herdr')"
echo "  3. Apply config changes to a running server: herdr server reload-config"
