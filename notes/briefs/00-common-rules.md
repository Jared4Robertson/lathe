# Rules for every agent on the spec-store work

These apply to every brief in this folder.

## Context
Lathe is a toolkit for organising a product's lifecycle (domain model, use cases, interaction design, technical spec, test plan) as structured records that a database checks and a web app navigates. It is modelled on `~/Development/S2_sandbox/docs` (read-only reference; never open any `.env*` file there). The record format and meta-model are in [lathe/FORMAT.md](../../lathe/FORMAT.md), [lathe/meta/kinds.csv](../../lathe/meta/kinds.csv), [lathe/meta/relations.csv](../../lathe/meta/relations.csv); the engine/app contract is [lathe/src/types.ts](../../lathe/src/types.ts). A sample workspace is [lathe/fixtures/workspace.sample.json](../../lathe/fixtures/workspace.sample.json).

## Rules
- Work only in your own worktree and branch. Commit only the paths you own (`git add <your paths>`), with clear messages ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit when your work is done; several commits are fine.
- Never push, merge, deploy, or touch `main`.
- The contract files are fixed: do not edit `lathe/FORMAT.md`, `lathe/meta/*`, `lathe/src/types.ts` or `lathe/fixtures/workspace.sample.json`. If you need a change, work around it and put the request in your report.
- Do not edit files you do not own, even to fix something small; report it instead.
- Never use port 5199 (Jared's running dev server). If you must run a server, use the port your brief gives and stop it before you finish.
- Run only static checks (type checks) and the narrow tests for what you wrote, with at most 2 test workers. No long suites.
- Node 26 and npm are installed; so is the `duckdb` CLI. Install npm packages only inside the folder you own.
- Decide small questions yourself using the recommended option, and list each decision in your report. Write plain, direct English in specs and docs.

## Report (your final message)
1. Branch name and commit hashes.
2. Files you created or changed, grouped by folder.
3. Each decision you made and why, in one line each.
4. Checks you ran, with their actual results.
5. Anything left open, and any change you need in files you do not own.
