# Brief: the Model view, an ERD of the domain and of each aggregate

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Jared wants a "domain model" view like an ERD, as S2_sandbox's domain model draws:
- **The domain:** an ERD at aggregate level.
- **Each aggregate:** an ERD of its entities.

The read-only reference is `~/Development/S2_sandbox/docs/sdlc/01-define/02-domain-model/domain-model.std.md`, section 5 for the diagram conventions. Never open any `.env*` file, and copy no S2 text or names into Lathe.

He chose a third view, **Model**, beside Wiki and Graph.

## The contract (committed in 757e991)
- The `entity` kind sits under an aggregate, with `role: root` or `role: child`.
- `SpecRecord.entityFields` holds `{ field, meaning, kind, example }[]` and is filled by the engine (brief 43, working at the same time). For your fixtures, fill it in yourself.
- `has_one` (1 to 1), `has_many` (1 to many) and `refers_to` (many to 1) link entities.
- The FORMAT section on entities arrives with brief 43.

## Decisions already made (Jared, and the coordinator's recommendations)
- **Views are panes you open and close** (Jared decided; this replaces Split as a mode):
  - **Toggles:** Wiki, Graph and Model are on/off toggles, each an `aria-pressed` icon button in the View group of the page's pane bars. Each open view is one pane, side by side, always in the order Wiki, Graph, Model.
  - **At least one open:** turning off the last open view does nothing. The toggle says so in its tooltip.
  - **What goes away:** the Split toggle and mode, Open beside, and the Ctrl+3 split command. Each pane keeps a close button that turns its view off.
  - **Addresses:** a link names the open views, as in `?view=wiki`, `?view=wiki,graph` or `?view=graph,model`. Old links keep working: `?view=split` opens wiki and graph. The open set is remembered as the view is today.
  - **Model:** shows only on domain, aggregate and entity pages. Elsewhere it is not offered, and an address naming it drops it.
  - **Gaps and sizes:** every gap between two open panes is a `ResizeHandle` (R09). The sizes are remembered through `usePanelSize` as fractions, a minimum width per pane, and a reset that shares the space evenly on double-click.
  - **Keys:** Ctrl+1, Ctrl+2 and Ctrl+4 toggle Wiki, Graph and Model. Ctrl+3 becomes `maximizePane`: it shows only the focused pane, like VS Code's maximize editor group, and pressing it again or Escape restores. It replaces the current full-screen command, and each pane's full-screen button stays as its pointer version.
  - **The pane bar:** each pane's bar names its view at the left, with its close button when more than one pane is open. The View toggles and layout actions go on the rightmost pane's bar only, so they appear once. The inspector toggle stays there too.
  - **The title:** it sits at the top of the leftmost open pane.
  - **Records:** update R11 (pane title bar) and the records and tests that describe Split, Open beside, or Ctrl+3 as split: `LA-BRW-UC50-R02`, `T121`, `T298`, `T310`, `C51`, `C108` and the keymap tests. The existing split-ratio behavior (`UC111-R01` and `R02`) becomes per-gap sizes.
- **Domain page:** one ERD at aggregate level.
  - Each aggregate is a box with its title, its root entity's name and a count of entities.
  - Lines come from `refers_to` links between entities in different aggregates. There is one line per aggregate pair and direction, with crow's-foot ends (many to one).
  - An aggregate with no entity references falls back to its `relates_to` links, drawn dashed.
  - Aggregates in another domain that are referenced appear gray, labeled with their owner in parentheses, as S2 does.
- **Aggregate page:** its entities as ERD boxes.
  - Each box shows the entity's title, a root mark, and each field's name and kind of value.
  - Lines for `has_one`, `has_many` and `refers_to` have the right crow's-foot ends.
  - Entities it refers to in another aggregate or domain appear gray, labeled "(Aggregate)" or "(Domain · Aggregate)".
- **Entity page:** its aggregate's ERD with the entity highlighted.
- **Shared behavior:**
  - Clicking a box goes to it, as graph nodes do. Hover states (R08) apply.
  - A key under the diagram explains the colors and the line ends, with emoji squares for colors, as Jared likes keys.
  - Layout uses React Flow and elkjs (already dependencies) in a new folder, `app/src/model/`. Reuse the graph's motion (brief 39) once it lands, if it fits.
  - Colors come from tokens, with current-domain blue (`--steel-bg` and `--steel`) and another domain gray (R03). Grids state their columns (R10). Motion uses the shared tokens (R12, if it has landed).
- **Proactive standard:** add a Browsing domain rule saying the ERD draws exactly one line per relationship link (S2's rule that the relationships table and the diagram match), and prove it.

## Lathe's own spec (LA-BRW)
- Use case `LA-BRW-UC113` "Read a domain and its aggregates as an ERD" under `LA-BRW-CAP01` or `LA-BRW-CAP03` (the graph), whichever fits, with requirements.
- Domain rules from `LA-BRW-DR170`, components from `LA-BRW-C160` (in a new layer `LA-BRW-LAY09` "Model view", or `LAY07`), and tests from `LA-BRW-T360`.
- Add the use case to a flow's `carries_out`. Everything satisfied and proved, with no structure warnings.

## Scope
- **You own:** `app/src/model/**` (new), the view wiring in `app/src/views/**` and `app/src/shell/keymap.ts`, the styles for the Model view in `styles.css`, `app/test/**` for your tests, and the records above.
- **Working at the same time:**
  - Brief 39 (graph motion: `app/src/graph/**`, `styles.css`).
  - Brief 42 (list titles: `app/src/specs/**`).
  - Brief 43 (engine).
  - Brief 44 (entity records).
  - Before you report, merge `main` in, keep both sides, and rerun the full checks.
- Brief 41 (tabs) starts after you; it builds on your view list.
- Never use port 5199. Use `npx vite --port 5409` in `app/` and stop it.

## Report
Use the format in 00-common-rules, with your branch and its last commit.
