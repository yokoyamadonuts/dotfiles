---
name: validate-idea
description: コードを書く前にアイデアを検証する。6秒テスト、Scratch Your Own Itchテスト、支払いテスト、競合確認、Build可能性の5つのゲートで判定。「アイデアを検証して」「このアイデアどう？」「作る前に確認したい」などのリクエストで起動。
---

# アイデア検証スキル

## 概要

コードを1行も書く前にアイデアの価値を検証する。5つのゲートを順番に通過したアイデアだけが開発に値する。**ほとんどのアイデアはここで落ちるべき**——それが正常。

## なぜ重要か

- インディー開発者の最大の失敗は「誰も欲しがらないものを作る」こと
- コードを書く時間はゼロコストではない。検証は数時間、開発は数週間
- 「自分が欲しい」と「他人が金を払う」は別の問題

## コアワークフロー

### Gate 1: 6秒テスト（Jack Friks方式）

```javascript
AskUserQuestion({
  questions: [
    {
      question: "このプロダクトを6秒で説明してください。「[ターゲット]が[問題]を解決するための[ソリューション]」の形式で。",
      header: "6秒テスト",
      options: [
        { label: "説明できる", description: "明確な一文で説明できた" },
        { label: "難しい", description: "6秒では説明しきれない" }
      ],
      multiSelect: false
    }
  ]
})
```

**判定基準**:
- **PASS**: 一文で説明できる。聞いた人が「なるほど」と言える
- **FAIL**: 説明に30秒以上かかる、または「〜と〜と〜ができて...」になる

**FAILの場合**: スコープを絞るか、別のアイデアへ。複雑なアイデアは個人開発に向かない。

### Gate 2: Scratch Your Own Itch テスト（Pieter Levels方式）

```javascript
AskUserQuestion({
  questions: [
    {
      question: "このプロダクト、自分で使いますか？",
      header: "自分テスト",
      options: [
        { label: "毎日使う", description: "自分の日常の問題を解決する" },
        { label: "たまに使う", description: "時々必要になる" },
        { label: "使わない", description: "他人向けのプロダクト" }
      ],
      multiSelect: false
    },
    {
      question: "今、この問題をどう解決していますか？",
      header: "現状の代替手段",
      options: [
        { label: "手作業で対処", description: "スプレッドシート、手動作業等" },
        { label: "既存ツールで不満", description: "ツールはあるが使いにくい" },
        { label: "諦めている", description: "解決を諦めている" },
        { label: "問題を感じない", description: "特に困っていない" }
      ],
      multiSelect: false
    }
  ]
})
```

**判定基準**:
- **PASS**: 自分で使う + 現状に不満がある
- **WARN**: 自分では使わないが、身近に強い需要がある
- **FAIL**: 自分で使わない + 需要の根拠がない

### Gate 3: 支払いテスト（48時間ランディングページ）

**目的**: 「欲しい」と「金を払う」は別問題。実際の支払い意思を確認する。

**手順**:
1. ランディングページを作る（ボイラープレートから2-3時間）
2. 「Buy Now」ボタンを設置（Stripe Checkout）
3. 価格を表示する（実際の予定価格）
4. SNS・コミュニティで共有
5. 48時間待つ

```javascript
AskUserQuestion({
  questions: [
    {
      question: "48時間の支払いテストの結果はどうでしたか？",
      header: "支払いテスト",
      options: [
        { label: "購入者あり", description: "実際に支払った人がいる" },
        { label: "問い合わせあり", description: "購入はないが質問や関心が寄せられた" },
        { label: "反応なし", description: "トラフィックはあったが反応ゼロ" },
        { label: "まだ実施していない", description: "これから実施する" }
      ],
      multiSelect: false
    }
  ]
})
```

**判定基準**:
- **PASS**: 1人でも購入者がいる → 即座にMVP開発へ
- **WARN**: 問い合わせのみ → メッセージングを変えて再テスト
- **FAIL**: 反応ゼロ → アイデアを変える or ターゲットを変える

