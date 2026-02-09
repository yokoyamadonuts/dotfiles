---
name: pptx
description: MarkdownドキュメントからPowerPointプレゼンテーション(.pptx)を生成する。戦略書、PRD、分析レポート等をステークホルダー向けスライドデッキに変換する。「スライドを作って」「プレゼンにして」「PowerPointを生成」などのリクエストで起動。
---

# PowerPoint プレゼンテーション生成スキル

## 概要

Markdownドキュメント（戦略書、PRD、分析レポート等）を、ステークホルダー向けのプロフェッショナルなPowerPointプレゼンテーション(.pptx)に変換する。

## コアワークフロー

### ステップ1: ソースドキュメントの分析

Markdownドキュメントを読み、以下を特定する：
- スライドになるべき主要セクション
- キーポイントとサポートディテール
- ビジュアルヒエラルキーとフロー
- エグゼクティブサマリーの内容

### ステップ2: スライド構造の設計

```markdown
## スライド構成
1. タイトルスライド - ドキュメントタイトル、日付、コンテキスト
2. エグゼクティブサマリー - キーテイクアウェイ（1-2スライド）
3. メインコンテンツ - セクションごとに1スライド
4. 詳細スライド - サポート情報（読みやすく分割）
5. クロージング - サマリー、次のステップ、意思決定依頼
```

### ステップ3: プレゼンテーションの生成

Python `python-pptx` ライブラリを使用して .pptx ファイルを生成する：

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN

prs = Presentation()
prs.slide_width = Inches(10)
prs.slide_height = Inches(7.5)

# タイトルスライド
slide = prs.slides.add_slide(prs.slide_layouts[0])
slide.shapes.title.text = "タイトル"
slide.placeholders[1].text = "サブタイトル"

# コンテンツスライド
slide = prs.slides.add_slide(prs.slide_layouts[1])
slide.shapes.title.text = "セクションタイトル"
body = slide.placeholders[1].text_frame
for item in content_items:
    p = body.add_paragraph()
    p.text = item
    p.level = 0

prs.save('output.pptx')
```

### フォーマットガイドライン

#### タイポグラフィ
- タイトル: 44pt（スライドタイトル）、54pt（セクションヘッダー）
- 本文: 18-24pt（メインコンテンツ）、16pt（詳細）
- フォント: sans-serif（Calibri、Arial、Helvetica）

#### レイアウト
- 1スライドあたり最大3-5の箇条書き
- 比較には2カラムレイアウト
- 密度の高いコンテンツは複数スライドに分割
- 余白を十分に確保

#### コンテンツ原則
- 1スライド = 1つのキーアイデア
- アクティブで簡潔な言語
- 箇条書きは並列構造
- スライド番号を含める

#### 特殊スライドタイプ

**戦略スライド:**
- Diagnosis → Guiding Policy → Actions 構造
- ビジュアルヒエラルキーで関係性を表現
- トレードオフとキー決定をハイライト

**ロードマップスライド:**
- 四半期/月ごとのタイムラインビュー
- 関連施策をグルーピング
- 依存関係を表示

**メトリクススライド:**
- 現状 vs 目標のパフォーマンス
- テーブルで比較
- 成功基準を含める

### ステップ4: 出力と確認

```bash
# python-pptxが未インストールの場合
pip install python-pptx
```

出力後にユーザーに以下を報告する：
1. ファイルパス
2. スライド構成のサマリー（スライド数とセクション）
3. プレゼンテーション形式に合わせて簡略化・再構成した内容のメモ

## ベストプラクティス

- **エグゼクティブファースト**: サマリースライドは2分で読めるように
- **スキャナブル**: 各スライドは10秒で理解できるように
- **アクショナブル**: 明確な次のステップや意思決定依頼で終わる
- **プロフェッショナル**: 一貫したフォーマット
- **コンテキスト対応**: 聴衆に合わせた詳細度と形式

## 出力ファイル

- `[document-name]-presentation.pptx` - プレゼンテーションファイル

## 前提条件

- Python 3.x
- `python-pptx` ライブラリ

## 関連スキル

- **product-strategy**: 戦略書からプレゼンテーション生成
- **write-prd**: PRDからプレゼンテーション生成
- **analyze-data**: 分析レポートからプレゼンテーション生成
