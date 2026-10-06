# 評価指標カタログ

自律ループの停止条件・ゲートに使える指標を「決定性」と「CI コスト」で整理する。SKILL.md のステップ 2（完了定義と評価指標）から参照される。

## 目次

- 選び方の原則
- 性能
- コード品質
- テスト
- UI
- 形式検証
- 運用 / CI
- 避ける指標

## 選び方の原則

| 原則 | 内容 |
|------|------|
| 決定的なものを優先 | 同じ入力で同じ値が出る指標（件数・率・命令数・RSS）を、壁時計（秒）より優先する。CI で不安定な指標はゲートにしない |
| 主指標 1 つ＋ガード 2 つまで | ループが追う数値は 1 つ。トレードオフで悪化してはいけない数値をガードとして最大 2 つ添える（例: 主 = lint warning 数、ガード = テスト成功数・最大 RSS） |
| 実行タイミングを割り当てる | 毎 PR（ゲート）/ 夜間 / 手動 のどれかを各指標に決める。指標が増えるほど CI が伸びるので、重いものは夜間へ |
| 現在値を先に測る | 目標値は現在値を測ってから決める。測れない指標はまず「測れるようにする」をループの最初の仕事にする |
| 単調性をゴールにする | 「悪化させない」ガードは `今回 ≤ 前回` の形にし、絶対値の閾値は現在値から決める |

## 性能

| 指標 | 決定性 | 計測コマンド例 | CI コスト | 注意 |
|------|--------|---------------|----------|------|
| 最大 RSS | 高 | macOS: `/usr/bin/time -l <cmd> 2>&1 \| grep 'maximum resident'`。Linux: `/usr/bin/time -v <cmd> 2>&1 \| grep 'Maximum resident'` | 低 | 入力を固定する。OOM 対策の主指標に向く |
| 壁時計（hyperfine） | 低 | `hyperfine --warmup 3 --runs 10 --export-json out.json '<cmd>'` → `jq '.results[0].mean' out.json` | 中 | ローカル比較用。CI では「前回比 ±N%」の参考値に留め、ゲートにしない |
| 命令数 / サイクル（perf） | 高 | `perf stat -e instructions,cycles <cmd>`（Linux） | 低 | 壁時計の代わりに使える決定的な指標 |
| ヒープ割り当て（valgrind） | 高 | `valgrind --tool=massif <cmd>` → `ms_print massif.out.*`、または `--tool=dhat` | 高 | 遅いので夜間または手動 |
| Fuel / 命令カウント（wasm 等） | 高 | ランタイムの fuel 計測機能 | 低 | 壁時計が信用できない環境の代替 |
| バンドルサイズ | 高 | `du -b dist/*.js`、`npx size-limit` | 低 | フロントエンドのガードに |

## コード品質

