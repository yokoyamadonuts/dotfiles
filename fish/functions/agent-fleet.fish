# Show the herdr agent fleet with live status (blocked/working/done/idle).
# Usage: agent-fleet
function agent-fleet
    if not herdr status server >/dev/null 2>&1
        echo "herdr server is not running. Start it with: herdr"
        return 1
    end
    herdr agent list
end
