---
name: youtube-research
description: YouTube動画のトランスクリプト（字幕）を取得し、内容を分析・要約する。技術カンファレンスの調査、チュートリアル内容の抽出、競合分析、学習コンテンツの整理に使用。「YouTube動画を調べて」「この動画の内容を教えて」「YouTube動画を要約して」「動画のトランスクリプトを取得」「YouTube研究」などのリクエストで起動。
---

# YouTube動画リサーチ

YouTube動画のトランスクリプト（字幕/キャプション）を取得し、Claude Codeで内容を分析するスキル。

## 前提条件

以下のいずれかのツールが必要。未インストールの場合はステップ0で案内する。

| ツール | インストール | APIキー | 特徴 |
|--------|-------------|---------|------|
| `yt-dlp` | `brew install yt-dlp` | 不要 | 汎用。動画DLも可能 |
| `youtube-transcript-api` | `pip install youtube-transcript-api` | 不要 | 軽量。JSON出力。CLI付き |

## コアワークフロー

### ステップ0: 環境チェック

```bash
# yt-dlp の確認
which yt-dlp

# youtube-transcript-api の確認
python3 -c "import youtube_transcript_api" 2>/dev/null && echo "OK" || echo "NOT INSTALLED"
```

どちらも未インストールの場合、ユーザーに確認：

```javascript
AskUserQuestion({
  questions: [{
    question: "YouTube字幕取得ツールがインストールされていません。どちらをインストールしますか？",
    header: "ツール選択",
    options: [
      { label: "yt-dlp (Recommended)", description: "brew install yt-dlp — 汎用的で安定" },
      { label: "youtube-transcript-api", description: "pip install youtube-transcript-api — 軽量、Python製" },
      { label: "両方", description: "両方インストール" }
    ],
    multiSelect: false
  }]
})
```

### ステップ1: URL解析・動画ID抽出

ユーザーが提供したURLから動画IDを抽出する。

対応URLパターン:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- 動画ID単体（11文字の英数字+ハイフン+アンダースコア）

### ステップ2: トランスクリプト取得

#### 方法A: yt-dlp を使用

```bash
# 利用可能な字幕一覧を確認
yt-dlp --list-subs "https://www.youtube.com/watch?v=VIDEO_ID" 2>/dev/null | head -30

# 日本語字幕を取得（SRTフォーマット）
yt-dlp --write-subs --sub-langs "ja" --sub-format srt --skip-download \
  -o "/tmp/yt-%(id)s" "https://www.youtube.com/watch?v=VIDEO_ID"

# 日本語がなければ英語字幕
yt-dlp --write-subs --sub-langs "en" --sub-format srt --skip-download \
  -o "/tmp/yt-%(id)s" "https://www.youtube.com/watch?v=VIDEO_ID"

# 自動生成字幕（手動字幕がない場合）
yt-dlp --write-auto-subs --sub-langs "ja,en" --sub-format srt --skip-download \
  -o "/tmp/yt-%(id)s" "https://www.youtube.com/watch?v=VIDEO_ID"
```

取得後、SRTファイルをReadツールで読み込む。

#### 方法B: youtube-transcript-api を使用

```bash
# 利用可能な字幕一覧
youtube_transcript_api --list-transcripts VIDEO_ID

# 日本語トランスクリプトをJSON形式で取得
youtube_transcript_api VIDEO_ID --languages ja --format json > /tmp/yt-VIDEO_ID.json

# 英語トランスクリプト
youtube_transcript_api VIDEO_ID --languages en --format json > /tmp/yt-VIDEO_ID.json

# 日本語に翻訳して取得（英語字幕しかない場合）
youtube_transcript_api VIDEO_ID --languages en --translate ja --format json > /tmp/yt-VIDEO_ID.json
```

#### 字幕が見つからない場合

字幕がない動画（ライブ配信アーカイブ等）の場合：
1. ユーザーに字幕非対応であることを通知
2. 動画の概要欄（description）からの情報取得を提案

