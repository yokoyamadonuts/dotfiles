# Remove git worktree (and the docker compose stacks started from it)
# Usage: wt-rm <name>

function wt-rm
    if test -z "$argv[1]"
        echo "Usage: wt-rm <name>"
        return 1
    end

    set -l repo_name (basename (git rev-parse --show-toplevel 2>/dev/null))
    set -l target "$WORKTREE_BASE/$repo_name-$argv[1]"

    # Compose stacks outlive the directory they were started from, so stop
    # them before the worktree (and its compose files) disappears.
    if not __wt_compose_down "$target"
        echo "Aborted, worktree kept: $target"
        return 1
    end

    if git worktree remove "$target" --force 2>/dev/null
        echo "Removed worktree: $target"
    else
        echo "Failed to remove worktree: $target"
    end
end

# Stop docker compose projects whose compose files live under <dir>.
# Returns non-zero to tell wt-rm to keep the worktree.
function __wt_compose_down --argument-names dir
    type -q docker; or return 0
    type -q jq; or return 0

    # compose records absolute, symlink-resolved paths
    set -l real (realpath "$dir" 2>/dev/null); or set real "$dir"

    # Empty when Docker is not running, so wt-rm still works offline.
    set -l projects (docker compose ls --all --format json 2>/dev/null \
        | jq -r --arg d "$real/" \
            '.[] | select(.ConfigFiles | split(",") | any(startswith($d))) | .Name')
    test (count $projects) -eq 0; and return 0

    echo "Docker compose stacks under $real:"
    printf '  %s\n' $projects

    set -l down_args --remove-orphans

    # Declining keeps the worktree, so the stacks are not left orphaned.
    read -l -P "Stop them? [y/N] " answer
    string match -qri '^y' -- "$answer"; or return 1

    read -l -P "Also delete their volumes (DB data is lost)? [y/N] " answer
    string match -qri '^y' -- "$answer"; and set -a down_args --volumes

    for p in $projects
        docker compose -p $p down $down_args
    end
end
