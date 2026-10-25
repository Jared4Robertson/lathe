# Brief: layers and test groups in the app

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `component-layers`.

## Goal
Jared finds both a domain's Technical specification and its Test plan too flat. Browsing has 57 components and 156 tests, each one long list. The app should give both a structure like S2_sandbox's. The read-only reference is `~/Development/S2_sandbox/docs/sdlc/02-design/` (technical specification and test planning standards). Never open any `.env*` file, and copy no S2 text or names into Lathe.

## The contract (committed; do not change it)
- In `lathe/meta/kinds.csv`, `layer` is a design-stage kind in the `technical-specification` folder. Its parent is a domain and it requires `order` (a whole number). Layer IDs look like `TL-LEND-LAY01`.
- `component` may sit under `domain` or `layer`.

## Decisions already made (Jared)
- **Components are grouped by layer records.** Technical specification lists the domain's layers in `order`, each holding its components. Components sitting directly in the domain come last, under "Components outside any layer", just as use cases outside any capability are handled now. A domain with no layers lists its components as today.
- **Tests are grouped by what they prove, computed and not stored.** In the Test plan folder, each test goes in the first group that applies:
  1. **Acceptance tests:** it proves a use-case requirement. Grouped by capability in order (use cases outside any capability last), then by use case (the first one it proves, in ID order).
  2. **Domain rule tests:** it proves a domain rule.
  3. **Pattern tests:** it proves a pattern rule. Grouped by pattern.
  4. **Interaction tests:** it proves an interaction requirement.
  5. **Engineering checks:** everything else.
  Empty groups are hidden. Labels are in plain English. Use `plural()` for any kind label.

## What to build
1. **Folder model** (`app/src/specs/folders.ts`): layers under Technical specification, and test groups under Test plan, so the nav, the domain page and the group pages all read one model.
2. **Side nav:** both show as foldable rows with counts, one level by default, and the current page's branch opens itself. Layers are records, so a layer row links to the layer's page. Test groups are not records, so their rows only fold.
3. **Domain page:** the same structure as headings, and the same one-level-deep folding as today.
4. **Layer record page:** like a capability's, its children are its components.
5. **Graph:** a domain with layers reaches its components through Layers (n) → layer → its components (or their group). Depth 1 stays "parent and children only". Check that the column layout still reads left to right.
6. **Tests:** vitest and testing-library, with fixtures that have layers and tests proving each kind. Follow the app code standards (`specs/lathe/patterns/PAT-app-code*`), and `app/test/standards.test.tsx` must pass.
7. **Lathe's own spec (LA-BRW):**
   - Use case `LA-BRW-UC110` "Read the technical specification and test plan in their groups" under capability `LA-BRW-CAP01`, with requirements.
   - Domain rules `LA-BRW-DR140`–`DR149`, components `LA-BRW-C140`–`C149` and tests `LA-BRW-T280`–`T299`.
   - Every new requirement and rule must be satisfied and proved.
   - Add the use case to a flow's `carries_out`.
   - Parent your new components on `LA-BRW`. Brief 38 moves components into layers.

## Scope
- **You own:** `app/**` and only the new LA-BRW records listed above.
- **Not yours:** brief 36 owns `lathe/**`. Brief 38 owns every existing component record and the layer records.
- **Workspace data:** the engine on your branch has no layer checks yet, but it already loads layers, because the kind is in kinds.csv. Build your fixtures in the app's own test fixtures.
- Never use port 5199. To look at the app, run `npx vite --port 5404` in `app/` and stop it afterwards.

## Checks
- `cd app && npx tsc --noEmit`
- `npm --prefix app test` (at most 2 workers)
- `npm --prefix lathe run check`, which must show 0 errors

## Report
Use the format in 00-common-rules.
