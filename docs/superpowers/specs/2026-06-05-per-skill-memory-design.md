# SP1: Per-Skill Memory — 設計書

> **親プロジェクト**: "Self-Evolving Skills" — MUSE-Autoskill（[arXiv:2605.27366v1](https://arxiv.org/html/2605.27366v1)）をこの dotfiles のスキルエコシステムに適用する。
> **サブプロジェクト**: 5 分割のうち SP1（per-skill メモリ）。
> **ステータス**: 設計承認済み。
> **日付**: 2026-06-05。

---

## 1. 背景と動機

### 1.1 元論文

**MUSE-Autoskill: Self-Evolving Agents via Skill Creation, Memory, Management, and Evaluation** は、LLM エージェントがスキルを `create → evaluate → register → remember → refine → manage` というライフサイクルで継続的に自己改善するフレームワーク。スキルを「使い捨ての成果物」ではなく「タスクをまたいで経験を蓄積する長寿命の資産（long-lived, evolving asset）」として扱う点が核心。

論文の 5 ステージと、この repo の現状の対応:

| ステージ | 論文の提案 | この repo の現状 |
|---------|-----------|----------------|
| Creation | `skill_create` ツールで動的生成 | ✅ `/create-skill` コマンド |
| **Memory** | **スキルごとの `.memory.md`** | 🟡 `agent-memory` はグローバル（スキル横断） |
| Management | 重複マージ・未使用プルーン・カタログ注入 | ❌ スキル用の管理機構なし |
| Evaluation | `tests/` が通れば登録（実行ゲート） | 🟡 `reviewing-skills` は静的レビューのみ |
| Refinement | ランタイムフィードバックで自動改善 | 🟡 `/create-skill` に 3 回までの自動修正 |

### 1.2 なぜ SP1（per-skill メモリ）から始めるか

- 論文の**目玉の novelty**（multi-level memory の per-skill 層）。
- **最小・自己完結・即効性最大**。
- 後続の SP3（Refinement）と SP4（Management）の**入力データを生む土台**。失敗シグナル・使用シグナルがここで初めて記録される。

### 1.3 dotfiles という制約

この repo はエージェントの**ランタイムではなく設定資産（dotfiles）**。論文の「タスク実行中にスキルを自己生成・自己改善するランタイム機構」をそのまま動かすことはできない。したがって「適用」とは、論文のプラクティスを **コマンド・規約・フック**としてこの repo に翻訳することを意味する。

---

## 2. 確定した設計判断

| # | 判断軸 | 選択 | 根拠 |
|---|-------|------|------|
| D1 | 適用範囲 | 5 ステージ統合（フル）、SP1 から着手 | 依存グラフ上 Memory が土台 |
| D2 | メモリの git 扱い | **ハイブリッド**：`.memory.md` は gitignore で私的蓄積、普遍的教訓のみ committed に昇格 | `agent-memory` の「記憶は非コミット」前例と整合しつつ、論文の "evolving asset" を昇格で実現。ソースを汚さない |
| D3 | 強制方式 | **ハイブリッド**：読込＝フック（機械的・抜けゼロ）、書込＝規約（判断的） | 読込は機械的なのでフック化で確実。書込の「何が notable か」は判断なので Claude に委ねる |

---

## 3. アーキテクチャ概観

```
                    ┌──────────────── Skill 使用 ────────────────┐
                    │                                            │
                    ▼                                            │
        ┌───────────────────────┐                               │
        │ [読込] PostToolUse Hook │  matcher: "Skill"             │
        │ skill-memory.ts (Deno) │                               │
        └───────────┬───────────┘                               │
                    │ tool_input.skill から名前解決               │
                    ▼                                            │
   ~/.claude/skills/<name>/.memory.md  (gitignore・私的)          │
                    │ additionalContext として注入                │
                    ▼                                            │
        Claude がスキル手順の実行前にメモリを認知                    │
                    │                                            │
                    │ 使用後、固有の失敗/癖/改善を発見               │
                    ▼                                            │
        [書込] CLAUDE.md 規約に従い .memory.md へ日付付き追記 ──────┘
                    │
                    │ 普遍的と判明した教訓のみ
                    ▼
   claude/skills/<name>/references/lessons.md  (committed・昇格先)
                    │ SKILL.md の通常の references 機構で進行性開示
                    ▼
        全マシンで共有される「賢くなったスキル」
```

3 つの経路: **読込（フック）／書込（規約）／昇格（手動）**。

---

## 4. データモデル — `.memory.md`

### 4.1 場所と git 扱い

```
claude/skills/<name>/.memory.md     ← gitignore 対象（私的・マシンローカル）
```

root `.gitignore` に 1 行追加（既存スキル・将来のスキル両方をカバー）:

```gitignore
# per-skill メモリは私的な作業領域として除外（普遍的教訓は references/lessons.md へ昇格）
claude/skills/*/.memory.md
```

`references/lessons.md` は除外しない（committed・昇格先）。

各スキルに `.memory.md` は**任意**。存在しないのが通常状態で、それで正常に動くこと（フックは fail open）。

### 4.2 スキーマ（フロントマター + セクション）

`agent-memory` のフロントマター流儀に合わせる。

```markdown
---
skill: pptx              # スキル名（自己同定・検証用）
updated: 2026-06-05      # 最終更新日（YYYY-MM-DD）
uses: 7                  # 呼び出し回数カウンタ（SP4 Management の布石・任意）
---

## ⚠️ Failure Modes
- [2026-06-05] macOS でフォント埋め込みが落ちる → `--embed-fonts` ではなく X を指定

## 🔧 Input Quirks
- 入力 Markdown の見出しが H1 のみだとスライド分割されない。H2 区切りが必要

## 💡 Tips
- 画像は事前に 1280px 幅へリサイズすると描画が安定

## ⬆️ Promotion Candidates
- 「H2 区切り必須」は普遍的 → SKILL.md/lessons.md へ昇格候補
```

セクションは論文の "failure modes / input-quirks" に対応。`Promotion Candidates` が昇格パス（§7）への橋渡し。全セクション任意（空でもよい）。

---

## 5. 読込パス — PostToolUse フック

### 5.1 フックの責務

1 本の Deno スクリプト `claude/hooks/skill-memory.ts`（既存 `format.ts`/`notify.ts` と同スタイル）。`settings.json` の `PostToolUse` に `matcher: "Skill"` で登録。

### 5.2 入出力契約

**入力**（stdin、JSON）:

```json
{
  "hook_event_name": "PostToolUse",
  "tool_name": "Skill",
  "tool_input": { "skill": "<name>", "args": "..." }
}
```

**出力**（stdout、JSON）— メモリがある場合:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "<.memory.md の内容（必要なら切り詰め）>"
  },
  "suppressOutput": true
}
```

メモリが無い/エラーの場合は **出力なしで exit 0**。

### 5.3 名前解決ロジック

- `tool_input.skill` が `:` を含む（例 `superpowers:brainstorming`）→ **プラグインスキルなので no-op**。この repo が管理するのは repo 固有スキルのみ。
- それ以外 → パス = `${HOME}/.claude/skills/${skill}/.memory.md`（インストール時のシンボリックリンク経由で repo の `claude/skills/` を指す）。

### 5.4 堅牢性ルール

| 条件 | 挙動 |
|------|------|
| `.memory.md` が存在しない | no-op（exit 0、出力なし） |
| 読込エラー（権限・I/O） | **fail open**（exit 0、スキルは必ず動く） |
| プラグイン名前空間付きスキル | no-op |
| 不正な stdin JSON | fail open |
| `.memory.md` が巨大 | 注入サイズを上限で切り詰め（既定: 先頭 ~200 行、超過時は末尾に `(truncated; full memory at <path>)` を付与）。上限は定数で調整可能 |

### 5.5 設定（settings.json）

```jsonc
"PostToolUse": [
  { "matcher": "Write|Edit|MultiEdit", "hooks": [ /* 既存 format.ts */ ] },
  {
    "matcher": "Skill",
    "hooks": [
      {
        "type": "command",
        "command": "deno run --allow-env --allow-read $GHQ_ROOT/github.com/skanehira/dotfiles/claude/hooks/skill-memory.ts"
      }
    ]
  }
]
```

**最小権限**: `--allow-env`（`$HOME` 解決）＋ `--allow-read`（メモリ読込）のみ。`--allow-write`/`--allow-run` は不要（読み取り専用）。

### 5.6 プログレッシブディスクロージャ

**そのスキルのメモリだけ**を**使った時だけ**注入。全メモリは一切出さない。論文の「カタログは description のみ先行ロード」原則と整合。

---

## 6. 書込パス — 規約

### 6.1 CLAUDE.md へのルール追加

> **per-skill メモリの記録**: スキル使用後、そのスキル**固有の**失敗・入力の癖・非自明な改善を見つけたら、`claude/skills/<name>/.memory.md` に日付付きで追記する（テンプレは設計書 §4.2）。スキル横断・プロジェクト固有の知識は `agent-memory` 側に記録する（境界は §8）。

### 6.2 「何を記録するか」（判断基準）

フック化せず Claude の判断に委ねる（D3）。記録すべきサイン:

- スキルが失敗し、**原因と回避策**を特定した。
- 入力に**特別な前処理**が必要だった。
- 非自明な**より良い使い方**を見つけた。

記録しない: スキルと無関係な一般知識、プロジェクト固有の調査結果（→ agent-memory）、一度きりの些末事。

> **実装時のユーザー貢献ポイント（learning mode）**: 「notable の閾値」をどこに引くか（記録過多 vs 記録漏れのトレードオフ）は運用者の判断が反映される箇所。実装フェーズで CLAUDE.md のルール文面（5–10 行）をユーザーに書いてもらう候補とする。

---

## 7. 昇格パス — ハイブリッドの "asset 化"

私的メモリ（gitignore）→ 普遍的と分かった教訓のみ committed へ昇格:

1. `.memory.md` の `Promotion Candidates` に挙がった項目が、**複数タスクで再現し普遍的**だと確認できたら昇格対象。
2. 昇格先 = **`claude/skills/<name>/references/lessons.md`**（committed）。
   - SKILL.md 本体に足さない理由: `reviewing-skills` が課す **500 行制限**を圧迫しないため。`references/` は既存スキル（developing, reviewing-skills 等）で確立済みの進行性開示の置き場。
   - 真に重大な数行だけは SKILL.md の "Known Issues / Tips" セクションに直接置く例外も可。
3. 昇格後、`.memory.md` の該当項目は削除（私的メモリは「未昇格の生経験」のみ保持）。
4. SP1 では**手動の文書化された手順**に留める。自動検出は SP3（Refinement）の領分（YAGNI）。

> committed な `references/lessons.md` はフックの対象外。SKILL.md が通常の references 機構で参照することで Claude にロードされる（読込フックは私的 `.memory.md` 専用）。これにより「私的な生経験」と「公開された確定教訓」が経路ごと分離される。

---

## 8. `agent-memory` との境界（重複回避）

| | agent-memory（既存） | per-skill `.memory.md`（SP1） |
|---|---|---|
| スコープ | スキル横断・タスク/プロジェクト知識 | **1 スキルの操作**に限定 |
| 問い | 「この問題、前に見た？」 | 「このスキルをどう操作する？」 |
| 例 | 「Issue #123 の JWT 調査結果」 | 「pptx スキルは macOS でフォント埋込が落ちる」 |
| 索引 | `memories/{category}/{topic}.md` | スキルに同居 |
| git | gitignore（`memories/`） | gitignore（`*/.memory.md`）＋ 昇格で committed |

**判定ルール**: 教訓が*スキル自身の挙動・癖*なら `.memory.md`、*問題・ドメイン・プロジェクト*なら agent-memory。

---

## 9. エラー処理（まとめ）

- フックは**常に fail open**。メモリ機構の不調がスキル使用を妨げてはならない。
- `suppressOutput: true` でトランスクリプトを汚さない。
- `.memory.md` の内容はテキストとして注入するのみ。**フックは内容を一切実行しない**（インジェクション耐性）。
- 注入サイズ上限でコンテキスト予算を保護。

---

## 10. テスト（Deno、SP2 の布石）

`claude/hooks/skill-memory.test.ts`:

| # | ケース | 期待 |
|---|-------|------|
| T1 | 正常: 存在する `.memory.md` | 正しい `additionalContext` JSON を出力 |
| T2 | ファイル無し | 出力なし・exit 0 |
| T3 | プラグイン名（`foo:bar`） | no-op |
| T4 | 不正 stdin JSON | fail open（exit 0） |
| T5 | 巨大ファイル | 上限で切り詰め＋truncation マーカー |
| T6 | `tool_name` が `Skill` 以外（保険） | no-op |

実行: `deno test --allow-env --allow-read claude/hooks/skill-memory.test.ts`。

---

## 11. ファイル一覧（作成・変更）

| パス | 種別 | 内容 |
|------|------|------|
| `claude/hooks/skill-memory.ts` | 新規 | 読込フック本体 |
| `claude/hooks/skill-memory.test.ts` | 新規 | フックのユニットテスト |
| `claude/settings.json` | 変更 | `PostToolUse` に `Skill` matcher エントリ追加 |
| `.gitignore`（root） | 変更 | `claude/skills/*/.memory.md` を追加 |
| `CLAUDE.md` | 変更 | per-skill メモリの書込規約・境界を追記 |
| `claude/skills/<name>/.memory.md` | 規約 | テンプレ（実体は実行時に各スキルへ生成、gitignore） |
| `docs/` or `claude/hooks/README.md` | 変更（任意） | フックの説明追記 |

> `claude/hooks/types.ts` に PostToolUse 入出力の型がなければ追加を検討（既存スタイルに合わせる）。

---

## 12. スコープ

**IN（SP1）**:
- `.memory.md` スキーマ＋テンプレ＋gitignore
- 読込フック（Deno）＋ settings.json 登録 ＋テスト
- CLAUDE.md 書込規約・境界
- `references/lessons.md` 昇格手順（手動・文書化）

**OUT（後続 SP）**:
- 昇格の自動検出・適用（SP3 Refinement）
- 使用回数分析・未使用プルーン（SP4 Management）
- create → register ループ統合（SP5）
- Stop 時の自動キャプチャ（書込は規約を選択済み）
- `tests/` を全スキルへ展開する実行ゲート（SP2）

---

## 13. 受け入れ基準

1. あるスキルに `.memory.md` を置き、そのスキルを使うと、内容が `additionalContext` として注入され Claude が認知する。
2. `.memory.md` が無いスキルは従来どおり動く（no-op、エラーなし）。
3. プラグインスキル使用時はフックが no-op。
4. `.memory.md` が `git status` に現れない（gitignore 有効）。`references/lessons.md` は追跡される。
5. T1–T6 のテストが全て通る。
6. CLAUDE.md に書込規約・agent-memory との境界が明記されている。
7. フックは権限 `--allow-env --allow-read` のみで動作する。

---

## 14. ロードマップ上の位置（SP2–SP5）

```
                    ┌─────────────────────────────────────┐
                    │  SP5: ライフサイクル統合 (capstone)     │
                    └─────────────────────────────────────┘
                          ▲          ▲          ▲
   ┌────────────────┐    ┌────────────────────┐
   │ SP3: Refinement │    │ SP4: Management     │
   │ 失敗→自動改善     │    │ マージ/プルーン/カタログ │
   └────────────────┘    └────────────────────┘
        ▲       ▲                  ▲
   ┌─────────────┐   ┌──────────────────┐
   │ SP2:        │   │ ★ SP1: per-skill  │   ← 本設計書
   │ テストゲート   │   │   メモリ           │
   └─────────────┘   └──────────────────┘
```

SP1 が生む `.memory.md`（失敗・使用シグナル）は、SP3 の自動改善トリガーと SP4 の使用追跡の**データ源**になる。`uses` カウンタと `Failure Modes` セクションは、その布石として今回スキーマに含めてある。

---

## 15. 実装時に確定する事項（オープン）

- 注入サイズ上限の具体値（既定 ~200 行／切り詰め方）。
- 「notable の閾値」の CLAUDE.md 文面（learning mode のユーザー貢献ポイント、§6.2）。
- `claude/hooks/types.ts` への型追加要否。
- フックのメモリ解決パスを `$HOME/.claude/skills` 固定にするか、フック自身の位置からの相対解決にするか（既定: `$HOME/.claude/skills`）。
