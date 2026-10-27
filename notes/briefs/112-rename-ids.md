# Brief: rename old IDs in code and tests, and LA's data follow-ups (step 4)

Read [00-common-rules.md](00-common-rules.md), [notes/store-interfaces.md](../store-interfaces.md) and [notes/conversions/la-id-map.json](../conversions/la-id-map.json) first. **Base branch: `domain-model`.** Work in your own worktree from it, and finish with your branch ready to merge into `domain-model`.

## Goal
LA's spec is now in the new model (brief 111), but code and tests still name old record IDs. `lathe check` on LA reports 717 `test-file-missing-id` errors, and most automated tests don't count as proof until their files name their new test IDs. Rename every old ID in code to its new one, so `lathe check` reaches 0 errors and coverage counts the real proof.

This brief runs in **two phases**. Phase A now: everything except `app/`. Phase B when the coordinator messages you that the app's branch has merged: `app/` (its tests, stability and perf suites, and source comments).

## Decisions (Owner and coordinator)
- **Test names start with their test record's ID,** as each test record's `file` says. Where one old test became several records (a split), split the code test into one `it` per record, each name starting with its own ID, sharing setup through helpers.
- **Source files name their technical records** in place of old component IDs (`LA-*-C..`), as each technical record's `file` says.
- **Records whose old test file was deleted** are "not automated yet" (brief 111). If a current test clearly proves one of them, name it, and set the record's run by to automated with that file, through the command layer.
- **LA data follow-ups,** through the command layer only:
  - Fold Platform's aggregate A8 into Authoring's A1 (nothing raises its event EV06 "Data written" since its command went). Remove what only served it, and repoint `fed_by` links at Authoring's Record changed.
  - Give Checking's EV01 its event type (it has none), with its delivery, if code for it exists; otherwise leave it not built.
  - Raise `too-many-children` only by design: Authoring's single aggregate has 68 entities on purpose. Add a product setting or check waiver for LA-AUT-A1 if the schema allows one; otherwise leave the warning and say so.
- The Owner's graph decisions arrive later with new wording for three Exploring requirements; the coordinator sends it in phase B.

## Owns
Phase A: `lathe/`, `desktop/`, `plugin/`, `examples/` (only if an old LA ID appears there), and LA's `data/`. Phase B adds `app/`. Don't touch the schema or the store.

## Checks
Phase A: lathe and desktop typecheck, tests and knip; `node lathe/bin/lathe.ts check` at the repo root, reporting counts by check (app-test errors remain until phase B). Phase B: the full checks from the common rules, `lathe check` with 0 errors, and the stability, a11y and perf suites once each with one worker. Never port 5199.

## Report
Per phase: the common rules' report, renames by package, tests split, records changed, and `lathe check`'s summary and coverage.
