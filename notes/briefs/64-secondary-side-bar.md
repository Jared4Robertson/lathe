# Brief: the inspector becomes a secondary side bar (Details, Outline, History)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after brief 53 phase 2 (jitter, the page frame) and brief 57b (Traceability) have merged. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Jared: the inspector "seems just like duplicate information" for most views. The wiki now shows children, problems and the title and ID, and Traceability arrives with 57b, so the inspector repeats it. He decided to make it a secondary side bar, like VS Code's, with three views. Each must earn its place.

## Decisions already made (Jared)
1. **One right panel with a small view switcher at its top:** Details, Outline and History, as `aria-pressed` icon buttons with tooltips. The panel keeps its width handle (R09 or UX-R02), its toggle in the page bar, and its remembered state, now per view mode.
2. **Default visibility:** closed in the Wiki view, open in the Graph and Model views. Remember the choice per mode (wiki, graph, model) and per tab (brief 41). On phones it stays a bottom sheet (brief 52) with the same three views.
3. **Details follows the selection, with no duplication:**
   - **Graph and Model views:** it shows the hovered or keyboard-focused node, and failing that the selected one, and failing that the page's record. The facts: kind, title, ID, header fields, spec file, parent, and a compact Traceability summary (brief 57b) using the relation labels. Add Open, plus Reveal in Finder and Open in editor in the desktop app (brief 62).
   - **Wiki view:** it shows a selected row, if a record row has focus or was right-clicked. Otherwise it shows only what the page doesn't: the spec file path, the raw header fields, and the raw links.
   - Remove the sections that only repeated the wiki: children, problems and the generic links lists.
   - The graph's "Connected in the graph" moves into Details for the graph only.
4. **Outline:**
   - **Wiki:** the page's sections and headings (Traceability groups, children, problems, Markdown headings), with click to scroll and the current section marked as you scroll.
   - **Graph:** the records in focus, grouped by level.
   - **Model:** the boxes.
   - Both lists are clickable rows (UX-R05) with search past 10 (the 10-row rule).
5. **History,** from the git history of the record's spec file:
   - A list of commits that touched the file: date, author, subject and short hash, newest first, with "load more".
   - Selecting a commit shows that commit's diff of the file inline, as a unified diff with added and removed lines in tokens.
   - "Not committed" changes in the working tree show first, labeled as such.
   - **Server:** `GET /api/history?id=<record ID>` (and `&commit=<hash>` for one diff) in `lathe/src/server/api.ts`. It resolves the record's file from the workspace, never from a raw path, and runs `git log --follow` and `git show` with argument arrays, never a shell string, inside the product root, with a time limit and output cap.
   - When the product folder isn't a git repo, it says so calmly.
   - The Vite plugin and `lathe serve` both serve it, and so does the desktop app.
6. **Accessibility and stability:** the switcher is a labeled group, each view has a heading, and focus moves sensibly when you switch. Switching views or selection must not jump the layout (UX-R08 "Nothing jumps", using brief 53's suite).

## Records
- **Browsing:**
  - Use case `LA-BRW-UC119` "Use the side bar for details, outline and history" under `CAP02`, with requirements.
  - Update the inspector records: UC50-R11 (the inspector) and its domain rules and tests (T126, T131, T132 and others).
  - Domain rules, components and tests from the next free numbers.
- **The history API:** a component in `LA-BRW-LAY01` (Server and API), proved by an engine-side test against a temporary git repo.

## Scope
- **You own:** the side bar (`app/src/views/Inspector*` and its successor files), the history API in `lathe/src/server/api.ts`, styles, tests, and the records above.
- Check which agents are running when you start, and stay out of their files.
- Never use port 5199. Use `npx vite --port 5420` and stop it. Run the stability suite.

## Report
Use the format in 00-common-rules, with your branch and its last commit.