| 指標 | 決定性 | 計測コマンド例 | CI コスト | 注意 |
|------|--------|---------------|----------|------|
| lint warning 数 | 高 | `eslint . -f json \| jq '[.[].warningCount] \| add'` / `golangci-lint run --out-format json \| jq '.Issues \| length'` / `cargo clippy --message-format=json 2>/dev/null \| jq -s '[.[] \| select(.reason=="compiler-message" and .message.level=="warning")] \| length'` | 低 | ルールは厳しめにし、件数の単調減少をゴールにする。ゲート向き |
| 循環的 / 認知的複雑度 | 高 | `cccc --lang es src/`（[moznion/cccc](https://github.com/moznion/cccc)。`--lang go` / `rust` / `python` 等） | 低 | 関数単位の上限（例: 認知的複雑度 15）をガードに |
| 重複率 | 高 | `similarity-ts . --threshold 0.9` / `similarity-rs` / `similarity-py` / `similarity-generic --language go`（[mizchi/similarity](https://github.com/mizchi/similarity)、`cargo install similarity-ts`） | 低 | 検出件数を主指標、閾値を固定して比較する |
| 型エラー数 | 高 | `tsc --noEmit 2>&1 \| grep -c 'error TS'` | 低 | 0 をゲートに |
| TODO / FIXME 件数 | 高 | `rg -c 'TODO\|FIXME\|HACK' --type-add 'code:*.{ts,go,rs}' -t code \| awk -F: '{s+=$2} END {print s}'` | 低 | 棚卸しループの主指標に |
| デッドコード / 未使用 export 数 | 高 | `npx knip --reporter json`、`staticcheck ./...`、`cargo machete` | 低 | `/techdebt` と同じ道具 |

## テスト

| 指標 | 決定性 | 計測コマンド例 | CI コスト | 注意 |
|------|--------|---------------|----------|------|
| Mutation kill 率 | 高（遅い） | `npx stryker run`（JS/TS）/ `cargo mutants`（Rust）/ `gremlins unleash`（Go）/ `mutmut run`（Python） | 高 | 対象ディレクトリを絞る。夜間向き。テストの「意味」を測れる唯一の指標 |
| カバレッジ | 高 | `vitest run --coverage` / `go test -cover ./...` / `cargo llvm-cov --summary-only` | 中 | 単独では意味が薄い。mutation かリスク別目標（`docs/quality-bar.md`）と組み合わせる |
| テスト成功数 / 失敗数 | 高 | `go test ./... -json \| jq -s '[.[] \| select(.Action=="pass" and .Test)] \| length'` | 低 | ガードの定番。「減らない」を条件に |
| flaky 率 | 中 | `go test -count=5 ./...`、`vitest run --retry 0` を複数回 | 高 | 夜間に測り、flaky なテストを隔離するループの主指標に |
| プロパティテスト反例数 | 高 | fast-check / proptest / gopter の失敗数 | 中 | 反例は回帰テストに落とす |

## UI

| 指標 | 決定性 | 計測コマンド例 | CI コスト | 注意 |
|------|--------|---------------|----------|------|
| VRT 一致率 | 中〜高 | Playwright `expect(page).toHaveScreenshot()`、reg-suit、BackstopJS | 中 | フォント・アニメーション・日時を固定する。差分ピクセル率を閾値に |
| アクセシビリティ違反数 | 高 | `axe` / `pa11y`、Lighthouse の a11y スコア | 低 | 件数 0 をゲートに |
| Core Web Vitals | 低 | Lighthouse CI（`lhci autorun`） | 中 | 壁時計系。参考値に |

## 形式検証

| 指標 | 決定性 | 計測コマンド例 | CI コスト | 注意 |
|------|--------|---------------|----------|------|
| モデル検査の反例数 | 高 | TLC / Apalache / Alloy / Z3 の exit code と反例出力 | 中〜高 | ツール選定と反例のテスト化は `formal-methods-reconciler` |
| 証明義務の未達数 | 高 | Dafny / Verus / Lean のビルド出力 | 高 | 夜間向き |

## 運用 / CI

| 指標 | 決定性 | 計測コマンド例 | CI コスト | 注意 |
|------|--------|---------------|----------|------|
| CI 所要時間 | 低 | `gh run list --limit 20 --json durationMs,conclusion` | 低 | 指標を増やした副作用の監視に。閾値ゲートにはしない |
| CI 失敗率 | 中 | 同上の `conclusion` を集計 | 低 | flaky の検出に |
| 脆弱な依存数 | 高 | `npm audit --json \| jq '.metadata.vulnerabilities.total'` / `govulncheck ./...` / `cargo audit` | 低 | 0 をゲートに |

## 避ける指標

| 指標 | 理由 |
|------|------|
| 主観スコア（「読みやすさ 5 段階」等） | 判定のたびに人間が呼ばれる。ループが止まる |
| LLM の自己評価 | 同じモデルの盲点を共有する。別の観測（テスト・静的解析）に置き換える |
| 壁時計の絶対値ゲート | CI ランナーで安定しない。RSS・命令数・件数に言い換える |
| 複数の主指標 | トレードオフの優先順位が決まらず、ループが迷う。主 1 つ＋ガード 2 つまで |
