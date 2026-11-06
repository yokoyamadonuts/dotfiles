# Claude Code: second account (~/.claude-sub, set up by claude/install.sh)
# projects/ is shared with ~/.claude, so memory and --resume work across accounts.
# Usage: c2 [claude args...]

function c2 --wraps claude
    CLAUDE_CONFIG_DIR=$HOME/.claude-sub claude $argv
end
