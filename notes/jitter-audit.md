# Jitter audit

Every shift the stability suite found, grouped by cause, ranked by size times how often the Reader meets it. The rule is `LA-PAT-APP-UX-R08` ("Nothing jumps"); the use case is `LA-BRW-UC117`.

## How it is measured

- `npm --prefix app run test:stability` runs the scenarios in `app/stability/*.spec.ts` with Playwright (Chromium only, one worker). It starts Vite on a free port (never 5199) over a temporary copy of the specs, so the live reload scenario can edit a spec file.
- In each step it records:
  - every `layout-shift` entry, including the ones CLS leaves out because they came just after input (flagged `recentInput`);
  - long animation frames;
  - the boxes of key elements, frame by frame, so a move, a jump back or a remount shows even without a shift.
- A step names what it changes on purpose (`allow`, such as the panes when a pane opens). Everything else is **unexpected**, and must stay at 0.01 or less. Transforms and opacity are not layout shifts, so the graph's tokened glides and fades cost nothing.
- In phase 1, shifts that moved only the nav or the tab strip were reported as **deferred** (`DEFERRED` in `app/stability/measure.ts`), because those parts belonged to other work in progress. Phase 2 emptied that list: every part of the app is held to the budget.
- A shift source whose node was removed before the shift was reported (old content being replaced) cannot be placed; it neither explains nor condemns its shift, and the other sources decide.
- A key element that a step cannot find fails the step, so a selector that goes stale after a UI change is caught.
- Results: `app/stability/results/summary.json` (ignored by git). `STABILITY_LABEL=before` keeps a labeled copy.
- Limits:
  - Headless Chromium on macOS draws overlay scrollbars, so a scrollbar that comes and goes cannot show as a shift. `app/test/nothing-jumps.test.tsx` checks the cause in the stylesheet instead.
  - Theme switching (`LA-BRW-T489`) and the mobile sheets at 375 px (`LA-BRW-T490`) arrived on `main` during phase 1. They are measured in `app/stability/theme-and-mobile.spec.ts`.

## Causes, ranked

Size is the largest CLS value seen in one step, and the largest move of a key element. Status: **fixed** (phase 1), **fixed in phase 2** (views/, shell/, App.tsx, the nav, the fonts), **ok** (measured, nothing to fix).

### 1. Late or revealed content in the nav (fixed in phase 2)

| Scenario | Element | Moved | CLS | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| Graph re-center (depth 2 and 3), ERD domain to aggregate, a link from a scrolled page | the nav's folders, Diagrams and Tools sections | 210 to 270 px down | 0.0175 to 0.1059 | The nav opens the folder of the new current record, and everything below it drops | Only a move made in the nav reshapes it. A page opened from a nav link, or on the nav's first draw (load, reload, expanding it, the phone drawer), opens its branch before paint and scrolls its row into view; a page opened anywhere else leaves the rows where they are, marks the closed row that holds it (steel, "Holds the current page"), and opening that row opens the branch down to the page (`LA-BRW-UC100-R03` reworded). Scroll compensation was not used: the opened folder is usually in view, so rows below it would move anyway | fixed in phase 2 |
| First load of the product, domain and record pages | the nav's Diagrams and Tools sections, the space rail's items | 66 to 484 px down | 0.0146 to 0.0269 | The diagrams list arrives first, then the specs; the spaces, the product's tree and the rail's space items are inserted above what is already drawn | The nav's lists, and the rail's items below the spaces, are drawn once the specs and the diagrams have both arrived (`aria-busy` until then), so neither pushes the other | fixed in phase 2 |

### 2. Bars whose height followed their text (fixed)

| Scenario | Element | Moved | CLS | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| ERD: domain to aggregate, aggregate to entity, Back | `.erd-key`, so `.model-canvas` | 22 to 44 px | 0.0318 to 0.1106 | The key had 2 line ends on a domain, up to 5 on an aggregate, one per row | One height for every ERD (`--erd-key-height`, 5.5rem), line ends in up to three rows, the rest scrolls | fixed |
| Graph re-center at depth 2 | `.graph-header`, `.graph-canvas` | 23.5 px | 0.0069 | The trail of visited records wrapped onto a second line once it grew | The trail is one line: earlier items shrink with an ellipsis, the center keeps its name, and it scrolls to the end | fixed |
| Graph re-center (a requirement, a use case) | `.graph-toolbar` | (wraps at narrow panes) | | The toolbar wrapped when Trace mode appeared for some centers | The toolbar is one line; the count takes what is left, with an ellipsis | fixed |
| ERD (narrow pane) | `.model-caption` | (wraps) | | The caption wrapped with long titles | One line, an ellipsis, its whole text in its tooltip | fixed |
| Moving between records | the wiki pane's title | its height | allowed | The wiki title wraps by length | A new page's title is new content, so it may be taller. Its box must not jump back, and it does not | ok |

