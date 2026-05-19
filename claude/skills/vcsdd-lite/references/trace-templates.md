# Trace Templates

bead identifier 命名規則とトレーサビリティ表のテンプレート集。

## bead 命名規則

形式: `bead:B-<連番3桁>-<スラッグ>`

例:
- `bead:B-001-login-flow`
- `bead:B-002-password-reset`
- `bead:B-003-mfa-enrollment`

### スラッグの書き方

- 小文字 kebab-case
- ビジネス要件の名称を反映（実装詳細ではなく）
- 3〜5単語以内

良い例: `bead:B-001-login-flow`、`bead:B-007-billing-cycle`
悪い例: `bead:B-001-LoginController`（実装詳細）、`bead:B-002-fix-bug`（変更内容）

## 連番管理

- フィーチャー単位ではなく**プロジェクト全体で連番**
- 削除されたbead番号は欠番のまま再利用しない
- 100番台 = コア機能、200番台 = サポート機能、等のセマンティック区分も任意で可

## トレーサビリティ表テンプレート

`docs/vcsdd/<feature>/traceability.md` に作成（任意、scan結果で十分なら省略可）:

```markdown
# Traceability Matrix: <feature>

| Bead | Requirement | Spec | Tests | Impl | Verify | Status |
|------|-------------|------|-------|------|--------|--------|
| `bead:B-001-login-flow` | `req:user-login` | `spec:auth-flow` | `test:auth-edge-cases`, `test:auth-fuzz` | `impl:auth-service` | `verify:prop-token-invariant` | 🟢 Full |
| `bead:B-002-password-reset` | `req:password-reset` | `spec:password-reset-flow` | `test:reset-edge-cases` | `impl:reset-service` | _missing_ | 🟡 Partial |
```

## Phase完了時のチェックリスト

各Phase完了時に bead 単位で確認：

```markdown
## Phase 6 Convergence Check: <feature>

For each bead in feature:
- [ ] req member exists and is reviewed
- [ ] spec member exists, status: locked, confidence: green
- [ ] test member exists, all tests green, mutation score > 80%
- [ ] impl member exists, no TODO/FIXME
- [ ] verify member exists, all properties passed

If any bead has `partial` completeness, justify why and update spec/refs.
```

## CLI による自動トレース

手動表を書く前に、まず `coherence-trace.ts` で機械生成を試す：

```bash
deno run --allow-read ~/.claude/skills/vcsdd-lite/scripts/coherence-trace.ts \
  --feature user-auth --req req:user-login --format md > traceability-snippet.md
```

このsnippetをコピーして traceability.md に貼り、必要なら手動で補強する。
