-- create zenn article
vim.api.nvim_create_user_command('ZennCreateArticle',
  function(opts)
    local date = vim.fn.strftime('%Y-%m-%d')
    local slug = date .. '-' .. opts.args
    os.execute('deno run -A  npm:zenn-cli@latest new:article --emoji 🦍 --slug ' .. slug)
    vim.cmd('edit ' .. string.format('articles/%s.md', slug))
  end, { nargs = 1 })

vim.api.nvim_create_user_command("TerminalExec", function(opts)
  local cmd = opts.args
  vim.cmd("botright 20new")
  local buf = vim.api.nvim_get_current_buf()
  vim.fn.jobstart(
    { "zsh", "-i", "-c", cmd },
    {
      stdout_buffered = true,
      stderr_buffered = true,
      pty = true,
      term = true,
      on_exit = function(_, code, _)
        if code == 0 then
          vim.schedule(function()
            if vim.api.nvim_buf_is_valid(buf) then
              vim.api.nvim_buf_delete(buf, { force = true })
            end
          end)
        end
      end,
    }
  )
end, { nargs = "+", complete = "shellcmd" })

vim.api.nvim_create_user_command("Ghost", function()
  vim.cmd("TerminalExec ghost")
end, {})

-- Restart Neovim with session preservation
vim.api.nvim_create_user_command("Restart", function()
  -- 特殊バッファ（LSPポップアップなど）を削除
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    local buftype = vim.api.nvim_get_option_value('buftype', { buf = buf })
    if buftype ~= '' then
      pcall(vim.api.nvim_buf_delete, buf, { force = true })
    end
  end

  -- セッションファイルのパスを決定
  local has_session = vim.v.this_session ~= nil and vim.v.this_session ~= ''
  local session = has_session and vim.v.this_session
    or vim.fs.joinpath(tostring(vim.fn.stdpath('state')), 'restart_session.vim')

  -- セッションを保存
  vim.cmd('mksession! ' .. vim.fn.fnameescape(session))

  -- 一時セッションの場合、起動後に削除するスクリプトを作成
  if not has_session then
    local cleanup_script = session:gsub('%.vim$', 'x.vim')
    local f = io.open(cleanup_script, 'w')
    if f then
      f:write(string.format('call delete(%q)\n', session))
      f:write(string.format('call delete(%q)\n', cleanup_script))
      f:close()
    end
  end

  -- 再起動
  vim.cmd('restart')
end, { desc = 'Restart Neovim with session preservation' })

-- Abbreviation for :Restart
vim.cmd('cabbrev res Restart')
vim.cmd('cabbrev restart Restart')
