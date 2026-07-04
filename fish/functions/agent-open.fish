# Open a worktree (by agent/worktree name) in Zed for hands-on review/editing.
# With no argument, opens the current directory.
# Usage: agent-open [name]
function agent-open
    if test -z "$argv[1]"
        zed .
        return
    end

    set -l root (git rev-parse --show-toplevel 2>/dev/null)
    set -l repo_name (basename "$root")
    set -l target "$WORKTREE_BASE/$repo_name-$argv[1]"

    if test -d "$target"
        zed "$target"
    else
        echo "Worktree '$argv[1]' not found. Create with: agent-add $argv[1]"
        return 1
    end
end
