# vcsdd-lite Skill 設計書

**日付**: 2026-05-19
**作成者**: Shingo Yokoyama
**ステータス**: Draft（ユーザレビュー待ち）

## 目的

既存の `vsdd` スキル（Verified Spec-Driven Development）に **CoDD（Coherence-Driven Development）** の概念を統合し、仕様・テスト・実装・検証の依存関係を追跡できる軽量パイプラインスキル `vcsdd-lite` を構築する。

参考: Zenn 記事「[VCSDD: 整合性保証型仕様駆動開発](https://zenn.dev/sc30gsw/articles/bbb8b3c2fff1f6)」および [sc30gsw/vcsdd-claude-code](https://github.com/sc30gsw/vcsdd-claude-code) Pluginの実装。

## 背景と判断

### Plugin直接利用 vs Skill化の比較

| 観点 | Plugin直接利用 | Skill化（採用） |
|---|---|---|
| インストール | 1コマンド | 既存 `./install.sh` |
| 既存スキル統合 | 別名前空間（`/vcsdd:*`） | `developing`/`writing-tests`/`design-intent` 等と合成 |
| CoDD実装 | ランタイムCEG | アドバイザリ + 補助スクリプト |
| フック自動ゲート | PreToolUse/PostToolUse | 規律ベース |
| カスタマイズ性 | プラグイン設計に従う | 完全に自由 |
| 侵襲性 | 高（Write/Edit/Bash全介入） | なし |

### Pluginセキュリティ監査結果（要約）

| 観点 | 結果 |
|---|---|
| ネットワーク通信 | ✅ ZERO |
| テレメトリ | ✅ なし |
| 機密ファイル読み取り | ✅ なし |
| 任意コード実行 | ✅ なし（eval/Function なし） |
| 子プロセス実行 | ⚠️ git コマンドのみ。execFileSync 主体で安全 |
| 依存パッケージ | ✅ ゼロ依存 |
| ライセンス | ✅ MIT |
| インストーラー | ✅ 安全（sudo/curl/eval 不使用） |

**判定**: コード品質は高くセキュリティリスクは低い。ただし **PreToolUse フックが全 Write/Edit/Bash に介入する侵襲性** は懸念。Skill化方針を採用することでこの問題を回避する。

なお、Plugin のアルゴリズム（特に `vcsdd-coherence.js` の循環検出）は MIT ライセンスのため、参考実装として活用可能。

### 主要な意思決定

| 決定事項 | 採用案 | 理由 |
|---|---|---|
| 方針 | Skill 拡張 | 既存スキル群との合成、低侵襲、dotfiles哲学 |
| CoDD実装深度 | L3（スクリプト補助） | 影響範囲分析を自動化したいユーザ要望 |
| スクリプト言語 | TypeScript (Deno) | 単一ファイル、型安全、CLAUDE.md に `~/.deno/bin` 記載済 |
| ファイル配置 | `docs/vcsdd/<feature>/` | git追跡しやすい、Pluginの `.vcsdd/` をミラー |
| スキル命名 | `vcsdd-lite` | Plugin名 `vcsdd` との衝突回避、軽量版を明示 |
| ブレインストーミング | 実施済（本ドキュメント） | superpowers:brainstorming スキル経由 |

## 設計

### 1. ファイル構造

```
claude/skills/vcsdd-lite/                  # git mv claude/skills/vsdd
├── SKILL.md                               # ~480行（既存vsdd 412行 + CoDD骨子 +70行）
├── references/
│   ├── coherence.md                       # CEGモデル、frontmatter仕様、信頼度バンド、BFS解説
│   ├── strict-vs-lean.md                  # モード比較表、適用判断
│   └── trace-templates.md                 # bead identifier テンプレート集
└── scripts/
    ├── _types.ts                          # 共通型定義
    ├── _frontmatter.ts                    # YAMLフロントマター抽出ヘルパ
    ├── coherence-scan.ts                  # frontmatter → coherence.json
    ├── coherence-validate.ts              # 循環/欠落/Orphan検出
    ├── coherence-impact.ts                # BFS影響範囲分析
    └── coherence-trace.ts                 # req-id → tests/impl/verify トレース
```

### 2. SKILL.md 章構成

```yaml
---
name: vcsdd-lite
description: VSDD（仕様駆動+TDD+敵対的検証+形式検証）にCoherence-Driven Development（CoDD）を統合した軽量パイプライン。
  仕様・テスト・実装・検証の依存グラフ（CEG）を追跡し、変更時の影響範囲を自動分析。正確性が重要なシステム
  （金融・インフラ・セキュリティ等）の開発に使用。「VCSDDで開発」「coherence チェック」「影響範囲分析」
  「仕様駆動で実装」「形式検証付きで開発」「VSDDで開発」「adversarial reviewして」で起動。
---
```

#### 全体構造（既存vsdd 412行 → vcsdd-lite ~480行）

1. 概要（VSDD + CoDD = VCSDD-lite、既存vsdd概要を継承）
2. ロール定義（Architect/Builder/Adversary/**Verifier ← 新規追加**）
3. 適用判断（VSDDを使うケース + CoDDが効くケース）
4. **モード（lean / strict） ← 新規**
5. コアワークフロー
   - Phase 0: 品質バー言語化（既存維持）
   - Phase 1: 仕様結晶化
     - 1a: 振る舞い仕様
     - 1b: 検証アーキテクチャ
     - **1c: Coherence Mapping ← 新規（CoDD核心）**
     - 1d: 仕様レビューゲート
   - Phase 2: テストファースト実装（既存維持）
   - Phase 3: 敵対的精錬（既存維持）
   - **Phase 4: フィードバック統合（+影響伝播分析） ← CoDD強化**
   - Phase 5: 形式硬化（既存維持）
   - **Phase 6: 収束（+CEG整合性チェック） ← CoDD強化**
6. **Coherenceスクリプト使用法（4スクリプトの呼び出し例） ← 新規**
7. **トレーサビリティチェーン（bead identifier 導入） ← 新規**
8. 出力ファイル・テンプレート（`docs/vcsdd/<feature>/` レイアウト）
9. 関連スキル（既存維持）

#### 章の重み配分

| 章 | 行数目安 | 既存 vsdd からの差分 |
|---|---|---|
| 概要・ロール | 30 | Verifier 追加 |
| 適用判断 | 25 | CoDD適用基準追加 |
| モード | 15 | **新規** |
| Phase 0〜6 | 280 | Phase 1c, 4, 6 を強化 |
| Coherenceスクリプト | 40 | **新規** |
| トレーサビリティ | 25 | **新規** |
| 出力・テンプレート | 50 | `docs/vcsdd/` レイアウト追加 |
| 関連スキル | 15 | 既存維持 |

### 3. Coherence データモデル

#### 3.1 ノードID命名規則

すべてのCEGノードは `<type>:<slug>` 形式の識別子を持つ。

| プレフィクス | 種別 | 例 |
|---|---|---|
| `req:` | 要件（ビジネスレベル） | `req:user-login` |
| `spec:` | 振る舞い仕様 | `spec:auth-flow` |
| `design:` | 設計成果物 | `design:user-schema` |
| `test:` | テストスイート | `test:auth-edge-cases` |
| `impl:` | 実装モジュール | `impl:auth-service` |
| `verify:` | 形式検証ハーネス | `verify:prop-token-invariant` |
| `bead:` | トレーサビリティ束 | `bead:B-001-login-flow` |

#### 3.2 spec ファイル frontmatter 仕様

`docs/vcsdd/<feature>/specs/*.md` の冒頭に必須：

```yaml
---
id: spec:auth-flow
type: spec
feature: user-auth
coherence:
  depends_on:
    - design:user-schema
    - design:token-store
  satisfies:
    - req:user-login
    - req:password-reset
  verified_by:
    - test:auth-edge-cases
    - verify:prop-token-invariant
  beads:
    - bead:B-001-login-flow
confidence: green   # green | amber | gray
status: draft       # draft | reviewed | locked
last_reviewed: 2026-05-19
---
```

| フィールド | 必須 | 意味 |
|---|---|---|
| `id` | ✅ | ノードIDの正規形（ファイル内で一意） |
| `type` | ✅ | `req`/`spec`/`design`/`test`/`impl`/`verify` |
| `feature` | ✅ | フィーチャー名 |
| `coherence.depends_on` | ⚪ | 上流ノード |
| `coherence.satisfies` | ⚪ | このノードが満たす上位要件 |
| `coherence.verified_by` | ⚪ | このノードを検証する下流ノード |
| `coherence.beads` | ⚪ | 所属するtraceabilityバンドル |
| `confidence` | ⚪ | scan結果上書き可能 |
| `status` | ⚪ | レビューゲート通過状態 |

#### 3.3 coherence.json スキーマ

`docs/vcsdd/<feature>/coherence.json`：

```json
{
  "$schema": "vcsdd-lite-coherence-v1",
  "version": "1.0",
  "feature": "user-auth",
  "scanned_at": "2026-05-19T10:23:00Z",
  "scanner_version": "vcsdd-lite/0.1",
  "mode": "lean",
  "nodes": {
    "spec:auth-flow": {
      "type": "spec",
      "path": "docs/vcsdd/user-auth/specs/auth-flow.md",
      "confidence": "green",
      "status": "reviewed",
      "depends_on": ["design:user-schema", "design:token-store"],
      "satisfies": ["req:user-login", "req:password-reset"],
      "verified_by": ["test:auth-edge-cases", "verify:prop-token-invariant"],
      "beads": ["bead:B-001-login-flow"]
    }
  },
  "edges": [
    { "from": "spec:auth-flow", "to": "design:user-schema", "kind": "depends_on" },
    { "from": "spec:auth-flow", "to": "req:user-login",     "kind": "satisfies"  },
    { "from": "test:auth-edge-cases", "to": "spec:auth-flow", "kind": "verifies" }
  ],
  "beads": {
    "bead:B-001-login-flow": {
      "members": ["req:user-login", "spec:auth-flow", "test:auth-edge-cases",
                  "impl:auth-service", "verify:prop-token-invariant"],
      "completeness": "full"
    }
  },
  "issues": [],
  "summary": {
    "total_nodes": 12,
    "confidence_distribution": { "green": 8, "amber": 3, "gray": 1 },
    "cycles_detected": 0,
    "missing_references": 0,
    "orphans": 0
  }
}
```

#### 3.4 信頼度バンド判定ルール（自動算出）

| バンド | 条件 |
|---|---|
| 🟢 Green | `type=spec`: `satisfies` ≥1個 かつ `verified_by` ≥1個 かつ全参照解決済み<br>`type=test/impl`: `satisfies` を介して `req` まで到達可能 |
| 🟡 Amber | 参照は解決するが束（bead）が不完全 |
| ⚫ Gray | 参照解決エラーあり / orphan / bead未所属 |

手動指定（frontmatterの `confidence`）が常に優先される。

#### 3.5 検証エラーの種類

| kind | severity | 説明 |
|---|---|---|
| `missing_reference` | error | 存在しないノードへの参照 |
| `cycle` | error | A→B→...→A の循環依存 |
| `orphan` | warning | 誰からも参照されないノード（要件以外） |
| `type_mismatch` | warning | 例: testノードが他のtestをsatisfiesする等 |
| `incomplete_bead` | info | beadメンバーが揃っていない |
| `gray_in_locked_spec` | warning | `status:locked` かつ `confidence:gray` |

### 4. scripts/ 設計

#### 共通仕様

- Shebang: `#!/usr/bin/env -S deno run --allow-read --allow-write`
- 作業ディレクトリ: プロジェクトルート（`docs/vcsdd/` がある場所）
- フィーチャー特定: `--feature <name>` または auto-detect（`docs/vcsdd/` 配下に1つだけの場合）。0個または2個以上の場合は usage error（exit 2）
- 出力: デフォルトJSON、`--format md` でMarkdown
- Exit code: `0` 成功 / `1` validation error / `2` usage error
- Deno標準ライブラリ: `jsr:@std/yaml`, `jsr:@std/path`, `jsr:@std/fs`
- `confidence` の取り扱い: frontmatter に明示指定があれば優先、なければ Section 3.4 ルールで自動算出。scan結果のJSONには算出元（"manual" or "auto"）を内部的に保持しない（簡潔性優先）

#### 4.1 `coherence-scan.ts`

frontmatter → coherence.json 生成。

```bash
deno run --allow-read --allow-write \
  ~/.claude/skills/vcsdd-lite/scripts/coherence-scan.ts \
  --feature user-auth [--out docs/vcsdd/user-auth/coherence.json]
```

**処理**: glob列挙 → frontmatter parse → ノード辞書構築 → edges生成 → beads集計 → confidence自動算出 → summary集計 → 出力。

#### 4.2 `coherence-validate.ts`

整合性違反を検出。

```bash
deno run --allow-read \
  ~/.claude/skills/vcsdd-lite/scripts/coherence-validate.ts \
  --feature user-auth [--strict]
```

**チェック**: missing_reference / cycle (Tarjan's SCC) / orphan / type_mismatch / incomplete_bead / gray_in_locked_spec

**Exit code**: errors>0 → `1`、warnings only → `0`、`--strict` ならwarningsでも `1`

#### 4.3 `coherence-impact.ts`

BFS で影響範囲を階層出力。

```bash
deno run --allow-read \
  ~/.claude/skills/vcsdd-lite/scripts/coherence-impact.ts \
  --feature user-auth --node design:user-schema [--depth 5] [--format md]
```

**アルゴリズム**: 逆方向グラフでBFS。変更ノードに依存する側を遡る。

#### 4.4 `coherence-trace.ts`

要件IDからspec/test/impl/verifyへの完全なトレース表示。

```bash
deno run --allow-read \
  ~/.claude/skills/vcsdd-lite/scripts/coherence-trace.ts \
  --feature user-auth --req req:user-login [--bead bead:B-001-login-flow]
```

**出力**: spec / test / impl / verify の各次元での完全性を表示し、欠落次元を warning。

#### 共通ヘルパ `_types.ts` 例

```typescript
export type NodeType = "req" | "spec" | "design" | "test" | "impl" | "verify";
export type Confidence = "green" | "amber" | "gray";
export type EdgeKind = "depends_on" | "satisfies" | "verified_by" | "verifies";

export interface CoherenceNode {
  type: NodeType;
  path: string;
  confidence: Confidence;
  status?: "draft" | "reviewed" | "locked";
  depends_on: string[];
  satisfies: string[];
  verified_by: string[];
  beads: string[];
}

export interface CoherenceGraph {
  $schema: "vcsdd-lite-coherence-v1";
  version: string;
  feature: string;
  scanned_at: string;
  mode: "lean" | "strict";
  nodes: Record<string, CoherenceNode>;
  edges: Array<{ from: string; to: string; kind: EdgeKind }>;
  beads: Record<string, { members: string[]; completeness: "full" | "partial" }>;
  issues: Issue[];
  summary: Summary;
}
```

### 5. 移行手順

#### 5.1 既存環境状態（確認済）

- `claude/skills/vsdd/SKILL.md` のみ存在（412行）
- **外部参照ゼロ**（CLAUDE.md/docs/その他で `vsdd` 言及なし、grep 0件確認済）
- インストール構造: `~/.claude/skills` が dotfiles の `claude/skills/` への symlink
- 既存の `docs/vsdd-*.md` ファイル存在せず

#### 5.2 移行ステップ

```
Step 1: ディレクトリリネーム
  git mv claude/skills/vsdd claude/skills/vcsdd-lite

Step 2: SKILL.md 改修
  - frontmatter: name: vcsdd-lite, description更新
  - Verifierロール追記
  - Phase 1c (Coherence Mapping) 追加
  - Phase 4 影響伝播分析セクション追加
  - Phase 6 CEG整合性チェック追加
  - モード（lean/strict）セクション追加
  - Coherenceスクリプト使用法セクション追加
  - トレーサビリティチェーンセクション追加
  - 出力ファイル: docs/vcsdd/<feature>/ レイアウトに更新

Step 3: references/ 3ファイル作成
  - references/coherence.md (~150行)
  - references/strict-vs-lean.md (~80行)
  - references/trace-templates.md (~60行)

Step 4: scripts/ 6ファイル作成
  - scripts/_types.ts
  - scripts/_frontmatter.ts
  - scripts/coherence-scan.ts
  - scripts/coherence-validate.ts
  - scripts/coherence-impact.ts
  - scripts/coherence-trace.ts

Step 5: 手動E2Eテスト
  - サンプル機能を作成: docs/vcsdd/example-feature/specs/*.md
  - 4スクリプトを順次実行
  - coherence.json生成 → validate → impact → trace
  - 期待出力との一致を目視確認

Step 6: ドキュメント更新（任意）
  - CLAUDE.md の Skills セクションに /vcsdd-lite を追記
  - 必要なら docs/indie-dev-roadmap.md にVCSDD言及を追加
```

#### 5.3 install.sh への変更

**変更不要**。`~/.claude/skills` が dotfiles の `claude/skills/` にディレクトリ単位で symlink されているため、新ファイルは自動的に展開される。

オプションでDeno存在チェックを追加可能：

```bash
if ! command -v deno &> /dev/null; then
  echo "Warning: 'deno' not found. vcsdd-lite scripts require Deno."
fi
```

#### 5.4 旧 `vsdd` のフォールバック

完全削除を採用。理由：
- 外部参照ゼロ
- 「VSDDで開発」トリガーは vcsdd-lite の description に含めるため、自然言語起動は維持
- `git mv` 経由のため履歴は完全保持

#### 5.5 ロールバック計画

不具合時は `git revert <commit>` で完全に元状態へ復帰。symlink構造を触らないため即座に旧 vsdd が復元される。

#### 5.6 完了基準

| 項目 | 確認方法 |
|---|---|
| `vcsdd-lite` がスキル一覧に出現 | Claude Code起動時のスキルリスト |
| 起動トリガー有効 | "VCSDDで開発" "coherenceチェック" |
| Phase 1c が SKILL.md にある | grep "Coherence Mapping" SKILL.md |
| 4スクリプトが実行可能 | `deno check scripts/*.ts` |
| サンプルfeature E2E成功 | scan→validate→impact→trace 全成功 |
| 旧vsddディレクトリ削除 | `ls claude/skills/vsdd` で no such file |
| git履歴追跡可能 | `git log --follow` でVSDD時代まで辿れる |

#### 5.7 リスク & 対策

| リスク | 対策 |
|---|---|
| 大量のSKILL.md書き換えで情報損失 | references/ への退避前に既存内容保持、コミット細粒度 |
| Deno未インストール環境 | install.sh で警告。スクリプトは規律ベース運用でも代替可能 |
| frontmatter誤記でスクリプト破綻 | YAMLパースエラーを明示レポート、Exit 1 |
| 既存vsdd起動トリガー喪失 | description に「VSDDで開発」「Verified Spec-Driven Development」を残す |

## テスト戦略

### 単体テスト（手動）

各スクリプトに対する最小E2E：
1. サンプル `docs/vcsdd/test-feature/specs/sample.md` 作成
2. `coherence-scan.ts --feature test-feature` 実行 → `coherence.json` 生成確認
3. `coherence-validate.ts --feature test-feature` 実行 → exit code 0 確認
4. `coherence-impact.ts --feature test-feature --node spec:sample` 実行 → JSON出力確認
5. `coherence-trace.ts --feature test-feature --req req:sample` 実行 → markdown出力確認

### 異常系テスト

- 循環依存を含むサンプルで `coherence-validate.ts` が `cycle` エラーを返すこと
- 存在しないノード参照を含むサンプルで `missing_reference` エラーを返すこと
- frontmatter欠落ファイルでscanが警告し、該当ファイルをスキップすること

## 関連スキル

- `developing`: TDDワークフロー（Phase 0 / Phase 2 で参照）
- `writing-tests`: QA 6技法（Phase 2a で参照）
- `qa-testing`: E2E QA検証（Phase 6 後で参照）
- `design-intent`: 設計意図レビュー（Phase 3 補完）
- `devils-advocate`: 戦略ストレステスト（Phase 3 相補）
- `analyzing-requirements`: 要件分析（Phase 1 入力）
- `ship-check`: 出荷判断（Phase 6 後）

## オープン質問

なし（ブレインストーミングで全て解決済）。

## 次のステップ

1. ユーザによる本設計書のレビュー
2. 承認後、`superpowers:writing-plans` スキルで実装計画を作成
3. 実装計画を承認後、実装に着手
