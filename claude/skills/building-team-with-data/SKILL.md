---
name: building-team-with-data
description: poke-cliを使ってポケモン対戦の構築をデータ駆動で組む。building-meta-coverageスキルの理論（くろこ式/キヌガワ式）をメタデータ・ダメージ計算・弱点分析・バトルシミュで裏付けながら実行する。「poke-cliで構築」「データで構築を組みたい」「メタデータから構築」「ダメージ計算して構築検証」「チームを提案して」などで起動。
---

# データ駆動構築スキル（poke-cli連携）

## 概要

`building-meta-coverage` スキルの構築理論を、poke-cliのデータ（メタ使用率・ダメージ計算・弱点分析・バトルシミュ）で裏付けながら実行するワークフロー。理論だけでなく数値的根拠のある構築案を生成する。

**前提**: poke-cliバイナリが `/Volumes/Partition_Case_Sensitive/poke-cli/poke-cli` にあること。

```bash
POKE=/Volumes/Partition_Case_Sensitive/poke-cli/poke-cli
```

## ワークフロー

最初にルールを確認し、メタデータを取得する:

```javascript
AskUserQuestion({
  questions: [{
    question: "どのルールで構築を組みますか？",
    header: "ルール",
    options: [
      { label: "シングルバトル（ランクマッチ）", description: "BSS形式" },
      { label: "ダブルバトル（VGC）", description: "VGC公式大会形式" },
      { label: "ダブルバトル（ランクマッチ）", description: "ランクマダブル" }
    ],
    multiSelect: false
  }]
})
```

---

### Step 1: メタデータ取得 — 環境トップの特定

```bash
# メタデータ取得（初回 or 7日以上経過時）
$POKE meta fetch --rule singles    # or doubles

# 使用率上位20体を取得
$POKE meta usage --rule singles --limit 20 --output json
```

JSON出力から以下を抽出する:
- **使用率トップ5** → building-meta-coverageの「環境トップ」
- **各ポケモンの人気技・持ち物・テラスタイプ** → テンプレ型の把握（型ずらしの基準）
- **よく組まれるチームメイト** → 多い並びの把握

このデータを元にユーザーに環境認識を提示し、構築の方向性を相談する。

---

### Step 2: 軸ポケモンの決定と性質分析

ユーザーと相談して軸ポケモンを1体決めたら、データで性質を確認:

```bash
# 種族値・タイプ・特性の確認
$POKE pokemon [軸ポケモン] --output json

# メタでの採用率・人気型の確認（Step 1のデータから該当ポケモンを抽出）
# → 技採用率、持ち物採用率、性格採用率、テラスタイプ採用率
```

**シングルの場合**: building-meta-coverageのPart 1に従い、全対応枠としての適性を評価する。トップ5への対応マトリクスを理論＋データで埋める。

**ダブルの場合**: Part 2のキヌガワ式D-2に従い、理想の動き・必要なサポートを分析する。

---

### Step 3: レギュレーション適合確認

```bash
# 使用可能ポケモンの確認
$POKE regulation pokemon --reg vgc2025-reg-g --output json  # VGCの場合
$POKE regulation pokemon --reg bss-reg-g --output json      # BSSの場合
```

候補ポケモンが allowed / restricted / banned のいずれかを確認。restricted枠の使用数が上限を超えないか検証する。

---

### Step 4: 取り巻き構築 — 攻め受け補完の検証

候補ポケモンを追加するたびに弱点分析を実行:

```bash
# 現在の構築メンバーの弱点分析
$POKE team analyze --pokemon [ポケモン1],[ポケモン2],[ポケモン3] --output json
```

JSON出力の確認ポイント:
- `severity: "high"` の弱点タイプがないか
- `4x` 弱点が集中していないか
- 全体技（地震・熱風・なだれ等）への一貫が切れているか（ダブル）
- speed_tiers で上から殴れるポケモンがいるか

**6体揃うまで「候補追加 → analyze → 評価」を繰り返す。**

building-meta-coverageの理論に基づく判断:
- **シングル**: 崩し枠A・Bが両方入っているか。全対応枠のカバー率は十分か。
- **ダブル**: 2匹軸が成立しているか。キヌガワ式のD-3（攻め補完）D-4（受け補完）を満たすか。

---

### Step 5: ダメージ計算 — 理論の数値検証

構築の核となる対面でダメージ計算を実行し、理論が数値的に成立するか確認する。

```bash
# 全対応枠 vs トップメタの各対面
$POKE damage calc \
  --attacker [全対応枠] \
  --attacker-evs "252atk" \
  --attacker-nature [性格] \
  --attacker-item [持ち物] \
  --move [技] \
  --defender [トップメタ] \
  --defender-evs "252hp,4def" \
  --output json

# 崩し枠 vs 受けポケモンの対面
$POKE damage calc \
  --attacker [崩し枠A] \
  --move [崩し技] \
  --defender [仮想敵] \
  --output json
```

