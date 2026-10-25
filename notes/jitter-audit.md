# Jitter audit (brief 53)

Every shift the stability suite found, grouped by cause, ranked by size times how often the Reader meets it. The rule is `LA-PAT-APP-UX-R08` ("Nothing jumps"); the use case is `LA-BRW-UC117`.

## How it is measured

- `npm --prefix app run test:stability` runs the scenarios in `app/stability/*.spec.ts` with Playwright (Chromium only, one worker). It starts Vite on a free port (never 5199) over a temporary copy of the specs, so the live reload scenario can edit a spec file.
- In each step it records:
  - every `layout-shift` entry, including the ones CLS leaves out because they came just after input (flagged `recentInput`);
  - long animation frames;
  - the boxes of key elements, frame by frame, so a move, a jump back or a remount shows even without a shift.
- A step names what it changes on purpose (`allow`, such as the panes when a pane opens). Everything else is **unexpected**, and must stay at 0.01 or less. Transforms and opacity are not layout shifts, so the graph's tokened glides and fades cost nothing.
- Shifts that move only the nav or the tab strip are reported as **deferred** (`DEFERRED` in `app/stability/measure.ts`) until phase 2, because those parts belong to other briefs right now. Phase 2 empties that list.
- A key element that a step cannot find fails the step, so a selector that goes stale after a UI change is caught.
- Results: `app/stability/results/summary.json` (ignored by git). `STABILITY_LABEL=before` keeps a labeled copy.
- Limits:
  - Headless Chromium on macOS draws overlay scrollbars, so a scrollbar that comes and goes cannot show as a shift. `app/test/nothing-jumps.test.tsx` checks the cause in the stylesheet instead.
  - Theme switching (`LA-BRW-T489`) and the mobile sheets at 375 px (`LA-BRW-T490`) arrived on `main` during phase 1. They are measured in `app/stability/theme-and-mobile.spec.ts`.

## Causes, ranked

Size is the largest CLS value seen in one step, and the largest move of a key element. Status: **fixed** (phase 1), **phase 2** (views/, shell/, App.tsx, the nav), **listed** (another brief's files), **ok** (measured, nothing to fix).

### 1. Late or revealed content in the nav (phase 2)

| Scenario | Element | Moved | CLS | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| Graph re-center (depth 2 and 3), ERD domain to aggregate, a link from a scrolled page | the nav's folders, Diagrams and Tools sections | 210 to 270 px down | 0.0175 to 0.1059 | The nav opens the folder of the new current record, and everything below it drops | Keep what is in view: when the nav opens a folder for the current record, add the inserted height to `.nav-scroll`'s `scrollTop` (or keep `overflow-anchor` on a row above), or open it without moving rows the Reader can see | phase 2 |
| First load of the product, domain and record pages | the nav's Diagrams and Tools sections, the space rail's items | 66 to 484 px down | 0.0146 to 0.0269 | The diagrams list arrives first, then the specs; the spaces, the product's tree and the rail's space items are inserted above what is already drawn | Draw the nav's space area at a reserved size (a skeleton of rows, and the rail's space slots) until the specs load, or hold the nav's lists until both have loaded | phase 2 |

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

### 5. Controls that move under the pointer (phase 2)

| Scenario | Element | Moved | CLS | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| Domain page to a record through the nav | the view toggles | 34 px sideways | 0.0001 to 0.0002 | The Model toggle is shown only where the Model view is offered, so the toggles to its left move | Keep the Model toggle's slot on every page: disabled, with a tooltip saying where it works | phase 2 |
| Graph re-center at depth 3 (and any move to a record with a shorter or longer title) | the preview tab's title and close button (`.tab-strip`) | 82 to 110 px sideways | 0.0288 | The preview tab's width follows its record's title, so its close button moves under the pointer | One width for a tab (or a minimum that fits most titles, cut with an ellipsis), so the close button stays put | phase 2 (tabs, brief 41) |

### 6. Lost scroll (phase 2)

| Scenario | Element | Moved | CLS | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| Back to a page left half-way down | the wiki pane | back at the top | 0 | `FocusPage` scrolls the wiki to the top on every focus change, Back included | Keep each history entry's wiki scroll (in `history.state`) and restore it before paint on Back and Forward | phase 2 |
| Live reload while scrolled half-way | the wiki pane | none | 0 | | The browser's scroll anchoring keeps the top row in place; nothing remounts | ok |

### 7. Scrollbars that come and go (fixed where owned; phase 2 for the rest)

| Scenario | Element | Moved | CLS | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| Any page whose length changes (classic scrollbars: Windows, a Mac with a mouse) | scroll boxes | 12 to 15 px narrower | not measurable headless | no `scrollbar-gutter` | `scrollbar-gutter: stable` on `.long-list-scroll`, `.graph-side`, `.spec-page` and `.erd-key` | fixed |
| Same | `.pane-scroll`, `.inspector.record-side`, `.pages-list`, `.nav-scroll`, `.space-rail`, `.quick-find-results`, `.quick-find-results.is-inline`, `.palette-list`, `.shortcut-groups`, `.workspace > aside` | same | | same | the same; `PHASE_2_SCROLL_BOXES` in `app/test/nothing-jumps.test.tsx` lists them, and the test fails once one is fixed until it is taken off the list | phase 2 |

