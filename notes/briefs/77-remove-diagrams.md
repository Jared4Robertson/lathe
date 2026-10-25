# Brief: remove CSV diagrams from Lathe (hard cutover)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
The owner: "let's remove diagram from lathe, it's not needed and muddies the product. I don't need those brainstormed diagrams anymore either." Remove the CSV diagrams feature entirely, and delete the brainstorm diagrams themselves. Lathe is spec records only.

## Remove
1. **Data:**
   - delete `model/` (`diagrams.csv`, `people-and-tools/`, `sdlc-brainstorm/`, `queries.sql`, `README.md`);
   - delete any `model/` folder in the Tool Library example or the test fixtures.
2. **Engine:**
   - `lathe/src/server/diagrams.ts` and its API routes in `api.ts` and `serve.ts`;
   - the diagram types in `types.ts`;
   - the diagrams folder setting in `config.ts` and `lathe.config.json` files. A config that still names it is an error, since unknown keys aren't silently accepted.
   - the diagram checks and their CLI paths.
3. **App:**
   - `app/src/diagrams/`, the `/diagrams` routes in `router.tsx`, `App.tsx` and `address.ts`;
   - Diagrams in the nav, quick find, mobile bar, spaces and keymap, plus their icon and styles;
   - the diagram parts of `app/server/lathe.ts`, `events.ts`, `layout.ts` and `elk.ts`.
4. **Desktop:** the diagram parts of `desktop/src/devSource.ts`, and anything else that names diagrams.
5. **Docs:** the READMEs, `lathe/README.md`, FORMAT.md, the plugin (`plugin/skills/model-a-domain` and others), and the regenerated REFERENCE.md.
6. **Specs:**
   - delete the Diagram aggregate (`LA-MOD-A1`) with its rules, entities and events;
   - delete the Diagrams capability (`CAP01`), `UC01` "Create a diagram" and `UC02` "Edit a diagram" with their requirements;
   - delete every view, endpoint, component, flow and test that only serves diagrams, in every domain;
   - edit the records that mention diagrams in passing, such as Browsing's domain record ("beside the existing Diagrams pages") and the product record;
   - the product record says "Following the people-and-tools foundation": keep the idea (an agent is a Tool acting for a Person), and drop the reference to the brainstorm diagram.

## Keep (not this feature)
The **Model view**: an ERD drawn from entity and aggregate records (`app/src/model/`, `erd.ts` and its ELK layout). It uses the word "diagram" in places, and that stays. Only CSV diagrams go.

## Scope
- **Running at the same time:**
  - brief 75 (vertical-slices standard: `lathe/checks`, FORMAT.md, plugin);
  - brief 76 (converting `specs/lathe/**` to slices).
  
  You merge before 76. Keep your spec changes to deletions and small edits, so 76's remapping stays simple.
- Use test IDs from T700 upward if you need any.

## Checks
Run the full checks from the common rules, plus the stability and a11y suites, once each with one worker. Some scenarios may visit Diagrams; remove those. `lathe check` must give 0 errors. Then search the whole repo, except `notes/`, for "diagram", and list every hit that remains with why it stays. Never use port 5199.

## Report
The branch and its last commit, everything you deleted, the remaining "diagram" hits and why each stays, the checks you ran and their results, and anything left open.
