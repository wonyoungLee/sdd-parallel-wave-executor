# Parallel Wave Executor Skill

Install the `parallel-wave-executor` Kiro skill directly from GitHub with `npx`.

## Install

From the root of the project where you want to install the skill:

```bash
npx github:wonyoungLee/sdd-parallel-wave-executor
```

For reproducible installs, prefer a tagged version:

```bash
npx github:wonyoungLee/sdd-parallel-wave-executor#v0.1.0
```

The installer copies the skill to:

```text
.kiro/skills/parallel-wave-executor/SKILL.md
```

## Usage

After installation, ask Kiro/Codex to use the skill for requests such as:

```text
Run the Kiro spec tasks with parallel waves.
```

Korean triggers are also supported:

```text
wave 병렬 실행해줘
task 병렬로 돌려줘
parallel wave 실행
```

## What the Skill Does

The skill parses a Kiro Spec `tasks.md`, runs waves concurrently in isolated git worktrees through orchestrator sub-agents, runs tasks within each wave through parallel task sub-agents, merges waves back in wave order, and leaves the final result as local uncommitted changes for review.

## Requirements

- Node.js 16.7 or newer for the installer.
- A git repository in the target project.
- A Kiro spec with `.kiro/specs/{feature}/tasks.md`.

## Update

Run the same install command again from the target project root. The installer replaces the existing `parallel-wave-executor` skill directory.

## Uninstall

Remove the installed skill directory:

```bash
rm -rf .kiro/skills/parallel-wave-executor
```
