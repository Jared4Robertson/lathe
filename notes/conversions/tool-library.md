# Conversion: the Tool Library to the new model

The sorting sheet for brief 105, phase A. It lists the Tool Library's complete new spec, kind by kind in the plan's order ([domain-model-refinement.md](../plans/domain-model-refinement.md)), with each row's old source, and closes with a table that accounts for every old record and link.

Phase B wrote these records into `examples/tool-library/data/` through the store's command functions, from a one-time script that isn't committed, and the sheet now matches what was written. The code, tests and README name the new IDs.

## Conventions
- **Source** names the old record (`DR04`, `E04-R02`, `C05` and so on, all `TL-LEND-` unless written in full) or the code (`src/…`, `test/…`).
- **Types** are the schema's basic types (text, whole number, decimal, date, time, date and time, yes/no), a value object (`VO01`…) or a reference to an aggregate (`→ A1`…).
- **Optional** marks a field with `required: false`; every other field is required.
- **New** marks a row with no old record: work the conversion found missing, including five tests no old test proved.

## Product, roles and domain

| ID | Kind | Title | Fields | Source |
| --- | --- | --- | --- | --- |
| TL | Product | Tool Library | description, icon and notes as today | product |
| Librarian | Role | Librarian | | role |
| Member | Role | Member | | role |
| TL-LEND | Domain | Lending | description as today; subdomain type **core**; notes keep the "Example values" section, and the "Language" table moves to terms | domain |

## Domain model

### Aggregates

| ID | Title | Parent | Identity | Source |
| --- | --- | --- | --- | --- |
| TL-LEND-A1 | Member | TL-LEND | Email | A1. Its notes' field table goes: the fields are entity fields. |
| TL-LEND-A2 | Tool | TL-LEND | Tool ID (two drills of the same model are two tools) | A2, likewise |
| TL-LEND-A3 | Loan | TL-LEND | Loan ID | A3, likewise. Its description drops "refers to its Member and Tool by ID": the reference fields say so. |

### Entities

| ID | Title | Parent | Role | Has value objects | Source |
| --- | --- | --- | --- | --- | --- |
| TL-LEND-EN01 | Member | A1 | root | VO01 Name, VO02 Email address | EN01 |
| TL-LEND-EN02 | Tool | A2 | root | VO01 Name, VO03 Condition | EN02 |
| TL-LEND-EN03 | Damage report | A2 | child | VO04 Note | EN03 |
| TL-LEND-EN04 | Loan | A3 | root | (none: its fields are basic types and references) | EN04 |
| TL-LEND-EN05 | Return | A3 | child | VO03 Condition, VO04 Note | EN05 |

"Has value objects" follows from the field types below; it is listed here for reading and not stored. The two children have `in_root_table: true`: Damage report is stored in `tools` and Return in `loans`, so neither has a table of its own. The `has_one` links EN02→EN03 and EN04→EN05 stay.

Fields whose column name differs from the field's name carry `column_name`: Member ID, Tool ID and Loan ID are `id`; Loan's Member and Tool are `member_id` and `tool_id`; Damage report's Note is `damage_note`; Return's Condition and Note are `return_condition` and `return_note`; the Catalog's Tool ID is `id`.

### Entity fields

| Entity | # | Name | Type | Meaning | Example | Source |
| --- | --- | --- | --- | --- | --- | --- |
| EN01 | 1 | Member ID | whole number | The library's number for the member, printed on their card. Assigned. | 12 | EN01 field 1 |
| EN01 | 2 | Name | VO01 Name | What the member is called. | Ada Lovelace | field 2 |
| EN01 | 3 | Email | VO02 Email address | How the library contacts the member. Unique among members (INV01). | ada@example.org | field 3 |
| EN01 | 4 | Joined at | date and time | When the member was registered. | 2026-03-01T15:20:00Z | field 4 |
| EN02 | 1 | Tool ID | whole number | The library's number for the tool, written on its tag. Assigned. | 7 | EN02 field 1 |
| EN02 | 2 | Name | VO01 Name | What the tool is. | Cordless drill | field 2 |
| EN02 | 3 | Description | text | Anything a borrower should know; may be blank. | 18 V, two batteries | field 3 |
| EN02 | 4 | Condition | VO03 Condition | Whether the tool is fit to lend. A new tool starts good. | needs_repair | field 4 |
| EN02 | 5 | Added at | date and time | When the tool joined the catalog. | 2026-02-20T09:00:00Z | field 5 |
| EN03 | 1 | Note | VO04 Note | What is wrong with the tool. | Chuck wobbles | EN03 field 1 |
| EN03 | 2 | Reported at | date and time | When the damage was reported. Not stored by the code (see findings). | 2026-03-10T14:05:00Z | field 2 |
| EN04 | 1 | Loan ID | whole number | The library's number for the loan. Assigned. | 31 | EN04 field 1 |
| EN04 | 2 | Member | → A1 Member | Who borrowed the tool. | 12 | field 2 + refers_to EN04→EN01 + relates_to A3→A1 |
| EN04 | 3 | Tool | → A2 Tool | Which tool was borrowed. | 7 | field 3 + refers_to EN04→EN02 + relates_to A3→A2 |
| EN04 | 4 | Borrowed at | date and time | When the loan started. | 2026-03-02T10:00:00Z | field 4 |
| EN04 | 5 | Due date | date | The last day of the loan, in the library's time zone (INV04). | 2026-03-16 | field 5 |
| EN05 | 1 | Returned at | date and time | When the tool came back. | 2026-03-12T16:30:00Z | EN05 field 1 |
| EN05 | 2 | Condition | VO03 Condition | The tool's condition as the librarian found it. | good | field 2 |
| EN05 | 3 | Note | VO04 Note, optional | What the librarian noticed. A blank note is none. | Cleaned and charged | field 3 |

Derived fields leave the entities, since a table's columns follow from its entity's fields and these are never stored:

| Old field | Goes to |
| --- | --- |
| EN01 Active loans (derived count) | SP03 Member is at the loan limit |
| EN01 Overdue (derived yes or no) | SP02 Member has an overdue loan |
| EN02 Status (derived) | RM01 Catalog, field Status |
| EN04 Overdue (derived) | SP01 Loan is overdue |
| EN05 Late (derived) | EV06 Tool returned, field Late (already there), worked out by SP01 at the moment of return |

### Value objects and constraints

