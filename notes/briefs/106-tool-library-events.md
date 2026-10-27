# Brief: real domain events in the Tool Library (step 2, follow-up)

Read [00-common-rules.md](00-common-rules.md), the plan [notes/plans/domain-model-refinement.md](../plans/domain-model-refinement.md), [notes/store-interfaces.md](../store-interfaces.md) and the conversion sheet [notes/conversions/tool-library.md](../conversions/tool-library.md) first. **Base branch: `domain-model`.** Work in your own worktree from it, and finish with your branch ready to merge into `domain-model`.

## Goal
The Tool Library is Lathe's worked example of the new model, so its code must do what its spec says. Today the spec says returning a tool that needs repair is a **policy** (TL-LEND-PO01: Tool returned is heard, and Report damage is invoked), but `src/lending-service.ts` changes the loan and the tool in one transaction. That breaks the rule that a command changes exactly one aggregate. The Owner chose to make the code honest: raise real domain events and run the policy through its event handler.

## Decisions (Owner)
1. **Each command raises its domain events** (the six in the spec: Member registered, Tool added, Damage reported, Tool repaired, Loan opened, Tool returned), each with the fields its event records list.
2. **Events are published after the command's transaction commits,** through a small in-process dispatcher. No outside library or message broker.
3. **TL-LEND-PO01's event handler hears Tool returned** and, when the condition is needs repair, invokes Report damage through its command handler, in its own transaction, with the return note as the damage note. Return a tool changes only the loan.
4. **The HTTP API's behavior doesn't change.** Dispatch is synchronous after commit, so a caller who returns a tool needing repair sees the tool needing repair on its next request. If the handler fails, the return still stands; log the failure. Say in the README that this is eventual consistency, done in-process for the example.

## Build
- Event types in code (one per event record), the dispatcher, the event handler, and the command handlers publishing their events.
- **Spec, through the command layer only** (the store's functions from a one-time script you don't commit, or the CLI if it runs):
  - add the six event type records and the event handler's file;
  - update the records whose wording described the old inline behavior, such as the return handler's description and any notes;
  - keep the sheet in step.
- **Tests:**
  - the policy test proves the reaction through the dispatcher;
  - a test shows Return a tool changes only the loan when the handler is not subscribed;
  - every existing test still passes.
  Test names start with their record IDs, as now.

## Owns
`examples/tool-library/` and `notes/conversions/tool-library.md`. Don't touch anything else.

## Checks
`npm --prefix examples/tool-library test` and `npm --prefix examples/tool-library run typecheck` pass, and a fresh load of the Tool Library's data through the store succeeds. The engine, `lathe check` and the app aren't expected to work on this branch yet; don't run them.

## Report
Follow the common rules' report. List the records added or changed.
