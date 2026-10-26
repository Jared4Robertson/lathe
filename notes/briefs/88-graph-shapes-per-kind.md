# Brief: a shape for each kind in the graph

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, **after brief 87 (one text size per level) has merged**. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Domains are hexagons in the Tree layout. The coordinator proposed a shape vocabulary for every kind, and the owner left the decision to the coordinator overnight. Shapes are a secondary cue, with text first, and they keep a rectangular footprint so boxes stack.

## Decisions
1. **Shapes:**

   | Group | Kind | Shape |
   |---|---|---|
   | Structure | product | large rounded box |
   | | domain | hexagon (already done) |
   | | stage and folder groups | folder tab |
   | | capability | pointed slice (pentagon pointing right) |
   | Define | aggregate | double border |
   | | entity | plain box |
   | | domain rule, pattern rule | octagon |
   | | domain event | flag (notched right) |
   | | use case | ellipse or stadium |
   | | requirement | page with a folded corner (interaction requirement too, with a small marker) |
   | | pattern | stacked boxes |
   | | setting | parallelogram |
   | Design | flow | chevron bar |
   | | flow step, design step | chevron segment |
   | | view | window chrome (a top bar) |
   | | endpoint | port notch on the left |
   | | api, integration | plain box with a port mark |
   | | layer | horizontal stripes |
   | | component | UML component tabs |
   | | test | shield |
   | | design flow | as flow, with a gear mark |
   | Other | open question | diamond |
   | | fitness | circle |
   | | standard, standard rule | as pattern and pattern rule, with a ruler mark |

2. **One shape per kind everywhere.** The Model view's domain events become flags, not pills, to match.
3. **Layouts:**
   - **Tree:** every kind's outline is its shape. Shapes are drawn with `clip-path` and an inner fill clipped the same way, as the hexagon is, so borders, hover, focus and selection follow the outline, as brief 79 did.
   - **Nested and Voronoi:** keep rectangle and cell outlines, and show each kind's shape as a small mark in its header or label, as the domain's hexagon mark is.
   - A shape's corners and notches scale with the box (`--box-scale`).
4. **Labels:** text stays inside the shape's safe area, and R12 and the clipping tests must still pass.
5. **Key:** every shape appears in the graph's key, as LA-PAT-APP-CODE-R21 requires.
6. **Unknown kinds:** kinds a product adds get a plain box.

## Scope
`app/src/graph/**`, the graph CSS, the Model view's event shape, tests, and specs in Exploring (a rule for shapes and tests). If briefs 90 and 91 have added kinds by the time you merge main, give them their shapes.

## Checks
The full checks, plus the stability, a11y and perf suites, once each with one worker. Gate on real exit codes. Save screenshots of a domain in each layout, and a close-up of every shape, to `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/shapes/`. Never use port 5199.

## Report
The branch and its last commit, the screenshots, the checks you ran and their results, and anything left open.
