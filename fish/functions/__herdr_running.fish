# Predicate: is the herdr server currently up?
# Private helper shared by agent-add / agent-fleet. Returns 0 when the server
# is reachable, non-zero otherwise, so callers can write:
#
#     if not __herdr_running
#         echo "herdr server is not running. Start it with: herdr"
#         return 1
#     end
#
# NOTE: `herdr status server` exits 0 even when the server is down (verified on
# herdr 0.7.1 and 0.8.0), which is why the previous `if not herdr status server`
# guard never fired. Do not reintroduce it.
#
# Measured behaviour of the candidates:
#
#   candidate                                   up   down   caveat
#   ------------------------------------------  ---  -----  ------------------
#   herdr status server (exit code)              0     0    unusable
#   herdr agent list (exit code)                 0     1    real API round-trip
#   test -S $HOME/.config/herdr/herdr.sock       0     1    stale file if crashed
#   herdr status server | grep "status: running" 0     1    parses human output
#
# `agent list` is the choice: it actually round-trips the socket, so a crashed
# server that left its socket file behind still reads as down. The cost is one
# subprocess, which is noise next to the git and herdr work the callers go on
# to do. Suppressing output matters — a down server prints a raw Rust
# `Os { code: 2, kind: NotFound }` to stderr.
function __herdr_running
    herdr agent list >/dev/null 2>&1
end
