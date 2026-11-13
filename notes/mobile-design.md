# Lathe on a phone: design decisions

The records are `LA-BRW-UC116` (and its requirements), `LA-BRW-DR220` to `DR223`, components `C210` to `C215`, tests `T460` to `T471`, and the standard `LA-PAT-APP-UX-R07`. The page bar (`LA-PAT-APP-UX-R03`) was designed at the same time, at the Owner's request, so the wide and the narrow layouts are one design at two widths.

## The principle

On a phone, Lathe is for **reading and moving around**: following a record's links, checking a domain's coverage, looking at a graph or an ERD, finding a record. It is not for arranging panels. So the phone layout drops every arranging control (handles, maximize, side-by-side panes) and keeps every reading and moving control within a thumb's reach, as sheets that come up and go away.

## Decisions

Each decision lists the options weighed, the choice and why.

### 1. When the phone layout applies: the width decides the layout, the pointer decides the targets

- **Options:** (a) one width breakpoint for the layout, and `(pointer: coarse)` for target sizes; (b) phone layout for any touch device; (c) a third, tablet layout.
- **Chosen:** (a). Below 900 px (`NARROW_QUERY`, unchanged) the app takes the phone layout. At 900 px and wider, a tablet keeps the desktop workbench, with every target at least 44 × 44 px through `@media (pointer: coarse)`.
- **Why:** the workbench needs about 750 px for the nav (256 min), one pane (220 min) and the inspector (260 min) plus gaps; below 900 px it cannot fit, whatever the pointer. Above it, a tablet in landscape (1024 to 1366 px) has the room, and a person with a tablet usually wants the same workbench as on the desktop. A tablet in portrait (768 to 834 px) gets the phone layout: one view at a time reads well there. A third layout would double the cases to test for little gain.

### 2. The page bar is one design at two widths

- **Options:** (a) a bottom tab bar on the phone (Wiki, Graph, Model, Pages, Inspector), the classic thumb-zone pattern; (b) the wide screen's page bar, compact, under the top bar.
- **Chosen:** (b), per the Owner's page bar decision. A tab is a page and the panes are views of it, so the page bar holds what belongs to the page: the tabs, the View group and the inspector toggle. On a phone the same bar sits under the top bar: the tabs fold into an "Open pages" button with a count, the View group becomes a segmented switch (Wiki, Graph, Model; icons and labels, labels dropped under 380 px), and the inspector toggle stays at the far right, beside where the inspector would be.
- **Why:** one design is easier to learn and to keep consistent; the controls are where they are on the desktop. The bottom bar's thumb-reach advantage is smaller than it looks here: the switch is used once per page, not continuously, and sheets that need a thumb (the inspector, the open pages, the canvas card) do sit at the bottom.

### 3. The stage full screen, the panels as sheets and drawers

- **Chosen (superseding the one-view-at-a-time design):** the phone shows the stage full screen under the top bar, the compact page bar and the header strip. The stage switch shows Graph, ERD and Trace as named segments; switching writes `?stage=` (replacing the history entry) and the tab's stage, but not the stage remembered for a wide screen (`lathe:stage`). The wiki card opens as a bottom sheet from the page bar's wiki button.
- **Why:** the address must say what is on screen (UX-R06); the stage is the page's canvas on every screen, and the panels that float over it on a wide screen need the whole width on a phone.
- No resize handles on a phone.

### 4. The top bar

