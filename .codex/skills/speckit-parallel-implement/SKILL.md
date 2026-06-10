---
name: speckit-parallel-implement
description: Execute GitHub Spec Kit tasks.md by respecting phases, dependencies, and [P] parallel task groups with isolated git worktrees, Codex sub-agents when available, ordered merges, and final local uncommitted changes for review.
---

# Parallel Implement Executor for Spec Kit

Use this skill when the user asks Codex to run GitHub Spec Kit implementation tasks with phase-aware parallelism, for example:

- "Run the Spec Kit tasks in parallel."
- "speckit implement를 병렬로 실행해줘"
- "$speckit-implement 대신 [P] task를 병렬 처리해줘"
- "Spec Kit phases를 지키면서 병렬 실행해줘"

## Scope

This skill targets GitHub Spec Kit feature directories under:

```text
specs/{feature}/tasks.md
```

Related context should be read from the same feature directory when present:

```text
specs/{feature}/spec.md
specs/{feature}/plan.md
specs/{feature}/research.md
specs/{feature}/data-model.md
specs/{feature}/contracts/**
specs/{feature}/quickstart.md
.specify/memory/constitution.md
```

This skill is an implementation runner. It does not replace `speckit-specify`, `speckit-plan`, or `speckit-tasks`; use it after `tasks.md` exists.

## Codex Capability Check

Before executing in parallel, verify that Codex sub-agent delegation is available in the current session.

- If sub-agents are available, use one worker per independent phase slice or `[P]` task group.
- If sub-agents are not available, do not fake parallel execution. Report the implementation plan and ask whether to execute sequentially.

## Safety Rules

- Show the execution plan and get user approval before creating worktrees, branches, commits, or running workers.
- Require a clean git working tree before starting.
- Never run `git push`.
- Never run `git reset --hard`.
- Never delete branches, worktrees, or manifests after a failure without user approval.
- Create a backup branch before merging phase/task-group branches.
- Keep all intermediate work under `.worktrees/speckit-implement-{runId}/`.
- Leave the final result on the user's current branch as local uncommitted changes.

## Preflight

1. Select the Spec Kit feature.
   - If the user names a feature, use `specs/{feature}/tasks.md`.
   - Otherwise list `specs/*/tasks.md` and ask the user to choose.
2. Read `tasks.md` and all available context files in the feature directory.
3. Run the Spec Kit prerequisite script when present:
   - `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`
   - Use the PowerShell equivalent on Windows if needed.
4. Run `git status --short`.
   - Stop if there are uncommitted changes.
5. Check that `.gitignore` contains `.worktrees/`.
   - If missing, include adding it in the approval plan.
6. Check for leftovers:
   - `.worktrees/speckit-implement-*`
   - `.codex/tmp/speckit-implement-*.json`
   - branches matching `speckit-implement-*`
7. Generate `runId`:
   - Format: `speckit-{featureSlug}-{YYYYMMDDHHmmss}`.

## Phase and Parallel Task Group Rules

Spec Kit task files encode phases, dependencies, user story groupings, and `[P]` parallel markers. Respect those terms.

1. Use Spec Kit phase headings as the ordered outer execution structure:
   - Setup first.
   - Foundational second and blocking.
   - User story phases after foundational.
   - Polish last.
2. Within each phase:
   - Tasks marked `[P]` may run in parallel only when file paths are disjoint.
   - Tasks without `[P]` run sequentially.
   - Tests for a story run before implementation tasks when tests are present.
3. Different user story phases may run in parallel only after foundational tasks are complete and only when they are independently testable.
4. If tasks mention the same file, same component, same schema, same route, same migration, or same config, run them sequentially inside that phase or task group.
5. If task independence is unclear, choose sequential execution for that group.

For every task, extract:

- task id, for example `T012`
- `[P]` marker
- story label, for example `[US1]`
- target file paths
- dependencies implied by task text
- related requirements from `spec.md`
- architecture and constraints from `plan.md`

## Execution Plan

Before modifying anything, show:

- selected feature
- tasks file path
- phase count
- task list per phase
- which `[P]` task groups will run in parallel
- which groups were downgraded to sequential and why
- worktree paths
- branch names
- merge order
- backup branch name
- risks, especially same-file edits and cross-story dependencies

Continue only after user approval.

## Preparation

Record:

```bash
git branch --show-current
git rev-parse HEAD
```

Create:

```bash
git branch backup/speckit-implement-before-{runId} {startCommit}
mkdir -p .codex/tmp
```

Write a manifest:

```text
.codex/tmp/speckit-implement-{runId}.json
```

Include `runId`, `feature`, `baseBranch`, `startCommit`, `backupBranch`, phase and task-group metadata, worker status, changed files, and errors.

For every phase or independent task group branch:

```bash
git worktree add .worktrees/speckit-implement-{runId}/group-{N} -b speckit-implement-{runId}-{N}
```

## Parallel Execution

Use Codex sub-agents only when available. Assign each worker one worktree and one phase slice or `[P]` task group.

Worker prompt requirements:

- Working directory is the absolute path to the assigned worktree.
- Read Spec Kit context from that worktree only.
- Implement only the assigned tasks.
- Modify files only inside that worktree.
- Run relevant tests/build checks when the task calls for them.
- Report changed files, tests run, failures, and completed task ids.
- Do not commit, push, merge, reset, or clean up.

Run at most 10 workers concurrently. If there are more than 10 runnable task groups, batch them.

Update the manifest as each worker starts, completes, or fails.

## Merge

After workers finish:

1. In each successful phase/task-group worktree:

   ```bash
   git -C .worktrees/speckit-implement-{runId}/group-{N} add -A
   git -C .worktrees/speckit-implement-{runId}/group-{N} commit -m "feat(speckit task-group-{N}): {summary}"
   ```

2. Merge successful phase/task-group branches into the original branch in Spec Kit execution order:

   ```bash
   git merge speckit-implement-{runId}-{N} --no-edit
   ```

3. If any merge conflicts:
   - Stop immediately.
   - Report the conflicting phase/task group and files.
   - Do not abort unless the user approves.
   - Point to `backup/speckit-implement-before-{runId}`.

4. After all successful merges:

   ```bash
   git reset --soft {startCommit}
   ```

5. Mark completed tasks in `specs/{feature}/tasks.md` with `[x]`.
   - Keep failed or skipped tasks unchecked.

## Cleanup

For a successful run, remove only resources created by this run:

```bash
git worktree remove --force .worktrees/speckit-implement-{runId}/group-{N}
git branch -D speckit-implement-{runId}-{N}
```

Remove `.worktrees/speckit-implement-{runId}` if empty. Delete the manifest only after the final report if it is no longer needed.

For a failed run, preserve the manifest and report exact cleanup targets instead of deleting them.

## Final Report

Report:

- completed phases/task groups
- completed tasks / total tasks
- failed or skipped tasks
- changed files
- tests/build checks run
- backup branch
- start commit
- whether final changes are staged/uncommitted
- any cleanup still needed
