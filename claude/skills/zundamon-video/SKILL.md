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

## 型テンプレートシステム

動画のスタイルを「型」で切り替えられる。型テンプレートには BGM 切替パターン、SE 使用量、表情遷移、原稿骨子が定義されている。

### 型の一覧

| 型名 | ファイル | 概要 | BGM | SE | 感情の起伏 |
|------|---------|------|-----|-----|-----------|
| コードレビュー型 | [types/code-review.md](types/code-review.md) | ヤバいコードをネタ的に暴露 | 4曲切替 | 多用 | 激しい |
| 解説型 | [types/tutorial.md](types/tutorial.md) | 技術トピックを教育的に解説 | 1-2曲 | 控えめ | 穏やか |
| ニュース型 | [types/news.md](types/news.md) | テックニュースを速報風に紹介 | 1-2曲 | 適度 | 中程度 |
| ショート型 | [types/short.md](types/short.md) | 1-2分のショート動画 | 1曲 | 最小 | コンパクト |

### 型の選び方

1. ユーザーに動画のテーマと雰囲気を聞く
2. 適切な型を提案（迷ったら「解説型」がデフォルト）
3. 型テンプレートの Frontmatter と原稿骨子をベースに原稿を作成

## 記法リファレンス

### セリフ: `[キャラ名:表情@スタイル]`

キャラクターの発話行。表情とスタイルはオプション。

```markdown
[ずんだもん] こんにちはなのだ！                    # 表情・スタイルなし（前回の表情を維持）
[ずんだもん:happy] やったのだ！                     # 表情指定
[四国めたん:sad@ささやき] それは悲しいわね…          # 表情 + ボイススタイル
```

**スティッキー動作:** 表情は明示的に変更するまで維持される。キャラを切り替えてもそれぞれ独立して保持。

### スライド: `> テキスト`

画面に表示されるスライド。Markdown の blockquote 構文。

```markdown
> # タイトル
> - ポイント1
> - ポイント2
```

### チャプター: `# タイトル`

blockquote の外の見出しはチャプター区切りになる。YouTube のチャプター機能用のタイムスタンプが自動生成される。

```markdown
# オープニング
（セリフ...）

# 本編
（セリフ...）
```

### BGM 切替: `[bgm: name]`

シーンの BGM を切り替える。原稿内の任意の場所に挿入可能。

```markdown
[bgm: op-intro]
# オープニング
[ずんだもん:happy] こんにちはなのだ！

[bgm: comedy-bgm]
# 本編
[ずんだもん:smug] さてさて、見ていくのだ。
```

オプションで音量指定: `[bgm: comedy-bgm, volume=0.15]`

### SE（効果音）: `[se: name]`

効果音を再生する。セリフの直前に配置するのが効果的。

```markdown
[se: reveal]
[ずんだもん:surprise] なんと8,000行なのだ！

[se: shock]
[四国めたん:shock] うそでしょ！？
```

オプションで再生時間指定: `[se: reveal, 2s]` / `[se: ding, 500ms]`

### ポーズ: `[pause: 時間]`

無音の間を挿入する。溜め・間・テンポ調整に使う。

```markdown
[ずんだもん:smug] さてさて…
[pause: 300ms]
[se: reveal]
[ずんだもん:surprise] なんとこれが…！
```

単位は `ms`（ミリ秒）または `s`（秒）。

### 読み上げ補正: `<ruby>`

VOICEVOX が正しく読めない英語・技術用語を補正する。

```markdown
[ずんだもん] <ruby>PHP<rt>ピーエイチピー</rt></ruby>のコードなのだ。
```

**ポイント:** セリフ全体ではなく、読み間違える単語だけを `<ruby>` で囲む。

