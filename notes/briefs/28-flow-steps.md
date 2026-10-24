# Brief: flow steps as records

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-6`.

## Goal
S2 keeps most of its precision in tables, and reports traceability per flow step (re-trial recommendation 11). Start with flow steps: a `flow_step` record (already in `lathe/meta/kinds.csv`: parent `flow`, required `order`) carries its own `fulfills` (requirement, interaction requirement, domain rule) and `uses` (view, endpoint, component) links (already in `relations.csv`).

## What to do
1. Checks (new files numbered 50 onwards): `flow-step-order` (error: `order` not a whole number, or two steps of one flow share it); `flow-step-fulfills-outside-flow` (warning: a step fulfills something its flow does not carry out, that is, not a requirement of a use case the flow `carries_out`, nor an interaction requirement or rule reached from one — keep it conservative and say exactly what it compares); and when a flow has steps, the flow's own `fulfills` links are the union of its steps' (warning `flow-fulfills-differs-from-steps` when a flow fulfills something none of its steps do).
2. `lathe/FORMAT.md`: a new section 14 "Flow steps" with an example and the ID convention (`<flow>-S<nn>`, such as `TL-LEND-F01-S01`).
3. Engine tests in `lathe/test/flow-steps.test.ts` with fixtures `lathe/test/fixtures/flow-steps-*`.
4. Tool Library: write the steps of `TL-LEND-F01` (borrow) and `TL-LEND-F02` (return) as `flow_step` records with their links, moving each `fulfills` from the flow onto the step that does it. Keep 0 errors and full coverage.
5. App: on a flow's record page, show its steps in order as a table (step, what happens, uses, fulfills), folded one level like other lists; in the graph, steps sit under their flow (a group like other children). Tests for both.
6. Lathe's own spec: use case `LA-CHK-UC17` under `LA-CHK-CAP03` and `LA-BRW-UC80` under `LA-BRW-CAP01`, with requirements, domain rules `LA-CHK-DR110`–`DR119` and `LA-BRW-DR90`–`DR99`, components `LA-CHK-C110`–`C119` and `LA-BRW-C90`–`C99`, tests `LA-CHK-T190`–`T209` and `LA-BRW-T200`–`T219`, and a flow carrying out each, ideally written with steps. All satisfied and proved; every new rule applied.
7. Plugin: flow steps in `plugin/skills/design-the-domain/SKILL.md`.

## Scope
You own: check files 50 onwards, `lathe/FORMAT.md` section 14 (new, at the end; another agent adds section 13 at the end too, so expect to keep both on merge), the test file and fixtures above, `specs/tool-library/lending/02-design/flows/**` and the Tool Library records whose `fulfills` you move, `app/src/specs/RecordContent.tsx` and new files under `app/src/specs/` for steps, `app/src/graph/**`, `app/test/` files you add, the spec records above and that plugin skill. Others change coverage, config and `runChecks`, `ProductHealth.tsx` and the evidence panel in parallel; keep `app/src/styles.css` edits to one appended, marked section.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix examples/tool-library test`, `cd app && npx tsc --noEmit`, `npm --prefix app test`, `npm --prefix lathe run check` (0 errors).
