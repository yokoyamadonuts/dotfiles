# Git Worktree Management for Parallel Claude Code Workflows
# Usage:
#   wt        - List all worktrees with fzf selection
#   wt a      - Switch to worktree 'a'

function wt
    if test -z "$argv[1]"
        # fzf selection mode
        set -l selected (git worktree list | fzf --height=40% --reverse \
            --preview='cd {1} && git log --oneline -10' \
            --preview-window=down:40% | awk '{print $1}')
        if test -n "$selected"
            cd "$selected"
        end
    else
        # Direct switch mode
        set -l repo_name (basename (git rev-parse --show-toplevel 2>/dev/null))
        set -l target "$WORKTREE_BASE/$repo_name-$argv[1]"
        if test -d "$target"
            cd "$target"
        else
            echo "Worktree '$argv[1]' not found. Create with: wt-add $argv[1]"
        end
    end
end
