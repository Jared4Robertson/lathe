# Conversion: LA-PLT Platform, and LA's patterns, standards and roles

The sorting sheet for brief 107, domain LA-PLT. It lists Platform's complete new spec, kind by kind in the plan's order ([domain-model-refinement.md](../plans/domain-model-refinement.md)), with each row's old source, then LA's product-level records this sheet owns: the roles, the two patterns and their rules with the pattern rule tests that prove them, and the standard and its rules. It follows the Tool Library's sheet ([tool-library.md](tool-library.md)), shares its conventions with [la-chk.md](la-chk.md), [la-exp.md](la-exp.md) and [la-trc.md](la-trc.md), and closes with a table that accounts for every old record and link of these records.

It describes Platform as the plan makes it, not as it was. Every rewrite is listed under Judgment calls. Brief 111 applies this sheet together with the other domains' sheets.

## Conventions
- **Source** names the old record (`DR04`, `UC05-R02`, `C11` and so on, all `LA-PLT-` unless written in full) or the code (`app/src/…`, `desktop/src/…`, `lathe/src/…`).
- **IDs** are written short in tables; in full they start `LA-PLT-` (domain-scoped records) or `LA-` (product-scoped ones).
- **Product-scoped numbers are provisional.** Value objects, views, UI components and integrations draw from one product-wide series. As la-chk.md takes 41–49 and la-trc.md 51–59, this sheet takes **61–89** (`LA-VO61`, `LA-V61`, `LA-UI61`, `LA-INT61`). The apply step renumbers if blocks clash.
- **Other domains' views** are named by the IDs their sheets give them: from la-exp.md `LA-V01` Nav (with quick find), `LA-V03` Record page, `LA-V04` Graph view, `LA-V06` Side bar, `LA-V07` Focus page; from la-chk.md `LA-V41` Checks page.
- **Types** are the schema's basic types (text, whole number, decimal, date, time, date and time, yes/no), a value object (`VO61`…) or a reference to an aggregate (`→ A7`…).
- **Optional** marks a field with `required: false`; every other field is required.
- **New** marks a row with no old record. **Moved** marks a UC requirement that becomes a view requirement.
- **To resolve** marks a link to another domain's record by its old ID, for the apply step.

## Product, roles and domain

| ID | Kind | Title | Fields | Source |
| --- | --- | --- | --- | --- |
| LA | Product | Lathe | description and notes as today | product (this sheet changes nothing on it) |
| Agent | Role | Agent | | role |
| Owner | Role | Owner | | role |
| Reader | Role | Reader | | role |
| LA-PLT | Domain | Platform | subdomain type **supporting**; description and notes as today | domain |

There are no open questions: LA has no `question` rows today, and this sheet adds none.

## Domain model

### Aggregates

| ID | Title | Parent | Identity | Source |
| --- | --- | --- | --- | --- |
| A2 | Panel | LA-PLT | Which panel it is | A2, unchanged |
| A3 | Keymap | LA-PLT | Command ID | A3 "Command", retitled so no record is titled like the model's own Command kind (judgment call 6). Description: the keyboard commands with their bindings, which every key, the palette, the sheet and every hint read. |
| A4 | Appearance | LA-PLT | One per person | A4 "Theme", retitled: the person's themes, the theme chosen and the color mode (judgment call 7) |
| A6 | Product window | LA-PLT | Folder | A6, without the recent folders (now A9) |
| A7 | App server | LA-PLT | Folder and port | A7; its description gains `lathe serve`, which runs the same `serve()` (CMD17) |
| A8 | Command layer | LA-PLT | none: a write is the commit or the moment that changed the files | A8, unchanged |
| A9 | Recent folders | LA-PLT | One per shell | **New**: EN09 and DR31 move here from A6, since one list serves every window (judgment call 8) |
| A10 | Product repo | LA-PLT | Root folder | **New**: the repo `lathe init` sets up, whose config names its data folder (UC02-R01, R02) |

A1 Workspace becomes the read model RM01 (judgment call 1). A5 Control goes: nothing changes it and it has no commands; its rules become view requirements of the Workbench (judgment call 3).

### Entities

| ID | Title | Parent | Role | Has value objects | Source |
| --- | --- | --- | --- | --- | --- |
| EN02 | Panel | A2 | root | | EN02 |
| EN03 | Keyboard command | A3 | root | | EN03 "Command", retitled |
| EN04 | Key binding | A3 | child | VO61 Key binding | EN04 |
| EN06 | Theme | A4 | child | VO63 Theme file | EN06, now a child of the new root EN14 |
| EN08 | Product window | A6 | root | VO64 Window bounds, VO65 Window chrome | EN08 |
| EN09 | Recent folder | A9 | child | | EN09, moved from A6 (same domain, so its ID stays) |
| EN10 | App server | A7 | root | | EN10 |
| EN11 | Write | A8 | root | (none: no stored fields) | EN11 |
| EN12 | Write command | A8 | child | | EN12 "Command", retitled |
| EN13 | Refusal | A8 | child | | EN13 |
| EN14 | Appearance | A4 | root | | **New** |
| EN15 | Recent folders | A9 | root | (none: the list is its children) | **New** |
| EN16 | Product repo | A10 | root | | **New** |

None has a table: Platform's state lives in local storage, the shell's JSON files and memory, not in a database (judgment call 19). The `has_many` links EN03→EN04, EN11→EN12 and EN11→EN13 stay; EN08→EN09 becomes EN15→EN09; EN03→EN05 goes with EN05.

### Entity fields

| Entity | # | Name | Type | Meaning | Example | Source |
| --- | --- | --- | --- | --- | --- | --- |
| EN02 | 1 | Panel | text | Which part of the page it is: the navigation, the wiki, graph or model pane, or the side bar. | Side bar | EN02 field 1 |
| EN02 | 2 | Shown | yes/no | Whether it is on screen; a hidden panel keeps a control that brings it back. | yes | field 2 |
| EN02 | 3 | Size | decimal | Its width in pixels (the navigation, the side bar), or a pane's share of the panes' width, within its limits. | 340 | **New**: UC06-R01, R02; `usePanelSize` |
| EN03 | 1 | Command ID | text | The command's name in the keymap, unique. | commandPalette | EN03 field 1 |
| EN03 | 2 | Title | text | What it does, as the palette and the shortcuts sheet show it. | Command palette | field 2 |
| EN03 | 3 | Group | text | Where the shortcuts sheet lists it: Navigate, View, Graph or Lists. | Navigate | field 3 |
| EN03 | 4 | Context | text | Where it applies: anywhere, on a page, while the graph shows, or in a list. | Anywhere | field 4 |
| EN03 | 5 | Handled by | text | Who acts on its keys: the app, the component it belongs to, or the browser. | The app | field 5 |
| EN04 | 1 | Keys | VO61 Key binding | The chord, or chords in sequence, as the keymap writes them. | Mod+Shift+P | EN04 field 1 |
| EN04 | 2 | Off a Mac | VO61 Key binding, optional | Its keys on other platforms, where they differ. | Alt+G | **New**: `Command.otherKeys` |
| EN04 | 3 | Override | VO61 Key binding, optional | The person's own binding in its place. | | field 2 |
| EN14 | 1 | Chosen theme | text | The theme in use, by its ID; Lathe when it is gone (INV04). | workshop | **New**: A4's description; `ThemeState.chosen` |
| EN14 | 2 | Color mode | text | System (the default, following the system), Light or Dark. | system | **New**: EV02's Mode; `ThemeState.mode` |
| EN06 | 1 | Theme ID | text | A built-in's name, or `custom-` and a name for one of the person's own. | custom-workshop-copy | **New**: `Theme.id` |
| EN06 | 2 | File | VO63 Theme file | The theme itself: its name, its light and dark colors and its shared tokens. | | EN06 fields 1, 3 and 4 |
| EN06 | 3 | Built in | yes/no | Whether Lathe ships it, so it is never changed (INV03). | no | field 2 |
| EN06 | 4 | Based on | text, optional | The built-in theme a copy was made from, which Reset puts back. | workshop | **New**: `Theme.basedOn` |
| EN08 | 1 | Folder | text | The product folder it shows. | ~/Development/tool-library | EN08 field 1 |
| EN08 | 2 | Bounds | VO64 Window bounds | Its saved size and place, and whether it was maximized or full screen. | 120, 80, 1280, 840 | field 2 |
| EN08 | 3 | Server | → A7 App server | Where it loads Lathe from. | | field 3 |
| EN08 | 4 | Chrome | VO65 Window chrome, optional | The colors its own page last sent for its background and window controls. | #f4f1ea, #1d1b16 | **New**: DR36 |
| EN08 | 5 | Error count | whole number, optional | The check errors its page last reported, for the Dock badge. | 3 | **New**: DR37 |
| EN09 | 1 | Folder | text | The folder. | ~/Development/tool-library | EN09 field 1 |
| EN09 | 2 | Opened | date and time | When it was last opened, which orders the list. Not stored by the code (see findings). | 2026-10-25T09:14:00Z | field 2 |
| EN10 | 1 | Source | text | Which server it is: `serve()` in the shell or from `lathe serve`, a Vite dev server the shell starts, or the shared 5199 dev server. | serve() | EN10 field 1 |
| EN10 | 2 | Folder | text | The product folder it reads. | ~/Development/tool-library | field 2 |
| EN10 | 3 | Port | whole number | Where it answers; never 5199 for one the shell starts (INV06). | 61234 | field 3 |
| EN12 | 1 | Operation | text | What the command does: add, set, move, link, unlink or remove. | set | EN12 field 1 |
| EN12 | 2 | Target | text | The row it acts on: a table and a key, a record ID, or a relation and its two ends. | use_case LA-PLT-UC02 | field 2 |
| EN12 | 3 | Values | text, optional | The columns it sets or clears, or the record's new parent for a move. | goal: "Lathe is installed…" | field 3 |
| EN13 | 1 | Rule | text | The constraint or validation query the data broke. | foreign-key | EN13 field 1 |
| EN13 | 2 | Message | text | What is wrong, naming the table, row and value. | view TL-V02: … names no domain | field 2 |
| EN13 | 3 | Where | text | The data file and line of a loaded row, or the index of the command that brought it. | command 2 | field 3 |
| EN16 | 1 | Root folder | text | The product repo's folder. | ~/Development/tool-library | **New**: UC02 |
| EN16 | 2 | Data folder | text | Where its data files are, as `lathe.config.json`'s `data` names it; `data` unless set. | data | **New**: UC02-R02; EN01 field 1 |

Fields that leave the entities, because they are derived or belong elsewhere:

| Old field | Goes to |
| --- | --- |
| EN01 Data folder, Refusals, Errors | RM01 Workspace's fields (and EN16's Data folder) |
| EN04 On a Mac, Elsewhere, ARIA name (derived) | DS01 Key display, and RM02 Keymap's Shown keys and ARIA keys |
| EN05 Where, Shows (derived) | RM02 Keymap: every hint is a row of it, read where it shows |
| EN06 Name, Light and dark tokens, Shared tokens | VO63 Theme file's fields, the shape the code stores and exports |
| EN07 Role, Name, Target, Keys | dropped with A5; the rules on them are LA-V61-R44 to R47 |
| EN11 Commands | the `has_many` EN11→EN12: a write's commands are its children |
| EN11 Tables changed, Files rewritten (derived) | EV06 Data written's fields |

### Value objects and constraints

| ID | Kind | Title | Parent | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| LA-VO61 | Value object | Key binding | (used by EN04) | A chord such as Mod+Shift+P, or chords separated by spaces for a sequence. "Mod" is Cmd on a Mac and Ctrl elsewhere. | **New**: EN04 field 1's type |
| LA-VO61-C01 | Constraint | A binding is written as chords the keymap reads | VO61 | A binding MUST be one chord, or chords separated by spaces, each its modifiers then one key joined by `+`, and is kept in the keymap's normal form. | **New**: EN04 field 1's type, UC04-R01's "Mod" |
| LA-VO61-C02 | Constraint | A binding never takes a browser's essential key | VO61 | No binding, default or overridden, MAY take Cmd/Ctrl+W, T, L, R, N or Q, Tab, F5 or F11, or a key reserved for the browser on the current platform (Ctrl+G off a Mac). | DR06's first clause, UC04-R07's last sentence |
| LA-VO62 | Value object | Token values | (used by VO63) | A map from token names in the app's token table to values. | **New**: EN06 fields 3 and 4's types |
| LA-VO62-C01 | Constraint | Token values name known tokens, each with a value of its kind | VO62 | Token values MUST name only tokens of the app's token table, each with a value that is exactly a value of its kind, and MUST NOT carry selectors, rules or any other text. | DR11 |
| LA-VO63 | Value object | Theme file | (used by EN06) | A theme as data, as it is stored, exported and imported. Fields: Format (text), Version (whole number), Name (text), Light (VO62), Dark (VO62), Tokens (VO62). | **New**: EN06's fields; `ThemeFile` |
| LA-VO63-C01 | Constraint | A theme file says its format and version and holds known fields only | VO63 | A theme file MUST be JSON with `format` "lathe-theme", `version` 1, a `name` of 1 to 60 characters, and `light`, `dark` and `tokens` objects. A file with any other field MUST be refused with a message saying why. | DR13's first two sentences (its third goes to INV02) |
| LA-VO64 | Value object | Window bounds | (used by EN08) | Where a window was and how big. Fields: X, Y, Width, Height (whole numbers, screen points), Maximized, Full screen (yes/no). | **New**: EN08 field 2's type, EV05's Bounds |
| LA-VO65 | Value object | Window chrome | (used by EN08) | The two colors a page sends for its window. Fields: Background, Foreground (text). | **New**: DR36 |
| LA-VO65-C01 | Constraint | Window chrome is exactly two opaque hex colors | VO65 | Window chrome MUST be exactly `{ background, foreground }`, each an opaque hex color (`#rgb` or `#rrggbb`); anything else is refused and changes nothing. | DR36 (its "only from the window's own page" goes to CMD13) |

### Invariants

| ID | Title | Parent | Statement | Enforced by | Source |
| --- | --- | --- | --- | --- | --- |
| INV01 | A key binding means one command wherever it applies | A3 | No two commands MAY share a binding in contexts that can be active at the same time, and no two-key sequence MAY start with a key that is a binding of its own. | `duplicateBindings`, checked by its test | DR04 |
| INV02 | Every theme has a light set and a dark set | A4 | Every theme MUST set the core colors (shell, paper, sheet, ink, muted, rule, the accent and its tint, spark and its tint, and warning) in both its light and dark sets. Core colors a file leaves out are taken from Lathe; the other colors follow a core one or serve both modes unless the theme sets them. | `parseTheme` completes a file from Lathe | DR12, DR13's third sentence |
| INV03 | Built-in themes are never changed | A4 | A built-in theme MUST NOT be edited, renamed or deleted; it is changed by editing a copy. Reset puts a copy back to the built-in it was copied from, keeping its name. | CMD07, CMD08 and CMD09 act only on the person's own themes | DR14 |
| INV04 | The chosen theme always exists | A4 | When the chosen theme no longer exists (deleted, or its stored data no longer reads), Lathe MUST be shown and chosen. | `ThemeProvider`'s `active`; `themeStore` drops themes that no longer read | DR15 |
| INV05 | Each folder has one window | A6 | No two product windows MAY show the same folder, however its path is spelled; opening a folder that has a window brings that window forward. | CMD10 looks for the folder's window first | DR27 |
| INV06 | A server the shell starts never listens on 5199 | A7 | Every server the shell starts MUST listen on a free local port other than 5199, the Owner's own dev server, which the shell may only share (SP02). | `freePort` | DR33 |
| INV07 | A write is all or nothing | A8 | A write's commands MUST all take effect or none: when one is refused, the data and every data file stay as they were. | CMD18's one transaction | DR41 |
| INV08 | A write is checked whole before any file changes | A8 | Each write MUST build the new state in one transaction, with every key, constraint and validation query of the schema, and MUST rewrite a data file only after the whole state passes. | CMD18 | DR42 |
| INV09 | A write rewrites only its tables' files, in one fixed form | A8 | A write MUST rewrite only the data files of the tables it changed, each through a temporary file and a rename, rows sorted by key and columns in the table's order, so the same data always gives the same file and a changed row is a one-line diff. | A8-REPO | DR43 |
| INV10 | Writes run one after another | A8 | Writes to one store MUST run one at a time, each on the state the one before it left, so two writers never lose each other's change. | the store's write queue | DR44 |
| INV11 | A refusal names every problem and where it is | A8 | A refused write or load MUST name every problem it found, each with its rule, a message naming the table, row and value, and the data file and line of a loaded row or the index of the command that brought it. | `StoreError` | DR45 |
| INV12 | A record changes parent only by a move, which carries what sits inside | A8 | `set` MUST NOT change a row's key or a record's parent columns. `move` MUST give the record its new parent's column and clear the other, and the records inside it keep their parents and take the new scope. | CMD18 | DR46, rewritten for the store's `move` (no derived parent columns are filled today) |
| INV13 | A removal takes its parts and links, and is refused while referenced | A8 | Removing a record MUST take its part rows and the links it starts, and MUST be refused, naming up to 20 referrers, while anything else still references it. | CMD18 | DR47 |
| INV14 | Recent folders are listed latest first, each once, at most 10 | A9 | The recent folders MUST list the folder opened last first, each folder once (opening one again moves it to the top), and at most 10, dropping the oldest. | `addRecent`, `parseRecent` | DR31 |

