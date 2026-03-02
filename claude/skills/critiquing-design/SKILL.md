---
name: critiquing-design
description: デザインドキュメントをApple Design Director視点で批評する。Nielsen 10 Heuristics + 9軸評価（計19軸）でスコアリングし、Critical/Important/Polish優先度付き改善提案を生成、Criticalな改善をドキュメントに直接反映する。「デザインを批評して」「デザインレビュー」「UIを評価して」「design critique」「ヒューリスティクス評価」で起動。
---

# Design Critique — Apple Design Director Review

デザインドキュメント群（design-system, UI spec, brand identity等）を Apple Design Director 視点で包括的に批評し、具体的な改善をドキュメントに反映する。

## 前提

- **入力**: デザインシステム仕様書、UI仕様書、ブランドアイデンティティ等のドキュメント
- **出力**: `docs/design-critique.md` + 対象ドキュメントへの Critical 改善の直接反映
- **視点**: Apple Design Award を目指すレベルの品質基準

## Process

### Phase 1: コンテキスト収集

並列で以下を調査:

1. **デザインドキュメント群の特定**: `docs/` 配下のデザイン関連ファイルを探索
2. **プロダクト思想の把握**: CLAUDE.md、戦略書、ブランドアイデンティティからコア哲学・ペルソナ・差別化ポイントを抽出
3. **現在の実装状態**: iOS/Web等のソースコード状況、実装済みコンポーネントの確認

**重要**: ドキュメントの全体像を把握してから批評に入る。部分的な読み取りで判断しない。

### Phase 2: 19軸評価

以下の19軸で評価する。各軸は「良い点」「問題点」「具体例」の3構造で記述:

#### A. Nielsen's 10 Heuristics（各5点満点）

| # | ヒューリスティック | 評価観点 |
|---|-------------------|---------|
| H1 | Visibility of System Status | フィードバック、ローディング、保存確認、状態表示 |
| H2 | Match Between System and Real World | 語彙、メタファー、文化的適合性 |
| H3 | User Control and Freedom | Undo/Redo、キャンセル、編集、戻る |
| H4 | Consistency and Standards | HIG/Material準拠、内部一貫性 |
| H5 | Error Prevention | バリデーション、確認ダイアログ、オートセーブ |
| H6 | Recognition Rather Than Recall | ビジュアルキュー、ラベル、アフォーダンス |
| H7 | Flexibility and Efficiency of Use | ショートカット、パワーユーザー対応、効率化 |
| H8 | Aesthetic and Minimalist Design | 情報密度、余白、視覚的ノイズ削減 |
| H9 | Error Recovery | エラーメッセージ、リトライ導線、回復手順 |
| H10 | Help and Documentation | オンボーディング、コーチマーク、ヘルプ |

#### B. 9つの追加評価軸（A+〜C評価）

| 軸 | 評価観点 |
|----|---------|
| Visual Hierarchy | タイプスケール段階数、FABのz-order、主役の明確さ |
| Typography | 書体選択の差別化と可読性、スケール比率、Dynamic Type対応 |
| Color | コントラスト比WCAG準拠、セマンティクス、ダークモード |
| Usability | 発見性、依存関係、認知負荷 |
| Strategic Consistency | ブランド＝プロダクト＝体験の一致度 |
| Cognitive Load | 操作ステップ数、同時コントロール数、概念学習コスト |
| Accessibility (WCAG) | コントラスト、VoiceOver、Dynamic Type、Reduce Motion、色覚多様性 |
| Interaction Clarity | アフォーダンス、ハプティクス、状態フィードバック |
| Differentiation | 市場での唯一性、特許級のイノベーション |

### Phase 3: 改善提案の優先度分類

評価結果から改善提案を3段階で分類:

| 優先度 | 基準 | 期限 |
|--------|------|------|
| **Critical** | WCAG不適合、コア体験の欠損、設計思想との矛盾 | リリース前必須 |
| **Important** | ユーザビリティの顕著な問題、発見性の低さ | v1.0で対応 |
| **Polish** | 差別化の強化、微調整、将来機能 | v1.1以降 |

