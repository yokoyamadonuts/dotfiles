-- エージェントの出力を scratch バッファに取り込む。
-- herdr にスクロールコマンドが無いため、tmux 版の遠隔スクロールの代替。

local herdr = require("modules.ai.herdr")

local M = {}

local DEFAULT_LINES = 500

-- @param name string エージェント名
-- @param opts table|nil {lines=number, split="split"|"vsplit"}
function M.open(name, opts)
  opts = opts or {}
  local lines = opts.lines or DEFAULT_LINES
  local split = opts.split or "split"

  herdr.async(function()
    -- read は生テキストを返す（0.8.0）
    local text, err = herdr.await({
      "agent", "read", name,
      "--source", "recent-unwrapped",
      "--lines", tostring(lines),
    }, { raw = true })

    if err then
      vim.notify(string.format("failed to read agent '%s': %s", name, err), vim.log.levels.ERROR)
      return
    end

    local bufnr = vim.api.nvim_create_buf(false, true)
    vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, vim.split(text or "", "\n", { plain = true }))
    vim.bo[bufnr].modifiable = false
    vim.bo[bufnr].bufhidden = "wipe"
    vim.bo[bufnr].filetype = "markdown"
    vim.api.nvim_buf_set_name(bufnr, string.format("[%s output]", name))

    vim.cmd(split)
    vim.api.nvim_win_set_buf(0, bufnr)
  end)
end

return M
