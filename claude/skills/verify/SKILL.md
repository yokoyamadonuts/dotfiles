---
name: verify
description: コミット直前にそのプロジェクトの lint・型チェック・テストを一通り走らせ、結果を PASS / FAIL で報告するときに使う。Claude Code 2.1.286 以降は、ユーザースキルに `verify` があるとコミット前に自動で呼ばれる（docs のみ・tests のみのコミットは除く）。「コミット前に検証して」「verify して」「lint とテストを通して」でも起動。修正はしない。検証だけを行い、失敗したら何が落ちたかを示して止まる。
---

# verify — コミット前の検証

プロジェクトが用意している検証コマンドを **既存のものだけ** 実行する。新しい設定やテストは作らない。直さない。

## 手順

1. 検証コマンドを決める。上から順に、最初に見つかった 1 つの系統を使う。

| 見つかるもの | 実行するもの |
|-------------|-------------|
| `Makefile` に `verify` / `check` / `test` / `lint` ターゲット | `make verify`（無ければ `make check`、`make lint && make test`） |
| `justfile` に同名レシピ | `just verify`（同様の順） |
| `deno.json` の `tasks` | `deno task verify`（無ければ `deno task lint`, `deno task test`, `deno task check` の存在するもの） |
| `package.json` の `scripts` | `npm run verify`（無ければ `lint` → `typecheck` → `test` の存在するもの。pnpm / yarn / bun の lockfile があればそのランナー） |
| `go.mod` | `go vet ./... && go test ./...`（`golangci-lint` が入っていれば先に `golangci-lint run`） |
| `Cargo.toml` | `cargo clippy --all-targets -- -D warnings && cargo test` |
| `pyproject.toml` | `ruff check .`（あれば）→ `pytest`（あれば） |
| どれも無い | 「検証コマンドが無い」と報告して終了（exit 0 扱い） |

2. 実行する。出力は末尾 40 行程度に絞って読む。長く走るもの（E2E・mutation）は含めない。
3. 報告する。

```
verify: PASS   lint ✓  typecheck ✓  test ✓ (418 passed)
```

```
verify: FAIL   test ✗  src/foo.test.ts > "parses empty input" (expected 0, got 1)
→ コミットを止める。修正はユーザーの指示を待つ
```

## しないこと

- 失敗を直さない（`developing` のバグ修正プロセスに渡す）
- `--no-verify` や skip で通さない
- 検証のために設定ファイルや依存を追加しない
- 本番やリモートに触るコマンドを走らせない

## 関連スキル

- **developing**: ステップ 6「品質チェック（必須）」と同じ基準。失敗時の修正はこちら
- `/commit`（commit-commands プラグイン）: 本スキルが PASS した後に実行する