| ID | Kind | Title | Parent | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| TL-VO01 | Value object | Name | (used by EN01, EN02) | What a member or a tool is called. | **New**: the "Text, not blank" of EN01 and EN02 field 2 |
| TL-VO01-C01 | Constraint | A name is trimmed and not blank | VO01 | A name MUST be trimmed of surrounding spaces and MUST NOT be blank. | UC01-R01, UC02-R01, E01-R01, E02-R01 (their "not blank" part) |
| TL-VO02 | Value object | Email address | (used by EN01) | How the library contacts a member. | **New**: the "Email address" type of EN01 field 3 |
| TL-VO02-C01 | Constraint | An email address looks like an address | VO02 | An email address MUST look like `x@y.z`, with no spaces. | E01-R01, UC01-R01 ("not an email address") |
| TL-VO02-C02 | Constraint | An email address is kept trimmed and in lower case | VO02 | An email address MUST be trimmed and kept in lower case, so two spellings of one address are the same address. | DR01's second sentence ("compared without regard to case or surrounding spaces"), EN01 field 3 ("kept in lower case") |
| TL-VO03 | Value object | Condition | (used by EN02, EN05) | Whether a tool is fit to lend. | **New**: the "`good` or `needs_repair`" type |
| TL-VO03-C01 | Constraint | A condition is good or needs repair | VO03 | A condition MUST be either `good` or `needs_repair`. The same two values are used for a tool and for a return. | DR04 (its first and third sentences; "a new tool starts good" goes to CMD02) |
| TL-VO04 | Value object | Note | (used by EN03, EN05) | What a librarian wrote about a tool. | **New**: the note fields of EN03 and EN05 |
| TL-VO04-C01 | Constraint | A note is trimmed and not blank | VO04 | A note MUST be trimmed and MUST NOT be blank. Where a note is optional, a blank one is none. | UC05-R01 ("a note is required"), E06-R01, E05-R01 ("a blank note is stored as none") |

### Invariants

