# Brief: a list of one kind is titled by that kind

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and merge into `main` yourself once the full checks pass.

## Goal
On an aggregate's page, the section listing its domain rules is titled "Children" (`app/src/specs/RecordContent.tsx`, around line 156). Jared asks why it doesn't say "Domain rules". It should name what it holds.

## Decisions already made (Jared, and the coordinator's recommendations)
- **The one-kind rule extends to titles** (`LA-BRW-DR144`: a split appears only when there is more than one kind to tell apart).
  - When every child of a record is one kind, the list is titled with that kind's plural label, through `plural()` and `kindLabel`: "Domain rules", "UC requirements", "Use cases", "Components", "Flow steps".
  - When the children are of several kinds, it stays "Children", with each row tagged by its kind as now.
- **Apply it everywhere** a record's or group's children are listed under one title:
  - the record page's Children section;
  - the inspector's Children section;
  - a group page's Members list, in the wiki pane and in the inspector;
  - any other generic "Children" or "Members" title you find.
  
  The count stays beside the title. Accessible names change with the title, for example "Domain rules of LA-BRW-A1" rather than "Children of LA-BRW-A1", and the list's search box label follows ("Filter domain rules").
- **Records:** reword `LA-BRW-DR144` (or add a domain rule from `LA-BRW-DR160`) so the rule covers list titles. Prove each place in a test from `LA-BRW-T340`. Update the existing tests and records that expect "Children" where the list now holds one kind, under their existing IDs.

## Scope
- **You own:** `app/src/specs/**` (RecordContent, parts, the inspector if it lives there) and `app/src/views/Inspector*`, if that's where the inspector is. Stay out of `app/src/views/FocusPage.tsx`, `app/src/graph/**` and the pane bar styles.
- **Working at the same time:**
  - Brief 39 is changing the graph's motion (`app/src/graph/**`, `styles.css`, `standards.test.tsx`).
  - Brief 40 is changing the pane title bar (`FocusPage.tsx`, the title-bar styles and several view tests).
  - Before you merge, merge `main` into your branch, keep both sides, and rerun the full checks.
- Never use port 5199. To look at the app, use `npx vite --port 5408` in `app/` and stop it.

## Checks
- The full checks in 00-common-rules, then merge into `main`.

## Report
Use the format in 00-common-rules, with the merge commit and the list of every place you changed.