### 8. Fonts swapping in (listed: phase 2)

| Scenario | Element | Moved | CLS | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| First load with the font files held back 2.5 s | inspector rows | 4 to 22 px | 0.0005 | Google Fonts with `display=swap`: text draws in the fallback, then swaps | Self-host the three families and preload the woff2 files. Then use `font-display: optional`, or fallback `@font-face` rules with `size-adjust` and `ascent-override` tuned to Archivo, Public Sans and JetBrains Mono | listed: phase 2 (self-hosting adds font files to the repo, which waits for approval) |
| First load with the font CSS slow | the whole page | first paint late | long frame 2.6 s | The Google Fonts stylesheet is render-blocking | Same: self-hosted fonts in the app's own CSS | listed (as above) |

### 9. Long frames (not shifts, but the page stalls)

| Scenario | Long frames | Worst | Note | Status |
|---|---|---|---|---|
| First load | 4 to 5 | 300 to 460 ms | The dev server transforms modules on demand; indexing the workspace and drawing every tree | phase 2: measure against `lathe serve`'s built app before acting |
| Live reload of the domain page | 7 | 270 to 290 ms | Re-indexing the workspace and re-rendering every list | phase 2: keep unchanged records' objects so memoized rows skip |
| Graph re-center | 1 to 3 | 60 to 130 ms | ELK layout plus React Flow | ok for now |

### Checked and fine

- **Remounts:** the graph and ERD canvases, and every pane that stays open, keep their elements through re-centers, view changes and reloads (key tracking counts remounts).
- **Tooltips and popovers:** placed from the control's box before they show; quick find, the palette and the shortcuts sheet keep their search box still while typing.
- **Folding:** a row opens at once, with no animation, and nothing above it moves (decided: no height animation; nothing jumps and then corrects).
- **Resizing:** every gap follows the pointer and never jumps back; folding by drag moves nothing on the far side.
- **Panes and full screen:** only the panes change width; the nav and the inspector stay.
- **Theme:** switching to Midnight shifts nothing (themes set tokens only).
- **Mobile at 375 px:** the nav drawer, the quick find sheet and the inspector sheet open and close over the page without moving it.

## Before and after, by scenario

"Before" is the code at the start of phase 1, measured with the same scenarios. "After" is this branch with current `main` merged in (the tabs, the themes, the mobile layout and the inspector side bar arrived meanwhile), so the deferred column also holds the new tab strip. Steps with nothing in any column are left out: all the fold, resize, pane, overlay, reload and quick find steps measured 0 before and after. The theme and mobile steps have no "before" because those features were not on `main` yet.

