# SP5: Lifecycle Capstone — 設計書

> **親プロジェクト**: "Self-Evolving Skills" — MUSE-Autoskill（[arXiv:2605.27366v1](https://arxiv.org/html/2605.27366v1)）をこの dotfiles のスキルエコシステムに適用する。
> **サブプロジェクト**: 5 分割のうち SP5（Lifecycle 統合 / capstone）。
> **ステータス**: 設計承認済み。
> **日付**: 2026-06-05。
> **前提**: SP1（メモリ）・SP2（ゲート）・SP3（Refinement）・SP4（Management）は実装・master マージ済み。

---

## 1. 背景と動機

SP1-4 で論文の各ステージ（Memory / Evaluation / Refinement / Management）を実装し、Creation は既存の `/create-skill` が担う。5つは master 上で既に連携稼働している。しかし**全体像が散在**している:

- CLAUDE.md の追記が「Custom Skills」と「レビュー系スキルの使い分け」に分散（特に 311 行の「スキルのライフサイクル」段落は SP3＋SP4 の文が後付けで詰め込まれ過密）。
- `docs/superpowers/` に 4 spec＋4 plan が揃うが**索引が無い**。
- 4つの役割（gate / action / management / qualitative）が脚注的で、peer として並んでいない。

SP5 は**新機能ではなく統合**: SP1-5 が1つの自己進化ループを成すことを1箇所に明文化し、発見可能性と一貫性を与える capstone。

## 2. 確定した設計判断

| # | 判断軸 | 選択 | 根拠 |
|---|-------|------|------|
| D1 | 中核 | 俯瞰文書 `docs/self-evolving-skills.md`（新規） | 全体像の正典。`docs/indie-dev-roadmap.md` と同じトップレベルで発見性確保 |
| D2 | CLAUDE.md | **統合**: 節追加＋過密段落整理 | capstone の目的（一貫性）。CLAUDE.md は毎回読まれるので軽量化も兼ねる |
| D3 | コード | **変更なし**（docs のみ） | SP1-4 のコードは完成・マージ済み。capstone は地図を描くだけ |

## 3. 俯瞰文書 `docs/self-evolving-skills.md`（中核・新規）

MUSE-Autoskill をこの repo に適用した全体像の正典。構成:

1. **イントロ**: 論文の5ステージと、この repo への翻訳（ランタイム非依存ゆえ「コマンド・規約・フック・索引文書の協調」で実現した、という制約と方針）。
2. **ライフサイクル図（ASCII）**: `create → evaluate → register → remember → refine → manage` の循環。各段を担う道具を併記。
3. **道具一覧表**: per-skill メモリ(SP1) / validate-skill(SP2) / refining-skills(SP3) / catalog-skills(SP4) ＋ create-skill。各々の「消費→生成」「コマンド/スクリプト」「権限」。
4. **4役割表（＋メモリ）**: gate(`validate-skill`, exit 1 でブロック) / action(`refining-skills`, 改善) / management(`catalog-skills`, advisory 俯瞰・常に exit 0) / qualitative(`reviewing-skills`, LLM 定性) ＋ memory(`skill-memory.ts` フック, `.memory.md` 注入)。SP4 spec §9 を昇格。
5. **データフロー**: フックが使用時に `.memory.md` を注入し経験が溜まる → `catalog-skills` が validate＋memory を集約し refine を推奨 → `refining-skills` が SKILL.md を改善し普遍的教訓を `references/lessons.md` へ昇格 → 改善は `/commit` で確定。
6. **索引**: 各 SP の spec / plan（`docs/superpowers/specs|plans/2026-06-05-*`）へのリンク。
7. **ステータス**: SP1-5 完了（マージ済み）。

> 文書は簡潔に（500行未満目安）。詳細は各 SP spec へ委譲し、ここは地図と索引に徹する。

## 4. CLAUDE.md 統合（節追加＋過密段落整理）

- **追加**: `## Custom Skills` 配下に `### Self-Evolving Skills（自己進化スキル）` 節 — 1行イントロ＋**4役割表**＋`docs/self-evolving-skills.md` への導線。これが CLAUDE.md 内の正典参照。
- **整理**: 過密化した「**スキルのライフサイクル**」段落（現 311 行）の SP3＋SP4 詰め込み部分を、新節/俯瞰文書への簡潔なポインタに置換。核となる1行ライフサイクル（create→…→manage）は残す。
- **保持**: コマンド表の `/refine-skill`・`/skill-catalog` 行、`### Per-Skill Memory` 節、`**スキル品質の2層**` ノート。実用的な参照なので温存し、重複の核だけ俯瞰文書へ送る。

## 5. 検証（docs のみ）

1. **俯瞰文書の存在＋リンク解決**: `docs/self-evolving-skills.md` が存在し、参照する各 spec/plan パスが実在する（`test -f` で全リンク先を確認）。
2. **CLAUDE.md 統合**: `### Self-Evolving Skills` 節が存在し、過密だったライフサイクル段落が整理されている（grep）。
3. **コード非変更（回帰なし）**: `.ts`/`.md`（スキル本体）に手を入れていないこと。`validate-skill --all` 緑・`catalog-skills` exit 0・`reviewing-skills` PASS が SP4 完了時と不変。
4. ユニットテストなし（docs のみ）。

## 6. ファイル一覧

| パス | 種別 | 内容 |
|------|------|------|
| `docs/self-evolving-skills.md` | 新規 | ライフサイクル俯瞰＋4役割表＋索引（中核） |
| `CLAUDE.md` | 変更 | `### Self-Evolving Skills` 節追加＋過密段落整理 |

## 7. スコープ

**IN（SP5）**:
- 俯瞰文書 `docs/self-evolving-skills.md`
- CLAUDE.md 統合（節追加＋過密段落整理＋俯瞰文書への導線）

**OUT（YAGNI）**:
- 新スキル/コマンド/コード
- 既存スキルの大規模リファクタ
- `docs/superpowers/` の構造変更（spec/plan はそのまま、索引で繋ぐ）
- ランタイム機構（論文どおりは dotfiles で不可）

## 8. 受け入れ基準

1. `docs/self-evolving-skills.md` が存在し、6ステージのライフサイクル図・道具一覧・4役割表・データフロー・各 SP への索引・ステータスを含む。
2. 索引の各リンク先（SP1-4 の spec/plan、SP5 の spec）が実在する。
3. CLAUDE.md に `### Self-Evolving Skills` 節（4役割表＋俯瞰文書への導線）が追加されている。
4. 過密だった「スキルのライフサイクル」段落が整理され、重複が俯瞰文書へ委譲されている。
5. コードは一切変更されていない（`validate-skill --all` 緑・`catalog-skills` exit 0・`reviewing-skills` PASS が不変）。
6. 俯瞰文書は簡潔（500行未満目安）で、地図と索引に徹している。

## 9. ロードマップ上の位置（最終）

```
                    ┌─────────────────────────────────────┐
                    │  ★ SP5: ライフサイクル統合 (capstone)  │  ← 本設計書（最終）
                    │  docs/self-evolving-skills.md         │
                    └─────────────────────────────────────┘
                          ▲          ▲          ▲
   ┌────────────────┐    ┌────────────────────┐
   │ SP3: Refinement │✅  │ SP4: Management     │✅
   └────────────────┘    └────────────────────┘
        ▲       ▲                  ▲
   ┌──────────────┐   ┌──────────────────┐
   │ SP2: Test-Gate│✅ │ SP1: メモリ        │✅
   └──────────────┘   └──────────────────┘
```

SP5 で論文適用が完了する。`Creation(create-skill) + Memory(SP1) + Evaluation(SP2) + Refinement(SP3) + Management(SP4)` が揃い、俯瞰文書がそれを1つの自己進化ループとして提示する。

## 10. 実装時に確定する事項（オープン）

- ライフサイクル図の正確な ASCII レイアウト。
- 道具一覧表・4役割表の列構成（俯瞰文書と CLAUDE.md で粒度を変えるか）。
- 「スキルのライフサイクル」段落の整理後の正確な文面（どこまで残しどこを俯瞰文書へ送るか）。
