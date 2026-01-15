local claudecode = {
  'coder/claudecode.nvim',
  dependencies = {
    'folke/snacks.nvim',
  },
  config = true,
  keys = {
    { '<leader>cc', '<cmd>ClaudeCode<cr>', desc = 'Toggle Claude Code' },
    { '<leader>cf', '<cmd>ClaudeCodeFocus<cr>', desc = 'Focus Claude Code' },
  },
}

return claudecode