### 3. Text after a changing number (fixed)

| Scenario | Element | Moved | CLS | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| Graph re-center at depth 3, changing the depth | `.graph-count` | a few px sideways | 0.0001 to 0.0288 | The count was several text nodes, right-aligned after the filters; a new number moved the text after it, and Trace mode appearing moved it all | One text, placed right after the depth (whose width never changes); Trace mode and Filters sit at the end | fixed |
| ERD: Back to the domain | `.model-caption` | sideways | 0.0410 | The text after the bold title moved with the title's length | One text | fixed |

### 4. Measure, then correct (fixed)

| Scenario | Element | Moved | CLS | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| Opening the Model pane | the ERD's boxes | drawn at the default view, then moved | (a transform, not a shift) | `ModelView` fitted the picture in an effect after paint, and made a new `ResizeObserver` with each picture, whose first report cut each glide short | Fit before paint (`useLayoutEffect`); the first picture appears fitted; one observer for the canvas's life that acts only on a real size change, as the graph does | fixed |
| Re-centering the graph, opening the Graph pane | the inspector's "connections" section and legend | inserted a frame late | part of 0.0548 to 0.0841 (allowed area) | `GraphView` told the host what it draws in `useEffect`, so the inspector painted once without it | `useLayoutEffect`, so the inspector gets it in the same frame | fixed |
| A link from a scrolled page | the wiki pane's scroll | | 0 | The scroll to the top runs in an effect | React flushes it before paint for clicks and keys. Measured frame by frame, the new page is never drawn at the old scroll | ok |

### 5. Controls that move under the pointer (fixed in phase 2)

| Scenario | Element | Moved | CLS | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| Domain page to a record through the nav | the view toggles | 34 px sideways | 0.0001 to 0.0002 | The Model toggle is shown only where the Model view is offered, so the toggles to its left move | The View group keeps a slot for every view on a wide screen: a view the page does not offer shows dimmed (`aria-disabled`), its tooltip saying where it works. The phone's switch still shows only the views offered | fixed in phase 2 |
| Graph re-center at depth 3 (and any move to a record with a shorter or longer title) | the preview tab's title and close button (`.tab-strip`) | 82 to 110 px sideways | 0.0288 | The preview tab's width follows its record's title, so its close button moves under the pointer | Every tab has one width (`--tab-width`, 14rem), its title cut with an ellipsis, so the close button stays put; the tab's label is keyed by its page, so a new page's ID and title are new text drawn in place. The page's header is keyed by the focus too, so its problem badge is never slid along by a title of another length | fixed in phase 2 |

### 6. Lost scroll (fixed in phase 2)

| Scenario | Element | Moved | CLS | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| Back to a page left half-way down | the wiki pane | back at the top | 0 | `FocusPage` scrolls the wiki to the top on every focus change, Back included | Each history entry notes the wiki's scroll in `history.state` (as it scrolls, and as a link leaves the page, through `onLeaveEntry` in `router.tsx`); Back and Forward restore it in a layout effect, and once more when layout is done (a ResizeObserver, still before paint), as a section's actions slot settles in a re-render of its own. A new page in the tab starts at the top; switching tabs keeps each tab's scroll | fixed in phase 2 |
| Live reload while scrolled half-way | the wiki pane | none | 0 | | The browser's scroll anchoring keeps the top row in place; nothing remounts | ok |

### 7. Scrollbars that come and go (fixed)

| Scenario | Element | Moved | CLS | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| Any page whose length changes (classic scrollbars: Windows, a Mac with a mouse) | scroll boxes | 12 to 15 px narrower | not measurable headless | no `scrollbar-gutter` | `scrollbar-gutter: stable` on `.long-list-scroll`, `.graph-side`, `.spec-page` and `.erd-key` | fixed |
| Same | `.pane-scroll`, `.inspector.record-side`, `.pages-list`, `.nav-scroll`, `.space-rail`, `.quick-find-results`, `.quick-find-results.is-inline`, `.palette-list`, `.shortcut-groups`, `.workspace > aside` | same | | same | `scrollbar-gutter: stable` on each; the space rail, too narrow to give a scrollbar room, hides its scrollbar (`scrollbar-width: none`) and still scrolls. The test's waiting list is gone: every scroll box must keep its gutter or hide its scrollbar | fixed in phase 2 |

### 8. Fonts swapping in (fixed in phase 2)

