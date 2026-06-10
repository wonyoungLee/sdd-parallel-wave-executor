---
name: openspec-parallel-apply
description: Execute OpenSpec change tasks in parallel apply batches with isolated git worktrees, Codex sub-agents when available, ordered merges, and final local uncommitted changes for review.
---

# Parallel Apply Executor for OpenSpec

Use this skill when the user asks Codex to run an OpenSpec change quickly with parallel apply batches, for example:

- "Run the OpenSpec tasks in parallel."
- "opsx apply 병렬로 실행해줘"
- "OpenSpec change를 병렬 apply로 실행해줘"
- "openspec tasks를 병렬 batch로 처리해줘"

## Scope

This skill targets OpenSpec changes under:

```text
openspec/changes/{change}/tasks.md
```

Related context should be read from the same change directory when present:

```text
openspec/changes/{change}/proposal.md
openspec/changes/{change}/design.md
openspec/changes/{change}/specs/**/*.md
openspec/config.yaml
openspec/specs/**/*.md
```

Do not archive or sync the change unless the user explicitly asks. This skill only implements tasks and marks completed tasks in `tasks.md`.

## Codex Capability Check

Before executing in parallel, verify that Codex sub-agent delegation is available in the current session.

- If sub-agents are available, use one worker per independent apply batch or task group.
- If sub-agents are not available, do not fake parallel execution. Report the apply plan and ask whether to execute sequentially.

## Safety Rules

- Show the execution plan and get user approval before creating worktrees, branches, commits, or running workers.
- Require a clean git working tree before starting.
- Never run `git push`.
- Never run `git reset --hard`.
- Never delete branches, worktrees, or manifests after a failure without user approval.
- Create a backup branch before merging apply batch branches.
- Keep all intermediate work under `.worktrees/openspec-apply-{runId}/`.
- Leave the final result on the user's current branch as local uncommitted changes.

## Preflight

1. Select the OpenSpec change.
   - If the user names a change, use `openspec/changes/{change}/tasks.md`.
   - Otherwise list `openspec/changes/*/tasks.md`, excluding `openspec/changes/archive/**`, and ask the user to choose.
2. Read `tasks.md` and all available context files in the change directory.
3. Run `git status --short`.
   - Stop if there are uncommitted changes.
4. Check that `.gitignore` contains `.worktrees/`.
   - If missing, include adding it in the approval plan.
5. Check for leftovers:
   - `.worktrees/openspec-apply-*`
   - `.codex/tmp/openspec-apply-*.json`
   - branches matching `openspec-apply-*`
6. Generate `runId`:
   - Format: `openspec-{changeSlug}-{YYYYMMDDHHmmss}`.

## Apply Batch Building Rules

Build ordered apply batches conservatively from the OpenSpec change's `tasks.md`:

1. Top-level task sections or phase headings define sequential apply batches.
2. If `tasks.md` contains explicit dependency notes, use those dependencies to split batches.
3. Within a batch, tasks may run concurrently only when they are explicitly marked parallel or clearly modify disjoint files.
4. If tasks mention the same file, same component, same schema, same route, same migration, or same config, run them sequentially inside that batch.
5. If task independence is unclear, choose sequential execution for that group.

For every task, extract:

- task id or checkbox line
- title/description
- target file paths mentioned in the task
- related requirements/scenarios from `specs/**/*.md`
- design notes from `design.md`

## Execution Plan

Before modifying anything, show:

- selected change
- tasks file path
- apply batch count
- task list per batch
- which task groups will run in parallel
- which groups were downgraded to sequential and why
- worktree paths
- branch names
- merge order
- backup branch name
- risks, especially same-file edits and cross-batch dependencies

Continue only after user approval.

## Preparation

Record:

```bash
git branch --show-current
git rev-parse HEAD
```

Create:

```bash
git branch backup/openspec-apply-before-{runId} {startCommit}
mkdir -p .codex/tmp
```

Write a manifest:

```text
.codex/tmp/openspec-apply-{runId}.json
```

Include `runId`, `change`, `baseBranch`, `startCommit`, `backupBranch`, apply batch metadata, worker status, changed files, and errors.

For every apply batch:

```bash
git worktree add .worktrees/openspec-apply-{runId}/batch-{N} -b openspec-apply-{runId}-{N}
```

## Parallel Execution

Use Codex sub-agents only when available. Assign each worker one worktree and one apply batch or task group.

Worker prompt requirements:

- Working directory is the absolute path to the assigned worktree.
- Read OpenSpec context from that worktree only.
- Implement only the assigned tasks.
- Modify files only inside that worktree.
- Run relevant tests/build checks when the task calls for them.
- Report changed files, tests run, failures, and completed task ids.
- Do not commit, push, merge, reset, or clean up.

Run at most 10 workers concurrently. If there are more than 10 runnable apply batches or task groups, batch them.

Update the manifest as each worker starts, completes, or fails.

## Merge

After workers finish:

1. In each successful apply batch worktree:

   ```bash
   git -C .worktrees/openspec-apply-{runId}/batch-{N} add -A
   git -C .worktrees/openspec-apply-{runId}/batch-{N} commit -m "feat(openspec apply batch-{N}): {summary}"
   ```

2. Merge successful apply batch branches into the original branch in batch order:

   ```bash
   git merge openspec-apply-{runId}-{N} --no-edit
   ```

3. If any merge conflicts:
   - Stop immediately.
   - Report the conflicting apply batch and files.
   - Do not abort unless the user approves.
   - Point to `backup/openspec-apply-before-{runId}`.

4. After all successful merges:

   ```bash
   git reset --soft {startCommit}
   ```

5. Mark completed tasks in `openspec/changes/{change}/tasks.md` with `[x]`.
   - Keep failed or skipped tasks unchecked.

## Cleanup

For a successful run, remove only resources created by this run:

```bash
git worktree remove --force .worktrees/openspec-apply-{runId}/batch-{N}
git branch -D openspec-apply-{runId}-{N}
```

Remove `.worktrees/openspec-apply-{runId}` if empty. Delete the manifest only after the final report if it is no longer needed.

For a failed run, preserve the manifest and report exact cleanup targets instead of deleting them.

## Final Report

Report:

- completed apply batches / total apply batches
- completed tasks / total tasks
- failed or skipped tasks
- changed files
- tests/build checks run
- backup branch
- start commit
- whether final changes are staged/uncommitted
- any cleanup still needed
