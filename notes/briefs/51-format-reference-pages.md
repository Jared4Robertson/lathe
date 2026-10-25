# Brief: a page per kind and per check, with contextual links (app)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after brief 50 (the generated format reference) and briefs 41, 48 and 49 have merged. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Brief 50 generates the format reference from the meta-model and the check headers, served at `/api/format`, with `FORMAT.md` cut to concepts. This brief gives each kind and each check its own page in the app, and links to them from wherever Jared is.

## Decisions already made (Jared, and the coordinator's recommendations)
1. **Pages.** Each page opens in the workbench like any other page: a pane, the title in the pane, and the inspector showing the kind's or check's facts.
   - `/format`: the concepts (from FORMAT.md), with an index of kinds by stage and folder, the relations and the checks by severity.
   - `/format/kinds/<kind>`:
     - the description;
     - stage and folder;
     - allowed parents and children, as links to their kind pages;
     - required fields, obligation, the ID convention, and the relations in and out;
     - the checks that concern it;
     - a real example: the product's first record of that kind, its header shown as code, linking to the record;
     - a count of the product's records of the kind, linking to a filtered search or the folder.
   - `/format/checks/<code>`:
     - its severity;
     - its explanation;
     - the source file path;
     - the product's current problems with that code, as clickable rows (R13).
2. **Contextual links:**
   - The inspector's **Kind** row links to the kind's page.
   - Every problem code on the Checks page, the domain page and the record page links to its check page.
   - A record page's required-field labels link to the kind page's fields.
   - The record format link leaves the nav footer. It becomes a "Record format" command in the palette and a link in the shortcuts sheet, and the desktop app's Help menu already has an entry (brief 47).
   - The footer keeps its "Specs read by the engine" line.
3. **Quick find** includes kinds and checks: "Kind: Use case" and "Check: too-many-children".
4. **Style:** follow the App code rules R01–R15. Lists of kinds and checks are clickable rows. Tokens only. Themes apply.

## Records
- Use case `LA-BRW-UC115` "Read how each kind and check works, from where I am" under `LA-BRW-CAP01`, with requirements.
- Domain rules from `LA-BRW-DR210`, components from `LA-BRW-C200` and tests from `LA-BRW-T440`. Add the use case to a flow's `carries_out`.
- Update the records about the old Record format page and the nav footer link (`C08` "Format page" and any requirement naming it).

## Scope
- **You own:** the format pages and routes, the links in the inspector, the Checks page, the record page and quick find, the nav footer change, the palette command, tests, and the records above.
- **Working at the same time:** check which other agents are running when you start, and stay out of their files.
- Never use port 5199. Use `npx vite --port 5413` in `app/` and stop it.

## Report
Use the format in 00-common-rules, with your branch and its last commit.