### Specifications

| ID | Title | Reads | Statement | Source |
| --- | --- | --- | --- | --- |
| SP01 | Folder is a product folder | A10 | A folder is a product folder when it holds a `lathe.config.json` that is valid JSON (whose `data` names the data folder, `data` by default), or else a `data/` folder. Any other folder is refused with a message that says what is missing. | DR26 |
| SP02 | The shared dev server serves the folder | A7 | The Owner's dev server on port 5199 serves a folder when it answers `GET /api/spec` and names that folder as its product folder in `x-lathe-root`; a server without the header is taken to read the repo the shell runs from. | DR34 |

### Domain events

| ID | Title | Parent | Raised by | Published | Source |
| --- | --- | --- | --- | --- | --- |
| EV01 | Theme chosen | A4 | CMD03 | no | EV01 |
| EV02 | Color mode chosen | A4 | CMD04 | no | EV02 |
| EV03 | Theme made | A4 | CMD05, CMD06 | no | EV03 |
| EV04 | Product window opened | A6 | CMD10 | no | EV04 |
| EV05 | Product window closed | A6 | CMD11 | no | EV05 |
| EV06 | Data written | A8 | CMD18 | **yes** | **New**: EN11's derived fields; what every reader of the data hears (judgment call 2) |

### Event fields

| Event | # | Name | Type | Source |
| --- | --- | --- | --- | --- |
| EV01 | 1 | Theme | text | EV01 field 1 |
| EV01 | 2 | Previous theme | text | field 2 |
| EV01 | 3 | Chosen at | date and time | field 3 |
| EV02 | 1 | Mode | text | EV02 field 1 |
| EV02 | 2 | Previous mode | text | field 2 |
| EV02 | 3 | Chosen at | date and time | field 3 |
| EV03 | 1 | Theme | text | EV03 field 1 |
| EV03 | 2 | Made from | text | field 2 |
| EV03 | 3 | Made at | date and time | field 3 |
| EV04 | 1 | Folder | text | EV04 field 1 |
| EV04 | 2 | Products | text | field 2 |
| EV04 | 3 | Opened at | date and time | field 3 |
| EV05 | 1 | Folder | text | EV05 field 1 |
| EV05 | 2 | Bounds | VO64 Window bounds | field 2 |
| EV05 | 3 | Closed at | date and time | field 3 |
| EV06 | 1 | Tables changed | text | **New**: EN11 field 2 |
| EV06 | 2 | Files rewritten | text | **New**: EN11 field 3 |

Meanings and examples carry over unchanged; EV06's come from EN11's.

### Commands

Each command changes one aggregate. Found in the code.

| ID | Title | Parent | Raises | Checks | Uses | Source |
| --- | --- | --- | --- | --- | --- | --- |
| CMD01 | Resize a panel | A2 | | | | `usePanelSize` and `ResizeHandle`; UC06. Description: by drag or keys, within the panel's limits; a double-click resets it; a drag below the fold threshold hides it instead (CMD02). |
| CMD02 | Show or hide a panel | A2 | | | | `toggleNav`, `toggleSideBar`, the view toggles and full screen; UC04, UC06, UC13, UC14 |
| CMD03 | Choose a theme | A4 | EV01 | | | `ThemesApi.choose`; UC07 |
| CMD04 | Choose a color mode | A4 | EV02 | | | `ThemesApi.setMode`; UC07 |
| CMD05 | Duplicate a theme | A4 | EV03 | | | `ThemesApi.duplicate`; UC07 |
| CMD06 | Import a theme file | A4 | EV03 | | | `ThemesApi.importFile`; UC07 |
| CMD07 | Edit a theme | A4 | | | DS02 | `ThemesApi.update` (its tokens or its name); UC07 |
| CMD08 | Reset a theme | A4 | | | | `ThemesApi.reset`; UC07 |
| CMD09 | Delete a theme | A4 | | | | `ThemesApi.remove`; UC07 |
| CMD10 | Open a product folder | A6 | EV04 | SP01, and INV05 | DS03, DS04 | `openFolder`; UC11, UC15 |
| CMD11 | Close a product window | A6 | EV05 | | | the window's close handler in `main.ts`; UC11 |
| CMD12 | Save a window's place | A6 | | | | `saveBounds`; DR28's first sentence: its size, place, and maximized or full screen are saved as it moves, resizes, enters or leaves full screen and closes |
| CMD13 | Set a window's chrome | A6 | | | | `applyChrome`, from `setChrome`; UC14-R06. Description keeps DR36's "only from the window's own page". |
| CMD14 | Report a window's error count | A6 | | | | `setErrorCount` and the `lathe:error-count` handler; the count Checking's badge query reads (to resolve, `LA-CHK-QRY03`) |
| CMD15 | Start a window's app server | A7 | | SP02, and INV06 | | `startServe`, `startDev`, `chooseDevSource`; UC11, UC12 |
| CMD16 | Stop a window's app server | A7 | | | | each server's `stop`; DR35 |
| CMD17 | Serve a product repo | A7 | | | | `serve()` and `lathe serve`; UC02-R04 |
| CMD18 | Apply a write | A8 | EV06 | (INV07 to INV13) | | `Store.apply`, and `add`, `set`, `move`, `link`, `unlink` and `remove` as writes of one command; UC16. Every writer's change goes through it: the CLI, the MCP tools and `POST /api/write`. |
| CMD19 | Add a recent folder | A9 | | (INV14) | | `addRecent`, `rememberRecent`; UC11 |
| CMD20 | Clear the recent folders | A9 | | | | Open Recent › Clear Menu (`clearRecent`); UC11 |
| CMD21 | Set up a product repo | A10 | | | | `lathe init`; UC02-R01. A recorded exception (`command_change`): it also changes A8, adding the product's first record through the command layer, because a repo must never be left set up without its product. |

### Read models and fields

