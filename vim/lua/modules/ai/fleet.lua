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
