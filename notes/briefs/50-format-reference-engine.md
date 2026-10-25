# Brief: generate the format reference from the meta-model (engine and docs)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
`lathe/FORMAT.md` (445 lines, edited in 35 commits) is a hand-kept copy of facts that Lathe already holds as data:
- the kinds (`lathe/meta/kinds.csv`);
- the relations (`relations.csv`);
- the folders (`sections.csv`);
- 58 checks (`lathe/checks/*.sql`), each of which explains itself in a header comment.

Every feature means editing FORMAT in step, and it drifts. Jared decided:
- generate the reference from the data;
- cut FORMAT.md to the concepts;
- give a page per kind and per check, with contextual links (the app part is brief 51);
- add `lathe format` to write the reference out;
- add a check that every check and kind is documented.

This brief covers the engine and the docs.

## Decisions already made (Jared, and the coordinator's recommendations)
1. **A reference model in the engine.** Add `Workspace.reference`, or a separate `formatReference(root)` API if it's large, holding:
   - **For each kind** (after extensions): its label, description, stage, folder, allowed parents and children, required fields, obligation (yes, proof or no) and its ID convention. Move the ID rows of FORMAT section 3 into a column or a small `ids.csv` in `lathe/meta/`.
   - **For each relation:** its source and target kinds, role and description.
   - **For each folder:** its stage, order, label and description.
   - **For each check** (Lathe's and the product's own): its code, severity, explanation (the header comment as Markdown) and source file. List the kinds it concerns only if that can be read reliably, for example from an optional `-- kinds: …` header line.
   - **Extensions:** the reference reflects the product's extensions and its own checks, so each product's reference is its own.
2. **Check headers are the documentation.**
   - **Header format:** every `.sql` check starts with a header comment of one summary sentence, a blank comment line, then the explanation and how to fix it. Normalize the existing 58 checks' headers to that shape without changing their SQL.
   - **Severity and code:** read them from the `SELECT 'warning' AS severity, '<code>' AS "check"` line, or require them as header lines (`-- check: …`, `-- severity: …`), whichever is more robust. Say which in the report.
3. **`lathe format`** writes the generated reference as Markdown, by default to stdout, with `--out <file>`. The order: concepts (from FORMAT.md), then kinds, relations, folders and checks, each with an anchor. The plugin skills and briefs then point to `lathe format`, or to a committed `lathe/REFERENCE.md` that `npm --prefix lathe run build` regenerates.
   - Commit `lathe/REFERENCE.md` so agents can read it without running anything.
   - Add a test that fails when the committed file is stale, so it can never drift.
4. **The "documented" check.** Add `undocumented` as an error, numbered from 71, reported for any of:
   - a kind with an empty description;
   - a relation with an empty description;
   - a check file without a summary and explanation.
   
   A product's own checks follow the same rule.
5. **FORMAT.md cut to concepts.** Keep what records are, where they live, the header and links, how IDs work (the principle, with the table now generated), the stages and folders as an idea, coverage and obligations, patterns and pattern rules, capabilities, layers and entities as ideas, citations, fitness, and extending the meta-model. Remove the lists of kinds, relations, checks and ID rows; point to the reference instead. Target about a quarter of today's size, in plain American English. Fix any links into FORMAT's section numbers across the repo (app, specs, plugin, briefs, README) that the cut breaks.
6. **API for the app (brief 51):** serve the reference at `/api/format` from `lathe/src/server/api.ts`. The Vite plugin `app/server/lathe.ts` already proxies `/api/*` through `handleApi`; check that it does, without editing app code beyond that.

## Lathe's own spec (LA-CHK)
- Use case `LA-CHK-UC25` "Read the format reference generated from the meta-model" under `LA-CHK-CAP03`, with requirements.
- Domain rules from `LA-CHK-DR190`, components from `LA-CHK-C180`, in the right layers, and tests from `LA-CHK-T300`.
- Keep aggregates and layers at 15 or fewer. Add the use case to `F03`'s `carries_out`.

## Scope
- **You own:** `lathe/**`, including the check header normalization, FORMAT.md, the new REFERENCE.md, the meta files you need, `plugin/**`, the links to FORMAT sections across the repo (text-only edits in other files are fine), and the records above.
- **Not yours:** app UI pages. Those are brief 51, which starts after briefs 41, 48 and 49 merge.
- **Working at the same time:**
  - Brief 41 (tabs), brief 48 (clickable rows) and brief 49 (themes) are in `app/`.
  - Brief 47 is in `desktop/`.
  - If a link fix touches a file one of them owns, keep it to one line and note it in your report.

## Report
Use the format in 00-common-rules, with your branch and its last commit, the before and after line counts of FORMAT.md, and the header format you settled on.
