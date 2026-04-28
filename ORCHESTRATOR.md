# Orchestrator Manual

## The four agents (defined in `.claude/agents/`)

| Agent            | Tools                                   | Writes?          | Purpose                                                      |
|------------------|-----------------------------------------|------------------|--------------------------------------------------------------|
| `gwen-research`  | Read, Bash, Grep, Glob, WebFetch, WebSearch | no           | Produces a control spec from GWEN C++ source (+ web).        |
| `gwen-coding`    | Read, Write, Edit, Bash, Grep, Glob     | `src/`, `demo/`  | Implements TypeScript, keeps `npm run build` green.          |
| `gwen-testing`   | Read, Write, Edit, Bash, Grep, Glob     | `tests/`         | Writes Playwright specs (pointer + touch).                   |
| `gwen-feedback`  | Read, Bash, Grep, Glob                  | no               | Runs tests, compares to GWEN, returns PASS/ITERATE/BLOCKED.  |

Invoke via the Agent tool, passing `subagent_type: "gwen-research"` etc.

## The loop (per task)

pick task T with all deps done
1. spec = Agent(gwen-research, "Task T: <name>")
2.  Agent(gwen-coding, "Task T - implement per spec:\n" + spec)
  * must leave `npm run build` + `npm run typecheck` green
3. Agent(gwen-testing, "Task T - write Playwright tests for <control>")
  * must leave `npm test -- <control>.spec.ts` runnable
4. verdict = Agent(gwen-feedback, "Task T - verdict for <control>")
  * PASS    -> mark T `done` in tasks.md, go to next task
  * ITERATE -> Agent(gwen-coding, "Task T - iterate. Feedback:\n" + verdict) then back to [4]. Cap at 3 iterations.
  * BLOCKED -> mark T `blocked`, note why in tasks.md, pick next ready task

Exactly three iteration rounds per task. On the 4th would-be round, mark `stuck`, move on, surface at next checkpoint.

## Parallelism

Run tasks in parallel when their dep graphs don't overlap. Concretely:

- Phase 0 is strictly sequential (T000 -> T010).
- Within Phase 1, after core is done, groups like `{T100, T111, T114}` are independent - launch concurrently with multiple Agent calls in one message.
- Don't parallelize two tasks that both write `src/index.ts` - they'll race. Serialize anything that edits the barrel file.

Default concurrency: 3 tasks in flight. Raise if the machine handles it.

## Checkpointing

Every 5 completed tasks:
1. Run the full test suite: `cd GwenJs && npm test`.
2. Record the minified bundle size: `ls -la dist/gwen.min.js`.
3. Post a one-paragraph summary to the user: what shipped, what's next, any `stuck` items.

Every phase completion: run typecheck, full tests, rebuild, and write a one-page phase summary to `GwenJs/docs/PROGRESS.md` (append, don't overwrite).

## Commit discipline

- After each task reaches `PASS`, make one commit via Bash.
- Commit message format: `T<ID> <Title> - <one-line summary>` (e.g. `T101 Button - initial implementation, pointer + touch, 12 tests`).
- Never squash across tasks. One task = one commit = one reviewable unit.
- Never force-push. Never rewrite history. Never skip hooks.

## Done criteria

The project is done when all of these hold:

- [ ] Every row in `tasks.md` is `done`.
- [ ] `cd GwenJs && npm run typecheck` - clean.
- [ ] `cd GwenJs && npm run build` - clean. `dist/gwen.min.js` exists, <= 150 KB.
- [ ] `cd GwenJs && npm test` - all projects (`desktop` + `mobile`) green, zero skipped.
- [ ] `demo/index.html` loaded in a browser shows the full UnitTest-equivalent demo.
- [ ] `docs/documentation.md`, `docs/agent_docs.md`, `README.md` exist and aren't stubs.
- [ ] No external assets under `demo/assets/`. All textures generated at runtime.
- [ ] No runtime `dependencies` in `package.json` - only `devDependencies`.

Until all boxes are ticked, keep looping. If fundamentally stuck after 3 attempts on a critical-path task, surface to user with a specific ask.

## First session checklist (run before any tasks)

1. `cd GwenJs && npm install` - installs dev deps (this may need network).
2. `npx playwright install chromium webkit` - Playwright browsers.
3. `npm run build` - should succeed against the stub source.
4. `npm test -- bootstrap.spec.ts` - the sanity spec should pass, proving the pipeline works.
5. Only then: start T000 -> T001 -> ,,,

If any of steps 1-4 fail, stop and debug the infrastructure before touching tasks. A broken pipeline pollutes every subsequent verdict.

## Anti-patterns

- Do not implement a control without first running `gwen-research`. The spec is what keeps the port honest.
- Do not let `gwen-coding` write tests. Don't let `gwen-testing` modify `src/`. Don't let `gwen-feedback` edit anything.
- Do not accept `gwen-feedback: PASS` if the build or tests weren't actually run. The agent must show command output.
- Do not expand scope. If you discover an interesting refactor mid-flight, add a new task to `tasks.md` and continue.
- Do not silently absorb flaky tests with retries. Flag them.

## How to re-enter mid-way

If a prior session ended mid-task:
1. Read `tasks.md` - find the single `in-progress` task.
2. Read `git log --oneline -20` to see what landed.
3. Diff `git status` for uncommitted work.
4. Decide: resume, revert, or mark `stuck` and move on.

Leave breadcrumbs - when you pause, update the task's status note.
