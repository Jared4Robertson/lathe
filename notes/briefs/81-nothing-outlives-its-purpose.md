# Brief: nothing outlives its purpose (checkable leftovers)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Leftovers keep surviving changes: a chevron with no job, styles for removed features, stale records. They survive because removing a behavior deletes only what someone remembers, and nothing fails on an orphan. The owner wants this checkable. Make orphans fail at every level, then remove every leftover the new checks find.

## What to do
1. **Engine checks** (warnings, standard headers, fixtures, tests):
   - `component-satisfies-nothing`: a component that satisfies no obligation.
   - `test-proves-nothing`: a test that proves, and supports, nothing.

   Check how `proof-counts-nowhere` and `interaction-requirement-fulfills-nothing` work, and match them. If a product has legitimate exceptions (shared infrastructure components), the fix is a link, not a waiver: say in the message what to link.
2. **No dead code in the app and engine**, as part of the normal test run:
   - **`knip`** (dev dependency, configured for `app/`, `lathe/` and `desktop/`): no unused files, exports or dependencies. Add it to the full checks.
   - **Unused CSS:** a test that every class selector in the app's stylesheets is used in `app/src`, either literally or through a known class-building helper. When it fails, it names the selector and its line.
   - **Commands and icons:** a test that every command in the keymap can be reached from a menu, button, shortcut or quick find, and that every icon in `icons.tsx` is used.
3. **Every mark has a meaning.** A test that every mark the Graph or Model view can draw (shapes, badges, line styles, fills) is listed in that view's key, with what it means. A mark that can't be explained can't ship. Add any missing key entries.
4. **Remove every leftover these checks find.** Delete the code, CSS, icons, commands, tests and records, as a hard cutover. List each removal and what used to need it.
5. **The rule:**
   - Add `LA-PAT-APP-CODE-R21` "Nothing outlives its purpose", proved by the tests above.
   - Add a Checking domain rule and tests for the two engine checks.
   - Add a sentence to FORMAT.md, and regenerate the reference.
   - Mention both checks in the plugin's modeling skill.

## Scope
- **Running at the same time:** brief 80 (graph text scale, removing the chevron) owns `app/src/graph/**`. Leave the chevron to it; if your CSS or mark tests flag it, note that brief 80 removes it. Merge main before reporting and keep both sides. Your edits to graph files should only add key entries.
- **IDs:** each of your records continues from the highest number in its kind in its slice.

## Checks
Run the full checks from the common rules, with knip added. The stability and a11y suites need to run once each with one worker, because removals touch the UI. Never use port 5199.

## Report
- the branch and its last commit;
- what the new checks found;
- everything removed, and what used to need it;
- the checks you ran and their results;
- anything left open.
