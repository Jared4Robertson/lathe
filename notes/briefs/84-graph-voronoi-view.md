# Brief: a Voronoi view of the graph (polygon cells inside hexagon domains)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, **after brief 83 (the Nested view) has merged**. Work in your own worktree, and finish with your branch ready to merge.

## Goal
A third way to see the graph, so it can be compared with Tree and Nested. Like Nested, parents are made of their children, but as a Voronoi treemap:
- the product is a hexagon, split into polygon cells, one per domain;
- each domain cell is split into Define and Design;
- and so on down, every cell sized by the number of leaf records under it.

The owner agreed to try it after Nested lands.

## Decisions (recommended; apply them)
1. **The switch:** Tree, Nested or Voronoi, saved with the tab's graph settings like the existing switch.
2. **Layout:** a weighted Voronoi treemap (power diagram), clipped to the parent's outline at every level. The product's outline is a hexagon.
   - Seed each cell deterministically, for example from the record ID and its tree order, so the same spec always gives the same picture.
   - Iterate until the cell areas are within about 5% of their weights.
   - Compute once per spec load, in a web worker if it blocks the main thread for more than about 50 ms.
   - Use a maintained library (for example `d3-voronoi-treemap` with `d3-weighted-voronoi`) rather than writing the algorithm. Report the libraries' size and license.
3. **Everything else is shared with Tree and Nested** (brief 83's parity list): the camera, focus, depth, level of detail, labels proportional to their cell (placed at the cell's largest inscribed point), Links, side bar, minimap, keyboard and accessibility.
4. **Stability:** adding one record may reshape its neighbors' cells. Record in your report how much the picture moves when one record is added, and keep it as small as the library allows, for example by seeding from the previous layout when it's cached.

## Scope
- **You own:** `app/src/graph/voronoi.ts`, its tests, and the view switch's new option.
- **Specs:** a requirement under the graph use case, rules and tests in Exploring.
- **Run:** the full checks, plus the stability, a11y and perf suites (the depth-3 budgets apply), once each with one worker. Save screenshots to `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/voronoi/`.
- Never use port 5199.

## Report
The branch and its last commit, the screenshots, the libraries added, layout time, how much the picture moves when one record is added, the checks you ran and their results, and anything left open.
