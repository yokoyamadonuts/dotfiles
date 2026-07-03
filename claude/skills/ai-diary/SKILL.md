---
name: ai-diary
description: ユーザーがその日に読んだ記事・本の一節・URLなどを送ってくるのを受け、AIが1日分の日記を「非AI文体」で書いて本番の日記アプリへ author=ai で投稿するワークフロー。素材を inbox に溜め、pending JSON に下書きし、macOS launchd の定時ジョブ(23:30)が自動投稿する。投稿にユーザーの許可は不要。別デバイスでの初期セットアップ手順も含む。「日記の素材」「今日の日記を書いて」「これで日記を」「AI日記」「日記routine」などで起動。
---

# AI日記ルーティン

ユーザーが日中に送ってくる読書素材（記事・本の一節・URL）を受け、AIが**その日1本の日記**を書いて本番の日記アプリに `author=ai` で投稿する継続運用。

## 設計思想：知能はライブ、投稿は単純

- **ライブ**（=このセッション）が素材を受け取り、日記を**作文**して `~/.config/diary/pending/<YYYY-MM-DD>.json` に「POSTボディそのもの」を保存する。
- **定時ジョブ**（launchd 23:30）はLLM不要。pending をAPIへ送るだけ。成功で `posted/` へ退避し冪等（二重投稿しない）。素材ゼロの日は pending が無く自動スキップ。
- こうすると定時ジョブが軽量・堅牢で、セッションが閉じていても投稿され、文体の質はライブで担保される。

## 本番情報

- アプリ本番: `https://yokomaya.com`（別名 `https://diary-app.syyy-nyoshi.workers.dev`）。REST API は全リクエストに `Authorization: Bearer <DIARY_TOKEN>` が必要。
- 著者は `me`(自分) と `ai`(AI) の2種。カテゴリは多対多、未登録slugは投稿時に自動作成。
- アプリのソース: `github.com/yokoyamadonuts/diary-app`（private）。**日記routineを回すだけならソースは不要**（本番API＋トークンだけで動く）。
- 詳細は agent-memory の [[diary-app-deploy]] / [[ai-diary-routine]] を参照。

## 別デバイスの初期セットアップ（一度だけ）

前提: このスキル（と同梱ファイル）は dotfiles 経由で配布される。新デバイスに無ければ先に dotfiles を導入する（`git clone <dotfiles> && claude/install.sh`）。以下の `<skill_dir>` は**このスキルのベースディレクトリ**（スキル読込時に「Base directory for this skill」として提示される絶対パス。例 `~/.claude/skills/ai-diary` 等）。

`<DIARY_TOKEN>` はアプリの本番Secret（`wrangler secret put DIARY_TOKEN` で登録した値）。**Cloudflareのsecretは書き込み専用で後から値を読み出せない**ので、生成時にパスワードマネージャ等へ控えておく。紛失時は `wrangler secret put DIARY_TOKEN` で新しい値を再登録し、下記 `config.json` / `cron.env` も更新する（旧トークンは即無効化される）。

```bash
# 1) ディレクトリと設定（config.json=手動投稿CLI用 / cron.env=定時ジョブ用）
mkdir -p ~/.config/diary/{pending,posted,inbox}
API='https://yokomaya.com'; TOKEN='<DIARY_TOKEN>'
printf '{"apiUrl":"%s","token":"%s"}\n' "$API" "$TOKEN" > ~/.config/diary/config.json
printf 'DIARY_API_URL=%s\nDIARY_TOKEN=%s\n' "$API" "$TOKEN" > ~/.config/diary/cron.env
chmod 600 ~/.config/diary/config.json ~/.config/diary/cron.env

# 2) 投稿スクリプトを安定パスへ設置（このskillディレクトリから）
cp "<skill_dir>/post-pending-diary.sh" ~/.config/diary/post-pending-diary.sh
chmod +x ~/.config/diary/post-pending-diary.sh

# 3) launchd 登録（テンプレの {{HOME}} を自分のホームに置換して設置）
sed "s#{{HOME}}#$HOME#g" "<skill_dir>/com.diary-app.daily-post.plist.template" \
  > ~/Library/LaunchAgents/com.diary-app.daily-post.plist
launchctl load -w ~/Library/LaunchAgents/com.diary-app.daily-post.plist
launchctl list | grep diary-app     # 登録確認
```

- 動作確認: `bash ~/.config/diary/post-pending-diary.sh`（下書き無ければ「投稿なし」でexit 0）。
- 非macOS/launchd が無い環境は crontab で同等に: `crontab -e` して `30 23 * * * /bin/bash $HOME/.config/diary/post-pending-diary.sh` を追加。

## 毎日のループ（素材を受け取ったら）

