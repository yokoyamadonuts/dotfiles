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

### Step 8（任意）: バトルシミュレーションによる検証

構築案を仮想敵チームと対戦させて検証する:

```bash
# Showdown packed format でチームを渡す
$POKE battle run \
  --p1-team "[packed format]" \
  --p2-team "[仮想敵のpacked format]" \
  --p1-name "提案構築" \
  --p2-name "仮想敵"
```

バトルログから以下を分析:
- 選出パターンが理論通りに機能したか
- ダメージ計算通りの展開になったか
- 想定外の負け筋がないか

問題が見つかったらStep 4〜6に戻って調整する。

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
