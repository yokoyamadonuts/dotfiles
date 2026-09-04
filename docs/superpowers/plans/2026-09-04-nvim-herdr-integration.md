# nvim × herdr 統合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `vim/lua/modules/ai/` の tmux バックエンドを herdr に置き換え、nvim から名前付きエージェントの生成・送信・出力取得・艦隊操作をできるようにする。

**Architecture:** `herdr.lua` を「nvim UI に触れない非同期 CLI ラッパー」として置き、その上に `agent.lua`（生成/解決）、`output.lua`・`fleet.lua`・`buffer.lua`（UI）を載せる。`init.lua` はコマンドとキーマップだけを持つ。ペイン ID の台帳は herdr の `agent list` に委譲して nvim 側から削除する。

**Tech Stack:** Lua / nvim 0.11.5 (`vim.system`, `vim.json`, coroutine) / herdr 0.8.0 CLI / telescope.nvim

設計書: [docs/superpowers/specs/2026-09-04-nvim-herdr-integration-design.md](../specs/2026-09-04-nvim-herdr-integration-design.md)

## Global Constraints

- herdr のエージェント名は `[a-z][a-z0-9_-]{0,31}`。違反はサーバが `invalid_agent_name` で拒否する。
- herdr のサーバエラーは**終了コード1で stdout に JSON**（`{"error":{"code":...,"message":...}}`）。
- `herdr agent read` / `pane read` は 0.8.0 では**生テキスト**を返す（JSON ではない）。
- herdr のキー語彙は `shift+tab` / `ctrl+c` / `esc` / `enter`。tmux 式の `S-Tab` は `unsupported key S-Tab` で拒否される。
- `agent start` は既定30秒ブロックする。`tab create` 直後のペインは `agent_pane_busy` になる。**同期呼び出し（`vim.fn.system`）を使ってはいけない。**
- シェル待ちの判定: `foreground_processes` がちょうど1件で、その `pid` が `shell_pid` と一致すること。
- `herdr.lua` は `vim.notify` を含む nvim UI API を呼ばない。エラーは戻り値で返す。
- テストは `nvim -l <spec>` で実行する。プラグインはロードされないため、spec から telescope 等に依存してはならない。

---

### Task 1: テスト基盤と純粋関数（名前導出・キー変換）

**Files:**
- Create: `vim/tests/helpers.lua`
- Create: `vim/tests/run.sh`
- Create: `vim/tests/ai/herdr_spec.lua`
- Create: `vim/lua/modules/ai/herdr.lua`

**Interfaces:**
- Consumes: なし
- Produces: `herdr.bin`（文字列、既定 `"herdr"`）、`herdr.agent_name(path, kind) -> string`、`herdr.translate_key(key) -> string`

- [ ] **Step 1: テストヘルパを作る**

`vim/tests/helpers.lua`:

```lua
-- 最小のアサーションヘルパ。nvim -l から dofile して使う。
--
-- nvim の require は package.path ではなく runtimepath を探す。~/.config/nvim は
-- メインチェックアウトへの symlink なので、何もしないと worktree で走らせても
-- メイン側のモジュールを読んでしまう。spec が置かれている checkout の vim/ を
-- runtimepath の先頭に差し込み、常に「隣にあるコード」をテストする。
local here = debug.getinfo(1, "S").source:sub(2):match("(.*)/")
vim.opt.runtimepath:prepend(here .. "/../../vim")

local M = { total = 0, failures = 0 }

function M.eq(actual, expected, label)
  M.total = M.total + 1
  if vim.deep_equal(actual, expected) then
    print(string.format("  ok   %s", label))
  else
    M.failures = M.failures + 1
    print(string.format("  FAIL %s\n       expected: %s\n       actual:   %s",
      label, vim.inspect(expected), vim.inspect(actual)))
  end
end

function M.finish()
  print(string.format("%d/%d passed", M.total - M.failures, M.total))
  if M.failures > 0 then
    os.exit(1)
  end
end

return M
```

- [ ] **Step 2: ランナーを作る**

`vim/tests/run.sh`:

