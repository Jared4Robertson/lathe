# Brief: component layers in the engine

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `component-layers`.

## Goal
Jared finds a domain's components too flat. S2_sandbox groups each domain's technical specification by layer: Models, Accessors, Services, Connectors, Routers and API app, Web app, Infrastructure and configuration, with a large layer split further. The read-only reference is `~/Development/S2_sandbox/docs/sdlc/02-design/02-technical-specification/technical-specifications.std.md`. Never open any `.env*` file, and copy no S2 text or names into Lathe. Lathe gets a `layer` record kind that works like `capability` does for use cases. This brief covers the engine and the docs.

## The contract (committed; do not change it)
- In `lathe/meta/kinds.csv`, `layer` is a design-stage kind in the `technical-specification` folder. Its parent is a domain and it requires `order`.
- `component` may now sit under `domain` or `layer`.

## Decisions already made (Jared)
- **Layers are records, not a field.** Each product names its own layers, and the docs suggest S2's set as a starting point.
- **Tests are grouped by what they prove, not by new records.** This grouping is computed by the app (brief 37). Here, only document it in FORMAT (see step 4).

## What to build
1. **Layer IDs:** the layer ID is `<domain>-LAY<nn>`, for example `TL-LEND-LAY01`. Add it to the ID table in FORMAT section 3.
2. **Checks:** add these as new files numbered from 62, generalizing the capability checks where that is cleaner.
   - `layer-order` (error): a bad or repeated `order` within a domain. Mirror `28-capability-order.sql`.
   - `component-outside-layer` (warning): a component that sits directly in a domain that has layers. Mirror `29-use-case-outside-capability.sql`.
3. **Domain membership:** a component under a layer belongs to the layer's domain everywhere a domain matters, including coverage (designed and built), pattern rules owed per domain, `proof-counts-nowhere` and flow-step checks. Find each place that walks a record up to its domain, and add tests showing a component in a layer counts exactly as one directly in the domain.
4. **FORMAT.md:**
   - A new section "Layers", after section 15. It says what a layer is, gives its ID, notes that components sit in a layer (or in the domain when the domain has none), lists the two checks, and suggests S2's layer set as a starting point.
   - In section 15 "Folders", add how the Test plan folder is grouped. Each test goes in the first group that applies:
     1. **Acceptance tests:** it proves a use-case requirement. Grouped by capability in order (use cases outside any capability last), then by use case (the first one it proves, in ID order).
     2. **Domain rule tests:** it proves a domain rule.
     3. **Pattern tests:** it proves a pattern rule. Grouped by pattern.
     4. **Interaction tests:** it proves an interaction requirement.
     5. **Engineering checks:** everything else.
   - Empty groups are not shown.
   - Update `lathe/README.md` if it lists kinds.
5. **Sample workspace:** add the `layer` kind, and one layer holding one component, to `lathe/fixtures/workspace.sample.json`.
6. **Plugin:** in `plugin/skills/` (the skill that describes writing records, and `extend-the-meta-model`), say that components go in layers.
7. **Lathe's own spec (LA-CHK):**
   - Use case `LA-CHK-UC22` "Group components into layers" under capability `LA-CHK-CAP03`, with requirements.
   - Domain rules `LA-CHK-DR160`–`DR169`, components `LA-CHK-C160`–`C169` and tests `LA-CHK-T270`–`T289`.
   - Every new requirement and rule must be satisfied and proved, and each new rule applied.
   - Add the use case to `LA-CHK-F03`'s `carries_out`.
   - Parent your new components on `LA-CHK` itself. Brief 38 moves components into layers, and the integration step places yours.

## Scope
- **You own:** `lathe/**` (but not `lathe/meta/kinds.csv` and `lathe/src/types.ts` unless you must, in which case say so), `lathe/FORMAT.md`, `lathe/README.md`, the plugin skills named above, and only the new LA-CHK records listed above.
- **Not yours:** brief 37 owns `app/**`. Brief 38 owns every component record file and the layer records. Leave them alone.

## Checks
- `npm --prefix lathe run typecheck`
- `npm --prefix lathe test` (at most 2 workers)
- `npm --prefix lathe run check`, which must show 0 errors. A `component-outside-layer` warning is expected only if brief 38's layers are present, and they won't be on your branch.

## Report
Use the format in 00-common-rules.