**テストをスキップしたい場合**: 最低限、ランディングページだけは作る。メールアドレス登録でも可。

### Gate 4: 競合確認

競合がいることは**良い兆候**。市場が存在する証拠。

```javascript
AskUserQuestion({
  questions: [
    {
      question: "競合プロダクトはありますか？",
      header: "競合状況",
      options: [
        { label: "直接の競合あり", description: "同じ問題を解決する類似プロダクト" },
        { label: "間接の競合のみ", description: "スプレッドシート、手作業等の代替手段" },
        { label: "競合なし", description: "同様のプロダクトが見当たらない" }
      ],
      multiSelect: false
    }
  ]
})
```

**判定基準**:
- **PASS**: 競合あり + 自分なりの差別化がある（UX、価格、特定ニッチ）
- **WARN**: 競合なし → 市場がない可能性。慎重に。
- **PASS**: 間接の競合のみ → 良い機会。専用ツールの価値がある

**競合がいる場合の差別化質問**:
- 競合の何が不満か？（UX、価格、機能）
- 10倍良くできる点は何か？
- 競合がターゲットしていないニッチはあるか？

### Gate 5: Build可能性

```javascript
AskUserQuestion({
  questions: [
    {
      question: "自分のスタックでMVPを何日で作れますか？",
      header: "開発期間",
      options: [
        { label: "1日以内", description: "Vibe Codingで即日出荷" },
        { label: "2-5日", description: "週末MVPで十分" },
        { label: "1-2週間", description: "標準的なMVP" },
        { label: "2週間以上", description: "スコープが大きすぎる可能性" }
      ],
      multiSelect: false
    }
  ]
})
```

**判定基準**:
- **PASS**: 2週間以内で作れる
- **WARN**: 2週間以上 → スコープを削る。コア機能だけに絞る
- **FAIL**: 1ヶ月以上 → インディー開発に向かない。スコープを根本的に見直す

## 最終判定

全ゲートの結果を総合評価する：

| 結果 | 判定 | アクション |
|------|------|-----------|
| 全PASS | ✅ GO | `mvp-scaffolding` でMVP構築開始 |
| 1つWARN | ⚠️ GO（注意） | WARNの対策を講じてから開発 |
| 2つ以上WARN | ⚠️ 再検討 | アイデアを修正して再テスト |
| 1つ以上FAIL | ❌ STOP | 別のアイデアへ |

## 出力ファイル

- `docs/validation-[idea-name].md` - 検証結果レポート

### テンプレート

```markdown
# アイデア検証: [アイデア名]

検証日: [日付]
総合判定: [GO / 再検討 / STOP]

## 6秒説明
[一文の説明]

## ゲート結果

| ゲート | 結果 | メモ |
|--------|------|------|
| 6秒テスト | PASS/WARN/FAIL | [詳細] |
| 自分テスト | PASS/WARN/FAIL | [詳細] |
| 支払いテスト | PASS/WARN/FAIL | [詳細] |
| 競合確認 | PASS/WARN/FAIL | [詳細] |
| Build可能性 | PASS/WARN/FAIL | [詳細] |

## 差別化ポイント
[競合との差別化]

## MVPスコープ
[最小限の機能リスト]

## 次のアクション
- [ ] [アクション1]
- [ ] [アクション2]
```

## 関連スキル

- **mvp-scaffolding**: 検証PASSしたアイデアのMVP構築
- **launch-playbook**: ローンチ戦略策定
- **competitive-research**: 競合の詳細調査（必要な場合）
- **build-in-public**: 検証プロセス自体をコンテンツ化

---

**覚えておくこと: 最高のアイデアは「自分の痒いところを掻く」もの。6秒で説明できないなら複雑すぎる。金を払う人がいないなら需要がない。**
