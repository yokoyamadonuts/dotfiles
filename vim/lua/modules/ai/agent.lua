-- エージェントの生成と解決。:Claude も :AgentAdd も ensure() を通る。
-- 違いは cwd と名前だけ。

local herdr = require("modules.ai.herdr")

local M = {}

-- 生成処理中のガード。:Claude を素早く2回叩いてもタブは1つ。
-- これは「今生成中か」という一時状態であり、恒久的な台帳は herdr が持つ。
local in_flight = {}

local SETTLE_ATTEMPTS = 50
local SETTLE_INTERVAL_MS = 200
local START_TIMEOUT_MS = "60000"

-- pane process-info の応答を見て、シェルが前面に単独でいるかを判定する純粋関数。
-- tab create 直後は起動チェーン（readlink, bash, bash, bash, fish）が前面にいて
-- agent start が agent_pane_busy を返す。
-- @param info table|nil pane process-info の decode 済み応答
-- @return boolean
function M.shell_is_idle(info)
  local pi = info and info.result and info.result.process_info
  if not pi then
    return false
  end
  local fg = pi.foreground_processes or {}
  return #fg == 1 and fg[1].pid == pi.shell_pid
end

-- 既存エージェントを再利用してよいかの判定（純粋関数）。
-- 同名が別 cwd にいる場合は勝手に使わず呼び出し元に知らせる。
-- @param existing table|nil agent list で見つかったエージェント
-- @param cwd string 期待する作業ディレクトリ
-- @return string "create" | "reuse" | "mismatch"
function M.reuse_decision(existing, cwd)
  if not existing then
    return "create"
  end
  if existing.cwd ~= cwd then
    return "mismatch"
  end
  return "reuse"
end

-- 名前で生きているエージェントを探す。async の中でのみ呼べる。
-- @param name string
-- @return table|nil, string|nil
local function find(name)
  local list, err = herdr.await({ "agent", "list" })
  if err then
    return nil, err
  end
  for _, a in ipairs(list.result.agents or {}) do
    if a.name == name then
      return a, nil
    end
  end
  return nil, nil
end

-- herdr ペイン内なら自分の workspace ID を返す。外なら nil。
-- 省略するとフォーカス中の workspace が使われ、それは別クライアントのものかもしれない。
-- @return string|nil
local function current_workspace()
  if vim.env.HERDR_ENV ~= "1" then
    return nil
  end
  local cur = herdr.await({ "pane", "current", "--current" })
  return cur and cur.result and cur.result.pane and cur.result.pane.workspace_id or nil
end

-- 名前のエージェントを用意する。既にいれば再利用、いなければタブを作って起動する。
-- @param opts table {name=string, cwd=string, kind=string, args=table|nil}
-- @param cb function(name|nil, err|nil)
function M.ensure(opts, cb)
  local name = opts.name

  if in_flight[name] then
    cb(nil, string.format("agent '%s' is already starting", name))
    return
  end
  in_flight[name] = true

  herdr.async(function()
    local function done(n, e)
      in_flight[name] = nil
      cb(n, e)
    end

    local existing, list_err = find(name)
    if list_err then
      return done(nil, list_err)
    end

    local decision = M.reuse_decision(existing, opts.cwd)
    if decision == "reuse" then
      return done(name, nil)
    end
    if decision == "mismatch" then
      return done(nil, string.format(
        "agent '%s' already exists in %s (wanted %s). Focus it with :AgentFleet, or pick another name.",
        name, existing.cwd or "?", opts.cwd))
    end

    local tab_args = { "tab", "create", "--cwd", opts.cwd, "--label", name, "--no-focus" }
    local ws = current_workspace()
    if ws then
      vim.list_extend(tab_args, { "--workspace", ws })
    end

    local created, tab_err = herdr.await(tab_args)
    if tab_err then
      return done(nil, tab_err)
    end
    local pane = created.result.root_pane.pane_id
    local tab = created.result.tab.tab_id

    local settled = false
    for _ = 1, SETTLE_ATTEMPTS do
      local info = herdr.await({ "pane", "process-info", "--pane", pane })
      if M.shell_is_idle(info) then
        settled = true
        break
      end
      herdr.sleep(SETTLE_INTERVAL_MS)
    end

    if not settled then
      herdr.await({ "tab", "close", tab })
      return done(nil, string.format(
        "pane %s never settled to an idle shell; closed tab %s", pane, tab))
    end

    local start_args = {
      "agent", "start", name,
      "--kind", opts.kind,
      "--pane", pane,
      "--timeout", START_TIMEOUT_MS,
    }
    if opts.args and #opts.args > 0 then
      table.insert(start_args, "--")
      vim.list_extend(start_args, opts.args)
    end

    local _, start_err = herdr.await(start_args)
    if start_err then
      -- 作ったタブを放置しない
      herdr.await({ "tab", "close", tab })
      return done(nil, start_err)
    end

    -- 新しい worktree での初回起動は信頼ダイアログを出すことがある。
    -- herdr 自身の分類だけを見る（画面スクレイピングはしない）。
    -- 自動応答は絶対にしない: ユーザーに渡す。
    -- 形状が検証済みの agent list を再利用する（agent get の応答形状は未検証）。
    local started = find(name)
    local status = started and started.agent_status
    if status == "blocked" or status == "unknown" then
      vim.notify(string.format(
        "agent '%s' is %s right after start (pane %s). It may be waiting on a trust dialog — answer it yourself in that pane.",
        name, status, pane), vim.log.levels.WARN)
    end

    done(name, nil)
  end)
end

return M
