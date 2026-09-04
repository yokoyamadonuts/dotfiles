local here = debug.getinfo(1, "S").source:sub(2):match("(.*)/")
local t = dofile(here .. "/../helpers.lua")
local herdr = require("modules.ai.herdr")
local agent = require("modules.ai.agent")

herdr.bin = here .. "/../support/fake-herdr"

-- shell_is_idle は純粋関数
t.eq(agent.shell_is_idle({
  result = { process_info = { foreground_processes = { { pid = 2 } }, shell_pid = 2 } },
}), true, "shell alone in foreground")

t.eq(agent.shell_is_idle({
  result = { process_info = {
    foreground_processes = { { pid = 1 }, { pid = 2 } }, shell_pid = 2 } },
}), false, "startup chain still running")

t.eq(agent.shell_is_idle({
  result = { process_info = { foreground_processes = { { pid = 7 } }, shell_pid = 2 } },
}), false, "single foreground process that is not the shell")

t.eq(agent.shell_is_idle(nil), false, "nil is not idle")

-- reuse_decision も純粋関数
t.eq(agent.reuse_decision(nil, "/tmp"), "create", "no existing agent -> create")
t.eq(agent.reuse_decision({ name = "a", cwd = "/tmp" }, "/tmp"), "reuse", "same cwd -> reuse")
t.eq(agent.reuse_decision({ name = "a", cwd = "/other" }, "/tmp"), "mismatch",
  "same name in a different cwd -> mismatch")

-- ensure: 既存のエージェント（スタブの agent list は "demo" を /tmp で返す）
local done, name, err = false, nil, nil
agent.ensure({ name = "demo", cwd = "/tmp", kind = "claude" }, function(n, e)
  name, err, done = n, e, true
end)
vim.wait(5000, function() return done end, 20)
t.eq(err, nil, "existing agent is not an error")
t.eq(name, "demo", "existing agent reused")

-- ensure: 新規作成（tab create -> process-info -> agent start）
done, name, err = false, nil, nil
agent.ensure({ name = "fresh", cwd = "/tmp", kind = "claude" }, function(n, e)
  name, err, done = n, e, true
end)
vim.wait(5000, function() return done end, 20)
t.eq(err, nil, "creation succeeded")
t.eq(name, "fresh", "new agent name returned")

-- ensure: agent start が失敗したらタブを畳んでエラーを返す
vim.env.STUB_START_FAILS = "1"
done, name, err = false, nil, nil
agent.ensure({ name = "doomed", cwd = "/tmp", kind = "claude" }, function(n, e)
  name, err, done = n, e, true
end)
vim.wait(5000, function() return done end, 20)
vim.env.STUB_START_FAILS = nil
t.eq(name, nil, "failed start returns no name")
t.eq(err, "pane is not an available shell", "start error surfaced")

local fleet = require("modules.ai.fleet")
local sorted = fleet.sort_agents({
  { name = "c", agent_status = "idle" },
  { name = "a", agent_status = "blocked" },
  { name = "b", agent_status = "working" },
  { name = "d", agent_status = "idle" },
})
t.eq(vim.tbl_map(function(a) return a.name end, sorted), { "a", "b", "c", "d" },
  "blocked first, then working, then idle by name")

t.finish()
