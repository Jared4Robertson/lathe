# Brief: a real mobile experience

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Jared: "mobile needs some attention in general. We need a mobile optimized design for when we are mobile… intelligently make decisions for that and really enhance the mobile experience."

Today the app shrinks the desktop: at 800px and below (`useNarrow`) the nav and the inspector become drawers, and the panes stack. It works, but it isn't designed for a phone. You own the design decisions here. Make them well, and write them down.

## Principles (the coordinator's direction; decide the details yourself)
1. **On a phone, Lathe is for reading and moving around:** following a record's links, checking a domain's coverage, looking at a graph or an ERD, finding a record. It is not for arranging panels. Design for that, not for the desktop squeezed down.
2. **One view at a time.**
   - Wiki, Graph and Model become a segmented switch: in a bottom bar within thumb reach, or in the top bar. Choose and justify.
   - There are no side-by-side panes on a phone. The open-view set from the address still decides which view shows first.
   - Resize handles are not shown.
3. **A compact top bar:** the record's title (one line, ellipsis), a short breadcrumb or a back control, and the menu.
4. **Sheets, not panels:**
   - the nav is a full-screen sheet;
   - the inspector is a bottom sheet with a grab handle, at half and full height, dismissed by swiping down or by Escape;
   - quick find and the command palette are full-screen.
   
   Every sheet traps focus and returns it, as the drawers do now.
5. **Touch first:**
   - The graph and the ERD pan and pinch-zoom. A tap on a node selects it and shows its name and a small "Open" chip; a second tap or the chip opens it.
   - Long-press may preview. Decide.
   - Clickable rows (R13) keep working, and the fold chevrons get large targets.
   - Pointer targets are at least 44×44 px on touch devices (`@media (pointer: coarse)`), and no information or action depends on hover.
6. **Readable:**
   - body text at a comfortable size;
   - long IDs wrap or truncate sensibly;
   - wide tables scroll sideways inside their own box;
   - code blocks scroll;
   - lists stay short (the 10-row rule) with search.
7. **Device details:**
   - respect safe areas (`env(safe-area-inset-*)`);
   - use `100dvh`, not `100vh`;
   - no horizontal page scroll anywhere;
   - add a `theme-color` meta that follows the theme;
   - avoid iOS zooming on input focus (16px inputs);
   - honor reduced motion (R12);
   - make the sheet animations feel native without breaking R12.
8. **Tablets** (about 800–1100 px, touch): decide whether they get the desktop workbench with touch targets, or the phone layout. Justify it.

## Decisions record
- Write `notes/mobile-design.md`: each decision, the options you weighed, what you chose and why, plus screenshots or ASCII layouts of the main screens:
  - a record page;
  - a domain page;
  - the graph;
  - the ERD;
  - the nav sheet;
  - the inspector sheet;
  - quick find.
- Put the requirements Jared will want to review in the records (below).

## Proactive standard
Add `LA-PAT-APP-CODE-R16`, "Everything works by touch":
- on coarse pointers, every control's target is at least 44×44 px;
- no action or information is reachable only by hover;
- no page scrolls sideways at 320 px wide.

Prove it in `app/test/standards.test.tsx` with stylesheet checks for the coarse-pointer target rule, and a test that renders the main pages at a 320 px viewport and finds no element wider than the viewport outside a scroll box (as far as jsdom can tell; say what it can't).

## Records
- Use case `LA-BRW-UC116` "Read and move around Lathe on a phone" under `LA-BRW-CAP02`, with requirements.
- Domain rules from `LA-BRW-DR220`, components from `LA-BRW-C210` (a new layer `Mobile`, or the fitting ones) and tests from `LA-BRW-T460`.
- Update the records about the narrow-screen drawers.
- R16 goes in the App code pattern.

## Verify in a browser
- Run `npx vite --port 5414` in `app/` and stop it afterwards.
- Check the main screens at 375×812 and 320×640, in touch emulation, if a browser tool is available to you; otherwise reason from the CSS and the layout and say so.
- The coordinator will also review it on the mobile preset before merging.

## Scope
- **You own:** the mobile layout across `app/src/**`: `App.tsx`, `views/**`, `shell/**`, `specs/**` presentation, `graph/**` and `model/**` touch handling, and `styles.css`. Also `app/index.html` (meta), the tests, `notes/mobile-design.md` and the records above.
- **Working at the same time:**
  - Brief 41 (tabs) is reworking the pane bar in `FocusPage.tsx`, with record tabs. On a phone, tabs could become an "Open records" sheet; decide and coordinate through the code once 41 lands.
  - Brief 49 (themes) is changing the tokens and `index.html`.
  - Brief 50 (format reference) is in `lathe/`.
  - Brief 47 is in `desktop/`.
  - Merge `main` in often. Before you report, merge it in, keep both sides, and rerun the full checks.
- Never use port 5199.

## Report
Use the format in 00-common-rules, with your branch and its last commit, a summary of `notes/mobile-design.md`, and what you checked in a browser and what you couldn't.
