# Remove git worktree
# Usage: wt-rm <name>

function wt-rm
    if test -z "$argv[1]"
        echo "Usage: wt-rm <name>"
        return 1
    end

    set -l repo_name (basename (git rev-parse --show-toplevel 2>/dev/null))
    set -l target "$WORKTREE_BASE/$repo_name-$argv[1]"

    if git worktree remove "$target" --force 2>/dev/null
        echo "Removed worktree: $target"
    else
        echo "Failed to remove worktree: $target"
    end
end
