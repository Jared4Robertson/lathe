# Brief: put Lathe's and the Tool Library's components into layers

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `component-layers`.

## Goal
Jared finds each domain's components too flat. Browsing has 57, Checking 77, Modeling 6, and the Tool Library's lending domain has its own. Group them into layer records, like S2_sandbox's technical specification layers. The read-only reference is `~/Development/S2_sandbox/docs/specs/*/02-design/02-technical-specification/01-components/`. Never open any `.env*` file, and copy no S2 text or names into Lathe. This brief is data only: you write records, not code.

## The contract (committed)
- In `lathe/meta/kinds.csv`, `layer` is a design-stage kind in the `technical-specification` folder. Its parent is a domain and it requires `order`.
- `component` may sit under `domain` or `layer`.
- The layer ID is `<domain>-LAY<nn>`, for example `LA-BRW-LAY01`.

## What to do
1. **Choose each domain's layers** from what its components actually are: their `file` and `component_type`. Use S2's set as a guide, where it fits.
   - **Tool Library** (a small app with models, services, routers and a web app): close to S2's set.
   - **Lathe Browsing** (suggested): 1 Server and API, 2 App shell, 3 Spec pages, 4 Graph, 5 Shared components.
   - **Lathe Checking** (suggested): 1 Meta-model and types, 2 Loading and parsing, 3 Checks, 4 Coverage, 5 Command line and server.
   - **Lathe Modeling** (6 components): two or three layers, as the components fall.
   - **Size:** aim for at most about 15 components per layer. A layer bigger than that is split, the way S2 splits by aggregate or capability. For example, Checks can split into structure checks, coverage checks and pattern checks, each its own layer with a clear title.
2. **Layer records:**
   - Each layer record lives at `<domain>/02-design/components/<NN>-<slug>.md`, with `kind: layer`, `parent: <domain>`, `order: <n>` and a title.
   - Its body is two or three sentences on what the layer holds and where its code lives (folders), and may include a short file tree in a code block.
3. **Move each component:**
   - Move its file into `<domain>/02-design/components/<NN>-<slug>/` with `git mv`, so history is kept.
   - Set its `parent` to the layer.
   - Change nothing else in the record.
4. **No component is left directly in a domain that has layers.**
5. **Check before you finish:**
   - Run `npm --prefix lathe run check`. It must show 0 errors, and the same warnings as before apart from any new `component-outside-layer` ones, of which there should be none.
   - Look for references to old component file paths (`grep -rn "02-design/components/" README.md lathe app plugin notes specs`) and report any you find. Fix them only in spec records you moved.

## Scope
- **You own:** every component record under `specs/lathe/*/02-design/components/` and `specs/tool-library/*/02-design/components/`, and the new layer records.
- **Not yours:** brief 36 (`lathe/**`) and brief 37 (`app/**`) are building the engine checks and the app views at the same time, and they add new components parented on the domain. The integration step moves those into layers.
- Change no records other than the components and the layers.

## Report
Use the format in 00-common-rules. Also include a table of each domain's layers (ID, title, order, component count).
