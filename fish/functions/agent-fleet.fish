# Show the herdr agent fleet with live status (blocked/working/done/idle).
# Usage: agent-fleet
function agent-fleet
    if not __herdr_running
        echo "herdr server is not running. Start it with: herdr"
        return 1
    end
    herdr agent list
end
