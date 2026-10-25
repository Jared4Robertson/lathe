# Brief: entities for the Tool Library and Lathe's own domains

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge. This brief is data only: you write records, not code.

## Goal
Each aggregate gets its entities, S2-style, so the new Model view can draw an ERD for each domain and each aggregate. The read-only reference is `~/Development/S2_sandbox/docs/sdlc/01-define/02-domain-model/` (the standard and `aggregate.tmpl.md`). Never open any `.env*` file, and copy no S2 text or names into Lathe.

## The contract (committed in 757e991)
- The `entity` kind sits under an aggregate, with `role: root` or `role: child`. Exactly one root per aggregate that has entities.
- Its body has a `## Fields` table with the columns Field, Meaning, Kind of value and Example.
- `has_one` and `has_many` link entities inside one aggregate; `refers_to` links one entity to another anywhere.
- IDs are `<domain>-EN<nn>`.

## What to do
1. **Tool Library (`TL-LEND`).** Model it fully: each aggregate's root and child entities, with fields, plus the references between them (for example a loan refers to its member and its tool). Use plain business fields and examples that follow one case through the domain. No storage types: those belong in the technical specification.
2. **Lathe's domains (LA-BRW, LA-CHK, LA-MOD).** Model what each aggregate's records actually are, from its body and rules. Each aggregate gets a root, plus children where it has them.
   - Some of Lathe's aggregates, such as Page or Command in Browsing, may be more concept than data. Model them where an entity genuinely helps.
   - For any aggregate you leave without entities, list it in your report with the reason.
3. **Files:** put each entity at `<domain>/01-define/aggregates/<aggregate folder>/entities/EN<nn>-<slug>.md`, with `kind: entity`, `parent: <aggregate>`, `role`, a title, a one-sentence body before the Fields table, and its `links` (`has_one`, `has_many`, `refers_to`).
4. **Keep the structure checks quiet:** no aggregate over 15 children of one kind. Entities and domain rules count separately.

## Scope
- **You own:** the new entity records, and `links` additions on them.
- **Not yours:** brief 43 is adding the engine checks for entities (`entity-role`, `aggregate-root`, `entity-fields`, `has-crosses-aggregate`, `entity-unreferenced`). Write records that will pass them: one root; Field, Meaning, Kind of value and Example columns; unique field names; `has_*` inside one aggregate; every child reached from the root.
- Brief 45 is building the app's Model view.

## Checks
- `npm --prefix lathe run check`: 0 errors. It can't yet check the entity rules, so check them yourself with a small script and report what it found.
- Run the other full checks too.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and a table of entities per aggregate (ID, title, role, field count).
