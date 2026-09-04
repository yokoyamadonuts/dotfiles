local here = debug.getinfo(1, "S").source:sub(2):match("(.*)/")
local t = dofile(here .. "/../helpers.lua")
local herdr = require("modules.ai.herdr")

herdr.bin = here .. "/../support/fake-herdr"

local finished = false
local got_name, got_err, slept

herdr.async(function()
  local list, err = herdr.await({ "agent", "list" })
  got_name = list and list.result.agents[1].name
  got_err = err

  local t0 = vim.uv.now()
  herdr.sleep(50)
  slept = vim.uv.now() - t0 >= 40

  local _, boom = herdr.await({ "agent", "boom" })
  got_err = boom

  finished = true
end)

-- コルーチンが解決するまでイベントループを回す
vim.wait(5000, function()
  return finished
end, 20)

t.eq(finished, true, "async chain finished")
t.eq(got_name, "demo", "await decoded the payload")
t.eq(slept, true, "sleep suspended without blocking")
t.eq(got_err, "stub failed on purpose", "await surfaced the herdr error")

t.finish()
