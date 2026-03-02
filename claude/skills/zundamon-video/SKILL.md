---
name: zundamon-video
description: markdown-to-zundamon を使い、Markdown 原稿からずんだもん解説動画を自動生成する。VOICEVOX で音声合成、Remotion で動画レンダリング。原稿作成→前処理→プレビュー→レンダリングの4ステップで MP4 を出力。「ずんだもん動画を作って」「解説動画を生成」「ずんだもんで説明動画」「Markdown から動画」などで起動。
---

# ずんだもん動画生成スキル

## 概要

[markdown-to-zundamon](https://github.com/motemen/markdown-to-zundamon) を使い、Markdown を書くだけでずんだもん（VOICEVOX キャラクター）が解説する動画を自動生成する。Remotion + VOICEVOX ベース。

**ワークフロー:** Markdown 原稿 → VOICEVOX 音声合成 → Remotion 動画合成 → MP4 出力

## 前提条件

- Node.js 18+
- VOICEVOX（ローカル起動、デフォルト: `http://localhost:50021`）
- Chrome（Remotion レンダリング用）

```bash
# VOICEVOX インストール（macOS）
# https://voicevox.hiroshiba.jp/ からダウンロード
# 起動後、http://localhost:50021/docs でAPI確認

# ツールのセットアップ
npx degit motemen/markdown-to-zundamon my-zundamon-project
cd my-zundamon-project
npm install
```

## コアワークフロー

### ステップ1: 要件ヒアリング

`AskUserQuestion` で以下を確認：

1. **テーマ**: 何について解説するか
2. **キャラクター**: ずんだもん単体 / 掛け合い（四国めたん等）
3. **動画の長さ**: ショート（1-2分） / 標準（3-5分） / ロング（5分超）
4. **BGM**: あり / なし

### ステップ2: Markdown 原稿作成

Frontmatter + 本文の形式で原稿を作成する。

**Frontmatter テンプレート:**

```yaml
---
fps: 30
width: 1920
height: 1080
speakerId: 3                    # デフォルト話者（ずんだもん=3）
slideTransitionMs: 600          # スライド切替アニメーション
speechGapMs: 200                # セリフ間の間
paragraphGapMs: 400             # 段落間の間
fontFamily: "M PLUS Rounded 1c"
bgm:
  src: ./bgm/background-music.mp3
  volume: 0.1
  fadeInMs: 2000
  fadeOutMs: 3000
characters:
  - name: ずんだもん
    speakerId: 3
    position: right
    color: "#55B02E"
    height: 800
  - name: 四国めたん
    speakerId: 2
    position: left
    color: "#D85898"
    height: 800
---
```

**本文の書き方:**

```markdown
> # タイトル: ○○について解説するのだ！

[ずんだもん] 今日は○○について解説するのだ！
[四国めたん] よろしくお願いしますわ。

> ## ポイント1
> - 箇条書きで要点を表示
> - 画面に表示される内容

[ずんだもん] これはとても大事なポイントなのだ。
[四国めたん] 確かに、初心者には難しいかもしれませんわね。

> ## まとめ
> - 要点1: ○○
> - 要点2: △△

[ずんだもん] というわけで今日の解説は以上なのだ！
```

**記法ルール:**

| 記法 | 効果 |
|------|------|
| `> テキスト` | スライド表示（画面に映る内容） |
| `[キャラ名] セリフ` | キャラクターが読み上げるセリフ |
| `[pause: 500ms]` | 指定時間の間を挿入 |
| `<ruby>npm<rt>エヌピーエム</rt></ruby>` | 読み上げ補正（後述） |

### ステップ3: キャラクター画像の配置

```
characters/
├── ずんだもん/
│   ├── default.png           # 通常立ち絵
│   ├── default_active1.png   # 口パク1
│   └── default_active2.png   # 口パク2
└── 四国めたん/
    ├── default.png
    ├── default_active1.png
    └── default_active2.png
```

画像は [VOICEVOX 公式キャラクター素材](https://voicevox.hiroshiba.jp/) から取得。`_active1`, `_active2` で口パクアニメーション対応。

### ステップ4: 前処理（音声生成）

```bash
# VOICEVOX が起動していることを確認（失敗時は中断）
curl -s http://localhost:50021/version && echo " VOICEVOX OK" || { echo "ERROR: VOICEVOX not running. 起動してから再実行してください"; exit 1; }

# 前処理実行
npm run preprocess -- manuscripts/my-topic.md
```

**出力先:** `public/projects/<プロジェクト名>/`
- 各セリフの `.wav` ファイル
- タイムライン・マニフェスト JSON

**リモート VOICEVOX を使う場合:**

```bash
VOICEVOX_BASE=http://192.168.1.100:50021 npm run preprocess -- manuscripts/my-topic.md
```

### ステップ5: プレビューと調整

```bash
npm run studio -- my-topic
```

ブラウザで Remotion Studio が開く。以下を確認：
- セリフのタイミング・間
- スライドの表示内容
- キャラクターの配置・口パク
- BGM のボリュームバランス

### ステップ6: レンダリング

```bash
npm run render -- my-topic
```

**出力:** `out/my-topic.mp4`

## 読み上げ補正テクニック

VOICEVOX は技術用語や英語を意図通り読まないことがある。`<ruby>` タグで補正：

| 表記 | 補正 |
|------|------|
| `npm install` | `<ruby>npm install<rt>エヌピーエム インストール</rt></ruby>` |
| `React` | `<ruby>React<rt>リアクト</rt></ruby>` |
| `VOICEVOX` | `<ruby>VOICEVOX<rt>ボイスボックス</rt></ruby>` |
| `API` | `<ruby>API<rt>エーピーアイ</rt></ruby>` |
| `GUI` | `<ruby>GUI<rt>ジーユーアイ</rt></ruby>` |

**ポイント:** セリフ全体ではなく、読み間違える単語だけを `<ruby>` で囲む。

## VOICEVOX 話者 ID 一覧

主な話者とその ID。詳細は [references/voicevox-speakers.md](references/voicevox-speakers.md) を参照。

| ID | キャラクター | スタイル |
|----|-------------|---------|
| 3 | ずんだもん | ノーマル |
| 1 | 四国めたん | ノーマル |
| 2 | 四国めたん | あまあま |
| 8 | 春日部つむぎ | ノーマル |
| 10 | 雨晴はう | ノーマル |
| 14 | 冥鳴ひまり | ノーマル |

## アンチパターン

| やってはいけないこと | 代わりにやること |
|---------------------|-----------------|
| VOICEVOX 未起動で preprocess 実行 | 事前に `curl localhost:50021/version` で確認 |
| 1セリフを長文にする | 1文1セリフで区切る（自然な間になる） |
| 英語をそのまま読ませる | `<ruby>` タグで読み上げ補正 |
| キャラ画像なしで実行 | `characters/<名前>/default.png` を必ず配置 |
| BGM 音量を大きくする | `volume: 0.1` 程度に抑える |
| Frontmatter なしで原稿を書く | 必ず `---` で囲んだ Frontmatter を付ける |

## 品質チェックリスト

### 原稿

- [ ] Frontmatter に `characters` と `speakerId` が設定されている
- [ ] すべてのセリフに話者指定 `[キャラ名]` がある
- [ ] スライド（`>` 引用）と読み上げが交互に配置されている
- [ ] 技術用語に `<ruby>` 読み上げ補正がある

### 音声生成

- [ ] VOICEVOX が起動している（`localhost:50021`）
- [ ] `npm run preprocess` がエラーなく完了
- [ ] `public/projects/<名前>/` に音声ファイルが生成されている

### プレビュー

- [ ] `npm run studio` でブラウザプレビューが開く
- [ ] セリフの間（`speechGapMs`）が自然
- [ ] 口パクが音声と同期している
- [ ] BGM のバランスが適切

### レンダリング

- [ ] `npm run render` でエラーなく MP4 が生成される
- [ ] 出力サイズが妥当（1分あたり ~20MB 目安）

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| preprocess でエラー | VOICEVOX 未起動 | VOICEVOX アプリを起動、`curl localhost:50021/version` で確認 |
| 音声が生成されない | speakerId が無効 | VOICEVOX の `GET /speakers` で有効な ID を確認 |
| プレビューが真っ白 | プロジェクト名不一致 | `public/projects/` 内のディレクトリ名を確認 |
| レンダリングが遅い | 動画が長い | Frontmatter で `fps: 24` に下げる、または区切って分割 |
| 口パクしない | active 画像未配置 | `default_active1.png`, `default_active2.png` を配置 |
| 読み上げがおかしい | 技術用語の読み間違い | `<ruby>` タグで読み上げ補正を追加 |

## 出力ファイル

| ファイル | 説明 |
|---------|------|
| `manuscripts/<topic>.md` | Markdown 原稿 |
| `public/projects/<topic>/` | 前処理出力（音声・マニフェスト） |
| `out/<topic>.mp4` | レンダリング済み動画 |

## Tips

- **セリフの間**: `speechGapMs: 200`（短め）〜 `400`（ゆっくり）で調整
- **掛け合い**: 2キャラ交互に話すとテンポが良くなる。`position: left/right` で配置分け
- **BGM**: フェードイン/アウトを設定すると自然。`fadeInMs: 2000`, `fadeOutMs: 3000`
- **分割レンダリング**: 長い動画は原稿を分割して個別にレンダリング→FFmpeg で結合
- **キャラ口調**: ずんだもんは「〜のだ」「〜なのだ」、四国めたんは「〜ですわ」「〜ませんわ」

## 関連スキル

- **pr-video**: Playwright + Remotion でプロモーション動画を生成
- **pptx**: Markdown からプレゼンテーションを生成
