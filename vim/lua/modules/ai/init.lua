-- AIツール（Claude/Codex）の herdr 統合モジュール
-- 公開APIとコマンド登録を提供
--
-- ペインIDの台帳は持たない。herdr の `agent list` が唯一の台帳。

local herdr = require("modules.ai.herdr")
local agent = require("modules.ai.agent")
local buffer = require("modules.ai.buffer")
local output = require("modules.ai.output")
local fleet = require("modules.ai.fleet")

local M = {}

-- git のトップレベル。取れなければ cwd。
-- @return string
local function project_root()
  local out = vim.fn.systemlist({ "git", "rev-parse", "--show-toplevel" })
  if vim.v.shell_error == 0 and out[1] and out[1] ~= "" then
    return out[1]
  end
  return vim.uv.cwd()
end

-- 名前を指定してエージェント宛の入力バッファを開く
-- @param name string エージェント名
-- @param tool_name string 表示用のツール名
local function open_input_buffer_for(name, tool_name)
  buffer.create_input_buffer({
    name = string.format("[%s Input]", tool_name:gsub("^%l", string.upper)),
    filetype = "markdown",
    on_submit = function(content, bufnr)
      herdr.async(function()
        -- agent prompt は本文と Enter をアトミックに送る
        local _, err = herdr.await({ "agent", "prompt", name, content })
        if err then
          vim.notify(string.format("failed to send to '%s': %s", name, err), vim.log.levels.ERROR)
          return
        end
        buffer.close_buffer(bufnr)
      end)
    end,
    on_interrupt = function()
      herdr.async(function()
        local _, err = herdr.await({ "agent", "send-keys", name, herdr.translate_key("C-c") })
        if err then
          vim.notify("failed to interrupt: " .. err, vim.log.levels.ERROR)
        end
      end)
    end,
    on_send_shift_tab = function()
      herdr.async(function()
        local _, err = herdr.await({ "agent", "send-keys", name, herdr.translate_key("S-Tab") })
        if err then
          vim.notify("failed to send Shift+Tab: " .. err, vim.log.levels.ERROR)
        end
      end)
    end,
    on_load_output = function()
      output.open(name)
    end,
  })
end

-- ツールを開く（必要ならエージェントを起動してから入力バッファを出す）
-- @param tool_name string "claude" | "codex"
-- @param args string|nil コマンド引数（例: "-r"）
local function open_tool(tool_name, args)
  local cwd = project_root()
  local name = herdr.agent_name(cwd, tool_name)
  local argv = (args and args ~= "") and vim.split(args, "%s+") or nil

  agent.ensure({ name = name, cwd = cwd, kind = tool_name, args = argv }, function(resolved, err)
    if err then
      vim.notify(string.format("failed to start %s: %s", tool_name, err), vim.log.levels.ERROR)
      return
    end
    open_input_buffer_for(resolved, tool_name)
  end)
end

function M.open_claude(args)
  open_tool("claude", args)
end

function M.open_codex(args)
  open_tool("codex", args)
end

-- worktree を作ってエージェントを配置する
-- @param name string
-- @param branch string|nil
function M.add_worktree_agent(name, branch)
  local root = project_root()
  local repo = vim.fs.basename(root)
  local base = vim.env.WORKTREE_BASE
  if not base or base == "" then
    base = vim.uv.os_homedir() .. "/.worktrees"
  end
  -- 絶対パスを渡す。相対パスは nvim の cwd に解決され、worktree 内だと入れ子になる。
  local target = string.format("%s/%s-%s", base, repo, name)

  if vim.fn.isdirectory(target) == 0 then
    vim.fn.mkdir(base, "p")
    local head = branch
    if not head or head == "" then
      head = vim.fn.systemlist({ "git", "branch", "--show-current" })[1]
    end
    vim.fn.system({ "git", "worktree", "add", target, "-b", "worktree-" .. name, head })
    if vim.v.shell_error ~= 0 then
      vim.fn.system({ "git", "worktree", "add", target, head })
      if vim.v.shell_error ~= 0 then
        vim.notify("git worktree add failed for " .. target, vim.log.levels.ERROR)
        return
      end
    end
    vim.notify("Created worktree: " .. target, vim.log.levels.INFO)
  end

  local agent_name = herdr.agent_name(target, "claude")
  agent.ensure({ name = agent_name, cwd = target, kind = "claude" }, function(resolved, err)
    if err then
      vim.notify("failed to start agent: " .. err, vim.log.levels.ERROR)
      return
    end
    vim.notify(string.format("Agent '%s' started in %s", resolved, target), vim.log.levels.INFO)
  end)
end

function M.setup()
  vim.api.nvim_create_user_command("Claude", function(opts)
    M.open_claude(opts.args)
  end, { nargs = "*", desc = "Open Claude in a herdr agent with an input buffer" })

  vim.api.nvim_create_user_command("Codex", function(opts)
    M.open_codex(opts.args)
  end, { nargs = "*", desc = "Open Codex in a herdr agent with an input buffer" })

  vim.api.nvim_create_user_command("AgentFleet", function()
    fleet.pick(function(name)
      open_input_buffer_for(name, "agent")
    end)
  end, { desc = "Pick a herdr agent from the fleet" })

  vim.api.nvim_create_user_command("AgentOutput", function(opts)
    local name = opts.args
    if not name or name == "" then
      name = herdr.agent_name(project_root(), "claude")
    end
    output.open(name)
  end, { nargs = "?", desc = "Load a herdr agent's output into a buffer" })

  vim.api.nvim_create_user_command("AgentAdd", function(opts)
    local parts = vim.split(opts.args, "%s+")
    if not parts[1] or parts[1] == "" then
      vim.notify("Usage: AgentAdd <name> [branch]", vim.log.levels.ERROR)
      return
    end
    M.add_worktree_agent(parts[1], parts[2])
  end, { nargs = "+", desc = "Create a worktree and start a herdr agent in it" })

  vim.keymap.set("n", "<leader>ac", "<Cmd>Claude<CR>",
    { noremap = true, silent = true, desc = "Open Claude" })
  vim.keymap.set("n", "<leader>ar", "<Cmd>Claude -r<CR>",
    { noremap = true, silent = true, desc = "Open Claude with -r" })
  vim.keymap.set("n", "<leader>aC", "<Cmd>Claude -c<CR>",
    { noremap = true, silent = true, desc = "Open Claude with -c" })
  vim.keymap.set("n", "<leader>af", "<Cmd>AgentFleet<CR>",
    { noremap = true, silent = true, desc = "Pick a herdr agent" })

  vim.keymap.set("n", "<leader>xx", "<Cmd>Codex<CR>",
    { noremap = true, silent = true, desc = "Open Codex" })
  vim.keymap.set("n", "<leader>xr", "<Cmd>Codex resume<CR>",
    { noremap = true, silent = true, desc = "Open Codex resume" })
  vim.keymap.set("n", "<leader>xc", "<Cmd>Codex resume --last<CR>",
    { noremap = true, silent = true, desc = "Open Codex resume --last" })
end

return M
