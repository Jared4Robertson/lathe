# Conversion: LA-EXP (Exploring) to the new model

The sorting sheet for brief 107, domain LA-EXP. It lists Exploring's complete new spec, kind by kind in the plan's order ([domain-model-refinement.md](../plans/domain-model-refinement.md)), following the Tool Library's sheet ([tool-library.md](tool-library.md)), with each row's old source, and closes with a table that accounts for every old record and link. The apply step (brief 111) writes it together with the other domains' sheets.

It describes Exploring as the plan makes it, not as it was: where an old record describes a kind or relation the plan removes (domain rules, layers, components, APIs, technical flows, test groups, `refers_to`, `relates_to`, `reacts_to`, `raised_by`, `satisfies`, `proves`), the new record says what Exploring does with the new model, and the rewrite is listed under Judgment calls.

## Conventions
- **Short IDs.** IDs written short start `LA-EXP-` (`A1`, `INV03`, `UC05-R02`, `UC05-FL-S03`). IDs that start `VO`, `V`, `UI` or `INT` are product-scoped and start `LA-` (`LA-VO01`, `LA-V03-R08`).
- **Provisional numbers.** Product-scoped IDs (value objects, views, UI components, integrations) are numbered from 01 here; the apply step renumbers them across the domain sheets. Old view `LA-EXP-V0n` becomes `LA-V0n` here for reading ease.
- **Source** names the old record, all `LA-EXP-` unless written in full (`DR35`, `UC10-R01`, `C44`, `T115`), or the code (`app/src/…`).
- **Types** are the schema's basic types, a value object (`LA-VO01`…) or a reference to an aggregate (`→ A2`, or `→ LA-AUT-A1` across domains).
- **Optional** marks a field with `required: false`; every other field is required.
- **New** marks a row with no old record.
- **To resolve** marks a link to another domain's record whose new ID that domain's sheet decides; the old ID is given.
- **Text references.** Every `LA-EXP-DRnn`, `LA-EXP-V0n`, `LA-EXP-E01`, `LA-EXP-F0n` or `LA-EXP-Cnn` named in a kept statement, goal or description is replaced by the new record the closing table gives it.

## Domain

| ID | Kind | Title | Fields | Source |
| --- | --- | --- | --- | --- |
| LA-EXP | Domain | Exploring | description as today, except "the nav and its folders" reads "the nav and its stage folders"; subdomain type **core** | domain |

## Domain model

Exploring keeps three things of its own, all held in the reader's browser: the page in hand (its address), the spaces with their last pages, which nav rows are folded, and each space's tabs. Everything else it shows is read: read models filled from the loaded workspace, which belongs to Platform.

### Aggregates

| ID | Title | Parent | Identity | Source |
| --- | --- | --- | --- | --- |
| A1 | Page | LA-EXP | Address | A1, description and notes as today; "App pages are lowercase words…" moves to LA-VO01-C01 |
| A2 | Space | LA-EXP | Product | A2, as today |
| A3 | Nav row | LA-EXP | Product and row | A3 "Folder", reshaped: what the reader folds and unfolds in the nav. The folders themselves (stages and kind groups) come from the schema and are read model RM02 Folder tree. Description: "A row of the nav that folds, a domain, a stage, a kind group or a record with children, and whether the reader has it folded, for the browser session." |
| A5 | Tab group | LA-EXP | Space | A5, as today |

A4 Graph is no longer an aggregate: the map is read model RM03 Graph map, its settings are LA-VO03 Graph settings on each tab, and its camera belongs to the view (judgment call 4).

### Entities

| ID | Title | Parent | Role | Has value objects | Source |
| --- | --- | --- | --- | --- | --- |
| EN01 | Page | A1 | root | LA-VO01 App address, LA-VO02 View set | EN01 |
| EN02 | Space | A2 | root | LA-VO01 App address | EN02 |
| EN03 | Nav row | A3 | root | (none) | EN03, reshaped like A3 |
| EN09 | Tab group | A5 | root | LA-VO01 App address | EN09 |
| EN10 | Tab | A5 | child | LA-VO01, LA-VO02, LA-VO03 Graph settings | EN10 |

`has_many` EN09→EN10 stays. EN04 Test group goes with the test groups (judgment call 6); EN05 Graph, EN06 Node, EN07 Group and EN08 Edge go with A4, their fields to RM03 and LA-VO03 (table below).

No entity has a table: all four aggregates live in the browser's session storage and history, which no `table` record describes (judgment call 15).

### Entity fields

