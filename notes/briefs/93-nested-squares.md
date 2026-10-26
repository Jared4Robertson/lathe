# Brief: every Nested box a square

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
The owner asked: "can we also make every node a square for the nest view? and just have blank space if needed?" Brief 92 built this on branch `worktree-agent-ad713c924f2f49163` (commit `1480d9a`), together with a text-by-depth rule that failed its readability bars and isn't being merged. Bring over **only the squares**, on top of main's current text rule.

## Decisions
1. **Keep main's text rule unchanged:** the Nested map's height-level scale (`settleLevelScale`), the Tree's and Voronoi's rules, and the Tree camera. Don't take `depthScale`, the Voronoi changes, the camera floor (`ce002ad`) or the Voronoi fit change (`915a1ec`).
2. **Take from 92 for Nested:**
   - leaves as the smallest square holding their label (`leafSide`);
   - children shelf-packed in rows in the tree's order, with the row width picked to make the parent's square smallest (`shelfPack`, `ROW_TRIES`, `SIDE_ROUNDS`);
   - a parent as the smallest square holding its header band and the packed block, with any leftover space left blank.
   
   Size follows content, not record counts. Use `git show 1480d9a -- app/src/graph/nested.ts app/test/graph/nested.test.ts` as the reference, with each box's scale taken from its height level as main does now.
3. **Hard cutover:** remove `squarify`, `shareRoom`, `LEAF_AREA`, `NESTED_ASPECT`, `PACK_SLACK`, `FIT_PASSES`, `FIT_GROWTH` and their tests and spec wording.
4. **Specs (Exploring):**
   - DR62 says Nested boxes are squares packed in rows with blank space.
   - Replace T186 "squarified in the tree's order" with "children are packed in rows in the tree's order", as 92 did.
   - Leave DR58, DR60 and DR64 as on main.

## Checks
- The full checks, plus the stability, a11y and perf suites, each run once with one worker, gated on real exit codes.
- Save screenshots of LA and LA-EXP in Nested to `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/squares/`, and look at them: every box square, every label whole (R12), no box unlabeled.
- Never use port 5199.

## Report
The branch and its last commit, the map size for LA, the screenshots, the checks run and their results, and what was removed.