| Scenario / step | Before: unexpected | Before: key moves | After: unexpected | After: deferred (nav, tab strip) | After: key moves |
|---|---|---|---|---|---|
| first load: product page / first load | 0.0000 | none | 0.0000 | 0.0123 | none |
| first load: domain page / first load | 0.0000 | none | 0.0000 | 0.0153 | none |
| first load: record page / first load | 0.0000 | none | 0.0000 | 0.0243 | none |
| first load: record page, slow fonts / first load | 0.0005 | none | 0.0005 | 0.0243 | none |
| fold / open a row | 0.0000 | none | 0.0000 | 0.0000 | none |
| fold / close the row | 0.0000 | none | 0.0000 | 0.0000 | none |
| fold / Expand all | 0.0000 | none | 0.0000 | 0.0000 | none |
| fold / Collapse all | 0.0000 | none | 0.0000 | 0.0000 | none |
| graph / depth 1: re-center 1 | 0.0000 | none | 0.0000 | 0.0000 | none |
| graph / depth 1: re-center 2 | 0.0000 | none | 0.0000 | 0.0000 | none |
| graph / depth 2: re-center 1 | 0.0000 | none | 0.0000 | 0.1113 | none |
| graph / depth 2: re-center 2 | 0.0069 | `.pane-graph .graph-header`, `.pane-graph .graph-canvas`, `.pane-graph .graph-flow .react-flow__renderer` | 0.0000 | 0.0000 | none |
| graph / depth 3: re-center 1 | 0.0288 | none | 0.0000 | 0.0288 | none |
| graph / depth 3: re-center 2 | 0.0009 | none | 0.0000 | 0.0416 | none |
| graph / depth to 2 | 0.0000 | none | 0.0000 | 0.0000 | none |
| graph / depth to 3 | 0.0001 | none | 0.0000 | 0.0000 | none |
| graph / depth to 1 | 0.0002 | none | 0.0000 | 0.0000 | none |
| graph / ERD: domain to aggregate | 0.0318 | `.pane-model .model-canvas`, `.pane-model .erd-key` | 0.0000 | 0.0222 | none |
| graph / ERD: aggregate to entity | 0.1106 | `.pane-model .model-canvas`, `.pane-model .erd-key` | 0.0000 | 0.0000 | none |
| graph / ERD: Back to the domain | 0.0708 | `.pane-model .model-canvas`, `.pane-model .erd-key` | 0.0000 | 0.0000 | none |
| navigate / through the nav | 0.0001 | none | 0.0002 | 0.0000 | none |
| navigate / through a link | 0.0000 | none | 0.0000 | 0.0000 | none |
| navigate / graph click | 0.0000 | none | 0.0000 | 0.0000 | none |
| navigate / Back | 0.0000 | none | 0.0000 | 0.0000 | none |
| navigate / link from a scrolled page | 0.0000 | none | 0.0000 | 0.0222 | none |
| navigate / Back to the scrolled page | 0.0000 | none | 0.0000 | 0.0001 | none |
| navigate / quick find | 0.0000 | none | 0.0000 | 0.0000 | none |
| overlays / tooltip on hover | 0.0000 | none | 0.0000 | 0.0000 | none |
| overlays / tooltip moving to the next button | 0.0000 | none | 0.0000 | 0.0000 | none |
| overlays / quick find: open and type | 0.0000 | none | 0.0000 | 0.0000 | none |
| overlays / quick find: Escape | 0.0000 | none | 0.0000 | 0.0000 | none |
| overlays / palette: open and type | 0.0000 | none | 0.0000 | 0.0000 | none |
| overlays / shortcuts sheet: open and search | 0.0000 | none | 0.0000 | 0.0000 | none |
| panes / open Graph (Ctrl+2) | 0.0000 | none | 0.0000 | 0.0000 | none |
| panes / close Graph (Ctrl+2) | 0.0000 | none | 0.0000 | 0.0000 | none |
| panes / open Model (Ctrl+4) | 0.0000 | `.pane-model .react-flow__node` | 0.0000 | 0.0000 | none |
| panes / add Graph beside Model | 0.0000 | none | 0.0000 | 0.0000 | none |
| panes / close Wiki with two others open | 0.0000 | none | 0.0000 | 0.0000 | none |
| panes / maximize (Ctrl+3) | 0.0000 | none | 0.0000 | 0.0000 | none |
| panes / leave full screen (Escape) | 0.0000 | none | 0.0000 | 0.0000 | none |
| panes / hide the inspector | 0.0000 | none | 0.0000 | 0.0000 | none |
| panes / show the inspector | 0.0000 | none | 0.0000 | 0.0000 | none |
| reload / spec edited while scrolled | 0.0000 | none | 0.0000 | 0.0000 | none |
| reload / spec edited with the graph open | 0.0000 | none | 0.0000 | 0.0000 | none |
| resize / drag the nav gap | 0.0000 | none | 0.0000 | 0.0000 | none |
| resize / collapse the nav by drag | 0.0000 | none | 0.0000 | 0.0000 | none |
| resize / drag the pane gap | 0.0000 | none | 0.0000 | 0.0000 | none |
| resize / drag the inspector gap | 0.0000 | none | 0.0000 | 0.0000 | none |
| resize / collapse the inspector by drag | 0.0000 | none | 0.0000 | 0.0000 | none |
| theme / switch to Midnight | n/a | n/a | 0.0000 | 0.0000 | none |
| mobile / open and close the nav drawer | n/a | n/a | 0.0000 | 0.0000 | none |
| mobile / open and close quick find | n/a | n/a | 0.0000 | 0.0000 | none |
| mobile / open and close the inspector sheet | n/a | n/a | 0.0000 | 0.0000 | none |

## Phase 2 list (after briefs 41 and 52 merge)

1. Nav: keep what is in view when the nav opens the current record's folder (cause 1). This is the biggest item that remains.
2. Nav: reserve the space area and the rail's space slots on the first load (cause 1).
3. Page bar: keep the Model toggle's slot on every page (cause 5, `views/PageBar.tsx`).
4. Wiki pane: restore each history entry's scroll on Back and Forward, before paint (cause 6, `views/FocusPage.tsx`).
5. `scrollbar-gutter: stable` on the ten scroll boxes in `PHASE_2_SCROLL_BOXES`, then empty that list (cause 7).
6. Tabs: one width for the preview tab, so its close button stays put (cause 5).
7. Fonts: self-host and preload them, with `font-display: optional` or size-adjusted fallbacks (cause 8, `index.html` and the tokens; brief 49 has merged, but self-hosting means adding font files, which waits for approval).
8. Empty `DEFERRED` in `app/stability/measure.ts`, so the nav and the tab strip are held to the budget.
9. Long frames on reload and first load: measure against the built app first (cause 9).
10. Re-measure everything and update this file's before and after.
