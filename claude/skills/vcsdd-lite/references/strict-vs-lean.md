# VCSDD-lite モード: lean vs strict

VCSDD-lite には 2つの運用モードがある。Phase 1 開始時に決定し、coherence.json の `mode` フィールドに記録される。

## 比較表

| 項目 | lean | strict |
|---|---|---|
| Sprint契約（事前約束書） | リスク時のみ | 必須（Phase 3前に作成） |
| 契約レビュー（Adversary） | オプション | 必須 |
| 敵対的レビュー反復回数 | 最大3回 | 最大5回 |
| 形式検証（Phase 5） | 選択的（高リスクのみ） | 必須 |
| coherence-validate `--strict` フラグ | OFF推奨 | ON推奨（warningsもfail扱い） |
| `status: locked` の運用 | spec確定時のみ | レビュー通過の各次元で適用 |
| 自動コミット（git tag） | しない | しない（plugin限定の機能） |

## 適用判断

### lean を使うべきケース

- プロトタイプ
- 個人ツール
- MVP段階のプロダクト
- 1-3人のチーム
- イテレーション速度優先

### strict を使うべきケース

- 金融・決済システム
- 認証・認可・暗号化コンポーネント
- インフラ・ネットワークレイヤ
- ライフセーフティ（医療・自動運転）
- 長期保守される基盤コード（5年以上）
- 規制対応（GDPR/PCI-DSS等）

## Sprint契約（strict mode）

Phase 3 の敵対的レビュー前に Builder が以下を明文化：

```markdown
# Sprint Contract: <feature> Phase 3

## Pre-Conditions
- 前提とする状態
- 期待される入力

## Post-Conditions
- 保証する出力
- 不変条件

## Out of Scope
- 今回は対応しないこと
- 将来のフェーズに先送りする項目

## Acceptance Criteria
- Phase 3 通過の客観的判断基準
- ベンチマーク数値
- カバレッジ閾値
```

Adversary は契約を起点に「この契約自体が守られているか」を検証する。契約のないコードは攻撃対象が定まらず、レビュー精度が落ちる。

## モード切替

lean → strict への昇格は許される。逆（strict → lean）は禁止：

- 一度 locked になった spec を draft に戻すと依存追跡が破綻する
- カバレッジ要求を緩めると後続フィーチャーの整合性が崩れる

新フィーチャー単位でのみ lean を選択可能。既存 strict フィーチャーから派生する場合も strict 継承が原則。
