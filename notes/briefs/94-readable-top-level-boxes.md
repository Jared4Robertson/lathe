# Brief: readable top-level boxes in Nested

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
In the Nested view (brief 93, merged), each box's text scale comes from its height level (`app/src/graph/nested.ts`, `scales[height]`).
- A small top-level box such as Shared (a folder of 3 records) has a low height, so it gets small text and a tiny square: 7 px beside domains of 130–190 px on LA.
- The owner asked for "a readable minimum size" for small top-level boxes like Shared.

## Decisions
1. **Top-level boxes share the domains' text.** Every child of the product (its domains and Shared) takes the largest text scale among them, so Shared's header reads at the same size as a domain's.
2. **Size follows from it.** Shared's square grows to hold its header at that scale, its children packed below at their own scales, with any space left blank. This gives the minimum size; add no separate minimum-side constant.
3. **Only the product's direct children change.** Deeper boxes keep their height-level scale, and the Tree and Voronoi views are untouched.
4. **Specs (Exploring):**
   - DR62 states the rule in one sentence: the product's children share one text scale, the largest among them.
   - Add a test record under the next free T ID in Exploring.

## Checks
- The full checks, plus the stability, a11y and perf suites, each run once with one worker, gated on real exit codes.
- Add a unit test: a small top-level folder beside a deep domain gets the domain's scale and a square that holds its header.
- Save screenshots of LA in Nested to `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/shared/`, and look at them: Shared's title must read at the same size as the domains' titles.
- Never use port 5199. `.claude/launch.json` points at 5199, so start your own server on another port and stop it by its PID.

## Report
The branch and its last commit, Shared's on-screen size and title size against a domain's, the map size for LA, the screenshots, and the checks run with their results.
