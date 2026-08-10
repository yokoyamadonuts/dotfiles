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
# herdr 0.7.1), which is why the previous `if not herdr status server` guard
# never fired. Do not reintroduce it.
#
# Measured behaviour of the candidates on herdr 0.7.1:
#
#   candidate                                   up   down   caveat
#   ------------------------------------------  ---  -----  ------------------
#   herdr status server (exit code)              0     0    unusable
#   herdr agent list (exit code)                 0     1    real API round-trip
#   test -S $HOME/.config/herdr/herdr.sock       0     1    stale file if crashed
#   herdr status server | grep "status: running" 0     1    parses human output
#
function __herdr_running
    # TODO: implement the readiness check.
    return 1
end