| ID | Title | Parent | Statement | Enforced by | Source |
| --- | --- | --- | --- | --- | --- |
| TL-LEND-INV01 | One member per email | A1 | Two members MUST NOT share an email address (VO02, so compared trimmed and in lower case). | Unique key `members_email` on EN01-TB; CMD01 checks first to give `email_taken` | DR01 |
| TL-LEND-INV02 | A tool needing repair stays so until it is marked repaired | A2 | A tool whose condition is `needs_repair` MUST keep that condition and its damage note until a librarian marks it repaired (CMD04). Nothing else sets it back to `good`: a return recorded as `good` does not clear damage reported during the loan. | CMD06 and PO01 only ever set `needs_repair`; only CMD04 sets `good` | DR11, and DR05's second sentence ("returns to lending only when a librarian marks it repaired") |
| TL-LEND-INV03 | A tool is lent to one member at a time | A3 | No two active loans MAY name the same tool. A tool can be lent again once its loan is returned. | Unique key `loans_one_active_per_tool` on EN04-TB; CMD05 checks first to give `tool_on_loan` | DR06 (moved from A2 to A3: the records that must be unique are loans) |
| TL-LEND-INV04 | A loan is due 14 calendar days after it starts | A3 | A loan's due date MUST be the date it starts plus 14 calendar days, both dates taken in the library's time zone (DS01). The due date is a date, not a time; the loan is due by the end of that day. Example: a loan started at 23:30 on 2 March in New York (04:30 on 3 March in UTC) is due on 16 March. | CMD05, through DS01 | DR07 (the time zone setting's own text goes to DS01) |
| TL-LEND-INV05 | A loan is returned once | A3 | A loan MUST be returned at most once. Once returned, its return MUST NOT change. | CMD06 checks first to give `already_returned`; the repository's update only touches an active loan | DR09 |
| TL-LEND-INV06 | A returned loan records its return | A3 | A returned loan MUST record the time of return and the tool's condition as found by the librarian, and MAY record a note. | CMD06 | DR10 |

### Specifications

| ID | Title | Reads | Statement | Source |
| --- | --- | --- | --- | --- |
| TL-LEND-SP01 | Loan is overdue | A3 | A loan is overdue at a moment when it has not been returned by then and that moment's date, in the library's time zone, is later than its due date. It is never overdue during its due date, up to 23:59 that day in the library's time zone, even when UTC has moved to the next day; it becomes overdue at 00:00 the next day. A return is late when the loan was overdue at the moment of return. | DR08; EV07's "00:00 on the day after"; UC04-R04's definition of late |
| TL-LEND-SP02 | Member has an overdue loan | A1, A3 | A member has an overdue loan when any of their loans is overdue (SP01). There is no grace period and no librarian override. | DR03 |
| TL-LEND-SP03 | Member is at the loan limit | A1, A3 | A member is at the loan limit when they hold 3 active loans. A loan stops counting when it is returned. | DR02 |
| TL-LEND-SP04 | Tool needs repair | A2 | A tool needs repair when its condition is `needs_repair`. | DR05's first sentence; the check in UC05-R02 ("marking a tool in good condition as repaired MUST be refused") |

### Domain events

All are unpublished: the product has one domain.

| ID | Title | Parent | Raised by | Source |
| --- | --- | --- | --- | --- |
| TL-LEND-EV01 | Member registered | A1 | CMD01 | EV01; raised_by EV01→EN01 |
| TL-LEND-EV02 | Tool added | A2 | CMD02 | EV02; raised_by EV02→EN02 |
| TL-LEND-EV03 | Damage reported | A2 | CMD03 | EV03; raised_by EV03→EN03. Its description drops "outside a return": PO01 now raises it on a return needing repair too. |
| TL-LEND-EV04 | Tool repaired | A2 | CMD04 | EV04; raised_by EV04→EN02 |
| TL-LEND-EV05 | Loan opened | A3 | CMD05 | EV05; raised_by EV05→EN04 |
| TL-LEND-EV06 | Tool returned | A3 | CMD06 | EV06; raised_by EV06→EN05 |

EV07 Loan became overdue is dropped: see judgment call 6.

### Event fields

| Event | # | Name | Type | Source |
| --- | --- | --- | --- | --- |
| EV01 | 1 | Member ID | → A1 Member | EV01 field 1 ("Whole number") |
| EV01 | 2 | Name | VO01 Name | field 2 |
| EV01 | 3 | Email | VO02 Email address | field 3 |
| EV01 | 4 | Joined at | date and time | field 4 |
| EV02 | 1 | Tool ID | → A2 Tool | EV02 field 1 |
| EV02 | 2 | Name | VO01 Name | field 2 |
| EV02 | 3 | Description | text | field 3 |
| EV02 | 4 | Added at | date and time | field 4 |
| EV03 | 1 | Tool ID | → A2 Tool | EV03 field 1 |
| EV03 | 2 | Note | VO04 Note | field 2 |
| EV03 | 3 | Reported at | date and time | field 3 |
| EV04 | 1 | Tool ID | → A2 Tool | EV04 field 1 |
| EV04 | 2 | Repaired at | date and time | field 2 |
| EV05 | 1 | Loan ID | → A3 Loan | EV05 field 1 |
| EV05 | 2 | Member | → A1 Member | field 2 |
| EV05 | 3 | Tool | → A2 Tool | field 3 |
| EV05 | 4 | Borrowed at | date and time | field 4 |
| EV05 | 5 | Due date | date | field 5 |
| EV06 | 1 | Loan ID | → A3 Loan | EV06 field 1 |
| EV06 | 2 | Member | → A1 Member | field 2 |
| EV06 | 3 | Tool | → A2 Tool | field 3 |
| EV06 | 4 | Returned at | date and time | field 4 |
| EV06 | 5 | Condition | VO03 Condition | field 5 |
| EV06 | 6 | Note | VO04 Note, optional | field 6 |
| EV06 | 7 | Late | yes/no | field 7; SP01 at the moment of return |

Meanings and examples carry over unchanged.

### Commands

Each command changes one aggregate. Found in the code's services.

| ID | Title | Parent | Raises | Checks | Uses | Source |
| --- | --- | --- | --- | --- | --- | --- |
| TL-LEND-CMD01 | Register a member | A1 | EV01 | (INV01) | | `MemberService.register`; UC01; E01 |
| TL-LEND-CMD02 | Add a tool | A2 | EV02 | | | `ToolService.add`; UC02; E02. Description: a new tool starts in `good` condition (DR04's second sentence). |
| TL-LEND-CMD03 | Report damage | A2 | EV03 | | | `ToolService.reportDamage`; UC05; E06. Description: sets the condition to `needs_repair` with the note and leaves any loan on the tool open. |
| TL-LEND-CMD04 | Mark a tool repaired | A2 | EV04 | SP04 (refuses a tool that doesn't need repair) | | `ToolService.markRepaired`; UC05; E07 |
| TL-LEND-CMD05 | Borrow a tool | A3 | EV05 | SP02, SP03, SP04 (each refuses), and INV03 | DS01 | `LendingService.borrow`; UC03; E04. Description keeps the check order: unknown member, unknown tool, SP02, SP03, SP04, tool on loan, all in one transaction. |
| TL-LEND-CMD06 | Return a tool | A3 | EV06 | SP01 (sets Late), INV05 | DS01 | `LendingService.return`; UC04; E05 |

### Read models and fields

| ID | Title | Parent | Reads | Source |
| --- | --- | --- | --- | --- |
| TL-LEND-RM01 | Catalog | TL-LEND | A2, A3 | **New** as a kind: the old Catalog entry API shape (API02 shape 2), EN02's derived Status, and `CatalogEntry` / `ToolService.entry` in the code |

| Read model | # | Name | Type | Meaning | Source |
| --- | --- | --- | --- | --- | --- |
| RM01 | 1 | Tool ID | → A2 Tool | The tool. | API02 shape 2 / `CatalogEntry.id` |
| RM01 | 2 | Name | VO01 Name | What the tool is. | `name` |
| RM01 | 3 | Description | text | Anything a borrower should know. | `description` |
| RM01 | 4 | Condition | VO03 Condition | Whether the tool is fit to lend. | `condition` |
| RM01 | 5 | Damage note | VO04 Note, optional | What is wrong, while the tool needs repair. | `damageNote` |
| RM01 | 6 | Added at | date and time | When the tool joined the catalog. | `addedAt` |
| RM01 | 7 | Status | text | What a borrower sees: `on_loan` while the tool has an active loan, else `needs_repair` when it needs repair (SP04), else `available`. | EN02 field 6; `toolStatus` |

### Queries

| ID | Title | Parent | Selects by | Source |
| --- | --- | --- | --- | --- |
| TL-LEND-QRY01 | List the catalog | RM01 | (none: it lists every tool, in ID order) | `ToolService.list`; E03 |

### Policies

| ID | Title | Parent (the command it invokes) | Hears | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| TL-LEND-PO01 | A tool returned needing repair is taken out of lending | CMD03 Report damage | EV06 Tool returned | Whenever a tool is returned with the condition `needs_repair`, report damage on it with the return's note as the damage note (or "Returned needing repair." when there is none). A return recorded as `good` invokes nothing (INV02). | UC04-R03; reacts_to A2→EV06 and C05→EV06; the `condition === 'needs_repair'` branch of `LendingService.return` |

### Domain services

| ID | Title | Parent | Used by | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| TL-LEND-DS01 | Library calendar | TL-LEND | CMD05, CMD06 | Counts days in the library's time zone: the date of a moment there, and the date a number of calendar days after another. The time zone is a setting, an IANA name, `America/New_York` unless set; an unknown time zone is refused. | **New** as a kind: DR07's second paragraph, C05's and C07's time zone text; `localDate`, `addDays`, `dueDate`, `assertTimeZone` in `src/model.ts` |

### Terms

| ID | Term | Meaning | Source |
| --- | --- | --- | --- |
| TL-LEND-TM01 | Member | A person registered to borrow tools. | domain notes' Language table |
| TL-LEND-TM02 | Librarian | A volunteer who runs the library: registers members, adds tools, takes returns and records repairs. | same |
| TL-LEND-TM03 | Tool | One physical item in the catalog, such as a particular drill. | same |
| TL-LEND-TM04 | Condition | The state of a tool: `good` or `needs_repair`. | same |
| TL-LEND-TM05 | Loan | One member holding one tool from when it is borrowed until it is returned. | same |
| TL-LEND-TM06 | Active loan | A loan that has not been returned. | same |
| TL-LEND-TM07 | Library time zone | The time zone in which the library counts days. A setting; `America/New_York` unless set. | same |
| TL-LEND-TM08 | Due date | The last day of a loan: 14 calendar days after it starts, in the library's time zone. | same |
| TL-LEND-TM09 | Overdue | An active loan on any day after its due date, in the library's time zone. | same |
| TL-LEND-TM10 | Late | A return made on a day after the loan's due date, in the library's time zone. | **New**: UC04-R04 |
| TL-LEND-TM11 | Catalog | Every tool the library has, each with its status. | **New**: CAP02, V01 |

## Use cases

### Capabilities

| ID | Title | Parent | Source |
| --- | --- | --- | --- |
| TL-LEND-CAP01 | Membership | TL-LEND | CAP01, unchanged |
| TL-LEND-CAP02 | Catalog | TL-LEND | CAP02, unchanged |
| TL-LEND-CAP03 | Lending | TL-LEND | CAP03, unchanged |

### Use cases

Goals, actors, notes, pattern `follows` links and setting values are unchanged.

| ID | Title | Parent | Actors | Follows | Source |
| --- | --- | --- | --- | --- | --- |
| TL-LEND-UC01 | Register a member | CAP01 | Librarian | TL-PAT-LIBRARIAN-ACTION | UC01 |
| TL-LEND-UC02 | Add a tool | CAP02 | Librarian | TL-PAT-LIBRARIAN-ACTION | UC02 |
| TL-LEND-UC03 | Borrow a tool | CAP03 | Member | | UC03 (notes keep the check order) |
| TL-LEND-UC04 | Return a tool | CAP03 | Librarian | TL-PAT-LIBRARIAN-ACTION | UC04 |
| TL-LEND-UC05 | Report damage | CAP02 | Librarian | TL-PAT-LIBRARIAN-ACTION | UC05 |

### UC requirements

All sixteen carry over, as `uc_requirement` rows, with their IDs, titles and statements: TL-LEND-UC01-R01 to R03, UC02-R01 and R02, UC03-R01 to R04, UC04-R01 to R04, UC05-R01 to R03. Two statements drop a rule ID that no longer exists: UC03-R01 "(TL-LEND-DR07)" becomes "(TL-LEND-INV04)", and UC04-R02 and UC05-R03 "(TL-LEND-DR11)" become "(TL-LEND-INV02)".

## Interaction design

### Flows

One per use case, belonging only to it. Old F01 covered two use cases and splits.

| ID | Title | Parent | Source |
| --- | --- | --- | --- |
| TL-LEND-UC01-FL | Register a member | UC01 | F03 (its numbered description becomes the steps) and UC01's use case steps |
| TL-LEND-UC02-FL | Add a tool to the catalog | UC02 | F04, likewise, and UC02's steps |
| TL-LEND-UC03-FL | Borrow a tool | UC03 | F01 steps 1 to 3, and UC03's steps |
| TL-LEND-UC04-FL | Return a tool | UC04 | F01 steps 4 to 6, and UC04's steps |
| TL-LEND-UC05-FL | Damage and repair | UC05 | F02, and UC05's steps |

### Flow steps

Each step invokes at most one command or query and happens in at most one view. The views are designs only (no UI is built), so register and add-a-tool steps happen in none, as today.

| ID | Path | Title | Invokes | In view | Fulfills | Source |
| --- | --- | --- | --- | --- | --- | --- |
| UC01-FL-S01 | main | The librarian enters the person's name and email and registers them | CMD01 | | | F03 step 1; UC01 steps 1–2 |
| UC01-FL-S02 | refused | A blank name, a malformed email or an email already registered is refused, and the librarian is told why | | | UC01-R01, UC01-R02 | F03 step 2 |
| UC01-FL-S03 | main | The library shows the new member with the member ID for their card | | | UC01-R03 | F03 step 3; UC01 step 3 |
| UC02-FL-S01 | main | The librarian enters the tool's name and, optionally, a description, and adds it | CMD02 | | | F04 step 1; UC02 step 1 |
| UC02-FL-S02 | refused | A blank name is refused | | | UC02-R01 | F04 step 1 |
| UC02-FL-S03 | main | The new tool is in good condition, and the Catalog lists it as available | QRY01 | TL-V01 | UC02-R02 | F04 step 2; UC02 step 2; fulfills V01→UC02-R02 |
| UC03-FL-S01 | main | The member opens the catalog | QRY01 | TL-V01 | | F01-S01; UC03 step 1 |
| UC03-FL-S02 | main | The member borrows an available tool | CMD05 | TL-V01 | | F01-S02; UC03 step 2 |
| UC03-FL-S03 | refused | When a check fails, the catalog shows the first failing reason: unknown member or tool, an overdue loan, the loan limit, the tool needing repair or on loan | | TL-V01 | UC03-R02, UC03-R03, UC03-R04 | F01-S02's refusal; UC03 notes |
| UC03-FL-S04 | main | The catalog shows the loan with its due date | | TL-V01 | UC03-R01 | F01-S03; UC03 step 3 |
| UC04-FL-S01 | main | The librarian opens the Return desk, finds the loan and inspects the tool | | TL-V02 | | UC04 step 1 |
| UC04-FL-S02 | main | The librarian records the condition and, optionally, a note | CMD06 | TL-V02 | | F01-S04; UC04 step 2 |
| UC04-FL-S03 | refused | A return with no valid condition, of an unknown loan or of a loan already returned is refused | | TL-V02 | UC04-R01 | F01-S04's refusal |
| UC04-FL-S04 | main | The return desk shows the returned loan and whether it was late | | TL-V02 | UC04-R04 | F01-S05 |
| UC04-FL-S05 | main | The catalog shows the tool as available, or as needing repair | QRY01 | TL-V01 | UC04-R02, UC04-R03 | F01-S06; UC04 step 3 |
| UC05-FL-S01 | main | A librarian marks a damaged tool as needing repair, with a note; a loan on it carries on | CMD03 | TL-V02 | UC05-R01, UC05-R03 | F02-S01; UC05 step 1 |
| UC05-FL-S02 | main | The catalog shows the tool needing repair, and borrowing it is refused | QRY01 | TL-V01 | | F02-S02 (its link to DR05 goes: SP04 is checked by CMD05) |
| UC05-FL-S03 | main | Once fixed, the librarian marks it repaired, and it is available again | CMD04 | TL-V02 | UC05-R02 | F02-S03; UC05 step 2 |

Step IDs are written short; in full they are `TL-LEND-UC01-FL-S01` and so on. Every UC requirement is fulfilled by at least one step of its own use case's flow.

### Views and view requirements

| ID | Title | Description and notes | Source |
| --- | --- | --- | --- |
| TL-V01 | Catalog | As today ("Design only; no UI is built in the example", and its notes) | TL-LEND-V01 |
| TL-V02 | Return desk | As today | TL-LEND-V02 |

No view requirements: the old spec has none, and the views' notes stay notes (judgment call 11).

### Endpoints

Each sits under the command or query it exposes. Numbers stay as they were. The old API shapes fold into the endpoints' descriptions: each names its request body and its response shape, and every one says errors are `{ "error": "<code>", "message": "<sentence>" }`.

| ID | Title | Parent | Method and route | Source |
| --- | --- | --- | --- | --- |
| TL-LEND-EP01 | Register a member | CMD01 | POST `/members` | E01; API01's Member and Error shapes |
| TL-LEND-EP02 | Add a tool | CMD02 | POST `/tools` | E02; API02's Catalog entry and Error shapes |
| TL-LEND-EP03 | List the catalog | QRY01 | GET `/tools` | E03; API02's Catalog entry shape |
| TL-LEND-EP04 | Borrow a tool | CMD05 | POST `/loans` | E04; API03's Loan and Error shapes |
| TL-LEND-EP05 | Return a tool | CMD06 | POST `/loans/{loanId}/return` | E05; API03's Loan and Error shapes |
| TL-LEND-EP06 | Report damage to a tool | CMD03 | POST `/tools/{toolId}/damage` | E06; API02's shapes |
| TL-LEND-EP07 | Mark a tool repaired | CMD04 | POST `/tools/{toolId}/repair` | E07; API02's shapes |

### API requirements

All nineteen interaction requirements become API requirements under their endpoint, with titles and statements unchanged: `TL-LEND-E0n-R0m` becomes `TL-LEND-EP0n-R0m`.

| New | Old | New | Old |
| --- | --- | --- | --- |
| EP01-R01, R02, R03 | E01-R01, R02, R03 | EP05-R01, R02, R03 | E05-R01, R02, R03 |
| EP02-R01, R02 | E02-R01, R02 | EP06-R01, R02, R03 | E06-R01, R02, R03 |
| EP03-R01 | E03-R01 | EP07-R01, R02 | E07-R01, R02 |
| EP04-R01 to R05 | E04-R01 to R05 | | |

EP06-R03, the 64 KB body limit, stays under EP06 and keeps its sentence that the limit holds for every endpoint's body (judgment call 12).

### Integrations
None. The Tool Library talks to no outside system.

## Technical specification

Each record names one file. Technical kinds with no code are left out and show as not built: event types (the code raises no events), projections (the catalog is worked out on each request), adapters and UI components.

| ID | Kind | Implements | File | What in the file | Source |
| --- | --- | --- | --- | --- | --- |
| TL-LEND-A1-REPO | Repository | A1 | src/store.ts | `insertMember`, `findMember`, `findMemberByEmail` | C02 |
| TL-LEND-A2-REPO | Repository | A2 | src/store.ts | `insertTool`, `findTool`, `listTools`, `setToolCondition` | C02 |
| TL-LEND-A3-REPO | Repository | A3 | src/store.ts | `insertLoan`, `findLoan`, `activeLoansForMember`, `activeLoanForTool`, `markReturned`, `transaction` | C02 |
| TL-LEND-EN01-DM | Data model | EN01 | src/model.ts | `Member`; mapped by `toMember` in store.ts | C01 |
| TL-LEND-EN02-DM | Data model | EN02 | src/model.ts | `Tool`; `toTool` | C01 |
| TL-LEND-EN03-DM | Data model | EN03 | src/model.ts | `Tool.damageNote` (a child stored on its root) | C01 |
| TL-LEND-EN04-DM | Data model | EN04 | src/model.ts | `Loan`; `toLoan` | C01 |
| TL-LEND-EN05-DM | Data model | EN05 | src/model.ts | `Loan.returnedAt`, `returnCondition`, `returnNote` | C01 |
| TL-LEND-EN01-TB | Table | EN01 | src/store.ts | `members` | C02 |
| TL-LEND-EN02-TB | Table | EN02 | src/store.ts | `tools` | C02 |
| TL-LEND-EN04-TB | Table | EN04 | src/store.ts | `loans` | C02 |
| TL-VO01-VT | Value type | VO01 | src/model.ts | `parseName`, extracted from the two services | C03, C04 (judgment call 9) |
| TL-VO02-VT | Value type | VO02 | src/model.ts | `parseEmail`, extracted from `MemberService` | C03 |
| TL-VO03-VT | Value type | VO03 | src/model.ts | `Condition`, `CONDITIONS`, `isCondition` | C01 |
| TL-VO04-VT | Value type | VO04 | src/model.ts | `parseNote`, extracted from `ToolService` and `LendingService` | C04, C05 |
| TL-LEND-SP01-PR | Predicate | SP01 | src/model.ts | `isOverdue`, `isLate` | C01 |
| TL-LEND-SP02-PR | Predicate | SP02 | src/model.ts | `hasOverdueLoan`, extracted from `LendingService.borrow` | C05 |
| TL-LEND-SP03-PR | Predicate | SP03 | src/model.ts | `atLoanLimit`, extracted from `borrow`, with `MAX_ACTIVE_LOANS` | C01, C05 |
| TL-LEND-SP04-PR | Predicate | SP04 | src/model.ts | `needsRepair`, extracted from `borrow`, `markRepaired` and `toolStatus` | C01, C04, C05 |
| TL-LEND-DS01-SV | Service | DS01 | src/model.ts | `localDate`, `addDays`, `dueDate`, `assertTimeZone`, `DEFAULT_TIME_ZONE`, `LOAN_DAYS` | C01 |
| TL-LEND-CMD01-H | Command handler | CMD01 | src/member-service.ts | `MemberService.register` | C03 |
| TL-LEND-CMD02-H | Command handler | CMD02 | src/tool-service.ts | `ToolService.add` | C04 |
| TL-LEND-CMD03-H | Command handler | CMD03 | src/tool-service.ts | `ToolService.reportDamage` | C04 |
| TL-LEND-CMD04-H | Command handler | CMD04 | src/tool-service.ts | `ToolService.markRepaired` | C04 |
| TL-LEND-CMD05-H | Command handler | CMD05 | src/lending-service.ts | `LendingService.borrow` | C05 |
| TL-LEND-CMD06-H | Command handler | CMD06 | src/lending-service.ts | `LendingService.return` | C05 |
| TL-LEND-QRY01-H | Query handler | QRY01 | src/tool-service.ts | `ToolService.list`, `entry` | C04 |
| TL-LEND-PO01-H | Event handler | PO01 | src/lending-service.ts | the `needs_repair` branch of `LendingService.return` (inline, in the command's transaction) | C05; reacts_to C05→EV06 |
| TL-LEND-EP01-H … EP07-H | Endpoint handler (7) | EP01 … EP07 | src/router.ts | each route in `createRouter`; EP06-H also `readBody`, `MAX_BODY_BYTES`, `sendAndClose` (shared by every route) | C06; implements C06→E01…E07 |
| TL-LEND-ENTRY01 | Entry point (product kind) | TL-LEND | src/server.ts | the start-up: port, database, `TIME_ZONE` checked at start | C07 (judgment call 10) |

### Tables and keys

All three have storage `table` and name `src/store.ts`. Columns follow from the fields, with `column_name` where they differ.

| Table | Name | Key | Kind | Columns | Target or invariant |
| --- | --- | --- | --- | --- | --- |
| EN01-TB | members | (primary) | primary | id | |
| EN01-TB | members | members_email | unique | email | INV01 |
| EN02-TB | tools | (primary) | primary | id | |
| EN04-TB | loans | (primary) | primary | id | |
| EN04-TB | loans | (member) | foreign | member_id | EN01-TB |
| EN04-TB | loans | (tool) | foreign | tool_id | EN02-TB |
| EN04-TB | loans | loans_one_active_per_tool | unique, condition `returned_at IS NULL` | tool_id | INV03 |

`tools` also holds EN03's note as `damage_note`, and `loans` holds EN05's fields as `returned_at`, `return_condition` and `return_note`. The code's CHECKs, on the condition values and the due date's shape, back up VO03-C01 and the `date` type; tables don't record CHECKs, so the tables' descriptions mention them.

RM01 Catalog has no table: the code has neither a view nor a projection. It shows as not built.

## Test plan

Every test names one parent and a run by. Levels: the `domain-rules.test.ts` tests that use the services and in-memory SQLite are **database**; those that call pure functions only are **unit**; `api.test.ts` and `body-limit.test.ts` run over HTTP on a local port, **api**. When one old test splits, phase B splits its `it` into one `it` per new record, each name starting with its record's ID.

### Constraint tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| TL-VO01-C01-T | VO01-C01 | unit, automated, test/domain-rules.test.ts | **New** (proved before only through the API, by T11 and T14) |
| TL-VO02-C01-T | VO02-C01 | unit, automated, test/domain-rules.test.ts | **New** (T11, through the API) |
| TL-VO02-C02-T | VO02-C02 | unit, automated, test/domain-rules.test.ts | **New** (T01 and T13 showed it only in passing) |
| TL-VO03-C01-T | VO03-C01 | database, automated, test/domain-rules.test.ts | T04 |
| TL-VO04-C01-T | VO04-C01 | unit, automated, test/domain-rules.test.ts | **New** (T24, through the API) |

### Invariant tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| TL-LEND-INV01-T | INV01 | database, test/domain-rules.test.ts | T01 |
| TL-LEND-INV02-T | INV02 | database, test/domain-rules.test.ts | T27 |
| TL-LEND-INV03-T | INV03 | database, test/domain-rules.test.ts | T06 |
| TL-LEND-INV04-T | INV04 | database, test/domain-rules.test.ts | T07, its first part: the loan starts at the clock time, is due 14 days later, and the store refuses a due date that isn't a date |
| TL-LEND-INV05-T | INV05 | database, test/domain-rules.test.ts | T09 |
| TL-LEND-INV06-T | INV06 | database, test/domain-rules.test.ts | T10 |

### Specification, policy and domain service tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| TL-LEND-SP01-T | SP01 | unit, test/domain-rules.test.ts | T08 |
| TL-LEND-SP02-T | SP02 | database, test/domain-rules.test.ts | T03 |
| TL-LEND-SP03-T | SP03 | database, test/domain-rules.test.ts | T02 |
| TL-LEND-SP04-T | SP04 | database, test/domain-rules.test.ts | T05 (the test named `TL-LEND-DR05`) |
| TL-LEND-PO01-T | PO01 | api, test/api.test.ts | T22, its first part: after a return needing repair, the catalog shows the tool `needs_repair` with the return note |
| TL-LEND-DS01-T01 | DS01 | unit, test/domain-rules.test.ts | T07, its second part: New York dates when UTC is on the next day, across a year end, Auckland, and an unknown time zone refused |

### Use case tests

All api, automated, test/api.test.ts.

| ID | Parent | Source | ID | Parent | Source |
| --- | --- | --- | --- | --- | --- |
| UC01-R01-T01 | UC01-R01 | T11 | UC03-R04-T01 | UC03-R04 | T19 |
| UC01-R02-T01 | UC01-R02 | T12 | UC04-R01-T01 | UC04-R01 | T20 |
| UC01-R03-T01 | UC01-R03 | T13 | UC04-R02-T01 | UC04-R02 | T21 |
| UC02-R01-T01 | UC02-R01 | T14 | UC04-R02-T02 | UC04-R02 | T26, its last part: after a good return the tool still needs repair |
| UC02-R02-T01 | UC02-R02 | T15 | UC04-R03-T01 | UC04-R03 | T22, its second part: borrowing it is refused |
| UC03-R01-T01 | UC03-R01 | T16 | UC04-R04-T01 | UC04-R04 | T23 |
| UC03-R02-T01 | UC03-R02 | T17 | UC05-R01-T01 | UC05-R01 | T24 |
| UC03-R03-T01 | UC03-R03 | T18 | UC05-R02-T01 | UC05-R02 | T25 |
| | | | UC05-R03-T01 | UC05-R03 | T26, its first part: the loan carries on and can be returned |

IDs in full start `TL-LEND-`.

### Endpoint tests

All api, automated, test/api.test.ts unless named.

| ID | Parent | Source | ID | Parent | Source |
| --- | --- | --- | --- | --- | --- |
| EP01-R01-T01 | EP01-R01 | T11 | EP04-R04-T01 | EP04-R04 | T31 |
| EP01-R02-T01 | EP01-R02 | T12 | EP04-R05-T01 | EP04-R05 | T16 |
| EP01-R03-T01 | EP01-R03 | T13 | EP05-R01-T01 | EP05-R01 | T20 (its "unknown loan gives 404" moves to EP05-R02-T01) |
| EP02-R01-T01 | EP02-R01 | T14 | EP05-R02-T01 | EP05-R02 | T32 |
| EP02-R02-T01 | EP02-R02 | T15 | EP05-R03-T01 | EP05-R03 | T23 |
| EP03-R01-T01 | EP03-R01 | T15 (the catalog lists the new tool) | EP06-R01-T01 | EP06-R01 | T24 |
| EP03-R01-T02 | EP03-R01 | T21 (status `on_loan`, then `available`) | EP06-R02-T01 | EP06-R02 | T24 |
| EP04-R01-T01 | EP04-R01 | T19 | EP06-R02-T02 | EP06-R02 | T26 (status stays `on_loan`) |
| EP04-R01-T02 | EP04-R01 | T28 | EP06-R03-T01 | EP06-R03 | T30, test/body-limit.test.ts |
| EP04-R02-T01 | EP04-R02 | T18 | EP07-R01-T01 | EP07-R01 | T25 |
| EP04-R03-T01 | EP04-R03 | T17 | EP07-R02-T01 | EP07-R02 | T25 |

### Flow tests

T29, the manual smoke test of the README's curl steps, splits by the flow each step walks. Each is manual, with T29's reason: it checks what a newcomer meets, the real entry point (`npm start`), the documented port and the README's commands as written.

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| TL-LEND-UC01-FL-T | UC01-FL | manual | T29: start the server, register a member, and stop the server cleanly at the end |
| TL-LEND-UC02-FL-T | UC02-FL | manual | T29: add a tool |
| TL-LEND-UC03-FL-T | UC03-FL | manual | T29: borrow it |
| TL-LEND-UC04-FL-T | UC04-FL | manual | T29: return it |
| TL-LEND-UC05-FL-T | UC05-FL | manual | **New**: the README's fifth and sixth curl steps, report damage and mark repaired |

### Pattern rule tests

The plan leaves open what proves a pattern rule (its open question 1). These follow its recommendation, a pattern rule test under the pattern rule that names the domain it proves the rule in, and wait for the schema to say so.

| ID | Parent | In domain | Run by | Source |
| --- | --- | --- | --- | --- |
| TL-PAT-LIBRARIAN-ACTION-R01-T01 | TL-PAT-LIBRARIAN-ACTION-R01 | TL-LEND | api, test/api.test.ts | T33 |
| TL-PAT-LIBRARIAN-ACTION-R02-T01 | TL-PAT-LIBRARIAN-ACTION-R02 | TL-LEND | api, test/api.test.ts | T34, its record-saved parts |
| TL-PAT-LIBRARIAN-ACTION-R03-T01 | TL-PAT-LIBRARIAN-ACTION-R03 | TL-LEND | api, test/api.test.ts | T34, its tool-reads-the-same-in-the-catalog parts |

### Patterns
TL-PAT-LIBRARIAN-ACTION, its three rules, three settings and twelve setting values, and the four `follows` links, carry over unchanged. The pattern's notes drop the sentence about components saying with `satisfies` which code carries out each rule.

## Counts

| Kind | Count | Kind | Count |
| --- | --- | --- | --- |
| Product | 1 | Repository | 3 |
| Role | 2 | Data model | 5 |
| Domain | 1 | Table | 3 |
| Aggregate | 3 | Value type | 4 |
| Entity | 5 | Predicate | 4 |
| Entity field | 19 | Event type | 0 |
| Value object | 4 | Projection | 0 |
| Constraint | 5 | Command handler | 6 |
| Invariant | 6 | Query handler | 1 |
| Specification | 4 | Event handler | 1 |
| Domain event | 6 | Service | 1 |
| Event field | 25 | Endpoint handler | 7 |
| Command | 6 | Adapter | 0 |
| Read model | 1 | UI component | 0 |
| Read model field | 7 | Entry point (product kind) | 1 |
| Query | 1 | Constraint test | 5 (4 new) |
| Policy | 1 | Invariant test | 6 |
| Domain service | 1 | Specification test | 4 |
| Term | 11 | Policy test | 1 |
| Capability | 3 | Domain service test | 1 |
| Use case | 5 | Use case test | 17 |
| UC requirement | 16 | View test | 0 |
| Flow | 5 | Endpoint test | 22 |
| Flow step | 18 | Flow test | 5 (1 new) |
| View | 2 | Integration test | 0 |
| View requirement | 0 | Pattern rule test | 3 |
| Endpoint | 7 | Pattern, rules, settings | 1, 3, 3 |
| API requirement | 19 | Integration | 0 |

64 tests in all: 59 from the 34 old tests, and 5 new. 59 are automated; the 5 flow tests are manual.

## Judgment calls

1. **Subdomain type core.** Lending is the whole product, so it is its edge.
2. **Rules sorted by what they do.** Value formats became constraints (DR04's values, and the name, email and note formats that sat only in requirements). Uniqueness and lifecycle rules of one aggregate became invariants (DR01, DR06, DR07, DR09, DR10, DR11). Yes-or-no checks a command makes became specifications (DR02, DR03, DR05, DR08). The one reaction became a policy (UC04-R03's effect on the tool).
3. **DR06 moves from Tool to Loan.** The records that must be unique are active loans, and the unique key is on `loans`.
4. **DR11 is an invariant of Tool,** "needs repair until marked repaired", merged with DR05's second sentence, since both say only CMD04 clears damage.
5. **A return's effect on the tool is a policy (PO01),** because a command changes one aggregate: Return a tool changes the Loan, and the Tool follows through EV06. The code does both in one transaction; PO01-H names that branch.
6. **EV07 Loan became overdue is dropped.** No command raises it, the code never raises it, and nothing hears it in the new model: a member's block is SP02, worked out from the loans when they borrow. Its rule (00:00 the next day) lives in SP01. Were it needed, it would be raised by a command that a schedule invokes.
7. **Late is SP01 at the moment of return,** a field of EV06, not a field of the Return entity: the code works it out on return and never stores it.
8. **Derived entity fields leave the entities** (Active loans, Overdue, Status, Late) for the specifications, the read model and the event field, because a table's columns follow from its entity's fields.
9. **Phase B extracted small functions into `src/model.ts`** (`parseName`, `parseEmail`, `parseNote`, `hasOverdueLoan`, `atLoanLimit`, `needsRepair`), so each value type and predicate names one real unit. No behavior changed. Without this, VO01, VO02, VO04, SP02, SP03 and SP04 would show as not built. Approved by the coordinator.
10. **`src/server.ts` becomes a product kind, Entry point** (`TL-LEND-ENTRY01`, technical stage, under the domain), as decision 18 provides, because no technical kind fits a start-up file. The alternative is to drop C07 and leave server.ts untraced.
11. **No view requirements.** The old views have none, and their notes stay notes. Promoting the notes (status badges, "Due back by" with no time, a condition with no default) to view requirements would owe view tests for a UI that isn't built.
12. **The body limit stays EP06-R03,** under the endpoint whose free text motivated it, with its sentence that it holds for every endpoint.
13. **Old tests split by what they prove,** and phase B splits the `it` blocks to match. T21 no longer counts as proof of E05-R03 (it only checks status); T23's split proves EP05-R03. T22 drops its proof of E03-R01, which T15 and T21 already give.
14. **T29 splits into four manual flow tests,** one per flow its curl steps walk. Its old proof of four API requirements is dropped, since automated endpoint tests prove each.
15. **Five new tests:** four constraint unit tests, and the UC05 flow's manual test with two curl steps added to the README. Approved by the coordinator.
16. **Child entities keep their own data model records naming `src/model.ts`,** where their fields sit on the root's interface, and are stored in their root's table (`in_root_table`).
17. **Every timestamp is `date and time`.**
18. **Status is `text`, not a value object.** A value object must be used by an entity, and Status belongs only to the read model.
19. **Terms Late and Catalog are added** to the nine terms of the old Language table, because use cases and views use them.
20. **QRY01 selects by no specification.** Its Status uses SP04, but it lists every tool rather than filtering by it.

## Findings in the code
- **No event code at all.** The services change state directly; there are no event types or handlers by name. All six events show as not built.
- **Damage report's "Reported at" isn't stored.** `tools` has `damage_note` but no time; EV03's Reported at likewise.
- **The catalog has no storage of its own.** `ToolService.entry` asks for each tool's active loan on every request (one query per tool).
- **SP04 was checked in three places** (`toolStatus`, `borrow`, `markRepaired`), and the name, email and note checks were inline in the services. Phase B gathered them into named functions in `src/model.ts` (judgment call 9).
- **PO01 runs in the Return command's transaction,** across two aggregates. That's the code's choice, and it keeps a return and its damage together; the model records it as a policy.

## What phase A found the plan missing
The schema step took most of these in; the rest are the engine's.

| Need | Now |
| --- | --- |
| A date with a time of day | The basic type `date and time`, used for every timestamp |
| A child entity stored in its root's table | `entity.in_root_table`, set on Damage report and Return |
| Column names that differ from field names | `column_name` on fields |
| Partial unique keys | `table_key.condition`, on `loans_one_active_per_tool` |
| Optional fields | `required` on fields |
| Events raised when time passes | A command a schedule invokes; not needed, since EV07 is dropped |
| What implements an invariant | Left to the engine step |
| Pattern rule tests | The `pattern_rule_test` kind, with its domain |
| Product kinds in the technical stage | `product_kind.stage`, used for `entry_point` |
| Value object fields | `value_object_field`; not needed here, as every value object is one value |

## Accounted for

### Records

| Old | Count | Where it went |
| --- | --- | --- |
| product TL | 1 | TL |
| role Librarian, Member | 2 | unchanged |
| domain TL-LEND | 1 | TL-LEND, subdomain core; its Language table → TM01–TM09 |
| aggregate A1–A3 | 3 | A1–A3; their notes' field tables dropped (the entity fields hold them) |
| entity EN01–EN05 | 5 | EN01–EN05 |
| entity_field | 24 | 19 entity fields; 5 derived fields moved (table above) |
| domain_event EV01–EV06 | 6 | EV01–EV06 |
| domain_event EV07 | 1 | dropped (judgment call 6); its overdue moment → SP01 |
| event_field | 30 | 25 event fields (EV01–EV06); EV07's 5 dropped with it |
| domain_rule DR01 | 1 | INV01; its case rule → VO02-C02 |
| domain_rule DR02 | 1 | SP03 |
| domain_rule DR03 | 1 | SP02 |
| domain_rule DR04 | 1 | VO03-C01; "a new tool starts good" → CMD02 |
| domain_rule DR05 | 1 | SP04; its second sentence → INV02 |
| domain_rule DR06 | 1 | INV03 |
| domain_rule DR07 | 1 | INV04; its time zone setting → DS01 |
| domain_rule DR08 | 1 | SP01 |
| domain_rule DR09 | 1 | INV05 |
| domain_rule DR10 | 1 | INV06 |
| domain_rule DR11 | 1 | INV02 |
| capability CAP01–CAP03 | 3 | unchanged |
| use_case UC01–UC05 | 5 | unchanged |
| use_case_actor | 5 | unchanged |
| use_case_step | 13 | folded into the flow steps (Source column above); the kind goes |
| requirement UC0n-R0m | 16 | unchanged; three statements' rule IDs updated |
| flow F01 | 1 | split into UC03-FL and UC04-FL |
| flow F02, F03, F04 | 3 | UC05-FL, UC01-FL, UC02-FL; F03's and F04's numbered descriptions → steps |
| flow_step F01-S01–S06, F02-S01–S03 | 9 | 18 steps (table above) |
| view V01, V02 | 2 | TL-V01, TL-V02 |
| api API01–API03 | 3 | dropped: the API grouping goes (decision 15); routes are on the endpoints |
| api_shape | 7 | folded into endpoint descriptions; Catalog entry also → RM01's fields |
| endpoint E01–E07 | 7 | EP01–EP07 |
| interaction_requirement E0n-R0m | 19 | API requirements EP0n-R0m |
| layer LAY01–LAY03 | 3 | dropped: layers go (plan, "Changes to existing specs") |
| component C01 | 1 | EN01–EN05-DM, VO03-VT, SP01-PR, SP03-PR's constant, SP04-PR, DS01-SV, and the new VO01/02/04-VT and SP02-PR in the same file |
| component C02 | 1 | A1–A3-REPO, EN01-, EN02-, EN04-TB |
| component C03 | 1 | CMD01-H |
| component C04 | 1 | CMD02-H, CMD03-H, CMD04-H, QRY01-H |
| component C05 | 1 | CMD05-H, CMD06-H, PO01-H |
| component C06 | 1 | EP01-H to EP07-H |
| component C07 | 1 | TL-LEND-ENTRY01 (judgment call 10) |
| pattern, pattern_rule, pattern_setting, setting_value | 1, 3, 3, 12 | unchanged |
| test T01–T34 | 34 | 59 test records (Test plan above); 5 more are new |

### Links

| Old link | Rows | Where it went |
| --- | --- | --- |
| has_one EN02→EN03, EN04→EN05 | 2 | unchanged |
| relates_to A3→A1, A3→A2 | 2 | EN04's reference fields Member → A1, Tool → A2 (decision 7) |
| refers_to EN04→EN01, EN04→EN02 | 2 | the same reference fields |
| raised_by EV→EN | 7 | events raised by commands (Domain events above); EV07's row dropped with it |
| reacts_to A1→EV05, EV06, EV07 | 3 | dropped: a member's loan count and overdue state are SP03 and SP02, worked out from the loans |
| reacts_to A2→EV05 | 1 | dropped: a tool's on-loan status is RM01's Status |
| reacts_to A2→EV06 | 1 | PO01 hears EV06 |
| reacts_to C05→EV06 | 1 | PO01-H |
| applies UC→DR | 15 | dropped: a use case changes nothing; its steps invoke commands, which check the specifications and keep their aggregate's invariants |
| follows UC→pattern | 4 | unchanged |
| carries_out F→UC | 5 | each flow's parent; F01's two rows → UC03-FL and UC04-FL |
| fulfills step→UC requirement | 10 | the new steps' fulfills (table above) |
| fulfills step→rule (F02-S02→DR05) | 1 | dropped: SP04 is checked by CMD05; steps fulfill only UC requirements |
| fulfills flow→UC requirement (F03, F04) | 5 | moved to their steps: UC01-FL-S02/S03, UC02-FL-S02/S03 |
| fulfills view→UC requirement | 8 | dropped: the steps fulfilling them happen in the view |
| fulfills endpoint→UC requirement | 18 | dropped: a step reaches an endpoint through its command or query |
| fulfills interaction requirement→UC requirement | 23 | dropped: an API requirement sits under its endpoint, under the command a step invokes |
| fulfills interaction requirement→rule | 10 | dropped: the endpoint's command checks the specification or keeps the invariant |
| uses flow→endpoint, flow→view | 14 | dropped: they follow from the flow's steps |
| uses step→endpoint | 7 | the step invokes that endpoint's command or query |
| uses step→view | 9 | the step happens in that view |
| uses view→endpoint | 5 | dropped: they follow from the steps in the view |
| implements C06→E0n | 7 | EP0n-H under each endpoint |
| depends_on | 14 | dropped: handlers using their repositories and data models follow from the tree |
| satisfies component→rule, interaction requirement, UC requirement | 72 | replaced by the technical record implementing each obligation's design kind |
| satisfies component→pattern rule | 5 | dropped: pattern rules need proof only; the code's comments keep naming them |
| proves test→rule, requirement, pattern rule | 59 | each new test's parent (Test plan above) |
