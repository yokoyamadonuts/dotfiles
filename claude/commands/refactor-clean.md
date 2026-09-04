---
description: "デッドコード・重複コード・未使用依存関係を検出して安全に削除。refactor-cleanerエージェントを起動。"
argument-hint: "[--detect-only | --auto-fix]"
allowed-tools: ["Task", "Bash", "Read", "Grep", "Glob", "Edit", "TodoWrite", "AskUserQuestion"]
---

# /refactor-clean - コードクリーンアップコマンド

検出・リスク評価・削除の知識はすべて `refactor-cleaner` エージェントが持つ。
本コマンドは引数解釈と削除の承認ゲートのみを担う。

## 使い方

```
/refactor-clean                # 検出して確認後に修正
/refactor-clean --detect-only  # 検出のみ（修正しない）
/refactor-clean --auto-fix     # 検出して自動修正
```

## 実行フロー

### [1/3] 検出

`refactor-cleaner` エージェントを起動し、デッドコード・重複コード・未使用依存の検出とリスク評価を委譲する。
引数（`--detect-only` / `--auto-fix` / なし）をエージェントのプロンプトに含め、
検出結果を「削除候補リスト（リスク評価・削除優先度付き）」として報告させる。

### [2/3] 承認ゲート

`--detect-only` の場合は検出結果を提示して終了。

`--auto-fix` 以外の場合、削除実行前にAskUserQuestionで確認する:

- 削除候補の件数・内訳・リスク評価を提示する
- 選択肢: 「すべて削除」「低リスクのみ削除」「個別に選択」「キャンセル」
- 保護対象（認証・決済・DB・ビジネスロジック・外部API・セキュリティ関連）が候補に含まれる場合は必ず明示する

### [3/3] 削除と検証

承認された候補の削除を `refactor-cleaner` エージェントに実行させる。削除後:

1. ビルド・テスト・lint を実行して成功を確認する
2. 失敗した場合は該当の削除を巻き戻す
3. 削除ログ（`docs/DELETION_LOG.md`）と結果サマリーを提示する
