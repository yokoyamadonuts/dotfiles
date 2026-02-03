# Toggle tmux popup window
function tmuxpopup
    set -l width '90%'
    set -l height '90%'

    if test -n "$argv[1]"
        tmux popup -d '#{pane_current_path}' -xC -yC -w$width -h$height -E $argv[1]
        return
    end

    set -l name (tmux display-message -p -F "#{session_name}")
    if string match -q '*popup*' "$name"
        tmux detach-client
    else
        tmux popup -d '#{pane_current_path}' -xC -yC -w$width -h$height -E "tmux new -A -s popup"
    end
end
