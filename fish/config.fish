# Fish Shell Configuration

# ============================================================
# Aliases
# ============================================================
alias lg='lazygit'
alias gs='git status'
alias gl='git log'
alias ls='lsd'
alias ll='lsd -la'
alias k='kubectl'
alias d='docker compose'
alias v='nvim'
alias t='terraform'
alias crun='cargo run --quiet'
alias c='cargo'
alias g='git'
alias ccc='claude'

# Worktree quick switch aliases
alias za='wt a'
alias zb='wt b'
alias zc='wt c'
alias zd='wt d'
alias ze='wt e'

# ============================================================
# Environment Variables
# ============================================================
set -gx WORKTREE_BASE "$HOME/.worktrees"

# Go
set -gx GOPATH "$HOME/go"
fish_add_path "$GOPATH/bin"

# Deno
fish_add_path "$HOME/.deno/bin"

# Homebrew (macOS)
if test (uname -s) = Darwin
    eval (/opt/homebrew/bin/brew shellenv)
end

# ============================================================
# Vi Mode
# ============================================================
fish_vi_key_bindings

# ============================================================
# Key Bindings
# ============================================================
# Ctrl+G - ghq fuzzy search
bind -M insert \cg ghq_fzf
bind \cg ghq_fzf

# Ctrl+K - git branch switch
bind -M insert \ck gss
bind \ck gss

# ============================================================
# asdf
# ============================================================
if test -f (brew --prefix)/opt/asdf/libexec/asdf.fish
    source (brew --prefix)/opt/asdf/libexec/asdf.fish
end

# ============================================================
# fzf
# ============================================================
if command -v fzf > /dev/null
    fzf --fish | source
end

# ============================================================
# direnv
# ============================================================
if command -v direnv > /dev/null
    direnv hook fish | source
end
