# ghq fuzzy search and cd
function ghq_fzf
    set -l src (ghq list | fzf --preview "bat --color=always --style=grid (ghq root)/{}/README.*")
    if test -n "$src"
        cd (ghq root)/$src
    end
    commandline -f repaint
end
