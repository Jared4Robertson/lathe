# Brief: the engine on the new model (step 3)

Read [00-common-rules.md](00-common-rules.md), the plan [notes/plans/domain-model-refinement.md](../plans/domain-model-refinement.md) and [notes/store-interfaces.md](../store-interfaces.md) first. **Base branch: `domain-model`.** Work in your own worktree from it, and finish with your branch ready to merge into `domain-model`.

## Goal
`lathe check`, coverage and the generated reference run on the new schema. The Tool Library (`examples/tool-library/`, already converted) is your real product to check against; LA's data is being converted at the same time and won't load on your branch yet.

## Decisions (Owner, from the plan)
- **Checks** (rows in `lathe/data/check.jsonl`, rewritten for the new tables; retire every check of a removed kind or relation):
  - Errors: a view, integration, value object, specification or UI component that nothing uses; a pattern rule test naming a domain that doesn't follow the pattern.
  - Warnings: every recorded exception to one aggregate per command (`command_change`), with its reason; an event a policy hears, or a published event, whose event type isn't delivered by outbox; a test whose run by level its kind doesn't allow.
  - Gaps, reported as coverage: the "at least one" and "exactly one" minimums (a capability with no use case, a use case with no flow, an aggregate with no root or no command, a UC requirement no step fulfills, an obligation with no test, an event no command raises, and the like).
  - Keep the generic checks that still apply (size limits, product checks), rewritten.
- **Allowed run by levels per test kind:** constraint test unit; invariant and specification tests unit or database; domain service test unit; policy test database, api or e2e-api; use case test api, e2e-api, e2e-ui or manual; view test unit, e2e-ui or manual; endpoint test contract or api; flow test e2e-ui or manual; integration test contract, e2e-api or manual; pattern rule test any. Put them where checks and the reference read them.
- **Coverage** as views: every obligation is designed, built and proved as the plan's "How rules are enforced" defines. A UC requirement is designed when a step fulfills it; an obligation is built when the technical record that implements it (for invariants: its aggregate's data models or a unique key naming it; for constraints: its value object's value type; and so on) names a file that exists; proved when its tests exist at allowed levels, automated or manual.
- **The reference** (`lathe/REFERENCE.md`) is generated from the schema description and the check rows, by stage, and says what clean architecture's "use case" maps to (a command handler).
- **Code scanning** keeps finding record IDs in files, for the new kinds.
- **Contract:** you own `lathe/src/types.ts` and `lathe/src/server/contract.ts`, the engine and app contract, and change them for the new model. Commit the contract early and keep it stable: the app brief (110) adopts it when your branch merges.
- **Fixtures:** convert the engine's test fixtures to the new model, written with the store; delete tests of removed kinds and checks; every check has a test.

## Owns
`lathe/src/` except `store/` and `cli/`, `lathe/data/`, `lathe/test/` except `store/` and `cli/`, `lathe/REFERENCE.md`, `lathe/README.md`, the root `README.md`. The writers brief (109) owns `lathe/src/cli/`, `lathe/test/cli/` and the plugin; keep your edits to `lathe/bin/lathe.ts` to the engine's own commands.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix lathe run knip`, and `node lathe/bin/lathe.ts check --root examples/tool-library` with 0 errors (warnings and gaps it reports are the Tool Library's real gaps: list them). The app and LA's data aren't expected to work on your branch. Perf: `npm --prefix lathe run test:perf` keeps its budgets (or "not run (machine busy)").

## Report
The common rules' report, plus every check (kept, rewritten, new, retired), the coverage definition per obligation kind, the contract changes, and `lathe check`'s output on the Tool Library.