- **Options for "back":** a back arrow calling `history.back()`, or a one-step-up breadcrumb.
- **Chosen:** a one-step **up** link above the title ("‹ Views and navigation"): the record's parent, a domain's product, or all products. It keeps the view in front.
- **Why:** phones already have a system back gesture; what they lack is a way up the tree. Up is also stable (the same for a record however you reached it).
- The title is one line with an ellipsis (the full title is in the wiki's header just below and in the `title` attribute). The menu button opens the nav sheet; the search button opens quick find.

```
┌──────────────────────────────────────┐
│ ☰  ‹ Views and navigation         ⌕ │  top bar: menu, up link, title, quick find
│    Read a record as a wiki page, a…  │
├──────────────────────────────────────┤
│ ⧉ 2      [ 📖 | ⑂ ]               ⓘ │  page bar: Open pages (2), View switch, inspector
├──────────────────────────────────────┤
│ LATHE · BROWSING · USE CASE          │
│ Read a record as a wiki page, a      │  a record page: the wiki, full width
│ graph or a model, side by side       │
│ LA-BRW-UC50                          │
│ Owner opens any record, group, …     │
│ UC requirements 13                   │
│ [ Filter by ID or title ]  13 of 13  │
│ ┌──────────────────────────────────┐ │
│ │ LA-BRW-UC50-R01 A record or…     │ │  rows stay whole-row links (UX-R05)
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### 5. Sheets, not panels

| Sheet | Shape | Opens from | Closes by |
| --- | --- | --- | --- |
| Nav | full screen, slides in from the left, keeps the space rail | menu button | Escape, ✕, choosing a page |
| Inspector | bottom sheet, half or full height, grab handle | page bar ⓘ | Escape, swipe down, tap above, ✕ |
| Open pages | bottom sheet, half or full height | page bar ⧉ | Escape, swipe down, tap above, ✕, choosing a page |
| Quick find and the command palette | full-width sheet at the top, box then results | top bar ⌕, Ctrl+P, Ctrl+Shift+P | Escape, Close, a tap below, choosing a result |
| Shortcuts | full screen | its shortcut | as on the desktop |

- Every sheet takes focus, keeps Tab inside it (`trapTab`) and gives focus back to the control that opened it (`LA-BRW-DR223`).
- **The bottom sheet's drag** (`settle` in `BottomSheet.tsx`): from half, a drag up of 40 px or a flick goes to full and a drag down of 90 px or a flick closes; from full, 60 px down goes to half and 240 px (or a hard flick past 120 px) closes. The sheet follows the finger down while dragged. Tapping the handle toggles half and full, so the keyboard and switch users have the same sizes.
- **Motion:** sheets slide with `--motion-speed` and `--motion-ease` and appear at once under reduced motion (UX-R04). While dragged, the sheet's transition time is zero (`--motion-sheet: 0ms`), so it tracks the finger.

```
┌──────────────────────────────────────┐      ┌───────┬──────────────────────────────┐
│ ☰  ‹ Lathe                         ⌕ │      │ (LA)  │ ◎ Lathe                    ✕ │
│    Browsing                          │      │ (TL)  │ [⌕ Go to… Ctrl+P           ] │
├──────────────────────────────────────┤      │ ───── │    LA Lathe                  │
│ ⧉ 1     [ 📖 | ⑂ | ▦ ]            ⓘ │      │  ⊞    │ ›  Shared                 1  │
├──────────────────────────────────────┤      │  ☑•   │ ⌄  Browsing                  │
│ The aggregates of Browsing and …     │      │       │ │ ⌄ DEFINE              13  │
│   ┌────┐                             │      │       │ │ │ › Domain model       9  │
│   │Page│──┐   ┌──────┐   ┌───────┐   │      │       │ │ │ ⌄ Use cases          4  │
│   └────┘  └──▶│Space │──▶│Folder │   │      │       │ │ │ │ ▓ Views and naviga… ▓ │  the selected row: the whole row
│        ↑ pinch, pan                  │      │       │ │ › DESIGN             337  │
├──────── ▬▬▬ ─────────────────────────┤      │       │ ›  Checking                  │
│ INSPECTOR                          ✕ │      │       ├──────────────────────────────┤
│ DOMAIN                               │      │       │ ≡  Record format             │
│ Browsing  LA-BRW                     │      │       │ ◐  Appearance                │
│ Kind        Domain                   │      └───────┴──────────────────────────────┘
│ Children 272  [ Filter … ] 272 of 272│        the nav sheet: full screen, the rail kept,
└──────────────────────────────────────┘        44 px rows with their indent guides
  the ERD with the inspector at half height
```

### 6. The nav rows, like VS Code's explorer (wide and narrow)

- Each row is one full-width element (`NavRow`), indented by `padding-left: calc(--nav-pad + depth × --nav-indent)`, with the indent guides drawn inside it (a repeating gradient sized to its depth) and its fold chevron at its start. The lists stay nested `ul`s for screen readers.
- The current page's row carries the selection over the whole row (`--steel-bg`, text and chevron in `--steel`), with no inset bar. A hovered row takes the hover tint over the whole row (UX-R01). While the nav is used from the keyboard (`is-keyboard`, set by a key press and cleared by a pointer), the selected and the focused row show a 1 px steel outline with a small radius.
- Each row's link stretches over the row (`::after`), so a tap anywhere on it follows the link; the chevron sits above it.
- On a coarse pointer the rows are 44 px tall, the chevrons 44 px wide, the indent 24 px. Rule: `LA-BRW-DR220`.

### 7. Touch on the graph and the ERD

- **Pan and pinch:** React Flow's own (`touch-action: none` on the canvas so the page does not scroll instead).
- **One tap opens** (`LA-V93-R02`): a tap on a node opens it at once, as a mouse click does; a press that moves more than a finger's waver (10 px), or a second finger landing, is a pan or a pinch and opens nothing. A tap on the empty canvas does nothing. The record sheet and the header strip name what opened, so no card names a node first.
- **Long-press: not used.** It is undiscoverable, and on iOS it fights the system's own callout. The inspector, a tap away, shows the full facts.

### 8. Quick find

A full-width sheet at the top on a phone, the stage still showing (lightly dimmed) below it: the box at the top (16 px text, no autocorrect, Enter labeled Go), Close beside it, and up to 20 results listed under it, each row at least 44 px with its kind chip, ID, title (wrapping) and trail. Typing `>` lists commands instead, as on a wide screen. Choosing a result goes there and closes the sheet; a tap on the dimmed stage, Close or Escape closes it.

```
┌──────────────────────────────────────┐
│ [⌕ graph                    ]  Close │
│ [Aggregate] LA-BRW-A4                │
│ Graph                                │
│ Lathe › … › Domain model             │
│ [Component] LA-BRW-C20               │
│ Graph model                          │
│ …                                    │
└──────────────────────────────────────┘
  (the stage, dimmed)
```

### 9. Open pages (the tabs on a phone)

The page bar's ⧉ button shows the count and opens a bottom sheet: one row per tab with its ID and title, the active one marked, the preview's title in italics with a **Keep** button, and a close button on every row. Choosing a row goes there. Swiping between tabs was considered and dropped: a horizontal swipe on the wiki conflicts with tables and code that scroll sideways, and on the graph with panning.

### 10. Readable

- Body text at least 16 px on a phone; every text box 16 px so iOS never zooms on focus.
- Long IDs wrap (`overflow-wrap: anywhere` on `.record-id`, tab and quick find IDs); wide tables (`.markdown table`, `.table-scroll`) and code blocks scroll sideways in their own box; the graph's trail scrolls in its own row; the ERD's key scrolls in at most 30 % of the screen.
- Long lists keep their 10 rows with search (`LA-BRW-DR71`), as on the desktop.

### 11. Device details

- `viewport-fit=cover`, and `env(safe-area-inset-*)` on the top bar, the app's sides, the sheets and quick find.
- `100dvh` for the app and the sheets; every other `vh` in the stylesheet became `dvh`.
- `<meta name="theme-color">` in `index.html`, kept at the theme's `--sheet` by `useThemeColor` (it follows system dark mode, `data-theme` and `data-mode` on the root, and theme stylesheets added to the head).
- Reduced motion: every sheet animation is inside `prefers-reduced-motion: no-preference` (UX-R04).

### 12. Everything works by touch (`LA-PAT-APP-UX-R07`)

- On a coarse pointer every control's target is at least `--touch-target` (44 px): the control itself, or for a small control inside a row or a node (tree and tab chevrons, tab and pane close buttons, the graph group chevron, theme swatches), a `::before` stretched to 44 × 44 around it. The resize gaps of a tablet's workbench reach 19 px over the panels' edges, so a finger can grab them.
- Nothing only by hover: a tab's close button shows always on touch; tooltips only repeat names and keys and also open on focus; on the graph and the ERD a tap opens the node, and the header strip names it.
- No sideways page scroll at 320 px: no fixed least width over 288 px outside a wide-screen query.

## What was checked in a browser

With the in-app browser at 375 × 812 and 320 × 640 in touch emulation, against `npx vite --port 5414`:

- the record page, a domain's Graph view and its ERD view (ERD): `document.documentElement.scrollWidth` equal to the viewport, and no element wider than the viewport outside a scrolling box, at both widths;
- the inspector sheet opening at half height, a drag up to full, a drag down to half and a further drag closing it, with focus back on its toggle;
- the nav sheet full screen with the rail, 44 px rows and indent guides; quick find as a full-width sheet at the top with 16 px text;
- the desktop page bar at 1280 px: 40 px high over the panes only, the View toggles and the inspector toggle at its right, each pane's header holding only its close and full screen buttons.

What could not be checked: a real iPhone's safe areas and rubber-band scrolling, a real pinch (React Flow's own handling is relied on), and a tablet's coarse pointer at 1024 px (the browser emulates touch only below 768 px); those follow from the CSS. jsdom cannot lay pages out, so `T470` checks the stylesheet and the rendered markup, not real widths.

## Smaller decisions

- The phone's View switch shows only the views the page offers; with one view offered it is hidden.
- The up link keeps the view in front (`?view=` of the current address).
- The inspector on a phone always starts closed on a new page; its desktop open state is not touched.
- The pages sheet closes on a page change.
