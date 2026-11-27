# Ask, then `docker compose down` the given projects (callers list them first).
# Shared by wt-rm and compose-gc. Returns 1 when the user declines.
# Usage: __compose_down_confirm <project>...

function __compose_down_confirm
    test (count $argv) -eq 0; and return 0

    set -l down_args --remove-orphans

    read -l -P "Stop them? [y/N] " answer
    string match -qri '^y' -- "$answer"; or return 1

    read -l -P "Also delete their volumes (DB data is lost)? [y/N] " answer
    string match -qri '^y' -- "$answer"; and set -a down_args --volumes

    for p in $argv
        docker compose -p $p down $down_args
    end
end
