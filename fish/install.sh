#!/bin/bash

FISH_CONFIG_DIR="$HOME/.config/fish"

# Create fish config directory
mkdir -p "$FISH_CONFIG_DIR/functions"
mkdir -p "$FISH_CONFIG_DIR/conf.d"

# Symlink config.fish
if [[ ! -e "$FISH_CONFIG_DIR/config.fish" ]]; then
    ln -s "$PWD/config.fish" "$FISH_CONFIG_DIR/config.fish"
    echo "Linked config.fish"
else
    echo "config.fish already exists, skipping"
fi

# Symlink all functions
for func in "$PWD/functions/"*.fish; do
    if [[ -f "$func" ]]; then
        fname=$(basename "$func")
        if [[ ! -e "$FISH_CONFIG_DIR/functions/$fname" ]]; then
            ln -s "$func" "$FISH_CONFIG_DIR/functions/$fname"
            echo "Linked function: $fname"
        else
            echo "Function $fname already exists, skipping"
        fi
    fi
done

# Symlink conf.d files
for conf in "$PWD/conf.d/"*.fish; do
    if [[ -f "$conf" ]]; then
        cname=$(basename "$conf")
        if [[ ! -e "$FISH_CONFIG_DIR/conf.d/$cname" ]]; then
            ln -s "$conf" "$FISH_CONFIG_DIR/conf.d/$cname"
            echo "Linked conf.d: $cname"
        else
            echo "conf.d $cname already exists, skipping"
        fi
    fi
done

echo "Fish shell configuration installed!"
echo ""
echo "Don't forget to:"
echo "  1. Install fish: brew install fish"
echo "  2. Add fish to /etc/shells: echo /opt/homebrew/bin/fish | sudo tee -a /etc/shells"
echo "  3. Set as default shell: chsh -s /opt/homebrew/bin/fish"
