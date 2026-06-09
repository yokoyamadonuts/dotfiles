---
description: "全スキルの健全性カタログを表示。validate-skill + .memory.md + fs を集約し refine/merge 候補を advisory に提示。"
argument-hint: ""
---

# /skill-catalog - スキル健全性カタログ

全スキルの健全性を一望し、手を入れるべきスキルを示す（advisory・非破壊・常に exit 0）。

> **依存**: `validate-skill`（SP2, Tier-1 を再利用）, `.memory.md`（SP1）, アクション先は `/refine-skill`（SP3）。

## 実行

```bash
deno run --allow-read --allow-env \
  $HOME/.claude/skills/reviewing-skills/scripts/catalog-skills.ts
```

出力: スキル別の validate / 行数 / tests / memory(Failure Modes 数) / lessons ＋推奨（refine / ok）＋ OVERLAP CANDIDATES。

## 推奨の扱い

- **refine**: `/refine-skill <name>` で改善する（SP3）。
- **merge? 候補（OVERLAP）**: 人が判断する。重複なら手動でマージ。ヒューリスティックは過検出ありうる前提。
- カタログは「地図」。破壊的アクションはしない。
