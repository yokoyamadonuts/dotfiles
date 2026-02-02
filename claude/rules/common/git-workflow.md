---
paths: ["**/*"]
description: Git ワークフローに関するルール。
---

# Git ワークフロールール

## コミットメッセージ形式

### Conventional Commits

```
<type>: <description>

[optional body]

[optional footer]
```

### Type 一覧

| Type | 説明 |
|------|------|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `refactor` | リファクタリング |
| `docs` | ドキュメント |
| `test` | テスト |
| `chore` | ツール・設定 |
| `perf` | パフォーマンス改善 |
| `ci` | CI/CD |

### 例

```
feat: add user authentication

Implement JWT-based authentication with refresh tokens.
Includes login, logout, and token refresh endpoints.

Closes #123
```

## PR 作成

### 差分の確認

```bash
# 全コミット履歴を確認
git log origin/main...HEAD

# ブランチ分岐からの全差分
git diff origin/main...HEAD
```

**重要**: 最新コミットだけでなく、PR に含まれるすべてのコミットを確認

### PR テンプレート

```markdown
## Summary
- [変更の要約を箇条書きで]

## Test plan
- [ ] ユニットテストを追加
- [ ] 既存テストが通過
- [ ] 手動で動作確認

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## 開発フロー

### 1. 計画フェーズ

```bash
# planner エージェントを使用
# 依存関係とフェーズをマッピング
```

### 2. TDD フェーズ

```bash
# RED: 失敗するテストを書く
npm test -- --watch

# GREEN: 実装
# REFACTOR: 改善

# カバレッジ確認
npm test -- --coverage
# 80%以上必須
```

### 3. レビューフェーズ

```bash
# 実装後すぐにレビュー
/review
```

### 4. コミットフェーズ

```bash
# Conventional Commit 形式
git commit -m "feat: add user authentication"
```

## ブランチ戦略

```
main
  └── feature/xxx
        └── (develop locally)
        └── (create PR)
        └── (merge to main)
```

## 禁止事項

- `git push --force` （main/masterへ）
- `git commit --amend` （プッシュ済みコミットへ）
- シークレット情報のコミット
- `.env` ファイルのコミット

## コミット前チェック

```bash
# テスト通過確認
npm test

# 型チェック
npm run typecheck

# Lint
npm run lint

# カバレッジ確認
npm test -- --coverage
```

## committer エージェント

コミット作成は `committer` エージェントを使用:

1. 変更内容を自動分析
2. 関心事ごとにコミット分割
3. Conventional Commit 形式 + 絵文字
4. 即座にコミット実行
