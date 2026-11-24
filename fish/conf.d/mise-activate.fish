# Same basename as Homebrew's vendor_conf.d/mise-activate.fish, so this file
# replaces it. conf.d runs before config.fish adds Homebrew to PATH, hence
# the explicit candidates.
set -l mise_bin (command -s mise)
if test -z "$mise_bin"
    for p in /opt/homebrew/bin/mise /home/linuxbrew/.linuxbrew/bin/mise $HOME/.local/bin/mise
        if test -x $p
            set mise_bin $p
            break
        end
    end
end

if test -n "$mise_bin"
    # Shims: processes that inherit PATH without ever drawing a prompt
    # (Claude Code hooks, IDEs, GUI apps) still resolve per-directory versions.
    $mise_bin activate fish --shims | source
    # Prompt/cd hook: puts the real install dirs on PATH for interactive use.
    if status is-interactive
        $mise_bin activate fish | source
    end
end
