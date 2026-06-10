---
name: parallel-wave-executor
inclusion: manual
description: Execute Kiro spec tasks.md in parallel waves using isolated git worktrees, per-wave orchestrator sub-agents, unique run IDs, backup branches, and manifests; merge successful waves in order and leave the final result as local uncommitted changes for review.
---

# Parallel Wave Executor

Parse a Kiro Spec `tasks.md`, dynamically create one orchestrator sub-agent per wave, and run each wave concurrently in its own git worktree. Inside each wave, the orchestrator also runs the wave's tasks concurrently through dedicated task sub-agents. After execution, merge successful wave branches back into the main branch in wave order, mark completed tasks, and leave the final result as local uncommitted changes.

## Core Concepts

- **Wave = first-level parallel unit**: each wave is assigned to one orchestrator sub-agent.
- **Task = second-level parallel unit**: tasks inside a wave are executed concurrently by individual task sub-agents.
- **Per-wave isolation**: each wave works independently in its own git worktree and branch.
- **Ordered merge**: execution is parallel, but merge order must follow the wave number.
- **Run isolation**: branch, worktree, agent, backup, and manifest names include a unique `runId`.

```text
Wave 0 orchestrator
  |- Task 1.1 sub-agent (concurrent)
  `- Task 1.3 sub-agent (concurrent)
Wave 1 orchestrator
  `- Task 1.2 sub-agent
Wave 2 orchestrator
  |- Task 2.1 sub-agent (concurrent)
  |- Task 2.2 sub-agent (concurrent)
  |- Task 2.3 sub-agent (concurrent)
  |- Task 2.4 sub-agent (concurrent)
  `- Task 2.5 sub-agent (concurrent)

