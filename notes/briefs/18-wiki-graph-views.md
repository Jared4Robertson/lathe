# Brief: wiki and graph as two views of one address

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-4`.

## Goal
Jared wants the wiki page and the graph to be two views of the same thing at the same address, not two separate places: open any record (or group) and choose to read it, see it in the graph, or both side by side.

## What to build
1. **One address per thing:** `/records/<id>` for a record and `/records/<parent-id>/<kind>` for a group (the graph's group nodes). `/graph/<id>` and `/graph/<parent-id>/<kind>` redirect to the same address with the graph view.
2. **Views:** a toggle in the page header with three modes: **Wiki**, **Graph**, **Split** (side by side, with a draggable divider). Either pane in split mode can go **full screen** (a button on the pane; Escape returns to split). The mode is remembered between visits (local storage) and can be set in the link with `?view=wiki|graph|split`, so a shared link opens as it was seen.
3. **One focus:** both panes show the same record. Clicking a node in the graph changes the address, so the wiki pane follows; clicking a record link in the wiki re-centres the graph. Back and Forward move both. Graph state (depth, filters, open groups, trace mode) survives navigation.
4. **A group in the wiki view** is a simple page: the parent, the kind, and its members as a list with their coverage marks.
5. Product and domain pages get the same toggle (their graph view is the graph centred on the product or domain).
6. **Long lists everywhere:** the spec pages now use `app/src/specs/LongList.tsx` (at most 10 rows high, scrolling, with a search box once there are more than 10). Use it for every list that can grow, including the graph's side panel lists (connected records, problems, gaps) and the group pages; move it to a shared place such as `app/src/components/` if both views use it.
7. Keyboard: a shortcut for each mode, focus never lost when switching, and a visible focus ring on the toggle.
8. Tests, and Lathe's own spec in `specs/lathe/browsing/` using only use case `LA-BRW-UC50` with its requirements, domain rules `LA-BRW-DR50`–`DR59`, components `LA-BRW-C50`–`C59`, tests `LA-BRW-T120`–`T139`. Update `LA-BRW-A1` (Page) for the new addresses. All new obligations satisfied and proved.

## Scope
Read first: the whole of `app/src/` (especially `router.tsx`, `App.tsx`, `specs/*`, `graph/*`) after the pass-4 graph-groups and spec-pages work has merged. You own `app/**` and the spec records above.

## Checks
`cd app && npx tsc --noEmit`, `npm --prefix app test`, `npm --prefix lathe run check` (0 errors). If you look at the app, use `npx vite --port 5395` in `app/` and stop it. Never use port 5199.
