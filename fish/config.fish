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

# Homebrew PATH: conf.d/00-homebrew.fish (must run before conf.d/mise-activate.fish)

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

# Tool versions (node / ruby / deno ...) come from mise: conf.d/mise-activate.fish

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