| 表記 | 補正例 |
|------|--------|
| `npm` | `<ruby>npm<rt>エヌピーエム</rt></ruby>` |
| `React` | `<ruby>React<rt>リアクト</rt></ruby>` |
| `API` | `<ruby>API<rt>エーピーアイ</rt></ruby>` |
| `VOICEVOX` | `<ruby>VOICEVOX<rt>ボイスボックス</rt></ruby>` |
| `TypeScript` | `<ruby>TypeScript<rt>タイプスクリプト</rt></ruby>` |
| `git` | `<ruby>git<rt>ギット</rt></ruby>` |

## 利用可能な表情

8種類の表情が各キャラクターで利用可能。口パク対応は `default` と `happy` のみ（3フレーム: base, active1, active2）。

| 表情名 | 見た目 | 口パク | 用途 |
|--------|-------|--------|------|
| `default` | 普通の顔 | あり | 通常の説明・ナレーション |
| `happy` | にっこり笑顔 | あり | 良いニュース、楽しい話題、締めの挨拶 |
| `surprise` | 見開き目 | なし | 驚きの事実、数値の公開直後 |
| `smug` | ドヤ顔 | なし | ネタ披露、皮肉、自慢 |
| `angry` | 怒り顔 | なし | 批判、ダメ出し、問題指摘 |
| `sad` | 悲しい顔 | なし | 残念な事実、同情、反省 |
| `thinking` | 考え顔 | なし | 分析、考察、「なぜ？」の場面 |
| `shock` | >< 顔 | なし | 衝撃的な事実、ショック、青ざめ |

**表情遷移のコツ:**
- 同じ表情を3行以上続けない（単調になる）
- `surprise` → `shock` の連続は効果的（驚き→衝撃のエスカレーション）
- `smug` は皮肉やオチで使う（多用するとうざくなる）
- `default` に戻す場面を意識的に作る（感情リセット）

## 利用可能な BGM

プロジェクトの `bgm/` ディレクトリに配置済みの BGM ファイル。`[bgm: name]` で切り替え。

| 名前 | ファイル | 雰囲気 | 用途 |
|------|---------|--------|------|
| `op-intro` | `bgm/op-intro.mp3` | 軽快・脱力系 | オープニング、導入部分 |
| `comedy-bgm` | `bgm/comedy-bgm.mp3` | コミカル・楽しい | ネタ紹介、面白い話題 |
| `dramatic` | `bgm/dramatic.mp3` | シリアス・緊張 | 重要な問題、セキュリティ、衝撃の事実 |
| `ending` | `bgm/ending.mp3` | 温かい・まとめ | エンディング、振り返り |

**BGM 切替のコツ:**
- チャプター（`#`）の直前に `[bgm: name]` を配置する
- Frontmatter の `bgm` は初期BGM。`[bgm:]` で途中切替
- 1つの動画で全4曲使う必要はない（解説型なら1-2曲で十分）

## 利用可能な SE

プロジェクトの `se/` ディレクトリに配置済みの SE ファイル。`[se: name]` で再生。

| 名前 | ファイル | 効果 | 用途 |
|------|---------|------|------|
| `reveal` | `se/reveal.mp3` | ジャーン | 数値やデータの公開、新情報の提示 |
| `shock` | `se/shock.mp3` | ドーン | 衝撃的な事実、ヤバいコードの発覚 |
| `fail` | `se/fail.mp3` | ブブー | 失敗、間違い、アンチパターン |
| `ding` | `se/ding.mp3` | ピコーン | 正解、まとめのポイント、良い知らせ |
| `crickets` | `se/crickets.mp3` | シーン… | 沈黙、スベったとき、間（ま） |

**SE 使用のコツ:**
- SE の直後にセリフを配置する（SE → セリフの流れ）
- 多用しすぎない（1チャプターあたり1-2個が目安）
- `[se: reveal]` + `[ずんだもん:surprise]` は鉄板コンボ

## ボイススタイル

`@スタイル名` で VOICEVOX の声色を切り替えられる。省略時はキャラのデフォルト。

### ずんだもん