```bash
#!/bin/bash
# 全 spec を nvim -l で実行する。1つでも落ちたら非ゼロで終了。
cd "$(dirname "$0")" || exit 1
fail=0
for spec in ai/*_spec.lua; do
  echo "== $spec"
  nvim -l "$spec" || fail=1
done
exit $fail
```

実行権限を付ける:

```bash
chmod +x vim/tests/run.sh
```

- [ ] **Step 3: 失敗するテストを書く**

`vim/tests/ai/herdr_spec.lua`:

```lua
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

t.finish()
```

- [ ] **Step 4: テストが落ちることを確認する**

```bash
cd /Volumes/Partition_Case_Sensitive/Workspace/dotfiles && nvim -l vim/tests/ai/herdr_spec.lua
```

Expected: `module 'modules.ai.herdr' not found` で失敗。

- [ ] **Step 5: 最小実装を書く**

`vim/lua/modules/ai/herdr.lua`:

```lua
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
```

- [ ] **Step 6: テストが通ることを確認する**

```bash
cd /Volumes/Partition_Case_Sensitive/Workspace/dotfiles && nvim -l vim/tests/ai/herdr_spec.lua
```

Expected: `11/11 passed`

- [ ] **Step 7: コミット**

```bash
git add vim/tests/helpers.lua vim/tests/run.sh vim/tests/ai/herdr_spec.lua vim/lua/modules/ai/herdr.lua
git commit -m "feat(nvim): add herdr module skeleton with name and key helpers"
```

---

### Task 2: herdr CLI 応答のパース

**Files:**
- Modify: `vim/lua/modules/ai/herdr.lua`
- Modify: `vim/tests/ai/herdr_spec.lua`

**Interfaces:**
- Consumes: Task 1 の `herdr.bin`
- Produces: `herdr.parse(res, raw) -> value|nil, err|nil`（`res` は `{code=number, stdout=string, stderr=string}`）

- [ ] **Step 1: 失敗するテストを追加する**

`vim/tests/ai/herdr_spec.lua` の `t.finish()` の**直前**に追加:

```lua
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
```

- [ ] **Step 2: テストが落ちることを確認する**

```bash
cd /Volumes/Partition_Case_Sensitive/Workspace/dotfiles && nvim -l vim/tests/ai/herdr_spec.lua
```

Expected: `attempt to call field 'parse' (a nil value)`

- [ ] **Step 3: 実装する**

`vim/lua/modules/ai/herdr.lua` の `return M` の**直前**に追加:

```lua
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
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
cd /Volumes/Partition_Case_Sensitive/Workspace/dotfiles && nvim -l vim/tests/ai/herdr_spec.lua
```

Expected: `23/23 passed`

- [ ] **Step 5: コミット**

```bash
git add vim/lua/modules/ai/herdr.lua vim/tests/ai/herdr_spec.lua
git commit -m "feat(nvim): parse herdr CLI responses into value or error"
```

---

### Task 3: 非同期実行（コルーチン + vim.system）

**Files:**
- Modify: `vim/lua/modules/ai/herdr.lua`
- Create: `vim/tests/support/fake-herdr`
- Create: `vim/tests/ai/async_spec.lua`

**Interfaces:**
- Consumes: Task 2 の `herdr.parse`
- Produces: `herdr.async(fn)`、`herdr.await(args, opts) -> value|nil, err|nil`、`herdr.sleep(ms)`

`await` と `sleep` は `async` に渡した関数の中でのみ呼べる。

- [ ] **Step 1: スタブバイナリを作る**

`vim/tests/support/fake-herdr`:

```sh
#!/bin/sh
# テスト用の herdr スタブ。引数に応じて定型 JSON を返す。
case "$1 $2" in
  "agent list")
    echo '{"id":"cli:agent:list","result":{"agents":[{"name":"demo","agent_status":"idle","cwd":"/tmp","pane_id":"w1:p1"}],"type":"agent_list"}}'
    exit 0
    ;;
  "agent boom")
    echo '{"error":{"code":"stub_boom","message":"stub failed on purpose"}}'
    exit 1
    ;;
esac
echo '{"error":{"code":"stub_unhandled","message":"stub does not handle: '"$*"'"}}'
exit 1
```

