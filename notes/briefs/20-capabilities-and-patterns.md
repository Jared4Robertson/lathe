# Brief: capabilities and use case patterns (S2's use case organization)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-4`.

## Goal
Jared wants Lathe to organize use cases the way S2_sandbox does (read-only reference: `~/Development/S2_sandbox/docs/sdlc/01-define/03-use-cases/use-cases.std.md`, `docs/specs/08-accounting/01-define/02-use-cases/README.md`, `docs/specs/00-shared/patterns/`; never open any `.env*` file):

- **Capabilities:** a domain's use cases are grouped into ordered capabilities (S2: `NN-<capability>` folders, such as "03 Batch preparation"), and a domain's flows and acceptance tests follow the same capabilities, so a capability is a slice through Define and Design.
- **Patterns:** behavior several use cases share is stated once, with **settings**; a use case **follows** a pattern and gives each setting a value, or `Not applicable:` with a reason, instead of restating its rules.
- **The domain's use case index:** Capability, Use case, Pattern, in capability order.

## What to build
1. **Meta-model (`lathe/meta/*.csv`, which you own for this brief):**
   - `capability` kind: stage `define`, parent `domain`, required field `order` (a whole number giving its place in the domain), not an obligation.
   - Widen `use_case` to `parent_kinds: domain capability`; widen `flow` and `test` to `domain capability`.
   - `pattern` kind: stage `define`, parent `product` (shared across domains), required field `settings` (a space-separated list of setting names, lower case with underscores), not an obligation.
   - Relation `follows`: `use_case` to `pattern`, role empty.
2. **Checks (new numbered files from 28):**
   - `capability-order`: error when a capability's `order` is not a whole number, or two capabilities in a domain share one.
   - `use-case-outside-capability`: warning when a domain has capabilities but one of its use cases sits directly under the domain.
   - `pattern-setting-missing`: error when a use case follows a pattern but lacks a field for one of its settings. Settings are plain header fields named exactly as the pattern lists them; a value starting `Not applicable:` (any letter case) followed by a reason counts as given.
   - `pattern-setting-clash`: warning when a use case follows two patterns that share a setting name.
   - `bad-pattern-settings`: error when a pattern's `settings` names are not valid field names.
3. **Engine:** nothing structural should be needed beyond the meta-model and checks; if coverage or loading needs a change (for example ordering by capability), make it and say why.
4. **`lathe/FORMAT.md`:** a section on capabilities and patterns, with the ID convention (`<P>-<D>-CAP<nn>`, pattern `<P>-PAT-<name>`, such as `TL-PAT-RECORD-VIEW`) and examples.
5. **Tests** for every check, with fixtures, in a new `lathe/test/capabilities.test.ts`.
6. **Tool Library:** organize `TL-LEND` into capabilities (for example 01 Membership: register a member; 02 Catalog: add a tool, report damage; 03 Lending: borrow, return), moving use cases, flows and tests under them (parent changes only; keep IDs). Add one pattern the example genuinely shares (for example a "Librarian action" pattern with settings such as `permission` and `audit`), followed by the use cases it fits, each filling in the settings. Keep full coverage and 0 errors.
7. **Plugin:** add capabilities and patterns to the `write-use-cases` skill, and the new checks to `check-and-fix`.
8. **Lathe's own spec:** records for this in `specs/lathe/checking/` using only use case `LA-CHK-UC10` with requirements, domain rules `LA-CHK-DR40`–`DR49`, components `LA-CHK-C40`–`C49`, tests `LA-CHK-T70`–`T89`. All new obligations satisfied and proved. Do not reorganize Lathe's own use cases into capabilities: that happens after the app work merges.

## Out of scope (record as an open question under `LA-CHK`, owner Jared)
Proof of a pattern's own rules by each domain that follows it (S2's "Patterns we follow" tables); and S2's house rule that each aggregate has exactly one Record view use case (that belongs in a product's own checks, a later feature).

## Scope
You own: `lathe/meta/*`, `lathe/checks/` new files from 28, `lathe/FORMAT.md`, `lathe/test/capabilities.test.ts` and its fixtures under `lathe/test/fixtures/cap-*`, `specs/tool-library/**`, `examples/tool-library/**` (only if code must change), `plugin/**`, and the spec records above. Another agent is changing `app/**` in parallel; do not touch it.

## Checks
`npm --prefix lathe run typecheck`, `npm --prefix lathe test`, `npm --prefix examples/tool-library test`, `npm --prefix lathe run check` (0 errors).
