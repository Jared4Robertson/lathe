# Rules for every agent on the spec-store work

These apply to every brief in this folder.

## Context
Lathe is a toolkit for organizing a product's lifecycle (domain model, use cases, interaction design, technical spec, test plan) as structured records that a database checks and a web app navigates. It is modeled on `~/Development/S2_sandbox/docs` (read-only reference; never open any `.env*` file there). Specs are typed tables stored as one JSONL file per table in each product's `data/` folder, with git as the history. The schema is the SQL migrations in [lathe/schema/](../../lathe/schema/); [lathe/REFERENCE.md](../../lathe/REFERENCE.md) is generated from it and the check rows (never edit it by hand); the store's interfaces are in [notes/store-interfaces.md](../store-interfaces.md); the engine/app contract is [lathe/src/types.ts](../../lathe/src/types.ts) and [lathe/src/server/contract.ts](../../lathe/src/server/contract.ts). Change data only through the command layer (the `lathe` CLI, the plugin's MCP tools or the app), never by editing JSONL by hand.

## Rules
- **First, before anything else:** your worktree may have been created from an older commit. Run `git merge --ff-only <base>` with the base branch your launch message names, and confirm `notes/briefs/` and your brief exist. If the fast-forward fails, stop and report.
- Work only in your own worktree and branch. Commit only the paths you own (`git add <your paths>`), with clear messages ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit when your work is done; several commits are fine.
- Never push or deploy. Never check out another branch in the main checkout (`/Users/jaredrobertson/Development/Lathe` stays on `main`; Jared's dev server runs from it).
- **Finish with your branch ready to merge.** The worktree sandbox blocks writing to the main checkout, so the coordinator merges. Before you report:
  1. Merge current `main` into your branch and resolve any conflicts, keeping both sides.
  2. Run the full checks on your branch: `npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `cd app && npx tsc --noEmit`, `npm --prefix app test`, `npm --prefix desktop run typecheck`, `npm --prefix desktop test` (the test scripts already cap workers at 2; the desktop smoke test runs only on macOS), `npm --prefix app run knip`, `npm --prefix lathe run knip` and `npm --prefix desktop run knip` (no unused files, exports or dependencies; the app's test run also runs all three, LA-PLT-T129) and `npm --prefix lathe run check` with 0 errors. For UI changes, also run `npm --prefix app run test:stability` (the stability suite, LA-PAT-APP-UX-R08: Playwright with Chromium, one worker, on a free port; it takes about two minutes). For changes that touch loading, the graph, the Model view or the engine's load, also run `npm --prefix app run test:perf` and `npm --prefix lathe run test:perf` (performance budgets, LA-PAT-APP-UX-R11). Above a one-minute load of 12 they measure without judging; report them as "not run (machine busy)" and never loosen a budget. Run the accessibility suite with the stability suite, `npm --prefix app run test:a11y` (LA-PAT-APP-UX-R10: axe-core at WCAG 2.2 AA on every page and state, and the keyboard scenarios, on the same harness), and leave no finding.
  3. Report the branch and its last commit. The coordinator merges it into `main` straight away.
- The contract files are fixed unless your brief says otherwise: do not edit `lathe/schema/*`, `lathe/src/types.ts` or `lathe/src/server/contract.ts`. If you need a change, work around it and put the request in your report.
- Do not edit files you do not own, even to fix something small; report it instead.
- **Stop only processes you started**, by the PID you recorded when you started them. Never kill a process found by its port or name (`lsof -i`, `pkill`, `killall`): other apps, the Claude app's own services included, may hold that port. Prefer SIGTERM, and wait before SIGKILL.
- Never use port 5199 (Jared's running dev server). If you must run a server, use the port your brief gives and stop it before you finish.
- Quit every process you start (Electron, Vite, Playwright browsers, servers) before you report. Quit Electron gracefully; kill it only when it will not quit.
- **Hard cutovers, always** (the owner's rule): when you rename or reshape anything, change every call site, record and test to the new form in the same change and delete the old form. Never add redirects, aliases, dual signatures, upgrades of saved state or old names kept "to avoid churn"; stale saved state is simply dropped.
- **Removal sweep:** when you remove or replace a behavior, search the whole repo (code, CSS, tests, suites, specs, docs) for its name, class names, command IDs and record IDs, and remove what only served it. In your report, list every hit that remains and why it stays. Nothing outlives its purpose (LA-PAT-APP-CODE-R21).
- While you work, run only static checks and the narrow tests for what you wrote, with at most 2 test workers; run the full checks once, before you merge.
- Node 26 and npm are installed; so is the `duckdb` CLI. Install npm packages only inside the folder you own. A fresh worktree has no `node_modules`: run `npm install` in each package folder you need (`lathe/`, `app/`, `desktop/`, `examples/tool-library/`).
- Run `npm --prefix lathe run check` before you finish if you touched anything under `specs/`, and report its last lines. Leave no errors.
- A decided open question is removed (delete its record and every `about` link to it) and its answer written into the records it affects. Records carry no status or decision history.
- Specs name roles (Owner, Reader, Agent), never people.
- Decide small questions yourself using the recommended option, and list each decision in your report. Write plain, direct English, with American spelling (modeling, color, center, organize), in code, specs and docs.

## Report (your final message)
1. Branch name and commit hashes.
2. Files you created or changed, grouped by folder.
3. Each decision you made and why, in one line each.
4. Checks you ran, with their actual results.
5. Anything left open, and any change you need in files you do not own.
