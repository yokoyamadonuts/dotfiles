# Create a git worktree and launch a Claude Code agent for it in herdr.
# Pairs the existing worktree workflow (wt-add) with herdr's agent multiplexer.
# Usage: agent-add <name> [branch]
#   Works from inside or outside a herdr session; the agent lands in its own tab.

function agent-add
    if test -z "$argv[1]"
        echo "Usage: agent-add <name> [branch]"
        return 1
    end

    set -l name $argv[1]

    # herdr enforces this server-side, but checking first avoids creating a
    # worktree we would then be unable to attach an agent to.
    if not string match -qr '^[a-z][a-z0-9_-]{0,31}$' -- "$name"
        echo "Invalid agent name '$name'."
        echo "Must start with a lowercase letter, then lowercase letters, digits, '-' or '_' (1-32 chars)."
        return 1
    end

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
    # $target is absolute: a relative path would resolve against our own cwd
    # and nest the new worktree inside the current one.
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

    # herdr 0.8.0's `agent start` no longer builds layout — it requires an
    # existing pane and dropped --cwd. So open a tab rooted at the worktree
    # and hand its root pane to the agent.
    set -l ws_args
    if test "$HERDR_ENV" = 1
        # Inside herdr, pin the tab to our own workspace: without --workspace
        # herdr uses the focused one, which may belong to another client.
        set -l ws (herdr pane current --current 2>/dev/null | jq -r '.result.pane.workspace_id // empty')
        test -n "$ws"; and set ws_args --workspace "$ws"
    end

    set -l created (herdr tab create $ws_args --cwd "$target" --label "$name" --no-focus 2>&1)
    set -l pane (echo $created | jq -r '.result.root_pane.pane_id // empty' 2>/dev/null)
    set -l tab (echo $created | jq -r '.result.tab.tab_id // empty' 2>/dev/null)
    if test -z "$pane"
        echo "Failed to open a herdr tab for '$name':"
        echo "  $created"
        echo "Worktree is ready at: $target"
        return 1
    end

    set -l started (herdr agent start "$name" --kind claude --pane "$pane" 2>&1)
    if test $status -ne 0
        # Do not strand the tab we just opened.
        echo "Agent start failed for '$name':"
        echo "  $started"
        herdr tab close "$tab" >/dev/null 2>&1
        echo "Closed tab $tab. Worktree is ready at: $target"
        return 1
    end

    echo "Agent '$name' started in tab $tab (pane $pane)"
    echo "Worktree: $target"
end
