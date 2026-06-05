# SP2: Skill Test-Gate — 設計書

> **親プロジェクト**: "Self-Evolving Skills" — MUSE-Autoskill（[arXiv:2605.27366v1](https://arxiv.org/html/2605.27366v1)）をこの dotfiles のスキルエコシステムに適用する。
> **サブプロジェクト**: 5 分割のうち SP2（テストゲート登録 / Evaluation ステージ）。
> **ステータス**: 設計承認済み。
> **日付**: 2026-06-05。
> **前提**: SP1（per-skill メモリ）は実装・master マージ済み。

---

## 1. 背景と動機

### 1.1 元論文の Evaluation ステージ

MUSE-Autoskill は「ユニットテストが通って初めてスキルが skill bank に登録される（`create → evaluate → register`）」という**実行による検証ゲート**を提案する。生成されたスキルは自動検証を経て、合格したものだけが再利用プールに入る。

### 1.2 この repo の現実

`claude/skills/` の **39 スキル中、実行可能コード＋テストを持つのは `vcsdd-lite` ただ1つ**（Deno スクリプト＋`.test.ts`＋fixtures）。残りは全て **SKILL.md（指示・プロンプト）主体でコード無し**。したがって論文の「pytest が通れば登録」を**そのまま適用できるスキルはほぼ無い**。

→ 「テスト」を2層で再解釈する:

- **Tier 1 構造検証（全スキル）**: コードが無くても、SKILL.md の構造を**決定論的に**検査できる（frontmatter・name 形式・description・行数）。
- **Tier 2 スクリプトテスト（コードを持つスキル）**: `scripts/` に `*.test.ts` があれば `deno test` を実行。

### 1.3 `reviewing-skills` との関係（決定論 vs 定性）

`reviewing-skills`（既存）は LLM による**定性レビュー**（「何を/いつ説明しているか」「例の質」「用語一貫性」）。SP2 の `validate-skill` は**決定論的・実行可能・objective なゲート**。`best-practices.md` のチェックリストは、機械判定できる項目（SP2 が担当）と判断が要る項目（reviewing-skills が担当）に分かれる。SP1 の「フック=機械的 / 規約=判断的」と同じ二分法。

---

## 2. 確定した設計判断

| # | 判断軸 | 選択 | 根拠 |
|---|-------|------|------|
| D1 | 検証対象 | **両層**：構造検証（全スキル）＋スクリプトテスト（コード保持スキル） | 論文意図に最も忠実かつ全スキルをカバー |
| D2 | 強制方法 | **単体バリデータ＋`/create-skill` 統合**（git フックなし） | create→evaluate→register ループの本来の場所。git フックは新機構導入＋intrusive で不採用 |
| D3 | 失敗時の既定 | **fail-closed**（検証不能なら登録させない） | 品質優先。SP1 のメモリフック（fail-open＝可用性優先）とは役割が逆なので既定の安全側も逆 |

---

## 3. アーキテクチャ

```
/create-skill: skill-creator で生成
      │
      ▼
  [Tier1] validate-skill <name>   ──Critical あり──▶ 既存の自動修正ループ(最大3回)
   構造検証(全スキル・決定論)                                 │
      │ Critical なし(Warning は許容)                        ▼ 再検証
      ▼                                              (pass するまで)
  [Tier2] scripts/*.test.ts があれば deno test ──失敗──▶ 同上
      │ pass
      ▼
  reviewing-skills（LLM 定性レビュー） → "登録"（完了 / コミット）
```

決定論ゲート（validate-skill）が通って初めて、定性レビュー→登録に進む。

## 4. Tier 1：構造検証ルール（決定論的）

**ゲートは Critical のみブロック**。Warning は報告のみ（既存スキルを壊さない）。検査は「**確実に機械判定できるもの**」に限定し、文脈判断が要るものは reviewing-skills に委ねる。

### Critical（ブロック）

| ID | チェック | 根拠 |
|----|---------|------|
| C1 | frontmatter が存在し有効な YAML である | best-practices §1 |
| C2 | `name`: 存在・≤64字・`^[a-z0-9-]+$`・予約語(`anthropic`/`claude`)を含まない | best-practices §1 name |
| C3 | `description`: 存在・非空・≤1024字 | best-practices §1 description |

### Warning（報告のみ・ブロックしない）

| ID | チェック | 根拠 |
|----|---------|------|
| W1 | body ≤500行 | best-practices §2 簡潔さ |
| W2 | `name` が曖昧でない（`helper`/`utils`/`tools` の完全一致を拒否） | best-practices §1 |
| W3 | body に "When to Use" 見出しが無い（description に置くべき） | best-practices §2 構造 |

### 意図的に**不採用**のチェック（誤検知・既存非準拠のため）

- **動名詞形(-ing)**: この repo の既存スキルは大半が -ing 形でない（`agent-memory`, `competitive-research`, `pptx`…）。Warning 化すると30件超がノイズになり「既存パターン尊重」に反する。→ 不採用。
- **Windows パス(`\`)検出**: 単純なバックスラッシュ検出はコードブロック内の正規表現/エスケープ（`\n`, `\d`）を誤検知する。文脈判断が要るため reviewing-skills（定性）に委ねる。→ 決定論バリデータでは不採用。

## 5. Tier 2：スクリプトテスト

`claude/skills/<name>/scripts/` に `*.test.ts` が1つ以上あれば、`deno test --allow-read`（必要に応じ追加権限）を実行し、**失敗を Critical（C4）扱い**。現状 `vcsdd-lite` のみ該当。将来コードを持つスキルに自動適用。テストが無いスキルは Tier 2 をスキップ（no-op、合格）。

## 6. 配置と境界

- **配置**: `claude/skills/reviewing-skills/scripts/validate-skill.ts`（「スキル品質」の凝集。reviewing-skills が決定論アームを獲得し、SKILL.md から「まず決定論ゲートを実行」と参照できる）。
- **境界**:
  - **validate-skill（SP2）** = 決定論的・実行可能・objective。CI / 後続 SP / 手動からも呼べる。
  - **reviewing-skills（既存）** = LLM 定性レビュー（判断が要る項目）。
- バリデータが reviewing-skills/scripts 配下に入ることで、Tier 2 のルール上 reviewing-skills 自身も「scripts/*.test.ts を持つスキル」になる（自己一貫：reviewing-skills を検証するとバリデータ自身のテストが走る）。

## 7. `/create-skill` 統合と失敗フィードバック

`/create-skill` に「**[2.5/3] 決定論ゲート**」を挿入：

1. skill-creator 生成後、`validate-skill <name>` を実行。
2. **Critical あり** → 違反内容を**既存の自動修正ループ（最大3回）**に渡して修正→再検証。
3. **Critical なし** → reviewing-skills（定性レビュー）へ → 完了/コミット。

バリデータ出力は人間可読の違反リスト（自動修正ループが解釈できる形式）:
```
<skill>: FAIL
  [Critical] C2 name: "Foo_Bar" violates ^[a-z0-9-]+$
  [Warning]  W1 body: 612 lines (>500)
```

## 8. バリデータ I/O 契約（CLI）

- `validate-skill <name>`: 単一スキルを検証。`claude/skills/<name>/SKILL.md` を解決（skills ディレクトリは `import.meta.url` から導出し CWD 非依存）。
- `validate-skill --all`: `claude/skills/*/SKILL.md` を全件検証し、サマリを出力（初期監査＋将来 SP4 用）。
- **終了コード**: Critical/テスト失敗/検証不能が1件でもあれば `1`、無ければ `0`（Warning のみは `0`）。
- **出力**: 各スキルの `PASS`/`FAIL` ＋違反リスト（上記形式）を stdout。

## 9. エラー処理（fail-closed）

- 対象スキル/SKILL.md が存在しない → 明示エラー＋exit 1。
- バリデータ自身が予期せぬ例外 → ゲート失敗（exit 1）として扱い理由を出力（**fail-closed**：検証できないものは通さない）。
- Tier 2 の `deno test` 実行自体が失敗（起動不能等）→ Critical 扱い。
- **権限**: `--allow-read`（SKILL.md 読込）。Tier 2 実行時のみ `--allow-run`（`deno test` 子プロセス起動）。

## 10. テスト（TDD・fixtures）

`claude/skills/reviewing-skills/scripts/validate-skill.test.ts` ＋ `fixtures/`（vcsdd-lite の fixture 方式に倣う）:

| fixture | 期待 |
|---------|------|
| `valid/` | PASS（Critical 0） |
| `no-frontmatter/` | C1 |
| `bad-name/`（`Foo_Bar`） | C2 |
| `reserved-name/`（`claude-helper`） | C2 |
| `empty-desc/` | C3 |
| `too-long/`（>500行） | W1（Warning のみ→PASS） |
| `vague-name/`（`utils`） | W2 |
| `when-to-use/` | W3 |
| `failing-script/`（scripts/ に落ちる test） | C4（Tier 2 失敗） |
| `passing-script/` | PASS |

純粋関数（`parseFrontmatter`/`checkName`/`checkDescription`/`checkBody`/`validateContent`）を DI 可能にして FS 非依存でテスト。Tier 2 の `deno test` 起動は subprocess 統合テストで検証。

## 11. ファイル一覧

| パス | 種別 | 内容 |
|------|------|------|
| `claude/skills/reviewing-skills/scripts/validate-skill.ts` | 新規 | バリデータ本体（Tier1+2、CLI） |
| `claude/skills/reviewing-skills/scripts/validate-skill.test.ts` | 新規 | ユニット＋統合テスト |
| `claude/skills/reviewing-skills/scripts/fixtures/**` | 新規 | テスト用スキル fixtures |
| `claude/commands/create-skill.md` | 変更 | [2.5/3] 決定論ゲート挿入 |
| `claude/skills/reviewing-skills/SKILL.md` | 変更 | 決定論アーム（validate-skill 実行）への言及・境界 |
| `CLAUDE.md` | 変更 | validate-skill と reviewing-skills の境界を1行追記 |

## 12. スコープ

**IN（SP2）**:
- `validate-skill.ts`（Tier1 構造検証＋Tier2 スクリプトテスト）＋テスト＋fixtures
- `/create-skill` への決定論ゲート統合
- reviewing-skills/CLAUDE.md に境界記載
- `--all` 監査モード

**OUT（後続 SP / YAGNI）**:
- git pre-commit フック（不採用）
- LLM 振る舞い eval（生成物の質を LLM 判定）
- `--json` 出力
- skill bank への登録機構（repo 自体が bank）
- 既存39スキルを全て Warning ゼロにする是正作業（別途）

## 13. 受け入れ基準

1. `validate-skill <name>` が、構造的に正しいスキルに対し exit 0（PASS）。
2. frontmatter 欠如・不正 name・空 description のスキルに対し Critical を報告し exit 1。
3. body>500行/曖昧名/"When to Use" 見出しは Warning として報告するが exit 0（ブロックしない）。
4. `scripts/*.test.ts` を持つスキルでテストが落ちると C4 で exit 1、通れば PASS。
5. `validate-skill --all` が全スキルを検証しサマリを出す。既存39スキルが Critical 0 で通過（Warning は許容）。
6. fixtures に対する全テストが通る。
7. `/create-skill` が決定論ゲートを実行し、Critical を自動修正ループに渡す。
8. 権限は `--allow-read`（＋Tier2 時 `--allow-run`）のみ。

## 14. ロードマップ上の位置

```
                    ┌─────────────────────────────────────┐
                    │  SP5: ライフサイクル統合 (capstone)     │
                    └─────────────────────────────────────┘
                          ▲          ▲          ▲
   ┌────────────────┐    ┌────────────────────┐
   │ SP3: Refinement │    │ SP4: Management     │
   └────────────────┘    └────────────────────┘
        ▲       ▲                  ▲
   ┌──────────────┐   ┌──────────────────┐
   │ ★ SP2:       │   │ SP1: per-skill    │ ✅ 完了
   │  Test-Gate   │   │   メモリ           │
   └──────────────┘   └──────────────────┘
```

SP2 の `validate-skill` は、SP3（Refinement：検証失敗をトリガに改善）と SP4（Management：`--all` で全スキルの健全性監査）から再利用される基盤になる。

## 15. 実装時に確定する事項（オープン）

- skills ディレクトリ解決の正確なロジック（`import.meta.url` からの相対 vs 引数指定。既定: import.meta.url 由来）。
- Tier 2 の `deno test` に渡す権限（`--allow-read` 既定。スクリプトが追加権限を要する場合の扱い）。
- 違反出力の正確なフォーマット（自動修正ループが最も解釈しやすい形）。
- `--all` のサマリ表示形式。