| Entity | # | Name | Type | Meaning | Example | Source |
| --- | --- | --- | --- | --- | --- | --- |
| EN01 | 1 | Address | LA-VO01 App address | Where the page is, to bookmark, share or reload. | /LA-AUT-A1?view=wiki,graph | EN01 field 1 |
| EN01 | 2 | Page kind | text | What sort of place it is: products, product, domain, record, group, checks, format or settings. | record | field 2 |
| EN01 | 3 | Focus | text, optional | The record or group the page is about: a record ID, or a group's address. | LA-AUT-A1 | field 3 |
| EN01 | 4 | Group kind | text, optional | On a kind group's page, the kind of the focus's children shown. | use_case | field 4 |
| EN01 | 5 | Views | LA-VO02 View set | How the focus is shown, in pane order; it never changes the path. | wiki, graph | field 5 "View" (`wiki`, `graph` or `split`), rewritten for the three panes |
| EN02 | 1 | Product | → LA-AUT-A1 Product (to resolve) | The product the space is. | TL | EN02 field 1 + refers_to and relates_to |
| EN02 | 2 | Last page | LA-VO01 App address, optional | The last page visited in the space, for this browser session only. | /TL-LEND-INV01?view=wiki,graph | field 5 + refers_to EN02→EN01 + relates_to A2→A1 |
| EN02 | 3 | Last chosen | yes/no | Whether it is the space the reader chose last, which stays current on a page outside every space (DS02). | yes | **New**: `lathe:space` in `spaces.tsx` |
| EN03 | 1 | Product | → LA-AUT-A1 Product (to resolve) | The product whose nav the row is in. | LA | **New**, from EN03 field 2 "Domain" |
| EN03 | 2 | Row | text | The row: a record's ID, or a stage's or kind group's address. | LA-EXP/domain-model | **New**, from EN03 field 1 "Section" |
| EN03 | 3 | Folded | yes/no | Whether it is folded in the nav, for this browser session. | no | field 4 |
| EN09 | 1 | Space | → A2 Space | The space whose tabs these are. | LA | EN09 field 1 + refers_to EN09→EN02 + relates_to A5→A2 |
| EN09 | 2 | Active page | LA-VO01 App address | The page of the tab shown, which the address names. | /LA-EXP-UC10 | field 3 "Active tab" (a reference to a child, which a field can't hold) |
| EN10 | 1 | Page | LA-VO01 App address | The page it holds, by its address path, without the views. | /LA-EXP-UC10 | EN10 field 1 + refers_to EN10→EN01 + relates_to A5→A1 |
| EN10 | 2 | Position | whole number | Its place in the row, left to right. | 2 | **New**: EN09 field 2 "Tabs" (an ordered list) |
| EN10 | 3 | Preview | yes/no | Whether the next plain open replaces it. | yes | field 2 |
| EN10 | 4 | Views | LA-VO02 View set | The views it has open, those its page does not offer included. | wiki, graph | field 3 |
| EN10 | 5 | Pane sizes | text | Each open pane's weight, a whole number from 1 to 10000, which the gaps share out. | wiki 160, graph 40 | field 4 |
| EN10 | 6 | Wiki scroll | whole number | How far down the wiki pane was, in pixels. | 120 | field 5 |
| EN10 | 7 | Graph settings | LA-VO03 Graph settings | The graph's layout, depth, trace, Links, minimap and filters. | depth 2 | field 6 |
| EN10 | 8 | Side bar | text | For each view mode, whether the side bar is open and which of its views it shows (UC12-R02). | graph: open, details | **New**: `lathe:side-bar` in `sideBarState.ts` |

Old fields that leave the entities:

| Old field | Goes to |
| --- | --- |
| EN02 Icon, Color, Place (derived) | RM06 Spaces fields, worked out by DS01 |
| EN03 Section, Domain, Label | RM02 Folder tree fields Stage, Domain and Label; EN03 keeps Product and Row |
| EN04 Group, Order, Label, Tests | dropped with EN04: Test plan lists tests by test kind (judgment call 6) |
| EN05 Page | dropped: the graph shows the page's focus (EN01 Focus) |
| EN05 Mode, Depth, Hidden kinds, Hidden relations | LA-VO03 fields Trace, Depth, Hidden kinds, Hidden relations |
| EN06 Record, Column | RM03 fields Node and Column |
| EN06 Distance | dropped: QRY08 works it out for each focus |
| EN07 Parent, Kind, Count | RM03 fields Parent node, Label and Count (a kind group is a node of the map) |
| EN07 Open | dropped: every member is always in the map, nothing opens in place (UC04-R02) |
| EN08 From, To, Relation | dropped: parent lines follow from RM03's Parent node, and links are QRY08's one hop (SP05) |
| EN09 Tabs | the child entity EN10 itself, with its Position |

### Value objects and constraints

| ID | Kind | Title | Parent | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| LA-VO01 | Value object | App address | (used by EN01, EN02, EN09, EN10; EV01, EV02) | A place in the app: a path and its `view` query parameter. | **New**: the "Path, with the view as a query parameter" type of EN01 field 1 |
| LA-VO01-C01 | Constraint | One address per thing | LA-VO01 | A record's address MUST be its bare ID (`/<id>`), a product's and a domain's included, and a group's its place in the graph's tree: a stage at `/<domain-id>/<stage>` and a kind group at `/<parent-id>/<kind>`. The app's own pages MUST be lowercase words (`/`, `/format`, `/settings/appearance`), and a space's Checks page its product's ID and a word (`/LA/checks`), so no ID, which starts with a capital, can take their address. There is no second address for anything. | DR08's first sentence and DR44's first sentence, rewritten: stage addresses lose the Define and Design level, and DR08's last clause (older `/graph/<id>` addresses lead to the same thing) is dropped (judgment call 13); A1's description ("App pages are lowercase words…") |
| LA-VO01-C02 | Constraint | Views are named only in the query | LA-VO01 | An address MUST name views only in its `view` query parameter (`?view=wiki,graph`), never in its path, so the views never change the path. | DR08's second sentence |
| LA-VO02 | Value object | View set | (used by EN01, EN10; EV01, EV02) | The views a page or a tab has open. | **New**: the views of EN01 field 5 and EN10 field 3 |
| LA-VO02-C01 | Constraint | A view set holds Wiki, Graph and Model in order | LA-VO02 | A view set MUST hold at least one of `wiki`, `graph` and `model`, each at most once, always in that order. | UC05-R02 ("at least one view MUST stay open", "always in the order Wiki, Graph, Model") |
| LA-VO03 | Value object | Graph settings | (used by EN10) | How a tab's graph is drawn. Fields: Layout (text: `tree`, `nested` or `voronoi`), Depth (whole number), Trace (yes/no), Links (yes/no), Minimap (yes/no), Hidden kinds (text, optional), Hidden relations (text, optional). | **New**: EN10 field 6, EN05 fields 2–5, UC03-R15, UC03-R16 |
| LA-VO03-C01 | Constraint | Depth is 1 to 3, and the layout is one of three | LA-VO03 | A graph's depth MUST be a whole number from 1 to 3, and its layout one of `tree`, `nested` and `voronoi`. | DR46 ("Depth stays 1 to 3"), UC03-R16 |

### Invariants

| ID | Title | Parent | Statement | Enforced by | Source |
| --- | --- | --- | --- | --- | --- |
| INV01 | Every page has its own address | A1 | DR01's statement: every page MUST have its own address, an entry of the browser's history, so it can be bookmarked, shared and reloaded and Back and Forward move between pages. | CMD01 pushes one history entry per page | DR01 |
| INV02 | Every pane shows the page's one focus | A1 | DR09's statement, unchanged. | CMD01; every pane reads EN01 Focus | DR09 |
| INV03 | A page shows the views it offers, the link's first | A1 | DR10's statement, unchanged ("Model, away from a domain, aggregate or entity" names SP02). | CMD01, through SP02 | DR10 |
| INV04 | A space's last page lasts the session | A2 | DR15's statement, unchanged. | A2-REPO keeps it in session storage | DR15 |
| INV05 | What is folded in the nav lasts the session | A3 | DR22's statement, unchanged. | A3-REPO keeps it in session storage | DR22 |
| INV06 | One tab per page at most, and one preview tab at most | A5 | DR32's statement, unchanged. | CMD04 | DR32 |
| INV07 | There is always a tab | A5 | DR33's statement, unchanged. | CMD06 | DR33 |
| INV08 | A tab's state is its own | A5 | DR34's statement, unchanged. | CMD04, CMD08 | DR34 |

DR35 (the address names the active tab) joins two aggregates, the page and the tab group, so it became the policies PO02 and PO03.

### Specifications

| ID | Title | Reads | Statement | Source |
| --- | --- | --- | --- | --- |
| SP01 | Belongs to the space | A2 | A record, link, part row, coverage count or problem belongs to a space when it is of the space's product, or of no product; a link only when both its ends do. Nothing else shows inside the space, nor a link to a record of another product from an ID named in text; another product stays one choice away in the rail. | DR16 |
| SP02 | The page offers the view | A1 | A page offers Wiki and Graph when its focus is a product, domain, record or group, and Model only when its focus is a domain, an aggregate or an entity. | DR10's second sentence, UC11-R01 |
| SP03 | A list splits by kind | A3 | A list of records, a nav row's or a graph node's children included, splits into one group per kind exactly when it holds more than one kind to tell apart; with one, its records are listed directly, with no level, heading, row, tag or graph group for the kind. Groups that are records (capabilities, use cases, aggregates) and the five stages are not such splits and stay. The answer depends on the children alone, never on the focus, depth or filters. | DR27 and DR07, rewritten: "or by a computed group such as a test group" and "layers" go |
| SP04 | Shown by the graph's filters | A5 | A node is shown when neither its kind nor the relation that reaches it is hidden by the tab's graph settings, and no hidden node lies on its path from the focus. The focus is always shown. | DR05 |
| SP05 | Linked to the focus | A1, A5 | With the Links switch on, a record is linked to the focus when one link joins them, in either direction, through a relation the filters show (SP04). | DR49's first sentence |

### Domain events

Both are unpublished: no other domain hears them.

| ID | Title | Parent | Raised by | Source |
| --- | --- | --- | --- | --- |
| EV01 | Page opened | A1 | CMD01 | EV01, description as today; raised_by EV01→EN01 |
| EV02 | Active tab changed | A5 | CMD06, CMD07 | **New**: the half of DR35 where a tab moves the address |

| Event | # | Name | Type | Source |
| --- | --- | --- | --- | --- |
| EV01 | 1 | Address | LA-VO01 App address | EV01 field 1 ("App address.") |
| EV01 | 2 | Product | → LA-AUT-A1 Product (to resolve), optional | field 2 ("Product reference, or none.") |
| EV01 | 3 | Focus | text, optional | field 3 ("Record ID, group, or none.") |
| EV01 | 4 | Views | LA-VO02 View set | field 4 |
| EV01 | 5 | Opened at | date and time | field 5 |
| EV02 | 1 | Space | → A2 Space | **New** |
| EV02 | 2 | Page | LA-VO01 App address | **New** |
| EV02 | 3 | Views | LA-VO02 View set | **New** |

Meanings and examples of EV01's fields carry over unchanged. EV02's meanings: the space whose tab is now active; that tab's page; that tab's views.

### Commands

Each changes one aggregate. Found in the code.

| ID | Title | Parent | Raises | Checks | Source |
| --- | --- | --- | --- | --- | --- |
| CMD01 | Open a page | A1 | EV01 | SP02 | **New**: `navigate` in `app/src/router.tsx`; the reader goes to an address by a link, a node, the nav, quick find, a view toggle, a key or Back and Forward. Description: a view toggled on the same page replaces the history entry; any other move pushes one (INV01). |
| CMD02 | Remember the page in its space | A2 | | | **New**: `useSpaceState` in `app/src/shell/spaces.tsx`. Description: sets the space's Last page and makes it the one last chosen. |
| CMD03 | Fold or unfold a nav row | A3 | | | **New**: the fold buttons of `app/src/shell/Nav.tsx` |
| CMD04 | Open the page in a tab | A5 | | | **New**: `openTab` through `arrive` in `app/src/views/useTabs.ts`. Description: activates the page's tab, or replaces the preview tab's page, or opens a new tab after the active one (a new, kept tab on Cmd- or Ctrl-click). |
| CMD05 | Keep a tab open | A5 | | | **New**: `keepTab` |
| CMD06 | Close a tab | A5 | EV02 | | **New**: `closeTab` |
| CMD07 | Activate a tab | A5 | EV02 | | **New**: `activateTab`, `cycleTab` |
| CMD08 | Change a tab's state | A5 | | | **New**: `updateTab`; pane sizes, wiki scroll, graph settings and the side bar's state |

The writes a record's page sends (Edit, Add, Remove) are not Exploring's commands: UC14's steps invoke Platform's write command, LA-PLT-A8's (to resolve).

### Read models and fields

Exploring's read models are filled from the loaded workspace, which is another domain's: each projection rebuilds its read model whenever a load is published (LA-CHK-EV02 Workspace checked, or the load event the Platform sheet defines; to resolve, and it must be published). So they read no aggregate of their own domain except where named (judgment call 5). None has a table: each is held in memory, once per load (judgment call 15).

| ID | Title | Parent | Reads | Description | Source |
| --- | --- | --- | --- | --- | --- |
| RM01 | Space index | LA-EXP | A2 | One index per space: the records of its product and of no product (SP01), their parts, the links among them, their coverage, and the space's problems with the workspace's. | **New** as a kind: C65 `spaceIndex` |
| RM02 | Folder tree | LA-EXP | A3 | Each product's nav tree: Shared, then each domain's five stages, the kind groups inside a stage that holds several kinds (SP03), and the records in them, placed by DS03. | **New** as a kind: A3 Folder, C32 and C36 `folders.ts` |
| RM03 | Graph map | LA-EXP | | One map per product and layout: the folder tree (DS04) laid out once per load by DS05 (Tree), DS07 (Nested) or DS08 (Voronoi), every node with its place, size and label. | **New** as a kind: A4 Graph, EN05–EN08, C64 |
| RM04 | ERD | LA-EXP | | What a domain's or an aggregate's ERD draws: boxes and lines, worked out on each request. | **New** as a kind: C46 |
| RM05 | Record history | LA-EXP | | The commits that changed a record's rows, read from git on each request. | **New** as a kind: API01's History and Change shapes |
| RM06 | Spaces | LA-EXP | A2 | Every product as a space in the rail, with its look and place. | **New** as a kind: EN02's derived fields |

| Read model | # | Name | Type | Meaning | Source |
| --- | --- | --- | --- | --- | --- |
| RM01 | 1 | Product | → LA-AUT-A1 Product (to resolve) | The space's product. | `spaceIndex(index, product)` |
| RM01 | 2 | Record | text | A record's ID. | `SpecRecord.id` |
| RM01 | 3 | Kind | text | Its kind. | `kind` |
| RM01 | 4 | Title | text | Its title. | `title` |
| RM01 | 5 | Parent | text, optional | Its parent's ID. | `parent` |
| RM01 | 6 | Problems | whole number | How many problems name it. | `problems` |
| RM02 | 1 | Product | → LA-AUT-A1 Product (to resolve) | The product whose nav it is. | `productFolders` |
| RM02 | 2 | Domain | → LA-AUT-A2 Domain (to resolve), optional | The domain the row is in, or none in Shared. | EN03 field 2 |
| RM02 | 3 | Stage | text, optional | The stage the row is in. | EN03 field 1 "Section" |
| RM02 | 4 | Row | text | A record's ID, or a stage's or kind group's address. | `Folder.key` |
| RM02 | 5 | Parent row | text, optional | The row it sits in. | `branchOf` |
| RM02 | 6 | Position | whole number | Its place among its siblings. | **New** |
| RM02 | 7 | Label | text | The name shown: a stage's own name, a kind group's plural label (`plural()`), a record's title. | EN03 field 3, EN04 field 3 |
| RM02 | 8 | Count | whole number | How many records it holds; an empty stage or kind group is not a row. | EN04 field 4 |
| RM03 | 1 | Product | → LA-AUT-A1 Product (to resolve) | The product the map is of. | `mapRootOf` |
| RM03 | 2 | Layout | text | `tree`, `nested` or `voronoi`. | UC03-R16 |
| RM03 | 3 | Node | text | A record's ID, or a stage's or kind group's address. | EN06 field 1, EN07 |
| RM03 | 4 | Parent node | text, optional | Its parent in the tree; none for the product. | EN07 field 1 |
| RM03 | 5 | Column | whole number | Its depth in the tree, shared with its siblings. | EN06 field 2 |
| RM03 | 6 | X | decimal | Its left edge, in map units. | `MapNode.x` |
| RM03 | 7 | Y | decimal | Its top edge, in map units. | `MapNode.y` |
| RM03 | 8 | Width | decimal | In map units. | `MapNode.w` |
| RM03 | 9 | Height | decimal | In map units. | `MapNode.h` |
| RM03 | 10 | Text scale | decimal | Its label's scale, shared with its siblings (DS06). | `MapNode.scale` |
| RM03 | 11 | Label | text | Its kind and ID line and its title, broken into lines. | `labelLines` |
| RM03 | 12 | Count | whole number, optional | A kind group's or stage's number of members. | EN07 field 3 |
| RM04 | 1 | Focus | text | The domain, aggregate or entity the ERD is of. | `erdFor` |
| RM04 | 2 | Item | text | A box (an aggregate, entity or domain event) or a line. | `ErdBox`, `ErdLine` |
| RM04 | 3 | From | text, optional | A line's start. | `ErdLine.source` |
| RM04 | 4 | To | text, optional | A line's end. | `ErdLine.target` |
| RM04 | 5 | Relation | text, optional | What a line stands for: `has_one`, `has_many`, a reference field, `raises` or a policy's `hears`. | `ErdRelation`, rewritten (DS11) |
| RM04 | 6 | Tone | text | `current` for the domain's own, `other` for another domain's. | `ErdTone` |
| RM05 | 1 | Record | text | The record's ID. | History shape `id` |
| RM05 | 2 | Commit | text | The commit's hash, or `working` for changes not committed yet. | `hash` |
| RM05 | 3 | Date | date and time | When it was committed. | `date` |
| RM05 | 4 | Author | text | Who committed it. | `author` |
| RM05 | 5 | Subject | text | The commit's subject. | `subject` |
| RM05 | 6 | Change | text | Added, removed or changed, with the fields before and after. | Change shape |
| RM06 | 1 | Product | → LA-AUT-A1 Product (to resolve) | The product. | EN02 field 1 |
| RM06 | 2 | Icon | text | What the rail shows (DS01). | EN02 field 2 |
| RM06 | 3 | Color | text | The icon's color (DS01). | EN02 field 3 |
| RM06 | 4 | Place | whole number | Its place in the rail, which Alt and its number opens (DS01). | EN02 field 4 |
| RM06 | 5 | Domains | whole number | How many domains it has, for the products page. | UC07-R10 |

### Queries

| ID | Title | Parent | Selects by | Calls | Source |
| --- | --- | --- | --- | --- | --- |
| QRY01 | Read a record | RM01 | | | **New**: `RecordContent` (C08) |
| QRY02 | Find a record | RM01 | SP01 | | **New**: `findItems`, `rankItems` (C17, C29) |
| QRY03 | List a space's problems | RM01 | SP01 | | **New**: the Checks page (C31); to resolve with LA-CHK, whose view it fills |
| QRY04 | Read a record's form | RM01 | | DS12 | **New**: `Editable` opening a form (C86) |
| QRY05 | Read the nav | RM02 | SP03 | DS03 | **New**: `Nav` (C16, C33) |
| QRY06 | Read a domain | RM02 | SP03 | DS03 | **New**: `DomainWiki` (C07, C34) |
| QRY07 | Read a group | RM02 | SP03 | | **New**: a group page (C35, C38) |
| QRY08 | Frame a focus | RM03 | SP04, SP05 | DS09, DS10 | **New**: `neighborhood` (C03, C10, C23, C26, C39) |
| QRY09 | Trace an obligation | RM03 | SP04 | | **New**: `traceChain` (C03, C26) |
| QRY10 | Draw an ERD | RM04 | | DS11 | **New**: `erdFor` (C46) |
| QRY11 | Read a record's history | RM05 | | | **New**: E01's answer (LA-PLT-C37's `history.ts`) |
| QRY12 | List the spaces | RM06 | | DS01 | **New**: the rail and the products page (C28, C31) |

### Policies

| ID | Title | Parent (the command it invokes) | Hears | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| PO01 | A page opened in a space becomes its last page | CMD02 | EV01 | Whenever a page that belongs to a space is opened (DS02), remember it as that space's last page, and that space as the one last chosen. | reacts_to A2→EV01 and C27→EV01; DR12's "last chosen" |
| PO02 | A page opened shows in a tab | CMD04 | EV01 | Whenever a page is opened, open it in its space's tab group: activate its tab as it was, a plain open replacing the preview tab's page in place, and Back to a page whose tab was closed reopening it as the preview tab. When the address names views, the tab takes them and is kept. | reacts_to A5→EV01 and C44→EV01; DR35's first and last clauses; UC10-R02's "opens or closes one of its views" |
| PO03 | The address follows the active tab | CMD01 | EV02 | Whenever the active tab changes (activated, cycled or a neighbor after a close), open its page with its views, so the address names the active tab. | DR35's middle clause |

The three are delivered in process: everything happens in one browser tab, with no transaction for an outbox to join. The plan's outbox check will warn on EV01 and EV02; that warning is deliberate here (judgment call 9).

### Domain services

| ID | Title | Parent | Used by | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| DS01 | Space look and place | LA-EXP | QRY12 | DR13's statement (a product's icon and color, or its monogram and a color derived from its ID), and DR14's: spaces are in the products' ID order everywhere they are listed, and the nth is the one Alt+n opens. | DR13, DR14 |
| DS02 | Current space | LA-EXP | CMD02 (through PO01), QRY02 | DR12's statement, unchanged. | DR12 |
| DS03 | Folder placement | LA-EXP | QRY05, QRY06 | Places a product's records in the nav's tree, read by the nav, the domain page, the group pages and the graph alike (DR19). A product holds Shared (its patterns and standards, and its records with no owner: value objects, views, integrations, UI components), then its domains, then its open questions. A domain holds its five stages in the schema's order, `schema.stages`, each named by its own label, then its open questions. A record sits in its kind's stage: at the top of the stage when its parent is its domain or of another stage (a flow under its use case, a handler under its command, a test under its obligation), and under its parent when the parent is of the same stage, reached through it (DR21). A kind in no stage gets a folder of its own after the stages. Within a stage, kinds come in the schema's order (Test plan's ten test kinds in the plan's order), and records with a `position` (capabilities, flow steps) come by it, then by ID, with the records outside any capability last. An empty stage or kind group is never shown. | DR18, DR19, DR20, DR21, DR24, DR25, DR26, DR28, rewritten: `Workspace.sections` becomes `schema.stages`, Define and Design go, layers go, and the computed test groups go because each test kind is a kind (judgment call 6) |
| DS04 | Graph tree | LA-EXP | (RM03's projection) | The graph's tree is the nav's tree, from DS03: DR45's statement, rewritten for the five stages and Shared. A kind group is derived from its parent and the kind of its children, never a record: it has no ID of its own, only its address, and no record links to it (DR06). | DR45, DR06 |
| DS05 | Tree map layout | LA-EXP | (RM03's projection) | DR57's statement, with DR17's (siblings share a column, ordered by their parent's place, then kind, then ID) and DR04's (the same specs always give the same map). | DR57, DR17, DR04 |
| DS06 | Label fitting | LA-EXP | (RM03's projection) | DR58's statement, unchanged. | DR58 |
| DS07 | Nested map layout | LA-EXP | (RM03's projection) | DR62's statement, unchanged. | DR62 |
| DS08 | Voronoi map layout | LA-EXP | (RM03's projection) | DR64's statement, unchanged. | DR64 |
| DS09 | Camera framing | LA-EXP | QRY08 | Where the camera goes: DR46's statement (depth N frames the focus, its parent at the left edge and N levels below, every stage and group a level), DR59's first paragraph (frame, zoom limits, one smooth zoom and pan), DR63's (Nested and Voronoi frame the focus box) and DR48's (the Model view fits its boxes in focus only). | DR46, DR59 (first paragraph), DR63, DR48 |
| DS10 | Level of detail | LA-EXP | QRY08 | DR60's statement: which nodes are drawn (in view with a tenth to spare, at least 3 pixels, at most 260 boxes a level, bars for the rest), unchanged. | DR60 |
| DS11 | ERD lines | LA-EXP | QRY10 | An aggregate's ERD draws exactly one line for each `has_one` and `has_many` link its entities hold and for each field of its entities typed by a reference to another aggregate; a domain's ERD draws one line for each aggregate pair and direction that such a reference field joins, and one dashed line for each pair of aggregates and event where a policy under one aggregate's command hears an event the other aggregate raises, from the raising aggregate to the hearing one. A policy hearing its own aggregate's event draws no line. No line stands for nothing. | DR37 and DR51, rewritten: `refers_to` becomes reference fields, `reacts_to` becomes policies hearing events |
| DS12 | Record form | LA-EXP | QRY04 | DR66's statement, unchanged. | DR66 |

DS04 to DS08 are used by RM03's projection, which the plan gives no `calls` link (judgment call 5).

### Terms

All **New**, from the domain's descriptions, goals and requirements.

| ID | Term | Meaning |
| --- | --- | --- |
| TM01 | Page | One place in the app at its own address, showing one focus. |
| TM02 | Address | A page's path and its `view` query parameter. |
| TM03 | Focus | The product, domain, record or group a page is about. |
| TM04 | View | One way to read a focus, opened as a pane: Wiki, Graph or Model. |
| TM05 | Space | One product as a place to work in, chosen from the rail. |
| TM06 | Rail | The column of space icons at the far left of the nav. |
| TM07 | Stage folder | One of a domain's five stages in the nav, listing its records by kind. |
| TM08 | Kind group | The records of one kind in a stage or under a parent, shown together when there are several kinds to tell apart. |
| TM09 | Map | A product's tree laid out once as boxes, which focusing never moves. |
| TM10 | Depth | How many levels below the focus the camera frames. |
| TM11 | Trace | A chain from an obligation through its design and implementation to its tests. |
| TM12 | Tab | One open page with its own views and settings, in a space's row of tabs. |
| TM13 | Preview tab | The tab a plain open replaces, shown in italics. |
| TM14 | Side bar | The page's last column, with its Details, Outline and History views. |
| TM15 | ERD | A domain's or an aggregate's model drawn as boxes and lines in the Model view. |

## Use cases

### Capabilities
CAP01 Reading and editing the spec, CAP02 Views, tabs and the side bar, and CAP03 The graph carry over unchanged.

### Use cases
Actors (Reader for all but UC14, Owner for UC14) and capabilities are unchanged. No `follows` links. Goals are as today except:

| ID | Title | Goal change |
| --- | --- | --- |
| UC01 | Find a record in a domain | "a rule, use case, component or test" becomes "an invariant, a use case, a handler or a test" |
| UC02 | Follow a record's links | "from a requirement to the components that satisfy it and the tests that prove it, or from a test back to what it proves" becomes "from an obligation to the flow steps that fulfill it, the records that implement its design and the tests under it, or from a test back to its parent" |
| UC06 | Read a flow step by step | "the view, endpoint or component it goes through, and what it carries out" becomes "the command or query it invokes, the view it happens in, and the requirements it fulfills"; "a requirement's trace shows the step that carries it out" becomes "…the step that fulfills it" |
| UC08 | Read a product laid out in stage folders | "Shared holds the patterns; each domain folds into Define (Domain model, Use cases) and Design (Interaction design, Technical specification, Test plan)" becomes "Shared holds the patterns, the standards and the records with no owner; each domain folds into its five stages" |
| UC09 | Read the technical specification and test plan by kind | Retitled from "…in their groups". Goal: "The reader reads a domain's Technical specification and Test plan by kind instead of two long lists: repositories, data models, handlers and the other technical kinds, each under its own heading, and the ten test kinds in the plan's order, each test under the obligation it proves. The side nav, the domain page, the group pages and the graph all show the same groups, and the graph's trail names what the reader has visited." |
| UC11 | Read a domain and its aggregates as an ERD | "how their entities refer to each other" becomes "how their entities' reference fields join them"; "the entity raising each, and the aggregates that react to them" becomes "the commands raising each, and the aggregates whose policies hear them" |
| UC13 | Read a domain's endpoints and integrations | Retitled from "Read a domain's APIs, integrations and technical flows". Goal: "The reader opens a command or query and reads the endpoint that exposes it, with its method, route and API requirements, opens an integration and reads the flow steps that exchange with its outside system, and finds endpoints in their domain's Interaction design and integrations in the product's Shared, as a real product's specs are laid out." |

### UC requirements

All 112 carry over as `uc_requirement` rows with their IDs, titles and statements, except three dropped and these rewritten:

| ID | Rewrite |
| --- | --- |
| UC01-R01 | "group its records by stage. Define MUST show aggregates with their rules nested, and use cases with their requirements nested. Design MUST show flows, views, endpoints, components and tests" becomes "group its records by its five stages, each record under its parent where the parent is of the same stage (an aggregate's invariants, a use case's requirements)" |
| UC02-R01 | "a use case's steps in order, a product's roles, an API's shapes" becomes "a flow's steps in order, a product's roles, a table's keys" |
| UC03-R04 | "colored by stage (Define, Design, structural)" becomes "colored by their stage, each of the five stages its own color, structure nodes their own" |
| UC03-R05 | "keep only the traceability links (satisfies, proves, fulfills)" becomes "keep only the design and proof links (fulfills, invokes, happens in, and parent links to implementations and tests)" |
| UC04-R07 | "an event's `reacts_to` and `raised_by` links" becomes "the `raises` links into an event and the `hears` links of the policies that hear it"; labels "Raised by", "Heard by" from the meta-model |
| UC04-R09 | "Trace mode MUST be offered for a pattern rule, showing what satisfies and proves it in every domain" becomes "…showing its pattern rule tests in every domain that follows it" |
| UC05-R01 | the test-plan group parts of an address (`/…/test-plan/acceptance/…`) and the sentence on the old `/records/…` and `/graph/…` addresses go: a stage is `/<domain-id>/<stage>`, a kind group `/<parent-id>/<kind>` (judgment call 13) |
| UC05-R12 | the domain page's kinds "Aggregates, Use cases, Flows, Views, Endpoints, Components, Tests, Open questions" become "its five stages and open questions, each stage's kinds in the schema's order" |
| UC05-R14 | "a view's interaction requirements" becomes "a view's view requirements, an endpoint's API requirements" |
| UC06-R01 | columns "Step (order and ID), What happens (the title), Uses and Carries out" become "Step (order and ID), What happens (the title), Invokes, In view and Fulfills" |
| UC06-R02 | "the titles and kinds of what it uses and fulfills" becomes "…of what it invokes, happens in, exchanges with and fulfills" |
| UC06-R05 | "Trace mode for a requirement or rule MUST show each flow step that fulfills it, the flow the step belongs to, and the components the step uses" becomes "Trace mode for a UC requirement MUST show each flow step that fulfills it, the flow the step belongs to, and the command or query the step invokes with its handler" |
| UC07-R03 | "each folding into its Define and Design folders as the schema's folders place them (with the capabilities in order under Define › Capabilities)" becomes "each folding into its five stages as the schema places kinds (with the capabilities in order under Use cases)" |
| UC08-R01 | "Shared, only when the product has patterns, holding them; then each domain, which unfolds into Define (Domain model, Use cases) and Design (Interaction design, Technical specification, Test plan)" becomes "Shared, only when it holds anything, holding the patterns, the standards and the records with no owner; then each domain, which unfolds into its five stages" |
| UC08-R03 | "a record page its domain, stage and folder (or Shared)" becomes "a record page its domain and stage (or Shared), and the parents above it in that stage" |
| UC08-R04 | "A capability's flows and tests MUST be listed in Interaction design and Test plan" becomes "A use case's flow MUST be listed in Interaction design and a requirement's tests in Test plan" |
| UC08-R05 | "(Define: Domain model, Use cases; Design: Interaction design, Technical specification, Test plan)" becomes "(the five stages)"; "Design › Interaction design" becomes "Interaction design" |
| UC09-R01 | becomes "A domain's Technical specification MUST list its records by technical kind, in the plan's order (repositories, data models, tables, value types, predicates, event types, projections, command handlers, query handlers, event handlers, services, endpoint handlers, adapters, then the product's own kinds), each record with the design record it implements" |
| UC09-R02 | becomes "A domain's Test plan MUST list its tests by test kind in the plan's order (constraint, invariant, specification, policy, domain service, use case, view, endpoint, flow, integration and pattern rule tests), each with its parent and run by" |
| UC09-R03 | "layers and test groups" become "technical and test kind groups"; "A layer's row MUST link to the layer's page; a test group's row MUST only fold" becomes "a kind group's row MUST only fold" |
| UC09-R04 | "Technical specification's layers (each linking to its page) and Test plan's groups" become "Technical specification's and Test plan's kind groups" |
| UC09-R06 | becomes "In the graph a domain MUST reach its technical records and its tests through their stage and kind groups, as the nav does, and each record keeps its own place in the map (DS05)" |
| UC09-R08 | becomes "Records with no owner MUST be listed in their product's Shared, by stage (value objects and their constraints, views and their requirements, integrations, UI components), and a specification in its domain's Domain model, in the nav and on the domain page alike" (old: sub-layers nest, rules under an entity) |
| UC11-R02 | "one line for each aggregate pair and direction that a `refers_to` link between their entities joins … An aggregate whose entities refer to no other aggregate MUST show its `relates_to` links instead" becomes "one line for each aggregate pair and direction that a reference field of their entities joins (DS11)"; the `relates_to` fallback goes |
| UC11-R03 | "each `has_one` (one to one), `has_many` (one to many) and `refers_to` (many to one) link" becomes "each `has_one` (one to one) and `has_many` (one to many) link and each reference field (many to one)"; each field's kind of value names its value object or basic type |
| UC11-R07 | "Where the event has `raised_by`, a short line MUST run to it from the entity that raises it … Each aggregate that reacts to the event" becomes "a short line MUST run to it from the aggregate's root … Each aggregate whose policy hears the event" |
| UC11-R08 | "a dashed "reacts to" line … each aggregate that reacts to it" becomes "a dashed "heard by" line … each aggregate whose policy hears it (DS11)" |
| UC11-R09 | "the line from the entity that raises an event and the dashed "reacts to" line" becomes "the "raises" line and the dashed "heard by" line" |
| UC13-R01 | becomes "A command's or query's page MUST show the endpoint that exposes it, with its method and route, and an endpoint's page its API requirements, each in its own section with its count" |
| UC13-R02 | becomes "An integration's page MUST list the flow steps that exchange with it, in a section with its count, saying which outside system it is when it names one" |
| UC13-R03 | becomes "The nav, the domain page and the graph MUST place an endpoint in its domain's Interaction design, and an integration in its product's Shared, by its kind's stage in the meta-model" |

Dropped: **UC06-R07** and **UC06-R08** (technical flows and their steps are no kind in the plan), **UC09-R05** (layers go). Every rule ID a kept statement names is updated by the convention above.

## Interaction design

### Flows

One per use case, belonging only to it.

| ID | Title | Parent | Source |
| --- | --- | --- | --- |
| UC01-FL | Find a record in a domain | UC01 | **New** for this use case: LA-TRC-F03 steps 1–2 (to resolve: the TRC sheet splits F03) |
| UC02-FL | Follow a record's links | UC02 | LA-TRC-F03 steps 3–4, likewise |
| UC03-FL | Walk the model as a graph | UC03 | F01 steps 1, 2 and 4 |
| UC04-FL | Walk the graph through folder-like groups | UC04 | F01 step 2 |
| UC05-FL | Read a record as wiki, graph or model, from the keyboard | UC05 | F02 steps 1–2 |
| UC06-FL | Read a flow step by step | UC06 | F03 and its steps |
| UC07-FL | Move between products as spaces | UC07 | F04 and its steps |
| UC08-FL | Read a product's stage folders | UC08 | **New** (F04 carried UC08 out without a step of its own) |
| UC09-FL | Read the technical specification and test plan by kind | UC09 | **New** (LA-TRC-F03 carried it out without a step of its own) |
| UC10-FL | Keep several records open in tabs | UC10 | F02 step 4 |
| UC11-FL | Read a domain's ERD | UC11 | F02 step 3 |
| UC12-FL | Look something up in the side bar | UC12 | F05 (its description becomes the steps) |
| UC13-FL | Read a domain's endpoints and integrations | UC13 | F06 steps 1–3; step 4 (technical flows) goes |
| UC14-FL | Fix a record where it is read | UC14 | F07 (its numbered description becomes the steps) |

F01's part for LA-TRC-UC10 and F02's parts for LA-PLT-UC04, UC06, UC09 and UC10 go to those use cases' flows (to resolve).

### Flow steps

Each invokes at most one command or query and happens in at most one view. Step IDs are written short: `UC01-FL-S01` is `LA-EXP-UC01-FL-S01`. Paths are `main` unless written.

| ID | Title | Invokes | In view | Fulfills | Source |
| --- | --- | --- | --- | --- | --- |
| UC01-FL-S01 | The reader sees the current space's domains in the nav | QRY05 | LA-V01 | UC01-R04 | LA-TRC-F03 step 1; fulfills V01→UC01-R04 |
| UC01-FL-S02 | They open a domain: its records by stage, its coverage gaps and problems | QRY06 | LA-V02 | UC01-R01, UC01-R03 | LA-TRC-F03 step 2; V02→UC01-R01, R03 |
| UC01-FL-S03 | They type in the search box and the records filter by ID or title | | LA-V02 | UC01-R02 | V02→UC01-R02 |
| UC01-FL-S04 | They open the record they found | CMD01 | LA-V02 | | LA-TRC-F03 step 2 |
| UC02-FL-S01 | The reader reads a record's page: its fields, sanitized text, parts, parent, children and problems | QRY01 | LA-V03 | UC02-R01, UC02-R03, UC02-R04 | LA-TRC-F03 step 3; V03→UC02-R01, R03, R04 |
| UC02-FL-S02 | They follow a link out or in, named by its relation's label, or a record named in the text; an unknown ID stays text | CMD01 | LA-V03 | UC02-R02, UC02-R06, UC02-R07 | LA-TRC-F03 step 3; V03→UC02-R02; LA-TRC-F03→UC02-R02 |
| UC02-FL-S03 | A click anywhere on a row opens its record | CMD01 | LA-V03 | UC02-R05 | **New** |
| UC03-FL-S01 | The reader turns on the Graph view of the page in hand, never from the nav | CMD01 | LA-V07 | UC03-R07 | F01 step 1 |
| UC03-FL-S02 | The graph frames the focus in the product's one map, at depth 1, its parent at the left | QRY08 | LA-V04 | UC03-R01, UC03-R08 | F01 step 1; V04→UC03-R01, R08 |
| UC03-FL-S03 | Nodes show their stage, kind, problems and gaps, with a legend, and hovering one spotlights what it joins | | LA-V04 | UC03-R04, UC03-R10 | V04→UC03-R04 |
| UC03-FL-S04 | They click a node: the camera glides to it, the map holds still, the address and the trail follow | CMD01 | LA-V04 | UC03-R02, UC03-R09 | F01 step 2; V04→UC03-R02 |
| UC03-FL-S05 | The side bar describes the focused record | QRY01 | LA-V06 | UC03-R03 | V04→UC03-R03 |
| UC03-FL-S06 | They filter kinds and relations, switch Links on (edge hints count what lies past each edge) and the minimap | CMD08 | LA-V04 | UC03-R05, UC03-R12, UC03-R15 | V04→UC03-R05 |
| UC03-FL-S07 | They switch the layout to Nested or Voronoi | CMD08 | LA-V04 | UC03-R16, UC03-R17 | **New** |
| UC03-FL-S08 | From the keyboard they move between nodes, step out, in and across, and Escape clears the filters | CMD01 | LA-V04 | UC03-R06, UC03-R14 | V04→UC03-R06 |
| UC03-FL-S09 | They open a node's record page | CMD01 | LA-V03 | | F01 step 4 |
| UC04-FL-S01 | On a domain the graph shows its stages and kind groups as folders, each with its name, count and marks, in its own column | QRY08 | LA-V04 | UC04-R01, UC04-R02, UC04-R04, UC04-R05, UC04-R08 | F01 step 2 |
| UC04-FL-S02 | They click a group, which becomes the focus at its own address | CMD01 | LA-V04 | UC04-R03 | F01 step 2 |
| UC04-FL-S03 | Under an aggregate its events sit in a Domain events group, as spark flags | | LA-V04 | UC04-R07 | **New** |
| UC04-FL-S04 | Under a pattern sit its rules, and follows is drawn as a cross-link | | LA-V04 | UC04-R09 | **New** |
| UC04-FL-S05 | The graph sits in a pane beside the wiki and reports each move to the page | | LA-V07 | UC04-R06 | **New** |
| UC05-FL-S01 | The reader opens quick find, types part of an ID or title and opens the record | QRY02 | LA-V01 | UC05-R10 | F02 step 1 |
| UC05-FL-S02 | The record, group, product or domain opens at its one address, in the views the link names | CMD01 | LA-V07 | UC05-R01, UC05-R05, UC05-R06 | F02 step 1 |
| UC05-FL-S03 | They open and close the Wiki, Graph and Model panes, resize them and show one alone; a title above a canvas keeps its height | CMD01 | LA-V07 | UC05-R02, UC05-R03, UC05-R13 | F02 step 2 |
| UC05-FL-S04 | Following a link in any pane moves them all, and Back and Forward move both | CMD01 | LA-V07 | UC05-R04 | F02 step 2 |
| UC05-FL-S05 | The wiki shows one level deep, grouped requirements under headings, and long lists ten rows at a time | QRY01 | LA-V03 | UC05-R07, UC05-R12, UC05-R14 | **New** |
| UC05-FL-S06 | They fold the nav's sections, collapse it to a rail, or open it as a sheet on a narrow screen | CMD03 | LA-V01 | UC05-R08, UC05-R09 | **New** |
| UC05-FL-S07 | They fold the side bar away from the page bar | CMD08 | LA-V06 | UC05-R11 | F02 step 2 ("the side bar shows the record's facts") |
| UC06-FL-S01 | The reader opens a flow's page and reads its steps in order, a table per path | QRY01 | LA-V03 | UC06-R01, UC06-R06 | F03-S01 |
| UC06-FL-S02 | They unfold a step to read more; a step with problems shows its badge | | LA-V03 | UC06-R02, UC06-R03 | F03-S02 |
| UC06-FL-S03 | In the Graph view the steps sit under the flow | QRY08 | LA-V04 | UC06-R04 | F03-S03 |
| UC06-FL-S04 | Tracing a requirement, the reader sees the step that fulfills it, its flow and what it invokes | QRY09 | LA-V04 | UC06-R05 | F03-S04 |
| UC07-FL-S01 | The reader sees each product as a space in the rail, the current one marked | QRY12 | LA-V01 | UC07-R01, UC07-R02 | F04-S01 |
| UC07-FL-S02 | They choose a space: it opens on its last page, and the nav and every view follow it | CMD01 | LA-V01 | UC07-R03, UC07-R04, UC07-R09 | F04-S02, F04-S03 |
| UC07-FL-S03 | They press Alt and a number, or pick Switch to in the palette, to switch back | CMD01 | LA-V01 | UC07-R05 | F04-S03 |
| UC07-FL-S04 | They find a record in their space | QRY02 | LA-V01 | UC07-R06 | F04-S04 |
| UC07-FL-S05 | They open the space's Checks | QRY03 | LA-CHK-V01 (to resolve) | UC07-R07 | F04-S05 |
| UC07-FL-S06 | On a phone the rail stays in the nav sheet | | LA-V01 | UC07-R08 | F04-S06 |
| UC07-FL-S07 | From the products page they choose a space | QRY12 | LA-V08 | UC07-R10 | **New** |
| UC08-FL-S01 | Under the current space the nav lists the product page, Shared and each domain, which unfolds into its five stages with counts | QRY05 | LA-V01 | UC08-R01, UC08-R02 | **New** |
| UC08-FL-S02 | Opening a page opens the nav rows that hold it | CMD03 | LA-V01 | UC08-R03 | **New** |
| UC08-FL-S03 | Use cases lists the capabilities in order, then the use cases outside any | | LA-V01 | UC08-R04 | **New** |
| UC08-FL-S04 | The domain page heads its records with the same stages | QRY06 | LA-V02 | UC08-R05 | **New** |
| UC09-FL-S01 | The domain page lists Technical specification by technical kind | QRY06 | LA-V02 | UC09-R01, UC09-R04 | **New** |
| UC09-FL-S02 | It lists Test plan by test kind | | LA-V02 | UC09-R02 | **New** |
| UC09-FL-S03 | In the nav the kind groups fold with their counts, and the current page's branch opens | QRY05 | LA-V01 | UC09-R03, UC09-R08 | **New** |
| UC09-FL-S04 | In the graph they reach the same records through the same groups, and the trail names each visit | QRY08 | LA-V04 | UC09-R06, UC09-R07 | **New** |
| UC10-FL-S01 | A plain open shows the page in the preview tab, or activates the tab it is open in | CMD01 | LA-V07 | UC10-R01, UC10-R07 | F02 step 4 |
| UC10-FL-S02 | The reader keeps the tab by a double-click, Ctrl+K then Enter, or a change to its views | CMD05 | LA-V07 | UC10-R02 | F02 step 4 |
| UC10-FL-S03 | They flip between tabs with Ctrl+Tab, or the desktop menu | CMD07 | LA-V07 | UC10-R04, UC10-R08 | F02 step 4 |
| UC10-FL-S04 | Each tab keeps its own views, pane sizes, scroll and graph settings | CMD08 | LA-V07 | UC10-R05 | F02 step 4 |
| UC10-FL-S05 | They close a tab by its button, a middle-click or Alt+Shift+W | CMD06 | LA-V07 | UC10-R03 | F02 step 4 |
| UC10-FL-S06 | A reload brings back each space's tabs as they were | | LA-V07 | UC10-R06 | **New** |
| UC11-FL-S01 | On a domain, aggregate or entity page the reader opens the Model view | CMD01 | LA-V07 | UC11-R01 | F02 step 3 |
| UC11-FL-S02 | A domain's ERD shows its aggregates, the reference lines between them and which hear which aggregates' events | QRY10 | LA-V05 | UC11-R02, UC11-R08 | F02 step 3 |
| UC11-FL-S03 | They click an aggregate's box: its entities with their fields, its events and the faded ring around it | CMD01 | LA-V05 | UC11-R03, UC11-R05, UC11-R06, UC11-R07 | F02 step 3 |
| UC11-FL-S04 | On an entity the same ERD picks it out | QRY10 | LA-V05 | UC11-R04 | **New** |
| UC11-FL-S05 | They read the key under the diagram | | LA-V05 | UC11-R09 | **New** |
| UC12-FL-S01 | In the Graph view the side bar is open on Details, and follows the pointer over the boxes | QRY01 | LA-V06 | UC12-R01, UC12-R02, UC12-R03 | F05; fulfills F05→UC12-R01…R03 |
| UC12-FL-S02 | In the Wiki view they open the side bar, switch to Outline and jump to a section; nothing outside the side bar moves | CMD08 | LA-V06 | UC12-R04, UC12-R06 | F05→UC12-R04, R06 |
| UC12-FL-S03 | They switch to History: the uncommitted change first, an older commit's diff, Load more | QRY11 | LA-V06 | UC12-R05 | F05→UC12-R05 |
| UC13-FL-S01 | The reader opens a domain's Interaction design and sees its endpoints, and the integrations in Shared | QRY06 | LA-V02 | UC13-R03 | F06 step 1 |
| UC13-FL-S02 | They open a command and read its endpoint, method, route and API requirements | QRY01 | LA-V03 | UC13-R01 | F06 step 2 |
| UC13-FL-S03 | They open an integration and read the steps that exchange with its system | QRY01 | LA-V03 | UC13-R02 | F06 step 3 |
| UC14-FL-S01 | The Owner chooses Edit; the form opens in place, shaped by the schema, from the keyboard too | QRY04 | LA-V03 | UC14-R01, UC14-R02, UC14-R06 | F07 step 1 |
| UC14-FL-S02 | They change a field and a link and Save: one write | LA-PLT write command (to resolve) | LA-V03 | UC14-R01 | F07 step 2 |
| UC14-FL-S03 | *refused*: the store refuses it; the reasons show beside the inputs, and they fix it and save again | | LA-V03 | UC14-R05 | F07 step 3 |
| UC14-FL-S04 | From a parent's page they Add a child, its ID suggested | QRY04 | LA-V03 | UC14-R03 | F07 step 4 |
| UC14-FL-S05 | They Remove a record after reading what still references it | LA-PLT write command (to resolve) | LA-V03 | UC14-R04 | F07 step 4 |

UC12-FL-S03 also exchanges with LA-INT01 Git. Every UC requirement but the three dropped is fulfilled by at least one step of its own use case's flow.

### Views and view requirements

Views have no owner now. Exploring's six old and new views (provisional numbers):

| ID | Title | Route | Source |
| --- | --- | --- | --- |
| LA-V01 | Nav | | EXP-V01 "Specs menu", description as today plus quick find and the folders |
| LA-V02 | Domain page | `/<domain-id>` | EXP-V02 |
| LA-V03 | Record page | `/<id>` | EXP-V03 |
| LA-V04 | Graph view | `/<id>?view=graph` | EXP-V04, its description's "children grouped by kind" kept |
| LA-V05 | Model view | `/<domain-aggregate-or-entity-id>?view=model` | EXP-V05 |
| LA-V06 | Side bar | | **New**: UC12's Details, Outline and History, which no view held |
| LA-V07 | Focus page | `/<id>` | **New**: the page bar with its tabs and view toggles, and the panes side by side (UC05, UC10), which no view held |
| LA-V08 | Products page | `/` | **New**: the space chooser (UC07-R10), which no view held |

The interaction requirements under EXP-V03 and EXP-F03, and the domain rules that say how a view looks or behaves, become view requirements:

| ID | Title | Statement | Source |
| --- | --- | --- | --- |
| LA-V01-R01 | The graph is a view of a page, not a place in the nav | DR11's statement | DR11 |
| LA-V01-R02 | A group that is a record links; a group the app computes only folds | A group that is a record (a capability, a use case, an aggregate) MUST link to its page wherever it heads its members; a stage or kind group MUST NOT pose as a record: its nav row only folds and its heading is not a link. | DR23, rewritten: layers and test groups go |
| LA-V01-R03 | A selected row is the whole row | DR41's statement | DR41 |
| LA-V02-R01 | A domain has one page, at its ID | DR44's statement for a domain: its overview is its only page, losing nothing a generic record page showed. | DR44 (its product half goes to LA-TRC-V01, to resolve) |
| LA-V03-R01 … R07 | as EXP-V03-R01 … R07 | statements as today; R07's example "`satisfies` or `proves`" becomes "`fulfills` or `hears`" | EXP-V03-R01 … R07 |
| LA-V03-R08 | A page changes data only through its record actions | DR03's statement, with "the store's command layer" naming LA-PLT's write command | DR03 |
| LA-V03-R09 | A list of one kind is titled by that kind, through plural() | DR36's statement, with DR29's (a group label reads as plain English and names kinds through `plural()`); examples "Domain rules", "Components outside any layer" become "Invariants", "Command handlers" | DR36, DR29 |
| LA-V03-R10 | A refused change shows its reasons in place and changes nothing | DR67's statement | DR67 |
| LA-V03-R11 | Steps are shown in their positions, as numbers | EXP-F03-R01's statement | F03-R01 |
| LA-V03-R12 | A step is always shown under its flow | EXP-F03-R02's statement | F03-R02 |
| LA-V04-R01 | Motion carries no meaning and stops under reduced motion | DR31's statement | DR31 |
| LA-V04-R02 | By touch, a tap selects a node and a second tap opens it | DR42's statement (the Model view's boxes too) | DR42 |
| LA-V04-R03 | A canvas stays mounted and is fitted before it paints | DR43's statement (the Model view too) | DR43 |
| LA-V04-R04 | Domain events are drawn in the spark colors | DR52's statement, its "`raised_by` and `reacts_to` lines" becoming "`raises` and `hears` lines, the `hears` lines dashed" | DR52 |
| LA-V04-R05 | A domain is drawn as a hexagon | DR61's statement | DR61 |
| LA-V04-R06 | Each kind is drawn in a shape of its own | DR65's statement with its table rewritten for the fifty kinds (judgment call 14) | DR65 |
| LA-V04-R07 | The map is drawn on a canvas, anew each frame | DR59's second paragraph (doubles, the keyboard's hidden layer, hit testing from the map's outlines) | DR59 |
| LA-V04-R08 | Links are dashed curves that never move anything | DR49's drawing: the links between the focus and what SP05 adds, dashed curves in `--link-edge`, each record at its own place in the map, an off-screen one counted by its edge hint; with Links off, no cross-links | DR49 (its second to last sentences) |
| LA-V04-R09 | A step that fulfills a requirement is traced with its flow | EXP-F03-R03's statement | F03-R03 |
| LA-V05-R01 | A box from another domain is gray and names its owner | DR38's statement | DR38 |
| LA-V06-R01 | The side bar never repeats what the page shows | DR55's statement | DR55 |

DR65's new table keeps every shape of a kept kind and gives the new kinds theirs: value object a pill; constraint, invariant, specification and policy an octagon, with a mark each; command a box with an arrow notch; read model a box with rows; query a box with a lens mark; domain service a box with a gear mark; term a tag; view requirement and API requirement a page with a folded corner and a marker; technical kinds a box with component tabs (a table a grid); every test kind a shield. Layer, component, API, technical flow and technical step go.

### Endpoints and API requirements

| ID | Title | Parent | Method and route | Source |
| --- | --- | --- | --- | --- |
| EP01 | Get a record's history | QRY11 | GET `/api/history` | E01; its description takes API01's: it answers JSON (the History and Change shapes, and `{ "error": "<sentence>" }`), and any method but GET with 405 |

| ID | Title | Statement | Source |
| --- | --- | --- | --- |
| EP01-R01 | GET /api/history reads git safely for the record's own rows | E01-R01's statement | E01-R01 |
| EP01-R02 | Reading a record's history changes nothing | DR56's statement | DR56 |

### Integrations

| ID | Title | System | Description | Source |
| --- | --- | --- | --- | --- |
| LA-INT01 | Git | git | The product folder's git repository, read for a record's history and never written. | **New**: DR56, E01-R01 (to resolve: another sheet may declare git for the merge driver) |

## Technical specification

Each record names one file. Several handlers share a file where the code keeps them together, as the plan allows. Old components that name one file of the UI fold into one UI component.

| ID | Kind | Implements | File | What in the file | Source |
| --- | --- | --- | --- | --- | --- |
| A1-REPO | Repository | A1 | app/src/router.tsx | the browser's history: `navigate`, `useLocation`, `entryState`, `noteInEntry` | **New** (no old component named it) |
| A2-REPO | Repository | A2 | app/src/shell/spaces.tsx | `lathe:space`, `lathe:space-pages` in session storage | C27 |
| A3-REPO | Repository | A3 | app/src/shell/Nav.tsx | `lathe:nav-folders`, `lathe:nav-sections` in session storage | C33 |
| A5-REPO | Repository | A5 | app/src/views/useTabs.ts | `lathe:tabs` in session storage, `parseTabSet` | C44 |
| EN01-DM | Data model | EN01 | app/src/specs/data.ts | `SpecRoute`, `parseSpecRoute` | C54 |
| EN02-DM | Data model | EN02 | app/src/shell/spaces.tsx | `SpacesApi` | C27 |
| EN03-DM | Data model | EN03 | app/src/shell/Nav.tsx | the folded rows' set | C33 |
| EN09-DM | Data model | EN09 | app/src/views/tabs.ts | `TabSet` | C43 |
| EN10-DM | Data model | EN10 | app/src/views/tabs.ts | `Tab`, with `TabView` in useTabs.ts | C43 |
| LA-VO01-VT | Value type | LA-VO01 | app/src/views/address.ts | `addressOf`, `isFocusPath`, `RECORD_ID`, `APP_PAGES`, `checksPathOf` | C06, C12, C13 |
| LA-VO02-VT | Value type | LA-VO02 | app/src/views/address.ts | `ViewName`, `VIEW_NAMES`, `parseViews`, `withView` | C13 |
| LA-VO03-VT | Value type | LA-VO03 | app/src/views/useTabs.ts | `GraphSettings`, `DEFAULT_SETTINGS`, `settingsFrom` | C44 |
| SP01-PR | Predicate | SP01 | app/src/specs/data.ts | `spaceIndex`'s selection, `isWorkspaceProblem` | C65 |
| SP02-PR | Predicate | SP02 | app/src/views/address.ts | `viewsOffered`, `MODEL_KINDS` | C13 |
| SP03-PR | Predicate | SP03 | app/src/graph/tree.ts | `splitsByKind` | C10, C41 |
| SP04-PR | Predicate | SP04 | app/src/graph/model.ts | `filterKind`, `isFiltered` | C03 |
| SP05-PR | Predicate | SP05 | app/src/graph/model.ts | the Links hop of `neighborhood` | C03 |
| EV01-ET | Event type | EV01 | app/src/router.tsx | the `lathe:navigate` event and `popstate`; delivery in process | reacts_to C27, C44→EV01 |
| RM01-PJ | Projection | RM01 | app/src/specs/data.ts | `indexWorkspace`, `spaceIndex` | C65 |
| RM02-PJ | Projection | RM02 | app/src/specs/folders.ts | `domainFolders`, `productFolders` | C32, C36 |
| RM03-PJ | Projection | RM03 | app/src/graph/map.ts | `graphMap`, `mapRootOf`, kept per index and root | C64 |
| CMD01-H | Command handler | CMD01 | app/src/router.tsx | `navigate` | **New** |
| CMD02-H | Command handler | CMD02 | app/src/shell/spaces.tsx | `useSpaceState` | C27 |
| CMD03-H | Command handler | CMD03 | app/src/shell/Nav.tsx | the folders' fold toggles | C33, C37 |
| CMD04-H … CMD08-H | Command handler (5) | CMD04 … CMD08 | app/src/views/useTabs.ts | `usePageTabs`, through `openTab`, `keepTab`, `closeTab`, `activateTab`, `cycleTab`, `updateTab` | C44 |
| QRY01-H | Query handler | QRY01 | app/src/specs/RecordContent.tsx | `RecordContent` | C08 |
| QRY02-H | Query handler | QRY02 | app/src/shell/QuickFind.tsx | `findItems`, `rankItems` | C17, C29 |
| QRY03-H | Query handler | QRY03 | app/src/specs/SpecPages.tsx | the Checks page | C31 |
| QRY04-H | Query handler | QRY04 | app/src/edit/Editing.tsx | `Editable` opening a form | C86 |
| QRY05-H | Query handler | QRY05 | app/src/shell/Nav.tsx | the space's folders | C16, C33 |
| QRY06-H | Query handler | QRY06 | app/src/specs/SpecPages.tsx | `DomainWiki` | C07, C34 |
| QRY07-H | Query handler | QRY07 | app/src/views/FocusPage.tsx | a group's page | C35 |
| QRY08-H | Query handler | QRY08 | app/src/graph/model.ts | `neighborhood`, `treeColumns`, the group functions | C03, C10, C23, C26, C39 |
| QRY09-H | Query handler | QRY09 | app/src/graph/model.ts | `traceChain` | C03, C26 |
| QRY10-H | Query handler | QRY10 | app/src/model/erd.ts | `erdFor` | C46 |
| QRY11-H | Query handler | QRY11 | lathe/src/server/history.ts | `recordTables`, `parseLog`, `changesInDiff` | LA-PLT-C37 (to resolve) |
| QRY12-H | Query handler | QRY12 | app/src/specs/SpecPages.tsx | the products page and the rail's list | C28, C31 |
| PO01-H | Event handler | PO01 | app/src/shell/spaces.tsx | `useSpaceState`'s last page on each address | C27; reacts_to C27→EV01 |
| PO02-H | Event handler | PO02 | app/src/views/useTabs.ts | `arrive` on each address | C44; reacts_to C44→EV01 |
| PO03-H | Event handler | PO03 | app/src/views/useTabs.ts | the address moved after an activate or close | C44 |
| DS01-SV | Service | DS01 | app/src/shell/spaces.tsx | `spaceOf`, `iconField`, `colorField`, `colorOf`, `monogramOf` | C27 |
| DS02-SV | Service | DS02 | app/src/shell/spaces.tsx | `productOfPath` | C27 |
| DS03-SV | Service | DS03 | app/src/specs/folders.ts | `folderPath`, `branchOf`, `domainRecords` | C32, C36 |
| DS04-SV | Service | DS04 | app/src/graph/tree.ts | `treeOf` | C55 |
| DS05-SV | Service | DS05 | app/src/graph/map.ts | `layoutTree`, `parentLine` | C64 |
| DS06-SV | Service | DS06 | app/src/graph/text.ts | `labelLines`, `titleWidth`, `metaWidth` | C66 |
| DS07-SV | Service | DS07 | app/src/graph/nested.ts | `nestedMap`, `layoutNested` | C67 |
| DS08-SV | Service | DS08 | app/src/graph/voronoi.ts | `voronoiTree`, `layoutVoronoi`; run in `voronoi.worker.ts` where there is a worker | C68, C69 |
| DS09-SV | Service | DS09 | app/src/graph/camera.ts | `frameOnMap`, `frameNested`, `fitBoxes`, `zoomPath`, `glideDuration` | C49 |
| DS10-SV | Service | DS10 | app/src/graph/camera.ts | `drawnFor`, `drawnNested`, `MIN_DRAWN`, `MAX_DRAWN` | C49 |
| DS11-SV | Service | DS11 | app/src/model/erd.ts | `domainErd`, `aggregateErd`, with the lookups of `model/events.ts` | C46, C57 |
| DS12-SV | Service | DS12 | app/src/edit/form.ts | `formFields`, `partForms`, `parentChoices`, `linkTargets`, `suggestId`, `commandsFor`, `referrersOf` | C87 |
| EP01-H | Endpoint handler | EP01 | lathe/src/server/api.ts | the `/api/history` route of `handleApi` | LA-PLT-C37; implements LA-PLT-C37→E01 (to resolve) |
| LA-INT01-AD | Adapter | LA-INT01 | lathe/src/server/history.ts | `runGit` | LA-PLT-C37 (to resolve) |
| EP01-CL | API client (product kind) | EP01 | app/src/views/history.ts | the app's call to `GET /api/history` | **New** (judgment call 16) |

RM04, RM05 and RM06 have no projection: each is worked out on its request. No repository has a table, and no event handler is an outbox (judgment calls 9 and 15).

The app's call to Platform's write endpoint, `app/src/edit/write.ts` (C88), is an API client of LA-PLT-E02's new endpoint: its ID starts with that endpoint's, so the apply step places it (to resolve).

### UI components

Product-scoped, provisional numbers. Each renders the views named.

| ID | Title | File | Renders | Source |
| --- | --- | --- | --- | --- |
| LA-UI01 | Spec pages | app/src/specs/SpecPages.tsx | LA-V02, LA-V03, LA-V08, LA-CHK-V01, LA-TRC-V01 (to resolve) | C01, C07, C31, C34; implements C01→CHK-V01, EXP-V02, V03, TRC-V01 |
| LA-UI02 | Markdown | app/src/specs/Markdown.tsx | LA-V02, LA-V03 | C02, C21 |
| LA-UI03 | Graph page | app/src/graph/GraphPage.tsx | LA-V04 | C05, C11, C40, C52, C59; implements C39, C40→V04 |
| LA-UI04 | Record content | app/src/specs/RecordContent.tsx | LA-V03 | C08; implements C08→V03 |
| LA-UI05 | Long list | app/src/components/LongList.tsx | LA-V03, LA-V06 | C09 |
| LA-UI06 | Focus page | app/src/views/FocusPage.tsx | LA-V07 | C14, C35; implements C14→V03, V04 |
| LA-UI07 | Side bar | app/src/views/SideBar.tsx | LA-V06 | C15 |
| LA-UI08 | Nav | app/src/shell/Nav.tsx | LA-V01 | C16, C24, C28, C33, C37; implements C16, C28, C33, C37→V01 |
| LA-UI09 | Quick find | app/src/shell/QuickFind.tsx | LA-V01 | C17, C29 |
| LA-UI10 | Tree list | app/src/components/TreeList.tsx | LA-V02, LA-V03 | C18 |
| LA-UI11 | Record rows and trees | app/src/specs/parts.tsx | LA-V02, LA-V03, LA-V06 | C19, C41, C50; implements C41→V03 |
| LA-UI12 | Graph details | app/src/graph/panel.tsx | LA-V06 | C20 |
| LA-UI13 | Mentions | app/src/specs/mentions.tsx | LA-V03 | C22 |
| LA-UI14 | Flow steps | app/src/specs/FlowSteps.tsx | LA-V03 | C25; implements C25→V03 |
| LA-UI15 | Folder groups | app/src/specs/FolderGroups.tsx | LA-V02 | C38; implements C38→V02 |
| LA-UI16 | Graph motion | app/src/graph/motion.ts | LA-V04, LA-V05 | C42 |
| LA-UI17 | Tab strip | app/src/views/TabStrip.tsx | LA-V07 | C45 |
| LA-UI18 | ERD layout | app/src/model/layout.ts | LA-V05 | C47; C60 `app/src/elk.ts`, which runs ELK in a worker for it, folds in |
| LA-UI19 | Model view | app/src/model/ModelView.tsx | LA-V05 | C48, C53; implements C48→V05 |
| LA-UI20 | Tap to open | app/src/graph/touch.tsx | LA-V04, LA-V05 | C51 |
| LA-UI21 | Edge hints | app/src/graph/hints.tsx | LA-V04 | C56 |
| LA-UI22 | Domain events section | app/src/specs/DomainEvents.tsx | LA-V03 | C58 |
| LA-UI23 | Side bar Details | app/src/views/SideBarDetails.tsx | LA-V06 | C61 |
| LA-UI24 | Side bar Outline | app/src/views/SideBarOutline.tsx | LA-V06 | C62 |
| LA-UI25 | Side bar History | app/src/views/SideBarHistory.tsx | LA-V06 | C63 |
| LA-UI26 | Endpoint and integration sections | app/src/specs/ApiParts.tsx | LA-V03 | C70, rewritten: an API's sections go, a command's or query's endpoint section comes; implements C70→V03 |
| LA-UI27 | Requirement groups | app/src/specs/groups.ts | LA-V03 | C71 |
| LA-UI28 | Graph shapes | app/src/graph/shapes.ts | LA-V04, LA-V05 | C72 |
| LA-UI29 | Graph painter | app/src/graph/paint.ts | LA-V04 | C80 |
| LA-UI30 | Box plates | app/src/graph/plate.ts | LA-V04 | C81 |
| LA-UI31 | Graph text faces | app/src/graph/fonts.ts | LA-V04 | C82 |
| LA-UI32 | Graph look | app/src/graph/look.ts | LA-V04 | C83 |
| LA-UI33 | Hit testing | app/src/graph/hit.ts | LA-V04 | C84 |
| LA-UI34 | Model edge hints | app/src/model/hints.tsx | LA-V05 | C85 |
| LA-UI35 | Record actions and form | app/src/edit/Editing.tsx | LA-V03 | C86; implements C86→V03 |
| LA-UI36 | Trace layout | app/src/graph/layout.ts | LA-V04 | C04 |
| LA-UI37 | Space commands | app/src/App.tsx | LA-V01 | C30 (to resolve: the `switchSpace1`…`9` keymap commands may belong to Platform's keymap) |

## Test plan

Every test names one parent and a run by. Levels: the app's Vitest tests (`app/test/`, jsdom) are **unit**; the Playwright suites (`app/stability/`, `app/a11y/`) are **e2e-ui**; `lathe/test/history.test.ts` calls `handleApi` in process, **api**, except T160, which runs git itself, **database**. All are automated unless written. An old test that proved several records splits into one `it` per new record, each named by its record's ID; where the behavior it checks is rewritten (stages, test kinds, reference fields, policies, shapes), the app step rewrites the test with the code. Constraint, invariant, specification and policy tests are one per parent, so where several old tests proved one rule, the one closest to it keeps the proof (table "Not carried over").

IDs are written short as above: invariant, specification, policy, domain service, use case, endpoint and flow tests start `LA-EXP-`; constraint, view, integration and pattern rule tests are written in full.

### Constraint tests

| ID | Run by | Source |
| --- | --- | --- |
| LA-VO01-C01-T | unit, app/test/views.test.tsx | T38 (its DR08 part) |
| LA-VO01-C02-T | unit, app/test/views.test.tsx | T38, its views-in-the-query part |
| LA-VO02-C01-T | unit, app/test/views.test.tsx | T39, its at-least-one-view part |
| LA-VO03-C01-T | unit, not automated yet | **New**: a saved tab whose depth is outside 1 to 3, or whose layout is unknown, is read back with its settings dropped |

### Invariant tests

| ID | Run by | Source |
| --- | --- | --- |
| INV01-T | unit, app/test/routing.test.tsx | T01 (its DR01 part) |
| INV02-T | unit, app/test/views.test.tsx | T40 (its DR09 part) |
| INV03-T | unit, app/test/views.test.tsx | T39 (its DR10 part) |
| INV04-T | unit, app/test/spaces.test.tsx | T73 (its DR15 part) |
| INV05-T | unit, app/test/nav-folders.test.tsx | T91 (its DR22 part) |
| INV06-T | unit, app/test/tabs.test.ts | T112 (its DR32 part) |
| INV07-T | unit, app/test/tabs.test.ts | T113 (its DR33 part) |
| INV08-T | unit, app/test/tabs.test.ts | T114 (its DR34 part) |

### Specification tests

| ID | Run by | Source |
| --- | --- | --- |
| SP01-T | unit, app/test/separate-spaces.test.tsx | T178 (its DR16 part) |
| SP02-T | unit, app/test/model.test.tsx | T121 (its DR10 part) |
| SP03-T | unit, app/test/layers-and-test-groups.test.tsx | T104 (its DR27 part) |
| SP04-T | unit, app/test/graph/model.test.ts | T15 (its DR05 part) |
| SP05-T | unit, app/test/graph/model.test.ts | T14 (its DR49 part) |

### Policy tests

| ID | Run by | Source |
| --- | --- | --- |
| PO01-T | unit, app/test/spaces.test.tsx | T73, its last-page-remembered part |
| PO02-T | unit, app/test/record-tabs.test.tsx | T115 (its DR35 part) |
| PO03-T | unit, app/test/record-tabs.test.tsx | T116 (its DR35 part) |

### Domain service tests

| ID | Run by | Source |
| --- | --- | --- |
| DS01-T01 | unit, app/test/spaces.test.tsx | T70 (its DR13, DR14 part) |
| DS01-T02 | unit, app/test/spaces.test.tsx | T74 (its DR14 part) |
| DS02-T01 | unit, app/test/spaces.test.tsx | T71 (its DR12 part) |
| DS03-T01 | unit, app/test/nav-folders.test.tsx | T86 (its DR21 part) |
| DS03-T02 | unit, app/test/nav-folders.test.tsx | T87 (its DR18, DR19 part) |
| DS03-T03 | unit, app/test/nav-folders.test.tsx | T89 (its DR21 part) |
| DS03-T04 | unit, app/test/nav-folders.test.tsx | T90 (its DR20 part) |
| DS03-T05 | unit, app/test/nav-folders.test.tsx | T91 (its DR18 part) |
| DS03-T06 | unit, app/test/layers-and-test-groups.test.tsx | T94 (its DR26 part) |
| DS03-T07 | unit, app/test/layers-and-test-groups.test.tsx | T95 (its DR24, DR25, DR28 part) |
| DS03-T08 | unit, app/test/layers-and-test-groups.test.tsx | T105 (its DR24 part) |
| DS04-T01 | unit, app/test/graph/groups.test.ts | T27 (its DR06 part) |
| DS04-T02 | unit, app/test/graph/groups.test.ts | T29 (its DR06 part) |
| DS04-T03 | unit, app/test/graph/context.test.tsx | T143 (its DR45 part) |
| DS05-T01 | unit, app/test/graph/model.test.ts | T16 (its DR04, DR57 part) |
| DS05-T02 | unit, app/test/graph/GraphPage.test.tsx | T26 (its DR57 part) |
| DS05-T03 | unit, app/test/graph/groups.test.ts | T28 (its DR57 part) |
| DS05-T04 | unit, app/test/graph/groups.test.ts | T32 (its DR04 part) |
| DS05-T05 | unit, app/test/graph/columns.test.ts | T78 (its DR17 part) |
| DS05-T06 | unit, app/test/graph/columns.test.ts | T79 (its DR17 part) |
| DS05-T07 | unit, app/test/graph/columns.test.ts | T80 (its DR17 part) |
| DS05-T08 | unit, app/test/graph/columns.test.ts | T81 (its DR17 part) |
| DS05-T09 | unit, app/test/graph/columns.test.ts | T82 (its DR04, DR17 part) |
| DS05-T10 | unit, app/test/graph/camera.test.tsx | T130 (its DR57 part) |
| DS05-T11 | unit, app/test/graph/map.test.ts | T165 (its DR57 part) |
| DS05-T12 | unit, app/test/graph/map.test.ts | T167 (its DR57 part) |
| DS05-T13 | e2e-ui, app/stability/graph.spec.ts | T173 (its DR57 part) |
| DS05-T14 | unit, app/test/separate-spaces.test.tsx | T179 (its DR57 part) |
| DS06-T01 | unit, app/test/graph/model.test.ts | T24 (its DR58 part) |
| DS06-T02 | unit, app/test/graph/map.test.ts | T166 (its DR58 part) |
| DS06-T03 | unit, app/test/graph/GraphPage.test.tsx | T168 (its DR58 part) |
| DS06-T04 | unit, app/test/graph/map.test.ts | T176 (its DR58 part) |
| DS06-T05 | e2e-ui, app/stability/graph.spec.ts | T177 (its DR58 part) |
| DS06-T06 | unit, app/test/graph/map.test.ts | T182 (its DR58 part) |
| DS06-T07 | e2e-ui, app/stability/graph.spec.ts | T183 (its DR58 part) |
| DS06-T08 | e2e-ui, app/stability/graph.spec.ts | T184 (its DR58 part) |
| DS06-T09 | unit, app/test/graph/nested.test.ts | T187 (its DR58 part) |
| DS06-T10 | unit, app/test/graph/map.test.ts | T190 (its DR58 part) |
| DS06-T11 | unit, app/test/graph/voronoi.test.ts | T192 (its DR58 part) |
| DS06-T12 | unit, app/test/graph/readable.test.ts | T204 (its DR58 part) |
| DS06-T13 | unit, app/test/graph/canvas.test.tsx | T210 (its DR58 part) |
| DS07-T01 | unit, app/test/graph/nested.test.ts | T185 (its DR62 part) |
| DS07-T02 | unit, app/test/graph/nested.test.ts | T186 (its DR62 part) |
| DS07-T03 | unit, app/test/graph/nested.test.ts | T187 (its DR62 part) |
| DS08-T01 | unit, app/test/graph/voronoi.test.ts | T191 (its DR64 part) |
| DS08-T02 | unit, app/test/graph/voronoi.test.ts | T192 (its DR64 part) |
| DS09-T01 | unit, app/test/graph/model.test.ts | T13 (its DR46 part) |
| DS09-T02 | unit, app/test/graph/motion.test.tsx | T108 (its DR59 part) |
| DS09-T03 | unit, app/test/graph/camera.test.tsx | T129 (its DR59 part) |
| DS09-T04 | unit, app/test/graph/camera.test.tsx | T130 (its DR59 part) |
| DS09-T05 | unit, app/test/graph/camera.test.tsx | T131 (its DR59 part) |
| DS09-T06 | unit, app/test/graph/context.test.tsx | T142 (its DR46 part) |
| DS09-T07 | unit, app/test/graph/context.test.tsx | T152 (its DR48 part) |
| DS09-T08 | unit, app/test/graph/camera.test.tsx | T169 (its DR59 part) |
| DS09-T09 | unit, app/test/graph/context.test.tsx | T171 (its DR46 part) |
| DS09-T10 | e2e-ui, app/stability/graph.spec.ts | T173 (its DR59 part) |
| DS09-T11 | unit, app/test/graph/camera.test.tsx | T188 (its DR63 part) |
| DS09-T12 | unit, app/test/graph/camera.test.tsx | T193 (its DR63 part) |
| DS09-T13 | unit, app/test/graph/readable.test.ts | T204 (its DR59 part) |
| DS10-T01 | unit, app/test/graph/camera.test.tsx | T129 (its DR60 part) |
| DS10-T02 | unit, app/test/graph/map.test.ts | T170 (its DR60 part) |
| DS10-T03 | unit, app/test/graph/context.test.tsx | T171 (its DR60 part) |
| DS10-T04 | unit, app/test/graph/map.test.ts | T176 (its DR60 part) |
| DS10-T05 | e2e-ui, app/stability/graph.spec.ts | T177 (its DR60 part) |
| DS10-T06 | e2e-ui, app/stability/graph.spec.ts | T184 (its DR60 part) |
| DS10-T07 | unit, app/test/graph/canvas.test.tsx | T210 (its DR60 part) |
| DS10-T08 | unit, app/test/graph/canvas.test.tsx | T212 (its DR60 part) |
| DS11-T01 | unit, app/test/model.test.tsx | T125 (its DR37 part) |
| DS12-T01 | unit, app/test/editing.test.tsx | T213 (its DR66 part) |
| DS12-T02 | unit, app/test/record-form.test.ts | T221 (its DR66 part) |
| DS12-T03 | unit, app/test/record-form.test.ts | T222 (its DR66 part) |

### Use case tests

| ID | Run by | Source |
| --- | --- | --- |
| UC01-R01-T01 | unit, app/test/domain-page.test.tsx | T03 |
| UC01-R02-T01 | unit, app/test/domain-page.test.tsx | T04 |
| UC01-R03-T01 | unit, app/test/domain-page.test.tsx | T05 |
| UC01-R04-T01 | unit, app/test/routing.test.tsx | T02 |
| UC02-R01-T01 | unit, app/test/record-page.test.tsx | T06 |
| UC02-R02-T01 | unit, app/test/record-page.test.tsx | T07 |
| UC02-R03-T01 | unit, app/test/record-page.test.tsx | T08 |
| UC02-R04-T01 | unit, app/test/record-page.test.tsx | T09 |
| UC02-R05-T01 | unit, app/test/row-links.test.tsx | T132 |
| UC02-R06-T01 | unit, app/test/mentions.test.tsx | T53 |
| UC02-R06-T02 | unit, app/test/mentions.test.tsx | T54 |
| UC02-R06-T03 | unit, app/test/mentions.test.tsx | T55 |
| UC02-R06-T04 | unit, app/test/mentions.test.tsx | T56 |
| UC02-R06-T05 | unit, app/test/mentions.test.tsx | T57 |
| UC02-R07-T01 | unit, app/test/mentions.test.tsx | T55 |
| UC02-R07-T02 | unit, app/test/mentions.test.tsx | T56 |
| UC03-R01-T01 | unit, app/test/graph/model.test.ts | T13 |
| UC03-R01-T02 | unit, app/test/graph/model.test.ts | T14 |
| UC03-R01-T03 | unit, app/test/graph/GraphPage.test.tsx | T18 |
| UC03-R01-T04 | unit, app/test/graph/groups.test.ts | T92 |
| UC03-R01-T05 | unit, app/test/graph/GraphPage.test.tsx | T93 |
| UC03-R01-T06 | unit, app/test/graph/context.test.tsx | T142 |
| UC03-R01-T07 | unit, app/test/graph/context.test.tsx | T144 |
| UC03-R01-T08 | e2e-ui, app/stability/graph.spec.ts | T177 |
| UC03-R02-T01 | unit, app/test/graph/model.test.ts | T17 |
| UC03-R02-T02 | unit, app/test/graph/GraphPage.test.tsx | T18 |
| UC03-R03-T01 | unit, app/test/graph/GraphPage.test.tsx | T19 |
| UC03-R04-T01 | unit, app/test/graph/GraphPage.test.tsx | T20 |
| UC03-R04-T02 | unit, app/test/graph/shapes.test.tsx | T174 |
| UC03-R04-T03 | e2e-ui, app/stability/graph.spec.ts | T175 |
| UC03-R04-T04 | unit, app/test/graph/shapes.test.tsx | T201 |
| UC03-R04-T05 | e2e-ui, app/stability/graph.spec.ts | T202 |
| UC03-R05-T01 | unit, app/test/graph/model.test.ts | T15 |
| UC03-R06-T01 | unit, app/test/graph/GraphPage.test.tsx | T21 |
| UC03-R06-T02 | e2e-ui, app/stability/graph.spec.ts | T189 |
| UC03-R07-T01 | unit, app/test/graph/GraphPage.test.tsx | T22 |
| UC03-R07-T02 | unit, app/test/nav.test.tsx | T62 |
| UC03-R08-T01 | unit, app/test/graph/model.test.ts | T23 |
| UC03-R08-T02 | unit, app/test/graph/model.test.ts | T24 |
| UC03-R08-T03 | unit, app/test/graph/model.test.ts | T25 |
| UC03-R08-T04 | unit, app/test/graph/GraphPage.test.tsx | T26 |
| UC03-R08-T05 | unit, app/test/graph/columns.test.ts | T78 |
| UC03-R08-T06 | unit, app/test/graph/columns.test.ts | T79 |
| UC03-R08-T07 | unit, app/test/graph/columns.test.ts | T80 |
| UC03-R08-T08 | unit, app/test/graph/columns.test.ts | T83 |
| UC03-R09-T01 | unit, app/test/graph/camera.test.tsx | T130 |
| UC03-R09-T02 | unit, app/test/graph/camera.test.tsx | T131 |
| UC03-R09-T03 | e2e-ui, app/stability/graph.spec.ts | T173 |
| UC03-R10-T01 | unit, app/test/graph/context.test.tsx | T150 |
| UC03-R10-T02 | e2e-ui, app/stability/graph.spec.ts | T189 |
| UC03-R12-T01 | unit, app/test/graph/context.test.tsx | T172 |
| UC03-R14-T01 | unit, app/test/graph/context.test.tsx | T148 |
| UC03-R15-T01 | unit, app/test/graph/context.test.tsx | T147 |
| UC03-R16-T01 | e2e-ui, app/stability/graph.spec.ts | T189 |
| UC03-R16-T02 | unit, app/test/graph/GraphPage.test.tsx | T194 |
| UC03-R17-T01 | e2e-ui, app/stability/graph.spec.ts | T189 |
| UC03-R17-T02 | unit, app/test/graph/camera.test.tsx | T193 |
| UC04-R01-T01 | unit, app/test/graph/groups.test.ts | T27 |
| UC04-R01-T02 | unit, app/test/graph/groups.test.ts | T28 |
| UC04-R01-T03 | unit, app/test/graph/groups.test.ts | T32 |
| UC04-R01-T04 | unit, app/test/graph/GraphPage.test.tsx | T33 |
| UC04-R01-T05 | unit, app/test/graph/GraphPage.test.tsx | T36 |
| UC04-R01-T06 | unit, app/test/graph/context.test.tsx | T143 |
| UC04-R02-T01 | unit, app/test/graph/GraphPage.test.tsx | T33 |
| UC04-R03-T01 | unit, app/test/graph/groups.test.ts | T29 |
| UC04-R03-T02 | unit, app/test/graph/GraphPage.test.tsx | T35 |
| UC04-R03-T03 | unit, app/test/group-names-and-tab-settings.test.tsx | T153 |
| UC04-R04-T01 | unit, app/test/graph/groups.test.ts | T31 |
| UC04-R04-T02 | unit, app/test/graph/GraphPage.test.tsx | T36 |
| UC04-R05-T01 | unit, app/test/graph/groups.test.ts | T30 |
| UC04-R05-T02 | unit, app/test/graph/columns.test.ts | T81 |
| UC04-R06-T01 | unit, app/test/graph/GraphPage.test.tsx | T37 |
| UC04-R07-T01 | unit, app/test/domain-events.test.tsx | T157 |
| UC04-R08-T01 | unit, app/test/graph/map.test.ts | T165 |
| UC04-R08-T02 | unit, app/test/graph/GraphPage.test.tsx | T168 |
| UC04-R09-T01 | unit, app/test/graph/patterns.test.tsx | T58 |
| UC04-R09-T02 | unit, app/test/graph/patterns.test.tsx | T59 |
| UC04-R09-T03 | unit, app/test/graph/patterns.test.tsx | T60 |
| UC04-R09-T04 | unit, app/test/graph/patterns.test.tsx | T61 |
| UC05-R01-T01 | unit, app/test/views.test.tsx | T38 |
| UC05-R02-T01 | unit, app/test/views.test.tsx | T39 |
| UC05-R02-T02 | unit, app/test/views.test.tsx | T52 |
| UC05-R04-T01 | unit, app/test/views.test.tsx | T40 |
| UC05-R05-T01 | unit, app/test/views.test.tsx | T41 |
| UC05-R06-T01 | unit, app/test/views.test.tsx | T42 |
| UC05-R06-T02 | unit, app/test/addresses.test.tsx | T138 |
| UC05-R07-T01 | unit, app/test/views.test.tsx | T43 |
| UC05-R08-T01 | unit, app/test/nav.test.tsx | T44 |
| UC05-R08-T02 | unit, app/test/nav.test.tsx | T45 |
| UC05-R08-T03 | unit, app/test/nav.test.tsx | T62 |
| UC05-R09-T01 | unit, app/test/nav.test.tsx | T46 |
| UC05-R10-T01 | unit, app/test/nav.test.tsx | T47 |
| UC05-R11-T01 | unit, app/test/views.test.tsx | T48 |
| UC05-R11-T02 | unit, app/test/views.test.tsx | T49 |
| UC05-R12-T01 | unit, app/test/tree.test.tsx | T50 |
| UC05-R12-T02 | unit, app/test/tree.test.tsx | T51 |
| UC05-R13-T01 | unit, app/test/model.test.tsx | T126 |
| UC05-R14-T01 | unit, app/test/groups-and-waivers.test.tsx | T200 |
| UC06-R01-T01 | unit, app/test/flow-steps.test.tsx | T63 |
| UC06-R02-T01 | unit, app/test/flow-steps.test.tsx | T64 |
| UC06-R03-T01 | unit, app/test/flow-steps.test.tsx | T65 |
| UC06-R04-T01 | unit, app/test/graph/flow-steps.test.ts | T67 |
| UC06-R04-T02 | unit, app/test/graph/flow-steps.test.ts | T68 |
| UC06-R05-T01 | unit, app/test/graph/flow-steps.test.ts | T69 |
| UC06-R06-T01 | unit, app/test/traceability.test.tsx | T136 |
| UC07-R01-T01 | unit, app/test/spaces.test.tsx | T70 |
| UC07-R02-T01 | unit, app/test/spaces.test.tsx | T71 |
| UC07-R03-T01 | unit, app/test/spaces.test.tsx | T72 |
| UC07-R04-T01 | unit, app/test/spaces.test.tsx | T73 |
| UC07-R05-T01 | unit, app/test/spaces.test.tsx | T74 |
| UC07-R06-T01 | unit, app/test/spaces.test.tsx | T75 |
| UC07-R07-T01 | unit, app/test/spaces.test.tsx | T71 |
| UC07-R07-T02 | unit, app/test/spaces.test.tsx | T76 |
| UC07-R08-T01 | unit, app/test/spaces.test.tsx | T77 |
| UC07-R09-T01 | unit, app/test/separate-spaces.test.tsx | T178 |
| UC07-R09-T02 | unit, app/test/separate-spaces.test.tsx | T179 |
| UC07-R09-T03 | unit, app/test/separate-spaces.test.tsx | T180 |
| UC07-R10-T01 | unit, app/test/separate-spaces.test.tsx | T181 |
| UC08-R01-T01 | unit, app/test/nav-folders.test.tsx | T84 |
| UC08-R01-T02 | unit, app/test/nav-folders.test.tsx | T88 |
| UC08-R02-T01 | unit, app/test/nav-folders.test.tsx | T84 |
| UC08-R02-T02 | unit, app/test/nav-folders.test.tsx | T85 |
| UC08-R03-T01 | unit, app/test/nav-folders.test.tsx | T86 |
| UC08-R03-T02 | unit, app/test/nav-folders.test.tsx | T88 |
| UC08-R04-T01 | unit, app/test/nav-folders.test.tsx | T89 |
| UC08-R05-T01 | unit, app/test/nav-folders.test.tsx | T86 |
| UC08-R05-T02 | unit, app/test/nav-folders.test.tsx | T87 |
| UC08-R05-T03 | unit, app/test/nav-folders.test.tsx | T89 |
| UC09-R01-T01 | unit, app/test/layers-and-test-groups.test.tsx | T94 |
| UC09-R02-T01 | unit, app/test/layers-and-test-groups.test.tsx | T95 |
| UC09-R03-T01 | unit, app/test/layers-and-test-groups.test.tsx | T96 |
| UC09-R03-T02 | unit, app/test/layers-and-test-groups.test.tsx | T97 |
| UC09-R03-T03 | unit, app/test/layers-and-test-groups.test.tsx | T102 |
| UC09-R04-T01 | unit, app/test/layers-and-test-groups.test.tsx | T98 |
| UC09-R04-T02 | unit, app/test/layers-and-test-groups.test.tsx | T101 |
| UC09-R04-T03 | unit, app/test/layers-and-test-groups.test.tsx | T104 |
| UC09-R06-T01 | unit, app/test/layers-and-test-groups.test.tsx | T100 |
| UC09-R06-T02 | unit, app/test/layers-and-test-groups.test.tsx | T103 |
| UC09-R06-T03 | unit, app/test/layers-and-test-groups.test.tsx | T105 |
| UC09-R07-T01 | unit, app/test/layers-and-test-groups.test.tsx | T106 |
| UC09-R08-T01 | unit, app/test/traceability.test.tsx | T137 |
| UC10-R01-T01 | unit, app/test/tabs.test.ts | T112 |
| UC10-R01-T02 | unit, app/test/record-tabs.test.tsx | T115 |
| UC10-R02-T01 | unit, app/test/record-tabs.test.tsx | T115 |
| UC10-R02-T02 | unit, app/test/record-tabs.test.tsx | T117 |
| UC10-R02-T03 | unit, app/test/record-tabs.test.tsx | T118 |
| UC10-R03-T01 | unit, app/test/tabs.test.ts | T113 |
| UC10-R03-T02 | unit, app/test/record-tabs.test.tsx | T116 |
| UC10-R04-T01 | unit, app/test/record-tabs.test.tsx | T117 |
| UC10-R05-T01 | unit, app/test/record-tabs.test.tsx | T118 |
| UC10-R05-T02 | unit, app/test/group-names-and-tab-settings.test.tsx | T154 |
| UC10-R06-T01 | unit, app/test/record-tabs.test.tsx | T119 |
| UC10-R06-T02 | unit, app/test/group-names-and-tab-settings.test.tsx | T154 |
| UC10-R07-T01 | unit, app/test/record-tabs.test.tsx | T115 |
| UC11-R01-T01 | unit, app/test/model.test.tsx | T121 |
| UC11-R02-T01 | unit, app/test/model.test.tsx | T122 |
| UC11-R03-T01 | unit, app/test/model.test.tsx | T123 |
| UC11-R04-T01 | unit, app/test/model.test.tsx | T124 |
| UC11-R06-T01 | unit, app/test/graph/context.test.tsx | T151 |
| UC11-R06-T02 | unit, app/test/graph/context.test.tsx | T152 |
| UC11-R07-T01 | unit, app/test/domain-events.test.tsx | T155 |
| UC11-R09-T01 | unit, app/test/domain-events.test.tsx | T156 |
| UC12-R02-T01 | unit, app/test/views.test.tsx | T48 |
| UC12-R02-T02 | unit, app/test/side-bar.test.tsx | T164 |
| UC12-R03-T01 | unit, app/test/side-bar.test.tsx | T161 |
| UC12-R03-T02 | unit, app/test/side-bar.test.tsx | T162 |
| UC12-R05-T01 | api, lathe/test/history.test.ts | T158 |
| UC12-R05-T02 | unit, app/test/side-bar.test.tsx | T163 |
| UC13-R01-T01 | unit, app/test/apis-and-design-flows.test.tsx | T195 |
| UC13-R02-T01 | unit, app/test/apis-and-design-flows.test.tsx | T196 |
| UC13-R03-T01 | unit, app/test/apis-and-design-flows.test.tsx | T198 |
| UC14-R01-T01 | unit, app/test/editing.test.tsx | T213 |
| UC14-R01-T02 | unit, app/test/record-form.test.ts | T225 |
| UC14-R02-T01 | unit, app/test/editing.test.tsx | T213 |
| UC14-R02-T02 | unit, app/test/record-form.test.ts | T221 |
| UC14-R02-T03 | unit, app/test/record-form.test.ts | T222 |
| UC14-R03-T01 | unit, app/test/editing.test.tsx | T214 |
| UC14-R03-T02 | e2e-ui, app/stability/edit.spec.ts | T219 |
| UC14-R03-T03 | unit, app/test/record-form.test.ts | T223 |
| UC14-R04-T01 | unit, app/test/editing.test.tsx | T215 |
| UC14-R04-T02 | e2e-ui, app/stability/edit.spec.ts | T220 |
| UC14-R04-T03 | unit, app/test/record-form.test.ts | T224 |
| UC14-R05-T01 | unit, app/test/editing.test.tsx | T216 |
| UC14-R05-T02 | e2e-ui, app/stability/edit.spec.ts | T220 |
| UC14-R06-T01 | e2e-ui, app/a11y/keyboard.spec.ts | T217 |

### View tests

| ID | Run by | Source |
| --- | --- | --- |
| LA-V01-R01-T01 | unit, app/test/nav.test.tsx | T62 (its DR11 part) |
| LA-V01-R02-T01 | unit, app/test/layers-and-test-groups.test.tsx | T96 (its DR23 part) |
| LA-V01-R02-T02 | unit, app/test/layers-and-test-groups.test.tsx | T98 (its DR23 part) |
| LA-V01-R03-T01 | unit, app/test/nav.test.tsx | T134 (its DR41 part) |
| LA-V02-R01-T01 | unit, app/test/addresses.test.tsx | T138 (its DR44 part) |
| LA-V03-R01-T01 | unit, app/test/links.test.tsx | T10 (its V03-R01 part) |
| LA-V03-R02-T01 | unit, app/test/tree.test.tsx | T50 (its V03-R02 part) |
| LA-V03-R02-T02 | unit, app/test/tree.test.tsx | T51 (its V03-R02 part) |
| LA-V03-R03-T01 | unit, app/test/tree.test.tsx | T50 (its V03-R03 part) |
| LA-V03-R04-T01 | unit, app/test/mentions.test.tsx | T57 (its V03-R04 part) |
| LA-V03-R05-T01 | unit, app/test/mentions.test.tsx | T54 (its V03-R05 part) |
| LA-V03-R07-T01 | unit, app/test/traceability.test.tsx | T135 (its V03-R07 part) |
| LA-V03-R08-T01 | unit, app/test/read-only.test.tsx | T12 (its DR03 part) |
| LA-V03-R08-T02 | unit, app/test/record-form.test.ts | T225 (its DR03 part) |
| LA-V03-R09-T01 | unit, app/test/layers-and-test-groups.test.tsx | T102 (its DR29 part) |
| LA-V03-R09-T02 | unit, app/test/list-titles.test.tsx | T120 (its DR36 part) |
| LA-V03-R10-T01 | unit, app/test/editing.test.tsx | T216 (its DR67 part) |
| LA-V03-R11-T01 | unit, app/test/flow-steps.test.tsx | T63 (its F03-R01 part) |
| LA-V03-R11-T02 | unit, app/test/flow-steps.test.tsx | T66 (its F03-R01 part) |
| LA-V03-R12-T01 | unit, app/test/graph/flow-steps.test.ts | T67 (its F03-R02 part) |
| LA-V03-R12-T02 | unit, app/test/graph/flow-steps.test.ts | T68 (its F03-R02 part) |
| LA-V04-R01-T01 | unit, app/test/graph/camera.test.tsx | T131 (its DR31 part) |
| LA-V04-R02-T01 | unit, app/test/mobile.test.tsx | T133 (its DR42 part) |
| LA-V04-R04-T01 | unit, app/test/domain-events.test.tsx | T155 (its DR52 part) |
| LA-V04-R04-T02 | unit, app/test/domain-events.test.tsx | T157 (its DR52 part) |
| LA-V04-R05-T01 | unit, app/test/graph/shapes.test.tsx | T174 (its DR61 part) |
| LA-V04-R05-T02 | e2e-ui, app/stability/graph.spec.ts | T175 (its DR61 part) |
| LA-V04-R06-T01 | unit, app/test/graph/shapes.test.tsx | T201 (its DR65 part) |
| LA-V04-R06-T02 | e2e-ui, app/stability/graph.spec.ts | T202 (its DR65 part) |
| LA-V04-R07-T01 | unit, app/test/graph/canvas.test.tsx | T211 (its DR59 part) |
| LA-V04-R07-T02 | unit, app/test/graph/canvas.test.tsx | T212 (its DR59 part) |
| LA-V04-R08-T01 | unit, app/test/graph/model.test.ts | T25 (its DR49 part) |
| LA-V04-R08-T02 | unit, app/test/graph/context.test.tsx | T144 (its DR49 part) |
| LA-V04-R08-T03 | unit, app/test/graph/context.test.tsx | T172 (its DR49 part) |
| LA-V04-R09-T01 | unit, app/test/graph/flow-steps.test.ts | T69 (its F03-R03 part) |
| LA-V05-R01-T01 | unit, app/test/model.test.tsx | T122 (its DR38 part) |
| LA-V05-R01-T02 | unit, app/test/model.test.tsx | T123 (its DR38 part) |
| LA-V06-R01-T01 | unit, app/test/side-bar.test.tsx | T162 (its DR55 part) |

### Endpoint tests

| ID | Run by | Source |
| --- | --- | --- |
| EP01-R01-T01 | api, lathe/test/history.test.ts | T158 (its E01-R01 part) |
| EP01-R01-T02 | api, lathe/test/history.test.ts | T159 (its E01-R01 part) |
| EP01-R01-T03 | database, lathe/test/history.test.ts | T160 (its E01-R01 part) |
| EP01-R02-T01 | api, lathe/test/history.test.ts | T159 (its DR56 part) |
| EP01-R02-T02 | database, lathe/test/history.test.ts | T160 (its DR56 part) |

### Flow tests

| ID | Run by | Source |
| --- | --- | --- |
| UC14-FL-T | e2e-ui, app/stability/edit.spec.ts | T218 (its UC14-R01 part) |

### Integration tests

| ID | Run by | Source |
| --- | --- | --- |
| LA-INT01-T01 | database, lathe/test/history.test.ts | T160, its git-run part |

### Pattern rule tests

| ID | Run by | Source |
| --- | --- | --- |
| LA-PAT-APP-UX-R04-T01 | unit, app/test/graph/motion.test.tsx | T108 (its LA-PAT-APP-UX-R04 part) |
| LA-PAT-APP-UX-R08-T01 | e2e-ui, app/stability/graph.spec.ts | T173 (its LA-PAT-APP-UX-R08 part) |
| LA-PAT-APP-UX-R11-T01 | unit, app/test/graph/map.test.ts | T170 (its LA-PAT-APP-UX-R11 part) |
| LA-PAT-APP-UX-R12-T01 | unit, app/test/graph/canvas.test.tsx | T210 (its LA-PAT-APP-UX-R12 part) |

### Not carried over

| Old test | Part | Why |
| --- | --- | --- |
| T27, T28 | DR07 | SP03 has one test, T104's |
| T103 | DR27 | likewise |
| T75, T180 | DR16 | SP01 has one test, T178's |
| T115 | DR32 | INV06 has one test, T112's (the unit test of the tab model) |
| T116 | DR33 | INV07 has one test, T113's |
| T118 | DR34 | INV08 has one test, T114's |
| T118 | DR35 | PO02 and PO03 have one test each, T115's and T116's |
| T175, T202 | LA-PAT-APP-UX-R08 | one pattern rule test per rule and domain, T173's |
| T99 | UC09-R05 | the requirement goes with layers |
| T197 | UC06-R07 | the requirement goes with technical flows |
| T199 | UC06-R08 | likewise |
| T07, T135 | LA-TRC-UC14-R05 | to resolve: a use case test under that requirement's new ID (the TRC sheet) |
| T133 | LA-PLT-UC08-R07 | to resolve: a use case test under it (the PLT sheet) |
| T200 | LA-AUT-UC13-R06 | to resolve: a use case test under it (the AUT sheet) |
| T76 | LA-CHK-UC07-R01 | to resolve: a use case test under it (the CHK sheet) |
| T48 | LA-PLT-DR03 | to resolve: a test under whatever the PLT sheet makes of DR03 |

T197 and T199 leave their file, `app/test/apis-and-design-flows.test.tsx`, which keeps T195, T196 and T198 rewritten for endpoints and integrations; T99 leaves `layers-and-test-groups.test.tsx`.

### Other domains' tests that prove Exploring's records

Old tests of other domains prove Exploring's obligations. Their new parents are here, so their new IDs are too; the PLT and TRC sheets account for the old records.

| Old test | Old target | New test |
| --- | --- | --- |
| LA-PLT-T103 | UC05-R01, DR10 | UC05-R01-T02; its DR10 part dropped (INV03 has one test) |
| LA-PLT-T105 | UC10-R06 | UC10-R06-T03 |
| LA-PLT-T48 | UC10-R06 | UC10-R06-T04 |
| LA-PLT-T126 | UC10-R08 | UC10-R08-T01 |
| LA-PLT-T14, T21 | UC05-R03 | UC05-R03-T01, T02 |
| LA-PLT-T45, T47 | UC05-R02 | UC05-R02-T03, T04 |
| LA-PLT-T49 | UC11-R05 | UC11-R05-T01 |
| LA-PLT-T52 | V03-R06 | LA-V03-R06-T01 |
| LA-PLT-T62 | UC05-R11 | UC05-R11-T03 |
| LA-PLT-T73, T76, T79 | DR43 | LA-V04-R03-T01, T02, T03 |
| LA-PLT-T84 | DR08 | dropped: LA-VO01-C01 has one test |
| LA-PLT-T85 | DR51, UC11-R08 | DS11-T02, UC11-R08-T01 |
| LA-PLT-T86 | DR36 | LA-V03-R09-T03 |
| LA-PLT-T87 | UC12-R01, UC12-R02 | UC12-R01-T01, UC12-R02-T03 |
| LA-PLT-T88 | UC12-R04 | UC12-R04-T01 |
| LA-PLT-T89 | UC12-R06 | UC12-R06-T01 |
| LA-TRC-T112 | DR27 | dropped: SP03 has one test |

With them, every kept UC requirement, view requirement and API requirement has at least one test, and every invariant, specification, policy, constraint and domain service its test (LA-VO03-C01's not automated yet).

### Flow tests still owed
Only UC14-FL has a flow test (T218, the stability suite's edit). The other thirteen flows have no smoke test of their main path, and show as gaps; none was written, as no old test walks them end to end.

## Counts

| Kind | Count | Kind | Count |
| --- | --- | --- | --- |
| Domain | 1 | Repository | 4 |
| Aggregate | 4 | Data model | 5 |
| Entity | 5 | Table | 0 |
| Entity field | 21 | Value type | 3 |
| Value object | 3 | Predicate | 5 |
| Value object field | 7 | Event type | 1 |
| Constraint | 4 | Projection | 3 |
| Invariant | 8 | Command handler | 8 |
| Specification | 5 | Query handler | 12 |
| Domain event | 2 | Event handler | 3 |
| Event field | 8 | Service | 12 |
| Command | 8 | Endpoint handler | 1 |
| Read model | 6 | Adapter | 1 |
| Read model field | 43 | UI component | 37 |
| Query | 12 | API client (product kind) | 1 |
| Policy | 3 | Constraint test | 4 (1 new) |
| Domain service | 12 | Invariant test | 8 |
| Term | 15 | Specification test | 5 |
| Capability | 3 | Policy test | 3 |
| Use case | 14 | Domain service test | 71 |
| UC requirement | 109 | Use case test | 185 |
| Flow | 14 | View test | 38 |
| Flow step | 69 | Endpoint test | 5 |
| View | 8 | Flow test | 1 |
| View requirement | 27 | Integration test | 1 |
| Endpoint | 1 | Pattern rule test | 4 |
| API requirement | 2 | | |
| Integration | 1 | | |

325 tests in all: 324 split from the 205 old tests, and 1 new. 324 are automated; LA-VO03-C01-T is not automated yet. Other domains' old tests add 21 more under Exploring's records (table above).

## Proposed product kind

| Name | Label | Stage | Parent | Obligation | ID pattern | Example | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `api_client` | API client | technical-specification | endpoint | no | `<endpoint>-CL` | `LA-EXP-EP01-CL` | The code in a client (the app, the desktop shell) that calls one endpoint and reads its answer. |

Fields: `file` (text, optional), `description` (text, optional). Records: EP01-CL (`app/src/views/history.ts`); the write client `app/src/edit/write.ts` under LA-PLT-E02's new endpoint (to resolve); the Platform sheet may add the app's `GET /api/spec` client in `app/src/specs/data.ts`.

No other kind is needed: the graph's layouts are domain services (judgment call 4), and the two web workers fold into what they run (DS08-SV, LA-UI18).

## Judgment calls

1. **Subdomain type core.** Reading a product as a wiki, a graph and an ERD is half of what the product says Lathe is ("a web app navigates"), and the one-map graph is Lathe's own.
2. **Four aggregates, all in the browser.** Page (the address), Space (last page), Nav row (what is folded) and Tab group keep state the reader changes, with rules that hold on every change, so they are aggregates with commands; their repositories are the browser's history and session storage.
3. **A3 reshaped from Folder to Nav row.** What a folder holds comes from the schema (read model RM02); what the reader owns is only whether a row is folded (DR22). It keeps A3's number since it keeps the fold state.
4. **A4 Graph retired; its rules became domain services and specifications.** The map is derived from the specs, so it is read model RM03. Its layout rules (DR57, DR58, DR62, DR64, DR17, DR04), the framing (DR46, DR59, DR63, DR48) and the level of detail (DR60) compute a value from inputs passed in, so they are domain services, implemented by the pure modules in `app/src/graph/`, and their old tests are domain service tests. Which nodes the filters and the Links switch show (DR05, DR49) are yes-or-no checks a query selects by, so they are specifications. This is also why no "graph layout" product kind is proposed.
5. **Read models filled from another domain's data.** The workspace is Platform's; Exploring's read models are filled from its published load (LA-CHK-EV02 or a Platform event, to resolve). Their `reads` name only Exploring's own aggregates where one applies, and DS04–DS08 are used by RM03's projection, which has no `calls` link.
6. **Test groups go.** Each test kind is a kind, so Test plan lists tests by kind like any other stage. DR24, DR25 and DR28 fold into DS03, DR23 into LA-V01-R02, and EN04 Test group is dropped.
7. **Domain rules about how a view looks or behaves became view requirements** (DR03, DR11, DR23, DR29, DR31, DR36, DR38, DR41–DR44, DR52, DR55, DR61, DR65, DR67, and the drawing halves of DR49 and DR59). Placed on the view they mostly concern: DR42 and DR43, which hold for the graph and the Model view alike, sit on LA-V04 and say so.
8. **The address follows the active tab (DR35) became two policies**, PO02 (a page opened shows in a tab) and PO03 (an active tab opens its page), with the new event EV02, because it joins two aggregates. INV06–INV08 keep DR32–DR34 as invariants of the tab group.
9. **Events delivered in process, deliberately.** EV01 and EV02 are heard by policies, which the plan delivers by outbox, but everything runs in one browser tab with no transaction; the outbox check's warnings on them are expected.
10. **The interaction requirements under flow F03** (F03-R01 to R03) became view requirements of the record page and the graph view, since a flow can't hold requirements now.
11. **Three new views:** Side bar, Focus page (the page bar with its tabs and toggles, and the panes) and Products page, because UC05, UC10, UC12 and UC07-R10 had steps that happened in no view.
12. **History reads an integration, Git,** with an adapter (`runGit`) and T160 as its integration test; DR56 became API requirement EP01-R02.
13. **No old addresses.** DR08's "an older graph address MUST lead to the same thing" and UC05-R01's sentence on the old `/records/…` and `/graph/…` addresses go: hard cutovers keep no redirects. Stage addresses lose the Define and Design level.
14. **Shapes for the fifty kinds.** DR65's table is rewritten (LA-V04-R06): new kinds get shapes and marks, removed kinds lose theirs.
15. **No tables.** The aggregates live in session storage and the read models in memory, once per load; a `table` record describes database storage, which Exploring has none of.
16. **API client product kind** for the app's calls to endpoints, so `app/src/views/history.ts` and `app/src/edit/write.ts` are traced. The alternative was to leave both untraced.
17. **One UI component per file.** Old components that named the same UI file (C01, C07, C31, C34; C05, C11, C40, C52, C59; C16, C24, C28, C33, C37 and others) fold into one UI component; a file that also holds a handler, a predicate or a service is named by those records too.
18. **Page kind and Pane sizes are text**, not value objects: each is used by one entity only and has no rule a test proves.
19. **Exactly one test per constraint, invariant, specification and policy.** Where several old tests proved one rule, the unit test closest to it keeps the proof and the others keep their other parts (table "Not carried over").
20. **Flow steps for UC01, UC02 and UC09 come from LA-TRC-F03**, which carried them out; the TRC sheet splits that flow (to resolve).
21. **UC14's write is Platform's command.** Exploring has no command that changes a record; UC14-FL-S02 and S05 invoke LA-PLT's write command (to resolve), and DR03 is a view requirement of the record page.
22. **DR44 splits:** its domain half is LA-V02-R01; its product half belongs on LA-TRC-V01, the product page (to resolve).
23. **Levels:** Vitest with jsdom is **unit**, as the plan has no component level.

## Findings in the code
- **`router.tsx` was untraced.** No old component named the History API routing that every page goes through; it is now A1-REPO, CMD01-H and EV01-ET.
- **`MODEL_KINDS` includes `domain_event`.** The code offers the Model view on a domain event's page, which SP02 (and UC11-R01) don't allow.
- **The tab and side-bar state live in session storage under several keys** (`lathe:tabs`, `lathe:view`, `lathe:graph-settings`, `lathe:pane-size:*`, `lathe:side-bar`): the repository is one file, but the state is spread over keys.
- **Old `/graph/<id>` addresses are still read** (C06 "where the older `/graph/<id>` addresses lead"); the hard cutover removes that code with the app step.
- **Exploring follows no pattern,** yet its tests prove four LA-PAT-APP-UX rules; the pattern rule tests name LA-EXP. Either LA-EXP follows LA-PAT-APP-UX (and LA-PAT-APP-CODE, whose R19 says what LA-VO01-C01 says) or those tests move to Platform.

## What the plan doesn't cover
| Need | Now |
| --- | --- |
| A read model filled from another domain's published events | No link names the event a projection hears; `reads` is domain-scoped. The source is in the read model's description. |
| A domain service used by a projection | `calls` is from commands and queries only. |
| Aggregates held in a browser (history, session storage) | Repositories name the file; no table describes the storage. |
| Events a policy hears inside one browser tab | Delivered in process; the outbox check will warn. |
| A view requirement for two views (the graph and the Model view) | Placed on one view. |
| A test level between unit and e2e (a component rendered in jsdom) | Counted as unit. |
| Pattern rule tests in a domain that follows no pattern | Written with LA-EXP; the schema allows it. |
| Code that calls an endpoint | The `api_client` product kind. |

## Accounted for

### Records

| Old | Count | Where it went |
| --- | --- | --- |
| domain LA-EXP | 1 | LA-EXP, subdomain core |
| aggregate A1, A2, A5 | 3 | A1, A2, A5 |
| aggregate A3 | 1 | A3 Nav row (judgment call 3); its folders → RM02 |
| aggregate A4 | 1 | retired: RM03, LA-VO03 and the domain services (judgment call 4) |
| entity EN01, EN02, EN09, EN10 | 4 | unchanged IDs |
| entity EN03 | 1 | EN03 Nav row |
| entity EN04 | 1 | dropped (judgment call 6) |
| entity EN05–EN08 | 4 | dropped with A4; fields → RM03, LA-VO03 |
| entity_field | 42 | 16 kept as entity fields (EN01 5, EN02 2, EN03 1, EN09 2, EN10 6); 26 moved or dropped (table "Old fields that leave the entities"); 5 new fields (EN02 Last chosen, EN03 Product and Row, EN10 Position and Side bar) |
| domain_event EV01 | 1 | EV01 |
| event_field | 5 | EV01's 5, types rewritten |
| domain_rule DR01, DR09, DR10, DR15, DR22, DR32, DR33, DR34 | 8 | INV01–INV08 |
| domain_rule DR05, DR16, DR27 (with DR07) | 4 | SP04, SP01, SP03 |
| domain_rule DR10 (second sentence), DR49 (selection) | — | SP02, SP05 |
| domain_rule DR35 | 1 | PO02, PO03 (judgment call 8) |
| domain_rule DR12, DR13, DR14 | 3 | DS02, DS01 |
| domain_rule DR18, DR19, DR20, DR21, DR24, DR25, DR26, DR28 | 8 | DS03, rewritten |
| domain_rule DR06, DR45 | 2 | DS04 |
| domain_rule DR04, DR17, DR57 | 3 | DS05 |
| domain_rule DR58, DR62, DR64 | 3 | DS06, DS07, DS08 |
| domain_rule DR46, DR48, DR59, DR63 | 4 | DS09; DR59's second paragraph → LA-V04-R07 |
| domain_rule DR60 | 1 | DS10 |
| domain_rule DR37, DR51 | 2 | DS11, rewritten |
| domain_rule DR66 | 1 | DS12 |
| domain_rule DR08, DR44 | 2 | LA-VO01-C01, C02; DR44's page half → LA-V02-R01 and LA-TRC-V01 (to resolve) |
| domain_rule DR03, DR11, DR23, DR29, DR31, DR36, DR38, DR41, DR42, DR43, DR52, DR55, DR61, DR65, DR67 | 15 | view requirements (table above); DR29 and DR36 into one |
| domain_rule DR49 (drawing) | — | LA-V04-R08 |
| domain_rule DR56 | 1 | EP01-R02 |
| capability CAP01–CAP03 | 3 | unchanged |
| use_case UC01–UC14 | 14 | unchanged IDs; seven goals and two titles rewritten |
| use_case_actor | 14 | unchanged |
| requirement UC01-R01 … UC14-R06 | 112 | 109 UC requirements (31 rewritten); UC06-R07, UC06-R08, UC09-R05 dropped |
| flow F01 | 1 | UC03-FL, UC04-FL; its LA-TRC-UC10 part → TRC (to resolve) |
| flow F02 | 1 | UC05-FL, UC10-FL, UC11-FL; its LA-PLT-UC04, UC06, UC09, UC10 parts → PLT (to resolve) |
| flow F03, F04, F05, F07 | 4 | UC06-FL, UC07-FL, UC12-FL, UC14-FL |
| flow F06 | 1 | UC13-FL; its step 4 (technical flows) goes |
| flow_step F03-S01–S04, F04-S01–S06 | 10 | UC06-FL-S01–S04, UC07-FL-S01–S06 (F04-S03's "the page they left" joins UC07-FL-S02) |
| view V01–V05 | 5 | LA-V01–LA-V05 (provisional) |
| api API01 | 1 | dropped: the API grouping goes (plan decision 15); its description → EP01 |
| api_shape | 3 | folded into EP01's description; History and Change → RM05's fields |
| endpoint E01 | 1 | EP01, under QRY11 |
| interaction_requirement E01-R01 | 1 | EP01-R01 |
| interaction_requirement V03-R01–R07 | 7 | LA-V03-R01–R07 |
| interaction_requirement F03-R01–R03 | 3 | LA-V03-R11, LA-V03-R12, LA-V04-R09 |
| layer LAY01–LAY10 | 10 | dropped: layers go (plan, "Changes to existing specs") |
| component C01–C72, C80–C88 | 81 | the technical records and UI components above, each naming its sources; C30 to resolve with Platform's keymap; C57 folds into DS11-SV; C60 into LA-UI18; C69 into DS08-SV; C88 → the write endpoint's API client (to resolve) |
| test T01–T225 | 205 | 324 test records (Test plan above), 20 parts not carried over |

### Links

| Old link | Rows | Where it went |
| --- | --- | --- |
| has_many EN09→EN10 | 1 | unchanged |
| has_many EN03→EN04, EN05→EN06, EN07, EN08 | 4 | dropped with EN04 and A4 |
| refers_to EN02→EN01, EN10→EN01 | 2 | fields typed LA-VO01 App address (a page is not referenced by ID but by its address) |
| refers_to EN09→EN02 | 1 | EN09's Space field, → A2 |
| refers_to EN01→LA-PLT-EN01, EN05→EN01 | 2 | dropped: a page reads the workspace through the read models; EN05 goes |
| relates_to A2→A1, A5→A1 | 2 | the App address fields above |
| relates_to A5→A2 | 1 | EN09's Space field |
| relates_to A1→LA-PLT-A1, A3→A1, A4→A1, A4→A3 | 4 | dropped, as above and with A4 |
| raised_by EV01→EN01 | 1 | CMD01 raises EV01 |
| reacts_to A2→EV01, C27→EV01 | 2 | PO01 hears EV01; PO01-H |
| reacts_to A5→EV01, C44→EV01 | 2 | PO02 hears EV01; PO02-H |
| applies UC→DR (own domain and LA-PLT-DR03, DR18, DR20, DR41) | 70 | dropped: a use case changes nothing; its steps invoke commands and queries, which check the specifications and keep the invariants |
| carries_out F→UC (own) | 12 | each flow's parent (table "Flows"); F06→UC06 goes with F06's technical flows |
| carries_out F01→LA-TRC-UC10, F02→LA-PLT-UC04, UC06, UC09, UC10 | 5 | to resolve: those use cases' own flows |
| fulfills step→UC requirement (F03-S01–S04, F04-S01–S06) | 13 | the new steps' fulfills |
| fulfills step→domain rule (F04-S01–S04) | 5 | dropped: steps fulfill only UC requirements; DS01, DS02, PO01, INV04, SP01 are kept by what the steps invoke |
| fulfills step→interaction requirement (F03-S01, S03, S04) | 3 | dropped: those requirements are view requirements of the views the steps happen in |
| fulfills F05→UC12-R01–R06 | 6 | moved to UC12-FL's steps |
| fulfills F01→LA-TRC-UC10-R01 | 1 | to resolve: LA-TRC-UC10's flow |
| fulfills view→UC requirement (V01–V05; LA-TRC-UC09-R05, LA-TRC-UC10-R01 and R02 included) | 26 | dropped: the steps fulfilling them happen in the view |
| fulfills E01, E01-R01→UC12-R05 | 2 | dropped: UC12-FL-S03 invokes QRY11, which EP01 exposes |
| fulfills interaction requirement→UC requirement (F03-R01–R03, V03-R01–R07, LA-CHK-UC07-R01 and LA-TRC-UC12-R01, UC14-R05 included) | 16 | dropped: a view requirement sits under its view, where the fulfilling steps happen |
| uses flow→view, flow→endpoint | 16 | dropped: they follow from the flows' steps |
| uses step→view | 9 | happens_in (F04-S05's LA-CHK-V01 to resolve) |
| uses step→component | 13 | dropped: a step invokes a command or query, whose handler implements it |
| uses view→LA-PLT-E01 | 5 | dropped: a view's reads follow from the steps' queries |
| implements C→view | 22 | renders links of the UI components (Source column above); C01→LA-CHK-V01 and LA-TRC-V01 to resolve |
| depends_on | 124 | dropped: what a handler uses follows from the tree |
| satisfies component→own obligation | 277 | replaced by the technical record implementing each obligation's design kind |
| satisfies component→LA-PLT, LA-TRC, LA-CHK, LA-AUT obligations | 49 | dropped: those obligations are implemented by their own domains' records (to resolve in those sheets) |
| satisfies component→pattern rule (LA-PAT-APP-CODE, LA-PAT-APP-UX) | 15 | dropped: pattern rules need proof only |
| covers T138→C54 | 1 | dropped: a test proves its parent, and the code it runs follows from what implements that parent |
| proves test→obligation | 346 | each new test's parent (Test plan above) |

Links into Exploring from other domains (their sheets account for the rows): 24 `proves` (table "Other domains' tests…"), 24 `satisfies` (dropped), 9 `applies` (dropped), 3 `carries_out` and 1 `fulfills` from LA-TRC-F03 (its steps are UC01-FL's and UC02-FL's), 11 `uses` (the other domains' steps happen in LA-V01–LA-V03), 7 `covers` (dropped), 2 `implements` (LA-PLT-C07→V01 to Platform's UI component; LA-PLT-C37→E01 → EP01-H, QRY11-H, LA-INT01-AD here), 1 `refers_to` (LA-PLT-EN02→EN01: a field typed LA-VO01) and 4 `relates_to` (LA-AUT-A1, LA-PLT-A3, LA-PLT-A5, LA-TRC-A1 →A1: fields typed LA-VO01, or dropped, in those sheets).
