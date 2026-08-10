# Create a git worktree and launch a Claude Code agent for it in herdr.
# Pairs the existing worktree workflow (wt-add) with herdr's agent multiplexer.
# Usage: agent-add <name> [branch]
#   Best run from inside a herdr session so the new agent joins the fleet.

function agent-add
    if test -z "$argv[1]"
        echo "Usage: agent-add <name> [branch]"
        return 1
    end

    set -l name $argv[1]
    set -l root (git rev-parse --show-toplevel 2>/dev/null)
    if test -z "$root"
        echo "Not inside a git repository."
        return 1
    end
    set -l repo_name (basename "$root")

    # Fall back like zsh/zshrc does; config.fish may not be installed.
    # Without this an unset WORKTREE_BASE resolves to "/repo-name" at the
    # filesystem root instead of "~/.worktrees/repo-name".
    set -l base $WORKTREE_BASE
    test -n "$base"; or set base "$HOME/.worktrees"
    set -l target "$base/$repo_name-$name"

    # Create the worktree if it does not exist yet (mirrors wt-add).
    if not test -d "$target"
        set -l branch $argv[2]
        test -z "$branch"; and set branch (git branch --show-current)
        mkdir -p "$base"
        if not git worktree add "$target" -b "worktree-$name" "$branch" 2>/dev/null
            git worktree add "$target" "$branch"; or return 1
        end
        echo "Created worktree: $target"
    end

    # herdr must be running to place the agent in the fleet.
    if not __herdr_running
        echo "herdr server is not running. Start it with: herdr"
        echo "Worktree is ready at: $target"
        return 1
    end

    # Launch Claude Code rooted at the worktree; herdr tracks its state.
    herdr agent start "$name" --cwd "$target" -- claude
end
