---
name: write-prd
description: PRD（プロダクト要件定義書）をAIと協働で作成する。ソクラテス式質問で思考を深め、複数の戦略的アプローチを比較し、マルチ視点エージェントレビューで品質を高める。「PRDを書いて」「要件を定義して」「機能仕様を作って」などのリクエストで起動。
---

# PRD作成スキル

## 概要

AIを「ゴーストライター」ではなく「思考パートナー」として活用し、高品質なPRD（Product Requirements Document）を作成する。ソクラテス式質問フレームワークで思考を深化させ、複数の戦略的バリエーションを生成・比較し、マルチ視点エージェントレビューで品質を担保する。

## コアワークフロー

### ステップ1: コンテキスト収集

プロジェクトの背景情報を収集する：

- プロジェクトの既存ドキュメント（DESIGN.md、README.md等）を読む
- 関連するコードベースを探索して現状を理解する
- ユーザーリサーチやフィードバックデータがあれば確認する

### ステップ2: テンプレート選択

ユーザーにテンプレートを選択してもらう：

```javascript
AskUserQuestion({
  questions: [
    {
      question: "PRDのテンプレートはどれを使いますか？",
      header: "テンプレート",
      options: [
        {
          label: "詳細テンプレート（推奨）",
          description: "Problem Alignment + Solution Alignment の包括的構成。複雑な機能やステークホルダー調整が必要な場合に最適"
        },
        {
          label: "シンプルテンプレート",
          description: "7つの質問で構成。小規模な機能や早期検討段階で素早く進めたい場合に最適"
        },
        {
          label: "自分のテンプレート",
          description: "独自のPRDテンプレートを使用"
        }
      ],
      multiSelect: false
    }
  ]
})
```

#### 詳細テンプレート構造

```markdown
# Problem Alignment
## Problem & Opportunity
## High Level Approach
## Narrative（任意）
## Goals
## Non-goals

# Solution Alignment
## Key Features
## Key Flows
## Key Logic

# Development and Launch Planning
```

#### シンプルテンプレート構造

```markdown
# [プロジェクト名]
- Description: 何を作るのか？
- Problem: どの問題を解決するのか？
- Why: この問題が実在し、解決に値する根拠は？
- Success: 問題が解決されたかをどう判断するか？
- Audience: 誰のために作るのか？
- What: プロダクト上でどう見えるか？
- How: 実験計画は？
- When: いつ出荷し、マイルストーンは？
```

### ステップ3: ソクラテス式質問による思考深化

3〜5の質問をカテゴリから選んで順に問いかける。各質問で回答を待ち、スキップも許可する。

#### 質問カテゴリ

**1. 問題の明確化**
- 「この機能が解決する具体的なユーザーの痛みは何ですか？」
- 「この問題が実在する証拠は何ですか？（インタビュー、サポートチケット、チャーンデータ等）」
- 「この問題を最も強く感じているのは誰ですか？」

**2. ソリューションの検証**
- 「なぜこのソリューションが正しいと考えますか？」
- 「他にどんな代替案を検討しましたか？なぜ却下しましたか？」
- 「コア問題を解決する最小バージョンは何ですか？」

**3. 成功基準**
- 「この機能が成功したかどうかをどう判断しますか？」
- 「この機能を失敗とみなす条件は何ですか？」
- 「どの指標をどれだけ動かしたいですか？」

**4. 制約とトレードオフ**
- 「技術的制約やリスクは何ですか？」
- 「スコープ外として明示すべきことは何ですか？」
- 「時間・リソースが半分だったら何を削りますか？」

**5. 戦略的フィット**
- 「なぜ今この機能を作るのが正しいのですか？」
- 「6ヶ月待ったらどうなりますか？」
- 「競合に対するポジショニングにどう影響しますか？」

#### 質問の進め方

- 回答が弱い場合：「もう少し詳しく教えてください」「それを支持するエビデンスは？」
- 回答が優れている場合：認めて次に進む
- スキップの場合：コンテキストから合理的な回答を提案する
- 一問一答で進め、3〜5問で完了する

### ステップ4: 複数バリエーション生成

ソクラテス式質問の回答をもとに、3つの異なる戦略的アプローチでPRDドラフトを生成する：

```javascript
// 3エージェントを並列で起動
Task({
  description: "PRD Version 1: [アプローチ名]",
  prompt: "...",
  subagent_type: "general-purpose"
})
// + Version 2, Version 3
```

- **Version 1**: アプローチA（例：ユーザー体験重視）
- **Version 2**: アプローチB（例：技術的優位性重視）
- **Version 3**: アプローチC（例：バランス型）

各バージョンを別ファイルとして保存する。

### ステップ5: バージョン選択

ユーザーに3つのバージョンの要約を提示し、選択またはミックスを依頼する：

```javascript
AskUserQuestion({
  questions: [
    {
      question: "どのバージョンが最も適していますか？",
      header: "バージョン",
      options: [
        { label: "Version 1", description: "[アプローチAの要約]" },
        { label: "Version 2", description: "[アプローチBの要約]" },
        { label: "Version 3", description: "[アプローチCの要約]" },
        { label: "要素を組み合わせ", description: "複数バージョンから要素を選択" }
      ],
      multiSelect: false
    }
  ]
})
```

### ステップ6: マルチ視点エージェントレビュー

選択されたPRDを3つの視点からレビューする：

```javascript
// 3エージェントを並列で起動
Task({
  description: "Engineer review",
  prompt: "技術的実現可能性、実装複雑度、パフォーマンス・スケーラビリティの観点からPRDをレビューせよ...",
  subagent_type: "general-purpose"
})

Task({
  description: "Executive review",
  prompt: "ビジネス価値、戦略的フィット、ROI、ステークホルダーコミュニケーションの観点からPRDをレビューせよ...",
  subagent_type: "general-purpose"
})

Task({
  description: "User Researcher review",
  prompt: "ユーザーニーズ、ペインポイント、ユーザビリティ、リサーチギャップの観点からPRDをレビューせよ...",
  subagent_type: "general-purpose"
})
```

レビュー結果を統合ファイルとして出力する。

### ステップ7: フィードバック反映とファイナライズ

ユーザーがフィードバックに基づいて修正を依頼した場合、PRDを更新して最終版として保存する。

## 出力ファイル

- `docs/prd-[feature-name]-v1.md` - バージョン1
- `docs/prd-[feature-name]-v2.md` - バージョン2
- `docs/prd-[feature-name]-v3.md` - バージョン3
- `docs/prd-[feature-name]-review.md` - マルチ視点レビュー
- `docs/prd-[feature-name]-final.md` - 最終版

## 関連スキル

- **analyzing-requirements**: PRD完成後、技術的な設計仕様(DESIGN.md)に変換する場合に使用
- **planning-tasks**: DESIGN.md完成後、タスク分解(TODO.md)に使用
- **devils-advocate**: PRDの戦略をストレステストする場合に使用
