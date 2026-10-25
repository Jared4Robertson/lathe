# Brief: fix the false warnings S2 trial 4 found (engine)

Read [00-common-rules.md](00-common-rules.md) first, then `notes/trials/s2-trial-4.md`. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Trial 4 ran Lathe on three whole S2 domains, 2,458 records. Lathe matched S2 on UC requirements and domain rules, but most of the remaining errors and warnings were false: real material that Lathe can't express yet. Fix the small, clear ones, which narrowly extend what Lathe already does. The larger gaps (technical flows, API and integration kinds, waivers, standards, relationship detail) wait for Jared.

## Decisions already made (the coordinator's recommendations, under Jared's go-ahead for clear work)
1. **A `supports` relation.** Add it from `test` to any obligation kind, with role `''` (no proof), and with the labels "Supports" and "Supported by". It's for engineering checks and design checks that back a requirement without proving it. It never counts as proof, so it raises no `proof-not-in-file`, `proof-still-owed` or `test-file-missing-id` problem.
2. **Flow paths.** Add an optional `path` field on `flow_step`, a short name such as `main` or `refused`. The step-order check becomes per path: orders are whole numbers, unique and without gaps within each `(flow, path)`. A step with no path is in the `main` path.
3. **`key_file` on tests.** Add an optional field naming the file that holds the test's `key`, when the test runs from a shared class in another file. With `key_file` set, `proof-not-in-file` and `test-file-missing-id` look for the key in `key_file`, which must exist and sit under the product root. `run_by` must still exist.
4. **Fields column alias.** The Fields table also accepts "Business meaning" for its Meaning column, in any letter case. Document both names.
5. **Grouping levels (the small part of gap 1):**
   - `domain_rule` may also sit under an `entity`; its domain and aggregate come from its ancestors, as with layers.
   - `layer` may also sit under a `layer`, for nested sub-layers.
   - Coverage, the structure checks and every check that reads a record's domain must treat both like any other parent chain. Prove it with twin tests, as brief 36 did.
6. **Records and docs:**
   - Add the relation row, the ID or field notes and the parent-kind changes to `lathe/meta`, so the `undocumented` and `relation-unlabeled` checks are satisfied.
   - Update FORMAT's concepts where they describe these, and regenerate REFERENCE.
   - Write LA-CHK records (requirements, domain rules, components and tests) from the next free numbers, with roles (Owner, Agent), never names.
   - Rerun the trial's three roots from `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/s2-trial-4/`, if they're still there, using the new features where the converter put a workaround, and report the before and after counts. Keep everything in scratch: S2 content is confidential and never enters the repo.

## Scope
- **You own:** `lathe/**` (meta, src, checks, tests, FORMAT concepts, REFERENCE), the plugin skills that list these fields, and the LA-CHK records above.
- **Working at the same time:**
  - Brief 68 (docs refresh) is editing `lathe/README.md`, FORMAT's prose and `plugin/**`. Merge main before reporting, and keep both sides.
  - Brief 53 is in `app/`.
- Never open `.env*` files.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and the trial's before and after counts by check.
