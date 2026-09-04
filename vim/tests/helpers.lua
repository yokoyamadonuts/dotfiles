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