Waves also run concurrently.
```

## Trigger

Activate this skill when the user asks for requests such as:

- "Run the waves in parallel."
- "Execute the tasks in parallel."
- "Run the Kiro spec tasks with parallel waves."
- "wave 병렬 실행해줘"
- "task 병렬로 돌려줘"
- "parallel wave 실행"
- Any request that clearly indicates the user wants to execute a spec's `tasks.md` quickly through wave-based parallelism.

## Prerequisites

- A `.kiro/specs/{feature}/tasks.md` file must exist.
- The current workspace must be a git repository.
- The working directory must be clean with no uncommitted changes.
- `.gitignore` must include `.worktrees/`.
- The Kiro environment must support `invoke_sub_agent`.

## Safety Rules

- Show the execution plan and get user approval before creating branches, worktrees, agents, or commits.
- Add a unique `runId` to every branch, worktree, and generated agent filename to avoid collisions.
- Create a backup branch before merging so the user can return to the original state.
- Record created branches, worktrees, generated agents, and per-wave status in a manifest.
- Do not perform destructive cleanup automatically after failures. Report the cleanup targets and ask for confirmation.
- Never run `git push`, `git reset --hard`, or remote branch deletion.

## Execution Workflow

### Phase 0: Preflight and Plan Approval

1. **Select the feature spec**
   - If the user specified a feature name, use `.kiro/specs/{feature}/tasks.md`.
   - If no feature name was specified, find candidates under `.kiro/specs/*/tasks.md` and ask the user to choose.

2. **Check capability**
   - Verify that `invoke_sub_agent` is available in the current environment.
   - If it is unavailable, stop parallel execution and report only the manual wave/task execution plan.

3. **Check git status**
   - Run `git status --short` and verify that the working directory is clean.
   - If there are changes, stop and ask the user to commit, stash, or cancel.

4. **Check for leftovers from previous runs**
   - Look for `.worktrees/parallel-wave-*`.
   - Look for `.kiro/agents/parallel-wave-*.md`.
   - Look for `parallel-wave-*` branches.
   - If leftovers exist, do not delete them automatically. Report the list and ask whether to clean them up.

5. **Generate a run ID**
   - Format: `{featureSlug}-{YYYYMMDDHHmmss}`.
   - Example: `user-auth-20260610153022`.

6. **Report the plan and wait for approval**
   - Include the wave count and task list per wave.
   - Include worktree paths to be created.
   - Include branch names to be created.
   - Include generated agent file paths.
   - Include merge order.
   - Include likely risks, especially same-file edits and unclear dependencies.
   - Continue to Phase 1 only after the user approves.

### Phase 1: Preparation

1. **Parse `tasks.md`**
   - Read `.kiro/specs/{feature}/tasks.md`.
   - Extract the wave structure.
   - Build the task list for each wave.
   - Stop if no waves or no tasks are found.

2. **Record the current branch and commit hash**
   - Use `git branch --show-current` to record the current branch, which is the merge target.
   - Use `git rev-parse HEAD` to record the current commit hash. This hash is the soft-reset target in Phase 4.
   - If there are uncommitted changes, stop and report them to the user.

3. **Create a backup branch**

   ```bash
   git branch backup/parallel-wave-before-{runId} {startCommit}
   ```

   - Keep a recoverable reference before merge and soft reset.
   - If a backup branch with the same name already exists, stop and generate a new `runId`.

4. **Write the manifest**
   - Write execution state to `.kiro/tmp/parallel-wave-{runId}.json`.
   - Include at least these fields:

   ```json
   {
     "runId": "{runId}",
     "feature": "{feature}",
     "baseBranch": "{current branch}",
     "startCommit": "{commit hash}",
     "backupBranch": "backup/parallel-wave-before-{runId}",
     "waves": []
   }
   ```

5. **Determine the number of waves**
   - If there are 10 or fewer waves, run all waves concurrently.
   - If there are more than 10 waves, run them in batches of 10 because sub-agent parallelism is limited to 10 concurrent agents.

### Phase 2: Create the Environment for Every Wave

For every wave, perform the following setup before execution.

1. **Create a git worktree**

   ```bash
   git worktree add .worktrees/parallel-wave-{runId}/wave-{N} -b parallel-wave-{runId}-{N}
   ```

   - One wave = one worktree = one branch.
   - Worktree path: `.worktrees/parallel-wave-{runId}/wave-{N}`.
   - Branch name: `parallel-wave-{runId}-{N}`.
   - After successful creation, record the worktree, branch, and agent path in `waves[]` in the manifest.

2. **Dynamically create the wave orchestrator sub-agent (MANDATORY)**

   - You must physically create `.kiro/agents/parallel-wave-{runId}-{N}.md` before invoking the sub-agent.
   - This file must exist on disk before any `invoke_sub_agent` call.
   - Do not replace this step by embedding the agent information only in an inline prompt.
   - Each agent acts as the orchestrator for its wave and runs all tasks in that wave concurrently through individual task sub-agents.

   ````markdown
   # Parallel Wave {N} Orchestrator Agent

   ## Assigned Wave
   Wave {N} - Run every task in this wave concurrently through separate sub-agents.

   ## Working Directory
   All file operations must stay inside this absolute path:
   {absolute worktree path}

   ## Execution Method (MANDATORY)
   Invoke each task in this wave through a separate `invoke_sub_agent` call, and invoke those sub-agents concurrently.
   Even if the wave contains only one task, delegate it through `invoke_sub_agent`.

   ## Task List and Prompts for Sub-Agents

   ### Task {ID}: {task title}
   ```text
   You are the specialist agent for Task {ID}.
   Working directory: {absolute worktree path}
   Task:
   {task details}
   Acceptance criteria: {completion criteria}
   Reference context: {related requirements, design, and existing code}
   Rules:
   - Create or modify files only inside {absolute worktree path}.
   - Report the files you created or modified and any issues encountered.
   ```

   ### Task {ID}: {task title}
   ... (repeat the same pattern)

   ## Execution Rules
   - Invoke all task sub-agents concurrently.
   - Create or modify files only inside {absolute worktree path}.
   - Report the result of each task and the files created or modified.

   ## Context
   {related requirements extracted from requirements.md}
   {design information extracted from design.md}
   {relevant existing codebase files and structure}

   ## Constraints
   - Never modify files in another worktree or in the main workspace.
   - Treat all paths as relative to {absolute worktree path}.
   ````

3. **Check same-file edit risk**
   - If tasks in the same wave are likely to modify the same file or core files in the same directory, downgrade those tasks to sequential execution inside that wave.
   - Use these signals:
     - The same filename appears in multiple task descriptions.
     - Multiple tasks modify the same API, component, or domain model.
     - Multiple tasks modify migrations, schemas, or config files.
   - Record any sequential downgrade in the agent file and manifest.

### Phase 3: Run Waves in Parallel

> **MANDATORY CHECK**: Before calling `invoke_sub_agent`, verify that `.kiro/agents/parallel-wave-{runId}-{N}.md` physically exists for every wave. If any file is missing, return to Phase 2 and create it.

Invoke all waves concurrently with `invoke_sub_agent`:

```text
invoke_sub_agent("wave-0 orchestrator")
invoke_sub_agent("wave-1 orchestrator")
invoke_sub_agent("wave-2 orchestrator")

All calls above are made concurrently for first-level parallelism across waves.
```

Each wave orchestrator invokes its internal task sub-agents concurrently:

```text
Wave 0 orchestrator:
  invoke_sub_agent("Task 1.1")
  invoke_sub_agent("Task 1.3")
  Both calls are made concurrently for second-level parallelism across tasks.

Wave 2 orchestrator:
  invoke_sub_agent("Task 2.1")
  invoke_sub_agent("Task 2.2")
  invoke_sub_agent("Task 2.3")
  invoke_sub_agent("Task 2.4")
  invoke_sub_agent("Task 2.5")
  All calls are made concurrently for second-level parallelism across tasks.
```

When calling `invoke_sub_agent`, always include the wave's agent file in the `contextFiles` parameter:

```text
invoke_sub_agent(
  name="general-task-execution",
  prompt="...",
  contextFiles=[{ path: ".kiro/agents/parallel-wave-{runId}-{N}.md" }]
)
```

Prompt passed to each wave orchestrator:

```text
You are the Wave {N} orchestrator agent.

## Workspace
Perform all file operations inside this absolute path: {absolute worktree path}
When reading existing files, read them from this path.

## Execution Method (MANDATORY)
Invoke each task below through a separate `invoke_sub_agent(name="general-task-execution", prompt="...")` call, and invoke them concurrently.
Do not perform the tasks directly or sequentially. You must delegate them through `invoke_sub_agent`.

## Task Sub-Agent Prompts

### Task {ID} sub-agent:
You are the specialist agent for Task {ID}.
Working directory: {absolute worktree path}
Task: {task details}
Acceptance criteria: {completion criteria}
Reference context: {related context}
Rules:
- Create or modify files only inside {absolute worktree path}.
- Report the files you created or modified and any issues encountered.

### Task {ID} sub-agent:
... (repeat the same pattern)

## Rules
- Invoke all task sub-agents concurrently.
- Delegate through `invoke_sub_agent` even when there is only one task.
- Create or modify files only inside {absolute worktree path}.
- Report the result of each task and the files created or modified.
```

If there are more than 10 waves:

- Split the waves into batches of 10.
- Batch 1: run Waves 1-10 concurrently, then wait for completion.
- Batch 2: run Waves 11-20 concurrently, then wait for completion.
- Do not merge between batches. Merge only after every batch has completed.

Record progress in the manifest:

- Update each wave's started, completed, or failed status immediately.
- Record each task's success or failure and changed file list in the wave result.
- Exclude failed waves from merge and include the exclusion reason in the final report.

### Phase 4: Merge and Keep the Result as Uncommitted Changes

After all wave sub-agents complete:

> **Core rule**: The final result must remain on the user's local branch as uncommitted changes. The user reviews the changes and decides when to commit or push.

1. **Commit inside each worktree only**

   ```bash
   git -C .worktrees/parallel-wave-{runId}/wave-{N} add -A
   git -C .worktrees/parallel-wave-{runId}/wave-{N} commit -m "feat(wave-{N}): {wave summary}"
   ```

   - Do not commit directly on the main branch.
   - If a wave has no changes, do not create a commit. Record it as `no changes`.
   - If a wave requires tests or build checks, run them inside that worktree and record the result.

2. **Merge wave branches into the main branch in wave order**

   Merge strictly by wave number to preserve dependency order:

   ```bash
   git merge parallel-wave-{runId}-1 --no-edit
   git merge parallel-wave-{runId}-2 --no-edit
   git merge parallel-wave-{runId}-3 --no-edit
   ...
   ```

   If a conflict occurs:

   - Stop the merge.
   - Report which waves conflicted.
   - Show the conflicted files and relevant conflict content.
   - Ask the user how they want to resolve it.
   - Ask for confirmation before running `git merge --abort`.
   - Point the user to `backup/parallel-wave-before-{runId}` as the recovery reference.

3. **Soft reset the merge commits into uncommitted changes**

   After all merges complete, soft reset back to the starting commit hash recorded in Phase 1:

   ```bash
   git reset --soft {starting commit hash recorded in Phase 1}
   ```

   This leaves all wave changes staged and uncommitted, so the user can inspect them in the IDE and commit or push manually.

4. **Mark completed tasks in `tasks.md`**

   - Mark tasks from successfully merged waves as complete in `tasks.md`.
   - Change `- [ ] Task details` to `- [x] Task details`.
   - Keep failed tasks unchecked.
   - Include the `tasks.md` update in the staged changes.
   - After updating `tasks.md`, verify the completion scope with `git diff --staged` or `git diff`.

> **Never run `git push`**. Remote publishing is the user's responsibility.

### Phase 5: Cleanup

After all waves have run and merged:

1. **Remove worktrees**

   ```bash
   git worktree remove --force .worktrees/parallel-wave-{runId}/wave-{N}
   ```

   Remove every wave worktree.

2. **Delete wave branches**

   ```bash
   git branch -D parallel-wave-{runId}-{N}
   ```

   Delete all branches that were successfully merged.

3. **Remove the run worktree directory**

   Remove `.worktrees/parallel-wave-{runId}` if it is empty.

4. **Remove dynamically generated agent files**

   - Delete files matching `.kiro/agents/parallel-wave-{runId}-*.md`.
   - Do not modify any pre-existing agent files.

5. **Preserve or delete the manifest**

   - For a successful run, delete `.kiro/tmp/parallel-wave-{runId}.json` after the final report if it is no longer needed.
   - For a failed run, preserve the manifest and include it in the recovery guidance.

6. **Report the result**

   - Completed waves / total waves.
   - Completed tasks per wave.
   - Failed tasks, if any.
   - Full list of created or modified files.
   - Starting commit hash.
   - Backup branch.
   - Whether the final changes are staged and uncommitted.

## Wave Parsing Rules

Identify waves in `tasks.md` with these rules:

1. **Explicit wave headings**

   ```markdown
   ## Wave 1
   - [ ] Task 1
   - [ ] Task 2

   ## Wave 2
   - [ ] Task 3
   ```

2. **Dependency-based inference when there are no explicit wave headings**

   - Analyze dependencies between tasks.
   - Group independent tasks into the same wave.
   - Place dependent tasks in later waves.

## Error Handling

| Situation | Response |
| --- | --- |
| `invoke_sub_agent` is unavailable | Do not start parallel execution. Report only the wave/task execution plan. |
| Previous branch/worktree/agent leftovers exist | Do not delete them automatically. Report the list and ask the user whether to clean up. |
| Wave orchestrator execution fails | Mark that wave as `failed` in the manifest and skip it during merge. |
| Task sub-agent execution fails | Mark only that task as `failed`. Continue running the other tasks in the same wave. |
| Merge conflict | Stop immediately, report the conflicting wave and files, and ask whether to run `git merge --abort`. |
| Worktree creation fails | Check git status and same-name branch/worktree collisions, then report the cause. |
| Every wave fails | Stop the full execution, report the manifest and created resource list, and ask whether to clean up. |
| Cleanup fails | Report the exact remaining branch, worktree, and agent paths, then suggest manual cleanup commands. |

## Constraints

- Run at most 10 waves concurrently because of the Kiro sub-agent parallel execution limit.
- Run at most 10 tasks concurrently inside each wave.
- Use only workspace-local paths, especially `.worktrees/`.
- Each sub-agent must modify files only inside its assigned worktree.
- Merge waves strictly in wave-number order: 0 -> 1 -> 2 -> 3 -> ...
- If tasks in the same wave are likely to modify the same files and conflict, the orchestrator may switch those tasks to sequential execution.

## `.gitignore` Setup

Before using this skill, add the following entry to `.gitignore`:

```gitignore
.worktrees/
```

## Example

```text
User: "Run the user-auth spec tasks with parallel waves."

Execution flow:
1. Parse .kiro/specs/user-auth/tasks.md and identify Waves 0, 1, and 2.
2. Generate runId: user-auth-20260610153022.
3. Report the execution plan: waves, tasks, worktrees, branches, agent files, and merge order.
4. After user approval, create backup branch: backup/parallel-wave-before-user-auth-20260610153022.
5. Create manifest: .kiro/tmp/parallel-wave-user-auth-20260610153022.json.
6. Create three worktrees under .worktrees/parallel-wave-user-auth-20260610153022/.
7. Dynamically create three wave orchestrator agent files.
8. Run the three wave orchestrators concurrently.
   - Each orchestrator runs its task sub-agents concurrently.
9. After all waves complete, commit in each worktree and merge in order: 0 -> 1 -> 2.
10. Soft reset so the merged result becomes local uncommitted changes.
11. Mark completed tasks in tasks.md.
12. Clean up worktrees, branches, and generated agent files.
13. Report completed waves/tasks, failures, backup branch, and staged status.
```