| Scenario | Element | Moved | CLS | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| First load with the font files held back 2.5 s | inspector rows | 4 to 22 px | 0.0005 | Google Fonts with `display=swap`: text draws in the fallback, then swaps | The three families are served with the app (`app/public/fonts`, latin and latin-ext woff2 from Fontsource 5.3.0, each with its OFL license; `app/src/fonts.css`), the six latin files preloaded in `index.html`, every face `font-display: optional`: a face not there in time is skipped for the page's life, never swapped in. The Google Fonts link is gone, so the desktop app works offline | fixed in phase 2 |
| First load with the font CSS slow | the whole page | first paint late | long frame 2.6 s | The Google Fonts stylesheet is render-blocking | Same: no stylesheet from the network | fixed in phase 2 |

### 9. Long frames (not shifts, but the page stalls)

| Scenario | Long frames | Worst | Note | Status |
|---|---|---|---|---|
| First load, on the dev server | 3 to 5 | 170 to 540 ms | The dev server transforms modules on demand; indexing the workspace and drawing every tree | measured on the built app instead (below) |
| First load, built app under `lathe serve` | 2 | 65 ms (record) to 190 ms (domain) | Parsing the bundle, indexing the workspace, drawing the domain page's lists once | ok: one-time, no shift |
| Live reload, on the dev server | 6 | 270 to 360 ms | Re-indexing the workspace and re-rendering every list | measured on the built app instead (below) |
| Live reload, built app under `lathe serve` (a use case edited, its page open) | 0 | none | | ok: keeping unchanged records' objects (in `app/src/specs`) is not needed now |
| Graph re-center | 1 to 3 | 60 to 130 ms | ELK layout plus React Flow | ok for now |

### Checked and fine

- **Remounts:** the graph and ERD canvases, and every pane that stays open, keep their elements through re-centers, view changes and reloads (key tracking counts remounts).
- **Tooltips and popovers:** placed from the control's box before they show; quick find, the palette and the shortcuts sheet keep their search box still while typing.
- **Folding:** a row opens at once, with no animation, and nothing above it moves (decided: no height animation; nothing jumps and then corrects).
- **Resizing:** every gap follows the pointer and never jumps back; folding by drag moves nothing on the far side.
- **Panes and full screen:** only the panes change width; the nav and the inspector stay.
- **Theme:** switching to Midnight shifts nothing (themes set tokens only).
- **Mobile at 375 px:** the nav drawer, the quick find sheet and the inspector sheet open and close over the page without moving it.
- **Phone record rows** (not jitter, but fixed with phase 2): a record row stacks its ID, its title at the row's full width, then its meta, and a tree row's count wraps under the title (`LA-BRW-UC116-R08`).

## Before and after, by scenario

"Phase 1 before" is the code at the start of phase 1 (the nav and tab strip not yet measured). "Phase 2 start" is `main` at the start of phase 2 with `DEFERRED` emptied, so the nav's and the tab strip's shifts count. "After" is this branch with current `main` merged in. All values are unexpected layout shift per step (the budget is 0.01). Long frames are on the dev server; see cause 9 for the built app.

