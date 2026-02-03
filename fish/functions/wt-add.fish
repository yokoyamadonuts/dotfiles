# Create new git worktree
# Usage: wt-add <name> [branch]

function wt-add
    if test -z "$argv[1]"
        echo "Usage: wt-add <name> [branch]"
        return 1
    end

    set -l repo_name (basename (git rev-parse --show-toplevel 2>/dev/null))
    set -l target "$WORKTREE_BASE/$repo_name-$argv[1]"
    set -l branch $argv[2]

    if test -z "$branch"
        set branch (git branch --show-current)
    end

    mkdir -p "$WORKTREE_BASE"

    # Try to create with new branch first, fallback to existing branch
    if not git worktree add "$target" -b "worktree-$argv[1]" "$branch" 2>/dev/null
        git worktree add "$target" "$branch"
    end

    echo "Created worktree: $target"
    cd "$target"
end
