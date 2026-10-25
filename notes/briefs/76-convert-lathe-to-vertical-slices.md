# Brief: convert Lathe's spec to vertical-slice domains (hard cutover)

Read [00-common-rules.md](00-common-rules.md) and [../plans/vertical-slice-domains.md](../plans/vertical-slice-domains.md) first. The plan holds the owner's decisions. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Reorganize `specs/lathe/` from four technology domains into five capability slices:
- Authoring (`LA-AUT`)
- Checking (`LA-CHK`)
- Traceability (`LA-TRC`)
- Exploring (`LA-EXP`)
- Platform (`LA-PLT`)

Do it in one hard cutover. Each slice should read as one capability from top to bottom: its domain model, use cases and capabilities, views and endpoints, components in layers (Web app, Engine, Desktop and so on), and tests.

## How
1. **Map first.** Write a script that lists every record under `browsing/`, `checking/`, `desktop/` and `modeling/` with its kind, title and parent. Assign each record to a slice; give records under another record (requirements, steps, entities, rules) their parent's slice.

   Write the table to the scratchpad as `slice-map.csv` (old ID, new ID, slice, reason). Group it by aggregate and use case, so it can be reviewed by group rather than line by line.

   Guidance:
   - **Exploring:** the wiki, graph, Model view, search, tabs, nav and side bar content.
   - **Traceability:** coverage, obligations, the Traceability section, gaps and evidence, plus the coverage-gap checks (unsatisfied, unproved and similar).
   - **Checking:** the other checks, problems, severity and the Checks page.
   - **Authoring:** the format, meta-model, IDs, parsing, diagrams, patterns as a concept, and the format reference pages.
   - **Platform:**
     - the app shell, workbench and panels;
     - themes, shortcuts and commands;
     - the server, the API's transport and live reload;
     - the desktop shell.
   - **Desktop:** its use cases split by capability. Opening a product is Platform; its menus run other slices' commands.
   - **Split aggregates and use cases** that now straddle two slices, as the domain model needs, rather than forcing them into one.
2. **Renumber.** Each new domain numbers each kind afresh, in the old relative order. Child IDs follow their parent (for example `LA-EXP-UC07-R03`).
3. **Convert in one pass.** Move the files into `specs/lathe/<slice>/01-define|02-design/...` folders, with new domain records and `product.md` listing the five slices. Rewrite every ID across the whole repo except `notes/`:
   - links;
   - prose citations;
   - test titles in `app/test`, `lathe/test`, `desktop/test` and the stability, a11y and perf suites;
   - code comments;
   - the plugin and READMEs.

   Use whole-ID matching, longest first, so `LA-BRW-UC1` never matches inside `LA-BRW-UC12`. Then search for any old domain code left (`LA-BRW`, `LA-DSK`, `LA-MOD`, and old `LA-CHK` IDs that moved) and fix it.
4. **Fix the new shape.**
   - `lathe check` must report 0 errors. Every size warning the new shape raises gets fixed by structure (capabilities, layers, sub-layers), not waived.
   - The domains that follow `LA-PAT-APP-CODE` and `LA-PAT-APP-UX` follow them through the new slices.
   - Update the house check if it names a domain.
5. **Read each slice in the app.** Each domain's page, nav and graph should read as one capability. Save screenshots of each domain's page to the scratchpad.

## Scope
- **You own:** `specs/lathe/**`, plus ID rewrites anywhere outside `notes/`.
- **Running at the same time:**
  - brief 75, the vertical-slices standard check in `lathe/checks`, FORMAT.md and the plugin;
  - brief 72, the graph icicle, in `app/src/graph/**`, which adds records in `LA-BRW`.

  Both merge before you. Merge main last, rerun your mapping for any new records, and convert them too. The new check from brief 75 must not warn on any of the five slices.

## Checks
Run the full checks from the common rules, plus the stability, a11y and perf suites once each, with one worker. `lathe check` must give 0 errors. Never use port 5199.

## Report
- the branch and its last commit;
- the slice sizes (use cases, aggregates, components and tests in each);
- every aggregate or use case you split, and why;
- where the map's tables are;
- the checks you ran and their results;
- anything left open.
