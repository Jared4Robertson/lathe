# Brief: product spaces and shortcut hints

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `spaces`.

## Goal
Two requests from Jared for the app shell:
1. **Each product is its own space.** Add a narrow column on the far left of the side nav with an icon per product (as Slack, Discord, Linear and Notion do for workspaces). Choosing a product makes it the current space: the nav shows only that product's domains, capabilities and groups; product-scoped things follow it.
2. **Shortcut hints, the standard way.** Wherever a command has a shortcut, show it the way common apps do.

## What to build
**Spaces**
- A rail about 56 px wide at the far left of the nav: one square icon button per product, then a separator and the cross-product items (Diagrams, and Checks for all products), with a tooltip naming each. The current space is clearly marked (an accent bar and `aria-current`).
- A product's icon: an `icon` field on its product record if it has one (one emoji or up to two characters), otherwise its ID prefix as a monogram (`TL`, `LA`), with a stable colour derived from the ID; optional `color` field. Document both optional fields in `lathe/FORMAT.md` (product record, a short paragraph in section 2).
- The current space is the product of the page you are on; choosing a space opens that product's page, or the last page you visited in it (remember per space for the session). The nav lists only that space's domains and items; quick find searches the current space first, then everything else under a divider; Checks can be filtered to the space.
- Keyboard: Alt+1 … Alt+9 (⌥1 … ⌥9 on macOS) switch spaces in rail order; add "Switch to <product>" commands to the command palette. Keep every existing shortcut working.
- On narrow screens the rail stays visible inside the nav drawer.

**Shortcut hints**
- Every icon button and control that has a shortcut shows it in its tooltip, as "Toggle nav ⌘B" (macOS symbols ⌘ ⌥ ⇧ ⌃, or "Ctrl+B" elsewhere), after the usual short hover delay and on keyboard focus.
- Menus and the command palette list each command's shortcut right-aligned in `<kbd>` styling, as VS Code and Linear do.
- Every control with a shortcut gets `aria-keyshortcuts`.
- All of it reads from the single keymap table (overrides included), so a rebinding changes the hints too.
- Keep the existing shortcuts sheet (`?`) and make it match.

**Tests and spec**
- Tests (vitest + testing-library) for: the rail lists products in order with monograms or icons, choosing a space scopes the nav and remembers the last page, Alt+n switches, quick find puts the current space first, tooltips and palette rows show the right keys per platform and follow an override, and `aria-keyshortcuts` is set.
- Lathe's own spec: use case `LA-BRW-UC90` (spaces) and `LA-BRW-UC91` (shortcut hints) under `LA-BRW-CAP02`, with requirements, domain rules `LA-BRW-DR100`–`DR119`, components `LA-BRW-C100`–`C119`, tests `LA-BRW-T220`–`T249`, and a flow carrying out each (written with flow steps if natural). All satisfied and proved; every new rule applied by a use case. Give the Lathe and Tool Library product records an `icon` if a fitting one helps (optional).

## Scope
You own `app/**`, `lathe/FORMAT.md` section 2 (one paragraph), the two product records' `icon` fields, and the spec records above. Never use port 5199; if you look at the app, use `npx vite --port 5399` in `app/` and stop it.

## Checks
`cd app && npx tsc --noEmit`, `npm --prefix app test`, `npm --prefix lathe run check` (0 errors).