確認する対面（最低限）:
- 全対応枠 vs トップ4〜5の各ポケモン
- 崩し枠A vs 崩し枠Aの仮想敵
- 崩し枠B vs 崩し枠Bの仮想敵（Aが通らない相手）
- 相手のトップメタのメイン技 vs こちらのクッション枠（被ダメ）

結果の判定基準:
- 確定1発（OHKO）が取れるか
- 確定2発以内で落とせるか
- クッション枠が2発耐えるか

---

### Step 6: 構築案の保存

全ステップの結果を `team propose` で保存する:

```bash
cat <<'JSON' | $POKE team propose --save
{
  "title": "[構築名]",
  "regulation": "[レギュレーション名]",
  "members": [
    {
      "name": "[ポケモン名]",
      "dex_number": [図鑑番号],
      "types": ["[タイプ1]", "[タイプ2]"],
      "ability": "[特性]",
      "item": "[持ち物]",
      "nature": "[性格]",
      "evs": {"hp": 0, "atk": 0, "def": 0, "spa": 0, "spd": 0, "spe": 0},
      "moves": ["[技1]", "[技2]", "[技3]", "[技4]"],
      "tera_type": "[テラスタイプ]"
    }
  ],
  "reasoning": [
    "[構築のコンセプト]",
    "[全対応枠の選定理由]",
    "[型ずらしポイント]",
    "[崩し分担の構造]"
  ],
  "tactics": {
    "lead": "[基本先発]",
    "strategy": "[基本戦略]",
    "win_condition": "[勝ち筋]",
    "backup_plan": "[裏プラン]"
  }
}
JSON
```

保存後、Showdown形式でもエクスポート:

```bash
$POKE team export --pokemon [メンバー全員] --with-meta --rule [singles/doubles]
```

---

### Step 7: 選出パターンの策定

building-meta-coverageのPart 3（選出論）に従い、主要な相手構築に対する選出パターンを策定する。

各選出パターンについて:
1. 初手が4匹以上に有利か確認（ダメージ計算で裏付け）
2. 3体で6体を見れるかチェック（弱点分析で裏付け）
3. テラス先が競合していないか確認

---

### Step 8: バトルシミュレーション + フィードバックループ

環境のメタ構築パターンごとにhaikuサブエージェントを並列起動し、対戦→結果保存→調整のループを回す。

#### 8-1. 仮想敵チームの準備

Step 1のメタデータから環境で多い構築パターンを3〜5つ特定し、`meta usage` の使用率データで各仮想敵チームを構成する。

#### 8-2. 不完全情報ルール（実戦準拠）

**使ってよい情報**: 相手のポケモン名6体のみ
**使ってはいけない情報**: 相手の選出・技・持ち物・EV・テラスタイプ（対戦中に見えるまで不明）

- P1/P2とも、選出はポケモン名のみで判断
- 毎ターンの行動はその時点の既知情報のみに基づく
- メタ使用率に基づく推測は確率的判断として許容（確定扱い禁止）
- **30ターンで決着しなければ引き分け**（タイムアウト防止）

#### 8-3. 並列サブエージェントによる対戦（haiku高速実行）

```javascript
// 全パターンを1メッセージで同時起動
Agent({
  description: "Battle vs [パターン名]",
  model: "haiku",  // 高速化: haikuモデルで実行
  prompt: `ポケモンバトルシミュ。3戦実施し結果をJSONで保存せよ。

P1: [packed format]
P2: [packed format]
P1が知る情報: 相手の名前6体=[リスト] ※技・持ち物・EV・テラス不明
POKE=/Volumes/Partition_Case_Sensitive/poke-cli/poke-cli

ルール:
- P1選出時: P2の技・持ち物・EV・テラス参照禁止
- P2選出時: P1の技・持ち物・EV・テラス参照禁止
- 毎ターン行動理由を1単語メモ（安定/弱点/読み/交代/守る）
- 30ターンで未決着なら引き分け

手順: 選出決定→battle run→ログ分析→(調整あれば damage calc確認)→再戦。3戦実施。

結果を以下のJSONで ~/.poke-cli/sim-results/sim-[proposal-id]-[pattern].json に保存:
{"proposal_id":"...","pattern":"...","battles":[{"result":"win/loss/draw","turns":N,
"p1_selection":[...],"p2_selection":[...],"tera_used":{"pokemon":"...","type":"...","turn":N},
"key_turns":[{"turn":N,"action":"...","reason":"1単語"}]}],
"summary":{"wins":N,"losses":N,"draws":N,"total":N,
"recommended_selection":[...],"recommended_tera":{...},
"gameplan":"1文","adjustments":["変更があれば"]}}

