# Conversion: LA-PLT Platform, and LA's patterns, standards and roles

The sorting sheet for brief 107. It lists Platform's complete new spec, kind by kind in the plan's order ([domain-model-refinement.md](../plans/domain-model-refinement.md)), with each row's old source, then LA's product-level records this sheet owns: the roles, the two patterns and their rules with the pattern rule tests that prove them, and the standard and its rules. It follows the Tool Library's sheet ([tool-library.md](tool-library.md)) and closes with a table that accounts for every old record and link of these records.

Brief 111 applies this sheet together with the other four domains' sheets.

## Conventions
- **Source** names the old record (`DR04`, `UC05-R02`, `C11` and so on, all `LA-PLT-` unless written in full) or the code (`app/src/…`, `desktop/src/…`, `lathe/src/…`).
- **IDs** are written short in tables; in full they start `LA-PLT-` (domain-scoped records) or `LA-` (product-scoped ones).
- **Provisional IDs.** Records with no owner take product-scoped IDs (`LA-VO<nn>`, `LA-V<nn>`, `LA-INT<nn>`, `LA-UI<nn>`), and the five sheets can't number them without clashing. This sheet writes them `LA-VO{k}`, `LA-V{a}`, `LA-INT{b}`, `LA-UI{c}` and so on, with a letter that stays fixed within the sheet; the apply step gives them their numbers and replaces every mention.
- **Types** are the schema's basic types (text, whole number, decimal, date, time, date and time, yes/no), a value object (`VO{k}`…) or a reference to an aggregate (`→ A7`…).
- **Optional** marks a field with `required: false`; every other field is required.
- **New** marks a row with no old record.
- **To resolve** marks a link to another domain's record by its old ID, for the apply step.

## Product, roles and domain

