# Conversion: LA-CHK Checking to the new model

The sorting sheet for brief 107, domain LA-CHK. It lists Checking's complete new spec, kind by kind in the plan's order ([domain-model-refinement.md](../plans/domain-model-refinement.md)), with each row's old source, and closes with a table that accounts for every old record and link of the domain. It follows the Tool Library sheet ([tool-library.md](tool-library.md)). The apply step (brief 111) writes it together with the other LA sheets.

It describes Checking as the plan makes it, not as it was: the checks of removed kinds and relations retire, the new "nothing uses it" errors and shape warnings are added, and the structure checks lose layers. Every such rewrite is marked **Rewritten** or **Retired** and listed again under Judgment calls.

## Conventions
- **Source** names the old record (`DR04`, `UC04-R02`, `C12` and so on, all `LA-CHK-` unless written in full) or the code (`lathe/src/…`).
- **Types** are the schema's basic types, a value object (`VO41`…) or a reference to an aggregate (`→ A1`…).
- **Optional** marks a field with `required: false`; every other field is required.
- **New** marks a row with no old record.
- **`[XXX-…]`** stands for the new ID the apply step gives another domain's old record: `[AUT-A1]` is whatever LA-AUT-A1 Product becomes, `[EXP-V03]` the new `LA-V<nn>` of the Record page. Each is listed under Cross-domain links to resolve.
- **Product-scoped numbers are provisional.** Value objects, views, UI components and integrations have product-scoped IDs that every LA sheet draws from. This sheet takes the block 41–49 (`LA-VO41`, `LA-V41`, `LA-UI41`, `LA-INT41`); LA-TRC takes 51–59. The apply step renumbers if blocks clash.

## Domain

| ID | Kind | Title | Fields | Source |
| --- | --- | --- | --- | --- |
| LA-CHK | Domain | Checking | subdomain type **supporting**; description rewritten (below) | domain |

Description: "Running the checks and reporting what they find: each check is a row of the `check` table with its query, a problem names its check and its record, and an error means the data is broken while a warning is work still to do. What the schema enforces never reaches a check: the store refuses it, and data it refuses is one `data-refused` error per refusal. A product adds check rows of its own. Checking also keeps the checks the schema cannot hold: records that nothing uses, the shape warnings (a use case with no flow, a test at a level its kind does not allow, a command's recorded exception, an event not delivered by outbox), and levels of the spec that are the wrong size. Every problem shows on the Checks page and the Dock badge." **Rewritten:** the old "structure checks that find gaps" named retired checks.

## Domain model

### Aggregates

| ID | Title | Parent | Identity | Source |
| --- | --- | --- | --- | --- |
| LA-CHK-A1 | Check | LA-CHK | Name | A1, description kept. Its child Problem leaves (it is the result of a run: RM01). |
| LA-CHK-A2 | Product setting | LA-CHK | Product | A2 Structure size, **rewritten**: what is stored is the product's setting row; child counts are worked out by the size checks (CK01, CK02), never stored. Description: "A product's settings that its checks read, one row per product: today the most children of one kind a record should hold." |

### Entities

| ID | Title | Parent | Role | Has value objects | Source |
| --- | --- | --- | --- | --- | --- |
| LA-CHK-EN01 | Check | A1 | root | VO41 Check name, VO42 Check severity | EN01 |
| LA-CHK-EN03 | Product setting | A2 | root | VO43 Children limit | EN03 Size limit, renamed for its table |

EN02 Problem becomes the read model RM01 Problems. EN04 Child count is dropped: its count, "too many" and "lone child" are worked out by the queries of CK01 and CK02 on every load and never stored.

### Entity fields

| Entity | # | Name | Type | Meaning | Example | Source |
| --- | --- | --- | --- | --- | --- | --- |
| EN01 | 1 | Name | VO41 Check name | The check's name, the key of its row across Lathe's checks and every product's. | value-object-unused | EN01 field 1 |
| EN01 | 2 | Product | → [AUT-A1] Product, optional (`product_id`) | The product a product's own check belongs to; none for Lathe's checks. | LA | field 2 |
| EN01 | 3 | Position | whole number | When it runs: Lathe's checks in position order, then each product's own. | 4 | field 3 |
| EN01 | 4 | Severity | VO42 Check severity | What its problems are: errors, warnings, or either when its query says which for each row. | warning | field 4 |
| EN01 | 5 | Summary | text | What it asks, in one sentence. | A view that no flow step happens in. | field 5 |
| EN01 | 6 | Explanation | text | What it reports, what it leaves to other checks, and how to fix what it reports. | A view exists because steps happen in it… | field 6 |
| EN01 | 7 | Query | text | The one SELECT that finds its problems (INV04). | SELECT v.id AS record, … FROM view v WHERE … | field 7 ("SQL text") |
| EN01 | 8 | Kinds | text, optional | The kinds it concerns, as a list of kind names; none for any kind. | view | field 8 |
| EN03 | 1 | Product | → [AUT-A1] Product (`product_id`) | The product the settings are for. | TL | EN03 field 1 |
| EN03 | 2 | Max children | VO43 Children limit | The most children of one kind a record of the product should hold; 15 when the product has no row. | 15 | field 2 |

The Product fields reference another domain's aggregate, so they stay plain IDs (decision 7): the tables carry no foreign key into it in the spec, though the SQL has one (see What the plan didn't cover).

### Value objects and constraints

| ID | Kind | Title | Parent | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| LA-VO41 | Value object | Check name | (used by EN01) | The name of a check, which its problems carry. | **New**: the type of EN01 field 1 |
| LA-VO41-C01 | Constraint | A check name is lower-case words joined by hyphens | VO41 | A check name MUST be lower-case letters and digits in words joined by single hyphens, such as `too-many-children`. | EN01 field 1; C23 (the CHECK on `check.name`) |
| LA-VO42 | Value object | Check severity | (used by EN01) | What a check's problems are. An **error** means the data is broken; a **warning** means work is still to do. | **New**: the type of EN01 field 4; DR01's meaning of the two |
| LA-VO42-C01 | Constraint | A check severity is error, warning or error_or_warning | VO42 | A check severity MUST be `error`, `warning`, or `error_or_warning` when the check's query says which for each row. | EN01 field 4; C23 (`check_severity` enum) |
| LA-VO43 | Value object | Children limit | (used by EN03) | The most children of one kind a record should hold. | **New**: the type of EN03 field 2 |
| LA-VO43-C01 | Constraint | A children limit is a whole number of at least 1 | VO43 | A children limit MUST be a whole number of at least 1; the store refuses any other value, naming the table. | DR16; C15 |

### Invariants

| ID | Title | Parent | Statement | Enforced by | Source |
| --- | --- | --- | --- | --- | --- |
| LA-CHK-INV01 | One name across Lathe's checks and every product's | A1 | A check's name MUST be one key across Lathe's checks and every product's, so each problem's check name says whether Lathe or the product reported it. A product check named like one of Lathe's MUST be refused, naming `lathe/data/check.jsonl`. | The primary key of `check` (`name`), with Lathe's rows loaded beside the product's | DR09; UC05-R03's refusal; C22's name refusal |
| LA-CHK-INV02 | Lathe's checks are read-only | A1 | Lathe's own check rows, in `lathe/data/check.jsonl`, MUST NOT change or be removed by any write to a product: they are loaded beside its data as read-only rows. | The store's `built-in` refusal in `set` and `remove` | **New**: C22's "read-only rows, so no product's write changes them" |
| LA-CHK-INV03 | A check documents itself | A1 | Every check row, Lathe's or a product's, MUST give a one-sentence summary, an explanation ending with how to fix what it reports, its severity and its query, none of them empty. | `NOT NULL` and non-empty CHECKs on `check` | DR24's first sentence; DR26 |
| LA-CHK-INV04 | A check's query is one SELECT that says what it returns | A1 | A check's query MUST be a single `SELECT` (or `WITH`) statement returning `record` and `message`, and it MUST return `severity` exactly when the check's severity is `error_or_warning`. | Nothing at write: a query that fails to run becomes an error under its name (UC05-R04), and the invariant test reads every one of Lathe's rows | DR03; DR25 |
| LA-CHK-INV05 | A product has at most one settings row | A2 | A product MUST have at most one `product_setting` row. | The primary key of `product_setting` (`product_id`) | **New**: C15's "one row per product" |

The second sentence of DR24 ("the reference takes each check's text from its row and from nowhere else") is the reference's, LA-AUT's: see Cross-domain links.