```bash
chmod +x vim/tests/support/fake-herdr
```

- [ ] **Step 2: 失敗するテストを書く**

`vim/tests/ai/async_spec.lua`:

```lua
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
```

- [ ] **Step 3: テストが落ちることを確認する**

```bash
cd /Volumes/Partition_Case_Sensitive/Workspace/dotfiles && nvim -l vim/tests/ai/async_spec.lua
```

Expected: `attempt to call field 'async' (a nil value)`

- [ ] **Step 4: 実装する**

`vim/lua/modules/ai/herdr.lua` の `return M` の**直前**に追加:

```lua
-- コルーチンごとの resume 関数。コルーチンが GC されたら一緒に消える。
local resumers = setmetatable({}, { __mode = "k" })

-- fn をコルーチンとして走らせる。fn の中では await / sleep が使える。
-- @param fn function
function M.async(fn)
  local co = coroutine.create(fn)
  local function step(...)
    local ok, err = coroutine.resume(co, ...)
    if not ok then
      local message = tostring(err)
      vim.schedule(function()
        vim.notify("herdr async error: " .. message, vim.log.levels.ERROR)
      end)
    end
  end
  resumers[co] = step
  step()
end

local function current_resumer(caller)
  local co = coroutine.running()
  local resume = co and resumers[co]
  if not resume then
    error(caller .. " must be called inside herdr.async", 2)
  end
  return resume
end

-- herdr コマンドを実行し、終わるまでコルーチンを中断する。nvim はブロックしない。
-- @param args table コマンド引数の配列（"herdr" は含めない）
-- @param opts table|nil {raw=boolean}
-- @return any|nil, string|nil
function M.await(args, opts)
  local resume = current_resumer("herdr.await")
  local cmd = { M.bin }
  vim.list_extend(cmd, args)

  vim.system(cmd, { text = true }, function(res)
    -- vim.system のコールバックは fast event context なので schedule する
    vim.schedule(function()
      resume(res)
    end)
  end)

  local res = coroutine.yield()
  return M.parse(res, opts and opts.raw)
end

-- ms ミリ秒だけコルーチンを中断する（シェル待ちの poll 用）。
-- @param ms number
function M.sleep(ms)
  local resume = current_resumer("herdr.sleep")
  vim.defer_fn(function()
    resume()
  end, ms)
  coroutine.yield()
end
```

- [ ] **Step 5: テストが通ることを確認する**

```bash
cd /Volumes/Partition_Case_Sensitive/Workspace/dotfiles && nvim -l vim/tests/ai/async_spec.lua
```

Expected: `4/4 passed`

- [ ] **Step 6: コミット**

```bash
git add vim/lua/modules/ai/herdr.lua vim/tests/support/fake-herdr vim/tests/ai/async_spec.lua
git commit -m "feat(nvim): run herdr commands asynchronously via coroutines"
```

---

### Task 4: エージェントの生成と解決

**Files:**
- Create: `vim/lua/modules/ai/agent.lua`
- Create: `vim/tests/ai/agent_spec.lua`
- Modify: `vim/tests/support/fake-herdr`

**Interfaces:**
- Consumes: Task 3 の `herdr.async` / `herdr.await` / `herdr.sleep`
- Produces: `agent.shell_is_idle(info) -> boolean`、`agent.ensure(opts, cb)`
  - `opts` = `{name=string, cwd=string, kind=string, args=table|nil}`
  - `cb(name|nil, err|nil)`

- [ ] **Step 1: スタブに生成系のケースを足す**

`vim/tests/support/fake-herdr` の `case ... esac` に、`"agent boom"` の直後へ以下を追加:

