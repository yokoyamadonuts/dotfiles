# SP4: Skill Catalog (Management) — 設計書

> **親プロジェクト**: "Self-Evolving Skills" — MUSE-Autoskill（[arXiv:2605.27366v1](https://arxiv.org/html/2605.27366v1)）をこの dotfiles のスキルエコシステムに適用する。
> **サブプロジェクト**: 5 分割のうち SP4（Management ステージ）。
> **ステータス**: 設計承認済み。
> **日付**: 2026-06-05。
> **前提**: SP1（per-skill メモリ）・SP2（テストゲート）・SP3（Refinement）は実装・master マージ済み。

---

## 1. 背景と動機

### 1.1 元論文の Management ステージ

MUSE-Autoskill の Management: カタログ注入（progressive disclosure）・重複スキルのマージ・未使用スキルのプルーン・使用追跡・クロスセッション状態。スキルバンクが育っても品質と発見性を保つ。

### 1.2 この repo で「追加すべき」Management

論文 Management の一部は**既に提供済み or 別スキルが担当**:

- **カタログ注入（description のみ先行ロード）** → Claude Code 標準（スキル一覧＋description が注入され本体はオンデマンド）。作り直し不要。
- **クロスセッション状態** → `agent-memory` スキルが担当済み。
- **改善アクション** → SP3 `refining-skills`。

→ SP4 で**追加すべき高価値 Management**は、**全スキルの健全性を一望し「どこに手を入れるべきか」を示す advisory カタログ**。

### 1.3 意図的に除外するもの（YAGNI / 副作用大）

- **使用追跡（uses 増分）**: SP1 フックに書込権限を与え全スキル使用ごとに `.memory.md` を書く必要があり、経験の無いスキルにもファイルが生まれ churn する。価値（未使用検知）は時間経過後にしか出ず副作用が大きい → **不採用**。
- **自動 prune / auto-merge**: 破壊的・判断主体 → 不採用（advisory に留め、マージは手動、refine は SP3）。

---

## 2. 確定した設計判断

| # | 判断軸 | 選択 | 根拠 |
|---|-------|------|------|
| D1 | スコープ | **advisory 健全性カタログ**のみ | 既存シグナルで今すぐ achievable・非破壊。カタログ注入はハーネス標準 |
| D2 | 使用追跡 | **不採用** | フック書込＋全スキル churn の副作用大、価値は時間依存 |
| D3 | アクション | **advisory のみ**（refine は SP3、merge/prune は手動） | 破壊的操作をレビュー無しで実行しない |
| D4 | 実装 | 決定論スクリプト＋コマンド。validate-skill を import 再利用 | DRY。バリデーションロジックを再実装しない |

---

## 3. アーキテクチャ

- **`catalog-skills.ts` スクリプト**（決定論集約。`validate-skill.ts` の export を import 再利用）。
- **`/skill-catalog` コマンド**（薄い起動口。スクリプトを実行し結果を提示）。
- **CLAUDE.md** に境界・対応表追加。

配置: `claude/skills/reviewing-skills/scripts/`（validate-skill と同居＝「スキル品質/管理」の家）。**advisory のみ**。

## 4. 集約シグナル（スキル別）

| 列 | 出所 |
|----|------|
| validate（PASS / FAIL＋Critical数 / Warning数） | `validate-skill.ts` の `validateSkill`/`validateContent` を import |
| body 行数 | SKILL.md（`parseFrontmatter` で body 抽出後カウント） |
| scripts/tests 有無 | `defaultHasTests` を import |
| `.memory.md` 有無＋Failure Modes 件数 | `~/.claude/skills/<name>/.memory.md`（あれば。`## ⚠️ Failure Modes` 配下の箇条書き数） |
| `references/lessons.md` 有無 | fs |

## 5. 推奨（advisory recommendation）

| 推奨 | 条件 | アクション |
|------|------|-----------|
| **refine** | Warning>0 または Failure Modes>0 | `/refine-skill <name>`（SP3） |
| **merge?** | 他スキルと有意キーワード共有（§6） | 人が判断（重複ならマージ） |
| **ok** | 上記なし | — |

**prune（未使用）は対象外**（使用追跡を採らないため。D2）。

## 6. 重複ヒューリスティック（控えめ・advisory）

- name＋description から**有意キーワード**を抽出: ラテン語 ≥4文字 ＋ カタカナ連続語、ストップワード/汎用スキル語（スキル・起動・リクエスト・作成・など 等）を除去。
- ≥2 個の有意キーワードを共有するスキルペアを「merge? 候補」として提示。
- **過検出前提**で出力に「候補（人が判断）」と明記。マージは手動。誤検出してもファイルは触らない。
- 厳密なストップワード一覧・閾値は実装時に調整（§15 オープン）。日本語の形態素解析は使わず、ラテン/カタカナの粗トークンに限定（依存を増やさない）。

## 7. 再利用とテスト容易性

- **再利用**: `import { validateSkill, listSkills, defaultHasTests, parseFrontmatter } from "./validate-skill.ts"`。バリデーション・スキル列挙・テスト検出・frontmatter 解析を再実装しない（DRY）。
- **純粋関数＋DI**: 集約（`catalogEntry`）・推奨判定（`recommend`）・キーワード抽出（`extractKeywords`）・重複検出（`findOverlaps`）・整形（`formatCatalog`）を純粋関数化。FS/環境は DI（`readTextFile`/`home`/`VALIDATE_SKILLS_DIR` を validate-skill と同様にオーバーライド可能）にしてインライン/一時ディレクトリでテスト。
- **テスト**: ユニット（純粋関数）＋ subprocess 統合（CLI を一時 skills ディレクトリに対して実行）。fixtures は validate-skill のものを流用可。

## 8. CLI I/O 契約

- `catalog-skills.ts`（引数なしで全スキル。`--all` も同義で受理）。
- **終了コードは常に 0**（advisory・ゲートではない。「FAIL があるか」ではなく「全体像」を出す）。
- 出力: 人間可読の表（スキル別シグナル＋推奨）＋「OVERLAP CANDIDATES」セクション。`--json` は YAGNI（不採用）。
- skills ディレクトリ解決は validate-skill と同じ（`VALIDATE_SKILLS_DIR` override → else `import.meta.url` 由来）。

## 9. 境界（4つ目の役割）

| | 役割 | 終了コード |
|---|------|-----------|
| `validate-skill`（SP2） | 1スキルの決定論**ゲート** | 0/1/2（ブロック） |
| `refining-skills`（SP3） | 既存スキルの**改善アクション** | — |
| **`catalog-skills`（SP4）** | **全スキルの管理ビュー**（advisory・横断推奨） | **常に 0** |
| `reviewing-skills` | LLM **定性レビュー** | — |

カタログは「どのスキルに手を入れるべきか」を一望する地図。アクションは refine（SP3）/手動。

## 10. テスト（TDD）

`claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`:

| ケース | 期待 |
|--------|------|
| `extractKeywords`: ラテン語/カタカナ抽出＋ストップワード除去 | 有意語のみ |
| `findOverlaps`: ≥2 共有ペアを検出、共有<2 は非検出 | 候補ペア |
| `recommend`: Warning>0 → refine / failureModes>0 → refine / なし → ok | 正しい推奨 |
| `catalogEntry`（DI）: validate 結果・行数・tests・memory・lessons を集約 | 正しいエントリ |
| `formatCatalog`: 表＋overlap セクション | 期待文字列 |
| CLI 統合（一時 skills dir）: 表出力・exit 0 | 0 |

`deno test`／`deno check`／`deno lint`／`deno fmt` clean。

## 11. ファイル一覧

| パス | 種別 | 内容 |
|------|------|------|
| `claude/skills/reviewing-skills/scripts/catalog-skills.ts` | 新規 | 集約・推奨・overlap・CLI |
| `claude/skills/reviewing-skills/scripts/catalog-skills.test.ts` | 新規 | ユニット＋統合テスト |
| `claude/commands/skill-catalog.md` | 新規 | `/skill-catalog` 起動口 |
| `claude/skills/reviewing-skills/SKILL.md` | 変更 | カタログ（決定論アーム拡張）への言及 |
| `CLAUDE.md` | 変更 | 境界・対応表に追加 |

## 12. スコープ

**IN（SP4）**:
- `catalog-skills.ts`（集約・推奨・overlap ヒューリスティック・CLI）＋テスト
- `/skill-catalog` コマンド
- reviewing-skills/SKILL.md・CLAUDE.md 追記

**OUT（YAGNI / 後続）**:
- 使用追跡（uses 増分・フック書込）
- 自動 prune・auto-merge（破壊的）
- カタログ注入（ハーネス標準）
- `--json` 出力
- ランタイム評価

## 13. 受け入れ基準

1. `catalog-skills.ts` が全スキルを列挙し、validate 状態・body 行数・tests・memory・lessons を表で出す。
2. Warning>0 または Failure Modes>0 のスキルに「refine」推奨を付ける。
3. 有意キーワードを共有するスキルを「merge? 候補（人が判断）」として提示。
4. `validate-skill.ts` の export を import 再利用（バリデーションを再実装しない）。
5. 終了コードは常に 0（advisory）。
6. 既存38スキルが全て表に現れ、W1 の3スキル（figma-design-ops/vcsdd-lite/zundamon-video）が「refine」推奨になる。
7. ユニット＋統合テストが通り、check/lint/fmt clean。
8. 境界が CLAUDE.md に明記、使用追跡・自動アクションを含まない。

## 14. ロードマップ上の位置

```
                    ┌─────────────────────────────────────┐
                    │  SP5: ライフサイクル統合 (capstone)     │
                    └─────────────────────────────────────┘
                          ▲          ▲          ▲
   ┌────────────────┐    ┌────────────────────┐
   │ SP3: Refinement │✅  │ ★ SP4: Management   │
   └────────────────┘    └────────────────────┘
        ▲       ▲                  ▲
   ┌──────────────┐   ┌──────────────────┐
   │ SP2: Test-Gate│✅ │ SP1: メモリ        │✅
   └──────────────┘   └──────────────────┘
```

SP4 カタログは SP1（.memory.md）・SP2（validate-skill）の出力を集約し、SP3（refine）を推奨アクションとして指す。SP5 はこれら全体を1つのライフサイクル文書/索引に束ねる capstone。

## 15. 実装時に確定する事項（オープン）

- 重複ヒューリスティックの正確なストップワード一覧と共有閾値（既定 ≥2）。
- Failure Modes 件数の正確なパース（`## ⚠️ Failure Modes` 見出し配下の `- ` 箇条書き数）。
- 出力表のフォーマット（列幅・記号）。
- catalog-skills と validate-skill の import 粒度（関数単位 import）。
