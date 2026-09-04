# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Personal dotfiles for macOS and Linux. Modular structure: each tool has its own directory
(git/, vim/, zsh/, fish/, tmux/, wezterm/, karabiner/, claude/) with config files and an
`install.sh` that symlinks them into place.

## Repository-Specific Gotchas

- **Symlink deployment**: `claude/install.sh` symlinks `claude/{skills,commands,agents,rules,hooks,settings.json}` into `~/.claude/`. Because these are directory symlinks, edits in the repo are live immediately — no redeploy step needed. New top-level artifacts (e.g. a new directory) need an `install.sh` update.
- **Git is GPG-signed** — ensure GPG is set up before committing outside Claude sessions.
- **tmux prefix is `Ctrl+s`**, not the default `Ctrl+b`.
- **ghq-managed repos live under `$HOME/dev`**; many functions assume this.
- The working volume is **case-sensitive** (`/Volumes/Partition_Case_Sensitive`); beware case-only renames.
- Modern CLI replacements are assumed (lsd for ls, delta for diff, bat, ripgrep, fzf, lazygit).
- Commit messages: Conventional Commits (`feat:` / `fix:` …). Committing is done by the `committer` agent.

## Working with This Repository

1. Each tool's configuration is self-contained in its directory.
2. Platform-specific code must check for Darwin (macOS) or Linux.
3. When adding a new tool: create a directory, add configs, write an `install.sh` that symlinks them, and update the main `install.sh` / `install_linux.sh` if needed.

## Claude Code Configuration (`claude/`)

| Layer | Location | Role |
|-------|----------|------|
| Skills | `claude/skills/<name>/SKILL.md` | 方法論・知識のSSOT（on-demand） |
| Commands | `claude/commands/*.md` | スキル/エージェントを起動する薄いオーケストレータ |
| Agents | `claude/agents/*.md` | Task起動用ペルソナ（知識はスキル/ルールを参照） |
| Rules | `claude/rules/**/*.md` | `paths:` frontmatter による条件付き制約 |
| Hooks | `claude/hooks/*.ts` | Deno製（notify / format / skill-memory） |

**重複禁止の原則**: 同じ知識を複数レイヤーに書かない。コマンド・エージェントはSSOT（スキル・ルール）を参照する。

- スキル・コマンドの使い分け: [docs/skills-guide.md](docs/skills-guide.md)
- スキルの自己進化ライフサイクル: [docs/self-evolving-skills.md](docs/self-evolving-skills.md)
- 新しいスキルは `claude/skills/<name>/SKILL.md` に作成（`/create-skill` 推奨。500行以下・description にトリガーワード）

### Per-Skill Memory (`.memory.md`)

各スキルは任意の `claude/skills/<name>/.memory.md`（gitignore・私的）にスキル固有の運用知識を蓄積する。
読み込みは `skill-memory.ts` フックが自動で行う。スキル使用後、そのスキル固有の失敗原因・入力の癖・非自明なTipsを見つけたら日付付きで追記する（テンプレ: `claude/skills/shared/references/memory-template.md`）。

- スキル自身の挙動・癖 → `.memory.md` / 問題・プロジェクト知識 → `agent-memory` スキル
- 複数タスクで再現した教訓は `references/lessons.md`（committed）へ昇格し、`.memory.md` から削除する

## Self-Improvement Protocol

ユーザーに訂正されたミスは、根本原因を理解した上で再発防止ルールを提案し、
合意が得られたら適切なレイヤー（CLAUDE.md / rules / skill）に追記する。
長期タスクのメモは `notes/pr-{number}.md` に残す（決定事項・ブロッカー・解決策）。

## Parallel Workflows

zsh/fish に worktree 管理関数がある: `wt`（fzf切替）/ `wt-add <name>` / `wt-rm <name>` / `za`〜`ze`（クイック切替）。
worktreeごとにClaude Codeを起動して並行開発できる。
