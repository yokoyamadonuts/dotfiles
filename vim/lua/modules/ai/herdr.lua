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

-- vim.system の結果を (値, エラー) に変換する純粋関数。
-- herdr はサーバエラーを「終了コード1 + stdout の JSON」で返す。
-- @param res table {code=number, stdout=string, stderr=string}
-- @param raw boolean|nil true なら stdout をそのまま返す（read 用）
-- @return any|nil, string|nil
function M.parse(res, raw)
  local out = res.stdout or ""

  local decoded
  local ok, d = pcall(vim.json.decode, out)
  if ok then
    decoded = d
  end

  -- herdr のエラーは終了コードより先に見る（メッセージが具体的なため）
  if type(decoded) == "table" and decoded.error then
    return nil, decoded.error.message or decoded.error.code or "unknown herdr error"
  end

  if res.code ~= 0 then
    local stderr = vim.trim(res.stderr or "")
    -- サーバ未起動時、CLI は生の Rust エラーを出す。そのまま見せない。
    if stderr:find("NotFound", 1, true) or stderr:find("No such file or directory", 1, true) then
      return nil, "herdr server is not running. Start it with: herdr"
    end
    if stderr ~= "" then
      return nil, stderr
    end
    local text = vim.trim(out)
    if text ~= "" then
      return nil, text
    end
    return nil, string.format("herdr exited with code %d", res.code)
  end

  if raw then
    return out, nil
  end

  if decoded == nil then
    return nil, "herdr returned unparseable output: " .. vim.trim(out)
  end

  return decoded, nil
end

return M