```sh
  "tab create")
    echo '{"id":"cli:tab:create","result":{"root_pane":{"pane_id":"w1:p9"},"tab":{"tab_id":"w1:t9"},"type":"tab_created"}}'
    exit 0
    ;;
  "pane process-info")
    # STUB_BUSY_ONCE が立っていれば初回だけ busy を返す
    if [ -n "$STUB_BUSY_FILE" ] && [ ! -f "$STUB_BUSY_FILE" ]; then
      touch "$STUB_BUSY_FILE"
      echo '{"result":{"process_info":{"foreground_processes":[{"pid":1},{"pid":2}],"shell_pid":2}}}'
      exit 0
    fi
    echo '{"result":{"process_info":{"foreground_processes":[{"pid":2}],"shell_pid":2}}}'
    exit 0
    ;;
  "agent start")
    if [ -n "$STUB_START_FAILS" ]; then
      echo '{"error":{"code":"agent_pane_busy","message":"pane is not an available shell"}}'
      exit 1
    fi
    echo '{"id":"cli:agent:start","result":{"agent":{"name":"'"$3"'"},"type":"agent_started"}}'
    exit 0
    ;;
  "tab close")
    echo '{"id":"cli:tab:close","result":{"type":"tab_closed"}}'
    exit 0
    ;;
```

- [ ] **Step 2: 失敗するテストを書く**

`vim/tests/ai/agent_spec.lua`:

```lua
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

-- ensure: 既存のエージェント（スタブの agent list は "demo" を返す）
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

t.finish()
```

- [ ] **Step 3: テストが落ちることを確認する**

```bash
cd /Volumes/Partition_Case_Sensitive/Workspace/dotfiles && nvim -l vim/tests/ai/agent_spec.lua
```

Expected: `module 'modules.ai.agent' not found`

- [ ] **Step 4: 実装する**

`vim/lua/modules/ai/agent.lua`:

```lua
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
```

- [ ] **Step 5: テストが通ることを確認する**

```bash
cd /Volumes/Partition_Case_Sensitive/Workspace/dotfiles && nvim -l vim/tests/ai/agent_spec.lua
```

Expected: `13/13 passed`

- [ ] **Step 6: コミット**

```bash
git add vim/lua/modules/ai/agent.lua vim/tests/ai/agent_spec.lua vim/tests/support/fake-herdr
git commit -m "feat(nvim): create and resolve herdr agents with a shell-settle wait"
```

---

### Task 5: 出力の取り込み

**Files:**
- Create: `vim/lua/modules/ai/output.lua`

**Interfaces:**
- Consumes: Task 3 の `herdr.async` / `herdr.await`
- Produces: `output.open(name, opts)` — `opts` = `{lines=number|nil, split=string|nil}`

- [ ] **Step 1: 実装する**

`herdr agent read` は 0.8.0 では生テキストを返すため `raw = true` で受ける。

`vim/lua/modules/ai/output.lua`:

```lua
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
```

- [ ] **Step 2: 構文チェック**

```bash
cd /Volumes/Partition_Case_Sensitive/Workspace/dotfiles && nvim -l -c 'lua require("modules.ai.output")' /dev/null 2>&1 || nvim --headless -c 'lua require("modules.ai.output"); print("loaded")' -c 'qa!' 2>&1 | tail -2
```

Expected: エラーが出ないこと（`loaded` が出るか、無出力で終了）

- [ ] **Step 3: コミット**

```bash
git add vim/lua/modules/ai/output.lua
git commit -m "feat(nvim): load herdr agent output into a scratch buffer"
```

---

### Task 6: 入力バッファのコールバック変更

**Files:**
- Modify: `vim/lua/modules/ai/buffer.lua`

**Interfaces:**
- Consumes: なし（純 UI）
- Produces: `buffer.create_input_buffer(config)` の config から `on_scroll_down` / `on_scroll_up` / `on_scroll_line_down` / `on_scroll_line_up` を削除し、`on_load_output` を追加

- [ ] **Step 1: スクロール4つのキーマップを削除する**

`vim/lua/modules/ai/buffer.lua` の以下4ブロックを丸ごと削除する（`<C-d>` / `<C-u>` / `<C-n>` / `<C-p>`）:

