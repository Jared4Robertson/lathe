# Brief: wiki and graph as two views of one address

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-4`.

## Goal
Jared wants the wiki page and the graph to be two views of the same thing at the same address, not two separate places: open any record (or group) and choose to read it, see it in the graph, or both side by side.

## What to build
1. **One address per thing:** `/records/<id>` for a record and `/records/<parent-id>/<kind>` for a group (the graph's group nodes). `/graph/<id>` and `/graph/<parent-id>/<kind>` redirect to the same address with the graph view.
2. **Views:** a toggle in the page header with three modes: **Wiki**, **Graph**, **Split** (side by side, with a draggable divider). Either pane in split mode can go **full screen** (a button on the pane; Escape returns to split). The mode is remembered between visits (local storage) and can be set in the link with `?view=wiki|graph|split`, so a shared link opens as it was seen.
3. **One focus:** both panes show the same record. Clicking a node in the graph changes the address, so the wiki pane follows; clicking a record link in the wiki re-centers the graph. Back and Forward move both. Graph state (depth, filters, open groups, trace mode) survives navigation.
4. **A group in the wiki view** is a simple page: the parent, the kind, and its members as a list with their coverage marks.
5. Product and domain pages get the same toggle (their graph view is the graph centered on the product or domain).
6. **Long lists everywhere:** the spec pages now use `app/src/specs/LongList.tsx` (at most 10 rows high, scrolling, with a search box once there are more than 10). Use it for every list that can grow, including the graph's side panel lists (connected records, problems, gaps) and the group pages; move it to a shared place such as `app/src/components/` if both views use it.
7. **Polish the side navigation** (Jared's request), following common app-shell practice:
   - **Collapsible:** a toggle collapses the nav to a narrow rail of icons (logo, Diagrams, Specs, Checks, Graph, Format) with tooltips, and expands it again; the state is remembered. On narrow screens (under about 900 px) it becomes an overlay drawer opened from a menu button, closed by Escape, a click outside or choosing a page, with focus moved into it and back.
   - **Sections:** Diagrams, Specs and tools each collapse and expand on their own (with a chevron and `aria-expanded`), and each product's domain list too; the section holding the current page opens itself.
   - **Current place:** a clear active state for the current page (and its product and domain), `aria-current="page"`, and the active item scrolled into view.
   - **Clarity:** consistent icons (Tabler-style line icons drawn inline, no icon font), counts as quiet badges (checks show errors in red and warnings in amber), long names truncated with a tooltip, comfortable hit targets (at least 32 px high), and a footer with the record format link and the source note.
   - **Quick find:** a search field at the top of the nav (shortcut `/` or Cmd/Ctrl+K) that jumps to any record, domain, product or diagram by ID or title, with arrow keys and Enter.
   - Keep the colors and fonts of the existing tokens in `styles.css`, in both light and dark.
8. **The inspector (the third column):** Jared calls the right-hand panel of a record page and of the graph (kind, fields, parent, children, links, problems) **the inspector**; use that name in the UI, code and spec. The page has three columns: **nav**, **main view**, **inspector**. Make the inspector collapsible like the nav: a toggle on its edge, a keyboard shortcut (for example `]`, with `[` for the nav), the state remembered, and on narrow screens it becomes a drawer. When collapsed the main view takes the space; in Split mode the two panes share it. One inspector serves the whole page, showing the focused record, whichever view is open.
9. Keyboard: a shortcut for each mode, focus never lost when switching, and a visible focus ring on the toggle.
10. Tests, and Lathe's own spec in `specs/lathe/browsing/` using only use case `LA-BRW-UC50` with its requirements, domain rules `LA-BRW-DR50`–`DR59`, components `LA-BRW-C50`–`C59`, tests `LA-BRW-T120`–`T139`. Update `LA-BRW-A1` (Page) for the new addresses. All new obligations satisfied and proved.

## Added during the work: keyboard shortcuts
A VS Code-style keymap (one table driving handlers, a command palette and a shortcuts sheet), sent to the agent as a message on 2026-10-24: Cmd/Ctrl+P or K quick open, Cmd/Ctrl+Shift+P command palette, Cmd/Ctrl+B nav, Cmd/Ctrl+Alt+B inspector, Cmd/Ctrl+\ split, Ctrl+1/2/3 views, Ctrl+- and Ctrl+Shift+- back and forward, F12 and Shift+F12 links, Cmd/Ctrl+Shift+M checks, F8 problems, `/` search, `?` help, graph keys, and `g` sequences; overridable from local storage. Extra IDs: LA-BRW-UC51, DR60–DR69, C60–C69, T140–T159.

## Added during the work: one level deeper by default
Every wiki page (product, domain, record, group) and the inspector show only one level below the page's record; deeper levels are collapsed under disclosure triangles with counts and coverage marks still visible, with Expand all / Collapse all per section, remembered state, search that reveals matches, VS Code tree keys (Right expands, Left collapses), and palette commands. Recorded as a domain rule. Sent to the agent as a message on 2026-10-24.

## Scope
Read first: the whole of `app/src/` (especially `router.tsx`, `App.tsx`, `specs/*`, `graph/*`) after the pass-4 graph-groups and spec-pages work has merged. You own `app/**` and the spec records above.

## Checks
`cd app && npx tsc --noEmit`, `npm --prefix app test`, `npm --prefix lathe run check` (0 errors). If you look at the app, use `npx vite --port 5395` in `app/` and stop it. Never use port 5199.
