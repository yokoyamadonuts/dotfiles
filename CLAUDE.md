# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal dotfiles repository for managing development environment configurations across macOS and Linux systems. The repository uses a modular structure where each tool has its own directory with configuration files and an installation script.

## Repository Structure

- **git/** - Git configuration with GPG signing, aliases, and difftastic integration
- **vim/** - Extensive Neovim configuration using Lua and lazy.nvim plugin manager
- **zsh/** - Z shell configuration with custom aliases, functions, and key bindings
- **fish/** - Fish shell configuration (alternative to zsh)
- **tmux/** - Terminal multiplexer configuration with platform-specific variants
- **wezterm/** - WezTerm terminal emulator configuration
- **karabiner/** - macOS keyboard remapping configuration
- **claude/** - Claude Code custom commands and configuration

## Installation and Setup

### Full Installation
```bash
# Clone repository
git clone https://github.com/skanehira/dotfiles.git
cd dotfiles

# Run individual installers (main install.sh is incomplete)
cd git && ./install.sh
cd ../vim && ./install.sh
cd ../tmux && ./install.sh
cd ../zsh && ./install.sh   # OR
cd ../fish && ./install.sh  # Fish shell alternative
cd ../wezterm && ./install.sh
cd ../karabiner && ./install.sh  # macOS only
cd ../claude && ./install.sh
```

### Key Dependencies
- Homebrew (package manager)
- Neovim
- Zsh with zsh-autosuggestions
- asdf (version manager)
- fzf, ripgrep, bat, lsd, delta, ghq, lazygit
- Docker, kubectl, terraform (for development)

## Common Commands and Workflows

### Essential Aliases
- `v` - Open Neovim
- `lg` - Launch lazygit
- `gs` - Git status
- `ll` - List files with details (using lsd)
- `k` - kubectl
- `d` - docker compose
- `t` - terraform

### Key Bindings
- `Ctrl+g` - Fuzzy search and switch to ghq-managed repositories
- `Ctrl+k` - Interactive git branch switcher with preview
- `Ctrl+q` - Toggle tmux popup window

### Development Paths
- Go binaries: `$HOME/go/bin`
- ghq repositories: `$HOME/dev`
- Deno binaries: `$HOME/.deno/bin`

## Neovim Configuration

### Plugin Management
Uses lazy.nvim as the plugin manager. Configuration files are in `vim/lua/plugins/`.

### LSP Support
LSP configurations are in `vim/after/` for:
- Deno, TypeScript, Rust, Lua, YAML

### Key Features
- AI integration: Copilot, Copilot Chat, Claude Code
- Git integration: Gina, Gitsigns, Diffview
- Fuzzy finding: Telescope
- Code templates: SonicTemplate
- LSP enhancements: tiny-code-action, tiny-inline-diagnostic
- Quickfix improvements: bqf, quicker

## Working with This Repository

### When modifying configurations:
1. Each tool's configuration is self-contained in its directory
2. Test changes by running the tool's install script to update symlinks
3. Platform-specific code should check for Darwin (macOS) or Linux

### When adding new tools:
1. Create a new directory for the tool
2. Add configuration files
3. Create an `install.sh` script that symlinks configurations to appropriate locations
4. Update the main `install.sh` or `install_linux.sh` if needed

### Important Notes
- Git is configured with GPG signing - ensure GPG is set up
- The repository assumes `$HOME/dev` as the base for ghq-managed repositories
- Tmux prefix is remapped to `Ctrl+s` (not the default `Ctrl+b`)
- Many tools expect modern CLI replacements (lsd for ls, delta for diff, etc.)

## Claude Code Integration

### Custom Commands
The `claude/` directory contains custom slash commands for Claude Code:
- `/commit` - Intelligent commit creation with conventional commit format and emoji
- `/review` - Comprehensive PR review with automated worktree management

### Command Features
- **Commit Command**: Automated pre-commit checks (lint, build, docs), conventional commit format with emoji, automatic commit splitting for complex changes
- **Review Command**: Systematic 6-phase review process, automatic worktree creation, consistency analysis with existing codebase

### Installation
Run `cd claude && ./install.sh` to install Claude Code custom commands to `~/.config/claude/`

## Self-Improvement Protocol

### Learning from Mistakes

When Claude makes a mistake that is corrected by the user:
1. Understand the root cause of the mistake
2. Propose a rule to prevent the same mistake
3. If the user agrees, update this CLAUDE.md with the new rule

Example prompt from user:
> "このミスを二度としないように、CLAUDE.mdを更新して"

### Project-Specific Notes

For complex or long-running tasks, maintain notes in the project:
1. Create a `notes/` directory if it doesn't exist
2. Create PR-specific notes: `notes/pr-{number}.md`
3. Update notes as the work progresses
4. Include: decisions made, blockers encountered, solutions found

### Adversarial Review Pattern

When reviewing your own work or plans:
1. First, create the plan or implementation
2. Then, review it as a "senior engineer" would
3. Ask tough questions: edge cases, error handling, performance
4. Only proceed when the review passes

Prompt example:
> "このPRを厳しくレビューして。テストに合格するまでPRを出すな"

## Parallel Workflows

### Git Worktree Setup

This dotfiles includes worktree management functions in zsh:
- `wt` - List/switch worktrees with fzf
- `wt-add <name>` - Create new worktree
- `wt-rm <name>` - Remove worktree
- `za`, `zb`, `zc`, `zd`, `ze` - Quick switch aliases

### Recommended Workflow

1. Main worktree: Primary development
2. Worktree 'a': Feature work
3. Worktree 'b': Bug fixes
4. Worktree 'c': Analysis/investigation (read-only queries, logs)

Run Claude Code in each worktree simultaneously for parallel development.

## Agentic Architecture (Subagent Tips)

### Using Subagents Effectively

Add "use subagents" to the end of complex requests to have Claude allocate more computational resources:
- Complex refactoring across multiple files
- Large codebase analysis
- Multi-step tasks with dependencies

Example:
> "このAPIの認証フローを全てリファクタリングして use subagents"

### Available Custom Agents

See `claude/agents/` for specialized agents:
- `committer` - Git commit with conventional format
- `planner` - Implementation planning
- `code-reviewer` - Code quality review
- `security-reviewer` - Security vulnerability detection
- `tdd-guide` - Test-driven development guidance
- `build-error-resolver` - Build/type error fixing

## Custom Skills

### Daily-Use Skills

Create skills for tasks done 2+ times per day:

| Skill | Purpose |
|-------|---------|
| `/techdebt` | Detect and remove duplicate/dead code |
| `/review` | Comprehensive PR review |
| `/commit` | Intelligent commit with conventional format |
| `/tdd` | TDD workflow guidance |
| `/build-fix` | Build error resolution |

### Creating New Skills

1. Create `claude/skills/<skill-name>/SKILL.md`
2. Define triggers, workflow, and expected output
3. Run `cd claude && ./install.sh` to deploy

## Plan Mode Best Practice

Follow the 80/20 rule:
- **80% planning**: Design, understand requirements, identify edge cases
- **20% implementation**: Execute the well-defined plan

When stuck, return to plan mode:
> "計画モードに戻って、この問題を再考して"

## Voice Input (macOS)

For faster prompting, use macOS dictation:
- Press **fn** key twice to start dictation
- Speak your prompt (3x faster than typing)
- Results in more detailed, natural prompts