local here = debug.getinfo(1, "S").source:sub(2):match("(.*)/")
local t = dofile(here .. "/../helpers.lua")
local herdr = require("modules.ai.herdr")

-- agent_name: herdr の [a-z][a-z0-9_-]{0,31} に収める
t.eq(herdr.agent_name("/Users/x/dev/dotfiles", "claude"), "dotfiles-claude", "basic")
t.eq(herdr.agent_name("/Users/x/.worktrees/dotfiles-feature-x", "claude"),
  "dotfiles-feature-x-claude", "worktree name")
t.eq(herdr.agent_name("/Users/x/dev/dotfiles/", "codex"), "dotfiles-codex", "trailing slash")
t.eq(herdr.agent_name("/Users/x/Foo.Bar", "claude"), "foo-bar-claude", "illegal chars")
t.eq(herdr.agent_name("/Users/x/123", "claude"), "agent-claude", "must start with a letter")
t.eq(#herdr.agent_name("/x/" .. string.rep("a", 60), "claude"), 32, "truncated to 32")
t.eq(herdr.agent_name("/x/" .. string.rep("a", 60), "claude"):sub(-7), "-claude", "suffix kept")

-- translate_key: tmux 語彙 -> herdr 語彙
t.eq(herdr.translate_key("S-Tab"), "shift+tab", "shift tab")
t.eq(herdr.translate_key("C-c"), "ctrl+c", "ctrl c")
t.eq(herdr.translate_key("Enter"), "enter", "enter")
t.eq(herdr.translate_key("shift+tab"), "shift+tab", "already herdr vocabulary")

t.finish()
