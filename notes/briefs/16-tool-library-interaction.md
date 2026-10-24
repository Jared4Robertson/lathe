# Brief: the Tool Library adopts interaction requirements and test states

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-4`.

## Goal
Show the new format on the example product: the Tool Library's API rules (request validation, error codes and responses) become interaction requirements on its endpoints, each fulfilling a use case requirement or domain rule, satisfied by a component and proved by a test; and at least one test of each state (automated, manual, planned), so the example shows them all.

## What to do
1. Read `lathe/FORMAT.md` (sections 3, 4, 6 and 9) and `lathe/meta/*.csv`.
2. Under `specs/tool-library/lending/02-design/`, add interaction requirements (`TL-LEND-E0n-R0n`) under the endpoints, for the rules that belong to the API rather than to the domain (for example: the body's fields and limits, the error code and status for each refusal, what a success returns). Move any such rule out of a use case requirement where it is really an interaction rule, keeping IDs that remain.
3. Add `state` to every test record (automated for the existing ones). Add one manual test (for example a smoke test of the README's curl steps) and one planned test (for something real you leave for later), and say why in each.
4. Where it is natural, switch one rule test to the S2 style, keyed in code by the rule's ID rather than a test ID, to show both styles work.
5. Keep the code and its tests in step; every obligation satisfied and proved, except the one deliberately planned.

## Scope
You own: `specs/tool-library/**` and `examples/tool-library/**`.

## Checks
`npm --prefix examples/tool-library run typecheck`, `npm --prefix examples/tool-library test`, `npm --prefix lathe run check`. The engine changes are being made in parallel, so in your branch the check may still demand `run_by` and a test ID in code; report what it says, and say which messages the engine changes will clear.