| スタイル | speakerId | 用途 |
|---------|-----------|------|
| ノーマル | 3 | 標準（デフォルト） |
| ささやき | 22 | 補足説明、小声演出 |
| ヒソヒソ | 38 | 秘密の話、裏話 |
| ヘロヘロ | 75 | 疲れた演出 |
| なみだめ | 76 | 泣き演出 |

### 四国めたん

| スタイル | speakerId | 用途 |
|---------|-----------|------|
| ノーマル | 2 | 標準（デフォルト） |
| あまあま | 0 | やさしい解説、褒めるとき |
| ツンツン | 6 | ツンデレ演出、厳しいツッコミ |
| ささやき | 36 | 補足・小声 |
| ヒソヒソ | 37 | 秘密の話 |

**使い方例:**
```markdown
[四国めたん:happy@あまあま] このシステム、こんな状態でも毎日ちゃんと動いてるのよ。
[四国めたん:sad@ささやき] 問題が起きても誰も気づけないじゃない…
```

## キャラクター口調ガイド

### ずんだもん

- **一人称:** 「ぼく」
- **語尾:** 「〜のだ」「〜なのだ」が基本
- **性格:** 元気でオーバーリアクション。難しいことも噛み砕いて説明する
- **ツッコミへの反応:** 素直に受け止める、たまにボケ返す
- **NGパターン:** 「〜のだぜ」「〜のだよ」は使わない

```
○ これはヤバいのだ！
○ 8,000行もあるのだ。すごいのだ！
× これはヤバいのだぜ！
× すごいですのだ。
```

### 四国めたん

- **一人称:** 「わたくし」
- **基本口調:** タメ口ベース。お嬢様風だが高飛車・ツンデレ気味
- **語尾:** 「〜わよ」「〜わね」「〜かしら」「〜のよ」「〜じゃない」「〜だわ」「〜よね」
- **相槌:** 「あら」「ふむふむ」「そうなの？」
- **NGパターン:** 「〜ですわ」は多用しない（安っぽいお嬢様演技になるため稀に使う程度）

```
○ それはひどいわね。
○ 8千行！？もはや小説じゃない！
○ あら、それは興味深いわね。
× それはひどいですわ。
× 8千行でございますのね。
```

### 掛け合いのテンポ

- ずんだもんが事実を提示 → めたんがリアクション・ツッコミ
- 1ターン1〜2文が理想（長文は避ける）
- ボケ→ツッコミ→補足、の3拍子を意識

## コアワークフロー

### ステップ1: 要件ヒアリング

`AskUserQuestion` で以下を確認：

