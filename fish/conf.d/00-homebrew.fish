# Runs first in conf.d so mise-activate.fish can put its shims ahead of
# Homebrew's node / deno. Setting Homebrew's PATH later in config.fish would
# shadow the mise shims in non-interactive fish.
for brew in /opt/homebrew/bin/brew /home/linuxbrew/.linuxbrew/bin/brew
    if test -x $brew
        $brew shellenv fish | source
        break
    end
end