### Specifications
None. Checking's commands check no yes-or-no rule beyond its invariants, and its queries select by none.

### Domain events

| ID | Title | Parent | Published | Raised by | Source |
| --- | --- | --- | --- | --- | --- |
| LA-CHK-EV01 | Check changed | A1 | yes | CMD01, CMD02, CMD03 | EV01; raised_by EV01→EN01. Published because LA-PLT's live reload listened to it (reacts_to PLT-A1, PLT-C09, AUT-C46 → EV01): to resolve with LA-PLT. |

EV02 Workspace checked is dropped (judgment call 4).

### Event fields

| Event | # | Name | Type | Meaning | Example | Source |
| --- | --- | --- | --- | --- | --- | --- |
| EV01 | 1 | Check | → A1 Check | The check that was added, changed or removed. | value-object-unused | **Rewritten** from field 1 File: the event is about the check; its file follows from its product |
| EV01 | 2 | Change | text | What happened to the check: `added`, `changed` or `removed`. | changed | field 2 |
| EV01 | 3 | Changed at | date and time | When the change was written. | 2026-10-24T14:10:00Z | field 3 |

### Commands

Each changes one aggregate. A check is written through the command layer's generic writes; these commands are those writes on the `check` and `product_setting` tables.

| ID | Title | Parent | Raises | Checks | Source |
| --- | --- | --- | --- | --- | --- |
| LA-CHK-CMD01 | Add a check | A1 | EV01 | (INV01, INV03) | UC02, UC05; F01 step 4, F02 step 2; `lathe add check`, the MCP `add` tool and the app |
| LA-CHK-CMD02 | Change a check | A1 | EV01 | (INV02, INV03) | EV01's `changed`; `lathe set check` |
| LA-CHK-CMD03 | Remove a check | A1 | EV01 | (INV02) | EV01's `removed`; `lathe remove check` |
| LA-CHK-CMD04 | Set the children limit | A2 | | (INV05) | **New** as a command: UC06-R02; `lathe add product_setting` / `lathe set product_setting` |

### Read models and fields

| ID | Title | Parent | Reads | Source |
| --- | --- | --- | --- | --- |
| LA-CHK-RM01 | Problems | LA-CHK | A1 (the check rows); and every record of the product, through the check queries (see What the plan didn't cover) | EN02 Problem and the `problem` table: the result of a run, never stored |

| Read model | # | Name | Type | Meaning | Example | Source |
| --- | --- | --- | --- | --- | --- | --- |
| RM01 | 1 | Check | → A1 Check (`check_name`) | The check that found it, or the engine's own `data-refused`. | value-object-unused | EN02 field 2 |
| RM01 | 2 | Severity | text | `error` or `warning`: whether the data is broken or has work still to do. | error | field 1 |
| RM01 | 3 | Record | text, optional | The ID of the record it is about; none for the whole workspace. | TL-VO05 | field 3 |
| RM01 | 4 | Message | text | What is wrong, naming the IDs involved, and the fix. | Value object TL-VO05 is used by no field. Type a field with it, or remove it. | field 4 |

Severity is text: a problem is either of two values while a check's severity has three, and a value object must be used by an entity (as the Tool Library's Status).

### Queries

| ID | Title | Parent | Selects by | Uses | Source |
| --- | --- | --- | --- | --- | --- |
| LA-CHK-QRY01 | Check the workspace | RM01 | | DS01 | UC01; F01 step 3; DF01; C12, C21. Description: one load of the product's data, then every problem: `data-refused` errors when the store refuses the data (and nothing else), else Lathe's checks then each product's, in DS01's order, a product's check reporting only on records of its product. `lathe check`, the MCP `check` tool and `GET /api/spec` all read it. |
| LA-CHK-QRY02 | List a product's problems | RM01 | | | UC07-R01; F03. Description: one product's problems, errors before warnings, grouped by check, then the problems that belong to no product under Workspace. |
| LA-CHK-QRY03 | Count the errors of the product in front | RM01 | | | UC07-R02. Description: the number of errors of the focused window's space, its product's and the workspace's, as its Checks page counts them. |

### Policies
None.

### Domain services

| ID | Title | Parent | Used by | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| LA-CHK-DS01 | Check order | LA-CHK | QRY01 | Orders the check rows for a run and for the reference: Lathe's checks by position, then each product's by position, so a product check never changes which of Lathe's problems are found. | DR04 (order), DR10; C12's and C17's `orderChecks` |

### Terms

| ID | Term | Meaning | Source |
| --- | --- | --- | --- |
| LA-CHK-TM01 | Check | One rule the engine applies on every load: a row of the `check` table whose query returns a row for each problem. | **New**: A1 |
| LA-CHK-TM02 | Problem | One thing a check found wrong or still to do in the loaded data. Problems are the result of a run, never stored. | **New**: EN02 |
| LA-CHK-TM03 | Error | A problem that means the data is broken. `lathe check` exits 1 on any error. | **New**: DR01 |
| LA-CHK-TM04 | Warning | A problem that means work is still to do. Warnings never fail `lathe check`. | **New**: DR01 |
| LA-CHK-TM05 | Lathe's checks | The check rows that ship with Lathe, in `lathe/data/check.jsonl`, read-only to every product. | **New**: C02, C22 |
| LA-CHK-TM06 | Product check | A check row a product adds for its own house rule, in its own `data/check.jsonl`. | **New**: UC05 |
| LA-CHK-TM07 | Refusal | A row the store will not load or write, reported once as a `data-refused` error naming the file, the line and the rule. | **New**: UC01-R04, DR06 |
| LA-CHK-TM08 | Children limit | The most children of one kind a record of a product should hold: its `max_children` setting, 15 by default. | **New**: DR15 |
| LA-CHK-TM09 | Lone child | The one record a capability or a group holds, which makes the level group nothing. | **New**: DR19 |

## Use cases

### Capabilities

