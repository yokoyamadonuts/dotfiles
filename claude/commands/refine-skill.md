---
description: "既存スキルを経験駆動で改善する。validate-skill と .memory.md のシグナルから SKILL.md を改善し、普遍的教訓を lessons.md へ昇格。"
argument-hint: "[スキル名]"
---

# /refine-skill - スキル改善コマンド

既存スキルを `refining-skills` スキルのワークフローで改善する。

> **関連スキル**: `refining-skills` — 6 ステップの改善ループ（gather→diagnose→improve→re-validate→promote）と昇格判断。本コマンドはそのワークフローを起動する。
> **依存**: `validate-skill`（SP2 の決定論ゲート）, `.memory.md` / `references/lessons.md`（SP1）。

## 使い方

```
/refine-skill pptx
/refine-skill            # 引数なし → 対象を尋ねる
```

---

## [1/2] 対象スキルの特定

- `$1` があればそれを対象スキル名とする。
- 空の場合、`validate-skill --all` を実行して Warning のあるスキルを提示し、AskUserQuestion で対象を選んでもらう:

```bash
deno run --allow-read --allow-run --allow-env \
  $HOME/.claude/skills/reviewing-skills/scripts/validate-skill.ts --all
```

```javascript
AskUserQuestion({
  questions: [
    {
      question: "どのスキルを改善しますか？（--all の結果で Warning のあるスキルが有力候補）",
      header: "対象スキル",
      options: [
        { label: "スキル名を入力", description: "改善する既存スキル名を直接指定" }
      ],
      multiSelect: false
    }
  ]
})
```

---

## [2/2] refining-skills の実行

Skill ツールで `refining-skills` を起動し、対象スキル名を渡す:

```javascript
Skill({ skill: "refining-skills", args: "<スキル名>" })
```

`refining-skills` が gather → diagnose → improve → re-validate → promote → report を実行する。

---

## 重要な注意事項

- **自動コミットしない**。改善後は `/commit`（committer）でレビューして確定する。
- シグナルが無ければ「改善点なし」で終了し、ファイルを編集しない。
- 改善ループは最大 3 回。収束しなければ報告して停止。