```bash
# メタデータ（タイトル、概要欄、タグ等）を取得
yt-dlp --dump-json --skip-download "https://www.youtube.com/watch?v=VIDEO_ID" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Title: {d[\"title\"]}\nChannel: {d[\"channel\"]}\nDuration: {d[\"duration\"]}s\nDescription:\n{d[\"description\"]}')"
```

### ステップ3: テキスト前処理

SRTまたはJSONから純粋なテキストを抽出する。

**SRTの場合**:
```bash
# タイムスタンプと番号を除去し、純粋なテキストのみ抽出
python3 -c "
import re, sys
text = open(sys.argv[1]).read()
# SRT番号行とタイムスタンプ行を除去
text = re.sub(r'\d+\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n', '', text)
text = re.sub(r'\n{2,}', '\n', text).strip()
print(text)
" /tmp/yt-VIDEO_ID.ja.srt > /tmp/yt-VIDEO_ID-clean.txt
```

**JSONの場合**:
```bash
python3 -c "
import json, sys
data = json.load(open(sys.argv[1]))
print(' '.join(item['text'] for item in data))
" /tmp/yt-VIDEO_ID.json > /tmp/yt-VIDEO_ID-clean.txt
```

前処理済みテキストをReadツールで読み込み、分析に使用する。

### ステップ4: 内容分析

取得したトランスクリプトを以下の観点で分析する。ユーザーの目的に応じて焦点を変える。

| 分析タイプ | 出力 |
|-----------|------|
| **要約** | 動画の主要ポイントを箇条書きで整理 |
| **技術調査** | 言及された技術・ツール・ライブラリをリスト化 |
| **アクションアイテム** | 実践可能な手順・チュートリアルステップを抽出 |
| **競合分析** | 製品比較・市場動向の情報を構造化 |
| **学習ノート** | 重要概念・用語の定義・具体例を整理 |

### ステップ5: 出力生成

分析結果を構造化して出力する。

## 出力ファイル

- `/tmp/yt-[VIDEO_ID]-clean.txt` - 前処理済みトランスクリプト（一時ファイル）
- `docs/youtube-research-[topic].md` - 分析レポート（ユーザーが保存を希望した場合）

### レポートテンプレート

```markdown
# YouTube動画リサーチ: [トピック]

## 動画情報
- タイトル: [タイトル]
- チャンネル: [チャンネル名]
- URL: [URL]
- 長さ: [時間]

## 要約
[3-5文の要約]

## 主要ポイント
1. [ポイント1]
2. [ポイント2]
3. [ポイント3]

## 詳細ノート
[トランスクリプトから抽出した詳細情報]

## アクションアイテム
- [ ] [実践可能な項目]
```

## 制限事項

- **字幕がない動画**: 自動生成字幕もない場合は取得不可
- **ライブ配信**: リアルタイム字幕は取得できない場合がある
- **言語**: 自動生成字幕の品質は言語によって異なる（英語が最も高品質）
- **長い動画**: 2時間超の動画はトランスクリプトが非常に長くなるため、セクション分割を推奨
- **レート制限**: 短時間に大量のリクエストを送るとブロックされる可能性がある

## 複数動画の一括調査

複数の動画URLが提供された場合、並列エージェントで同時取得が可能：

```
# 各動画をサブエージェントに割り当て
Task(subagent_type="general-purpose", prompt="動画Aのトランスクリプトを取得して分析")
Task(subagent_type="general-purpose", prompt="動画Bのトランスクリプトを取得して分析")
```

## 関連スキル

- **`competitive-research`**: 競合の動画コンテンツ調査に組み合わせ可能
- **`analyze-data`**: 動画から抽出したデータの定量分析
- **`write-prd`**: 技術動画の知見をPRDに反映
- **`pptx`**: 動画リサーチの結果をスライドにまとめる