各提案には以下を含める:
- **問題**: 具体的な問題の記述
- **改善案**: 実装可能なレベルの具体的な解決策
- **根拠**: どのヒューリスティック/評価軸に対応するか

### Phase 4: 代替デザイン提案（オプション）

現在のIA（情報アーキテクチャ）に根本的な改善余地がある場合、1-2件の代替デザイン案を提示:

各案に含めること:
- ASCII ワイヤーフレーム
- 利点（3-5点）
- リスク（2-3点）
- 適合ペルソナ

### Phase 5: design-critique.md の生成

`docs/design-critique.md` に以下の構造で保存:

```markdown
# Design Critique — 「プロダクト名」

> **Reviewer**: Apple Design Director perspective
> **Scope**: [対象ドキュメント一覧]
> **Date**: YYYY-MM-DD

## 1. Nielsen H1: Visibility of System Status — X/5
...（H1〜H10 を各セクションとして記述）
## 10. Differentiation — 評価: X

## Improvement Proposals — 優先順位付き
### Critical（リリース前に必須）
### Important（v1.0で対応すべき）
### Polish（v1.1以降で差別化を磨く）

## Alternative Redesign Proposals（ある場合）

## Summary Score
（19軸のスコア一覧テーブル + 総合評価）
```

### Phase 6: Critical 改善のドキュメント反映

**Critical 改善のみ**を対象ドキュメントに直接反映する:

1. 各 Critical 項目を特定（C1, C2, C3...）
2. 対象ドキュメントの該当箇所を Read で確認
3. Edit で最小限の変更を適用
4. 変更箇所に `> **Design Critique C{N} 対応**` のマーカーを付与
5. design-critique.md の Critical テーブルに「対応状況: ✅ 反映済み」を記載

**Important / Polish は反映しない**。提案のみ記載し、実装判断はチームに委ねる。

### Phase 7: コミット（ユーザー確認）

ユーザーに変更内容のサマリーを提示し、コミットの許可を得てからコミット:

```
docs: デザイン批評書 + Critical改善{N}件をドキュメントに反映

- docs/design-critique.md: Nielsen 10ヒューリスティクス評価、{M}軸スコアリング、
  改善提案(C{x}/I{y}/P{z}件)
- C1: [1行要約]
- C2: [1行要約]
...
```

## 評価のガイドライン

### 5/5 または A+ を付ける基準
- 業界のベストプラクティスを超えている
- 他のプロダクトの模範となるレベル
- Apple Design Award に値する品質

### 4/5 または A-/B+ を付ける基準
- 高品質だが改善余地が明確にある
- 問題はあるがユーザー体験を大きく損なわない
- 修正すればさらに際立つ具体的なポイントがある

### 3/5 または B を付ける基準
- 基本は押さえているが顕著な問題がある
- ユーザー体験に直接影響する欠損がある
- 改善すれば大幅に品質が向上する具体的なポイントがある

### 批評のトーン
- **建設的**: 問題を指摘するだけでなく、必ず改善案を添える
- **具体的**: 「UIが悪い」ではなく「プレースホルダー色のコントラスト比2.8:1はWCAG AA不適合」のように数値・コンポーネント名・画面名で指摘
- **戦略的**: プロダクトの哲学と差別化を理解した上で、それを強化する方向の提案
- **傑出点を称える**: 良い点は明確に称える。批判だけの批評は価値が低い

## アンチパターン

- ドキュメントを一部だけ読んで批評する → 全体を読んでから
- 一般論だけの批評（「もっとシンプルに」）→ 具体的な数値・コンポーネント名・画面名で
- 全部を Critical にする → 本当にリリースブロッカーなものだけ Critical
- 代替案なしの否定 → 問題提起には必ず解決策を
- プロダクト哲学を無視した「正しい」提案 → 事務論なら事務論の文脈で
