# Spec Kit Parallel Implement Demo

This demo shows how to install and exercise the Codex Spec Kit skill in any repository initialized with GitHub Spec Kit.

## Prerequisites

- Git repository with a clean working tree
- Spec Kit initialized in the project
- A feature directory under `specs/{feature}/`
- `specs/{feature}/tasks.md` exists
- Codex session with sub-agent delegation available for actual parallel execution

## Install

```bash
npx github:wonyoungLee/sdd-parallel-wave-executor#v0.2.0 --target speckit
```

This installs:

```text
.codex/skills/speckit-parallel-implement/SKILL.md
```

Restart or reload Codex if the skill list does not refresh immediately.

## Run

In Codex, ask:

```text
Use speckit-parallel-implement for specs/001-add-dark-mode.
```

Replace `001-add-dark-mode` with your generated Spec Kit feature directory.

## Expected Flow

The skill should:

1. Read `specs/{feature}/tasks.md`.
2. Read related Spec Kit context such as `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/**`, `quickstart.md`, and `.specify/memory/constitution.md` when present.
3. Respect Spec Kit phases, user story groupings, dependencies, and `[P]` task markers.
4. Show an implementation plan and wait for approval.
5. Create isolated worktrees under `.worktrees/speckit-implement-{runId}/`.
6. Run independent `[P]` task groups or phase slices through Codex workers when available.
7. Commit inside worktrees, merge successful branches in Spec Kit execution order, and soft reset to leave local uncommitted changes.
8. Mark completed tasks in `tasks.md`.
9. Report completed phases/task groups, failed tasks, changed files, checks run, and cleanup status.

## Verification

After completion:

```bash
git status --short
git diff
```

You should see local uncommitted changes on the original branch. No remote push should have occurred.

## Notes

Spec Kit does not have a native "wave" concept. This skill uses Spec Kit terminology and parallelizes only `[P]` tasks or clearly independent task groups.