```lua
  -- <C-d>: tmuxペインを下にスクロール
  if config.on_scroll_down then
    ...
  end

  -- <C-u>: tmuxペインを上にスクロール
  if config.on_scroll_up then
    ...
  end

  -- <C-n>: tmuxペインを1行下にスクロール
  if config.on_scroll_line_down then
    ...
  end

  -- <C-p>: tmuxペインを1行上にスクロール
  if config.on_scroll_line_up then
    ...
  end
```

削除後、これら4キーは nvim 標準の挙動に戻る。

- [ ] **Step 2: `on_load_output` を追加する**

削除した位置に追加:

```lua
  -- <C-o>: エージェントの出力を取り込んで開く
  if config.on_load_output then
    vim.keymap.set("n", "<C-o>", function()
      config.on_load_output()
    end, vim.tbl_extend("force", opts, { desc = "Load agent output into a buffer" }))
  end
```

- [ ] **Step 3: `desc` から tmux 表記を消す**

`<C-x><C-x>` と `<S-Tab>` の `desc` を書き換える:

```lua
{ desc = "Interrupt the agent" }
```

```lua
{ desc = "Send Shift+Tab to the agent" }
```

- [ ] **Step 4: ドキュメントコメントを更新する**

`create_input_buffer` の上のコメントブロックで、`on_scroll_*` 4行を削除し以下を追加:

```lua
--   - on_load_output: function() 出力取り込み時のコールバック
```

- [ ] **Step 5: 読み込めることを確認する**

```bash
cd /Volumes/Partition_Case_Sensitive/Workspace/dotfiles && nvim --headless -c 'lua require("modules.ai.buffer"); print("loaded")' -c 'qa!' 2>&1 | tail -2
```

Expected: `loaded`

- [ ] **Step 6: コミット**

```bash
git add vim/lua/modules/ai/buffer.lua
git commit -m "refactor(nvim): replace input buffer scroll callbacks with output loading"
```

---

### Task 7: 艦隊ピッカー

**Files:**
- Create: `vim/lua/modules/ai/fleet.lua`

**Interfaces:**
- Consumes: Task 3 の `herdr.async` / `herdr.await`、Task 5 の `output.open`
- Produces: `fleet.pick(on_prompt)` — `on_prompt` は `function(name)`、`<C-p>` 選択時に呼ばれる

telescope は**関数の中で require する**。`nvim -l` ではプラグインがロードされないため、モジュール読み込み時に require するとテストが落ちる。

- [ ] **Step 1: 実装する**

`vim/lua/modules/ai/fleet.lua`:

```lua
-- herdr の艦隊を telescope で一覧し、フォーカス移動・出力取り込み・送信を行う。

local herdr = require("modules.ai.herdr")
local output = require("modules.ai.output")

local M = {}

-- 対応が要るものほど上に来る順序
local STATUS_ORDER = { blocked = 1, working = 2, unknown = 3, idle = 4, done = 5 }

-- @param agents table agent list の .result.agents
-- @return table 並べ替え済みの配列
function M.sort_agents(agents)
  local sorted = vim.deepcopy(agents or {})
  table.sort(sorted, function(a, b)
    local oa = STATUS_ORDER[a.agent_status] or 99
    local ob = STATUS_ORDER[b.agent_status] or 99
    if oa ~= ob then
      return oa < ob
    end
    return (a.name or "") < (b.name or "")
  end)
  return sorted
end

-- @param on_prompt function(name) <C-p> で呼ばれる
function M.pick(on_prompt)
  herdr.async(function()
    local list, err = herdr.await({ "agent", "list" })
    if err then
      vim.notify("failed to list herdr agents: " .. err, vim.log.levels.ERROR)
      return
    end

    local agents = M.sort_agents(list.result.agents)
    if #agents == 0 then
      vim.notify("no herdr agents are running", vim.log.levels.INFO)
      return
    end

    -- telescope はここで require する（nvim -l ではロードされないため）
    local pickers = require("telescope.pickers")
    local finders = require("telescope.finders")
    local conf = require("telescope.config").values
    local actions = require("telescope.actions")
    local action_state = require("telescope.actions.state")

    pickers.new({}, {
      prompt_title = "herdr agents",
      finder = finders.new_table({
        results = agents,
        entry_maker = function(a)
          local display = string.format("%-8s %-24s %s", a.agent_status or "?", a.name or "?", a.cwd or "")
          return { value = a, display = display, ordinal = display }
        end,
      }),
      sorter = conf.generic_sorter({}),
      attach_mappings = function(bufnr, map)
        actions.select_default:replace(function()
          local entry = action_state.get_selected_entry()
          actions.close(bufnr)
          if entry then
            herdr.async(function()
              local _, ferr = herdr.await({ "agent", "focus", entry.value.name })
              if ferr then
                vim.notify("failed to focus: " .. ferr, vim.log.levels.ERROR)
              end
            end)
          end
        end)

        map({ "i", "n" }, "<C-o>", function()
          local entry = action_state.get_selected_entry()
          actions.close(bufnr)
          if entry then
            output.open(entry.value.name)
          end
        end)

        map({ "i", "n" }, "<C-p>", function()
          local entry = action_state.get_selected_entry()
          actions.close(bufnr)
          if entry and on_prompt then
            on_prompt(entry.value.name)
          end
        end)

        return true
      end,
    }):find()
  end)
end

return M
```

