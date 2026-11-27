# Stop docker compose stacks whose compose files no longer exist
# (e.g. started from a worktree that Claude Code or `git worktree remove` deleted).
# Usage: compose-gc

function compose-gc
    if not type -q docker; or not type -q jq
        echo "compose-gc needs docker and jq"
        return 1
    end

    set -l listing (docker compose ls --all --format json 2>/dev/null); or begin
        echo "Docker is not running"
        return 1
    end

    set -l orphans
    set -l lines
    for row in (printf '%s\n' $listing | jq -r '.[] | [.Name, .ConfigFiles] | @tsv')
        set -l name (string split -f1 \t -- $row)
        set -l files (string split , -- (string split -f2 \t -- $row))
        # Orphaned only when every compose file is gone
        set -l alive 0
        for f in $files
            test -e "$f"; and set alive 1
        end
        if test $alive -eq 0
            set -a orphans $name
            set -a lines (printf '  %-40s %s' $name (path dirname -- $files[1]))
        end
    end

    if test (count $orphans) -eq 0
        echo "No orphaned compose stacks."
        return 0
    end

    echo "Orphaned compose stacks (their compose files are gone):"
    printf '%s\n' $lines
    __compose_down_confirm $orphans
end
