# Git branch switch with fzf
function gss
    set -l branch (
        git for-each-ref --sort=-committerdate \
            --format='%(refname:short)' refs/heads refs/remotes \
        | grep -vE '^HEAD$' \
        | fzf --height=40% --reverse --prompt='branch> ' \
              --preview='git --no-pager log --graph --oneline --decorate -n 20 {}' \
              --preview-window=down:60%:wrap
    )

    if test $status -ne 0
        commandline -f repaint
        return
    end

    if string match -q 'origin/*' "$branch"
        set -l local_branch (string replace 'origin/' '' "$branch")
        git switch -C "$local_branch" "$branch"
    else
        git switch "$branch"
    end
    commandline -f repaint
end