- [ ] **Step 2: sort_agents をテストする**

`vim/tests/ai/agent_spec.lua` の `t.finish()` の**直前**に追加:

```lua
local fleet = require("modules.ai.fleet")
local sorted = fleet.sort_agents({
  { name = "c", agent_status = "idle" },
  { name = "a", agent_status = "blocked" },
  { name = "b", agent_status = "working" },
  { name = "d", agent_status = "idle" },
})
t.eq(vim.tbl_map(function(a) return a.name end, sorted), { "a", "b", "c", "d" },
  "blocked first, then working, then idle by name")
```

- [ ] **Step 3: テストが通ることを確認する**

```bash
cd /Volumes/Partition_Case_Sensitive/Workspace/dotfiles && nvim -l vim/tests/ai/agent_spec.lua
```

Expected: `14/14 passed`（telescope を require していないためロードできる）

- [ ] **Step 4: コミット**

```bash
git add vim/lua/modules/ai/fleet.lua vim/tests/ai/agent_spec.lua
git commit -m "feat(nvim): add a telescope picker over the herdr agent fleet"
```

---

### Task 8: init.lua の書き換えと tmux.lua の削除

**Files:**
- Modify: `vim/lua/modules/ai/init.lua`（全面書き換え）
- Delete: `vim/lua/modules/ai/tmux.lua`

**Interfaces:**
- Consumes: Task 1〜7 の全モジュール
- Produces: `:Claude` / `:Codex` / `:AgentFleet` / `:AgentOutput` / `:AgentAdd` と既存キーマップ

- [ ] **Step 1: init.lua を書き換える**

`vim/lua/modules/ai/init.lua` の中身を以下で置き換える:

```lua
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
```

- [ ] **Step 2: tmux.lua を削除する**

```bash
git rm vim/lua/modules/ai/tmux.lua
```

- [ ] **Step 3: 全モジュールが読み込めることを確認する**

`--cmd` は config 読み込みより前に走るので、そこで runtimepath を差し替える。
これをしないと `~/.config/nvim` 経由でメインチェックアウトの `init.lua` が読まれる。

```bash
cd "$(git rev-parse --show-toplevel)" && nvim --headless \
  --cmd "set runtimepath^=$(pwd)/vim" \
  -c 'lua require("modules.ai").setup(); print("setup ok")' -c 'qa!' 2>&1 | tail -3
```

Expected: `setup ok`

- [ ] **Step 4: tmux への参照が残っていないことを確認する**

```bash
cd /Volumes/Partition_Case_Sensitive/Workspace/dotfiles && grep -rn "tmux" vim/lua/modules/ai/ || echo "no tmux references remain"
```

Expected: `no tmux references remain`

- [ ] **Step 5: 全テストを走らせる**