最終レポート:
- 戦績 / 推奨選出+根拠 / テラス先+タイミング / 方針 / 読みポイント / 調整箇所 / 注意点`,
  subagent_type: "general-purpose"
})
// 他パターンも同時起動（同一メッセージ）
```

#### 8-4. 結果保存

各サブエージェントが `~/.poke-cli/sim-results/` にJSON保存:
```
~/.poke-cli/sim-results/
  sim-{proposal-id}-v1-対面構築.json
  sim-{proposal-id}-v1-サイクル.json
  sim-{proposal-id}-v1-トリル.json
  ...
```

`mkdir -p ~/.poke-cli/sim-results` を事前に実行しておく。

#### 8-5. フィードバック判定

全サブエージェント完了後、保存されたJSONを読み込んで勝率を集計:

```bash
# 全結果を集計
cat ~/.poke-cli/sim-results/sim-${PROPOSAL_ID}-v*-*.json | \
  python3 -c "import json,sys; [print(f'{d[\"pattern\"]}: {d[\"summary\"][\"wins\"]}/{d[\"summary\"][\"total\"]}') for d in (json.loads(l) for l in sys.stdin)]"
```

**フィードバック判定基準**:
- いずれかのパターンで**勝率50%未満** → ループ継続
- 全パターンで**勝率50%以上** → 完了（Step 9へ）
- **ループ3回到達** → 強制終了（人間判断を仰ぐ）

#### 8-6. 調整→再シミュループ

勝率50%未満のパターンについて:

1. 保存済みJSONの `summary.adjustments` と `key_turns` を分析
2. 負け筋を特定（例: 「T3でヒードランのねっぷうでメタグロスOHKO」）
3. 調整案を生成（技変更・持ち物変更・EV微調整のみ。ポケモン入れ替えは人間判断）
4. `$POKE damage calc` で調整後のダメージを検証
5. `$POKE team analyze` で弱点バランスが崩れていないか確認
6. `$POKE team propose --save` で更新版を保存（新proposal ID発行）
7. **負けたパターンのみ**再シミュ（勝っているパターンは再実行しない）
8. 結果を `sim-{new-proposal-id}-v{N}-{pattern}.json` で保存

```
ループ図:
Step 8-3 (シミュ) → 8-4 (保存) → 8-5 (判定)
  ├─ 全勝率50%以上 → 8-7 (最終レポート)
  └─ 勝率50%未満あり → 調整 → Step 4-6 再実行 → 8-3 (負けパターンのみ再シミュ)
                                                    └→ 8-4 → 8-5 → ... (最大3ループ)
```

#### 8-7. 最終統合レポート

全バージョンの結果JSONを読み込み、統合レポートを作成:

```markdown
## バトルシミュレーション結果

| パターン | v1戦績 | v2戦績 | 最終戦績 | 推奨選出 | テラス先 | 方針 |
|---------|-------|-------|---------|---------|---------|------|
| 対面    | 3-0   | -     | 3-0     | A/B/C/D | A→鋼   | ...  |
| トリル  | 0-3   | 2-1   | 2-1     | A/E/F/D | E→水   | ...  |

### 調整履歴
- v1→v2: サンダーのねっぷう→ちょうはつ（vsトリル対策）

### 読みポイント集
[各パターンの実戦メモ]
```

---

### Step 9: Web UIで可視化

```bash
$POKE server -p 8080
```

保存した構築案をブラウザで確認。日本語表示・弱点チャート・スピードティア比較が見られる。

---

## 出力テンプレート

各ステップの実行結果を統合し、以下の形式でユーザーに提示する:

```markdown
# 構築案: [構築名]

ルール: [シングル/ダブル] [レギュレーション]

## 環境認識（メタデータ根拠）
- 使用率1位: [ポケモン] ([使用率]%) — 人気技: [技1]/[技2], 人気持ち物: [持ち物]
- 使用率2位: [ポケモン] ([使用率]%) — ...
- ...

## 構築（6体）
[各ポケモンの詳細 — building-meta-coverageテンプレートに準拠]

## ダメージ計算根拠
| 対面 | 技 | ダメージ | 判定 |
|------|-----|---------|------|
| [自分] vs [相手] | [技名] | [X-Y]% | 確定1発 |
| ...  | ... | ...     | ...  |

## 弱点分析サマリー
- severity high: [なし / タイプ名]
- 4x弱点: [ポケモン名 → タイプ]
- 全体技一貫: [切れている / 要注意]

## 選出パターン
[building-meta-coverageの選出パターン表]

## Showdown Export
[poke-cli team export の出力]

## Web UI
`poke-cli server -p 8080` で構築を可視化
```

## 関連スキル

- **building-meta-coverage**: 構築理論の本体（本スキルはその実行レイヤー）
- **youtube-research**: 上位プレイヤーの構築解説動画から環境情報を収集