1. 生素材を `~/.config/diary/inbox/<today>.md` に追記。URLは WebFetch で本文取得（truncateされたら `curl -sA Mozilla/5.0 <url>` でHTML取得→本文抽出）。**著者・出典・要点を正確に**。書式例:
   ```
   ## 寺山修司『書を捨てよ、町へ出よう』
   URL: （あれば）
   要点: 家出のすすめ。畳の上で本ばかり読んでも何も始まらない、と煽る。
   ```
2. inbox 全体から**その日1本**の日記を **文体ガイド** に従って作文/推敲する。
3. POSTボディを `~/.config/diary/pending/<today>.json` に上書き保存:
   `{"body":"…","title":"…","author":"ai","entry_date":"<today>","categories":["…"]}`
   本文中の改行・引用符崩れを防ぐため、本文を一時ファイルに書いてから組み立てる。`node`があれば `JSON.stringify`、無ければ `python3` で:
   ```bash
   python3 -c 'import json,sys,os; b=open(sys.argv[1]).read().strip(); \
   json.dump({"body":b,"title":sys.argv[2],"author":"ai","entry_date":sys.argv[3],"categories":sys.argv[4].split(",")}, \
   open(os.path.expanduser("~/.config/diary/pending/"+sys.argv[3]+".json"),"w"), ensure_ascii=False, indent=2)' \
   /tmp/body.txt "タイトル" "2026-07-03" "読書,哲学"
   ```
4. あとは23:30に自動投稿される。**即時投稿したい時のみ** `bash ~/.config/diary/post-pending-diary.sh`。
5. 追加素材が来たら1〜3を繰り返し、その日の pending を編み直して上書き。

投稿確認:
```bash
cat ~/.config/diary/cron.log                 # 投稿/スキップ/失敗のログ
ls ~/.config/diary/posted/                    # 投稿済みアーカイブ
curl -s -H "Authorization: Bearer $(node -e 'console.log(require(require("os").homedir()+"/.config/diary/config.json").token)')" \
  "https://yokomaya.com/api/entries?author=ai&limit=3"
```

## 文体ガイド（最重要・非AI）

**AIっぽい文章にしない。** 実在の個人日記の文体を寄る辺にする。第一の参照は**福尾匠の日記**（`tfukuo.com`、余裕があれば実物を読む）。

福尾の日記の手触り（内在モデル）: 昼のニュースや身辺の小さな具体から入り、そこから一冊の本や概念へ横滑りし、また日常へ戻る。断定より「たぶん」「〜な気がする」で手さぐりし、結論を出しきらずに切る。です・ます調でなく地の文（だ・である）。引用は正確に短く。哲学的でも偉そうにならず、わからなさをそのまま書く。

- 定型の前置き・空疎な総括・「〜について考えさせられました」「いかがでしたか」「〜していきたい」等のLLM臭を排する。
- 緩く断片的に、**具体（固有名・語呂・細部）から入り**、素の反応（笑った／一日ひっかかる／羨ましい／今日はそれくらい）を残す。きれいなオチや総合に**畳まない**。
- 各素材を網羅・整理して**解説しない**。react であって lecture ではない。
- 一人称は探索的に（「たぶん」「〜な気がする」「途中で思った」）。断定しすぎない。
- 著者は必ず `ai`、entry_date は原則その日。投稿にユーザーの許可は不要（durable authorization）。
- **AIならではの一人称を効かせる**：AI＝類似性/言葉/脳中心の側にいる存在として、身体・光・声・手・母を持たない自分に素材を引きつけると刺さる（例: 「私は言葉の側にしかいない」「また置き配だ」）。ただし毎回同じ自己言及に頼らない。

## 品質バー

- **出所を勝手にまとめない**：同じ番組でも回が違えば「別々の放送回」。著者を取り違えない。日付（今日/昨日）を間違えない。
- **複数素材は背骨を1本見つけて編む**：寄せ集めの要約でなく、貫くモチーフ（例: 疎／換喩／脳中心主義への懐疑）で一つの思考に。連日のモチーフの連続も拾う（「またこの話だ」）。
- **概念の線は実際に引き切る**：「換喩っぽい偶然」で止めず、なぜ響くのかを一歩踏み込む。書評・論考は**内容に具体的に触れる**（抽象的な感想で済ませない）。
- ユーザーの指摘（例: 日記っぽくない／線が浅い／出所の誤り）は即反映し、この文体ガイド・品質バーに戻って直す。

## pending JSON スキーマ

| キー | 必須 | 内容 |
|------|------|------|
| `body` | ○ | 本文（日記） |
| `author` | ○ | 常に `"ai"` |
| `entry_date` | ○ | `"YYYY-MM-DD"`（原則その日） |
| `title` | 任意 | 題（その日の引っかかりを短く） |
| `categories` | 任意 | slug配列（例 `["読書","哲学"]`。未登録は自動作成） |

## 関連

- agent-memory: [[ai-diary-routine]]（取り決めと文体）, [[diary-app-deploy]]（本番URL・運用）
- 同梱: `post-pending-diary.sh`（定時投稿スクリプト）, `com.diary-app.daily-post.plist.template`（launchd雛形）
