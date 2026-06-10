# OpenSpec Parallel Apply Demo

This demo shows how to install and exercise the Codex OpenSpec skill in any repository that uses OpenSpec.

## Prerequisites

- Git repository with a clean working tree
- OpenSpec initialized in the project
- At least one active change under `openspec/changes/{change}/`
- `openspec/changes/{change}/tasks.md` exists
- Codex session with sub-agent delegation available for actual parallel execution

## Install

```bash
npx github:wonyoungLee/sdd-parallel-wave-executor#v0.2.0 --target openspec
```

This installs:

```text
.codex/skills/openspec-parallel-apply/SKILL.md
```

Restart or reload Codex if the skill list does not refresh immediately.

## Run

In Codex, ask:

```text
Use openspec-parallel-apply for openspec/changes/add-dark-mode.
```

Replace `add-dark-mode` with your active OpenSpec change name.

## Expected Flow

The skill should:

1. Read `openspec/changes/{change}/tasks.md`.
2. Read related OpenSpec context such as `proposal.md`, `design.md`, and `specs/**/*.md`.
3. Build ordered apply batches from task sections and dependency notes.
4. Show an execution plan and wait for approval.
5. Create isolated worktrees under `.worktrees/openspec-apply-{runId}/`.
6. Run independent apply batches through Codex workers when available.
7. Commit inside worktrees, merge successful branches in batch order, and soft reset to leave local uncommitted changes.
8. Mark completed tasks in `tasks.md`.
9. Report completed batches, failed tasks, changed files, checks run, and cleanup status.

## Verification

After completion:

```bash
git status --short
git diff
```

You should see local uncommitted changes on the original branch. No remote push should have occurred.

## Verified Install Smoke Test

The installer was verified against a minimal sample repository with this structure:

```text
openspec/changes/add-dark-mode/
├── proposal.md
├── design.md
├── specs/ui/spec.md
└── tasks.md
```

Command:

```bash
node bin/install.cjs --target openspec
```

Observed output:

```text
Installed Codex OpenSpec skill to /private/tmp/pwe-smoke-openspec/.codex/skills/openspec-parallel-apply
Restart or reload your Kiro/Codex session if the skill list does not update immediately.
```

Installed file:

```text
.codex/skills/openspec-parallel-apply/SKILL.md
```

## Notes

OpenSpec does not have a native "wave" concept. This skill uses OpenSpec terminology and derives ordered apply batches from the change's `tasks.md`.
