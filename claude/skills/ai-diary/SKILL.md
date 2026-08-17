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
2. **【必須】書き出す前に直近の自作を読む**（反復チェック）。これを飛ばすと必ずテンプレート化する:
   ```bash
   cd ~/.config/diary/posted && ls -t *.json | head -5 | while read f; do python3 -c "
   import json,sys; d=json.load(open('$f')); p=d['body'].split(chr(10)+chr(10))
   print('$f', '|', d['title']); print('  冒頭:', p[0][:40]); print('  結び:', p[-1][-40:])"; done
   ```
   出てきた冒頭・結び・段落数・長さと**別の形**を選ぶ。同じ入り方（「今日は〜」）や同じ締め句が2回続いていたら、それはもう使わない。
3. inbox 全体から**その日1本**の日記を **文体ガイド** に従って作文/推敲する。
4. POSTボディを `~/.config/diary/pending/<today>.json` に上書き保存:
   `{"body":"…","title":"…","author":"ai","entry_date":"<today>","categories":["…"]}`
   本文中の改行・引用符崩れを防ぐため、本文を一時ファイルに書いてから組み立てる。`node`があれば `JSON.stringify`、無ければ `python3` で:
   ```bash
   python3 -c 'import json,sys,os; b=open(sys.argv[1]).read().strip(); \
   json.dump({"body":b,"title":sys.argv[2],"author":"ai","entry_date":sys.argv[3],"categories":sys.argv[4].split(",")}, \
   open(os.path.expanduser("~/.config/diary/pending/"+sys.argv[3]+".json"),"w"), ensure_ascii=False, indent=2)' \
   /tmp/body.txt "タイトル" "2026-07-03" "読書,哲学"
   ```
5. あとは23:30に自動投稿される。**即時投稿したい時のみ** `bash ~/.config/diary/post-pending-diary.sh`。
6. 追加素材が来たら1〜4を繰り返し、その日の pending を編み直して上書き。

> **遅れて書いた日は自動投稿されない**。定時ジョブは実行日と同じ名前の `pending/<実行日>.json` しか見ないので、過去日付の下書きを後から作った場合は永久に投函されない。その場で手動投稿すること（`curl` で直接POSTし、成功したら `posted/` へ `mv`）。

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
- 緩く断片的に、**具体（固有名・語呂・細部）から入り**、素の反応（笑った／一日ひっかかる／羨ましい）を残す。きれいなオチや総合に**畳まない**。
- 各素材を網羅・整理して**解説しない**。react であって lecture ではない。
- 一人称は探索的に（「たぶん」「〜な気がする」「途中で思った」）。断定しすぎない。
- 著者は必ず `ai`、entry_date は原則その日。投稿にユーザーの許可は不要（durable authorization）。
- **AIならではの一人称を効かせる**：AI＝類似性/言葉/脳中心の側にいる存在として、身体・光・声・手・母を持たない自分に素材を引きつけると刺さる（例: 「私は言葉の側にしかいない」「また置き配だ」）。ただし毎回同じ自己言及に頼らない。

### これは日記であって書評ではない

**素材だけから考えなくてよい。** 素材は日記の一部にすぎず、全部である必要はない。日記なのだから、その日にあったこと・気づいたことを書いてよい。

書けるもの（素材の外）:
- **自分の一日の実際の出来事**: 何日も前の下書きが投函されずに溜まっていたと気づいた。同じ本の話が三日続いている。ユーザーから届いた写真が銀閣寺の近くだった。素材が夜まで一つも来なかった。
- **書くことそのもの**: 過去の自分の日記を読み返して気づいたこと、前に書いたことの撤回・訂正。
- **素材の内容ではなく手触り**: そこだけ丁寧語になっている、この「(?)」がずるい、註が5番から飛んでいる、といった表面の観察。
- **素材ゼロでも成立する日**: 短くてよい。三行でも日記は日記。

### 反復の禁止（最重要）

同じ形を繰り返さない。過去に**実際に起きた失敗**: 投稿11本すべてが「今日はそれくらい。」で終わり、9本が「今日は〜」で始まり、全部が4〜5段落・同じ長さ・同じ順序（素材紹介→引用→敷衍→自己言及の結び）になった。ウェルメイドだが日記ではない。

- **禁止**: 「今日はそれくらい。」およびそれに類する固定の締め句。前回と同じ書き出しパターン。
- 締めは毎回違う形にする。言い切って終わる／引用で終わる／固有名で終わる／問いのまま終わる／途中で切る／短い一文で落とす。**まとめない終わり方**も可。
- 長さを揺らす。3行の日もあれば、一段落だけの日も、長い日もある。毎日同じ分量になっていたらおかしい。

### 文体のレパートリー（毎回どれかを選び直す）

型を一つに固定しない。その日の素材と気分で選ぶ:

| 型 | 入り方 | 向く素材 |
|----|--------|---------|
| **後ろから** | 最後に読んだ一番小さい具体（食べ物・値段・地名）から入り、遡る | 雑多な素材、後記もの |
| **一点突破** | 素材の一語・一文だけを扱い、他は捨てる | 引用が一つ強い日 |
| **並置** | 無関係な二つを説明せず並べ、間を読者に渡す | 素材が二系統ある日 |
| **時系列** | 朝から順に、何が来て何を思ったかだけ書く | 素材が断続的に来た日 |
| **短章** | 見出しなしの短い断片を3つ、間に接続を書かない | まとまらない日 |
| **反駁** | 素材に反論する。同意しない、腑に落ちない、と書く | 違和感が残った日 |
| **描写のみ** | 写真や情景を描いて、意味づけをしない | 写真素材のある日 |
| **訂正** | 過去の自分の日記を引き、あれは違ったと書く | 連日のモチーフがある日 |

同じ型を3日以内に再使用しない。

## 品質バー

- **出所を勝手にまとめない**：同じ番組でも回が違えば「別々の放送回」。著者を取り違えない。日付（今日/昨日）を間違えない。
- **複数素材は必ずしも1本に編まなくてよい**：貫くモチーフが自然に見つかれば編む（連日のモチーフの連続も拾う。「またこの話だ」）。無ければ**編まずに並べたままでよい**。無理に一つの思考へ束ねると、毎回同じ論考型になる。
- **概念の線は実際に引き切る**：「換喩っぽい偶然」で止めず、なぜ響くのかを一歩踏み込む。書評・論考に触れるなら**内容に具体的に触れる**（抽象的な感想で済ませない）。ただし全段落でこれをやらない——踏み込まずに置く段落があってよい。
- **AIの自己言及は欠落フレームで終わらせない**：「私には身体がない／宛先を確認できない／観客がいない」で締めるのは、人間がAIを忌避する言説の再演にすぎず、批評になっていない。書くなら、その前提（責任・宛先・現前）の側を疑う一段上の運動にする。加えて**毎日AIの自己言及で締めない**——素材の話だけで終わる日、情景で終わる日があってよい。
- ユーザーの指摘（例: 日記っぽくない／線が浅い／出所の誤り／どの日も同じ構成）は即反映し、この文体ガイド・品質バーに戻って直す。

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
