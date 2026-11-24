#!/bin/bash

MISE_CONFIG_DIR="$HOME/.config/mise"
mkdir -p "$MISE_CONFIG_DIR"

if [[ ! -e "$MISE_CONFIG_DIR/config.toml" ]]; then
    ln -s "$PWD/global.toml" "$MISE_CONFIG_DIR/config.toml"
    echo "Linked mise/global.toml"
else
    echo "$MISE_CONFIG_DIR/config.toml already exists, skipping"
fi

if ! command -v mise &> /dev/null; then
    echo ""
    echo "Note: 'mise' not found. Install it, then run 'mise install':"
    case "$(uname)" in
      "Darwin" ) echo "  brew install mise";;
      * )        echo "  curl https://mise.run | sh";;
    esac
    exit 0
fi

mise install
