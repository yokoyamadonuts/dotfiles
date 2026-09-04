-- herdr CLI の薄いラッパー。nvim の UI API を呼ばず、エラーは戻り値で返す。
-- 状態を持たない（M.bin はテスト用の差し替え口）。

local M = {}

-- テストからスタブへ差し替えられるようにする
M.bin = "herdr"

-- tmux のキー語彙 -> herdr のキー語彙。
-- herdr は "S-Tab" を unsupported key として拒否する。
local KEY_MAP = {
  ["S-Tab"] = "shift+tab",
  ["C-c"] = "ctrl+c",
  ["C-d"] = "ctrl+d",
  ["Enter"] = "enter",
  ["Escape"] = "esc",
  ["Esc"] = "esc",
}

-- @param key string tmux 式または herdr 式のキー名
-- @return string herdr 式のキー名
function M.translate_key(key)
  return KEY_MAP[key] or key
end

-- パスと種別から herdr の制約に合うエージェント名を作る。
-- 制約: [a-z][a-z0-9_-]{0,31}
-- @param path string ディレクトリパス
-- @param kind string "claude" | "codex" など
-- @return string
function M.agent_name(path, kind)
  local p = (path or ""):gsub("/+$", "")
  local base = vim.fs.basename(p) or ""
  base = base:lower()
  base = base:gsub("[^a-z0-9_-]", "-")
  base = base:gsub("^[^a-z]+", "")
  base = base:gsub("%-+$", "")
  if base == "" then
    base = "agent"
  end

  local suffix = "-" .. kind
  local max = 32 - #suffix
  if #base > max then
    base = base:sub(1, max):gsub("%-+$", "")
  end

  return base .. suffix
end

return M
