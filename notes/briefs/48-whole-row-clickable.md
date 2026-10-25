# Brief: the whole list row is clickable

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
In Lathe's list components, only the record link inside a row (its ID and title) is clickable. Jared wants the whole row clickable: anywhere on the row opens that record, as a domain card already does.

The lists are:
- the rows of `LongList` and `TreeList` (`app/src/components/`), as used by the record, domain, product and group pages, the inspector and the checks page;
- `RecordTree` and `RecordLink` (`app/src/specs/parts.tsx`);
- the nav's record rows;
- quick find's results.

## Decisions already made (Jared, and the coordinator's recommendations)
1. **One stretched link per row.** The row's main record link gets a class (for example `row-link`) whose `::after` covers the row (`position: absolute; inset: 0`, with the row `position: relative`). This is the same pattern as `.domain-card .card-title::after`. Clicking anywhere on the row follows that link: plain-click navigation within the app as now, and Cmd/Ctrl-click or middle-click opening a new browser tab, because it's a real link.
2. **Other controls stay on top and keep working.** The fold chevron (`.tree-toggle`), other record links in the row (such as "followed by UC01", a component's file, mentions), badges with tooltips, and buttons get `position: relative; z-index: 1`, so clicks on them do what they did. Write that once, as a class or a rule for interactive elements inside a stretched row, not per control.
3. **Text selection.** Accept that a row's plain text can't be drag-selected (the stretched link covers it), except inside the other controls. The inspector's facts list (Kind, Spec File, and so on) is not a navigation list and stays as is.
4. **Hover and focus:**
   - The whole row takes the hover state (R08): the row tint `--hover-bg`, and the title turns steel.
   - Keyboard focus stays on the one link, and its focus ring draws around the whole row (`:focus-visible` on the link styles the row, through the `::after` outline).
   - Tree rows keep their arrow-key behavior.
5. **Nav and quick find.** Nav rows are already whole-row links; check them and leave them as they are if they are. Quick find's result rows are options, so they are already whole-row: check them.
6. **Proactive standard.** Add `LA-PAT-APP-CODE-R13`, "A row or card that leads to one record is one link": the whole row is clickable through one stretched link, and other controls in it sit above it. Brief 41 (tabs, not started) will take R14 instead of R13; update its text in `notes/briefs/41-record-tabs.md` to say R14.
   - Prove R13 in `app/test/standards.test.tsx`: render a domain page and a record page, and expect every row of every `record-list` that holds a record link to have exactly one `row-link`.
   - Also prove that a click on a row's padding navigates, and a click on its chevron or second link does what that control does.

## Records
- The rule R13 in `specs/lathe/patterns/PAT-app-code/`, added to the pattern's list.
- A Browsing requirement under the use case that covers record lists (`UC30` "lists stay short", or `UC03` "Follow a record's links"; pick the one that fits).
- Domain rules from `LA-BRW-DR190`, components in the right layer from `LA-BRW-C180`, and tests from `LA-BRW-T400`.

## Scope
- **You own:** `app/src/components/**`, `app/src/specs/parts.tsx` and the list parts of `app/src/specs/**`, the row styles in `app/src/styles.css`, `app/test/**` for these tests, `notes/briefs/41-record-tabs.md` (the rule number only), and the records above.
- **Working at the same time:**
  - Brief 45 (the Model view and panes) is in `app/src/views/**`, `app/src/model/**`, `app/src/shell/keymap.ts` and parts of `styles.css`.
  - Brief 47 (the desktop shell) is in `desktop/**`.
  - Before you report, merge `main` in, keep both sides, and rerun the full checks.
- Never use port 5199. Use `npx vite --port 5411` in `app/` and stop it.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and every list you changed.