| ID | Kind | Title | Fields | Source |
| --- | --- | --- | --- | --- |
| LA | Product | Lathe | description and notes as today | product (no change from this sheet; its notes' domain list stays true) |
| Agent | Role | Agent | | role |
| Owner | Role | Owner | | role |
| Reader | Role | Reader | | role |
| LA-PLT | Domain | Platform | subdomain type **supporting**; description as today, with "the command layer every write goes through" kept and nothing about layers; notes as today | domain |

There are no open questions: LA has no `question` rows today, and this sheet adds none.

## Domain model

### Aggregates

| ID | Title | Parent | Identity | Source |
| --- | --- | --- | --- | --- |
| A2 | Panel | LA-PLT | Which panel it is | A2, unchanged |
| A3 | Keymap | LA-PLT | Command ID | A3 "Command", retitled so it doesn't clash with the model's own Command kind (judgment call 4). Description: the keyboard commands with their bindings; every binding and hint reads from it. |
| A4 | Appearance | LA-PLT | One per person | A4 "Theme", retitled: the person's themes, the theme chosen and the color mode, which belong to the person rather than to one theme (judgment call 5) |
| A6 | Product window | LA-PLT | Folder | A6, without the recent folders (now A9) |
| A7 | App server | LA-PLT | Folder and port | A7. Description gains `lathe serve`, which runs the same `serve()` (CMD17). |
| A8 | Command layer | LA-PLT | none: a write is the commit or the moment that changed the files | A8, unchanged |
| A9 | Recent folders | LA-PLT | One per shell | **New**: EN09 and DR31 move here from A6, since the list belongs to the shell, not to one window (judgment call 6) |
| A10 | Product repo | LA-PLT | Root folder | **New**: the repo `lathe init` sets up and whose config names its data folder (UC02-R01, R02) |

A1 Workspace becomes the read model RM01 (judgment call 1). A5 Control goes: it changes nothing and has no commands, and its rules become UC10's requirements (judgment call 3).

### Entities

| ID | Title | Parent | Role | Has value objects | Source |
| --- | --- | --- | --- | --- | --- |
| EN02 | Panel | A2 | root | | EN02 |
| EN03 | Keyboard command | A3 | root | | EN03 "Command", retitled |
| EN04 | Key binding | A3 | child | VO{k} Key binding | EN04 |
| EN06 | Theme | A4 | child | VO{f} Theme file | EN06, now a child of the new root EN14 |
| EN08 | Product window | A6 | root | VO{b} Window bounds, VO{c} Window chrome | EN08 |
| EN09 | Recent folder | A9 | child | | EN09, moved from A6 (same domain, so its ID stays) |
| EN10 | App server | A7 | root | | EN10 |
| EN11 | Write | A8 | root | (none: no stored fields) | EN11 |
| EN12 | Write command | A8 | child | | EN12 "Command", retitled |
| EN13 | Refusal | A8 | child | | EN13 |
| EN14 | Appearance | A4 | root | | **New** |
| EN15 | Recent folders | A9 | root | (none: the list is its children) | **New** |
| EN16 | Product repo | A10 | root | | **New** |

None has a table: Platform's state lives in local storage, the shell's JSON files and memory, not in a database (judgment call 17). The `has_many` links EN03→EN04, EN11→EN12 and EN11→EN13 stay; EN08→EN09 becomes EN15→EN09; EN03→EN05 goes with EN05.

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
| EN04 | 1 | Keys | VO{k} Key binding | The chord, or chords in sequence, as the keymap writes them. | Mod+Shift+P | EN04 field 1 |
| EN04 | 2 | Off a Mac | VO{k} Key binding, optional | Its keys on other platforms, where they differ. | Alt+G | **New**: `Command.otherKeys` |
| EN04 | 3 | Override | VO{k} Key binding, optional | The person's own binding in its place. | | field 2 |
| EN14 | 1 | Chosen theme | text | The theme in use, by its ID; Lathe when it is gone (INV04). | workshop | **New**: A4's description; `ThemeState.chosen` |
| EN14 | 2 | Color mode | text | System (the default, following the system), Light or Dark. | system | **New**: EV02's Mode; `ThemeState.mode` |
| EN06 | 1 | Theme ID | text | The theme's ID: a built-in's name, or `custom-` and a name for one of the person's own. | custom-workshop-copy | **New**: `Theme.id` |
| EN06 | 2 | File | VO{f} Theme file | The theme itself: its name, its light and dark colors and its shared tokens. | | EN06 fields 1, 3 and 4 |
| EN06 | 3 | Built in | yes/no | Whether Lathe ships it, so it is never changed (INV03). | no | field 2 |
| EN06 | 4 | Based on | text, optional | The built-in theme a copy was made from, which Reset puts back. | workshop | **New**: `Theme.basedOn` |
| EN08 | 1 | Folder | text | The product folder it shows. | ~/Development/tool-library | EN08 field 1 |
| EN08 | 2 | Bounds | VO{b} Window bounds | Its saved size and place, and whether it was maximized or full screen. | 120, 80, 1280, 840 | field 2 |
| EN08 | 3 | Server | → A7 App server | Where it loads Lathe from. | | field 3 |
| EN08 | 4 | Chrome | VO{c} Window chrome, optional | The colors its own page last sent for its background and window controls. | #f4f1ea, #1d1b16 | **New**: DR36 |
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
| EN16 | 2 | Data folder | text | Where its data files are, as `lathe.config.json`'s `data` names it; `data` unless set. | data | **New**: UC02-R02; old EN01 field 1 |

Fields that leave the entities, because they are derived or belong elsewhere:

| Old field | Goes to |
| --- | --- |
| EN01 Data folder, Refusals, Errors | RM01 Workspace's fields (and EN16 Data folder) |
| EN04 On a Mac, Elsewhere, ARIA name (derived) | DS01 Key display, and RM02 Keymap's Shown keys and ARIA keys |
| EN05 Where, Shows (derived) | RM02 Keymap: every hint is a row of it read where it shows |
| EN06 Name, Light and dark tokens, Shared tokens | VO{f} Theme file's fields, the shape the code stores and exports |
| EN07 Role, Name, Target, Keys | dropped with A5; the rules on them are UC10-R05 to R08 |
| EN11 Commands | the `has_many` EN11→EN12: a write's commands are its children |
| EN11 Tables changed, Files rewritten (derived) | EV06 Data written's fields |

### Value objects and constraints

| ID | Kind | Title | Parent | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| LA-VO{k} | Value object | Key binding | (used by EN04) | A chord such as Mod+Shift+P, or chords separated by spaces for a sequence. "Mod" is Cmd on a Mac and Ctrl elsewhere. | **New**: EN04 field 1's type |
| LA-VO{k}-C01 | Constraint | A binding is written as chords the keymap reads | VO{k} | A binding MUST be one chord, or chords separated by spaces, each its modifiers then one key, joined by `+`, and is kept in the keymap's normal form. | **New**: EN04 field 1's type, UC04-R01's "Mod" |
| LA-VO{k}-C02 | Constraint | A binding never takes a browser's essential key | VO{k} | No binding, default or overridden, MAY take Cmd/Ctrl+W, T, L, R, N or Q, Tab, F5 or F11, or a key reserved for the browser on the current platform (Ctrl+G off a Mac). | DR06's first clause, UC04-R07's last sentence |
| LA-VO{t} | Value object | Token values | (used by VO{f}) | A map from token names in the app's token table to values. | **New**: EN06 fields 3 and 4's types |
| LA-VO{t}-C01 | Constraint | Token values name known tokens, each with a value of its kind | VO{t} | Token values MUST name only tokens of the app's token table, each with a value that is exactly a value of its kind, and MUST NOT carry selectors, rules or any other text. | DR11 |
| LA-VO{f} | Value object | Theme file | (used by EN06) | A theme as data, as it is stored, exported and imported. Fields: Format (text), Version (whole number), Name (text), Light (VO{t}), Dark (VO{t}), Tokens (VO{t}). | **New**: EN06's fields; `ThemeFile` |
| LA-VO{f}-C01 | Constraint | A theme file says its format and version and holds known fields only | VO{f} | A theme file MUST be JSON with `format` "lathe-theme", `version` 1, a `name` of 1 to 60 characters, and `light`, `dark` and `tokens` objects. A file with any other field MUST be refused with a message saying why. | DR13's first two sentences (its third goes to INV02) |
| LA-VO{b} | Value object | Window bounds | (used by EN08) | Where a window was and how big. Fields: X, Y, Width, Height (whole numbers, screen points), Maximized, Full screen (yes/no). | **New**: EN08 field 2's type, EV05's Bounds |
| LA-VO{c} | Value object | Window chrome | (used by EN08) | The two colors a page sends for its window. Fields: Background, Foreground (text). | **New**: DR36 |
| LA-VO{c}-C01 | Constraint | Window chrome is exactly two opaque hex colors | VO{c} | Window chrome MUST be exactly `{ background, foreground }`, each an opaque hex color (`#rgb` or `#rrggbb`); anything else is refused and changes nothing. | DR36 (its "only from the window's own page" goes to CMD13) |

### Invariants

| ID | Title | Parent | Statement | Enforced by | Source |
| --- | --- | --- | --- | --- | --- |
| INV01 | A key binding means one command wherever it applies | A3 | No two commands MAY share a binding in contexts that can be active at the same time, and no two-key sequence MAY start with a key that is a binding of its own. | `duplicateBindings` in the keymap, checked by its test | DR04 |
| INV02 | Every theme has a light set and a dark set | A4 | Every theme MUST set the core colors (shell, paper, sheet, ink, muted, rule, the accent and its tint, spark and its tint, and warning) in both its light and dark sets. Core colors a file leaves out are taken from Lathe; the other colors follow a core one or serve both modes unless the theme sets them. | `parseTheme` completes a file from Lathe | DR12, DR13's third sentence |
| INV03 | Built-in themes are never changed | A4 | A built-in theme MUST NOT be edited, renamed or deleted; it is changed by editing a copy. Reset puts a copy back to the built-in it was copied from, keeping its name. | CMD07, CMD08, CMD09 act only on the person's own themes | DR14 |
| INV04 | The chosen theme always exists | A4 | When the chosen theme no longer exists (deleted, or its stored data no longer reads), Lathe MUST be shown and chosen. | `ThemeProvider`'s `active`; `themeStore` drops themes that no longer read | DR15 |
| INV05 | Each folder has one window | A6 | No two product windows MAY show the same folder, however its path is spelled; opening a folder that has a window brings that window forward. | CMD10 looks for the folder's window first | DR27 |
| INV06 | A server the shell starts never listens on 5199 | A7 | Every server the shell starts MUST listen on a free local port other than 5199, the Owner's own dev server, which the shell may only share (SP02). | `freePort` | DR33 |
| INV07 | A write is all or nothing | A8 | A write's commands MUST all take effect or none: when one is refused, the data and every data file stay as they were. | CMD18's one transaction | DR41 |
| INV08 | A write is checked whole before any file changes | A8 | Each write MUST build the new state in one transaction, with every key, constraint and validation query of the schema, and MUST rewrite a data file only after the whole state passes. | CMD18 | DR42 |
| INV09 | A write rewrites only its tables' files, in one fixed form | A8 | A write MUST rewrite only the data files of the tables it changed, each through a temporary file and a rename, rows sorted by key and columns in the table's order, so the same data always gives the same file and a changed row is a one-line diff. | A8-REPO | DR43 |
| INV10 | Writes run one after another | A8 | Writes to one store MUST run one at a time, each on the state the one before it left, so two writers never lose each other's change. | the store's write queue | DR44 |
| INV11 | A refusal names every problem and where it is | A8 | A refused write or load MUST name every problem it found, each with its rule, a message naming the table, row and value, and the data file and line of a loaded row or the index of the command that brought it. | `StoreError` | DR45 |
| INV12 | A record changes parent only by a move, which carries what sits inside | A8 | `set` MUST NOT change a row's key or a record's parent columns. `move` MUST give the record its new parent's column and clear the other, and the records inside it keep their parents and take the new scope. | CMD18 | DR46 |
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
| EV05 | 2 | Bounds | VO{b} Window bounds | field 2 |
| EV05 | 3 | Closed at | date and time | field 3 |
| EV06 | 1 | Tables changed | text | **New**: EN11 field 2 |
| EV06 | 2 | Files rewritten | text | **New**: EN11 field 3 |

Meanings and examples carry over unchanged; EV06's come from EN11's.

### Commands

Each command changes one aggregate. Found in the code.

| ID | Title | Parent | Raises | Checks | Uses | Source |
| --- | --- | --- | --- | --- | --- | --- |
| CMD01 | Resize a panel | A2 | | | | `usePanelSize` and `ResizeHandle`; UC06. Description: by drag or keys, within the panel's limits; double-click resets it; a drag below the fold threshold hides it instead (CMD02). |
| CMD02 | Show or hide a panel | A2 | | | | `toggleNav`, `toggleSideBar`, the view toggles and full screen; UC04, UC06, UC13, UC14 |
| CMD03 | Choose a theme | A4 | EV01 | | | `ThemesApi.choose`; UC07 |
| CMD04 | Choose a color mode | A4 | EV02 | | | `ThemesApi.setMode`; UC07 |
| CMD05 | Duplicate a theme | A4 | EV03 | | | `ThemesApi.duplicate`; UC07 |
| CMD06 | Import a theme file | A4 | EV03 | | | `ThemesApi.importFile`; UC07 |
| CMD07 | Edit a theme | A4 | | | DS02 | `ThemesApi.update` (its tokens or its name); UC07 |
| CMD08 | Reset a theme | A4 | | | | `ThemesApi.reset`; UC07 |
| CMD09 | Delete a theme | A4 | | | | `ThemesApi.remove`; UC07 |
| CMD10 | Open a product folder | A6 | EV04 | SP01, and INV05 | DS03, DS04 | `openFolder` in `desktop/src/main.ts`; UC11, UC15 |
| CMD11 | Close a product window | A6 | EV05 | | | the window's close handler in `main.ts`; UC11 |
| CMD12 | Save a window's place | A6 | | | | `saveBounds`; DR28's first sentence: its size, place, and maximized or full screen are saved as it moves, resizes, enters or leaves full screen and closes |
| CMD13 | Set a window's chrome | A6 | | | | `applyChrome`, from `setChrome`; UC14-R06. Description keeps DR36's "only from the window's own page". |
| CMD14 | Report a window's error count | A6 | | | | `setErrorCount` and the `lathe:error-count` handler; UC15-R13 |
| CMD15 | Start a window's app server | A7 | | SP02, and INV06 | | `startServe`, `startDev`, `chooseDevSource`; UC11, UC12 |
| CMD16 | Stop a window's app server | A7 | | | | `AppServer.stop`; DR35 |
| CMD17 | Serve a product repo | A7 | | | | `serve()` and `lathe serve`; UC02-R04 |
| CMD18 | Apply a write | A8 | EV06 | (INV07 to INV13) | | `Store.apply`, and `add`, `set`, `move`, `link`, `unlink` and `remove` as writes of one command; UC16 |
| CMD19 | Add a recent folder | A9 | | (INV14) | | `addRecent`, `rememberRecent`; UC11-R03 |
| CMD20 | Clear the recent folders | A9 | | | | Open Recent › Clear Menu (`clearRecent`); UC11-R03 |
| CMD21 | Set up a product repo | A10 | | | | `lathe init`; UC02-R01. A recorded exception (`command_change`): it also changes A8, adding the product's first record through the command layer, because a repo must never be left set up without its product. |

### Read models and fields

| ID | Title | Parent | Reads | Source |
| --- | --- | --- | --- | --- |
| RM01 | Workspace | LA-PLT | (none of Platform's: see below) | A1 and EN01 (judgment call 1); the `Workspace` contract in `lathe/src/types.ts` |
| RM02 | Keymap | LA-PLT | A3 | **New** as a kind: EN05 Hint and EN04's derived fields; `resolveCommands` |
| RM03 | Themes | LA-PLT | A4 | **New** as a kind: the Appearance page's list and the theme picker |
| RM04 | Dock badge | LA-PLT | A6 | **New** as a kind: DR37's badge; `badgeFor` |
| RM05 | Recent folders | LA-PLT | A9 | **New** as a kind: File › Open Recent and the Dock menu |

RM01 reads every product's records, which are other domains' aggregates: it is filled from their data files whenever they change, so it hears AUT's Record changed and Schema changed and CHK's Check changed (`LA-AUT-EV01`, `LA-AUT-EV03`, `LA-CHK-EV01`, to resolve), and Platform's own EV06. Those events must be published for a Platform read model to use them (cross-domain item 1).

| Read model | # | Name | Type | Meaning | Source |
| --- | --- | --- | --- | --- | --- |
| RM01 | 1 | Data folder | text | Where the product's data files were read from, as `lathe.config.json` names it. | EN01 field 1 |
| RM01 | 2 | Records | text | Every record with its kind, columns, part rows, parent, product and domain. | **New**: A1's description; `Workspace.records` |
| RM01 | 3 | Links | text | Every link, with its relation and both ends. | **New**: A1's description |
| RM01 | 4 | Problems | text | Every problem: its severity, check, record and message. | **New**: A1's description |
| RM01 | 5 | Coverage | text | Per domain and obligation kind: designed, built, proved and the gaps. | **New**: A1's description |
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
| RM04 | 1 | Badge | text, optional | The error count of the focused product window, or of the one focused last, as the Dock shows it ("999+" above 999). | **New**: DR37; `badgeText` |
| RM05 | 1 | Folder | text | A recent folder, latest first. | **New**: EN09 |
| RM05 | 2 | Shown as | text | The folder with the home folder as `~`. | **New**: `displayPath` |

### Queries

| ID | Title | Parent | Selects by | Uses | Source |
| --- | --- | --- | --- | --- | --- |
| QRY01 | Load the workspace | RM01 | | | `loadWorkspace(root)`; UC01 |
| QRY02 | Get the product's data | RM01 | | | `GET /api/spec`'s `SpecData`; UC03, E01 |
| QRY03 | List the commands | RM02 | | DS01 | `resolveCommands`; the palette, the sheet and every hint; UC04, UC05 |
| QRY04 | List the themes | RM03 | | | `ThemesApi.themes`, `active`; UC07 |
| QRY05 | Export a theme file | RM03 | | | `ThemesApi.exportFile`; UC07-R06 |
| QRY06 | Show the Dock badge | RM04 | | | `badgeFor`, `badgeText`; UC15-R13 |
| QRY07 | List the recent folders | RM05 | | | Open Recent's items in `refreshMenu`; UC11-R03 |

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
| DS04 | Folder to open at launch | LA-PLT | CMD10 | On launch, opens a folder named on the command line or dropped on the Dock icon; else the most recent folder that still opens; else, run from Lathe's own repo, that repo; else asks for a folder. | DR32; `openOnLaunch` |

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

All sixteen carry over with their titles, capabilities, goals, actors and notes: UC01 (Agent), UC02 (Owner, Agent), UC03 to UC11 (Reader), UC12 (Owner), UC13, UC14 (Reader), UC15 (Owner), UC16 (Agent, Owner). UC08's and UC10's goals keep their links to `notes/mobile-design.md` and `notes/a11y-audit.md`.

### UC requirements

All 85 carry over with their IDs, titles, groups and statements, except as below. Seventeen are new, each from a domain rule that states what a use case's actor gets rather than a rule of an aggregate (judgment call 3).

| ID | Group | Title | Statement | Source |
| --- | --- | --- | --- | --- |
| UC01-R03 | | Loading is fast enough to reload live | As today, with DR02's detail added: on the dev machine, as `npm --prefix lathe run test:perf` measures; every check still runs on every load; a busy machine (a one-minute load average above 12) is measured but not judged, and a budget is never loosened. Its mention of `LA-PLT-DR02` goes. | UC01-R03, DR02 |
| UC01-R04 | | Each load reads the data files afresh and writes nothing | DR01's statement. | **New**: DR01 |
| UC04-R03 | | Shortcuts never get in the way of typing or of the browser | As today, with DR05's list: a shortcut without Ctrl, Cmd or Alt (a letter, a symbol, a sequence such as `g c`) MUST NOT fire while focus is in a text input, a text area, a select or editable text; Alt+Left and Alt+Right still go back and forward. | UC04-R03, DR05, DR06's last clause |
| UC05-R05 | | Every hint reads from the keymap | DR07's statement. | **New**: DR07 |
| UC05-R06 | | A tooltip never gets in the way | DR10's statement. | **New**: DR10 |
| UC06-R04 | | Hiding a panel gives its space away and loses nothing | DR03's statement. | **New**: DR03 |
| UC08-R02 | Layout | A phone shows one view at a time, switched from the page bar | As today, with DR16's last sentence: the views a page has open on a wide screen are not lost by reading it on a phone. | UC08-R02, DR16 |
| UC09-R12 | Loading | The frame of a page holds still | DR18's statement. | **New**: DR18 |
| UC09-R13 | Canvases and overlays | A bar keeps one height, and a scroll box its gutter | DR19's statement. | **New**: DR19 |
| UC10-R03 | | Focus lands where the Reader expects | As today; DR17's list of sheets (the nav, the side bar, the open pages, quick find) is added to its dialogs. | UC10-R03, DR17 |
| UC10-R05 | | A control's name holds its visible text | DR21's statement. | **New**: DR21 |
| UC10-R06 | | No control inside another | DR22's statement. | **New**: DR22 |
| UC10-R07 | | A box that scrolls can be reached by keyboard | DR23's statement. | **New**: DR23 |
| UC10-R08 | | A target is at least 24 px, or has room around it | DR24's statement. | **New**: DR24 |
| UC10-R09 | | Text sits only on the surfaces the theme vouches for | DR25's statement. | **New**: DR25 |
| UC11-R05 | | The page reaches the shell only through window.latheDesktop | DR29's statement. | **New**: DR29 |
| UC11-R06 | | Links that leave the app open in the system browser | DR30's statement. | **New**: DR30 |
| UC15-R13 | | The Dock badge follows the window in front | DR37's statement. | **New**: DR37 |
| UC15-R14 | | A launch, error or About page runs only the buttons it shows | DR39's statement. | **New**: DR39 |
| UC15-R15 | | macOS keeps no window state for Lathe | DR40's statement. | **New**: DR40 |
| UC15-R16 | | A record action names only a record ID, and the shell finds its data file | DR38's statement. | **New**: DR38 |

Statements that name an old ID change with it: UC08-R03 `LA-EXP-DR41`, UC08-R08 `LA-TRC-DR35` (to resolve, by those sheets); UC08-R09 and UC08-R10 keep `LA-PAT-APP-UX-R04` and `R07`, UC09-R11 keeps `LA-PAT-APP-UX-R11`. UC15's numbers R02, R03, R07 and R08 stay unused, as today.

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

Each step invokes at most one command or query and happens in at most one view. Step IDs are written short; in full they are `LA-PLT-UC01-FL-S01` and so on. Views of other domains are named by their old IDs, to resolve: `LA-EXP-V01` Specs menu (the nav and quick find), `LA-EXP-V03` Record page, `LA-EXP-V04` Graph view, `LA-EXP-V05` Model view. Platform's own views are new (Views below).

| ID | Path | Title | Invokes | In view | Fulfills | Source |
| --- | --- | --- | --- | --- | --- | --- |
| UC01-FL-S01 | main | The Agent's script calls `loadWorkspace(root)` and reads the records, links, problems and coverage | QRY01 | | UC01-R01, UC01-R04 | F01 step 3 |
| UC01-FL-S02 | refused | Data the store refuses ends the load with one `data-refused` error per refusal and no records | QRY01 | | UC01-R02 | UC01-R02 |
| UC01-FL-S03 | main | After a write, the script loads again within the budgets | QRY01 | | UC01-R03 | UC01-R03 |
| UC02-FL-S01 | main | The Owner installs the package and runs `lathe init` with the product's name and prefix | CMD21 | | UC02-R01 | F01 step 1; UC02 step 1 |
| UC02-FL-S02 | main | They set up the merge driver for the data files once per clone, as the README says | | | UC02-R05 | F01 step 1; UC02 step 1 |
| UC02-FL-S03 | main | They add the first domain and records with `lathe add`, or an Agent through the MCP tools, in the data folder the config names, with any kinds of the product's own | CMD18 | | UC02-R02, UC02-R03 | F01 step 2; UC02 step 2 |
| UC02-FL-S04 | main | They run `lathe serve` to browse and edit the spec, with no build tools in the repo | CMD17 | LA-EXP-V03 | UC02-R04 | F01 step 2; UC02 step 3 |
| UC03-FL-S01 | main | An Agent changes records through the command layer while the Reader keeps the page open | CMD18 | | | UC03's goal |
| UC03-FL-S02 | main | The server sends `spec:changed` and the open page loads the data again at the same address | QRY02 | LA-EXP-V03 | UC03-R01 | UC03-R01; `LA-CHK-F03` fulfills UC03-R01 |
| UC03-FL-S03 | refused | When the data cannot be loaded, the page says what is wrong rather than showing other data | QRY02 | LA-EXP-V03 | | UC03's goal; E01-R01 |
| UC04-FL-S01 | main | The Reader presses Cmd/Ctrl+Shift+P; the palette lists the commands that apply, from the one keymap, each with its keys for the platform | QRY03 | LA-V{c} | UC04-R01, UC04-R04, UC04-R07 | UC04's goal |
| UC04-FL-S02 | main | They run commands by their VS Code keys, such as Cmd/Ctrl+B to hide the navigation | CMD02 | LA-EXP-V03 | UC04-R02 | UC04-R02 |
| UC04-FL-S03 | main | A screen reader hears what the command changed | | LA-EXP-V03 | UC04-R06 | UC04-R06 |
| UC04-FL-S04 | typing | While they type in a search box, single-key shortcuts don't fire, and keys the app doesn't handle reach the browser | | LA-EXP-V01 | UC04-R03 | UC04-R03 |
| UC04-FL-S05 | main | They press `?`; the shortcuts sheet lists every shortcut by group, with a search and how to override a binding | QRY03 | LA-V{d} | UC04-R04, UC04-R05 | UC04-R04, R05 |
| UC05-FL-S01 | main | The Reader rests on a control and its tooltip names its keys | QRY03 | LA-EXP-V03 | UC05-R01, UC05-R06 | F02-S01 (its fulfills of DR08 and DR10 → DS01 and UC05-R06) |
| UC05-FL-S02 | main | They open the palette and read each command's keys | QRY03 | LA-V{c} | UC05-R02 | F02-S02 |
| UC05-FL-S03 | main | A screen reader hears the keys | QRY03 | LA-EXP-V03 | UC05-R03 | F02-S03 (DR09 → DS01) |
| UC05-FL-S04 | main | They rebind a key and every hint follows, the shortcuts sheet with them | QRY03 | LA-V{d} | UC05-R04, UC05-R05 | F02-S04 (DR07 → UC05-R05) |
| UC06-FL-S01 | main | The Reader drags the gap between two panels, or focuses it and steps it with the keys | CMD01 | LA-EXP-V03 | UC06-R01 | UC06's goal |
| UC06-FL-S02 | main | Lathe remembers the sizes; a double-click resets one | CMD01 | LA-EXP-V03 | UC06-R02 | UC06-R02 |
| UC06-FL-S03 | main | Dragging the navigation or the side bar small folds it away | CMD02 | LA-EXP-V03 | UC06-R03 | UC06-R03 |
| UC06-FL-S04 | main | They hide the side bar; the main view takes its room and the toggle brings it back | CMD02 | LA-EXP-V03 | UC06-R04 | DR03 |
| UC07-FL-S01 | main | The Reader presses g then t and arrows through the themes, each shown on the whole app at once | QRY04 | LA-V{b} | UC07-R01 | F03 |
| UC07-FL-S02 | main | They keep one with Enter, or put back the one before with Escape; it applies at once and before the next first paint | CMD03 | LA-V{b} | UC07-R01, UC07-R07 | F03 |
| UC07-FL-S03 | main | They switch Light, Dark or System from the palette | CMD04 | LA-V{c} | UC07-R02 | F03 |
| UC07-FL-S04 | main | They open Appearance from the nav's footer: every theme with a preview | QRY04 | LA-V{a} | UC07-R03 | F03 |
| UC07-FL-S05 | main | They duplicate the closest theme | CMD05 | LA-V{a} | UC07-R04 | F03 |
| UC07-FL-S06 | main | They change its colors, fonts and density with the app changing around them, and a warning wherever text gets hard to read | CMD07 | LA-V{a} | UC07-R04, UC07-R05 | F03 |
| UC07-FL-S07 | alternate | They reset their copy to the theme it came from | CMD08 | LA-V{a} | UC07-R04 | UC07-R04 |
| UC07-FL-S08 | alternate | They delete their copy, after being asked | CMD09 | LA-V{a} | UC07-R04 | UC07-R04 |
| UC07-FL-S09 | main | They export it to share as a file | QRY05 | LA-V{a} | UC07-R06 | F03 |
| UC07-FL-S10 | alternate | Someone else imports that file as a theme of their own | CMD06 | LA-V{a} | UC07-R06 | UC07-R06 |
| UC08-FL-S01 | main | On a phone the Reader opens Lathe: a compact top bar, the page filling the screen, text they can read | QRY02 | LA-EXP-V03 | UC08-R01, UC08-R08, UC08-R09 | F04 |
| UC08-FL-S02 | main | They tap search in the top bar, type a use case's ID and tap the result | | LA-EXP-V01 | UC08-R06 | F04 |
| UC08-FL-S03 | main | The wiki fills the screen; they tap Graph in the page bar | | LA-EXP-V03 | UC08-R02 | F04 |
| UC08-FL-S04 | main | They pinch out, tap a node to see its name, and tap Open | | LA-EXP-V04 | UC08-R07 | F04 |
| UC08-FL-S05 | main | They pull up the side bar sheet, drag it to full height, then swipe it away | CMD02 | LA-EXP-V03 | UC08-R04 | F04 |
| UC08-FL-S06 | main | They open the nav sheet from the menu button and choose the domain | CMD02 | LA-EXP-V01 | UC08-R03 | F04 |
| UC08-FL-S07 | main | The Open pages sheet takes them back to the use case they started from | | LA-EXP-V03 | UC08-R05 | F04 |
| UC08-FL-S08 | tablet | On a tablet in landscape they keep the workbench, with targets sized for a finger | | LA-EXP-V03 | UC08-R10 | UC08's goal |
| UC09-FL-S01 | main | The Reader opens a page; nothing drawn moves as the specs and fonts arrive | QRY02 | LA-EXP-V03 | UC09-R01, UC09-R12 | UC09's goal |
| UC09-FL-S02 | main | They move between records by the nav, a link, a graph click, Back and quick find; the frame stays | | LA-EXP-V03 | UC09-R02 | UC09-R02 |
| UC09-FL-S03 | main | They open, close and maximize panes and the side bar; only the panes move | CMD02 | LA-EXP-V03 | UC09-R03 | UC09-R03 |
| UC09-FL-S04 | main | They fold rows and use Expand all | | LA-EXP-V03 | UC09-R04 | UC09-R04 |
| UC09-FL-S05 | main | They resize panels, which follow the pointer | CMD01 | LA-EXP-V03 | UC09-R05 | UC09-R05 |
| UC09-FL-S06 | main | They re-center the graph, change its depth and move around the ERD; the canvas and its bars hold still | | LA-EXP-V04 | UC09-R06, UC09-R13 | UC09-R06 |
| UC09-FL-S07 | main | The specs reload while they are scrolled part-way down; what was in view stays | QRY02 | LA-EXP-V03 | UC09-R07 | UC09-R07 |
| UC09-FL-S08 | main | They open a tooltip, quick find, the palette and the sheet, each placed before it shows | | LA-EXP-V03 | UC09-R08 | UC09-R08 |
| UC09-FL-S09 | main | They switch the theme; only colors change | CMD03 | LA-V{b} | UC09-R09 | UC09-R09 |
| UC09-FL-S10 | phone | On a phone they open and close the sheets; the page behind stays | | LA-EXP-V03 | UC09-R10 | UC09-R10 |
| UC09-FL-S11 | main | Each move answers within the performance budgets | | LA-EXP-V03 | UC09-R11 | UC09-R11 |
| UC10-FL-S01 | main | The Reader tabs round the nav, the page bar, the panes and the side bar; every control is reached, named for what it shows, big enough, and never inside another, and every box that scrolls takes focus | | LA-EXP-V03 | UC10-R02, UC10-R05, UC10-R06, UC10-R07, UC10-R08 | UC10's goal |
| UC10-FL-S02 | main | They open a record from the nav or quick find; focus stays on the page | | LA-EXP-V01 | UC10-R03 | UC10-R03 |
| UC10-FL-S03 | main | They switch views and show and hide the side bar; each change is announced | CMD02 | LA-EXP-V03 | UC10-R04 | UC10-R04 |
| UC10-FL-S04 | main | They pick the High contrast theme by keyboard; every page reads clearly in it, in light and dark, and passes the audit | CMD03 | LA-V{b} | UC10-R01, UC10-R09 | UC10-R01 |
| UC10-FL-S05 | main | They open a dialog or a phone sheet; focus is held inside and comes back to the opener | | LA-V{c} | UC10-R03 | UC10-R03 |
| UC11-FL-S01 | main | The Reader chooses File › Open Product Folder… and picks a folder | CMD10 | LA-V{e} | UC11-R01 | F05 step 1 |
| UC11-FL-S02 | refused | A folder that is not a product is refused with what is missing, and no window opens | CMD10 | | UC11-R01 | DR26 |
| UC11-FL-S03 | main | It opens in a window of its own, never white, titled with its products and folder, the page reaching the shell only through `window.latheDesktop` | | LA-V{g} | UC11-R02, UC11-R04, UC11-R05 | F05 step 1 |
| UC11-FL-S04 | main | A link to another site opens in the system browser, and the window stays on Lathe | | LA-EXP-V03 | UC11-R06 | DR30 (exchanges with LA-INT{a}) |
| UC11-FL-S05 | main | They come back to it from File › Open Recent | QRY07 | LA-V{e} | UC11-R03 | F05 step 1 |
| UC11-FL-S06 | main | The next launch reopens the last folder | CMD10 | | | DR32 |
| UC12-FL-S01 | main | The Owner runs `npm --prefix desktop run dev`; a window loads the 5199 dev server when it serves the opened folder | CMD15 | | UC12-R01 | F06 step 1 |
| UC12-FL-S02 | alternate | Otherwise the shell starts a dev server of its own for the folder | CMD15 | | UC12-R02 | F06 step 1 |
| UC12-FL-S03 | main | A change to the main process or a preload restarts Electron | | | UC12-R03 | F06 step 2 |
| UC12-FL-S04 | main | A change to a record reloads the page in every mode | QRY02 | LA-EXP-V03 | UC12-R04 | F06 step 3 |
| UC12-FL-S05 | main | They build the app as it ships, locally and unsigned | | | UC12-R05 | UC12's goal |
| UC13-FL-S01 | main | The Reader opens the menu bar: File, Edit, View, Window and Help | | LA-V{e} | UC13-R01 | F05 step 3 |
| UC13-FL-S02 | main | They choose a View item; the page runs the command by its ID, as if its key had been pressed, with the keys left to the app | CMD02 | LA-V{e} | UC13-R02, UC13-R04 | F05 step 3 |
| UC13-FL-S03 | main | The page knows it runs in the desktop app | | LA-EXP-V03 | UC13-R03 | UC13-R03 |
| UC14-FL-S01 | main | The window has no system title bar; Lathe draws its own, with the window's controls over it | | LA-V{f} | UC14-R01, UC14-R07 | F05 step 2 |
| UC14-FL-S02 | main | The Reader goes back and forward from the bar | | LA-V{f} | UC14-R02 | F05 step 2 |
| UC14-FL-S03 | main | They click the command center to open quick find | | LA-V{f} | UC14-R03 | F05 step 2 |
| UC14-FL-S04 | main | They show and hide the navigation and the side bar from the bar | CMD02 | LA-V{f} | UC14-R04 | F05 step 2 |
| UC14-FL-S05 | main | They drag the window by the bar and double-click it to zoom | | LA-V{f} | UC14-R05 | UC14-R05 |
| UC14-FL-S06 | main | They change the theme; the bar and the window's controls follow | CMD13 | LA-V{f} | UC14-R06 | UC14-R06 |
| UC15-FL-S01 | main | The Owner keeps Lathe in the Dock; its icon reads at every size, with a DEV band in development | | | UC15-R01 | UC15's goal (exchanges with LA-INT{b}) |
| UC15-FL-S02 | main | They open a folder; the window opens on the shell color with a launch view until the specs answer, and behaves like a native window | CMD10 | LA-V{g} | UC15-R10, UC15-R12 | F05 step 1 |
| UC15-FL-S03 | refused | When the engine cannot load the folder, the error page says why and offers Retry, another folder and the folder itself, running only those buttons | | LA-V{h} | UC15-R11, UC15-R14 | F05 step 4 |
| UC15-FL-S04 | main | The page reports its check errors | CMD14 | LA-EXP-V03 | | F05 step 3 |
| UC15-FL-S05 | main | The Dock badge counts the errors of the window in front | QRY06 | | UC15-R13 | F05 step 3 (exchanges with LA-INT{b}) |
| UC15-FL-S06 | main | The Dock menu opens another folder and lists the recent ones | | | UC15-R04 | UC15-R04 (exchanges with LA-INT{b}) |
| UC15-FL-S07 | main | About Lathe shows the versions, and Settings… opens Appearance | | LA-V{i} | UC15-R05, UC15-R06 | UC15's goal |
| UC15-FL-S08 | main | From a record they reveal its data file in Finder, open it in the editor or copy its ID; the shell takes only the ID | `LA-AUT-UC15`'s record action command (to resolve) | LA-EXP-V03 | UC15-R16 | UC15's goal |
| UC15-FL-S09 | main | Opening Lathe again, or a folder from Finder, goes to the running app | CMD10 | | UC15-R09 | UC15-R09 |
| UC15-FL-S10 | main | A run that was killed leaves macOS nothing to reopen | | | UC15-R15 | DR40 |
| UC16-FL-S01 | main | An Agent calls the plugin's MCP tools, or the Owner runs `lathe add` | CMD18 | | | F07 step 1 |
| UC16-FL-S02 | main | The Owner saves a form on a record's page, which sends `POST /api/write` | CMD18 | LA-EXP-V03 | UC16-R01 | F07 step 1 |
| UC16-FL-S03 | refused | A write from another site, not sent as JSON or over the limits is refused before the store sees it | | | UC16-R02 | UC16-R02 |
| UC16-FL-S04 | refused | The store refuses a write that breaks a rule, with every reason, and no file changes | CMD18 | LA-EXP-V03 | UC16-R01 | F07 step 2 |
| UC16-FL-S05 | main | Open pages load the data again, and the change is reviewed and committed in git, merged row by row | QRY02 | LA-EXP-V03 | | F07 steps 3 and 4 |

Every UC requirement is fulfilled by at least one step of its own use case's flow. Paths other than `main` and `refused` are named for what they stand for (`alternate`, `typing`, `tablet`, `phone`).

### Views

All **new**: Platform's own screens, which the old spec had no view for. Each has no owner and exists because the steps above happen in it. None has view requirements: what it must do is in the UC requirements (judgment call 11).

| ID | Title | Route | Description | Source |
| --- | --- | --- | --- | --- |
| LA-V{a} | Appearance page | `/settings/appearance` | The mode choice, every theme with a preview, import and export, and the editor for a theme of one's own. | UC07-R03, R04; C25 |
| LA-V{b} | Theme picker | | The Color theme and Light, dark or system quick picks, which preview as they are arrowed. | UC07-R01; C24 |
| LA-V{c} | Command palette | | Every command that applies, with its keys, filtered as the Reader types. | UC04-R04, UC05-R02; C12 |
| LA-V{d} | Shortcuts sheet | | Every shortcut grouped as Navigate, View, Graph and Lists, with a search and the override note. | UC04-R04, UC05-R04; C12 |
| LA-V{e} | Native menus | | The desktop app's menu bar: File, Edit, View, Window and Help. | UC13-R01; C45 |
| LA-V{f} | Desktop title bar | | The app's own 38 px bar in the desktop window: back and forward, the command center and the layout toggles. | UC14; C51 |
| LA-V{g} | Launch view | | The shell color, the logo and "Opening <product>…" until the page has its specs. | UC15-R10; C55 |
| LA-V{h} | Error page | | The engine's message, with Retry, Open Another Folder and Reveal in Finder. | UC15-R11; C55 |
| LA-V{i} | About window | | The app's, the engine's and Electron's versions, with links to the repo and the record format. | UC15-R05; C55 |

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
| LA-INT{a} | System browser | The person's default browser | UC11-FL-S04; the About window's links | **New**: DR30 |
| LA-INT{b} | macOS Dock | macOS (the Dock, its menu, recent documents) | UC15-FL-S01, S05, S06 | **New**: DR37, UC15-R01, R04 |

No integration tests: the old spec has none, and both are proved through the UC requirements that use them.

## Technical specification

Each record names one file. Technical kinds with no code are left out and show as not built: tables (Platform has no database tables of its own), event types (the code raises no events by name), and projections other than RM01's (the keymap, the themes list, the badge and the recent folders are worked out on each read).

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
| VO{k}-VT | Value type | VO{k} | app/src/shell/keymap.ts | `normalizeChord`, `normalizeBinding`, `RESERVED` | C11 |
| VO{t}-VT | Value type | VO{t} | app/src/theme/tokens.ts | the token table and how each value is checked | C20 |
| VO{f}-VT | Value type | VO{f} | app/src/theme/theme.ts | `ThemeFile`, `parseTheme`, `toFile`, `THEME_FORMAT`, `THEME_VERSION` | C20 |
| VO{b}-VT | Value type | VO{b} | desktop/src/windowState.ts | `Bounds`, `SavedWindow` | C42 |
| VO{c}-VT | Value type | VO{c} | desktop/src/chrome.ts | `Chrome`, `parseChrome`, `parseHexColor` | C50 |
| SP01-PR | Predicate | SP01 | desktop/src/folders.ts | `checkFolder` | C41 |
| SP02-PR | Predicate | SP02 | desktop/src/devSource.ts | `chooseDevSource`, `ROOT_HEADER`; also `freePort`, which keeps INV06 | C44 |
| RM01-PJ | Projection | RM01 | lathe/src/index.ts | `readWorkspace`: opens the store afresh, fills the file facts, runs Lathe's checks then the product's on four connections and the coverage queries side by side; `buildReference`'s kept answer. Its shape is `Workspace` in `lathe/src/types.ts`. | C01, C04, C02 |
| CMD01-H | Command handler | CMD01 | app/src/shell/prefs.ts | `usePanelSize`'s setter, within the limits | C10, C19 |
| CMD02-H | Command handler | CMD02 | app/src/App.tsx | `toggleNav`, the side bar, view and full screen commands the shell registers | C13, C19 |
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
| QRY01-H | Query handler | QRY01 | lathe/src/index.ts | `loadWorkspace` | C01 |
| QRY02-H | Query handler | QRY02 | lathe/src/server/api.ts | the `SpecData` answer: one store per product root, opened afresh when its files change; `dataSignature` | C06 |
| QRY03-H | Query handler | QRY03 | app/src/shell/keymap.ts | `resolveCommands`, `platformKeys` | C11 |
| QRY04-H | Query handler | QRY04 | app/src/theme/ThemeProvider.tsx | `themes`, `active`, `basedOn` | C23 |
| QRY05-H | Query handler | QRY05 | app/src/theme/ThemeProvider.tsx | `exportFile` | C23 |
| QRY06-H | Query handler | QRY06 | desktop/src/dock.ts | `badgeFor`, `badgeText`, `parseErrorCount` | C53 |
| QRY07-H | Query handler | QRY07 | desktop/src/main.ts | `refreshMenu`'s Open Recent items | C40 |
| PO01-H | Event handler | PO01 | desktop/src/main.ts | `startApp` (inline, as the window opens) | C40 |
| PO02-H | Event handler | PO02 | desktop/src/main.ts | the `closed`, `before-quit`, SIGINT and SIGTERM handlers that stop servers | C40; reacts_to C40→EV05 |
| PO03-H | Event handler | PO03 | desktop/src/main.ts | `rememberRecent`, `app.addRecentDocument` | C40, C41; reacts_to C41→EV04 |
| DS01-SV | Service | DS01 | app/src/shell/keymap.ts | `formatBinding`, `ariaKeyShortcuts` | C15 |
| DS02-SV | Service | DS02 | app/src/theme/audit.ts | `auditContrast`, `REQUIRED_PAIRS`, with `contrast.ts` | C26 |
| DS03-SV | Service | DS03 | desktop/src/windowState.ts | `windowFor`, `DEFAULT_SIZE`, `MIN_SIZE` | C42 |
| DS04-SV | Service | DS04 | desktop/src/main.ts | `openOnLaunch` | C40 |
| EP01-H | Endpoint handler | EP01 | lathe/src/server/api.ts | `handleApi`'s `/api/spec` route; its shape is `SpecData` in `lathe/src/server/contract.ts` | C06, C61; implements C06→E01, C08→E01 |
| EP02-H | Endpoint handler | EP02 | lathe/src/server/api.ts | `handleApi`'s `/api/write` route, `writeRequestProblem`, `WRITE_BODY_LIMIT`, `WRITE_COMMAND_LIMIT`; its shapes are `WriteRequest` and `WriteAnswer` in `contract.ts` | C06, C61; implements C06→E02 |
| INT{a}-AD | Adapter | INT{a} | desktop/src/main.ts | `keepLinksOutside`, and the About links, through `shell.openExternal` | C40 |
| INT{b}-AD | Adapter | INT{b} | desktop/src/main.ts | `app.dock.setBadge`, `setMenu`, `addRecentDocument`, `setDockIcon` | C40, C53 |

### UI components

Each has no owner and renders one or more views. Views of other domains are named by their old IDs, to resolve.

| ID | Title | File | Renders | Source |
| --- | --- | --- | --- | --- |
| LA-UI{a} | App shell | app/src/App.tsx | every page (`LA-EXP-V01` to `V05`, `LA-TRC-V01`, `LA-CHK-V01`, `LA-AUT-V01` to `V03`), LA-V{a} | C07, C13, C19, C36 (with `useNarrow.ts`); implements C07→`LA-EXP-V01` |
| LA-UI{b} | Command dispatcher, palette and shortcuts sheet | app/src/shell/commands.tsx | LA-V{c}, LA-V{d} | C12, C16 |
| LA-UI{c} | Tooltip | app/src/shell/Tooltip.tsx | `LA-EXP-V03`, `LA-EXP-V04` | C14, C17 (the page's hints are tooltips on its controls) |
| LA-UI{d} | Resize handle | app/src/components/ResizeHandle.tsx | `LA-EXP-V03` | C18 |
| LA-UI{e} | Page bar | app/src/views/PageBar.tsx | `LA-EXP-V02`, `LA-EXP-V03` | C28 |
| LA-UI{f} | Bottom sheet | app/src/shell/BottomSheet.tsx | `LA-EXP-V03` | C29 |
| LA-UI{g} | Phone top bar and quick find sheet | app/src/shell/MobileBar.tsx | `LA-EXP-V01`, `LA-EXP-V03` | C30 |
| LA-UI{h} | Shared styles | app/src/styles.css | every page | C32, C39 |
| LA-UI{i} | Button | app/src/components/Button.tsx | every page | C34 |
| LA-UI{j} | Theme stylesheet | app/src/theme/css.ts | every page | C21 (with `apply.ts`) |
| LA-UI{k} | Early theme script | app/index.html | every page | C27 |
| LA-UI{l} | Theme color | app/src/shell/themeColor.ts | every page | C31 |
| LA-UI{m} | Theme commands and quick pick | app/src/theme/ThemeCommands.tsx | LA-V{b} | C24 (with `QuickPick.tsx`) |
| LA-UI{n} | Appearance page and theme editor | app/src/theme/AppearancePage.tsx | LA-V{a} | C25 |
| LA-UI{o} | Spec data and live reload | app/src/specs/data.ts | every page | C09 (judgment call 13) |
| LA-UI{p} | Desktop title bar | app/src/shell/DesktopTitleBar.tsx | LA-V{f} | C51 |
| LA-UI{q} | Theme to window chrome | app/src/shell/desktopChrome.ts | LA-V{f} | C52 |
| LA-UI{r} | Window title bar options | desktop/src/chrome.ts | LA-V{f} | C50's `chromeWindowOptions` |
| LA-UI{s} | Native menus | desktop/src/menu.ts | LA-V{e} | C45, C46 (`desktop/src/commands.ts`) |
| LA-UI{t} | Launch view, error page and About window | desktop/src/launch.ts | LA-V{g}, LA-V{h}, LA-V{i} | C55, C56 (`local-preload.cts`) |

### Records of proposed product kinds

| ID | Kind | Parent | File | What | Source |
| --- | --- | --- | --- | --- | --- |
| LA-PLT-ENTRY01 | Entry point | LA-PLT | desktop/src/main.ts | The shell's start-up: windows, IPC, menus and quitting | C40 |
| LA-PLT-ENTRY02 | Entry point | LA-PLT | desktop/src/instance.ts | The single-instance lock: a second launch or a folder from Finder goes to CMD10 | C54 |
| LA-PLT-ENTRY03 | Entry point | LA-PLT | desktop/src/persistence.ts | macOS window restoration turned off before the app is ready (UC15-R15) | C58 |
| LA-PLT-ENTRY04 | Entry point | LA-PLT | app/server/lathe.ts | The dev API plugin: Lathe's API inside the app's Vite dev server, the fixture, `x-lathe-root`, `spec:changed` | C08 |
| UC02-R05-TOOL | Tooling | UC02-R05 | .gitattributes | `**/data/*.jsonl merge=lathe-data`, with the READMEs' two `git config` lines | C60 |
| UC12-R03-TOOL | Tooling | UC12-R03 | desktop/scripts/dev.ts | The development watcher | C48 |
| UC12-R05-TOOL | Tooling | UC12-R05 | desktop/scripts/stage-lathe.ts | The local build (with electron-builder's settings in `desktop/package.json`) | C49 |
| UC15-R01-TOOL | Tooling | UC15-R01 | desktop/scripts/icon.ts | The app icon renderer | C57 |
| CMD13-IPC | IPC channel | CMD13 | desktop/src/preload.cts | `setChrome` on `lathe:set-chrome` | C47 |
| CMD14-IPC | IPC channel | CMD14 | desktop/src/preload.cts | `setErrorCount` on `lathe:error-count` | C47 |
| CMD17-CLI | CLI command | CMD17 | lathe/bin/lathe.ts | `lathe serve [--port]` | C03 |
| CMD21-CLI | CLI command | CMD21 | lathe/bin/lathe.ts | `lathe init --name <name> --prefix <prefix>` | **New** |

The rest of the preload (`isDesktop`, `platform`, `onCommand`, `onFullScreen`) is described on LA-UI{p} and LA-UI{s}, which use it; its record actions are `LA-AUT-UC15`'s (to resolve).

## Proposed product kinds

Declared by LA for Lathe's own code where none of the fourteen technical kinds fits (decision 18). None is an obligation.

| Name | Label | Stage | Parent kind | ID pattern | Example | Fields | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `entry_point` | Entry point | technical-specification | domain | `<domain>-ENTRY<nn>` | LA-PLT-ENTRY01 | file (text, required) | A start-up file that wires the handlers together; the Tool Library's kind of the same name, declared for LA too |
| `tooling` | Tooling | technical-specification | uc_requirement | `<UC requirement>-TOOL` | LA-PLT-UC12-R03-TOOL | file (text, required) | A script or config file outside the running app that carries out one UC requirement: a dev watcher, a build, an icon renderer, the merge driver's attributes |
| `ipc_channel` | IPC channel | interaction-design | command | `<command>-IPC` | LA-PLT-CMD13-IPC | channel (text, required), file (text, required) | How the desktop page sends a command to the shell's main process: the desktop's endpoint, which has no method or route |
| `cli_command` | CLI command | interaction-design | command | `<command>-CLI` | LA-PLT-CMD21-CLI | usage (text, required), file (text, required) | How the command line invokes a command, as an endpoint does over HTTP |

`cli_command` sits under a command only, because a product kind has one parent kind; `lathe check` exposes a query (Checking's) and would need a second kind or a parent of either (plan gap 3). `entry_point` is the Tool Library's name: if one store ever loads both products, the two declarations clash on the key `name` (plan gap 4).

## Test plan

Every test names one parent and a run by. Levels:
- **unit:** pure functions, and the app's tests rendered in jsdom (`app/test/*.test.tsx`), and the desktop's tests of its pure modules (`desktop/test/*.test.ts`).
- **database:** the engine's tests that open a store over data files (`lathe/test/*.test.ts`, `lathe/test/store/*`), and the engine's performance script.
- **api:** the server's tests over HTTP or the API handler (`lathe/test/serve.test.ts`, `app/test/server.test.ts`).
- **e2e-api:** `lathe/test/cli.test.ts`, which runs the CLI end to end (judgment call 15).
- **e2e-ui:** a real browser or Electron: the stability, accessibility and performance suites (`app/stability`, `app/a11y`, `app/perf`) and the desktop smoke test.
- **manual:** the four manual walks, each with its old reason.

When one old test splits, its `it` splits into one `it` per new record, each name starting with its record's ID; where the new records share an Electron run (T111) or an axe run (T97), the apply step keeps one run and gives each record its own `it` over it. IDs in full start `LA-PLT-`.

### Constraint tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| LA-VO{k}-C01-T | VO{k}-C01 | unit, app/test/keymap.test.ts | T16, its first part: bindings normalized, chords and sequences matched |
| LA-VO{k}-C02-T | VO{k}-C02 | unit, app/test/keymap.test.ts | T15's no-reserved-key part and T18's browser-essential-dropped part |
| LA-VO{t}-C01-T | VO{t}-C01 | unit, app/test/themes.test.tsx | T57: unknown tokens and values that reach past the token refused |
| LA-VO{f}-C01-T | VO{f}-C01 | unit, app/test/themes.test.tsx | T57: round trip, another version or format and unknown fields refused |
| LA-VO{c}-C01-T | VO{c}-C01 | unit, desktop/test/chrome.test.ts | T116: names, alpha colors, `rgb()`, injected text, numbers, missing and extra keys refused, nothing changed |

### Invariant tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| INV01-T | INV01 | unit, app/test/keymap.test.ts | T15: no duplicate binding on either platform; the duplicate check catches a clash and a sequence prefix |
| INV02-T | INV02 | unit, app/test/themes.test.tsx | T57: a partial file filled from Lathe |
| INV03-T | INV03 | unit, app/test/themes.test.tsx | T55: a built-in is changed only through a copy, which resets to it |
| INV04-T | INV04 | unit, app/test/themes.test.tsx | T55: after the copy in use is deleted, Lathe is in use |
| INV05-T | INV05 | unit, desktop/test/instance.test.ts | T124: an open folder's window found however its path is spelled (T112's step 3 stays in UC11-FL-T) |
| INV06-T | INV06 | unit, desktop/test/devSource.test.ts | T109: a free port is never 5199 or a port in use |
| INV07-T | INV07 | database, lathe/test/store/commands.test.ts | T138; T142's refused later writes |
| INV08-T | INV08 | database, lathe/test/store/commands.test.ts | T139, T140, T141 and T142's bad date and table name, one `it` each |
| INV09-T | INV09 | database, lathe/test/store/commands.test.ts | T143, T144 |
| INV10-T | INV10 | database, lathe/test/store/commands.test.ts | T145 |
| INV11-T | INV11 | database, lathe/test/store/commands.test.ts | T146, and the named refusals of T147, T151 and T152 |
| INV12-T | INV12 | database, lathe/test/store/commands.test.ts | T148, T149, T150, and T147's and T151's key, parent and move refusals |
| INV13-T | INV13 | database, lathe/test/store/commands.test.ts | T153, and T152's removal refused while referenced |
| INV14-T | INV14 | unit, desktop/test/folders.test.ts | T107 |

### Specification, policy and domain service tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| SP01-T | SP01 | unit, desktop/test/folders.test.ts | T106: which folders open, with which data folder, and what the refusals say |
| SP02-T | SP02 | unit, desktop/test/devSource.test.ts | T109: a fake 5199 for the folder, another folder, no header, an error, or none |
| PO01-T | PO01 | e2e-ui, desktop/test/smoke.test.ts | T111: the window's `serve()` answered `GET /api/spec` with 200 |
| PO02-T | PO02 | manual | T112 step 6: after every window closes, no dev server the shell started is left. Reason: T112's |
| PO03-T | PO03 | e2e-ui, desktop/test/smoke.test.ts | T111: the opened folder went into the recent list |
| DS01-T01 | DS01 | unit, app/test/shortcut-hints.test.tsx | T28: bindings formatted for a Mac and elsewhere |
| DS01-T02 | DS01 | unit, app/test/shortcut-hints.test.tsx | T31: no `aria-keyshortcuts` for a sequence |
| DS02-T01 | DS02 | unit, app/test/themes.test.tsx | T56: the ratios on paper and on sheet, in the light cell only |
| DS03-T01 | DS03 | unit, desktop/test/windowState.test.ts | T108 |
| DS04-T01 | DS04 | manual | T112 step 5: the last folder reopens in its saved place. Reason: T112's |

### Use case tests

All automated unless marked manual; a manual one keeps its old test's reason. Run by is the old test's level as above and its file.

| ID | Source | ID | Source |
| --- | --- | --- | --- |
| UC01-R01-T01 | T03 (database) | UC07-R01-T01 | T53 |
| UC01-R02-T01 | T04 (database) | UC07-R02-T01 | T54 |
| UC01-R03-T01 | T08 (database, lathe/perf/engine.ts) | UC07-R03-T01 | T54: the nav footer's Appearance link |
| UC01-R03-T02 | T09: every phase timed | UC07-R03-T02 | T55: the five built-ins with previews |
| UC01-R04-T01 | T05 | UC07-R04-T01 | T55: a copy edited live, renamed, reset and deleted |
| UC01-R04-T02 | T09: a reload gives what a fresh load gives | UC07-R05-T01 | T56: the warning beside its swatch |
| UC02-R01-T01 | T06 (e2e-api) | UC07-R06-T01 | T57: export, and import on the Appearance page |
| UC02-R02-T01 | T01 | UC07-R07-T01 | T53: kept with its stylesheet, at once |
| UC02-R02-T02 | T10 | UC07-R07-T02 | T58 |
| UC02-R02-T03 | `LA-AUT-T54` (database, lathe/test/citations-by-id.test.ts) | UC08-R01-T01 | T61: the top bar |
| UC02-R03-T01 | T02 | UC08-R01-T02 | T70: no sideways scroll at 320 px |
| UC02-R04-T01 | T07 (api) | UC08-R02-T01 | T61: one view at a time |
| UC02-R05-T01 | T154 (database) | UC08-R03-T01 | T66 |
| UC03-R01-T01 | T12 (api) | UC08-R03-T02 | T68: the nav's rows at 44 px |
| UC03-R01-T02 | T13 | UC08-R04-T01 | T62 |
| UC03-R01-T03 | T160 (api) | UC08-R04-T02 | T63 |
| UC04-R01-T01 | T15: every command has an id, title and group | UC08-R05-T01 | T64 |
| UC04-R01-T02 | T16: Mod is Cmd on a Mac and Ctrl elsewhere | UC08-R06-T01 | T65 |
| UC04-R02-T01 | T19: Ctrl+P and Ctrl+K | UC08-R07-T01 | `LA-EXP-T133` (unit, app/test/mobile.test.tsx) |
| UC04-R02-T02 | T20 | UC08-R08-T01 | T70: tables and code scroll in their box, IDs wrap |
| UC04-R02-T03 | T21 | UC08-R09-T01 | T67 |
| UC04-R02-T04 | T22 | UC08-R10-T01 | T68: 44 px targets at 900 px and wider on touch |
| UC04-R02-T05 | T24: the `g` sequences and their hint | UC09-R01-T01 | T71 (e2e-ui) |
| UC04-R02-T06 | T25 | UC09-R02-T01 | T72 (e2e-ui) |
| UC04-R02-T07 | T26 | UC09-R03-T01 | T73 (e2e-ui) |
| UC04-R02-T08 | T51: the view toggles' keys | UC09-R04-T01 | T74 (e2e-ui) |
| UC04-R03-T01 | T17 | UC09-R05-T01 | T75 (e2e-ui) |
| UC04-R03-T02 | T19: unhandled keys left to the browser | UC09-R06-T01 | T76 (e2e-ui) |
| UC04-R03-T03 | T24: nothing while typing in quick find | UC09-R07-T01 | T77 (e2e-ui) |
| UC04-R04-T01 | T23 | UC09-R08-T01 | T78 (e2e-ui) |
| UC04-R05-T01 | T18: overrides read, bad ones ignored | UC09-R09-T01 | T80 (e2e-ui) |
| UC04-R05-T02 | T23: the override note in the sheet | UC09-R10-T01 | T81 (e2e-ui) |
| UC04-R06-T01 | T20 | UC09-R11-T01 | T91 (e2e-ui, app/perf/app.perf.ts) |
| UC04-R06-T02 | T21 | UC09-R11-T02 | T92 (e2e-ui) |
| UC04-R06-T03 | T22 | UC09-R11-T03 | T93 (e2e-ui) |
| UC04-R07-T01 | T31: Alt+W and Alt+G first off a Mac | UC09-R11-T04 | T94 (e2e-ui) |
| UC04-R07-T02 | T51: no platform offered a browser key | UC09-R12-T01 | T71: the frame never moves (e2e-ui) |
| UC05-R01-T01 | T27: after the delay, at once on focus | UC09-R12-T02 | T79: late content reaches the host before paint, fonts preloaded |
| UC05-R01-T02 | T28: Mac keys in tooltips | UC09-R13-T01 | T79: gutters, one-height bars, counts as one text |
| UC05-R02-T01 | T29 | UC10-R01-T01 | T97 (e2e-ui, app/a11y/audit.spec.ts) |
| UC05-R03-T01 | T31: on each control | UC10-R02-T01 | T98 (e2e-ui) |
| UC05-R04-T01 | T32 | UC10-R02-T02 | T99 (e2e-ui) |
| UC05-R05-T01 | T30 | UC10-R02-T03 | T101 |
| UC05-R06-T01 | T27: Escape and leaving close it, a click opens none | UC10-R03-T01 | T100 (e2e-ui) |
| UC06-R01-T01 | T14: the gap moves by keys | UC10-R04-T01 | T99: the announcements (e2e-ui) |
| UC06-R01-T02 | T43 | UC10-R05-T01 … R09-T01 | T97: one `it` per requirement over the same axe runs (e2e-ui) |
| UC06-R01-T03 | T50 | UC11-R01-T01 | T110 |
| UC06-R02-T01 | T14: remembered, even on double-click | UC11-R02-T01 | T106: the title from the product rows |
| UC06-R02-T02 | T43 | UC11-R02-T02 | T111 (e2e-ui) |
| UC06-R02-T03 | T44 | UC11-R03-T01 | T110 |
| UC06-R02-T04 | T50 | UC11-R04-T01 | T112 step 1, manual |
| UC06-R03-T01 | T44 | UC11-R05-T01 | T111 (e2e-ui) |
| UC06-R04-T01 | `LA-EXP-T48` (unit, app/test/views.test.tsx) | UC11-R06-T01 | T112 step 4, manual |
| UC12-R01-T01 | T109 | UC14-R01-T01 | T111 (e2e-ui) |
| UC12-R02-T01 | T113 steps 1 and 3, manual | UC14-R01-T02 | T115 |
| UC12-R03-T01 | T113 step 5, manual | UC14-R01-T03 | T117 |
| UC12-R04-T01 | T113 step 4, manual | UC14-R02-T01 | T118 |
| UC12-R05-T01 | T113 step 6, manual | UC14-R03-T01 | T119 |
| UC13-R01-T01 | T110 | UC14-R04-T01 | T120 |
| UC13-R02-T01 | T111 (e2e-ui) | UC14-R05-T01 | T122 step 2, manual |
| UC13-R02-T02 | T114 | UC14-R06-T01 | T111 (e2e-ui) |
| UC13-R03-T01 | T111 (e2e-ui) | UC14-R06-T02 | T116: a valid chrome applied |
| UC13-R04-T01 | T110 | UC14-R06-T03 | T121 |
| UC15-R01-T01 | T111: the built icons (e2e-ui) | UC14-R07-T01 | T117 |
| UC15-R01-T02 | T128 step 1, manual | UC15-R11-T01 | T125 |
| UC15-R04-T01 | T123 | UC15-R12-T01 | T128 step 8, manual |
| UC15-R05-T01 | T125 | UC15-R12-T02 | `LA-AUT-T120` (unit, app/test/desktop-record.test.tsx): full screen drops the traffic lights' room |
| UC15-R05-T02 | T126 | UC15-R13-T01 | T123 |
| UC15-R06-T01 | T126 | UC15-R14-T01 | T125 |
| UC15-R09-T01 | T124 | UC15-R15-T01 | T127 |
| UC15-R10-T01 | T111 (e2e-ui) | UC15-R16-T01 | `LA-AUT-T118` (unit, desktop/test/records.test.ts) |
| UC15-R10-T02 | T125 | UC16-R01-T01 | T155 (api) |
| | | UC16-R02-T01 | T157 (api) |

Four come from other domains' old tests, each its part that proved a Platform record; those sheets keep the rest (cross-domain items 6 to 9).

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
| UC11-FL-T | UC11-FL | manual | T112, its six steps: "A day with the desktop app" |
| UC12-FL-T | UC12-FL | manual | T113, its six steps |
| UC14-FL-T | UC14-FL | manual | T122, its four steps |
| UC15-FL-T | UC15-FL | manual | T128, its nine steps |

The other twelve flows have no flow test and show as not proved: no old test walks them as a whole, and this sheet adds none (judgment call 14).

### Pattern rule tests

One per rule and adopting domain (`UNIQUE (pattern_rule_id, domain_id)`). Only Platform follows the two patterns, for the whole app, so every one is in `LA-PLT`. Where several old tests proved one rule, the one test names the main file and the others' `it`s are renamed to its ID and listed in its notes (judgment call 9). All automated.

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
| LA-PAT-APP-UX-R08-T01 | LA-PLT | unit, app/test/nothing-jumps.test.tsx | T79; notes: the stability suite's scenarios (T71 to T78, T80, T81, T89, `LA-EXP-T173`, `T175`, `T202`), most of which are also UC09's use case tests |
| LA-PAT-APP-UX-R09-T01 | LA-PLT | unit, app/test/standards.test.tsx | T82; notes: T83 `button.test.tsx` |
| LA-PAT-APP-UX-R10-T01 | LA-PLT | e2e-ui, app/a11y/audit.spec.ts | T97; notes: T98 to T100 `keyboard.spec.ts` |
| LA-PAT-APP-UX-R11-T01 | LA-PLT | e2e-ui, app/perf/app.perf.ts | T90; notes: T91 to T95, T137, T96 `first-load-imports.test.ts`, `LA-EXP-T170` `graph/map.test.ts` |
| LA-PAT-APP-UX-R12-T01 | LA-PLT | unit, app/test/graph/readable.test.ts | T135; notes: T136 `app/stability/graph.spec.ts`, `LA-EXP-T210` `graph/canvas.test.tsx` |

Given, when and then come from the source test.

### Patterns and standards

- **LA-PAT-APP-CODE and LA-PAT-APP-UX**, their 24 rules, and the two `follows` links from LA-PLT carry over unchanged. Neither has settings. The rule statements and notes that name other domains' rules (`LA-EXP-DR42`, `DR58`, `DR60` in UX-R07 and UX-R12) take those rules' new IDs (to resolve). DR20 folds into UX-R09, which already says it (judgment call 8).
- **LA-STD-CODE** and its three rules carry over unchanged. They are met, not proved: the `meets` links from Platform's old components move to the technical records that took their code (RM01-PJ meets R03; SP02-PR meets R03); `LA-PLT-C37`'s two go with it to Exploring's history endpoint handler (to resolve). No test or check proves a standard rule today, and none did before (plan gap 1).

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
| Constraint | 5 | Query handler | 7 |
| Invariant | 14 | Event handler | 3 |
| Specification | 2 | Service | 4 |
| Domain event | 6 (1 new) | Endpoint handler | 2 |
| Event field | 17 | Adapter | 2 |
| Command | 21 | UI component | 20 |
| Read model | 5 | Entry point (product kind) | 4 |
| Read model field | 20 | Tooling (product kind) | 4 |
| Query | 7 | IPC channel (product kind) | 2 |
| Policy | 3 | CLI command (product kind) | 2 |
| Domain service | 4 | Constraint test | 5 |
| Term | 12 (all new) | Invariant test | 14 |
| Capability | 4 | Specification test | 2 |
| Use case | 16 | Policy test | 3 |
| UC requirement | 102 (17 new) | Domain service test | 5 |
| Flow | 16 | Use case test | 149 |
| Flow step | 92 | Endpoint test | 5 |
| View | 9 (all new) | Flow test | 4 |
| View requirement | 0 | View test, integration test | 0 |
| Endpoint | 2 | Pattern rule test | 24 |
| API requirement | 3 | Pattern, rules | 2, 24 |
| Integration | 2 (all new) | Standard, rules | 1, 3 |

211 tests in all, every one from an old test: 206 from Platform's own 159, and 5 use case tests from parts of other domains' old tests (`LA-AUT-T54`, `T118`, `T120`, `LA-EXP-T48`, `T133`). 196 are automated and 15 manual.

## Judgment calls

1. **The Workspace is a read model, not an aggregate.** Nothing changes it: it is what one load of the data files gives. RM01 is filled by its projection (`readWorkspace`) from every product's data, which are other domains' aggregates, so it hears their published events rather than reading them. Its two rules were what the load promises the code that calls it, so DR01 becomes UC01-R04 and DR02 merges into UC01-R03, which already said it.
2. **EV06 Data written is new and published.** A write's tables and files changed (EN11's derived fields) are what it tells every reader; Authoring's Record changed (`LA-AUT-EV01`) describes the files changing for any reason, git included, and stays theirs.
3. **UI rules become UC requirements.** Rules that say what the person gets from a page (DR03, DR07, DR10, DR18, DR19, DR21 to DR25, DR29, DR30, DR37 to DR40) are none of the four rule kinds: no aggregate's state, no value's format, no yes-or-no check before a command, no reaction. Each became a requirement of the use case whose goal it serves, keeping its statement and its tests. DR05, DR16 and DR17 merged into the requirements that already said them (UC04-R03, UC08-R02, UC10-R03).
4. **A3 is the Keymap and EN03 a Keyboard command, EN12 a Write command,** so no record is titled like the model's own Command kind.
5. **A4 becomes Appearance,** with a new root EN14 holding the chosen theme and the mode, and EN06 Theme as its child: choosing a theme and a mode are the person's, and EV01 and EV02 are about that choice, not about one theme.
6. **The recent folders are their own aggregate (A9)**, since one list serves every window and DR31 holds over the whole list. EN09 moves from A6 and keeps its ID.
7. **A10 Product repo is new,** for `lathe init` (CMD21) and the folder check (SP01): a folder that is a product. CMD21 also adds the first product record through the command layer, a recorded exception the checks will list as a warning.
8. **DR20 folds into `LA-PAT-APP-UX-R09`,** which says the same, and its two tests prove that rule.
9. **One pattern rule test per rule.** The schema allows one per rule and domain, and only Platform follows the app patterns, so the 66 links from Platform's tests and 6 from Exploring's to pattern rules become 24 records. Each names its main file; the other tests' `it`s carry its ID and are listed in its notes.
10. **Rules sorted by what they do:** formats became constraints (DR06, DR11, DR13, DR36); one aggregate's rules invariants (DR04, DR12, DR14, DR15, DR27, DR31, DR33, DR41 to DR47); yes-or-no checks specifications (DR26, DR34); the one reaction a policy (DR35); and calculations domain services (DR08 with DR09, DR28's placement, DR32).
11. **No view requirements.** What each new view must do is already a UC requirement, and moving those would only move proof around.
12. **Derived and placeholder fields leave entities** for read models, a domain service and an event (EN01, EN04's derived fields, EN05, EN11's derived fields), and A5's EN07 goes with A5.
13. **Spec data and live reload (`data.ts`) is a UI component.** It is the app's own client of the API that every page draws from; no other technical kind is app-side and serves views.
14. **No new tests.** Every new obligation was already proved by a part of an old test; the twelve flows with no walk-through stay unproved rather than gaining tests no one wrote. DR17's and DR18's extra proof links on T62, T64 to T66, T72 and T73, DR19's on T76, DR12's on T60 and UC05-R04's on T30 are dropped, since the requirements those tests prove already state it and other tests prove the merged requirement.
15. **The CLI test is e2e-api,** the closest level for running the command line end to end; the old `component` and `acceptance` tests in jsdom are unit, and those in a real browser or Electron e2e-ui.
16. **Harness and contract files get no record of their own:** the stability, accessibility and performance harnesses (C33, C35, C38) and the engine's perf script (C05) are test code that the tests' run by names; `types.ts` (C02) and `contract.ts` (C61) are named in the descriptions of the projection and endpoint handlers whose shapes they are.
17. **Platform has no tables.** Its state is in local storage, the shell's JSON files and memory. A8's data is every product's data files, whose tables are Authoring's.
18. **Subdomain type supporting.** Platform serves the core domains and is built for Lathe, but isn't what makes Lathe worth having.
19. **Terms are added** (twelve), since Platform had no glossary and its words (panel, pane, keymap, write) recur across every domain's specs.

## Findings in the code
- **No event code.** Themes, windows and writes change state directly; none of the six events is raised by name, so all show as not built.
- **A recent folder's "Opened" time isn't stored.** `recent-folders.json` keeps the order only.
- **Overrides of key bindings have no command.** A person edits `lathe:keybindings` in local storage by hand, as the shortcuts sheet explains; nothing in the app writes it, so A3 has no command.
- **`lathe init` writes the config and then the product through the store,** not in one transaction: a refused product leaves the config written (CMD21's exception).
- **The Panel aggregate has no type in the code;** its state is a set of local storage keys, so EN02 has no data model record.
- **Policies run inline.** PO01 to PO03 are code in `main.ts` called as the window opens or closes, not handlers of events.

## Cross-domain items to resolve

| # | What | With |
| --- | --- | --- |
| 1 | RM01 is filled from `LA-AUT-EV01` Record changed, `LA-AUT-EV03` Schema changed and `LA-CHK-EV01` Check changed, which must be published for a Platform read model to use them | AUT, CHK |
| 2 | `LA-PLT-C37` History API goes to Exploring's history endpoint (`LA-EXP-E01`) as its handler, with its `meets` of `LA-STD-CODE-R02` and `R03` | EXP |
| 3 | Other domains' steps that reached E01 or E02 (`uses` from `LA-CHK-F03`, `LA-EXP-F01`, `F02`, `F07`, `LA-TRC-F03`, `F04`) invoke QRY02 or CMD18 instead; views that used E01 (`LA-CHK-V01`, `LA-EXP-V01` to `V05`, `LA-TRC-V01`) need nothing: they read the app's data through LA-UI{o} | CHK, EXP, TRC |
| 4 | `LA-CHK-DF01-S02` used C01 and `LA-CHK-DF01-S05` meets `LA-STD-CODE-R03`: design flows go, so both links go with them | CHK |
| 5 | Parts of Platform's old tests that prove other domains' records become tests under those records, numbered by their sheets: T14, T21 (`LA-EXP-UC05-R03`); T45, T47 (`LA-EXP-UC05-R02`); T48, T105 (`LA-EXP-UC10-R06`); T49 (`LA-EXP-UC11-R05`); T52 (`LA-EXP-V03-R06`); T62 (`LA-EXP-UC05-R11`); T73, T76, T79 (`LA-EXP-DR43`); T84 (`LA-EXP-DR08`); T85 (`LA-EXP-DR51`, `LA-EXP-UC11-R08`); T86 (`LA-EXP-DR36`, `LA-TRC-UC14-R06`); T87 (`LA-EXP-UC12-R01`, `R02`); T88 (`LA-EXP-UC12-R04`); T89 (`LA-EXP-UC12-R06`); T103 (`LA-EXP-DR10`, `LA-EXP-UC05-R01`); T123, T128 (`LA-CHK-UC07-R02`); T126 (`LA-AUT-UC15-R02`, `LA-EXP-UC10-R08`); T128 (`LA-AUT-UC15-R01`) | EXP, TRC, CHK, AUT |
| 6 | `LA-AUT-T54`'s part proving UC02-R02 is UC02-R02-T03 here | AUT |
| 7 | `LA-AUT-T118`'s part proving DR38 is UC15-R16-T01 here | AUT |
| 8 | `LA-AUT-T120`'s part proving UC15-R12 is UC15-R12-T02 here | AUT |
| 9 | `LA-EXP-T48`'s part proving DR03 is UC06-R04-T01, and `LA-EXP-T133`'s part proving UC08-R07 is UC08-R07-T01, here; `LA-EXP-T108`, `T170`, `T173`, `T175`, `T202` and `T210`'s pattern rule parts are notes on Platform's pattern rule tests | EXP |
| 10 | UC15-FL-S08 invokes Authoring's record action command (`LA-AUT-UC15`), and the preload's record actions are its IPC channels if Authoring declares them | AUT |
| 11 | A10-REPO and EN16-DM name `lathe/src/config.ts`, which `LA-AUT-C05` and `LA-CHK-C11` also name | AUT, CHK |
| 12 | Views of other domains named by old IDs: `LA-EXP-V01` to `V05`, `LA-TRC-V01`, `LA-CHK-V01`, `LA-AUT-V01` to `V03` | EXP, TRC, CHK, AUT |
| 13 | Text that names old IDs: UC08-R03 (`LA-EXP-DR41`), UC08-R08 (`LA-TRC-DR35`), `LA-PAT-APP-UX-R07`'s notes (`LA-EXP-DR42`), `LA-PAT-APP-UX-R12` (`LA-EXP-DR58`, `DR60`) | EXP, TRC |
| 14 | Other domains' `meets` of `LA-STD-CODE` (`LA-AUT-C57`, `C67`, `C72`, `LA-AUT-T122` to `T124`, `LA-TRC-C02`, `C03`) move with those records | AUT, TRC |
| 15 | Product-scoped provisional IDs (`LA-VO{…}`, `LA-V{…}`, `LA-INT{…}`, `LA-UI{…}`) are numbered across all five sheets | apply step |

## What the plan didn't cover

| # | Need | Proposal |
| --- | --- | --- |
| 1 | What proves a standard rule: there is no test kind for it and no run by to name a check or linter | Count a standard rule as met through its `meets` links and leave proof to a later kind, or add `standard_rule_test` (one per rule) whose run by names the check, lint or test. Owner's call. |
| 2 | Pattern rule tests: one per rule and domain, where one rule has many tests in several files | Keep one record per rule and domain, naming its main file, with the others in its notes (this sheet), or let a run by name several files |
| 3 | A product kind with two possible parents (`cli_command` under a command or a query) | Let a product kind's parent be a supertype such as `operation`, or declare `cli_query` beside it |
| 4 | `product_kind` is keyed by `name` alone, so LA and the Tool Library can't both declare `entry_point` in one store | Key it by product and name, or keep the products in separate stores (they are today) |
| 5 | A read model in one domain filled from other domains' published events has no `reads` and no link naming the events | A `hears` from a projection or read model to the events it is filled from |
| 6 | UI behavior rules that apply across views (focus, stability, targets) fit none of the four rule kinds | UC requirements (this sheet), or view requirements on a shared view |
| 7 | A value object used only inside another value object (VO{t} inside VO{f}) | Allowed by the schema; the "nothing uses it" check should count a value object field as a use |
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
| aggregate A5 Control | 1 | dropped; its rules → UC10-R05 to R09 (judgment call 3) |
| entity EN01 | 1 | RM01's fields |
| entity EN02, EN03, EN04, EN06, EN08, EN10, EN11, EN12, EN13 | 9 | kept; EN03, EN12 retitled; EN06 now a child |
| entity EN05 Hint | 1 | RM02 Keymap |
| entity EN07 Control | 1 | dropped with A5 |
| entity EN09 | 1 | moved to A9 |
| entity_field | 42 | 24 kept (EN02 2, EN03 5, EN04 2, EN06 1, EN08 3, EN09 2, EN10 3, EN12 3, EN13 3); the other 18 per "Fields that leave the entities" |
| domain_event EV01 to EV05 | 5 | unchanged |
| event_field | 15 | unchanged |
| domain_rule DR01, DR02 | 2 | UC01-R04; merged into UC01-R03 |
| domain_rule DR03 | 1 | UC06-R04 |
| domain_rule DR04 | 1 | INV01 |
| domain_rule DR05 | 1 | merged into UC04-R03 |
| domain_rule DR06 | 1 | VO{k}-C02; its last clause → UC04-R03 |
| domain_rule DR07 | 1 | UC05-R05 |
| domain_rule DR08, DR09 | 2 | DS01 |
| domain_rule DR10 | 1 | UC05-R06 |
| domain_rule DR11 | 1 | VO{t}-C01 |
| domain_rule DR12 | 1 | INV02 |
| domain_rule DR13 | 1 | VO{f}-C01; its third sentence → INV02 |
| domain_rule DR14, DR15 | 2 | INV03, INV04 |
| domain_rule DR16 | 1 | merged into UC08-R02 |
| domain_rule DR17 | 1 | merged into UC10-R03 |
| domain_rule DR18, DR19 | 2 | UC09-R12, UC09-R13 |
| domain_rule DR20 | 1 | merged into `LA-PAT-APP-UX-R09` |
| domain_rule DR21 to DR25 | 5 | UC10-R05 to R09 |
| domain_rule DR26 | 1 | SP01 |
| domain_rule DR27 | 1 | INV05 |
| domain_rule DR28 | 1 | CMD12 (saving) and DS03 (placing) |
| domain_rule DR29, DR30 | 2 | UC11-R05, UC11-R06 |
| domain_rule DR31 | 1 | INV14 |
| domain_rule DR32 | 1 | DS04 |
| domain_rule DR33 | 1 | INV06 |
| domain_rule DR34 | 1 | SP02 |
| domain_rule DR35 | 1 | PO02 |
| domain_rule DR36 | 1 | VO{c}-C01; its "own page" → CMD13 |
| domain_rule DR37 | 1 | UC15-R13 |
| domain_rule DR38 | 1 | UC15-R16 |
| domain_rule DR39, DR40 | 2 | UC15-R14, UC15-R15 |
| domain_rule DR41 to DR47 | 7 | INV07 to INV13 |
| capability CAP01 to CAP04 | 4 | unchanged |
| use_case UC01 to UC16 | 16 | unchanged |
| use_case_actor | 18 | unchanged |
| use_case_step UC02 1 to 3 | 3 | folded into UC02-FL's steps; the kind goes |
| requirement UC01-R01 … UC16-R02 | 85 | unchanged as UC requirements; UC01-R03, UC04-R03, UC08-R02, UC10-R03 gain text |
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
| component C02 | 1 | named by RM01-PJ (judgment call 16) |
| component C03 | 1 | CMD17-H, CMD17-CLI |
| component C05 | 1 | UC01-R03-T01's file (judgment call 16) |
| component C06 | 1 | QRY02-H, EP01-H, EP02-H |
| component C07, C13, C19, C36 | 4 | LA-UI{a}; CMD02-H; C19 also CMD01-H with C10 |
| component C08 | 1 | LA-PLT-ENTRY04 |
| component C09 | 1 | LA-UI{o} |
| component C10 | 1 | A2-REPO, CMD01-H |
| component C11 | 1 | A3-REPO, EN03-DM, EN04-DM, VO{k}-VT, QRY03-H |
| component C12, C16 | 2 | LA-UI{b} |
| component C14, C17 | 2 | LA-UI{c} |
| component C15 | 1 | DS01-SV; its space commands in A3-REPO |
| component C18 | 1 | LA-UI{d} |
| component C20 | 1 | VO{t}-VT, VO{f}-VT, EN06-DM |
| component C21 | 1 | LA-UI{j} |
| component C22 | 1 | A4-REPO, EN14-DM |
| component C23 | 1 | CMD03-H to CMD09-H, QRY04-H, QRY05-H |
| component C24 | 1 | LA-UI{m} |
| component C25 | 1 | LA-UI{n} |
| component C26 | 1 | DS02-SV |
| component C27 | 1 | LA-UI{k} |
| component C28 | 1 | LA-UI{e} |
| component C29 | 1 | LA-UI{f} |
| component C30 | 1 | LA-UI{g} |
| component C31 | 1 | LA-UI{l} |
| component C32, C39 | 2 | LA-UI{h} |
| component C33, C35, C38 | 3 | dropped: test harnesses the tests' run by names (judgment call 16) |
| component C34 | 1 | LA-UI{i} |
| component C37 | 1 | Exploring's history endpoint handler (cross-domain item 2) |
| component C40 | 1 | CMD10-H, CMD11-H, CMD12-H, CMD14-H, CMD20-H, QRY07-H, PO01-H to PO03-H, DS04-SV, EN08-DM, the two adapters, LA-PLT-ENTRY01 |
| component C41 | 1 | SP01-PR, A9-REPO, EN15-DM, CMD19-H |
| component C42 | 1 | A6-REPO, VO{b}-VT, DS03-SV |
| component C43 | 1 | CMD15-H, CMD16-H, EN10-DM |
| component C44 | 1 | SP02-PR |
| component C45, C46 | 2 | LA-UI{s} |
| component C47 | 1 | CMD13-IPC, CMD14-IPC; the rest described on LA-UI{p} and LA-UI{s} |
| component C48, C49, C57, C60 | 4 | Tooling records |
| component C50 | 1 | VO{c}-VT, CMD13-H, LA-UI{r} |
| component C51 | 1 | LA-UI{p} |
| component C52 | 1 | LA-UI{q} |
| component C53 | 1 | QRY06-H; with C40, CMD14-H and INT{b}-AD |
| component C54 | 1 | LA-PLT-ENTRY02 |
| component C55, C56 | 2 | LA-UI{t} |
| component C58 | 1 | LA-PLT-ENTRY03 |
| component C59 | 1 | CMD18-H, A8-REPO, EN11-DM, EN12-DM, EN13-DM |
| component C61 | 1 | named by EP01-H and EP02-H (judgment call 16) |
| pattern LA-PAT-APP-CODE, LA-PAT-APP-UX | 2 | unchanged |
| pattern_rule | 24 | unchanged |
| standard LA-STD-CODE, standard_rule R01 to R03 | 1, 3 | unchanged |
| test LA-PLT-T01 to T160 (T11 is unused) | 159 | 206 test records (Test plan above), and the parts in cross-domain item 5 |

### Links

| Old link | Rows | Where it went |
| --- | --- | --- |
| has_many EN03→EN04, EN11→EN12, EN11→EN13 | 3 | unchanged |
| has_many EN03→EN05 | 1 | dropped with EN05 |
| has_many EN08→EN09 | 1 | EN15→EN09 |
| relates_to (16 rows: PLT-A1 with AUT-A1, A3, A6, A7, CHK-A1, A2, EXP-A1, TRC-A1 to A3; PLT-A3, A5 → EXP-A1; A5→A3; A6→A7; A8→A1) | 16 | A6→A7 → EN08's Server field (→ A7); the rest dropped: A1 is a read model filled from published events, A5 is gone, and A3's and A8's relations are through commands (decision 7) |
| refers_to CHK-EN02→EN01, EXP-EN01→EN01, EN02→EXP-EN01, EN05→EN04 | 4 | dropped: EN01 and EN05 left the entities; a panel shows a page but doesn't reference one |
| raised_by (none of Platform's) | 0 | events are raised by commands (Domain events above) |
| reacts_to A1→`LA-AUT-EV01`, `EV03`, `LA-CHK-EV01`; C09→ the same three | 6 | dropped: RM01's projection is filled from them (cross-domain item 1), and the page reloads through QRY02 (UC03-FL-S02); no command is invoked |
| reacts_to A6→EV04, A7→EV04 | 2 | PO01 |
| reacts_to A7→EV05, C40→EV05 | 2 | PO02 |
| reacts_to C41→EV04 | 1 | PO03 |
| reacts_to C23→EV01, C23→EV02 | 2 | dropped: the provider applies the choice inside CMD03's and CMD04's handlers; nothing else hears them |
| applies UC→DR (51 within Platform, 5 to others, 8 from others) | 64 | dropped: a use case changes nothing; its steps invoke commands, which check the specifications and keep their aggregates' invariants |
| follows LA-PLT→LA-PAT-APP-CODE, LA-PAT-APP-UX | 2 | unchanged |
| carries_out F01→UC01, UC02; F02→UC05; F03→UC07; F04→UC08; F05→UC11, 13, 14, 15; F06→UC12; F07→UC16 | 11 | each flow's parent (Flows above) |
| carries_out `LA-CHK-F03`→UC03; `LA-EXP-F02`→UC04, UC06, UC09, UC10 | 5 | replaced by UC03-FL, UC04-FL, UC06-FL, UC09-FL, UC10-FL |
| fulfills F→UC requirement (F03 7, F04 7) | 14 | moved to their steps (UC07-FL, UC08-FL) |
| fulfills F02-S01 to S04 → UC05-R01 to R04 | 4 | UC05-FL-S01 to S04 |
| fulfills F02 steps → DR07, DR08, DR09, DR10 | 4 | UC05-FL-S04→UC05-R05, S01→UC05-R06; DR08 and DR09 are DS01, called by QRY03, which the steps invoke |
| fulfills `LA-CHK-F03`→UC03-R01 | 1 | UC03-FL-S02 |
| fulfills E02→UC16-R01, E01-R01→UC03-R01, E02-R01→UC16-R01, E02-R02→UC16-R02 | 4 | dropped: steps reach endpoints through their command or query (UC16-FL-S02, S03; UC03-FL-S02) |
| uses F02→`LA-EXP-V01`, `V03`; F02-S01→`V03`, F02-S03→`V01`; F05→`LA-TRC-V01` | 5 | the steps' views (UC05-FL); F05's → dropped (the window shows every page) |
| uses F02-S01→C14, C17; S02→C16; S03→C14, C15; S04→C15, C16 | 7 | dropped: steps use no code; the UI components render the views they happen in |
| uses F07→E02 | 1 | UC16-FL-S02 invokes CMD18 |
| uses other domains' flows and views → E01, E02 (`LA-CHK-F03`, `LA-CHK-V01`, `LA-EXP-F01`, `F02`, `F07`, `LA-EXP-V01` to `V05`, `LA-TRC-F03`, `F04`, `LA-TRC-V01`) | 13 | cross-domain item 3 |
| uses `LA-CHK-DF01-S02`→C01 | 1 | cross-domain item 4 |
| implements C06→E01, E02; C08→E01 | 3 | EP01-H, EP02-H (ENTRY04 hosts the same API in development) |
| implements C07→`LA-EXP-V01` | 1 | LA-UI{a} renders it |
| implements C37→`LA-EXP-E01` | 1 | cross-domain item 2 |
| depends_on (50 within Platform, 11 to others, 22 from others) | 83 | dropped: what code uses follows from the tree |
| satisfies component→rule, requirement, interaction requirement (Platform's components 205, others' to Platform's records 36) | 241 | replaced by the technical record implementing each obligation's design kind |
| satisfies Platform component→pattern rule | 13 | dropped: pattern rules need proof only; the code's comments keep naming them |
| covers test→component | 24 | dropped: a test proves its parent; technical kinds have no tests of their own (decision 20) |
| meets C01→STD-CODE-R03; C37→R02, R03; C44→R03 | 4 | RM01-PJ→R03, SP02-PR→R03; C37's two → cross-domain item 2 |
| proves Platform test→Platform record | 211 | each new test's parent (Test plan above), less the duplicates dropped in judgment call 14 |
| proves Platform test→pattern rule | 66 | the 24 pattern rule tests and their notes |
| proves Platform test→another domain's record | 28 | cross-domain item 5 |
| proves other domains' tests→Platform records and pattern rules | 11 | cross-domain items 6 to 9 |