```bash
cd /Volumes/Partition_Case_Sensitive/Workspace/dotfiles && ./vim/tests/run.sh
```

Expected: 全 spec が passed、終了コード 0

- [ ] **Step 6: コミット**

```bash
git add vim/lua/modules/ai/init.lua
git commit -m "feat(nvim)!: drive AI tools through herdr instead of tmux

BREAKING CHANGE: modules/ai now requires a running herdr server.
The tmux backend is gone."
```

---

### Task 9: 実機スモーク

非同期チェーン全体は実 herdr でしか確かめられない。以下を手で通す。

**前提: Task 8 までを master にマージしてから行う。** `~/.config/nvim` はメイン
チェックアウトへの symlink なので、worktree のまま `herdr` の中で nvim を起動しても
古いコードが読まれる。Task 1〜8 のテストは worktree 内で完結するが、実機スモークだけは
マージ後でないと意味がない。

**Files:**
- Modify: `docs/zed-herdr-agents.md`（nvim 連携の節を追加）

- [ ] **Step 1: herdr を起動して nvim を中で開く**

```bash
herdr
```

herdr のペインで:

```bash
nvim
```

- [ ] **Step 2: `:Claude` を確認する**

`:Claude` を実行。期待する挙動:
- 新しいタブが `<repo>-claude` というラベルで作られる
- そのタブで Claude Code が起動する
- nvim 側に `[Claude Input]` バッファが開く
- **nvim がフリーズしない**（起動待ちの間も操作できる）

- [ ] **Step 3: 送信と割り込みを確認する**

入力バッファに `hello` と書いて `<CR>`。Claude に届いてバッファが閉じること。
`:Claude` をもう一度開き `<C-x><C-x>` で割り込みが効くこと。

- [ ] **Step 4: 出力取り込みを確認する**

入力バッファで `<C-o>`。`[<name> output]` バッファが分割で開き、Claude の出力が入っていること。`/` で検索できること。

- [ ] **Step 5: 艦隊ピッカーを確認する**

`:AgentFleet`。エージェントが一覧され、`<CR>` でフォーカスが飛ぶこと。`<C-o>` で出力、`<C-p>` で入力バッファが開くこと。

- [ ] **Step 6: worktree エージェントを確認する**

```
:AgentAdd smoke master
```

`~/.worktrees/<repo>-smoke` が作られ、エージェントが起動すること。
**信頼ダイアログが出た場合は自動応答せず**、そのペインで自分で答える。

- [ ] **Step 7: サーバ停止時の挙動を確認する**

別ターミナルで:

```bash
herdr server stop
```

nvim で `:AgentFleet` を実行し、フリーズせずエラー通知が出ること。

- [ ] **Step 8: 後片付け**

```bash
git worktree remove --force ~/.worktrees/<repo>-smoke
git branch -D worktree-smoke
```

- [ ] **Step 9: ドキュメントを更新してコミット**

`docs/zed-herdr-agents.md` の「fish ヘルパー」表の下に節を追加:

```markdown
## nvim 連携

| コマンド | 動作 |
|----------|------|
| `:Claude [args]` / `<leader>ac` | cwd のエージェントを用意し入力バッファを開く |
| `:Codex [args]` / `<leader>xx` | 同上（Codex） |
| `:AgentFleet` / `<leader>af` | 艦隊を telescope で一覧。`<CR>` フォーカス / `<C-o>` 出力 / `<C-p>` 送信 |
| `:AgentOutput [name]` | エージェントの出力をバッファに取り込む |
| `:AgentAdd <name> [branch]` | worktree を作りエージェントを配置 |

入力バッファ: `<CR>` 送信 / `q` 閉じる / `<C-x><C-x>` 割り込み / `<C-o>` 出力取り込み / `<S-Tab>` Shift+Tab 送信。

テスト: `./vim/tests/run.sh`（`nvim -l` で走る。herdr 実機は不要）。
```

```bash
git add docs/zed-herdr-agents.md
git commit -m "docs(herdr): document the nvim integration commands"
```
