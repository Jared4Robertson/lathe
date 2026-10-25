# Brief: navigation by Define and Design folders, like S2's spec tree

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `nav-folders`.

## Goal
Jared wants the navigation to follow S2_sandbox's spec folder structure (read-only reference: `~/Development/S2_sandbox/docs/specs/08-accounting/`; never open any `.env*` file):

```
<domain>/
  01-define/   01-domain-model (aggregates and their rules)   02-use-cases (capabilities, use cases)
  02-design/   01-interaction-design (flows, web app, api)    02-technical-specification (components)    03-test-plan (tests)
00-shared/patterns
```

## The contract (committed; do not change it)
- `lathe/meta/kinds.csv` has a `section` column: each kind's folder within its stage (`domain-model`, `use-cases`, `interaction-design`, `technical-specification`, `test-plan`, or `shared` for patterns and pattern rules).
- `lathe/meta/sections.csv` lists the folders: `section, stage, order, label, description`.
- `lathe/src/types.ts`: `Kind.section`, `SectionRule`, and `Workspace.sections`.

## What to build
1. **Engine:** load `section` into `kinds` and `sections.csv` into a `sections` table and `Workspace.sections` (in stage then order). Extensions may add sections and set or change a kind's section (merging as for kinds, FORMAT section 9). Checks (new files from 60): `unknown-section` (error: a kind names a section that is not listed), `section-stage-mismatch` (error: a kind's section belongs to another stage). Update `lathe/FORMAT.md` (section 9 and a short new section 15 "Folders") and the sample workspace (`lathe/fixtures/workspace.sample.json`, add `section` to kinds and `sections`).
2. **Side nav:** inside the current space, the tree reads like S2's folders:
   - Product → **Shared** (only when the product has patterns) → patterns.
   - Product → domains → **Define** → *Domain model* (aggregates) and *Use cases* (capabilities, then use cases outside any capability); **Design** → *Interaction design* (flows, views, endpoints), *Technical specification* (components), *Test plan* (tests); then open questions.
   - Stages and folders are foldable nav rows, one level shown by default (the current page's branch opens itself), with counts; a folder with no records is hidden.
   - Labels and order come from `Workspace.sections`, never hard-coded.
3. **Domain page and group pages:** use the same folders and names as headings (Define → Domain model, Use cases; Design → Interaction design, Technical specification, Test plan), so the page and the nav match. Keep the one-level-deep folding and everything else.
4. **Graph:** leave the graph's grouping as it is for now.
5. **Tests** (engine: a new `lathe/test/sections.test.ts`; app: vitest + testing-library) and **Lathe's own spec**: use case `LA-CHK-UC21` under `LA-CHK-CAP03` (engine) and `LA-BRW-UC100` under `LA-BRW-CAP02` (app), with requirements, domain rules `LA-CHK-DR150`–`DR159` and `LA-BRW-DR130`–`DR139`, components `LA-CHK-C150`–`C159` and `LA-BRW-C130`–`C139`, tests `LA-CHK-T260`–`T269` and `LA-BRW-T260`–`T279`, and each use case added to a flow's `carries_out` (`LA-CHK-F03`, `LA-BRW-F90`). All satisfied and proved; every new rule applied.
6. **Plugin:** mention the `section` column in `plugin/skills/extend-the-meta-model/SKILL.md`.

## Scope
You own `lathe/**` (except `lathe/meta/*` and `lathe/src/types.ts`, already done), `app/**`, the spec records above and that plugin skill. Write American spelling. Never use port 5199; if you look at the app, use `npx vite --port 5403` in `app/` and stop it.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `cd app && npx tsc --noEmit`, `npm --prefix app test`, `npm --prefix lathe run check` (0 errors).