| ID | Title | Parent | Source |
| --- | --- | --- | --- |
| LA-CHK-CAP01 | Running checks | LA-CHK | CAP01; description **rewritten**: "Running the checks, adding new ones, reviewing what they find, and keeping every change checked." (its "how a test ties a record to the code that proves it" is LA-TRC-UC05's) |
| LA-CHK-CAP02 | Finding problems in the spec | LA-CHK | CAP02; description **rewritten**: "The checks the schema cannot hold: records nothing uses, shape warnings, each mistake read once, and levels of the wrong size." |

### Use cases

Actors and their order are unchanged.

| ID | Title | Parent | Actors | Goal | Source |
| --- | --- | --- | --- | --- | --- |
| LA-CHK-UC01 | Check the workspace from the command line | CAP01 | Agent, Owner | as today | UC01 |
| LA-CHK-UC02 | Add a check | CAP01 | Agent, Owner | as today | UC02 |
| LA-CHK-UC04 | Find structural problems and read each mistake once | CAP02 | Owner, Agent | **Rewritten** (below) | UC04 "Find structural gaps and read each mistake once" |
| LA-CHK-UC05 | Add a product's own checks | CAP01 | Owner, Agent | as today, with "every endpoint to state at least one interaction requirement" → "at least one API requirement" | UC05 |
| LA-CHK-UC06 | Keep each level of the spec a useful size | CAP02 | Owner, Agent | **Rewritten**: "…warns when a record holds more children of one kind than the product's `max_children` setting (`product_setting`), and when a capability or a group holds only one record, counting a flow's steps per path and requirements and rules per group…" (layers go) | UC06 |
| LA-CHK-UC07 | Review every problem of a product | CAP01 | Owner | as today | UC07 |
| LA-CHK-UC08 | Keep every change to the spec checked | CAP01 | Agent, Owner | as today | UC08 |

UC04's goal: "The Owner, or an Agent, runs `lathe check` on a product whose stages are written by different people at different times, and learns what is broken and what does not join up yet: a view, integration, value object, specification or UI component that nothing uses is an error; a use case with no flow, a test at a level its kind does not allow, a command's recorded exception and an event a policy hears that is not delivered by outbox are warnings. And when one row is wrong, for example a test given its parent's ID, the store refuses it once, naming the row, instead of in many messages."

### UC requirements

Unchanged rows carry over with their IDs, titles, groups and statements. Rewritten rows take the statement given here.

| ID | Group | Title | Change |
| --- | --- | --- | --- |
| UC01-R01 | | The check prints errors, then warnings, then coverage | **Rewritten**: "`lathe check` MUST print every error, then every warning, then one coverage line per domain and obligation kind, each showing how many are designed, built and proved out of the total." (was "for requirements and for domain rules") |
| UC01-R02 | | The check exits non-zero on any error | unchanged |
| UC01-R03 | | The check can print the whole workspace as JSON | unchanged |
| UC01-R04 | | Data that breaks the schema is refused, and is an error | **Rewritten**: "The store MUST refuse each row that breaks the schema (a duplicate or malformed ID, an unknown column, a missing title, parent or required column, a parent or link naming a record that does not exist or of a kind it does not allow, a link into another product), and `lathe check` MUST report each refusal as a `data-refused` error naming the file, the line and the rule. An automated test whose file is missing, or does not name the test's ID, MUST be an error naming the test." (was "does not name what it proves") |
| UC01-R05 | | A data file that does not load is an error, not a crash | unchanged |
| UC01-R06 | | Every problem names its check and its record | **New**: "Every problem MUST name the check that found it and, when it concerns a record, that record's ID, and its message MUST be a plain sentence naming the IDs involved." (DR02) |
| UC02-R01 | | A new check needs only a new check row | unchanged |
| UC02-R02 | | Checks can read every typed table | **Rewritten**: "A check's query MUST be able to read every typed table, the `record_parent`, `record_scope` and `link` views, the `meta_*` tables, the coverage views and the product's settings, each a typed column of `product_setting` with its default when the product has no row. The file facts (`file_facts`: whether a test's or a technical record's file exists, and whether a test's file names the test's ID) MUST be filled before the checks run, so checks stay in SQL." (drops keys and `file_mentions`; takes in DR23) |
| UC02-R03 | | Every check runs, in order, even after one fails | **New**: "The engine MUST run every check row on every load, in the order of LA-CHK-DS01, and MUST collect the problems of all of them in that order, even when one check fails to run." (DR04) |
| UC04-R01 | Missing links | A domain rule that no use case applies is a warning | **Retired**: domain rules and `applies` go |
| UC04-R02 | Missing links | A use case no flow carries out is a warning once its domain has flows | **Rewritten**, title "A use case with no flow is a warning once its domain has flows": "A use case with no flow MUST be reported as a `use-case-without-flow` warning, but only when the use case's domain has at least one flow: a check for a missing later stage stays silent until the domain has started that stage. It MUST be a warning, never an error, so `lathe check` does not fail because of it." (takes in DR05, DR07) |
| UC04-R03 | Missing links | An interaction requirement that fulfills nothing is a warning | **Retired**: view and API requirements sit under their view or endpoint, and only flow steps fulfill (UC requirements). A UC requirement no step fulfills is LA-TRC's not-designed gap. |
| UC04-R04 | Missing links | A test whose type does not suit what it proves is a warning | **Rewritten**, title "A test at a level its kind does not allow is a warning": "A test whose run by level its kind does not allow MUST be reported as a `test-level-not-allowed` warning naming the test, its level and the levels its kind allows: a constraint test unit; an invariant or specification test unit or database; a domain service test unit; a policy test database, api or e2e-api; a use case test api, e2e-api, e2e-ui or manual; a view test unit, e2e-ui or manual; an endpoint test contract or api; a flow test e2e-ui or manual; an integration test contract, e2e-api or manual; a pattern rule test any level." (`test_type` goes; the levels are brief 108's) |
| UC04-R06 | One problem per mistake | A product relation declared twice is refused, naming the file and line | unchanged |
| UC04-R07 | One problem per mistake | A duplicated ID is one refusal, not one per link to it | unchanged |
| UC04-R08 | One problem per mistake | An unknown parent is refused once | unchanged |
| UC04-R09 | Missing links | A component that satisfies nothing is a warning | **Rewritten**, title "A record that nothing uses is an error": "A view no flow step happens in, an integration no step exchanges with, a value object no field is typed by, a specification no command checks and no query selects by, and a UI component that renders no view MUST each be reported as an error naming it, whose message says to use it or remove it." (DR28 retired with it) |
| UC04-R10 | Missing links | A test that proves and supports nothing is a warning | **Retired**: every test has exactly one parent, the record it proves, so the store refuses a test that proves nothing (R08) |
| UC04-R11 | One problem per mistake | A link or parent the schema does not allow is refused once | **Rewritten**: "The store MUST refuse a link between two kinds its relation does not allow, naming the kinds that end accepts, and a parent column its kind does not have, each once." |
| UC04-R12 | Missing links | A command's recorded exception is a warning | **New**: "Each other aggregate a command also changes in its transaction (a `command_change` row) MUST be reported as a warning naming the command, the aggregate and the reason, so every exception to one aggregate per command stays visible." (plan decision 1) |
| UC04-R13 | Missing links | An event that crosses a transaction is delivered by outbox | **New**: "An event a policy hears, or a published event, whose event type does not give `outbox` as its delivery MUST be reported as a warning naming the event." (plan decision 1) |
| UC05-R01 to R05 | | (five) | unchanged |
| UC06-R01 | | A record with too many children of one kind is a warning | **Rewritten**: "…and says to add a level between them, such as a capability or another aggregate. Children MUST be counted per kind, and tests MUST NOT be counted: each sits under the one record it proves, and more of them never calls for a level." (layers go; DR18's reason changes) |
| UC06-R02 | | The limit is the product's max_children setting, 15 by default | unchanged |
| UC06-R03 | | A capability or layer with one child is a warning | **Rewritten**, title "A capability with one child is a warning": "A capability with exactly one child MUST be a `lone-child` warning that names it and its child and says to merge it into a neighbor or give it more." |
| UC06-R04 | | A lone child counts the record's own children of every kind | **Rewritten**: "The `lone-child` check MUST count every child of the capability, of any kind, and only its own children, not theirs. A capability with no children, or with two or more, MUST NOT be reported." |
| UC06-R05 | | A flow's steps are counted per path | unchanged |
| UC06-R06 | | Grouped children are counted per group | **Rewritten**: "`too-many-children` MUST count UC requirements, view requirements, API requirements, pattern rules and standard rules per `group_name`…" (rest unchanged) |
| UC06-R07 | | A group with one member is a lone child | **Rewritten**: "…naming the group and its member, as a capability with one child does." |
| UC07-R01 | | A space's Checks page lists its product's problems, errors first, grouped by check | **Moved** to view requirement LA-V41-R01 (judgment call 8) |
| UC07-R02 | | The Dock badge counts the check errors of the product in front | unchanged |
| UC08-R01 to R03 | | (three) | unchanged |

## Interaction design

### Flows

One per use case, belonging only to it. The old flows each carried out several use cases and split; their numbered descriptions become the steps.

| ID | Title | Parent | Source |
| --- | --- | --- | --- |
| LA-CHK-UC01-FL | Check the workspace and fix its errors | UC01 | F01 steps 3 and 5; DF01's steps (its technical detail goes to QRY01-H and RM01-PJ) |
| LA-CHK-UC02-FL | Add a check | UC02 | F01 step 4 |
| LA-CHK-UC04-FL | Find structural problems | UC04 | **New** (UC04 was carried out by LA-AUT-F03, which stays LA-AUT's); UC04's goal |
| LA-CHK-UC05-FL | Add a product's own check | UC05 | F02 |
| LA-CHK-UC06-FL | Keep each level a useful size | UC06 | **New** (carried out by LA-AUT-F03); UC06's goal |
| LA-CHK-UC07-FL | Review problems while an agent edits | UC07 | F03 |
| LA-CHK-UC08-FL | Write through the command layer | UC08 | F01 steps 1 and 2 |

### Flow steps

Step IDs are written short; in full they start `LA-CHK-`. "Invokes" names a command or query; [PLT-write] stands for LA-PLT's command for a write through the command layer (to resolve).

| ID | Path | Title | Invokes | In view | Fulfills | Source |
| --- | --- | --- | --- | --- | --- | --- |
| UC01-FL-S01 | main | The Agent runs `lathe check`, or the MCP `check` tool, on the product root | QRY01 | | | F01 step 3; DF01-S01 |
| UC01-FL-S02 | refused | Data the store refuses becomes `data-refused` errors naming the file, the line and the rule, and nothing else is checked | | | UC01-R04, UC01-R05 | DF01-S02; DF01's failure table |
| UC01-FL-S03 | main | The command prints every error, then every warning, each naming its check and record, then one coverage line per domain and obligation kind | | | UC01-R01, UC01-R06 | DF01-S07 |
| UC01-FL-S04 | main | The command exits with status 1 when there is an error, 0 otherwise | | | UC01-R02 | DF01-S07; DF01's signals table |
| UC01-FL-S05 | json | With `--json`, the command prints the whole workspace instead | | | UC01-R03 | DF01-S08 |
| UC01-FL-S06 | main | The Agent fixes each error, runs the check again until there are none, and hands the work back to the Owner with the check's last lines | | | | F01 steps 3 and 5 |
| UC02-FL-S01 | main | The Agent adds the check as one row through the command layer: a name, a position, a severity, a summary, an explanation and one SELECT | CMD01 | | UC02-R01 | F01 step 4 |
| UC02-FL-S02 | main | The next check runs every check row in order, the new one among them, each query reading the typed tables, views and file facts | QRY01 | | UC02-R02, UC02-R03 | F01 step 4; DF01-S03 to S05 |
| UC04-FL-S01 | main | The Owner or an Agent runs `lathe check` on a product whose stages were written at different times | QRY01 | | | UC04 goal |
| UC04-FL-S02 | refused | A row the schema refuses is refused once, naming its rule, file and line, and nothing that only follows from it is reported | | | UC04-R06, UC04-R07, UC04-R08, UC04-R11 | UC04 goal |
| UC04-FL-S03 | main | Each view, integration, value object, specification or UI component that nothing uses is an error | | | UC04-R09 | **New** |
| UC04-FL-S04 | main | The shape warnings name a use case with no flow, a test at a level its kind does not allow, each recorded exception and each event not delivered by outbox | | | UC04-R02, UC04-R04, UC04-R12, UC04-R13 | UC04 goal |
| UC04-FL-S05 | main | They fix each error and work through the warnings as the stages fill in | | | | UC04 goal |
| UC05-FL-S01 | main | The Owner decides a rule belongs to their product, not to Lathe | | | | F02 step 1 |
| UC05-FL-S02 | main | They add it as a check row with the product's `product_id`, through `lathe add check` or the app | CMD01 | | | F02 step 2 |
| UC05-FL-S03 | refused | A check named like one of Lathe's is refused, naming `lathe/data/check.jsonl` | | | UC05-R03 | F02 step 4 |
| UC05-FL-S04 | main | They run `lathe check`: Lathe's checks run first, then the product's, whose problems carry its row's name and concern only its product's records | QRY01 | | UC05-R01, UC05-R02 | F02 step 3 |
| UC05-FL-S05 | refused | A product check whose query fails is an error naming the check, and the other checks still run | | | UC05-R04 | F02 step 4 |
| UC05-FL-S06 | refused | A `checks` key in `lathe.config.json` is refused as an unknown setting | | | UC05-R05 | **New** (UC05-R05) |
| UC05-FL-S07 | main | They fix what the new check finds and run `lathe check` again until it is clean | | | | F02 step 5 |
| UC06-FL-S01 | main | The Owner sets the product's children limit, or leaves the default of 15 | CMD04 | | UC06-R02 | UC06 goal |
| UC06-FL-S02 | main | `lathe check` warns of each record with more children of one kind than the limit, counting a flow's steps per path and requirements and rules per group | QRY01 | | UC06-R01, UC06-R05, UC06-R06 | UC06 goal |
| UC06-FL-S03 | main | It warns of each capability or group with one child | | | UC06-R03, UC06-R04, UC06-R07 | UC06 goal |
| UC06-FL-S04 | main | The Owner or an Agent adds a level or merges one, and checks again | | | | UC06 goal |
| UC07-FL-S01 | main | While an Agent writes records, the Owner keeps the product's Checks page open: its problems, errors first, grouped by check, and the workspace's below | QRY02 | LA-V41 | | F03 step 1 |
| UC07-FL-S02 | main | Each time a data file changes, the page reloads and shows the problems as they are now | QRY02 | LA-V41 | | F03 step 2 |
| UC07-FL-S03 | main | They open a problem's record to see it and its problems, and go back | | [EXP-V03] | | F03 step 3 |
| UC07-FL-S04 | main | They follow a check's code to the check's page in the reference | | [AUT-V03] | | F03 step 4 |
| UC07-FL-S05 | main | With the desktop app, the Dock badge shows the error count of the product in front | QRY03 | | UC07-R02 | **New** (UC07-R02) |
| UC08-FL-S01 | main | Claude Code loads Lathe's plugin, which declares the guard hook on Write, Edit, MultiEdit and NotebookEdit | | | UC08-R03 | **New** (UC08-R03); exchanges with LA-INT41 |
| UC08-FL-S02 | main | The Agent changes records through the MCP tools or the `lathe` command, which validates each write in one transaction | [PLT-write] | | | F01 steps 1–2; exchanges with LA-INT41 |
| UC08-FL-S03 | refused | A hand edit of a data file is refused before it happens, pointing at the tools | | | UC08-R01 | F01 step 1; fulfills F01→UC08-R01; exchanges with LA-INT41 |
| UC08-FL-S04 | main | Every other edit goes through silently | | | UC08-R02 | **New** (UC08-R02); exchanges with LA-INT41 |

Every UC requirement that stays a UC requirement is fulfilled by at least one step of its own flow.

### Views and view requirements

| ID | Kind | Title | Fields | Source |
| --- | --- | --- | --- | --- |
| LA-V41 | View | Checks page | route `/<product-id>/checks`; description as today | CHK-V01 |
| LA-V41-R01 | View requirement | A space's Checks page lists its product's problems, errors first, grouped by check | statement as UC07-R01's | UC07-R01 (judgment call 8) |
| LA-V41-R02 | View requirement | A problem's code leads to its check | "Wherever a problem's check code is shown, on the Checks page and on a record's page, it MUST be a link to that check's page." | DR27 |

### Endpoints
None of Checking's own. The Checks page reads problems through `GET /api/spec` (LA-PLT-E01), which exposes LA-PLT's load of the workspace: to resolve.

### Integrations

| ID | Title | System | Used by | Source |
| --- | --- | --- | --- | --- |
| LA-INT41 | Claude Code | Claude Code | UC08-FL-S01 to S04 | **New**: the plugin's host, which C24's and C25's hook answers. To resolve with the sheets that own the plugin's MCP server, which exchanges with the same system: one integration. |

### CLI commands (product kind, proposed)

| ID | Title | Parent | Command | Exposes | File | Source |
| --- | --- | --- | --- | --- | --- | --- |
| LA-CHK-CLI01 | Check the workspace | LA-CHK | `lathe check [--json]` | QRY01 | lathe/bin/lathe.ts | C01 (and LA-TRC-C05, C23: its coverage and tests-by-state lines). Description keeps the report's order, the coverage line format and the exit status. |

## Technical specification

Each record names one file that exists today. Technical kinds with no code are left out and show as not built: EV01's event type (no code raises it; the server's file watcher announces `spec:changed` for every data file), QRY02's and QRY03's separate projections (they read RM01's rows).

| ID | Kind | Implements | File | What in the file | Source |
| --- | --- | --- | --- | --- | --- |
| LA-CHK-A1-REPO | Repository | A1 | lathe/src/store/store.ts | the store's rows of `check`, and loading `lathe/data/check.jsonl` beside the product's data as read-only rows | C22 |
| LA-CHK-A2-REPO | Repository | A2 | lathe/src/store/store.ts | the store's rows of `product_setting` | C15 |
| LA-CHK-EN01-DM | Data model | EN01 | lathe/src/store/tables.ts | `CheckRow` | C23 |
| LA-CHK-EN03-DM | Data model | EN03 | lathe/src/store/tables.ts | `ProductSettingRow` | C15 |
| LA-CHK-EN01-TB | Table | EN01 | lathe/schema/011-checking.sql | `check`, storage table | C23 |
| LA-CHK-EN03-TB | Table | EN03 | lathe/schema/003-product.sql | `product_setting`, storage table | C15 |
| LA-CHK-RM01-TB | Table | RM01 | lathe/schema/011-checking.sql | `problem`, storage table: filled by its projection on every load, never written to a file | C23 |
| LA-VO41-VT | Value type | VO41 | lathe/schema/011-checking.sql | the CHECK on `check.name` | C23 |
| LA-VO42-VT | Value type | VO42 | lathe/schema/011-checking.sql | `check_severity` | C23 |
| LA-VO43-VT | Value type | VO43 | lathe/schema/003-product.sql | the CHECK on `max_children`; `DEFAULT_MAX_CHILDREN` in config.ts is CK01's default | C15 |
| LA-CHK-RM01-PJ | Projection | RM01 | lathe/src/index.ts | `runChecks` (each row's query on a few connections side by side, problems in run order, a failed query as one error, a product's check kept to its product's records) and `refusedWorkspace` (one `data-refused` error per refusal) | C12, C21; DF01-S05 |
| LA-CHK-CMD01-H | Command handler | CMD01 | lathe/src/store/store.ts | `add` on `check` (the command layer's write) | UC02-R01; to resolve with LA-PLT's write handler |
| LA-CHK-CMD02-H | Command handler | CMD02 | lathe/src/store/store.ts | `set` on `check`, refusing Lathe's own (`built-in`) | C22 |
| LA-CHK-CMD03-H | Command handler | CMD03 | lathe/src/store/store.ts | `remove` on `check`, refusing Lathe's own | C22 |
| LA-CHK-CMD04-H | Command handler | CMD04 | lathe/src/store/store.ts | `add` and `set` on `product_setting` | C15 |
| LA-CHK-QRY01-H | Query handler | QRY01 | lathe/src/index.ts | `loadWorkspace`: opens the store, fills the file facts, runs the checks, counts coverage; `Workspace.problems` | C12, C21; DF01 and its steps. Shared with LA-PLT-C01's new record (to resolve). |
| LA-CHK-QRY02-H | Query handler | QRY02 | app/src/specs/SpecPages.tsx | `byCheck`, and the Checks page's choice of its product's problems and the workspace's | LA-EXP-C31 (to resolve) |
| LA-CHK-QRY03-H | Query handler | QRY03 | desktop/src/dock.ts | `badgeFor`, `badgeText` | LA-PLT-C53, LA-AUT-C69 (to resolve) |
| LA-CHK-DS01-SV | Service | DS01 | lathe/src/reference.ts | `orderChecks` | C12, C17 |
| LA-UI41 | UI component | renders LA-V41 | app/src/specs/SpecPages.tsx | `ChecksPage` | LA-EXP-C01, C31's implements →CHK-V01 (to resolve: one UI component) |
| LA-CHK-CLI01 | CLI command (product kind) | exposes QRY01 | lathe/bin/lathe.ts | `check()` | C01 |
| LA-INT41-HK01 | Plugin hook (product kind) | LA-INT41 | plugin/scripts/guard-data-files.mjs | the PreToolUse guard, declared in `plugin/hooks/hooks.json` | C24, C25 |

### Tables and keys

| Table | Name | Key | Kind | Columns | Target or invariant |
| --- | --- | --- | --- | --- | --- |
| EN01-TB | check | (primary) | primary | name | INV01 |
| EN03-TB | product_setting | (primary) | primary | product_id | INV05 |

`check.product_id` and `product_setting.product_id` name the product, LA-AUT's: no foreign key is recorded (decision 7). RM01-TB has no keys.

### Check rows (product kind, proposed)

Lathe's check rows in `lathe/data/check.jsonl` are what Checking builds: each is a query the engine runs. None of the fourteen technical kinds fits a row of data that is code, so each is a `check_row` record under the domain whose rules it reports. Rows marked **New** are brief 108's to write; the apply step keeps such a record only if its row exists by then, under the name 108 gave it.

| ID | Check name | Severity | Reports | Source |
| --- | --- | --- | --- | --- |
| LA-CHK-CK01 | too-many-children | warning | UC06-R01, R05, R06; reads `max_children` (15 by default) | C13, C16, **rewritten** (no layers) |
| LA-CHK-CK02 | lone-child | warning | UC06-R03, R04, R07 | C14, **rewritten** (capabilities and groups only) |
| LA-CHK-CK03 | use-case-without-flow | warning | UC04-R02 | C05, **rewritten** (a use case's one flow; no `carries_out`) |
| LA-CHK-CK04 | test-level-not-allowed | warning | UC04-R04 | **New**, replacing C07 test-type-mismatch |
| LA-CHK-CK05 | view-unused | error | UC04-R09 | **New**, replacing C18 component-satisfies-nothing |
| LA-CHK-CK06 | integration-unused | error | UC04-R09 | **New** |
| LA-CHK-CK07 | value-object-unused | error | UC04-R09 | **New** (the schema's own example name) |
| LA-CHK-CK08 | specification-unused | error | UC04-R09 | **New** |
| LA-CHK-CK09 | ui-component-unused | error | UC04-R09 | **New** |
| LA-CHK-CK10 | command-change-recorded | warning | UC04-R12 | **New** |
| LA-CHK-CK11 | event-not-by-outbox | warning | UC04-R13 | **New** |

Every check row names `lathe/data/check.jsonl`. `data-refused` is the engine's own (`ENGINE_CHECKS` in lathe/src/reference.ts), part of RM01-PJ, with no row.

### Meets
LA-CHK-EN01-TB meets LA-STD-CODE-R01 (a check is one row with one SELECT and its explanation), from TRC-C02's and TRC-C03's meets (see la-trc.md). LA-CHK-RM01-PJ meets LA-STD-CODE-R03 (the `node:` prefix), from DF01-S05's.

## Test plan

Every test names one parent and a run by, all automated unless marked. **Levels:** the engine tests in `lathe/test/` run the engine in process through its package API (`loadWorkspace`, `openStore`) on DuckDB: **api** for use case tests, **database** for invariant and constraint tests. `lathe/test/cli.test.ts` and `lathe/test/cli/plugin.test.ts` spawn processes: **e2e-api**. The app's vitest tests are **unit**, as view tests. Each test's `it` name changes to its new ID, since its file must name it (LA-TRC-UC05-R01). When one old test splits, its `it` splits likewise.

### Constraint tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| LA-VO41-C01-T | VO41-C01 | database, not automated yet | **New** |
| LA-VO42-C01-T | VO42-C01 | database, not automated yet | **New** |
| LA-VO43-C01-T | VO43-C01 | database, lathe/test/sizes.test.ts | T38 |

All three are database tests of SQL CHECKs, which the constraint test's one allowed level (unit) does not fit: see What the plan didn't cover.

### Invariant tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| LA-CHK-INV01-T | INV01 | database, lathe/test/product-checks.test.ts | T26, its refusal part |
| LA-CHK-INV02-T | INV02 | database, not automated yet | **New** (to resolve: LA-AUT's store tests may already prove the `built-in` refusal) |
| LA-CHK-INV03-T | INV03 | database, lathe/test/reference.test.ts | T45 (one-sentence summary, explanation) and T46 (a row without them is refused), merged |
| LA-CHK-INV04-T | INV04 | database, lathe/test/engine.test.ts | T08 (one SELECT, Lathe's rows in order) and T45's severity part (lathe/test/reference.test.ts), merged into engine.test.ts |
| LA-CHK-INV05-T | INV05 | database, not automated yet | **New** |

### Domain service tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| LA-CHK-DS01-T01 | DS01 | unit, not automated yet, lathe/test/reference.test.ts | **New**: `orderChecks` alone (T07 and T23 prove the order through a load, as use case tests) |

### Use case tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| UC01-R01-T01 | UC01-R01 | e2e-api, lathe/test/cli.test.ts | T02 |
| UC01-R02-T01 | UC01-R02 | e2e-api, lathe/test/cli.test.ts | T03 |
| UC01-R03-T01 | UC01-R03 | e2e-api, lathe/test/cli.test.ts | T04 |
| UC01-R04-T01 | UC01-R04 | api, lathe/test/checks.test.ts | T10 |
| UC01-R04-T02 | UC01-R04 | api, lathe/test/link-crosses-product.test.ts | T52 |
| UC01-R05-T01 | UC01-R05 | api, lathe/test/checks.test.ts | T01 |
| UC01-R06-T01 | UC01-R06 | api, lathe/test/checks.test.ts | T11 |
| UC02-R01-T01 | UC02-R01 | api, lathe/test/engine.test.ts | T05 |
| UC02-R02-T01 | UC02-R02 | api, lathe/test/engine.test.ts | T06 |
| UC02-R02-T02 | UC02-R02 | api, lathe/test/sizes.test.ts | T44 |
| UC02-R03-T01 | UC02-R03 | api, lathe/test/engine.test.ts | T07 |
| UC04-R02-T01 | UC04-R02 | api, lathe/test/structure.test.ts | T14 |
| UC04-R02-T02 | UC04-R02 | api, lathe/test/structure.test.ts | T18 (structural gaps are warnings) |
| UC04-R04-T01 | UC04-R04 | api, lathe/test/structure.test.ts | T16, **rewritten** for levels |
| UC04-R04-T02 | UC04-R04 | api, lathe/test/structure.test.ts | T17, **rewritten**: a test at an allowed level is not reported |
| UC04-R06-T01 | UC04-R06 | api, lathe/test/structure.test.ts | T19 |
| UC04-R07-T01 | UC04-R07 | api, lathe/test/structure.test.ts | T20 |
| UC04-R08-T01 | UC04-R08 | api, lathe/test/structure.test.ts | T22 |
| UC04-R08-T02 | UC04-R08 | api, lathe/test/flow-steps.test.ts | T30, its part that a link to a missing record is refused once |
| UC04-R09-T01 | UC04-R09 | api, lathe/test/purpose.test.ts | T49, **rewritten** for the unused errors |
| UC04-R09-T02 | UC04-R09 | api, lathe/test/purpose.test.ts | T51, **rewritten** |
| UC04-R11-T01 | UC04-R11 | api, lathe/test/structure.test.ts | T21 |
| UC04-R12-T01 | UC04-R12 | api, not automated yet | **New** |
| UC04-R13-T01 | UC04-R13 | api, not automated yet | **New** |
| UC05-R01-T01 | UC05-R01 | api, lathe/test/product-checks.test.ts | T23 |
| UC05-R01-T02 | UC05-R01 | api, lathe/test/product-checks.test.ts | T25 |
| UC05-R01-T03 | UC05-R01 | api, lathe/test/product-checks.test.ts | T29 |
| UC05-R02-T01 | UC05-R02 | api, lathe/test/product-checks.test.ts | T24 |
| UC05-R03-T01 | UC05-R03 | api, lathe/test/product-checks.test.ts | T26, its "so it never runs" part |
| UC05-R04-T01 | UC05-R04 | api, lathe/test/product-checks.test.ts | T27 |
| UC05-R05-T01 | UC05-R05 | api, lathe/test/product-checks.test.ts | T28 |
| UC06-R01-T01 | UC06-R01 | api, lathe/test/sizes.test.ts | T32 |
| UC06-R01-T02 | UC06-R01 | api, lathe/test/sizes.test.ts | T33 |
| UC06-R01-T03 | UC06-R01 | api, lathe/test/sizes.test.ts | T34 |
| UC06-R01-T04 | UC06-R01 | api, lathe/test/sizes.test.ts | T35 |
| UC06-R01-T05 | UC06-R01 | api, lathe/test/sizes.test.ts | T43 (both size findings are warnings) |
| UC06-R02-T01 | UC06-R02 | api, lathe/test/sizes.test.ts | T36 |
| UC06-R02-T02 | UC06-R02 | api, lathe/test/sizes.test.ts | T37 |
| UC06-R03-T01 | UC06-R03 | api, lathe/test/sizes.test.ts | T39 |
| UC06-R04-T01 | UC06-R04 | api, lathe/test/sizes.test.ts | T41 |
| UC06-R04-T02 | UC06-R04 | api, lathe/test/sizes.test.ts | T42 |
| UC06-R05-T01 | UC06-R05 | api, lathe/test/sizes.test.ts | T47 |
| UC06-R06-T01 | UC06-R06 | api, lathe/test/groups-and-waivers.test.ts | T53 |
| UC06-R07-T01 | UC06-R07 | api, lathe/test/groups-and-waivers.test.ts | T54 |
| UC07-R02-T01 | UC07-R02 | to resolve | LA-PLT-T123, LA-PLT-T128, LA-AUT-T120 prove it today: the sheet that converts them gives this requirement its part, at a level a use case test allows |
| UC08-R01-T01 | UC08-R01 | e2e-api, lathe/test/cli/plugin.test.ts | T55 (its `key` goes; the `it` names the new ID) |
| UC08-R02-T01 | UC08-R02 | e2e-api, lathe/test/cli/plugin.test.ts | T56 |
| UC08-R03-T01 | UC08-R03 | e2e-api, lathe/test/cli/plugin.test.ts | T57 |

IDs in full start `LA-CHK-`.

### View tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| LA-V41-R01-T01 | LA-V41-R01 | unit, app/test/checks-page.test.tsx | T48 |
| LA-V41-R01-T02 | LA-V41-R01 | to resolve | LA-EXP-T76's part |
| LA-V41-R02-T01 | LA-V41-R02 | to resolve | LA-AUT-T113's part |

### Flow, policy, specification, endpoint and integration tests
None exist. No old test walks a whole flow, so each of the seven flows shows as having no flow test.

## Proposed product kinds

| Name | Label | Stage | Parent kind | Obligation | ID pattern | Example | Fields |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `check_row` | Check row | technical-specification | domain | no | `<P>-<D>-CK<nn>` | LA-CHK-CK01 | `check` (text, required: the check's name), `file` (text, required: the file holding the row), `description` (text) |
| `cli_command` | CLI command | interaction-design | domain | no | `<P>-<D>-CLI<nn>` | LA-CHK-CLI01 | `command` (text, required: what is typed), `file` (text: the code that runs it), `description` (text) |
| `plugin_hook` | Plugin hook | technical-specification | integration | no | `<integration>-HK<nn>` | LA-INT41-HK01 | `event` (text, required: such as PreToolUse), `matcher` (text), `file` (text, required), `description` (text) |

And one product relation: `exposes`, from `cli_command` to `command` and to `query` (labels "Exposes" / "Exposed by"), so a step reaches a CLI command through its query, as it reaches an endpoint.

Why: a check row is code kept as data and fits none of the fourteen kinds; a CLI command is an interaction channel like an endpoint, which the plan defines only for HTTP; a plugin hook is a second piece of the Claude Code integration, which may have only one adapter. The alternative to each is to leave the code untraced (as the old components' layer and type were). Other LA sheets may propose the same kinds; the apply step reconciles them.

## Counts

| Kind | Count | Kind | Count |
| --- | --- | --- | --- |
| Domain | 1 | Repository | 2 |
| Aggregate | 2 | Data model | 2 |
| Entity | 2 | Table | 3 |
| Entity field | 10 | Value type | 3 |
| Value object | 3 | Projection | 1 |
| Constraint | 3 | Command handler | 4 |
| Invariant | 5 | Query handler | 3 |
| Specification | 0 | Service | 1 |
| Domain event | 1 | UI component | 1 |
| Event field | 3 | Check row (product kind) | 11 (7 new) |
| Command | 4 | CLI command (product kind) | 1 |
| Read model | 1 | Plugin hook (product kind) | 1 |
| Read model field | 4 | Constraint test | 3 (2 new) |
| Query | 3 | Invariant test | 5 (2 new) |
| Policy | 0 | Domain service test | 1 (new) |
| Domain service | 1 | Use case test | 48 (2 new, 1 to resolve) |
| Term | 9 | View test | 3 (2 to resolve) |
| Capability | 2 | Flow | 7 |
| Use case | 7 | Flow step | 33 |
| UC requirement | 34 (of the old 34: 3 retired, 1 moved; 4 new) | View | 1 |
| View requirement | 2 | Integration | 1 |

60 tests: 50 from 50 of the domain's 56 old tests (T26 splits; T08, T45 and T46 merge into two), 7 new, and 3 whose source is another domain's test.

## Judgment calls and rewrites

1. **Subdomain type supporting.** Lathe's edge is its model and its traceability (LA-AUT, LA-TRC); checking serves them.
2. **A2 becomes Product setting.** What is stored is the product's settings row. Child counts are never stored: the size checks work them out, so EN04 Child count and its five derived fields go.
3. **Problem becomes a read model (RM01),** with QRY01 to QRY03 reading it, because problems are the result of a run, never written by a command.
4. **EV02 Workspace checked is dropped.** Checking changes nothing, so it is a query, and no command raises the event. Its only listener, the old LA-TRC-A1 Coverage, is itself a read model now.
5. **EV01 Check changed is published and raised by three commands,** and its first field becomes the check. Whether LA-PLT's reload hears it, or a generic data-changed event, is LA-PLT's call.
6. **Commands on the check table are the command layer's generic writes.** Their handlers name `store.ts`; LA-PLT's write command may fold them in.
7. **Rules sorted by what they do:** DR03 and DR25 → INV04; DR09 → INV01; DR24 and DR26 → INV03; DR16 → VO43-C01; DR01 → VO42's description and terms TM03, TM04; DR04 and DR10 → DS01 and UC02-R03; DR02 → UC01-R06; DR05, DR07 → UC04-R02; DR06 → UC04-R07, R08; DR08, DR11 → UC05's requirements, which already say them; DR13 → LA-TRC-UC08-R03 (its owed-proof half retires); DR14, DR15, DR17 to DR22 → UC06's requirements, which already say them; DR23 → UC02-R02; DR27 → LA-V41-R02. **Retired:** DR12 (the flow step checks become schema refusals: a step's place and path are unique keys and `step-fulfills-own-use-case` refuses a step fulfilling another use case's requirement), DR28 (a technical record implements its parent and a test proves its parent by the schema; the "nothing uses it" errors take its role for ownerless kinds).
8. **UC07-R01 becomes a view requirement of the Checks page (LA-V41-R01).** It says what a page shows, and the test that proves it is an app test (unit), which a use case test does not allow but a view test does. The same holds for LA-TRC's Reader use cases (la-trc.md, judgment call 6).
9. **Retired checks:** `rule-not-applied` (C04), `interaction-requirement-fulfills-nothing` (C06), `test-type-mismatch` (C07), `component-satisfies-nothing` (C18), `test-proves-nothing` (C19). **New checks** for the plan: the five unused errors, `test-level-not-allowed`, `command-change-recorded`, `event-not-by-outbox`. **Rewritten:** `too-many-children`, `lone-child` (no layers), `use-case-without-flow` (one flow per use case). Names are proposals; brief 108's rows decide them.
10. **Tests stay out of too-many-children,** with a new reason: each sits under the one record it proves, and more of them never calls for a level.
11. **Three product kinds are proposed** (check row, CLI command, plugin hook) and one relation (`exposes`).
12. **Claude Code is an integration (LA-INT41).** The plugin talks to it; its guard hook is a plugin hook under it.
13. **Old tests split and merge by what they prove:** T26 splits (INV01 and UC05-R03); T08 and T45 merge into INV04-T, T45 and T46 into INV03-T; T30 keeps only its refusal part. Dropped: T13, T15 (their checks retire), T40 (layers go), T50 (test-proves-nothing retires). T12 proves LA-AUT-DR22 only and goes to LA-AUT's sheet. T31 goes to LA-TRC-UC08-R03.
14. **Seven new tests are not automated yet:** the two value type constraints, INV02, INV05, DS01's unit test, and UC04-R12 and R13.
15. **The design flow DF01 goes** with its kind. Its steps become UC01-FL's steps (actor level) and the descriptions of QRY01-H and RM01-PJ (the load in one transaction, the file facts, the checks on four connections); its failure and signals tables go into UC01-FL-S02 and S04 and QRY01's description.
16. **No technical record names the layers.** LAY01 to LAY04 go, as layers do.

## Findings in the code
- **The SQL keeps foreign keys into another domain's table.** `check.product_id` and `product_setting.product_id` reference `product`. If Product stays LA-AUT's aggregate, the spec records them as plain IDs and the schema's foreign keys are a cross-domain exception.
- **No code raises EV01.** The server watches every data file and announces `spec:changed`; nothing is specific to checks.
- **The command handlers are generic.** Adding a check is `store.add('check', …)`, the same code as adding any row.
- **The app reads problems from the whole workspace** and filters per product in the page (QRY02-H); there is no product-scoped query in the engine.

## What the plan didn't cover
| Need | Suggestion |
| --- | --- |
| A read model whose rows come from every domain's records. RM01's checks read every table, but `reads` is domain-scoped and domains meet only through published events. | Treat Lathe's store as the shared kernel its checks and coverage read, recorded as one exception per read model, as a command's recorded exception is. |
| A constraint enforced by an SQL CHECK can only be tested at database level, but a constraint test allows unit only. | Allow database for constraint tests, or accept the three warnings. |
| An interaction channel other than HTTP (the CLI, MCP tools) | The `cli_command` product kind and `exposes` relation above |
| A second technical piece of one integration (the hook beside the MCP server) | The `plugin_hook` product kind above |
| Reader use cases whose requirements are all about what a page shows | Their requirements move to view requirements (judgment call 8) |

## Cross-domain links to resolve

| Here | Names | What to resolve |
| --- | --- | --- |
| EN01 field 2, EN03 field 1 | [AUT-A1] Product | the new ID of LA-AUT-A1 |
| EV01 | LA-PLT-A1, LA-PLT-C09, LA-AUT-C46 reacted to it | a LA-PLT policy hearing it, or nothing |
| UC07-FL-S03 | [EXP-V03] Record page | the new view ID |
| UC07-FL-S04 | [AUT-V03] Check page | the new view ID |
| UC08-FL-S02 | [PLT-write] | LA-PLT's write command (LA-PLT-A8) |
| LA-INT41 | the MCP server's integration in LA-AUT's or LA-PLT's sheet | one integration for Claude Code |
| LA-UI41 | LA-EXP-C01, LA-EXP-C31 | one UI component for `ChecksPage` |
| QRY01-H | LA-PLT-C01 Workspace loader | the same `loadWorkspace` |
| QRY03-H | LA-PLT-C53, LA-AUT-C69 | the Dock badge code |
| LA-V41-R01-T02, LA-V41-R02-T01, UC07-R02-T01, UC01-R04 | LA-EXP-T76, LA-AUT-T113, LA-PLT-T123, T128, LA-AUT-T120, LA-AUT-T14 to T17 | each test's part that proves this domain's record |
| INV03 | LA-AUT-T82, T83 proved DR26 | their parts become INV03-T's |
| DR24's second sentence | LA-AUT-UC11 (the reference) | a requirement of the reference |
| C08, C09, C10, C20 | LA-AUT's product_relation table, LA-PLT's store and validation records | where UC04-R06 to R11's refusals are built |
| C11 | LA-AUT-C05's new record (lathe/src/config.ts) | where UC05-R05 is built |
| C17's `referenceOf` | LA-AUT's reference records | the reference |
| T12 (LA-AUT-DR22), T19's LA-AUT-DR23, T52's LA-AUT-DR75, T53's LA-AUT-UC13-R06 | LA-AUT's sheet | their LA-AUT parts |
| LA-EXP-F04, LA-EXP-F04-S05 used CHK-V01 | LA-EXP's steps | they happen in LA-V41 |
| CHK-F03 carried out LA-AUT-UC14 and LA-PLT-UC03, fulfilling LA-AUT-UC14-R03, R05 and LA-PLT-UC03-R01 | LA-AUT's and LA-PLT's flows | their own flows' steps |
| LA-AUT-F03 carried out CHK-UC04, UC06 | LA-AUT's sheet | each now has its own flow here |

## Accounted for

### Records

| Old | Count | Where it went |
| --- | --- | --- |
| domain LA-CHK | 1 | LA-CHK, subdomain supporting, description rewritten |
| aggregate A1 | 1 | A1 Check |
| aggregate A2 | 1 | A2 Product setting (rewritten) |
| entity EN01, EN03 | 2 | EN01, EN03 |
| entity EN02 | 1 | RM01 Problems |
| entity EN04 | 1 | dropped: worked out by CK01 and CK02 |
| entity_field EN01 1–8 | 8 | EN01 fields 1–8 |
| entity_field EN02 1–4 | 4 | RM01 fields 1–4 |
| entity_field EN03 1–2 | 2 | EN03 fields 1–2 |
| entity_field EN04 1–5 | 5 | dropped with EN04 (derived) |
| domain_event EV01 | 1 | EV01, published |
| domain_event EV02 | 1 | dropped (judgment call 4) |
| event_field EV01 1–3 | 3 | EV01 fields, field 1 rewritten |
| event_field EV02 1–5 | 5 | dropped with EV02; its counts are RM01's rows and LA-TRC's coverage |
| domain_rule DR01 | 1 | VO42's description; TM03, TM04 |
| domain_rule DR02 | 1 | UC01-R06 |
| domain_rule DR03 | 1 | INV04 |
| domain_rule DR04 | 1 | UC02-R03; DS01 |
| domain_rule DR05 | 1 | UC04-R02 |
| domain_rule DR06 | 1 | UC04-R07, R08 (already said there) |
| domain_rule DR07 | 1 | UC04-R02 |
| domain_rule DR08 | 1 | UC05-R01 (already said there) |
| domain_rule DR09 | 1 | INV01 |
| domain_rule DR10 | 1 | DS01; UC05-R01 |
| domain_rule DR11 | 1 | UC05-R05 (already said there) |
| domain_rule DR12 | 1 | retired (judgment call 7) |
| domain_rule DR13 | 1 | LA-TRC-UC08-R03; its owed half retired |
| domain_rule DR14 | 1 | UC06-R01 |
| domain_rule DR15 | 1 | UC06-R02; TM08 |
| domain_rule DR16 | 1 | VO43-C01 |
| domain_rule DR17, DR18 | 2 | UC06-R01 |
| domain_rule DR19 | 1 | UC06-R03; TM09 |
| domain_rule DR20, DR21 | 2 | UC06-R04 |
| domain_rule DR22 | 1 | UC06-R01, R03 ("warning") |
| domain_rule DR23 | 1 | UC02-R02 |
| domain_rule DR24 | 1 | INV03; second sentence to LA-AUT-UC11 |
| domain_rule DR25 | 1 | INV04 |
| domain_rule DR26 | 1 | INV03 |
| domain_rule DR27 | 1 | LA-V41-R02 |
| domain_rule DR28 | 1 | retired; UC04-R09 takes its role |
| capability CAP01, CAP02 | 2 | descriptions rewritten |
| use_case UC01, UC02, UC05, UC07, UC08 | 5 | unchanged (UC05's goal names API requirements) |
| use_case UC04, UC06 | 2 | goals rewritten; UC04 retitled |
| use_case_actor | 13 | unchanged |
| requirement UC01-R01, R04 | 2 | rewritten |
| requirement UC01-R02, R03, R05 | 3 | unchanged |
| requirement UC02-R01 | 1 | unchanged |
| requirement UC02-R02 | 1 | rewritten |
| requirement UC04-R01, R03, R10 | 3 | retired |
| requirement UC04-R02, R04, R09, R11 | 4 | rewritten |
| requirement UC04-R06, R07, R08 | 3 | unchanged |
| requirement UC05-R01–R05 | 5 | unchanged |
| requirement UC06-R01, R03, R04, R06, R07 | 5 | rewritten |
| requirement UC06-R02, R05 | 2 | unchanged |
| requirement UC07-R01 | 1 | LA-V41-R01 |
| requirement UC07-R02 | 1 | unchanged |
| requirement UC08-R01–R03 | 3 | unchanged |
| flow F01 | 1 | split: UC01-FL, UC02-FL, UC08-FL; its LA-TRC-UC03 and UC05 parts go to LA-TRC-UC03-FL and UC05-FL |
| flow F02 | 1 | UC05-FL |
| flow F03 | 1 | UC07-FL; its LA-AUT-UC14 and LA-PLT-UC03 parts to resolve |
| design_flow DF01 | 1 | dropped as a kind (judgment call 15) |
| design_step DF01-S01–S08 | 8 | UC01-FL and UC02-FL steps; QRY01-H and RM01-PJ descriptions |
| view CHK-V01 | 1 | LA-V41 |
| layer LAY01–LAY04 | 4 | dropped: layers go |
| component C01 | 1 | LA-CHK-CLI01 |
| component C02 | 1 | the check rows CK01–CK11 here, and each other domain's check rows in its sheet |
| component C04, C06, C07, C18, C19 | 5 | retired with their rows (judgment call 9) |
| component C05 | 1 | CK03 |
| component C08, C09, C10, C20 | 4 | to resolve (LA-AUT's and LA-PLT's store records) |
| component C11 | 1 | to resolve (LA-AUT-C05's new record) |
| component C12 | 1 | RM01-PJ; DS01-SV |
| component C13, C16 | 2 | CK01 |
| component C14 | 1 | CK02 |
| component C15 | 1 | EN03-TB, VO43-VT, A2-REPO, EN03-DM, CMD04-H |
| component C17 | 1 | DS01-SV; `referenceOf` to resolve |
| component C21 | 1 | RM01-PJ (`refusedWorkspace`) |
| component C22 | 1 | A1-REPO; INV01, INV02 |
| component C23 | 1 | EN01-TB, RM01-TB, VO41-VT, VO42-VT, EN01-DM |
| component C24, C25 | 2 | LA-INT41-HK01 |
| test T01–T08, T10, T11, T14, T16–T29, T32–T39, T41–T49, T51–T57 | 49 | the tests above (merges and splits noted in Source) |
| test T12 | 1 | LA-AUT's sheet (proves only LA-AUT-DR22) |
| test T30 | 1 | UC04-R08-T02 (its refusal part); the rest retired with DR12 |
| test T31 | 1 | LA-TRC-UC08-R03-T03 (see la-trc.md) |
| test T13, T15, T40, T50 | 4 | dropped (judgment call 13) |

### Links

| Old link | Rows | Where it went |
| --- | --- | --- |
| has_many EN01→EN02, EN03→EN04 | 2 | dropped: EN02 is RM01, EN04 is derived |
| relates_to CHK-A2→PLT-A1 | 1 | dropped: A2's Product field references the product |
| relates_to PLT-A1→CHK-A1, AUT-A1→CHK-A1 | 2 | to resolve in LA-PLT's and LA-AUT's sheets; EN01's Product field covers AUT-A1's |
| refers_to EN02→PLT-EN01 | 1 | dropped: a read model belongs to its domain |
| raised_by EV01→EN01 | 1 | EV01 raised by CMD01, CMD02, CMD03 |
| raised_by EV02→EN01 | 1 | dropped with EV02 |
| reacts_to PLT-A1, PLT-C09, AUT-C46 → EV01 | 3 | to resolve: a LA-PLT policy, or nothing |
| reacts_to TRC-A1→EV02 | 1 | dropped with EV02 |
| applies CHK-UC→CHK-DR | 24 | dropped: a use case changes nothing; its steps invoke commands and queries |
| applies CHK-UC01→AUT-DR01, DR05, DR06, DR07, DR75 | 5 | dropped, likewise |
| applies AUT-UC06, UC11, UC14 → CHK-DR12, DR24–DR27 | 5 | dropped, likewise |
| carries_out CHK-F01→UC01, UC02, UC08, TRC-UC03, TRC-UC05 | 5 | each use case's own flow (UC01-FL, UC02-FL, UC08-FL; LA-TRC-UC03-FL, UC05-FL) |
| carries_out CHK-F02→UC05 | 1 | UC05-FL's parent |
| carries_out CHK-F03→UC07, AUT-UC14, PLT-UC03 | 3 | UC07-FL's parent; the other two to resolve |
| carries_out AUT-F03→CHK-UC04, UC06 | 2 | UC04-FL, UC06-FL (new) |
| deepens DF01→F01 | 1 | dropped with DF01 |
| fulfills F01→UC08-R01 | 1 | UC08-FL-S03 fulfills it |
| fulfills F03→UC07-R01, CHK-V01→UC07-R01, EXP-V03-R01→UC07-R01 | 3 | dropped: UC07-R01 is LA-V41-R01, under the view |
| fulfills F03→AUT-UC14-R03, R05, PLT-UC03-R01 | 3 | to resolve in their flows |
| fulfills AUT-F04-S03→DR12 | 1 | dropped with DR12 |
| uses DF01-S01–S08 → components | 10 | dropped with DF01 |
| uses F03→AUT-V02, AUT-V03, CHK-V01, EXP-V03, PLT-E01 | 5 | UC07-FL's steps happen in LA-V41, [EXP-V03], [AUT-V03]; the endpoint follows from QRY02 |
| uses CHK-V01→PLT-E01 | 1 | dropped: follows from the steps in the view |
| uses EXP-F04→CHK-V01, EXP-F04-S05→CHK-V01 | 2 | to resolve: LA-EXP's steps happen in LA-V41 |
| implements EXP-C01→CHK-V01, EXP-C31→CHK-V01 | 2 | LA-UI41 renders LA-V41 (to resolve) |
| depends_on (CHK-C ↔ CHK, AUT, PLT components) | 7 | dropped: what a handler uses follows from the tree |
| meets DF01-S05→STD-CODE-R03 | 1 | RM01-PJ meets it |
| satisfies CHK-C→CHK obligations | 83 | replaced by the technical records above (designed, built through what implements each kind) |
| satisfies CHK-C→AUT, PLT, TRC obligations | 6 | dropped; each other domain's obligations are built through its own records |
| satisfies AUT-, EXP-, PLT-C → CHK obligations | 11 | dropped likewise |
| proves CHK-T → CHK records | 79 | each new test's parent (Test plan) |
| proves CHK-T → AUT records (T12, T19, T52, T53) | 4 | LA-AUT's parts, to resolve |
| proves AUT-, EXP-, PLT-T → CHK records | 12 | to resolve: their parts become UC01-R04, UC07-R02, LA-V41-R01, R02 and INV03 tests |
