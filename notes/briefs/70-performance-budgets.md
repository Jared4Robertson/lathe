# Brief: performance, measured and kept within budgets

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after brief 56 (graph depth and the context ring) has merged. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Lathe has grown: many views, the graph and ERD with React Flow and elkjs, themes, and DuckDB in the engine. Measure how fast it is, fix the slow parts, and set budgets that tests enforce.

## What to do
1. **Measure the engine:** `loadWorkspace` time on Lathe's own spec (about 1,500 records) and on a synthetic product of 10,000 records (generated in a temporary folder), broken down by phase (parse, load into DuckDB, checks, coverage, reference). Also measure the live-reload time after one file changes.
2. **Measure the app:**
   - bundle size per chunk (a Vite build report);
   - first load to interactive on a record page;
   - time to switch views, re-center the graph at depth 3, and open the Model view;
   - memory after 50 navigations.
   
   Use brief 53's Playwright suite.
3. **Fix the clear wins:**
   - lazy-load the graph, the Model view and the theme editor, so the first load ships only the wiki;
   - split elkjs into a worker if layout blocks the main thread;
   - in the engine, incremental reload: re-parse only changed files, and rerun only the checks whose kinds changed, if that's sound (otherwise say why);
   - cache the reference.
4. **Budgets (decided):**
   - the first-load JavaScript for the wiki is 250 KB or less gzipped;
   - a record page is interactive within 1.5 s on the dev machine;
   - a view switch and a graph re-center each take under 100 ms of main-thread work;
   - engine load on Lathe's spec is under 2 s, and a live reload under 500 ms.
   
   A `test:perf` script checks them, run with the stability suite for UI changes. Report any budget you can't meet, and why.
5. **Guard it:** add a rule ("Lathe stays within its performance budgets") to the App experience pattern, or to App code if brief 63 hasn't landed, and a Checking domain rule for the engine budgets.

## Records
Requirements for the budgets under fitting use cases, or a new one, with domain rules, components and tests from the next free numbers.

## Scope
- **You own:** the perf scripts, the lazy-loading and worker changes, the engine reload changes, and the records above.
- Check which agents are running when you start, and stay out of their files beyond these.
- Never use port 5199.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and the numbers before and after.
