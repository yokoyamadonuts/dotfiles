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

-- parse: 成功時は decode 済みテーブル
local ok_res = {
  code = 0,
  stdout = '{"id":"cli:agent:list","result":{"agents":[{"name":"demo"}]}}',
  stderr = "",
}
local v, e = herdr.parse(ok_res)
t.eq(e, nil, "success has no error")
t.eq(v.result.agents[1].name, "demo", "decoded payload")

-- parse: herdr のサーバエラーは exit 1 + stdout の JSON
local err_res = {
  code = 1,
  stdout = '{"error":{"code":"agent_pane_busy","message":"pane is not an available shell"}}',
  stderr = "",
}
local v2, e2 = herdr.parse(err_res)
t.eq(v2, nil, "error yields no value")
t.eq(e2, "pane is not an available shell", "error message surfaced")

-- parse: raw=true は生テキストをそのまま返す（read 用）
local raw_res = { code = 0, stdout = "line one\nline two\n", stderr = "" }
local v3, e3 = herdr.parse(raw_res, true)
t.eq(e3, nil, "raw has no error")
t.eq(v3, "line one\nline two\n", "raw text passthrough")

-- parse: JSON でも何でもない出力で exit != 0
local bad = { code = 2, stdout = "unsupported key S-Tab", stderr = "" }
local v4, e4 = herdr.parse(bad)
t.eq(v4, nil, "bad yields no value")
t.eq(e4, "unsupported key S-Tab", "falls back to stdout text")

-- parse: exit 0 だが JSON として壊れている
local unparseable = { code = 0, stdout = "not json at all", stderr = "" }
local v5, e5 = herdr.parse(unparseable)
t.eq(v5, nil, "unparseable yields no value")
t.eq(e5, "herdr returned unparseable output: not json at all", "unparseable message")

-- parse: サーバ停止時。CLI は生の Rust エラーを stderr に出すので、
-- そのまま見せずに起動方法を案内する。
local down = {
  code = 1,
  stdout = "",
  stderr = 'Error: Os { code: 2, kind: NotFound, message: "No such file or directory" }',
}
local v6, e6 = herdr.parse(down)
t.eq(v6, nil, "server down yields no value")
t.eq(e6, "herdr server is not running. Start it with: herdr", "friendly server-down message")

t.finish()
