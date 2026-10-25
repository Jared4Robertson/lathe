# Brief: Tool Library, pass 3 (settle its two open questions)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-3`.

## Goal
Settle the Tool Library's two open questions as decided, in both the spec and the code, keeping full coverage.

## Decisions already made (by Jared)
- **TL-LEND-Q01 Damage reported during a loan:** keep the reported damage. A return recorded as `good` does not clear damage reported while the tool was on loan; a librarian must mark it repaired. (This is today's behavior; make it an explicit domain rule.)
- **TL-LEND-Q02 Grace period:** count overdue by calendar day in the library's time zone. A loan is due at the end of its due date (the 14th day), so it becomes overdue at the start of the next day in the library's time zone, not one millisecond after a due instant. No librarian override. The library's time zone is a setting, defaulting to `America/New_York`. Due dates are shown and stored as dates (YYYY-MM-DD).

## Scope
- Read first: everything under `specs/tool-library/` and `examples/tool-library/`, and `lathe/FORMAT.md` section 8.
- You own: `specs/tool-library/**` and `examples/tool-library/**`.

## What to do
1. Change the code (model, services, router responses, the time-zone setting) and tests for Q02; keep the injected clock. Test the boundary: still not overdue at 23:59 on the due date in the library's zone, overdue at 00:00 the next day, including a case where UTC is already on the next day.
2. In the specs: remove `Q01` and `Q02` (and every `about` link to them), and write their answers into the rules, requirements, endpoints and components they affect, with new or changed test records proving them.
3. Keep coverage full: `npm --prefix lathe run check` shows `TL-LEND` with every requirement and rule satisfied and proved, and 0 errors.

## Checks
`npm --prefix examples/tool-library run typecheck`, `npm --prefix examples/tool-library test`, `npm --prefix lathe run check`.
