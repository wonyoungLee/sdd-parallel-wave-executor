# Parallel Executor Skills

Install SDD parallel execution skills directly from GitHub with `npx`.

## Install

From the root of the project where you want to install the skill.

Kiro remains the default target:

```bash
npx github:wonyoungLee/sdd-parallel-wave-executor
```

Install the Codex OpenSpec skill:

```bash
npx github:wonyoungLee/sdd-parallel-wave-executor --target openspec
```

Install the Codex Spec Kit skill:

```bash
npx github:wonyoungLee/sdd-parallel-wave-executor --target speckit
```

Install both Codex skills:

```bash
npx github:wonyoungLee/sdd-parallel-wave-executor --target codex
```

For reproducible installs, prefer a tagged version:

```bash
npx github:wonyoungLee/sdd-parallel-wave-executor#v0.1.0 --target openspec
```

Targets:

| Target | Installed path |
| --- | --- |
| `kiro` | `.kiro/skills/parallel-wave-executor/SKILL.md` |
| `openspec` | `.codex/skills/openspec-parallel-apply/SKILL.md` |
| `speckit` | `.codex/skills/speckit-parallel-implement/SKILL.md` |
| `codex` | Installs both `openspec` and `speckit` |
| `all` | Installs `kiro`, `openspec`, and `speckit` |

## Usage

After installation, ask Kiro/Codex to use the relevant skill.

Kiro:

```text
Run the Kiro spec tasks with parallel waves.
```

Codex + OpenSpec:

```text
Run the OpenSpec tasks in parallel apply batches.
```

Codex + Spec Kit:

```text
Run the Spec Kit [P] tasks in parallel while respecting phases.
```

## OpenSpec Example

Install the OpenSpec Codex skill in a project that already has an OpenSpec change:

```bash
npx github:wonyoungLee/sdd-parallel-wave-executor --target openspec
```

Then ask Codex:

```text
Use openspec-parallel-apply for openspec/changes/add-dark-mode.
```

The skill reads `openspec/changes/{change}/tasks.md`, groups independent tasks into ordered apply batches, uses isolated git worktrees for parallel Codex workers when available, merges successful batches back in order, and leaves the result as local uncommitted changes for review.

## Spec Kit Example

Install the Spec Kit Codex skill in a project that already has a generated `specs/{feature}/tasks.md`:

```bash
npx github:wonyoungLee/sdd-parallel-wave-executor --target speckit
```

Then ask Codex:

```text
Use speckit-parallel-implement for specs/001-add-dark-mode.
```

The skill respects Spec Kit phases, dependencies, user story groupings, and `[P]` task markers. It only parallelizes tasks that are marked or clearly safe to run concurrently, and it downgrades same-file or same-component work to sequential execution.

Korean triggers are also supported:

```text
Kiro wave 병렬 실행해줘
OpenSpec apply 병렬 실행해줘
Spec Kit [P] task 병렬 실행해줘
```

## What the Skill Does

The skills parse an SDD `tasks.md`, run independent execution units in isolated git worktrees through available agent delegation, merge successful units back in the project-defined order, mark completed tasks, and leave the final result as local uncommitted changes for review.

Supported task locations:

```text
.kiro/specs/{feature}/tasks.md
openspec/changes/{change}/tasks.md
specs/{feature}/tasks.md
```

## Why This Matters

Spec-driven development tools such as Kiro, OpenSpec, and GitHub Spec Kit turn feature work into structured task files, but maintainers still spend time coordinating implementation order, checking which tasks can safely run in parallel, reviewing generated changes, and resolving integration risk. This project provides a reusable Codex workflow for that maintenance layer:

- isolate parallel implementation work with git worktrees
- map each SDD project's native task structure to safe execution units
- preserve ordered integration so dependency assumptions remain intact
- leave final changes uncommitted for maintainer review
- reduce repetitive implementation and review setup work across SDD-based open source projects

See [examples/openspec-demo.md](examples/openspec-demo.md) and [examples/spec-kit-demo.md](examples/spec-kit-demo.md) for reproducible demo flows.

## Requirements

- Node.js 16.7 or newer for the installer.
- A git repository in the target project.
- A supported SDD task file:
  - Kiro: `.kiro/specs/{feature}/tasks.md`
  - OpenSpec: `openspec/changes/{change}/tasks.md`
  - Spec Kit: `specs/{feature}/tasks.md`
- A Kiro/Codex environment with sub-agent delegation for actual parallel execution.

## Update

Run the same install command again from the target project root. The installer replaces the selected skill directory.

## Uninstall

Remove the installed skill directory or directories:

```bash
rm -rf .kiro/skills/parallel-wave-executor
rm -rf .codex/skills/openspec-parallel-apply
rm -rf .codex/skills/speckit-parallel-implement
```