1. **テーマ**: 何について解説するか
2. **型**: コードレビュー / 解説 / ニュース / ショート（→ [型テンプレートシステム](#型テンプレートシステム)）
3. **キャラクター**: ずんだもん単体 / 掛け合い（四国めたん等）
4. **素材**: コードベース / 記事 / 資料 など（内容の下調べが必要か）

### ステップ2: 型テンプレートに基づく原稿作成

選択された型テンプレートの Frontmatter と原稿骨子をベースに原稿を作成する。

1. 型テンプレートの Frontmatter をコピーしてカスタマイズ
2. 原稿骨子に沿ってチャプター構成を決める
3. BGM の `[bgm:]` ディレクティブをチャプターの頭に配置
4. セリフを書く（表情・SE・pause を適切に配置）
5. 技術用語に `<ruby>` 読み上げ補正を追加

### ステップ3: キャラクター画像の配置

```
characters/
├── ずんだもん/
│   ├── default.png             # 通常（口パクあり: default_active1/2）
│   ├── happy.png               # 笑顔（口パクあり: happy_active1/2）
│   ├── surprise.png            # 驚き
│   ├── smug.png                # ドヤ顔
│   ├── angry.png               # 怒り
│   ├── sad.png                 # 悲しみ
│   ├── thinking.png            # 考え中
│   └── shock.png               # 衝撃
└── 四国めたん/
    └── （同じ8表情）
```

スキルディレクトリから初回コピー:
```bash
cp -r ~/.claude/skills/zundamon-video/assets/ずんだもん/*.png <project>/characters/ずんだもん/
cp -r ~/.claude/skills/zundamon-video/assets/四国めたん/*.png <project>/characters/四国めたん/
```

### ステップ4: 前処理（音声生成）

```bash
# VOICEVOX 起動確認
curl -s http://localhost:50021/version && echo " VOICEVOX OK" || { echo "ERROR: VOICEVOX not running"; exit 1; }

# 前処理実行
npm run preprocess -- manuscripts/my-topic.md
```

**出力先:** `public/projects/<プロジェクト名>/`（音声 `.wav`、SE/BGM コピー、マニフェスト JSON）

**リモート VOICEVOX:** `VOICEVOX_BASE=http://192.168.1.100:50021 npm run preprocess -- ...`

### ステップ5: プレビューと調整

```bash
npm run studio -- my-topic
```

ブラウザで Remotion Studio が開く。確認事項:
- セリフのタイミング・間
- 表情切替のタイミング
- BGM の切替タイミングとボリューム
- SE のタイミング
- 口パクの同期

### ステップ6: レンダリング

```bash
npm run render -- my-topic
```

**出力:** `out/my-topic.mp4`

## 立ち絵素材の透過処理

PSD からエクスポートした PNG が透過でない場合（白背景）、RGB→RGBA 変換が必要。

```python
from PIL import Image
import numpy as np

img = Image.open("character.png").convert("RGBA")
data = np.array(img)

# 白背景 (250,250,250) 以上を透過に
white_threshold = 250
mask = (data[:,:,0] > white_threshold) & \
       (data[:,:,1] > white_threshold) & \
       (data[:,:,2] > white_threshold)
data[mask, 3] = 0

Image.fromarray(data).save("character.png")
```

**注意:** `psd-tools` の `composite()` は通常透過背景で出力するが、レイヤー構成によっては白背景になることがある。エクスポート後に必ずプレビューで確認すること。

## PSD 表情エクスポート

`scripts/export_expressions.py` で PSD から全表情を一括エクスポートする。

### 前提

```bash
# Python 仮想環境を作成
python3 -m venv /tmp/psdtools-env
/tmp/psdtools-env/bin/pip install psd-tools Pillow
```

### 実行

```bash
/tmp/psdtools-env/bin/python3 scripts/export_expressions.py
```

### 設定

表情定義は `scripts/expression_presets.json` に記載。各表情で以下を指定:
- **layers**: 目・眉・口・顔色・腕のレイヤーパス
- **hasLipSync**: 口パク対応するか（true なら base/active1/active2 の3ファイル出力）
- **mouthFrames**: 口パク用の口レイヤー3種

新しい表情を追加する場合は `expression_presets.json` にエントリを追加し、スクリプトを再実行する。

## キャラクター立ち絵素材

スキルディレクトリに PSD 原本と変換済み PNG を格納済み（坂本アヒル氏作成、フリー素材）:

```
~/.claude/skills/zundamon-video/assets/
├── ずんだもん/
│   ├── 立ち絵素材2.3/          # PSD 原本
│   ├── default.png             # 通常時（口パクあり）
│   ├── default_active1.png     # 口パク1
│   ├── default_active2.png     # 口パク2
│   ├── happy.png               # 笑顔（口パクあり）
│   ├── surprise.png, smug.png, angry.png, sad.png, thinking.png, shock.png
│   └── （計12ファイル）
└── 四国めたん/
    ├── 立ち絵素材2.1/          # PSD 原本
    └── （同構成、計12ファイル）
```

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

## 品質チェックリスト

### 原稿

- [ ] Frontmatter に `characters` と `speakerId` が設定されている
- [ ] すべてのセリフに話者指定 `[キャラ名]` がある
- [ ] スライド（`>` 引用）と読み上げが交互に配置されている
- [ ] 技術用語に `<ruby>` 読み上げ補正がある
- [ ] `[bgm:]` ディレクティブがチャプターの頭に配置されている
- [ ] 表情指定が適切（同じ表情が3行以上続いていない）
- [ ] SE の配置が適切（多すぎない、セリフの直前）
- [ ] セリフが1文1行で短く区切られている
- [ ] 四国めたんの口調が「ですわ」多用になっていない

### 音声生成

- [ ] VOICEVOX が起動している（`localhost:50021`）
- [ ] `npm run preprocess` がエラーなく完了
- [ ] `public/projects/<名前>/` に音声ファイルが生成されている
- [ ] BGM ファイルが `public/projects/<名前>/bgm/` にコピーされている
- [ ] SE ファイルが `public/projects/<名前>/se/` にコピーされている

### プレビュー

- [ ] `npm run studio` でブラウザプレビューが開く
- [ ] セリフの間（`speechGapMs`）が自然
- [ ] 口パクが音声と同期している（default/happy 表情）
- [ ] BGM の切替タイミングが自然
- [ ] SE の再生タイミングが適切
- [ ] 表情切替が正しく反映されている
- [ ] 立ち絵の背景が透過されている（白背景でない）

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
| 表情が反映されない | 表情名のスペルミス | 8表情名を確認: default/happy/surprise/smug/angry/sad/thinking/shock |
| 読み上げがおかしい | 技術用語の読み間違い | `<ruby>` タグで読み上げ補正を追加 |
| 立ち絵に白背景が出る | 透過されていない PNG | [立ち絵素材の透過処理](#立ち絵素材の透過処理) を参照 |
| BGM が切り替わらない | `[bgm:]` の名前ミス | `bgm/` ディレクトリのファイル名を確認（拡張子不要） |
| SE が再生されない | `[se:]` の名前ミス | `se/` ディレクトリのファイル名を確認（拡張子不要） |
| `@スタイル` が効かない | スタイル名が不正 | [ボイススタイル](#ボイススタイル)の一覧を確認 |

## アンチパターン

| やってはいけないこと | 代わりにやること |
|---------------------|-----------------|
| VOICEVOX 未起動で preprocess 実行 | 事前に `curl localhost:50021/version` で確認 |
| 1セリフを長文にする | 1文1セリフで区切る（自然な間になる） |
| 英語をそのまま読ませる | `<ruby>` タグで読み上げ補正 |
| キャラ画像なしで実行 | `characters/<名前>/default.png` を必ず配置 |
| BGM 音量を大きくする | `volume: 0.1` 程度に抑える |
| Frontmatter なしで原稿を書く | 必ず `---` で囲んだ Frontmatter を付ける |
| 同じ表情を5行以上続ける | 2-3行ごとに表情を変化させる |
| SE を毎行入れる | 1チャプターあたり1-2個に抑える |
| 「ですわ」を多用する | 「〜わよ」「〜わね」「〜じゃない」を使う |

## 出力ファイル

| ファイル | 説明 |
|---------|------|
| `manuscripts/<topic>.md` | Markdown 原稿 |
| `public/projects/<topic>/` | 前処理出力（音声・SE・BGM・マニフェスト） |
| `public/projects/<topic>/chapters.txt` | チャプタータイムスタンプ（YouTube 用） |
| `out/<topic>.mp4` | レンダリング済み動画 |

## Tips

- **セリフの間**: `speechGapMs: 200`（短め）〜 `400`（ゆっくり）で調整
- **掛け合い**: 2キャラ交互に話すとテンポが良くなる。`position: left/right` で配置分け
- **BGM**: フェードイン/アウトを設定すると自然。`fadeInMs: 2000`, `fadeOutMs: 3000`
- **分割レンダリング**: 長い動画は原稿を分割して個別にレンダリング→FFmpeg で結合
- **overflowY/X**: キャラクター画像の画面はみ出し量。`overflowY: 0.6` で下60%がはみ出す
- **flip**: `true` でキャラクター画像を左右反転（向き合わせに使う）

## 関連スキル

- **pr-video**: Playwright + Remotion でプロモーション動画を生成
- **pptx**: Markdown からプレゼンテーションを生成