| ID | Title | Parent | Reads | Source |
| --- | --- | --- | --- | --- |
| RM01 | Workspace | LA-PLT | (none of Platform's: see below) | A1 and EN01 (judgment call 1); `Workspace` in `lathe/src/types.ts` |
| RM02 | Keymap | LA-PLT | A3 | **New** as a kind: EN05 Hint and EN04's derived fields; `resolveCommands` |
| RM03 | Themes | LA-PLT | A4 | **New** as a kind: the Appearance page's list and the theme picker |
| RM04 | Recent folders | LA-PLT | A9 | **New** as a kind: File › Open Recent and the Dock menu |

RM01 holds every product's records, which are other domains' aggregates: it is filled from their data files whenever they change, so it depends on Authoring's Record changed and Schema changed and Checking's Check changed (`LA-AUT-EV01`, `LA-AUT-EV03`, to resolve, and `LA-CHK-EV01`, which la-chk.md publishes for this reason), and on Platform's own EV06. Those events must be published for a Platform read model to use them (cross-domain item 1).

| Read model | # | Name | Type | Meaning | Source |
| --- | --- | --- | --- | --- | --- |
| RM01 | 1 | Data folder | text | Where the product's data files were read from, as `lathe.config.json` names it. | EN01 field 1 |
| RM01 | 2 | Records | text | Every record with its kind, columns, part rows, parent, product and domain. | **New**: A1's description; `Workspace.records` |
| RM01 | 3 | Links | text | Every link, with its relation and both ends. | **New**: A1's description |
| RM01 | 4 | Problems | text | Every problem: its severity, check, record and message (Checking's RM01 Problems). | **New**: A1's description |
| RM01 | 5 | Coverage | text | Per domain and obligation kind: designed, built, proved and the gaps (Traceability's). | **New**: A1's description |
| RM01 | 6 | Refusals | text, optional | The rows the store refused on load, each with its file, line and rule; while there are any, nothing else is checked. | EN01 field 2 |
| RM01 | 7 | Errors | whole number | How many problems are errors. | EN01 field 3 |
| RM02 | 1 | Command ID | text | The command. | EN03 field 1 |
| RM02 | 2 | Title | text | What the palette and the sheet call it, or the title its handler gives ("Switch to Lathe"). | EN03 field 2 |
| RM02 | 3 | Group | text | Where the sheet lists it. | EN03 field 3 |
| RM02 | 4 | Shown keys | text, optional | Its bindings with the person's overrides, as the platform shows them (DS01). | EN04 fields 3 and 4, EN05 field 2 |
| RM02 | 5 | ARIA keys | text, optional | What `aria-keyshortcuts` says; none for a sequence. | EN04 field 5 |
| RM03 | 1 | Theme ID | text | The theme. | EN06 |
| RM03 | 2 | Name | text | What it is called. | EN06 field 1 |
| RM03 | 3 | Built in | yes/no | Whether Lathe ships it. | EN06 field 2 |
| RM03 | 4 | In use | yes/no | Whether it is the chosen theme. | **New** |
| RM03 | 5 | Color mode | text | The mode in use. | **New** |
| RM04 | 1 | Folder | text | A recent folder, latest first. | **New**: EN09 |
| RM04 | 2 | Shown as | text | The folder with the home folder as `~`. | **New**: `displayPath` |

### Queries

| ID | Title | Parent | Selects by | Uses | Source |
| --- | --- | --- | --- | --- | --- |
| QRY01 | Load the workspace | RM01 | | | `loadWorkspace(root)`; UC01 |
| QRY02 | Get the product's data | RM01 | | | `GET /api/spec`'s `SpecData`; UC03, E01 |
| QRY03 | List the commands | RM02 | | DS01 | `resolveCommands`; the palette, the sheet and every hint; UC04, UC05 |
| QRY04 | List the themes | RM03 | | | `ThemesApi.themes`, `active`; UC07 |
| QRY05 | Export a theme file | RM03 | | | `ThemesApi.exportFile`; UC07 |
| QRY06 | List the recent folders | RM04 | | | Open Recent's items in `refreshMenu`; UC11 |

The Dock badge's query is Checking's (`LA-CHK-QRY03` Show the Dock badge, `badgeFor` and `badgeText`, to resolve); CMD14 keeps the count it reads.

### Policies

| ID | Title | Parent (the command it invokes) | Hears | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| PO01 | An opened window gets its app server | CMD15 | EV04 | Whenever a product window opens, start the server it loads Lathe from, as SP02 decides. | reacts_to A6→EV04, A7→EV04; `startApp` |
| PO02 | A closed window's server stops | CMD16 | EV05 | Whenever a product window closes, or the shell quits (also when it is stopped from a terminal), stop the server the shell started for it. | DR35; reacts_to A7→EV05, C40→EV05 |
| PO03 | An opened folder goes to the top of the recent folders | CMD19 | EV04 | Whenever a product window opens, add its folder to the recent folders, and to the system's recent documents. | reacts_to C41→EV04; UC15-R04's second clause; `rememberRecent` |

### Domain services

| ID | Title | Parent | Used by | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| DS01 | Key display | LA-PLT | QRY03 | Shows a binding as the platform shows it: on a Mac as the symbols ⌃ ⌥ ⇧ ⌘ in Apple's order ("⇧⌘P"), elsewhere as words joined by + ("Ctrl+Shift+P"). Names each single-chord binding for `aria-keyshortcuts` with the DOM's modifier names ("Control+Shift+P"), and leaves out a sequence, which it cannot express. | DR08, DR09; `formatBinding`, `ariaKeyShortcuts` |
| DS02 | Contrast audit | LA-PLT | CMD07 | Works out the WCAG contrast of each text and control token on what it is drawn on, for a theme in a mode, and which pairs fall below AA (4.5:1 for text, 3:1 for large text and controls). | **New** as a kind: C26; `auditContrast` |
| DS03 | Window placement | LA-PLT | CMD10 | Places a window at its saved bounds; a saved place that is no longer on a connected screen gives way to a centered window, and a size larger than the largest screen shrinks to fit it, never below the minimum size. | DR28's second sentence; `windowFor` |
| DS04 | Folder to open at launch | LA-PLT | CMD10 | On launch, opens a folder named on the command line (unpacked or packed) or dropped on the Dock icon; else the most recent folder that still opens; else, run from Lathe's own repo, that repo; else asks for a folder. | DR32; `openOnLaunch`, and `instance.ts`'s reading of a command line |

### Terms

All **new**: Platform had no Language table.

| ID | Term | Meaning |
| --- | --- | --- |
| TM01 | Workbench | The wide-screen layout: panels a gap apart on the shell, every gap a resize handle. |
| TM02 | Panel | A part of the workbench a person shows, hides and resizes: the navigation, a pane or the side bar. |
| TM03 | Pane | One view of the page (Wiki, Graph or Model), side by side with the others. |
| TM04 | Keymap | The one table of keyboard commands and their bindings, which every key, the palette, the sheet and every hint read. |
| TM05 | Theme | A named set of token values with a light set and a dark set. |
| TM06 | Color mode | System, Light or Dark: which of every theme's two sets shows. |
| TM07 | Product folder | A folder with a `lathe.config.json` or a `data/` folder, which Lathe opens. |
| TM08 | Product window | One desktop window showing one product folder. |
| TM09 | App server | What a window or `lathe serve` serves Lathe from. |
| TM10 | Command layer | The one path every change to the data goes through. |
| TM11 | Write | One or more commands to the data, all taking effect or none. |
| TM12 | Refusal | One reason the store refused a write or a load: the rule broken and where. |

## Use cases

### Capabilities

CAP01 The workbench, CAP02 Commands and shortcuts, CAP03 Serving, writing and live reload, and CAP04 The desktop app carry over unchanged.

### Use cases

All sixteen carry over with their titles, capabilities, goals, actors and notes: UC01 (Agent), UC02 (Owner, Agent), UC03 to UC11 (Reader), UC12 (Owner), UC13, UC14 (Reader), UC15 (Owner), UC16 (Agent, Owner). UC08's and UC10's goals keep their links to `notes/mobile-design.md` and `notes/a11y-audit.md`. Platform's two `follows` links stay.

### UC requirements

A UC requirement stays one when it says what the system does for its actor, proved by an api, e2e or manual test. One that says what a screen shows or how it answers the person's hand **moves** to the view it is about, where unit tests may prove it (judgment call 4, as la-trc.md's judgment call 6). The Reader use cases UC04 to UC10 and UC14 keep their goals and flows with no UC requirements of their own, so `use-case-without-requirements` will warn on each, as on Traceability's.

**Kept (22), unchanged unless written:**

| ID | Title | Change |
| --- | --- | --- |
| UC01-R01, R02 | | unchanged |
| UC01-R03 | Loading is fast enough to reload live | DR02's detail added: on the dev machine, as `npm --prefix lathe run test:perf` measures; every check still runs on every load; a busy machine (a one-minute load average above 12) is measured but not judged, and a budget is never loosened. Its mention of `LA-PLT-DR02` goes. |
| UC02-R01 to R05 | | unchanged |
| UC03-R01 | Pages reload when the data files or Lathe's checks change | unchanged; its page side is also LA-V61-R01, which unit tests prove |
| UC11-R01, R02, R04 | | unchanged |
| UC12-R01 to R05 | | unchanged |
| UC13-R03 | The app can tell it runs in the desktop app | unchanged |
| UC15-R09, R12 | | unchanged |
| UC16-R01, R02 | | unchanged |

**New (5):**

| ID | Title | Statement | Source |
| --- | --- | --- | --- |
| UC01-R04 | Each load reads the data files afresh and writes nothing | DR01's statement. | DR01 |
| UC11-R05 | The page reaches the shell only through window.latheDesktop | DR29's statement. | DR29 |
| UC11-R06 | Links that leave the app open in the system browser | DR30's statement. | DR30 |
| UC15-R15 | macOS keeps no window state for Lathe | DR40's statement. | DR40 |
| UC15-R16 | A record action names only a record ID, and the shell finds its data file | DR38's statement. | DR38 |

**Moved (63)** to view requirements, listed under Views and view requirements: UC04-R01 to R07, UC05-R01 to R04, UC06-R01 to R03, UC07-R01 to R07, UC08-R01 to R10, UC09-R01 to R11, UC10-R01 to R04, UC11-R03, UC13-R01, R02, R04, UC14-R01 to R07, UC15-R01, R04, R05, R06, R10, R11.

UC15's numbers R02, R03, R07 and R08 stay unused, as today.

## Interaction design

### Flows

One per use case, belonging only to it. Old F01 covered UC01 and UC02 and splits; F05 covered four use cases and splits; UC03 was carried out by `LA-CHK-F03` and UC04, UC06, UC09 and UC10 by `LA-EXP-F02`, which now each have a flow of their own.

| ID | Title | Parent | Source |
| --- | --- | --- | --- |
| UC01-FL | Load the workspace in code | UC01 | F01 step 3 |
| UC02-FL | Start using Lathe in a product | UC02 | F01 steps 1 and 2, and UC02's use case steps 1 to 3 |
| UC03-FL | See the data files change on the page | UC03 | **New**; replaces `LA-CHK-F03` carries_out UC03 |
| UC04-FL | Work the app from the keyboard | UC04 | **New**; replaces `LA-EXP-F02` carries_out UC04 |
| UC05-FL | Learn a shortcut from where it is used | UC05 | F02 and its four steps |
| UC06-FL | Arrange the workbench | UC06 | **New**; replaces `LA-EXP-F02` carries_out UC06 |
| UC07-FL | Choose and make a theme | UC07 | F03 (its description becomes the steps) |
| UC08-FL | Read Lathe on a phone | UC08 | F04, likewise |
| UC09-FL | Read and move around without anything jumping | UC09 | **New**; replaces `LA-EXP-F02` carries_out UC09 |
| UC10-FL | Use Lathe by keyboard and screen reader | UC10 | **New**; replaces `LA-EXP-F02` carries_out UC10 |
| UC11-FL | Open a product in a window | UC11 | F05 step 1 |
| UC12-FL | Change Lathe and see the desktop app reload | UC12 | F06 |
| UC13-FL | Work from the native menus | UC13 | F05 step 3 |
| UC14-FL | Work under Lathe's own title bar | UC14 | F05 step 2 |
| UC15-FL | Keep Lathe in the Dock | UC15 | F05 steps 3 and 4 |
| UC16-FL | Change the data through any writer | UC16 | F07 |

### Flow steps

Each step invokes at most one command or query and happens in at most one view. Step IDs are written short; in full they are `LA-PLT-UC01-FL-S01` and so on.

| ID | Path | Title | Invokes | In view | Fulfills | Source |
| --- | --- | --- | --- | --- | --- | --- |
| UC01-FL-S01 | main | The Agent's script calls `loadWorkspace(root)` and reads the records, links, problems and coverage | QRY01 | | UC01-R01, UC01-R04 | F01 step 3 |
| UC01-FL-S02 | refused | Data the store refuses ends the load with one `data-refused` error per refusal and no records | QRY01 | | UC01-R02 | UC01-R02 |
| UC01-FL-S03 | main | After a write, the script loads again within the budgets | QRY01 | | UC01-R03 | UC01-R03 |
| UC02-FL-S01 | main | The Owner installs the package and runs `lathe init` with the product's name and prefix | CMD21 | | UC02-R01 | F01 step 1; UC02 step 1 |
| UC02-FL-S02 | main | They set up the merge driver for the data files once per clone, as the README says | | | UC02-R05 | F01 step 1; UC02 step 1 |
| UC02-FL-S03 | main | They add the first domain and records with `lathe add`, or an Agent through the MCP tools, in the data folder the config names, with any kinds of the product's own | CMD18 | | UC02-R02, UC02-R03 | F01 step 2; UC02 step 2 |
| UC02-FL-S04 | main | They run `lathe serve` to browse and edit the spec, with no build tools in the repo | CMD17 | LA-V03 | UC02-R04 | F01 step 2; UC02 step 3 |
| UC03-FL-S01 | main | An Agent changes records through the command layer while the Reader keeps the page open | CMD18 | | | UC03's goal |
| UC03-FL-S02 | main | The server sends `spec:changed` and the open page loads the data again at the same address | QRY02 | LA-V03 | UC03-R01 | UC03-R01; `LA-CHK-F03` fulfills UC03-R01 |
| UC03-FL-S03 | refused | When the data cannot be loaded, the page says what is wrong rather than showing other data | QRY02 | LA-V03 | | UC03's goal; E01-R01 |
| UC04-FL-S01 | main | The Reader presses Cmd/Ctrl+Shift+P; the palette lists the commands that apply, from the one keymap, each with its keys for the platform | QRY03 | LA-V64 | | UC04's goal |
| UC04-FL-S02 | main | They run commands by their VS Code keys, such as Cmd/Ctrl+B to hide the navigation | CMD02 | LA-V61 | | UC04-R02 |
| UC04-FL-S03 | main | A screen reader hears what the command changed | | LA-V61 | | UC04-R06 |
| UC04-FL-S04 | typing | While they type in a search box, single-key shortcuts don't fire, and keys the app doesn't handle reach the browser | | LA-V01 | | UC04-R03 |
| UC04-FL-S05 | main | They press `?`; the shortcuts sheet lists every shortcut by group, with a search and how to override a binding | QRY03 | LA-V65 | | UC04-R04, R05 |
| UC05-FL-S01 | main | The Reader rests on a control and its tooltip names its keys | QRY03 | LA-V61 | | F02-S01 |
| UC05-FL-S02 | main | They open the palette and read each command's keys | QRY03 | LA-V64 | | F02-S02 |
| UC05-FL-S03 | main | A screen reader hears the keys | QRY03 | LA-V61 | | F02-S03 |
| UC05-FL-S04 | main | They rebind a key and every hint follows, the shortcuts sheet with them | QRY03 | LA-V65 | | F02-S04 |
| UC06-FL-S01 | main | The Reader drags the gap between two panels, or focuses it and steps it with the keys | CMD01 | LA-V61 | | UC06's goal |
| UC06-FL-S02 | main | Lathe remembers the sizes; a double-click resets one | CMD01 | LA-V61 | | UC06-R02 |
| UC06-FL-S03 | main | Dragging the navigation or the side bar small folds it away | CMD02 | LA-V61 | | UC06-R03 |
| UC06-FL-S04 | main | They hide the side bar; the main view takes its room and the toggle brings it back | CMD02 | LA-V61 | | DR03 |
| UC07-FL-S01 | main | The Reader presses g then t and arrows through the themes, each shown on the whole app at once | QRY04 | LA-V63 | | F03 |
| UC07-FL-S02 | main | They keep one with Enter, or put back the one before with Escape | CMD03 | LA-V63 | | F03 |
| UC07-FL-S03 | main | They switch Light, Dark or System from the palette | CMD04 | LA-V63 | | F03 |
| UC07-FL-S04 | main | They open Appearance from the nav's footer: every theme with a preview | QRY04 | LA-V62 | | F03 |
| UC07-FL-S05 | main | They duplicate the closest theme | CMD05 | LA-V62 | | F03 |
| UC07-FL-S06 | main | They change its colors, fonts and density with the app changing around them, and a warning wherever text gets hard to read | CMD07 | LA-V62 | | F03 |
| UC07-FL-S07 | alternate | They reset their copy to the theme it came from | CMD08 | LA-V62 | | UC07-R04 |
| UC07-FL-S08 | alternate | They delete their copy, after being asked | CMD09 | LA-V62 | | UC07-R04 |
| UC07-FL-S09 | main | They export it to share as a file | QRY05 | LA-V62 | | F03 |
| UC07-FL-S10 | alternate | Someone else imports that file as a theme of their own | CMD06 | LA-V62 | | UC07-R06 |
| UC08-FL-S01 | main | On a phone the Reader opens Lathe: a compact top bar, the page filling the screen, text they can read | QRY02 | LA-V61 | | F04 |
| UC08-FL-S02 | main | They tap search in the top bar, type a use case's ID and tap the result | | LA-V01 | | F04 |
| UC08-FL-S03 | main | The wiki fills the screen; they tap Graph in the page bar | | LA-V07 | | F04 |
| UC08-FL-S04 | main | They pinch out, tap a node to see its name, and tap Open | | LA-V04 | | F04 |
| UC08-FL-S05 | main | They pull up the side bar sheet, drag it to full height, then swipe it away | CMD02 | LA-V06 | | F04 |
| UC08-FL-S06 | main | They open the nav sheet from the menu button and choose the domain | CMD02 | LA-V01 | | F04 |
| UC08-FL-S07 | main | The Open pages sheet takes them back to the use case they started from | | LA-V07 | | F04 |
| UC08-FL-S08 | tablet | On a tablet in landscape they keep the workbench, with targets sized for a finger | | LA-V61 | | UC08's goal |
| UC09-FL-S01 | main | The Reader opens a page; nothing drawn moves as the specs and fonts arrive | QRY02 | LA-V61 | | UC09's goal |
| UC09-FL-S02 | main | They move between records by the nav, a link, a graph click, Back and quick find; the frame stays | | LA-V61 | | UC09-R02 |
| UC09-FL-S03 | main | They open, close and maximize panes and the side bar; only the panes move | CMD02 | LA-V61 | | UC09-R03 |
| UC09-FL-S04 | main | They fold rows and use Expand all | | LA-V03 | | UC09-R04 |
| UC09-FL-S05 | main | They resize panels, which follow the pointer | CMD01 | LA-V61 | | UC09-R05 |
| UC09-FL-S06 | main | They re-center the graph, change its depth and move around the ERD; the canvas and its bars hold still | | LA-V04 | | UC09-R06 |
| UC09-FL-S07 | main | The specs reload while they are scrolled part-way down; what was in view stays | QRY02 | LA-V03 | | UC09-R07 |
| UC09-FL-S08 | main | They open a tooltip, quick find, the palette and the sheet, each placed before it shows | | LA-V61 | | UC09-R08 |
| UC09-FL-S09 | main | They switch the theme; only colors change | CMD03 | LA-V63 | | UC09-R09 |
| UC09-FL-S10 | phone | On a phone they open and close the sheets; the page behind stays | | LA-V61 | | UC09-R10 |
| UC09-FL-S11 | main | Each move answers within the performance budgets | | LA-V61 | | UC09-R11 |
| UC10-FL-S01 | main | The Reader tabs round the nav, the page bar, the panes and the side bar; every control is reached, named for what it shows, big enough and never inside another, and every box that scrolls takes focus | | LA-V61 | | UC10's goal |
| UC10-FL-S02 | main | They open a record from the nav or quick find; focus stays on the page | | LA-V01 | | UC10-R03 |
| UC10-FL-S03 | main | They switch views and show and hide the side bar; each change is announced | CMD02 | LA-V61 | | UC10-R04 |
| UC10-FL-S04 | main | They pick the High contrast theme by keyboard; every page reads clearly in it, in light and dark | CMD03 | LA-V63 | | UC10-R01 |
| UC10-FL-S05 | main | They open a dialog or a phone sheet; focus is held inside and comes back to the opener | | LA-V64 | | UC10-R03 |
| UC11-FL-S01 | main | The Reader chooses File › Open Product Folder… and picks a folder | CMD10 | LA-V66 | UC11-R01 | F05 step 1 |
| UC11-FL-S02 | refused | A folder that is not a product is refused with what is missing, and no window opens | CMD10 | | UC11-R01 | DR26 |
| UC11-FL-S03 | main | It opens in a window of its own, never white, titled with its products and folder, the page reaching the shell only through `window.latheDesktop` | | LA-V68 | UC11-R02, UC11-R04, UC11-R05 | F05 step 1 |
| UC11-FL-S04 | main | A link to another site opens in the system browser, and the window stays on Lathe | | LA-V03 | UC11-R06 | DR30; exchanges with LA-INT61 |
| UC11-FL-S05 | main | They come back to it from File › Open Recent | QRY06 | LA-V66 | | F05 step 1 |
| UC11-FL-S06 | main | The next launch reopens the last folder | CMD10 | | | DR32 |
| UC12-FL-S01 | main | The Owner runs `npm --prefix desktop run dev`; a window loads the 5199 dev server when it serves the opened folder | CMD15 | | UC12-R01 | F06 step 1 |
| UC12-FL-S02 | alternate | Otherwise the shell starts a dev server of its own for the folder | CMD15 | | UC12-R02 | F06 step 1 |
| UC12-FL-S03 | main | A change to the main process or a preload restarts Electron | | | UC12-R03 | F06 step 2 |
| UC12-FL-S04 | main | A change to a record reloads the page in every mode | QRY02 | LA-V03 | UC12-R04 | F06 step 3 |
| UC12-FL-S05 | main | They build the app as it ships, locally and unsigned | | | UC12-R05 | UC12's goal |
| UC13-FL-S01 | main | The Reader opens the menu bar: File, Edit, View, Window and Help | | LA-V66 | | F05 step 3 |
| UC13-FL-S02 | main | They choose a View item; the page runs the command by its ID, as if its key had been pressed | CMD02 | LA-V66 | | F05 step 3 |
| UC13-FL-S03 | main | The page knows it runs in the desktop app | | LA-V67 | UC13-R03 | UC13-R03 |
| UC14-FL-S01 | main | The window has no system title bar; Lathe draws its own, with the window's controls over it | | LA-V67 | | F05 step 2 |
| UC14-FL-S02 | main | The Reader goes back and forward from the bar | | LA-V67 | | F05 step 2 |
| UC14-FL-S03 | main | They click the command center to open quick find | | LA-V67 | | F05 step 2 |
| UC14-FL-S04 | main | They show and hide the navigation and the side bar from the bar | CMD02 | LA-V67 | | F05 step 2 |
| UC14-FL-S05 | main | They drag the window by the bar and double-click it to zoom | | LA-V67 | | UC14-R05 |
| UC14-FL-S06 | main | They change the theme; the bar and the window's controls follow | CMD13 | LA-V67 | | UC14-R06 |
| UC15-FL-S01 | main | The Owner keeps Lathe in the Dock; its icon reads at every size, with a DEV band in development | | LA-V71 | | UC15's goal |
| UC15-FL-S02 | main | They open a folder; the window opens on the shell color with a launch view until the specs answer, and behaves like a native window | CMD10 | LA-V68 | UC15-R12 | F05 step 1 |
| UC15-FL-S03 | refused | When the engine cannot load the folder, the error page says why and offers Retry, another folder and the folder itself | | LA-V69 | | F05 step 4 |
| UC15-FL-S04 | main | The page reports its check errors to the shell | CMD14 | LA-V03 | | F05 step 3 |
| UC15-FL-S05 | main | The Dock badge counts the errors of the window in front | `LA-CHK-QRY03` (to resolve) | LA-V71 | | F05 step 3 |
| UC15-FL-S06 | main | The Dock menu opens another folder and lists the recent ones | QRY06 | LA-V71 | | UC15-R04 |
| UC15-FL-S07 | main | About Lathe shows the versions, and Settings… opens Appearance | | LA-V70 | | UC15's goal |
| UC15-FL-S08 | main | From a record they reveal its data file in Finder, open it in the editor or copy its ID; the shell takes only the ID and finds the file itself | Authoring's QRY05, which finds the file (to resolve, la-aut.md) | LA-V03 | UC15-R16 | UC15's goal; DR38 |
| UC15-FL-S09 | main | Opening Lathe again, or a folder from Finder, goes to the running app | CMD10 | | UC15-R09 | UC15-R09 |
| UC15-FL-S10 | main | A run that was killed leaves macOS nothing to reopen | | | UC15-R15 | DR40 |
| UC16-FL-S01 | main | An Agent calls the plugin's MCP tools, or the Owner runs `lathe add` | CMD18 | | | F07 step 1 |
| UC16-FL-S02 | main | The Owner saves a form on a record's page, which sends `POST /api/write` | CMD18 | LA-V03 | UC16-R01 | F07 step 1 |
| UC16-FL-S03 | refused | A write from another site, not sent as JSON or over the limits is refused before the store sees it | | | UC16-R02 | UC16-R02 |
| UC16-FL-S04 | refused | The store refuses a write that breaks a rule, with every reason, and no file changes | CMD18 | LA-V03 | UC16-R01 | F07 step 2 |
| UC16-FL-S05 | main | Open pages load the data again, and the change is reviewed and committed in git, merged row by row | QRY02 | LA-V03 | | F07 steps 3 and 4 |

Every UC requirement is fulfilled by at least one step of its own use case's flow. F02's steps' `fulfills` of DR07 to DR10 follow their rules to LA-V61's requirements and DS01. Paths other than `main` and `refused` are named for what they stand for (`alternate`, `typing`, `tablet`, `phone`).

### Views and view requirements

All eleven views are **new**: Platform's own screens, which the old spec had no view for. Each has no owner and exists because the steps above happen in it. Their requirements are the moved UC requirements and the domain rules that say what a screen does; titles and statements carry over unchanged except as written, with group names where a view holds many.

| ID | Title | Route | Description | Source |
| --- | --- | --- | --- | --- |
| LA-V61 | Workbench | | The app's frame around every page: the navigation, the page bar and panes, the side bar, tooltips, the keys and the announcer, and on a phone the top bar and the sheets. | **New**: the use cases about every page (UC03 to UC10); C07, C13, C19 |
| LA-V62 | Appearance page | `/settings/appearance` | The mode choice, every theme with a preview, import and export, and the editor for a theme of one's own. | UC07; C25 |
| LA-V63 | Theme picker | | The Color theme and Light, dark or system quick picks, which preview as they are arrowed. | UC07; C24 |
| LA-V64 | Command palette | | Every command that applies, with its keys, filtered as the Reader types. | UC04, UC05; C12 |
| LA-V65 | Shortcuts sheet | | Every shortcut grouped as Navigate, View, Graph and Lists, with a search and the override note. | UC04, UC05; C12 |
| LA-V66 | Native menus | | The desktop app's menu bar: the app menu, File, Edit, View, Window and Help. | UC13; C45 |
| LA-V67 | Desktop title bar | | The app's own 38 px bar in the desktop window: back and forward, the command center and the layout toggles. | UC14; C51 |
| LA-V68 | Launch view | | The shell color, the logo and "Opening <product>…" until the page has its specs. | UC15; C55 |
| LA-V69 | Error page | | The engine's message, with Retry, Open Another Folder and Reveal in Finder. | UC15; C55 |
| LA-V70 | About window | | The app's, the engine's and Electron's versions, with links to the repo and the record format. | UC15; C55 |
| LA-V71 | Dock icon | | Lathe's icon in the Dock, with its badge and its menu. | UC15; C53, C57 |

| ID | Group | Title | Source |
| --- | --- | --- | --- |
| LA-V61-R01 | Workbench | An open page loads the data again when it changes, at the same address | UC03-R01's page side, **new** statement: "When the server sends `spec:changed`, an open page MUST load the data again without a manual refresh, staying at the same address." |
| LA-V61-R02 | Workbench | A gap between panels resizes them by drag or keyboard | UC06-R01 |
| LA-V61-R03 | Workbench | Sizes are remembered, and double-click resets one | UC06-R02 |
| LA-V61-R04 | Workbench | Dragging the navigation or the side bar small folds it | UC06-R03 |
| LA-V61-R05 | Workbench | Hiding a panel gives its space away and loses nothing | DR03 |
| LA-V61-R06 | Workbench | A theme applies at once and before first paint | UC07-R07 |
| LA-V61-R07 | Keyboard | One keymap table drives the keys, the palette and the sheet | UC04-R01 |
| LA-V61-R08 | Keyboard | The default shortcuts follow VS Code | UC04-R02 |
| LA-V61-R09 | Keyboard | Shortcuts never get in the way of typing or of the browser | UC04-R03, with DR05's list: a shortcut without Ctrl, Cmd or Alt (a letter, a symbol, a sequence such as `g c`) MUST NOT fire while focus is in a text input, a text area, a select or editable text; Alt+Left and Alt+Right still go back and forward (DR06's last clause) |
| LA-V61-R10 | Keyboard | A person can change the bindings | UC04-R05 |
| LA-V61-R11 | Keyboard | Every command works without a mouse and is announced | UC04-R06 |
| LA-V61-R12 | Keyboard | A command's keys suit the platform | UC04-R07 |
| LA-V61-R13 | Keyboard | A tooltip shows the control and its keys | UC05-R01 |
| LA-V61-R14 | Keyboard | A control with a shortcut has aria-keyshortcuts | UC05-R03 |
| LA-V61-R15 | Keyboard | Every hint reads from the keymap | DR07 |
| LA-V61-R16 | Keyboard | A tooltip never gets in the way | DR10 |
| LA-V61-R17 … R26 | Phone | UC08-R01 to R10, in order (Below 900 px wide the app has a compact top bar … A tablet in landscape keeps the workbench, sized for touch) | UC08-R01 to R10; R18 (UC08-R02) gains DR16's last sentence: the views a page has open on a wide screen are not lost by reading it on a phone |
| LA-V61-R27 … R37 | Nothing jumps | UC09-R01 to R11, in order (The first load shifts nothing … Moving around answers within the performance budgets) | UC09-R01 to R11 |
| LA-V61-R38 | Nothing jumps | The frame of a page holds still | DR18 |
| LA-V61-R39 | Nothing jumps | A bar keeps one height, and a scroll box its gutter | DR19 |
| LA-V61-R40 … R43 | Keyboard and screen reader | UC10-R01 to R04, in order (Every page passes the audit … What changes out of sight is announced) | UC10-R01 to R04; R42 (UC10-R03) gains DR17's list of sheets (the nav, the side bar, the open pages, quick find) |
| LA-V61-R44 | Keyboard and screen reader | A control's name holds its visible text | DR21 |
| LA-V61-R45 | Keyboard and screen reader | No control inside another | DR22 |
| LA-V61-R46 | Keyboard and screen reader | A box that scrolls can be reached by keyboard | DR23 |
| LA-V61-R47 | Keyboard and screen reader | A target is at least 24 px, or has room around it | DR24 |
| LA-V61-R48 | Keyboard and screen reader | Text sits only on the surfaces the theme vouches for | DR25 |
| LA-V62-R01 | | The Appearance page lists the themes with previews | UC07-R03 |
| LA-V62-R02 | | A copy of a theme can be edited, renamed, reset and deleted | UC07-R04 |
| LA-V62-R03 | | Hard-to-read colors are flagged while editing | UC07-R05 |
| LA-V62-R04 | | Themes are kept per person and travel as files | UC07-R06 |
| LA-V63-R01 | | The Color theme command previews each theme and keeps or puts back | UC07-R01 |
| LA-V63-R02 | | Light, dark or system is chosen in the app | UC07-R02 |
| LA-V64-R01 | | A command palette and a shortcuts sheet, both searchable | UC04-R04 |
| LA-V64-R02 | | Menus and the palette show each command's keys at the right | UC05-R02 |
| LA-V65-R01 | | The shortcuts sheet matches the hints | UC05-R04 |
| LA-V66-R01 | | The menus are File, Edit, View, Window and Help | UC13-R01 |
| LA-V66-R02 | | A menu choice runs the app command by its ID | UC13-R02 |
| LA-V66-R03 | | The menus take no key from the app | UC13-R04 |
| LA-V66-R04 | | Open Recent lists the last 10 folders | UC11-R03 |
| LA-V66-R05 | | Settings opens the app's settings in the focused window | UC15-R06 |
| LA-V67-R01 … R07 | | UC14-R01 to R07, in order (The window has no system title bar; the app draws its own … In a browser there is no title bar) | UC14-R01 to R07 |
| LA-V68-R01 | | A window opens on the shell color with a launch view until the specs answer | UC15-R10 |
| LA-V69-R01 | | A folder the engine cannot load gets an error page with a way on | UC15-R11 |
| LA-V69-R02 | | A launch, error or About page runs only the buttons it shows | DR39 |
| LA-V70-R01 | | About Lathe shows the versions and links to the repo and the record format | UC15-R05 |
| LA-V71-R01 | | The app icon reads at every size and in light and dark Docks | UC15-R01 |
| LA-V71-R02 | | The Dock menu opens a new window and lists recent folders | UC15-R04 |
| LA-V71-R03 | | The Dock badge follows the window in front | DR37 |

76 view requirements: 63 moved, 12 from domain rules and 1 new (LA-V61-R01). Statements that name an old ID change with it: LA-V61-R19 (`LA-EXP-DR41`) and R24 (`LA-TRC-DR35`), to resolve; R25, R26 and R37 keep `LA-PAT-APP-UX-R04`, `R07` and `R11`.

### Endpoints and API requirements

Each sits under the command or query it exposes. The API grouping (API01 Spec API) goes; its "answers JSON, and a method an endpoint does not take with 405" goes into each endpoint's description, and its four shapes fold into the descriptions as the Tool Library's did.

| ID | Title | Parent | Method and route | Source |
| --- | --- | --- | --- | --- |
| EP01 | Get the product's data | QRY02 | GET `/api/spec` | E01; API01's Spec data and Error shapes |
| EP02 | Write to the data | CMD18 | POST `/api/write` | E02; API01's Write, Write answer and Error shapes |

| New | Old |
| --- | --- |
| EP01-R01 GET /api/spec answers with the product's data, or 500 with the reason | E01-R01 |
| EP02-R01 POST /api/write answers the changed rows, or the refusal with its reasons | E02-R01 |
| EP02-R02 POST /api/write refuses what is not a write from the app | E02-R02 |

Titles and statements are unchanged.

### Integrations

| ID | Title | System | Exchanged with by | Source |
| --- | --- | --- | --- | --- |
| LA-INT61 | System browser | The person's default browser | UC11-FL-S04; the About window's links | **New**: DR30 |

No integration tests: the old spec has none, and it is proved through UC11-R06.

## Technical specification

Each record names one file. Technical kinds with no code are left out and show as not built: tables (Platform has no database tables of its own), event types (the code raises no events by name), and projections other than RM01's (the keymap, the themes list and the recent folders are worked out on each read).

| ID | Kind | Implements | File | What in the file | Source |
| --- | --- | --- | --- | --- | --- |
| A2-REPO | Repository | A2 | app/src/shell/prefs.ts | `readPref`, `writePref`, `usePanelSize`: sizes and shown states in local storage | C10, C19 |
| A3-REPO | Repository | A3 | app/src/shell/keymap.ts | `COMMANDS`, `SPACE_KEYS`, `readOverrides` (`lathe:keybindings`) | C11, C15 |
| A4-REPO | Repository | A4 | app/src/theme/store.ts | `themeStore`, `STORAGE_KEYS`: the person's themes, the chosen one, the mode and its stylesheet | C22 |
| A6-REPO | Repository | A6 | desktop/src/windowState.ts | `parseWindowStates`, `saveWindow` (`window-state.json`) | C42 |
| A8-REPO | Repository | A8 | lathe/src/store/store.ts | the changed tables' files rewritten through a temporary file and a rename | C59 |
| A9-REPO | Repository | A9 | desktop/src/folders.ts | `parseRecent` (`recent-folders.json`) | C41 |
| A10-REPO | Repository | A10 | lathe/src/config.ts | `loadConfig`: reads `lathe.config.json` (to resolve with `LA-AUT-C05` and `LA-CHK-C11`, which name the same file) | **New** |
| EN03-DM | Data model | EN03 | app/src/shell/keymap.ts | `Command` | C11 |
| EN04-DM | Data model | EN04 | app/src/shell/keymap.ts | `Command.keys`, `otherKeys` (a child on its root's type) | C11 |
| EN14-DM | Data model | EN14 | app/src/theme/store.ts | `ThemeState` | C22 |
| EN06-DM | Data model | EN06 | app/src/theme/theme.ts | `Theme` | C20 |
| EN08-DM | Data model | EN08 | desktop/src/main.ts | `Entry` | C40 |
| EN15-DM | Data model | EN15 | desktop/src/folders.ts | the recent folders list, `RECENT_LIMIT` | C41 |
| EN10-DM | Data model | EN10 | desktop/src/servers.ts | `AppServer` | C43 |
| EN11-DM | Data model | EN11 | lathe/src/store/store.ts | `WriteResult`, a write's `Command[]` | C59 |
| EN12-DM | Data model | EN12 | lathe/src/store/store.ts | `Command` | C59 |
| EN13-DM | Data model | EN13 | lathe/src/store/store.ts | `StoreProblem`, `StoreError`, `formatProblem` | C59 |
| EN16-DM | Data model | EN16 | lathe/src/config.ts | `LatheConfig` | **New** |
| VO61-VT | Value type | VO61 | app/src/shell/keymap.ts | `normalizeChord`, `normalizeBinding`, `RESERVED` | C11 |
| VO62-VT | Value type | VO62 | app/src/theme/tokens.ts | the token table and how each value is checked | C20 |
| VO63-VT | Value type | VO63 | app/src/theme/theme.ts | `ThemeFile`, `parseTheme`, `toFile`, `THEME_FORMAT`, `THEME_VERSION` | C20 |
| VO64-VT | Value type | VO64 | desktop/src/windowState.ts | `Bounds`, `SavedWindow` | C42 |
| VO65-VT | Value type | VO65 | desktop/src/chrome.ts | `Chrome`, `parseChrome`, `parseHexColor` | C50 |
| SP01-PR | Predicate | SP01 | desktop/src/folders.ts | `checkFolder` | C41 |
| SP02-PR | Predicate | SP02 | desktop/src/devSource.ts | `chooseDevSource`, `ROOT_HEADER`; also `freePort`, which keeps INV06 | C44 |
| RM01-PJ | Projection | RM01 | lathe/src/index.ts | `readWorkspace`: opens the store afresh, gives each record its part rows (`readRecords`), fills the file facts, runs Lathe's checks then the product's on four connections and the coverage queries side by side; `buildReference`'s kept answer. Its shape is `Workspace` in `lathe/src/types.ts`. | C01, C04, C02 |
| CMD01-H | Command handler | CMD01 | app/src/shell/prefs.ts | `usePanelSize`'s setter, within the limits | C10, C19 |
| CMD02-H | Command handler | CMD02 | app/src/App.tsx | `toggleNav`, and the side bar, view and full screen commands the shell registers | C13, C19 |
| CMD03-H … CMD09-H | Command handler (7) | CMD03 … CMD09 | app/src/theme/ThemeProvider.tsx | `choose`, `setMode`, `duplicate`, `importFile`, `update`, `reset`, `remove` | C23 |
| CMD10-H | Command handler | CMD10 | desktop/src/main.ts | `openFolder` | C40 |
| CMD11-H | Command handler | CMD11 | desktop/src/main.ts | the window's `close` and `closed` handlers | C40 |
| CMD12-H | Command handler | CMD12 | desktop/src/main.ts | `saveBounds` | C40, C42 |
| CMD13-H | Command handler | CMD13 | desktop/src/chrome.ts | `applyChrome` | C50 |
| CMD14-H | Command handler | CMD14 | desktop/src/main.ts | the `lathe:error-count` handler, `updateBadge` | C40, C53 |
| CMD15-H | Command handler | CMD15 | desktop/src/servers.ts | `startServe`, `startDev` | C43 |
| CMD16-H | Command handler | CMD16 | desktop/src/servers.ts | each server's `stop` | C43 |
| CMD17-H | Command handler | CMD17 | lathe/src/server/serve.ts | `serve` | C03 |
| CMD18-H | Command handler | CMD18 | lathe/src/store/store.ts | `apply`, `add`, `set`, `move`, `link`, `unlink`, `remove`, and the write queue | C59 |
| CMD19-H | Command handler | CMD19 | desktop/src/folders.ts | `addRecent` | C41 |
| CMD20-H | Command handler | CMD20 | desktop/src/main.ts | `clearRecent` in `refreshMenu` | C40 |
| CMD21-H | Command handler | CMD21 | lathe/bin/lathe.ts | `init` | **New** |
| QRY01-H | Query handler | QRY01 | lathe/src/index.ts | `loadWorkspace` (la-chk.md's QRY01-H names it too) | C01 |
| QRY02-H | Query handler | QRY02 | lathe/src/server/api.ts | the `SpecData` answer: one store per product root, opened afresh when its files change; `dataSignature` | C06 |
| QRY03-H | Query handler | QRY03 | app/src/shell/keymap.ts | `resolveCommands`, `platformKeys` | C11 |
| QRY04-H | Query handler | QRY04 | app/src/theme/ThemeProvider.tsx | `themes`, `active`, `basedOn` | C23 |
| QRY05-H | Query handler | QRY05 | app/src/theme/ThemeProvider.tsx | `exportFile` | C23 |
| QRY06-H | Query handler | QRY06 | desktop/src/main.ts | `refreshMenu`'s Open Recent items | C40 |
| PO01-H | Event handler | PO01 | desktop/src/main.ts | `startApp` (inline, as the window opens) | C40 |
| PO02-H | Event handler | PO02 | desktop/src/main.ts | the `closed`, `before-quit`, SIGINT and SIGTERM handlers that stop servers | C40; reacts_to C40→EV05 |
| PO03-H | Event handler | PO03 | desktop/src/main.ts | `rememberRecent`, `app.addRecentDocument` | C40, C41; reacts_to C41→EV04 |
| DS01-SV | Service | DS01 | app/src/shell/keymap.ts | `formatBinding`, `ariaKeyShortcuts` | C15 |
| DS02-SV | Service | DS02 | app/src/theme/audit.ts | `auditContrast`, `REQUIRED_PAIRS`, with `contrast.ts` | C26 |
| DS03-SV | Service | DS03 | desktop/src/windowState.ts | `windowFor`, `DEFAULT_SIZE`, `MIN_SIZE` | C42 |
| DS04-SV | Service | DS04 | desktop/src/main.ts | `openOnLaunch` | C40 |
| EP01-H | Endpoint handler | EP01 | lathe/src/server/api.ts | `handleApi`'s `/api/spec` route; its shape is `SpecData` in `lathe/src/server/contract.ts` | C06, C61; implements C06→E01, C08→E01 |
| EP02-H | Endpoint handler | EP02 | lathe/src/server/api.ts | `handleApi`'s `/api/write` route, `writeRequestProblem`, `WRITE_BODY_LIMIT`, `WRITE_COMMAND_LIMIT`; its shapes are `WriteRequest` and `WriteAnswer` in `contract.ts` | C06, C61; implements C06→E02 |
| INT61-AD | Adapter | INT61 | desktop/src/main.ts | `keepLinksOutside` and the About links, through `shell.openExternal` | C40 |

### UI components

Each has no owner and renders one or more views.

| ID | Title | File | Renders | Source |
| --- | --- | --- | --- | --- |
| LA-UI61 | App shell | app/src/App.tsx | LA-V61, LA-V62 | C07, C13, C19, C36 (with `useNarrow.ts`); implements C07→`LA-EXP-V01` |
| LA-UI62 | Command dispatcher, palette and shortcuts sheet | app/src/shell/commands.tsx | LA-V61, LA-V64, LA-V65 | C12, C16 |
| LA-UI63 | Tooltip | app/src/shell/Tooltip.tsx | LA-V61 | C14, C17 (the focus page's hints are tooltips on its controls) |
| LA-UI64 | Resize handle | app/src/components/ResizeHandle.tsx | LA-V61 | C18 |
| LA-UI65 | Page bar | app/src/views/PageBar.tsx | LA-V61, LA-V07 | C28 |
| LA-UI66 | Bottom sheet | app/src/shell/BottomSheet.tsx | LA-V61 | C29 |
| LA-UI67 | Phone top bar and quick find sheet | app/src/shell/MobileBar.tsx | LA-V61, LA-V01 | C30 |
| LA-UI68 | Shared styles | app/src/styles.css | LA-V61 | C32, C39 |
| LA-UI69 | Button | app/src/components/Button.tsx | LA-V61 | C34 |
| LA-UI70 | Theme stylesheet | app/src/theme/css.ts | LA-V61 | C21 (with `apply.ts`) |
| LA-UI71 | Early theme script | app/index.html | LA-V61 | C27 |
| LA-UI72 | Theme color | app/src/shell/themeColor.ts | LA-V61 | C31 |
| LA-UI73 | Theme commands and quick pick | app/src/theme/ThemeCommands.tsx | LA-V63 | C24 (with `QuickPick.tsx`) |
| LA-UI74 | Appearance page and theme editor | app/src/theme/AppearancePage.tsx | LA-V62 | C25 |
| LA-UI75 | Desktop title bar | app/src/shell/DesktopTitleBar.tsx | LA-V67 | C51 |
| LA-UI76 | Theme to window chrome | app/src/shell/desktopChrome.ts | LA-V67 | C52 |
| LA-UI77 | Window title bar options | desktop/src/chrome.ts | LA-V67 | C50's `chromeWindowOptions` |
| LA-UI78 | Native menus | desktop/src/menu.ts | LA-V66 | C45, C46 (`desktop/src/commands.ts`) |
| LA-UI79 | Launch view, error page and About window | desktop/src/launch.ts | LA-V68, LA-V69, LA-V70 | C55, C56 (`local-preload.cts`) |
| LA-UI80 | Dock icon and menu | desktop/src/dock.ts | LA-V71 | C53's `dockMenuTemplate`, and `app.dock` in `main.ts` |

### Records of product kinds

| ID | Kind | Parent | Exposes | File | What | Source |
| --- | --- | --- | --- | --- | --- | --- |
| LA-PLT-ENTRY01 | Entry point | LA-PLT | | desktop/src/main.ts | The shell's start-up: windows, IPC, menus and quitting | C40 |
| LA-PLT-ENTRY02 | Entry point | LA-PLT | | desktop/src/instance.ts | The single-instance lock: a second launch or a folder from Finder goes to CMD10 | C54 |
| LA-PLT-ENTRY03 | Entry point | LA-PLT | | desktop/src/persistence.ts | macOS window restoration turned off before the app is ready (UC15-R15) | C58 |
| LA-PLT-ENTRY04 | Entry point | LA-PLT | | app/server/lathe.ts | The dev API plugin: Lathe's API inside the app's Vite dev server, the fixture, `x-lathe-root`, `spec:changed` | C08 |
| UC02-R05-TOOL | Tooling | UC02-R05 | | .gitattributes | `**/data/*.jsonl merge=lathe-data`, with the READMEs' two `git config` lines | C60 |
| UC12-R03-TOOL | Tooling | UC12-R03 | | desktop/scripts/dev.ts | The development watcher | C48 |
| UC12-R05-TOOL | Tooling | UC12-R05 | | desktop/scripts/stage-lathe.ts | The local build, with electron-builder's settings in `desktop/package.json` | C49 |
| LA-V71-R01-TOOL | Tooling | LA-V71-R01 | | desktop/scripts/icon.ts | The app icon renderer | C57 |
| LA-PLT-IPC01 | IPC channel | LA-PLT | CMD13 | desktop/src/preload.cts | `setChrome` on `lathe:set-chrome` | C47 |
| LA-PLT-IPC02 | IPC channel | LA-PLT | CMD14 | desktop/src/preload.cts | `setErrorCount` on `lathe:error-count` | C47 |
| LA-PLT-CLI01 | CLI command | LA-PLT | CMD17 | lathe/bin/lathe.ts | `lathe serve [--port]` | C03 |
| LA-PLT-CLI02 | CLI command | LA-PLT | CMD21 | lathe/bin/lathe.ts | `lathe init --name <name> --prefix <prefix>` | **New** |
| EP01-CL | API client | EP01 | | app/src/specs/data.ts | Fetches `GET /api/spec`, again on `spec:changed` and after a write, and builds the app's index | C09 (judgment call 15) |
| EP02-CL | API client | EP02 | | app/src/edit/write.ts | The app's writes (la-exp.md's C88, placed here) | `LA-EXP-C88` (to resolve) |

The rest of the preload (`isDesktop`, `platform`, `onCommand`, `onFullScreen`) is described on LA-UI75 and LA-UI78, which use it; its record actions are Authoring's (to resolve).

## Product kinds used and proposed

None is an obligation. Where another sheet proposed a kind that fits, this sheet uses it.

| Name | Label | Stage | Parent kind | ID pattern | Fields | From |
| --- | --- | --- | --- | --- | --- | --- |
| `entry_point` | Entry point | technical-specification | domain | `<domain>-ENTRY<nn>` | file (text, required), description | The Tool Library's kind, declared for LA too |
| `cli_command` | CLI command | interaction-design | domain | `<P>-<D>-CLI<nn>` | command (text, required), file, description; relation `exposes` to a command or a query | la-chk.md |
| `api_client` | API client | technical-specification | endpoint | `<endpoint>-CL` | file, description | la-exp.md |
| `tooling` | Tooling | technical-specification | uc_requirement or view_requirement | `<requirement>-TOOL` | file (text, required), description | **Proposed here**: a script or config file outside the running app that carries out one requirement: a dev watcher, a build, an icon renderer, the merge driver's attributes |
| `ipc_channel` | IPC channel | interaction-design | domain | `<P>-<D>-IPC<nn>` | channel (text, required), file (text, required), description; relation `exposes` to a command | **Proposed here**: how the desktop page sends a command to the shell's main process, the desktop's endpoint, which has no method or route |

`tooling` needs a parent of either requirement kind, and a product kind has one parent kind (plan gap 3); declared under `uc_requirement` alone, the icon renderer would sit under UC15's goal instead. `entry_point` is the Tool Library's name: if one store ever loads both products, the two declarations clash on the key `name` (plan gap 4).

## Test plan

Every test names one parent and a run by, at a level its kind allows (brief 108's Owner decisions). Levels:
- **unit:** the app's Vitest tests in jsdom (`app/test/`), and the desktop's tests of its pure modules (`desktop/test/*.test.ts` but the smoke test).
- **database:** the store's tests (`lathe/test/store/`), for invariants.
- **api:** the engine's tests through its package API in process (`loadWorkspace`, `openStore`), as la-chk.md levels them, and the server's tests (`lathe/test/serve.test.ts`, `app/test/server.test.ts`).
- **e2e-api:** `lathe/test/cli.test.ts`, which runs the CLI, and `lathe/test/store/merge.test.ts`, which merges through git.
- **e2e-ui:** a real browser or Electron: the stability, accessibility and performance suites and the desktop smoke test.
- **manual:** the four manual walks, each step test keeping its old test's reason.

When one old test splits, its `it` splits into one `it` per new record, each name starting with its record's ID; where the new records share one Electron run (T111) or one axe run (T97), the apply step keeps the run and gives each record its own `it` over it. IDs in full start `LA-PLT-`.

### Constraint tests

All unit, automated.

| ID | Parent | File | Source |
| --- | --- | --- | --- |
| LA-VO61-C01-T | VO61-C01 | app/test/keymap.test.ts | T16, its first part: bindings normalized, chords and sequences matched |
| LA-VO61-C02-T | VO61-C02 | app/test/keymap.test.ts | T15's no-reserved-key part and T18's browser-essential-dropped part |
| LA-VO62-C01-T | VO62-C01 | app/test/themes.test.tsx | T57: unknown tokens and values that reach past the token refused |
| LA-VO63-C01-T | VO63-C01 | app/test/themes.test.tsx | T57: round trip; another version or format and unknown fields refused |
| LA-VO65-C01-T | VO65-C01 | desktop/test/chrome.test.ts | T116: names, alpha colors, `rgb()`, injected text, numbers, missing and extra keys refused, nothing changed |

### Invariant tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| INV01-T | INV01 | unit, app/test/keymap.test.ts | T15: no duplicate binding on either platform; the duplicate check catches a clash and a sequence prefix |
| INV02-T | INV02 | unit, app/test/themes.test.tsx | T57: a partial file filled from Lathe |
| INV03-T | INV03 | unit, app/test/themes.test.tsx | T55: a built-in changed only through a copy, which resets to it |
| INV04-T | INV04 | unit, app/test/themes.test.tsx | T55: after the copy in use is deleted, Lathe is in use |
| INV05-T | INV05 | unit, desktop/test/instance.test.ts | T124: an open folder's window found however its path is spelled |
| INV06-T | INV06 | unit, desktop/test/devSource.test.ts | T109: a free port is never 5199 or a port in use |
| INV07-T | INV07 | database, lathe/test/store/commands.test.ts | T138; T142's refused later writes |
| INV08-T | INV08 | database, lathe/test/store/commands.test.ts | T139, T140, T141, and T142's bad date and table name, one `it` each |
| INV09-T | INV09 | database, lathe/test/store/commands.test.ts | T143, T144 |
| INV10-T | INV10 | database, lathe/test/store/commands.test.ts | T145 |
| INV11-T | INV11 | database, lathe/test/store/commands.test.ts | T146, and the named refusals of T147, T151 and T152 |
| INV12-T | INV12 | database, lathe/test/store/commands.test.ts | T148, T149, T150, and T147's and T151's key, parent and move refusals |
| INV13-T | INV13 | database, lathe/test/store/commands.test.ts | T153, and T152's removal refused while referenced |
| INV14-T | INV14 | unit, desktop/test/folders.test.ts | T107 |

### Specification and domain service tests

All unit, automated.

| ID | Parent | File | Source |
| --- | --- | --- | --- |
| SP01-T | SP01 | desktop/test/folders.test.ts | T106: which folders open, with which data folder, and what the refusals say |
| SP02-T | SP02 | desktop/test/devSource.test.ts | T109: a fake 5199 for the folder, another folder, no header, an error, or none |
| DS01-T01 | DS01 | app/test/shortcut-hints.test.tsx | T28: bindings formatted for a Mac and elsewhere |
| DS01-T02 | DS01 | app/test/shortcut-hints.test.tsx | T31: no `aria-keyshortcuts` for a sequence |
| DS02-T01 | DS02 | app/test/themes.test.tsx | T56: the ratios on paper and on sheet, in the light cell only |
| DS03-T01 | DS03 | desktop/test/windowState.test.ts | T108 |
| DS04-T01 | DS04 | desktop/test/instance.test.ts | T124: the folder read from unpacked and packed command lines |

### Policy tests

None at an allowed level (database, api or e2e-api). PO01 and PO03 are seen in the desktop smoke test (T111: the window's `serve()` answered, the folder went into the recent list) and PO02 in a manual walk (T112 step 6); those are e2e-ui and manual, so they stay in UC11-FL-T and in UC11-R02-T01's notes, and the three policies show as not proved (plan gap 5).

### Use case tests

| ID | Run by | Source |
| --- | --- | --- |
| UC01-R01-T01 | api, lathe/test/engine.test.ts | T03 |
| UC01-R02-T01 | api, lathe/test/engine.test.ts | T04 |
| UC01-R03-T01 | api, lathe/perf/engine.ts | T08 |
| UC01-R03-T02 | api, lathe/test/reload-cache.test.ts | T09: every phase timed |
| UC01-R04-T01 | api, lathe/test/engine.test.ts | T05 |
| UC01-R04-T02 | api, lathe/test/reload-cache.test.ts | T09: a reload gives what a fresh load gives |
| UC02-R01-T01 | e2e-api, lathe/test/cli.test.ts | T06 |
| UC02-R02-T01 | api, lathe/test/checks.test.ts | T01 |
| UC02-R02-T02 | api, lathe/test/config.test.ts | T10 |
| UC02-R02-T03 | api, lathe/test/citations-by-id.test.ts | `LA-AUT-T54`'s part |
| UC02-R03-T01 | api, lathe/test/checks.test.ts | T02 |
| UC02-R04-T01 | api, lathe/test/serve.test.ts | T07 |
| UC02-R05-T01 | e2e-api, lathe/test/store/merge.test.ts | T154 |
| UC03-R01-T01 | api, app/test/server.test.ts | T12 |
| UC03-R01-T02 | api, app/test/server.test.ts | T160 |
| UC11-R01-T01 | manual | T112 step 2 |
| UC11-R02-T01 | e2e-ui, desktop/test/smoke.test.ts | T111: the window's title. Notes: T106's title from the product rows (unit); PO01's and PO03's effects seen in the same run |
| UC11-R04-T01 | manual | T112 step 1 |
| UC11-R05-T01 | e2e-ui, desktop/test/smoke.test.ts | T111: `window.latheDesktop` with its ten members and no Node |
| UC11-R06-T01 | manual | T112 step 4 |
| UC12-R01-T01 | manual | T113 step 1. Notes: SP02-T and INV06-T prove the choice at unit level |
| UC12-R02-T01 | manual | T113 steps 1 and 3 |
| UC12-R03-T01 | manual | T113 step 5 |
| UC12-R04-T01 | manual | T113 step 4 |
| UC12-R05-T01 | manual | T113 step 6 |
| UC13-R03-T01 | e2e-ui, desktop/test/smoke.test.ts | T111: the page has `window.latheDesktop` |
| UC15-R09-T01 | manual | T128 step 6. Notes: T124 routes a second launch at unit level |
| UC15-R12-T01 | manual | T128 step 8 |
| UC15-R15-T01 | manual | T128 step 9. Notes: T127 (`desktop/test/persistence.test.ts`) checks the defaults at unit level |
| UC15-R16-T01 | manual | T128 step 5. Notes: `LA-AUT-T118`'s part (`desktop/test/records.test.ts`) checks the refusals of paths, unknown actions and malformed IDs at unit level |
| UC16-R01-T01 | api, app/test/server.test.ts | T155 |
| UC16-R02-T01 | api, app/test/server.test.ts | T157 |

Manual tests keep their old test's reason: T112's, T113's and T128's.

### View tests

All automated unless marked manual. App tests are unit (`app/test/…`), the suites e2e-ui.

| ID | Run by | Source | ID | Run by | Source |
| --- | --- | --- | --- | --- | --- |
| V61-R01-T01 | unit, reload.test.tsx | T13 | V61-R27-T01 | e2e-ui, stability/first-load.spec.ts | T71 |
| V61-R02-T01 | unit, views.test.tsx | T14: the gap moves by keys | V61-R28-T01 | e2e-ui, stability/navigate.spec.ts | T72 |
| V61-R02-T02 | unit, resize-handle.test.tsx | T43 | V61-R29-T01 | e2e-ui, stability/panes.spec.ts | T73 |
| V61-R02-T03 | unit, model.test.tsx | T50 | V61-R30-T01 | e2e-ui, stability/fold.spec.ts | T74 |
| V61-R03-T01 | unit, views.test.tsx | T14: remembered, even on double-click | V61-R31-T01 | e2e-ui, stability/resize.spec.ts | T75 |
| V61-R03-T02 | unit, resize-handle.test.tsx | T43 | V61-R32-T01 | e2e-ui, stability/graph.spec.ts | T76 |
| V61-R03-T03 | unit, resize-handle.test.tsx | T44 | V61-R33-T01 | e2e-ui, stability/reload.spec.ts | T77 |
| V61-R03-T04 | unit, model.test.tsx | T50 | V61-R34-T01 | e2e-ui, stability/overlays.spec.ts | T78 |
| V61-R04-T01 | unit, resize-handle.test.tsx | T44 | V61-R35-T01 | e2e-ui, stability/theme-and-mobile.spec.ts | T80 |
| V61-R05-T01 | unit, views.test.tsx | `LA-EXP-T48`'s part | V61-R36-T01 | e2e-ui, stability/theme-and-mobile.spec.ts | T81 |
| V61-R06-T01 | unit, themes.test.tsx | T53: kept with its stylesheet, at once | V61-R37-T01 … T04 | e2e-ui, perf/app.perf.ts | T91, T92, T93, T94 |
| V61-R06-T02 | unit, themes.test.tsx | T58 | V61-R38-T01 | e2e-ui, stability/first-load.spec.ts | T71: the frame never moves |
| V61-R07-T01 | unit, keymap.test.ts | T15: every command has an id, title and group | V61-R38-T02 | unit, nothing-jumps.test.tsx | T79: late content reaches the host before paint, fonts preloaded |
| V61-R07-T02 | unit, keymap.test.ts | T16: Mod is Cmd on a Mac, Ctrl elsewhere | V61-R39-T01 | unit, nothing-jumps.test.tsx | T79: gutters, one-height bars, counts as one text |
| V61-R08-T01 … T08 | unit, shortcuts.test.tsx; T08 keymap.test.ts | T19, T20, T21, T22, T24 (the `g` sequences), T25, T26, T51 | V61-R40-T01 | e2e-ui, a11y/audit.spec.ts | T97 |
| V61-R09-T01 | unit, keymap.test.ts | T17 | V61-R41-T01 | e2e-ui, a11y/keyboard.spec.ts | T98 |
| V61-R09-T02 | unit, shortcuts.test.tsx | T19: unhandled keys left to the browser | V61-R41-T02 | e2e-ui, a11y/keyboard.spec.ts | T99 |
| V61-R09-T03 | unit, shortcuts.test.tsx | T24: nothing while typing | V61-R41-T03 | unit, graph/GraphPage.test.tsx | T101 |
| V61-R10-T01 | unit, keymap.test.ts | T18: overrides read, bad ones ignored | V61-R42-T01 | e2e-ui, a11y/keyboard.spec.ts | T100 |
| V61-R10-T02 | unit, shortcuts.test.tsx | T23: the override note | V61-R43-T01 | e2e-ui, a11y/keyboard.spec.ts | T99: the announcements |
| V61-R11-T01 … T03 | unit, shortcuts.test.tsx | T20, T21, T22 | V61-R44-T01 … R48-T01 | e2e-ui, a11y/audit.spec.ts | T97, one `it` per requirement over the same axe runs |
| V61-R12-T01 | unit, shortcut-hints.test.tsx | T31: Alt+W and Alt+G first off a Mac | V62-R01-T01 | unit, themes.test.tsx | T54: the nav footer's Appearance link |
| V61-R12-T02 | unit, keymap.test.ts | T51: no platform offered a browser key | V62-R01-T02 | unit, themes.test.tsx | T55: the five built-ins with previews |
| V61-R13-T01 | unit, shortcut-hints.test.tsx | T27: after the delay, at once on focus | V62-R02-T01 | unit, themes.test.tsx | T55: a copy edited live, renamed, reset and deleted |
| V61-R13-T02 | unit, shortcut-hints.test.tsx | T28: Mac keys in tooltips | V62-R03-T01 | unit, themes.test.tsx | T56: the warning beside its swatch |
| V61-R14-T01 | unit, shortcut-hints.test.tsx | T31: on each control | V62-R04-T01 | unit, themes.test.tsx | T57: export, and import on the Appearance page |
| V61-R15-T01 | unit, shortcut-hints.test.tsx | T30 | V63-R01-T01 | unit, themes.test.tsx | T53 |
| V61-R16-T01 | unit, shortcut-hints.test.tsx | T27: Escape and leaving close it, a click opens none | V63-R02-T01 | unit, themes.test.tsx | T54 |
| V61-R17-T01 | unit, mobile.test.tsx | T61: the top bar | V64-R01-T01 | unit, shortcuts.test.tsx | T23 |
| V61-R17-T02 | unit, standards.test.tsx | T70: no sideways scroll at 320 px | V64-R02-T01 | unit, shortcut-hints.test.tsx | T29 |
| V61-R18-T01 | unit, mobile.test.tsx | T61: one view at a time | V65-R01-T01 | unit, shortcut-hints.test.tsx | T32 |
| V61-R19-T01 | unit, mobile.test.tsx | T66 | V66-R01-T01 | unit, desktop/test/commands.test.ts | T110: the menus and items |
| V61-R19-T02 | unit, standards.test.tsx | T68: the nav's rows at 44 px | V66-R02-T01 | e2e-ui, desktop/test/smoke.test.ts | T111: Help › Keyboard Shortcuts opens the sheet |
| V61-R20-T01 | unit, mobile.test.tsx | T62 | V66-R02-T02 | unit, desktop-commands.test.tsx | T114 |
| V61-R20-T02 | unit, mobile.test.tsx | T63 | V66-R03-T01 | unit, desktop/test/commands.test.ts | T110: no accelerator on an app command |
| V61-R21-T01 | unit, mobile.test.tsx | T64 | V66-R04-T01 | unit, desktop/test/commands.test.ts | T110: Open Recent opens the folder chosen |
| V61-R22-T01 | unit, mobile.test.tsx | T65 | V66-R05-T01 | unit, desktop/test/commands.test.ts | T126: Settings… (Cmd+,) |
| V61-R23-T01 | unit, mobile.test.tsx | `LA-EXP-T133`'s part | V67-R01-T01 | e2e-ui, desktop/test/smoke.test.ts | T111: a hidden title bar and the page's own 38 px bar |
| V61-R24-T01 | unit, standards.test.tsx | T70: tables and code scroll in their box, IDs wrap | V67-R01-T02 | unit, desktop/test/chrome.test.ts | T115 |
| V61-R25-T01 | unit, mobile.test.tsx | T67 | V67-R01-T03 | unit, desktop-title-bar.test.tsx | T117 |
| V61-R26-T01 | unit, standards.test.tsx | T68: 44 px targets at 900 px and wider on touch | V67-R01-T04 | unit, desktop-record.test.tsx | `LA-AUT-T120`'s part: full screen drops the traffic lights' room |
| V67-R02-T01 | unit, desktop-title-bar.test.tsx | T118 | V68-R01-T01 | e2e-ui, desktop/test/smoke.test.ts | T111: the launch view said "Opening Smoke Shop…" |
| V67-R03-T01 | unit, desktop-title-bar.test.tsx | T119 | V68-R01-T02 | unit, desktop/test/launch.test.ts | T125: the launch view and its steps |
| V67-R04-T01 | unit, desktop-title-bar.test.tsx | T120 | V69-R01-T01 | unit, desktop/test/launch.test.ts | T125: the error page and its message |
| V67-R05-T01 | manual | T122 step 2 | V69-R02-T01 | unit, desktop/test/launch.test.ts | T125: only the buttons a page shows run |
| V67-R06-T01 | e2e-ui, desktop/test/smoke.test.ts | T111: the chrome sent and applied | V70-R01-T01 | unit, desktop/test/launch.test.ts | T125: the About model |
| V67-R06-T02 | unit, desktop/test/chrome.test.ts | T116: a valid chrome applied | V70-R01-T02 | unit, desktop/test/commands.test.ts | T126: About Lathe in the menus, no Check for Updates |
| V67-R06-T03 | unit, desktop-title-bar.test.tsx | T121 | V71-R01-T01 | e2e-ui, desktop/test/smoke.test.ts | T111: the built icons |
| V67-R07-T01 | unit, desktop-title-bar.test.tsx | T117 | V71-R01-T02 | manual | T128 step 1 |
| | | | V71-R02-T01 | unit, desktop/test/dock.test.ts | T123: New Window runs Open Product Folder |
| | | | V71-R02-T02 | manual | T128 step 3 |
| | | | V71-R03-T01 | unit, desktop/test/dock.test.ts | T123: the badge follows the window in front; only whole counts from 0 |

View test IDs start `LA-` (so `LA-V61-R01-T01`). The app files are under `app/test/` unless a path is given. Manual ones keep their old test's reason.

### Endpoint tests

All api, automated, app/test/server.test.ts.

| ID | Parent | Source |
| --- | --- | --- |
| EP01-R01-T01 | EP01-R01 | T158 |
| EP01-R01-T02 | EP01-R01 | T159 |
| EP02-R01-T01 | EP02-R01 | T155 |
| EP02-R01-T02 | EP02-R01 | T156 |
| EP02-R02-T01 | EP02-R02 | T157 |

### Flow tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| UC11-FL-T | UC11-FL | manual | T112, its six steps: "A day with the desktop app" (step 3 shows INV05, step 5 DS04, step 6 PO02) |
| UC12-FL-T | UC12-FL | manual | T113, its six steps |
| UC14-FL-T | UC14-FL | manual | T122, its four steps |
| UC15-FL-T | UC15-FL | manual | T128, its nine steps |

The other twelve flows have no flow test and show as not proved: no old test walks them as a whole, and this sheet adds none.

### Pattern rule tests

One per rule and adopting domain (`UNIQUE (pattern_rule_id, domain_id)`). Only Platform follows the two patterns, for the whole app, so every one is in `LA-PLT`. Where several old tests proved one rule, the one test names the main file and the others' `it`s are renamed to its ID and listed in its notes (judgment call 11). All automated.

| ID | In domain | Run by | Source, and the tests its notes list |
| --- | --- | --- | --- |
| LA-PAT-APP-CODE-R01-T01 | LA-PLT | unit, app/test/standards.test.tsx | T33 |
| LA-PAT-APP-CODE-R02-T01 | LA-PLT | unit, app/test/standards.test.tsx | T34 |
| LA-PAT-APP-CODE-R03-T01 | LA-PLT | unit, app/test/standards.test.tsx | T35 |
| LA-PAT-APP-CODE-R04-T01 | LA-PLT | unit, app/test/standards.test.tsx | T36 |
| LA-PAT-APP-CODE-R05-T01 | LA-PLT | unit, app/test/standards.test.tsx | T37 |
| LA-PAT-APP-CODE-R06-T01 | LA-PLT | unit, app/test/standards.test.tsx | T38 |
| LA-PAT-APP-CODE-R07-T01 | LA-PLT | unit, app/test/standards.test.tsx | T39 |
| LA-PAT-APP-CODE-R10-T01 | LA-PLT | unit, app/test/standards.test.tsx | T42 |
| LA-PAT-APP-CODE-R15-T01 | LA-PLT | unit, app/test/standards.test.tsx | T59; notes: T60 in `themes.test.tsx` (the built-ins' contrast) |
| LA-PAT-APP-CODE-R19-T01 | LA-PLT | unit, app/test/standards.test.tsx | T84 |
| LA-PAT-APP-CODE-R20-T01 | LA-PLT | unit, app/test/standards.test.tsx | T104; notes: T103, and T105 in `addresses.test.tsx` |
| LA-PAT-APP-CODE-R21-T01 | LA-PLT | unit, app/test/knip.test.ts | T129; notes: T130 `unused-css.test.ts`, T131 and T132 `commands-and-icons-used.test.ts`, T133 and T134 `marks-have-meaning.test.tsx` |
| LA-PAT-APP-UX-R01-T01 | LA-PLT | unit, app/test/standards.test.tsx | T40; notes: T49 `model.test.tsx`, T85 `domain-events.test.tsx` |
| LA-PAT-APP-UX-R02-T01 | LA-PLT | unit, app/test/standards.test.tsx | T41; notes: T50 `model.test.tsx`, T102 `app/stability/panes.spec.ts` |
| LA-PAT-APP-UX-R03-T01 | LA-PLT | unit, app/test/standards.test.tsx | T45; notes: T47 `views.test.tsx` |
| LA-PAT-APP-UX-R04-T01 | LA-PLT | unit, app/test/standards.test.tsx | T46; notes: `LA-EXP-T108` `graph/motion.test.tsx` |
| LA-PAT-APP-UX-R05-T01 | LA-PLT | unit, app/test/standards.test.tsx | T52; notes: T86 `domain-events.test.tsx`, T88 `side-bar.test.tsx` |
| LA-PAT-APP-UX-R06-T01 | LA-PLT | unit, app/test/record-tabs.test.tsx | T48; notes: T87 `side-bar.test.tsx` |
| LA-PAT-APP-UX-R07-T01 | LA-PLT | unit, app/test/standards.test.tsx | T68; notes: T69, T70, and T85 `domain-events.test.tsx` |
| LA-PAT-APP-UX-R08-T01 | LA-PLT | unit, app/test/nothing-jumps.test.tsx | T79; notes: the stability suite's scenarios (T71 to T78, T80, T81, T89, `LA-EXP-T173`, `T175`, `T202`), most of which are also the Workbench's view tests |
| LA-PAT-APP-UX-R09-T01 | LA-PLT | unit, app/test/standards.test.tsx | T82; notes: T83 `button.test.tsx` |
| LA-PAT-APP-UX-R10-T01 | LA-PLT | e2e-ui, app/a11y/audit.spec.ts | T97; notes: T98 to T100 `keyboard.spec.ts` |
| LA-PAT-APP-UX-R11-T01 | LA-PLT | e2e-ui, app/perf/app.perf.ts | T90; notes: T91 to T95, T137, T96 `first-load-imports.test.ts`, `LA-EXP-T170` `graph/map.test.ts` |
| LA-PAT-APP-UX-R12-T01 | LA-PLT | unit, app/test/graph/readable.test.ts | T135; notes: T136 `app/stability/graph.spec.ts`, `LA-EXP-T210` `graph/canvas.test.tsx` |

Given, when and then come from the source test. la-exp.md writes four of these IDs in `LA-EXP` (UX-R04, R08, R11, R12) although Exploring follows no pattern, which brief 108's check makes an error; this sheet's records replace them (cross-domain item 2).

### Patterns and standards

- **LA-PAT-APP-CODE and LA-PAT-APP-UX**, their 24 rules, and the two `follows` links from LA-PLT carry over unchanged. Neither has settings. The rule statements and notes that name other domains' rules (`LA-EXP-DR42` in UX-R07's notes, `DR58` and `DR60` in UX-R12) take those rules' new IDs (to resolve). DR20 folds into UX-R09, which already says it (judgment call 10).
- **LA-STD-CODE** and its three rules carry over unchanged. They are met, not proved: the `meets` links from Platform's old components move to the technical records that took their code (RM01-PJ meets R03; SP02-PR meets R03); `LA-PLT-C37`'s two go with it to Exploring's history query and adapter (la-exp.md's QRY11-H and LA-INT01-AD). No test or check proves a standard rule today, and none did before (plan gap 1).

## Counts

| Kind | Count | Kind | Count |
| --- | --- | --- | --- |
| Product | 1 (unchanged) | Repository | 7 |
| Role | 3 | Data model | 11 |
| Domain | 1 | Table | 0 |
| Aggregate | 8 (2 new) | Value type | 5 |
| Entity | 13 (3 new) | Predicate | 2 |
| Entity field | 35 | Event type | 0 |
| Value object | 5 | Projection | 1 |
| Value object field | 14 | Command handler | 21 |
| Constraint | 5 | Query handler | 6 |
| Invariant | 14 | Event handler | 3 |
| Specification | 2 | Service | 4 |
| Domain event | 6 (1 new) | Endpoint handler | 2 |
| Event field | 17 | Adapter | 1 |
| Command | 21 | UI component | 20 |
| Read model | 4 | Entry point (product kind) | 4 |
| Read model field | 19 | Tooling (product kind) | 4 |
| Query | 6 | IPC channel (product kind) | 2 |
| Policy | 3 | CLI command (product kind) | 2 |
| Domain service | 4 | API client (product kind) | 2 |
| Term | 12 (all new) | Constraint test | 5 |
| Capability | 4 | Invariant test | 14 |
| Use case | 16 | Specification test | 2 |
| UC requirement | 27 (5 new) | Policy test | 0 |
| Flow | 16 | Domain service test | 5 |
| Flow step | 92 | Use case test | 32 |
| View | 11 (all new) | View test | 117 |
| View requirement | 76 | Endpoint test | 5 |
| Endpoint | 2 | Flow test | 4 |
| API requirement | 3 | Integration test | 0 |
| Integration | 1 (new) | Pattern rule test | 24 |
| Pattern, rules | 2, 24 | Standard, rules | 1, 3 |

208 tests in all, every one from an old test: 204 from Platform's own 159, and 4 from parts of other domains' old tests (`LA-AUT-T54`, `T120`, `LA-EXP-T48`, `T133`). 189 are automated and 19 manual. None is new.

## Judgment calls

1. **The Workspace is a read model, not an aggregate.** Nothing changes it: it is what one load of the data files gives. RM01 is filled by its projection (`readWorkspace`) from every product's data, which are other domains' aggregates, so it depends on their published events rather than reading them. Its two rules were promises to the code that loads it: DR01 becomes UC01-R04 and DR02 merges into UC01-R03, which already said it.
2. **EV06 Data written is new and published.** A write's tables and files changed (EN11's derived fields) are what it tells every reader; Authoring's Record changed (`LA-AUT-EV01`) describes the files changing for any reason, git included, and stays theirs.
3. **A5 Control goes.** It had no commands and no state; its rules (DR21 to DR25) are what every page gives a keyboard or screen reader user, LA-V61-R44 to R48.
4. **Requirements about a screen are view requirements.** Brief 108 lets a use case test run at api, e2e-api, e2e-ui or manual only, and most of Platform's proof is app and desktop unit tests. As la-trc.md and la-chk.md do, what a screen shows or how it answers the hand moves to the view it is about (63 requirements, and 12 domain rules); what the system does for its actor stays a UC requirement (22, and 5 new). The Reader use cases UC04 to UC10 and UC14 keep goals and flows with no UC requirements. la-exp.md keeps such requirements as use case tests at unit level; the apply step should make the sheets agree.
5. **The Workbench (LA-V61) is a new view:** the frame every page shares, which no other sheet's view holds. Its 48 requirements sit in five groups of at most 13, so the size check (15) passes.
6. **A3 is the Keymap, EN03 a Keyboard command and EN12 a Write command,** so no record is titled like the model's Command kind.
7. **A4 becomes Appearance,** with a new root EN14 holding the chosen theme and the mode and EN06 Theme as its child: choosing a theme and a mode are the person's, and EV01 and EV02 are about that choice.
8. **The recent folders are their own aggregate (A9),** since one list serves every window and DR31 holds over the whole list. EN09 moves from A6 and keeps its ID.
9. **A10 Product repo is new,** for `lathe init` (CMD21) and the folder check (SP01). CMD21 also adds the first product record through the command layer, a recorded exception the checks will list.
10. **DR20 folds into `LA-PAT-APP-UX-R09`,** which says the same; its two tests prove that rule.
11. **One pattern rule test per rule.** The schema allows one per rule and domain, and only Platform follows the app patterns, so the 66 links from Platform's tests and 6 from Exploring's to pattern rules become 24 records, each naming its main file with the others in its notes.
12. **Rules sorted by what they do:** formats became constraints (DR06, DR11, DR13, DR36); one aggregate's rules invariants (DR04, DR12, DR14, DR15, DR27, DR31, DR33, DR41 to DR47); yes-or-no checks specifications (DR26, DR34); the one reaction a policy (DR35); calculations domain services (DR08 with DR09, DR28's placement, DR32); what a screen does view requirements (DR03, DR07, DR10, DR18, DR19, DR21 to DR25, DR37, DR39); what the system does UC requirements (DR29, DR30, DR38, DR40). DR05, DR16 and DR17 merge into the requirements that already said them.
13. **Derived fields leave entities** for read models, a domain service and an event (EN01, EN04's derived fields, EN05, EN11's), and A5's EN07 goes with A5.
14. **The Dock badge's query is Checking's.** la-chk.md has it (QRY03, `badgeFor`); Platform keeps the window's count (CMD14) and the badge's view requirement (DR37, LA-V71-R03), and the icon and its menu are a view, LA-V71, not an integration.
15. **The app's data client is an API client** (`api_client`, la-exp.md's kind): `app/src/specs/data.ts` calls `GET /api/spec` (EP01-CL), and the write client `app/src/edit/write.ts`, which la-exp.md leaves to this sheet, is EP02-CL.
16. **Product kinds are shared where they fit:** `cli_command` from la-chk.md, `api_client` from la-exp.md, `entry_point` from the Tool Library. Two are proposed here: `tooling` and `ipc_channel`.
17. **No new tests, and some proofs drop.** Every new obligation was already proved by a part of an old test. Unit proofs of system behavior with no record of an allowed level (T106's title, T124's routing, T127, `LA-AUT-T118`'s refusals) are named in the notes of the manual or e2e test that proves the same requirement. The policies have no test at an allowed level. DR17's and DR18's extra links on T62, T64 to T66, T72 and T73, DR19's on T76, DR12's on T60 and UC05-R04's on T30 drop, since the requirements those tests prove already state it and another test proves the merged requirement.
18. **Harness and contract files get no record of their own:** the stability, accessibility and performance harnesses (C33, C35, C38) and the engine's perf script (C05) are test code the tests' run by names; `types.ts` (C02) and `contract.ts` (C61) are named in the descriptions of the projection and endpoint handlers whose shapes they are.
19. **Platform has no tables.** Its state is in local storage, the shell's JSON files and memory. A8's data is every product's data files, whose tables are Authoring's.
20. **Subdomain type supporting.** Platform serves the core domains and is built for Lathe, but isn't what makes Lathe worth having.
21. **Terms are added** (twelve), since Platform had no glossary and its words (panel, pane, keymap, write) recur in every domain's specs.
22. **Engine tests are api for use cases,** as la-chk.md levels them: they call the package's API in process. The perf script is api too; the merge test, which runs git, and the CLI test are e2e-api.

## Findings in the code
- **No event code.** Themes, windows and writes change state directly; none of the six events is raised by name, so all show as not built.
- **A recent folder's "Opened" time isn't stored.** `recent-folders.json` keeps the order only.
- **Overrides of key bindings have no command.** A person edits `lathe:keybindings` in local storage by hand, as the shortcuts sheet explains; nothing in the app writes it, so A3 has no command.
- **`lathe init` writes the config and then the product through the store,** not in one transaction: a refused product leaves the config written (CMD21's exception).
- **The Panel aggregate has no type in the code;** its state is a set of local storage keys, so EN02 has no data model record.
- **Policies run inline.** PO01 to PO03 are code in `main.ts` run as the window opens or closes, not handlers of events.

## Cross-domain items to resolve

| # | What | With |
| --- | --- | --- |
| 1 | RM01 is filled from `LA-AUT-EV01` Record changed, `LA-AUT-EV03` Schema changed and `LA-CHK-EV01` Check changed, which must be published (la-chk.md publishes EV01 for this) | AUT, CHK |
| 2 | la-exp.md writes `LA-PAT-APP-UX-R04-T01`, `R08-T01`, `R11-T01` and `R12-T01` in `LA-EXP`, which follows no pattern. This sheet's records of the same IDs, in `LA-PLT`, take those tests' parts as notes; drop la-exp.md's four, or make LA-EXP follow the app patterns and owe all 24 rules | EXP |
| 3 | la-exp.md keeps Reader requirements as use case tests at unit level, which brief 108's levels refuse; la-trc.md, la-chk.md and this sheet move them to views | EXP |
| 4 | `LA-PLT-C37` History API is la-exp.md's QRY11-H, EP01-H and LA-INT01-AD, with its `meets` of `LA-STD-CODE-R02` and `R03` | EXP |
| 5 | Other domains' writes: la-chk.md's and la-trc.md's commands on their own tables name `store.ts` as handler, and la-exp.md's UC14 invokes "Platform's write command": that is CMD18 Apply a write, whose handler is `store.ts`. Each domain's own commands may stay (they change their aggregates) with handlers naming `store.ts`, or fold into CMD18 | CHK, TRC, EXP |
| 6 | Other domains' steps that reached E01 or E02 (`uses` from `LA-CHK-F03`, `LA-EXP-F01`, `F02`, `F07`, `LA-TRC-F03`, `F04`) invoke QRY02 or CMD18; views that used E01 need nothing | CHK, EXP, TRC |
| 7 | `LA-CHK-DF01-S02` used C01 and `LA-CHK-DF01-S05` meets `LA-STD-CODE-R03`: design flows go, so both links go with them | CHK |
| 8 | Parts of Platform's old tests that prove other domains' records: la-exp.md places T14, T21, T45, T47, T48, T49, T52, T62, T73, T76, T79, T84, T85, T86, T87, T88, T89, T103, T105, T126; la-trc.md T86; la-chk.md's UC07-R02 (the Dock badge) takes T128 step 2 (manual) and T123's badge part; la-aut.md's UC15 takes T126's and T128's `LA-AUT-UC15` parts (item 9) | EXP, TRC, CHK, AUT |
| 9 | la-aut.md leaves DR38 to this sheet: it is UC15-R16 here, and `LA-AUT-T118`'s DR38 part is a note on UC15-R16-T01. UC15-FL-S08 invokes la-aut.md's QRY05; la-aut.md's LA-INT02-AD (Finder and the clipboard, in `main.ts`) stays Authoring's; the preload's record actions are Authoring's IPC channels if it uses `ipc_channel`. For the parts la-aut.md asks this sheet to decide: T126's Open Records In part proves `LA-AUT-UC15-R02`, and T128 step 5 proves `LA-AUT-UC15-R01` (manual), each a test under that requirement in la-aut.md | AUT |
| 10 | `LA-AUT-T54`'s, `LA-AUT-T120`'s, `LA-EXP-T48`'s and `LA-EXP-T133`'s parts that proved Platform's records are UC02-R02-T03, LA-V67-R01-T04, LA-V61-R05-T01 and LA-V61-R23-T01 here | AUT, EXP |
| 11 | A10-REPO and EN16-DM name `lathe/src/config.ts` (la-aut.md hands `LA-AUT-C05` to this sheet; `LA-CHK-C11` names the same file); QRY01-H names `loadWorkspace`, as la-chk.md's QRY01-H does; RM01-PJ takes `LA-AUT-C39`'s `readRecords`, which la-aut.md leaves to this sheet or la-exp.md; LA-UI62 takes `LA-AUT-C66` (`commands.tsx`) | AUT, CHK |
| 12 | la-exp.md's LA-UI37 Space commands (`switchSpace1`…`9`) are keymap commands of A3; they stay its UI component | EXP |
| 13 | Text that names old IDs: LA-V61-R19 (`LA-EXP-DR41`), R24 (`LA-TRC-DR35`), `LA-PAT-APP-UX-R07`'s notes (`LA-EXP-DR42`), `LA-PAT-APP-UX-R12` (`LA-EXP-DR58`, `DR60`) | EXP, TRC |
| 14 | Other domains' `meets` of `LA-STD-CODE` (`LA-AUT-C57`, `C67`, `C72`, `LA-AUT-T122` to `T124`; `LA-TRC-C02`, `C03`, which la-trc.md moves to the `check` table) move with those records | AUT, TRC |

## What the plan didn't cover

| # | Need | Proposal |
| --- | --- | --- |
| 1 | What proves a standard rule: there is no test kind for it and no run by to name a check or linter | Count a standard rule as met through its `meets` links and leave proof to a later kind, or add `standard_rule_test` (one per rule) whose run by names the check, lint or test. Owner's call. |
| 2 | Pattern rule tests: one per rule and domain, where one rule has many tests in several files | One record per rule and domain naming its main file, with the others in its notes (this sheet), or let a run by name several files |
| 3 | A product kind with two possible parents (`tooling` under a UC or a view requirement) | Let a product kind's parent be a supertype such as `obligation`, or declare one kind per parent |
| 4 | `product_kind` is keyed by `name` alone, so LA and the Tool Library can't both declare `entry_point` in one store | Key it by product and name, or keep the products in separate stores (they are today) |
| 5 | Policies whose only proof is an e2e-ui or manual walk, since a policy test allows database, api or e2e-api | Allow e2e-ui and manual for policy tests, or accept the gap |
| 6 | A read model in one domain filled from other domains' published events has no `reads` and no link naming the events | A `hears` from a projection or read model to the events it is filled from |
| 7 | A value object used only inside another value object (VO62 inside VO63) | Allowed by the schema; the "nothing uses it" check should count a value object field as a use |
| 8 | An entity with no fields of its own (EN11, EN15) | Allowed; noted |

## Accounted for

### Records

| Old | Count | Where it went |
| --- | --- | --- |
| product LA | 1 | unchanged |
| role Agent, Owner, Reader | 3 | unchanged |
| domain LA-PLT | 1 | LA-PLT, subdomain supporting |
| aggregate A1 Workspace | 1 | RM01 (judgment call 1) |
| aggregate A2, A3, A4, A6, A7, A8 | 6 | kept; A3 retitled Keymap, A4 Appearance |
| aggregate A5 Control | 1 | dropped; its rules → LA-V61-R44 to R48 (judgment call 3) |
| entity EN01 | 1 | RM01's fields |
| entity EN02, EN03, EN04, EN06, EN08, EN10, EN11, EN12, EN13 | 9 | kept; EN03, EN12 retitled; EN06 now a child |
| entity EN05 Hint | 1 | RM02 Keymap |
| entity EN07 Control | 1 | dropped with A5 |
| entity EN09 | 1 | moved to A9 |
| entity_field | 42 | 24 kept (EN02 2, EN03 5, EN04 2, EN06 1, EN08 3, EN09 2, EN10 3, EN12 3, EN13 3); the other 18 per "Fields that leave the entities" |
| domain_event EV01 to EV05 | 5 | unchanged |
| event_field | 15 | unchanged |
| domain_rule DR01, DR02 | 2 | UC01-R04; merged into UC01-R03 |
| domain_rule DR03 | 1 | LA-V61-R05 |
| domain_rule DR04 | 1 | INV01 |
| domain_rule DR05 | 1 | merged into LA-V61-R09 (UC04-R03) |
| domain_rule DR06 | 1 | VO61-C02; its last clause → LA-V61-R09 |
| domain_rule DR07 | 1 | LA-V61-R15 |
| domain_rule DR08, DR09 | 2 | DS01 |
| domain_rule DR10 | 1 | LA-V61-R16 |
| domain_rule DR11 | 1 | VO62-C01 |
| domain_rule DR12 | 1 | INV02 |
| domain_rule DR13 | 1 | VO63-C01; its third sentence → INV02 |
| domain_rule DR14, DR15 | 2 | INV03, INV04 |
| domain_rule DR16 | 1 | merged into LA-V61-R18 (UC08-R02) |
| domain_rule DR17 | 1 | merged into LA-V61-R42 (UC10-R03) |
| domain_rule DR18, DR19 | 2 | LA-V61-R38, R39 |
| domain_rule DR20 | 1 | merged into `LA-PAT-APP-UX-R09` |
| domain_rule DR21 to DR25 | 5 | LA-V61-R44 to R48 |
| domain_rule DR26 | 1 | SP01 |
| domain_rule DR27 | 1 | INV05 |
| domain_rule DR28 | 1 | CMD12 (saving) and DS03 (placing) |
| domain_rule DR29, DR30 | 2 | UC11-R05, UC11-R06 |
| domain_rule DR31 | 1 | INV14 |
| domain_rule DR32 | 1 | DS04 |
| domain_rule DR33 | 1 | INV06 |
| domain_rule DR34 | 1 | SP02 |
| domain_rule DR35 | 1 | PO02 |
| domain_rule DR36 | 1 | VO65-C01; its "own page" → CMD13 |
| domain_rule DR37 | 1 | LA-V71-R03 |
| domain_rule DR38 | 1 | UC15-R16 |
| domain_rule DR39 | 1 | LA-V69-R02 |
| domain_rule DR40 | 1 | UC15-R15 |
| domain_rule DR41 to DR47 | 7 | INV07 to INV13 |
| capability CAP01 to CAP04 | 4 | unchanged |
| use_case UC01 to UC16 | 16 | unchanged |
| use_case_actor | 18 | unchanged |
| use_case_step UC02 1 to 3 | 3 | folded into UC02-FL's steps; the kind goes |
| requirement | 85 | 22 kept as UC requirements (UC01-R03 gains text); 63 moved to view requirements (Views above) |
| flow F01 | 1 | split into UC01-FL and UC02-FL |
| flow F02, F03, F04, F06, F07 | 5 | UC05-FL, UC07-FL, UC08-FL, UC12-FL, UC16-FL |
| flow F05 | 1 | split into UC11-FL, UC13-FL, UC14-FL, UC15-FL |
| flow_step F02-S01 to S04 | 4 | UC05-FL-S01 to S04 |
| api API01 | 1 | dropped: the API grouping goes; its text → the endpoints |
| api_shape | 4 | folded into EP01's and EP02's descriptions |
| endpoint E01, E02 | 2 | EP01, EP02 |
| interaction_requirement E01-R01, E02-R01, E02-R02 | 3 | EP01-R01, EP02-R01, EP02-R02 |
| layer LAY01 to LAY11 | 11 | dropped: layers go |
| component C01, C04 | 2 | RM01-PJ, QRY01-H |
| component C02 | 1 | named by RM01-PJ (judgment call 18) |
| component C03 | 1 | CMD17-H, LA-PLT-CLI01 |
| component C05 | 1 | UC01-R03-T01's file (judgment call 18) |
| component C06 | 1 | QRY02-H, EP01-H, EP02-H |
| component C07, C13, C19, C36 | 4 | LA-UI61; CMD02-H; C19 also CMD01-H with C10 |
| component C08 | 1 | LA-PLT-ENTRY04 |
| component C09 | 1 | EP01-CL |
| component C10 | 1 | A2-REPO, CMD01-H |
| component C11 | 1 | A3-REPO, EN03-DM, EN04-DM, VO61-VT, QRY03-H |
| component C12, C16 | 2 | LA-UI62 |
| component C14, C17 | 2 | LA-UI63 |
| component C15 | 1 | DS01-SV; its space commands in A3-REPO |
| component C18 | 1 | LA-UI64 |
| component C20 | 1 | VO62-VT, VO63-VT, EN06-DM |
| component C21 | 1 | LA-UI70 |
| component C22 | 1 | A4-REPO, EN14-DM |
| component C23 | 1 | CMD03-H to CMD09-H, QRY04-H, QRY05-H |
| component C24 | 1 | LA-UI73 |
| component C25 | 1 | LA-UI74 |
| component C26 | 1 | DS02-SV |
| component C27 | 1 | LA-UI71 |
| component C28 | 1 | LA-UI65 |
| component C29 | 1 | LA-UI66 |
| component C30 | 1 | LA-UI67 |
| component C31 | 1 | LA-UI72 |
| component C32, C39 | 2 | LA-UI68 |
| component C33, C35, C38 | 3 | dropped: test harnesses the tests' run by names (judgment call 18) |
| component C34 | 1 | LA-UI69 |
| component C37 | 1 | la-exp.md's QRY11-H, EP01-H, LA-INT01-AD (cross-domain item 4) |
| component C40 | 1 | CMD10-H, CMD11-H, CMD12-H, CMD14-H, CMD20-H, QRY06-H, PO01-H to PO03-H, DS04-SV, EN08-DM, INT61-AD, LA-PLT-ENTRY01 |
| component C41 | 1 | SP01-PR, A9-REPO, EN15-DM, CMD19-H |
| component C42 | 1 | A6-REPO, VO64-VT, DS03-SV |
| component C43 | 1 | CMD15-H, CMD16-H, EN10-DM |
| component C44 | 1 | SP02-PR |
| component C45, C46 | 2 | LA-UI78 |
| component C47 | 1 | LA-PLT-IPC01, IPC02; the rest described on LA-UI75 and LA-UI78 |
| component C48, C49, C57, C60 | 4 | Tooling records |
| component C50 | 1 | VO65-VT, CMD13-H, LA-UI77 |
| component C51 | 1 | LA-UI75 |
| component C52 | 1 | LA-UI76 |
| component C53 | 1 | LA-UI80, CMD14-H; its `badgeFor` and `badgeText` are la-chk.md's QRY03-H |
| component C54 | 1 | LA-PLT-ENTRY02 |
| component C55, C56 | 2 | LA-UI79 |
| component C58 | 1 | LA-PLT-ENTRY03 |
| component C59 | 1 | CMD18-H, A8-REPO, EN11-DM, EN12-DM, EN13-DM |
| component C61 | 1 | named by EP01-H and EP02-H (judgment call 18) |
| pattern LA-PAT-APP-CODE, LA-PAT-APP-UX | 2 | unchanged |
| pattern_rule | 24 | unchanged |
| standard LA-STD-CODE, standard_rule R01 to R03 | 1, 3 | unchanged |
| test LA-PLT-T01 to T160 (T11 is unused) | 159 | 204 test records (Test plan above); their parts proving other domains' records go to those sheets (cross-domain item 8) |

### Links

| Old link | Rows | Where it went |
| --- | --- | --- |
| has_many EN03→EN04, EN11→EN12, EN11→EN13 | 3 | unchanged |
| has_many EN03→EN05 | 1 | dropped with EN05 |
| has_many EN08→EN09 | 1 | EN15→EN09 |
| relates_to (16 rows: PLT-A1 with AUT-A1, A3, A6, A7, CHK-A1, A2, EXP-A1, TRC-A1 to A3; PLT-A3, A5 → EXP-A1; A5→A3; A6→A7; A8→A1) | 16 | A6→A7 → EN08's Server field (→ A7); the rest dropped: A1 is a read model filled from published events, A5 is gone, and A3's and A8's relations are through commands (decision 7) |
| refers_to CHK-EN02→EN01, EXP-EN01→EN01, EN02→EXP-EN01, EN05→EN04 | 4 | dropped: EN01 and EN05 left the entities; a panel shows a page but doesn't reference one |
| reacts_to A1→`LA-AUT-EV01`, `EV03`, `LA-CHK-EV01`; C09→ the same three | 6 | dropped: RM01's projection is filled from them (cross-domain item 1), and the page reloads through QRY02 (UC03-FL-S02); no command is invoked |
| reacts_to A6→EV04, A7→EV04 | 2 | PO01 |
| reacts_to A7→EV05, C40→EV05 | 2 | PO02 |
| reacts_to C41→EV04 | 1 | PO03 |
| reacts_to C23→EV01, C23→EV02 | 2 | dropped: the provider applies the choice inside CMD03's and CMD04's handlers; nothing else hears them |
| applies UC→DR (51 within Platform, 5 to others, 8 from others) | 64 | dropped: a use case changes nothing; its steps invoke commands, which check the specifications and keep their aggregates' invariants |
| follows LA-PLT→LA-PAT-APP-CODE, LA-PAT-APP-UX | 2 | unchanged |
| carries_out F01→UC01, UC02; F02→UC05; F03→UC07; F04→UC08; F05→UC11, 13, 14, 15; F06→UC12; F07→UC16 | 11 | each flow's parent (Flows above) |
| carries_out `LA-CHK-F03`→UC03; `LA-EXP-F02`→UC04, UC06, UC09, UC10 | 5 | replaced by UC03-FL, UC04-FL, UC06-FL, UC09-FL, UC10-FL |
| fulfills F→UC requirement (F03 7, F04 7) | 14 | dropped: those requirements moved to views (LA-V61, V62, V63), which steps don't fulfill; UC07-FL's and UC08-FL's steps happen in those views |
| fulfills F02-S01 to S04 → UC05-R01 to R04 | 4 | likewise: UC05's requirements are LA-V61-R13, R14, LA-V64-R02 and LA-V65-R01, and UC05-FL's steps happen in those views |
| fulfills F02 steps → DR07, DR08, DR09, DR10 | 4 | dropped: DR07 and DR10 are LA-V61-R15, R16; DR08 and DR09 are DS01, called by QRY03, which the steps invoke |
| fulfills `LA-CHK-F03`→UC03-R01 | 1 | UC03-FL-S02 |
| fulfills E02→UC16-R01, E01-R01→UC03-R01, E02-R01→UC16-R01, E02-R02→UC16-R02 | 4 | dropped: steps reach endpoints through their command or query (UC16-FL-S02, S03; UC03-FL-S02) |
| uses F02→`LA-EXP-V01`, `V03`; F02-S01→`V03`, F02-S03→`V01`; F05→`LA-TRC-V01` | 5 | the steps' views (UC05-FL); F05's dropped (the window shows every page) |
| uses F02-S01→C14, C17; S02→C16; S03→C14, C15; S04→C15, C16 | 7 | dropped: steps use no code; the UI components render the views they happen in |
| uses F07→E02 | 1 | UC16-FL-S02 invokes CMD18 |
| uses other domains' flows and views → E01, E02 (`LA-CHK-F03`, `LA-CHK-V01`, `LA-EXP-F01`, `F02`, `F07`, `LA-EXP-V01` to `V05`, `LA-TRC-F03`, `F04`, `LA-TRC-V01`) | 13 | cross-domain item 6 |
| uses `LA-CHK-DF01-S02`→C01 | 1 | cross-domain item 7 |
| implements C06→E01, E02; C08→E01 | 3 | EP01-H, EP02-H (ENTRY04 hosts the same API in development) |
| implements C07→`LA-EXP-V01` | 1 | LA-UI61 |
| implements C37→`LA-EXP-E01` | 1 | cross-domain item 4 |
| depends_on (50 within Platform, 11 to others, 22 from others) | 83 | dropped: what code uses follows from the tree |
| satisfies component→rule, requirement, interaction requirement (Platform's components 205, others' to Platform's records 36) | 241 | replaced by the technical record implementing each obligation's design kind |
| satisfies Platform component→pattern rule | 13 | dropped: pattern rules need proof only; the code's comments keep naming them |
| covers test→component | 24 | dropped: a test proves its parent; technical kinds have no tests of their own (decision 20) |
| meets C01→STD-CODE-R03; C37→R02, R03; C44→R03 | 4 | RM01-PJ→R03, SP02-PR→R03; C37's two → cross-domain item 4 |
| proves Platform test→Platform record | 211 | each new test's parent (Test plan above), less the duplicates dropped in judgment call 17 |
| proves Platform test→pattern rule | 66 | the 24 pattern rule tests and their notes |
| proves Platform test→another domain's record | 28 | cross-domain item 8 |
| proves other domains' tests→Platform records and pattern rules | 11 | cross-domain items 2, 9 and 10 |
