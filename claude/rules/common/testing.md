---
paths: ["**/*.test.*", "**/*_test.*", "**/*.spec.*", "**/tests/**"]
description: テストのカバレッジ基準と失敗時の対応。方法論はdevelopingスキル参照。
---

# テストルール

## カバレッジ基準

- 一般コード: 80%以上
- 金融計算・認証認可・セキュリティ・コアビジネスロジック: 100%

```bash
npm test -- --coverage        # TypeScript
go test -coverprofile=coverage.out ./...
cargo tarpaulin               # Rust
```

## テスト失敗時の対応

1. **テストの修正ではなく実装を修正する**（テスト自体にバグがある場合のみテストを修正）
2. 失敗原因を特定してから修正する

## 原則

- 実装の詳細ではなく、外から見える振る舞いをテストする
- 各テストは独立させる（前のテストが作った状態に依存しない）
- テストデータは各テストが自分で準備する

## 詳細ガイド（on-demand）

- TDDワークフロー・RED→GREEN→REFACTOR: `developing` スキル
- テストの命名・AAA構造・QA 6技法・言語別パターン: `writing-tests` スキル
- 言語固有の規約: `claude/rules/backend/go/testing.md`, `claude/rules/backend/rust/testing.md`

## エージェント連携

- **tdd-guide**: 統合/E2E/モックの実例
- **e2e-runner**: Playwright E2Eテストの作成・実行