| Scenario / step | Phase 1 before | Phase 2 start (nav and tab strip counted) | After | After: key moves | After: long frames (worst) |
|---|---|---|---|---|---|
| first load: product page / first load | 0.0000 | 0.0123 | 0.0000 | none | 3 (496 ms) |
| first load: domain page / first load | 0.0000 | 0.0153 | 0.0000 | none | 4 (538 ms) |
| first load: record page / first load | 0.0000 | 0.0243 | 0.0000 | none | 3 (174 ms) |
| first load: record page, slow fonts / first load | 0.0005 | 0.0248 | 0.0000 | none | 3 (174 ms) |
| fold / open a row | 0.0000 | 0.0000 | 0.0000 | none | 1 (157 ms) |
| fold / close the row | 0.0000 | 0.0000 | 0.0000 | none | 1 (116 ms) |
| fold / Expand all | 0.0000 | 0.0000 | 0.0000 | none | 1 (108 ms) |
| fold / Collapse all | 0.0000 | 0.0000 | 0.0000 | none | 1 (123 ms) |
| graph / depth 1: re-center 1 | 0.0000 | 0.0000 | 0.0000 | none | 1 (126 ms) |
| graph / depth 1: re-center 2 | 0.0000 | 0.0000 | 0.0000 | none | 1 (93 ms) |
| graph / depth 2: re-center 1 | 0.0000 | 0.1134 | 0.0000 | none | 1 (116 ms) |
| graph / depth 2: re-center 2 | 0.0069 | 0.0000 | 0.0000 | none | 1 (104 ms) |
| graph / depth 3: re-center 1 | 0.0288 | 0.0288 | 0.0000 | none | 2 (132 ms) |
| graph / depth 3: re-center 2 | 0.0009 | 0.1191 | 0.0000 | none | 3 (116 ms) |
| graph / depth to 2 | 0.0000 | 0.0000 | 0.0000 | none | 1 (57 ms) |
| graph / depth to 3 | 0.0001 | 0.0000 | 0.0000 | none | 3 (79 ms) |
| graph / depth to 1 | 0.0002 | 0.0000 | 0.0000 | none | 2 (71 ms) |
| graph / ERD: domain to aggregate | 0.0318 | 0.0256 | 0.0000 | none | 1 (159 ms) |
| graph / ERD: aggregate to entity | 0.1106 | 0.0000 | 0.0000 | none | 1 (84 ms) |
| graph / ERD: Back to the domain | 0.0708 | 0.0762 | 0.0000 | none | 1 (145 ms) |
| navigate / through the nav | 0.0001 | 0.0002 | 0.0000 | none | 1 (80 ms) |
| navigate / through a link | 0.0000 | 0.0000 | 0.0000 | none | 1 (118 ms) |
| navigate / graph click | 0.0000 | 0.0000 | 0.0000 | none | 1 (141 ms) |
| navigate / Back | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| navigate / link from a scrolled page | 0.0000 | 0.0256 | 0.0000 | none | 1 (138 ms) |
| navigate / Back to the scrolled page | 0.0000 | 0.0001 | 0.0000 | none | 0 (0 ms) |
| navigate / quick find | 0.0000 | 0.0000 | 0.0000 | none | 1 (66 ms) |
| overlays / tooltip on hover | 0.0000 | 0.0000 | 0.0000 | none | 1 (53 ms) |
| overlays / tooltip moving to the next button | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| overlays / quick find: open and type | 0.0000 | 0.0000 | 0.0000 | none | 2 (87 ms) |
| overlays / quick find: Escape | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| overlays / palette: open and type | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| overlays / shortcuts sheet: open and search | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| panes / open Graph (Ctrl+2) | 0.0000 | 0.0000 | 0.0000 | none | 2 (82 ms) |
| panes / close Graph (Ctrl+2) | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| panes / open Model (Ctrl+4) | 0.0000 | 0.0000 | 0.0000 | none | 2 (56 ms) |
| panes / add Graph beside Model | 0.0000 | 0.0000 | 0.0000 | none | 1 (52 ms) |
| panes / close Wiki with two others open | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| panes / maximize (Ctrl+3) | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| panes / leave full screen (Escape) | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| panes / hide the inspector | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| panes / show the inspector | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| reload / spec edited while scrolled | 0.0000 | 0.0000 | 0.0000 | none | 6 (356 ms) |
| reload / spec edited with the graph open | 0.0000 | 0.0000 | 0.0000 | none | 1 (146 ms) |
| resize / drag the nav gap | 0.0000 | 0.0000 | 0.0000 | none | 1 (59 ms) |
| resize / collapse the nav by drag | 0.0000 | 0.0000 | 0.0000 | none | 1 (56 ms) |
| resize / drag the pane gap | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| resize / drag the inspector gap | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| resize / collapse the inspector by drag | 0.0000 | 0.0000 | 0.0000 | none | 0 (0 ms) |
| theme / switch to Midnight | n/a | 0.0000 | 0.0000 | none | 0 (0 ms) |
| mobile / open and close the nav drawer | n/a | 0.0000 | 0.0000 | none | 1 (118 ms) |
| mobile / open and close quick find | n/a | 0.0000 | 0.0000 | none | 0 (0 ms) |
| mobile / open and close the inspector sheet | n/a | 0.0000 | 0.0000 | none | 0 (0 ms) |

## Phase 2 list (done)

1. Nav: only a move made in the nav reshapes it; elsewhere the holding row is marked (cause 1).
2. Nav: its lists and the rail's lower items wait for the specs and the diagrams (cause 1).
3. Page bar: the Model toggle keeps its slot on every page (cause 5).
4. Wiki pane: Back and Forward restore each history entry's scroll before paint (cause 6).
5. `scrollbar-gutter: stable` on the ten scroll boxes; the list in the test is gone (cause 7).
6. Tabs: one width for every tab (cause 5).
7. Fonts: self-hosted, preloaded, `font-display: optional` (cause 8).
8. `DEFERRED` in `app/stability/measure.ts` is empty: the nav and the tab strip are held to the budget.
9. Long frames measured on the built app: no action needed (cause 9).
10. Everything re-measured: every step is at 0.0000 unexpected, and no key element moves.

## Measurement fix

11. "ERD: Back to the domain" failed once (0.076): the shift came from the side panel, which the step allows, but one moved element had already left the page before the shift was reported, and whether it counted depended on machine load. A removed element is now judged by where its old box was: inside an allowed part it is allowed; otherwise it neither explains nor condemns the shift. The 0.01 limit is unchanged. The step passed 9 of 9 runs, including at 6× CPU slowdown.
