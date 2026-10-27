# Conversion: LA-TRC Traceability to the new model

The sorting sheet for brief 107, domain LA-TRC. It lists Traceability's complete new spec, kind by kind in the plan's order ([domain-model-refinement.md](../plans/domain-model-refinement.md)), with each row's old source, and closes with a table that accounts for every old record and link of the domain. It follows the Tool Library sheet ([tool-library.md](tool-library.md)) and shares its conventions, product kinds and provisional numbering with [la-chk.md](la-chk.md).

It describes Traceability as the plan makes it. Coverage is reworked for the new obligations: **designed** through flow steps and the technical records that implement each design kind, **built** through those records' files, **proved** through the test kinds, each test under the one record it proves. What served the old many-to-many proof retires: the `proves` and `supports` links, proof claims and their backing in files, keys and key files, the `planned` state's owed proof (`planned_any`, `proof-still-owed`), proof-only obligation kinds and pattern rules fulfilled by flows. Every such rewrite is marked **Rewritten** or **Retired** and listed again under Judgment calls.

## Conventions
As in [la-chk.md](la-chk.md): **Source** names the old record (all `LA-TRC-` unless written in full); `[XXX-…]` stands for the new ID of another domain's old record; **New** marks a row with no old record. Product-scoped numbers here take the block 51–59 (`LA-V51`, `LA-UI51`…), provisional. View requirements this sheet writes under LA-EXP's views are numbered from R51, so they don't clash with LA-EXP's own (`[EXP-V02]-R51` is the Domain page's).

## Domain

| ID | Kind | Title | Fields | Source |
| --- | --- | --- | --- | --- |
| LA-TRC | Domain | Traceability | subdomain type **core**; description rewritten (below) | domain |

Description: "Following what designs, builds and proves each obligation, and counting it: coverage per domain and obligation kind, designed through flow steps and the technical records that implement each design, built through their files and proved through the tests under each obligation; the gaps, each domain's tests by state, the pattern rules each domain owes, and each record's traceability. The engine counts it, and the app shows it on the product and domain pages and in each record's Traceability section." **Rewritten:** the old one named links both ways, proof still owed and "the evidence a test's file gives for what it claims".

## Domain model

### Aggregates

| ID | Title | Parent | Identity | Source |
| --- | --- | --- | --- | --- |
| LA-TRC-A3 | Pattern following | LA-TRC | Follower and pattern | A3, number kept. Description **rewritten**: "A domain or use case that follows a pattern, and the value it gives each of the pattern's settings. Which rules each domain owes because of it is worked out (RM04), never stored." |

A1 Coverage becomes read models RM01 to RM03, since every count is worked out on each load and nothing writes it. A2 Proof claim is retired: a test proves exactly its parent, so there is no claim to back (judgment call 3).

### Entities

| ID | Title | Parent | Role | In root table | Source |
| --- | --- | --- | --- | --- | --- |
| LA-TRC-EN05 | Pattern following | A3 | root | | EN05 |
| LA-TRC-EN06 | Setting value | A3 | child | no: its own table, `setting_value` | EN06; has_many EN05→EN06 stays |

EN01 Domain coverage, EN02 Obligation count and EN03 Gap become RM03, RM01 and RM02. EN04 Proof claim is retired with A2, its file facts going to RM05. EN07 Owed pattern rule becomes RM04.

### Entity fields

| Entity | # | Name | Type | Meaning | Example | Source |
| --- | --- | --- | --- | --- | --- | --- |
| EN05 | 1 | Follower | text (`source_id`) | The ID of the domain or use case that follows the pattern. | TL-LEND-UC01 | EN05 field 1 |
| EN05 | 2 | Pattern | → [AUT-A5] Pattern (`target_id`) | The pattern followed. | TL-PAT-LIBRARIAN-ACTION | field 2 |
| EN06 | 1 | Setting | text | One of the pattern's settings (a `pattern_setting` name). | required_input | EN06 field 1 |
| EN06 | 2 | Value | text, optional | What the setting is for this follower. | The member's name and a valid email address. | field 2, its value half |
| EN06 | 3 | Not applicable reason | text, optional (`not_applicable`) | Why the setting does not apply to this follower, in place of a value. | Nothing is saved. | field 2, its not-applicable half |

Follower is text: it may be a domain or a use case, two aggregates, and a reference names one. EN05 field 3 Domain (derived) goes to SP01.

### Value objects and constraints
None.

### Invariants

| ID | Title | Parent | Statement | Enforced by | Source |
| --- | --- | --- | --- | --- | --- |
| LA-TRC-INV01 | A setting value gives a value or a reason | A3 | A setting value MUST give either a value or a not-applicable reason, never both and never neither, and a reason MUST NOT be empty. | CHECKs on `setting_value` | DR05's "with a value or with a not-applicable reason"; C11 |
| LA-TRC-INV02 | Each followed pattern's settings take their own values | A3 | A follower that follows two patterns with a setting of the same name MUST give each pattern its own value: a setting value names its pattern, and one pattern's value MUST NOT answer the other's. | The primary key of `setting_value` (follower, pattern, setting) | DR06 |
| LA-TRC-INV03 | A setting value answers a setting of a pattern its follower follows | A3 | A setting value MUST name a setting its pattern has, for a pattern its follower follows. | Foreign keys from `setting_value` to `follows` and to `pattern_setting` | **New**: C11's foreign keys |
| LA-TRC-INV04 | A follower answers every setting of its pattern | A3 | A domain or use case that follows a pattern MUST give each of the pattern's settings a setting value, a value or a not-applicable reason. The pattern's rules then apply to it with those values, and it does not restate them. | The `pattern-setting-missing` check (an error), since a follower's values are written after its `follows` link | DR05 |

### Specifications

All four read A3, and the pattern's rules and settings (LA-AUT's: see What the plan didn't cover).

| ID | Title | Reads | Statement | Source |
| --- | --- | --- | --- | --- |
| LA-TRC-SP01 | Domain follows a pattern | A3 | A domain follows a pattern when the domain itself, or any of its use cases, follows it. | DR20's first sentence; EN05 field 3 |
| LA-TRC-SP02 | Pattern rule is not applicable in a domain | A3 | A pattern rule is not applicable in a domain when the rule names a setting, the domain does not follow the pattern itself, and every one of its use cases that follow the pattern gives that setting a not-applicable reason. One following use case that gives a value is enough to make it applicable. | DR09, DR35 |
| LA-TRC-SP03 | Pattern rule is waived in a domain | A3 | A pattern rule with an applies-when setting is waived in a domain when no follower there (a following use case, or the domain when it follows the pattern itself, through the setting values it gives) gives that setting a value that meets it, compared trimmed and in any letter case. A waived rule is neither owed nor proved there. | DR39; DR19's last sentence |
| LA-TRC-SP04 | Domain owes a pattern rule | A3 | A domain owes a pattern rule when it follows the rule's pattern (SP01) and the rule is neither not applicable (SP02) nor waived (SP03) there. A rule that names no setting is owed wherever its pattern is followed; a domain that follows the pattern itself owes every rule but a waived one; a rule owed both ways is owed once. | DR07, DR19, DR20's second sentence, DR21 |

### Domain events
None. Nothing hears a change to a pattern following: coverage is worked out again on every load.

### Commands

| ID | Title | Parent | Raises | Checks | Source |
| --- | --- | --- | --- | --- | --- |
| LA-TRC-CMD01 | Follow a pattern | A3 | | (INV03 for its values) | **New** as a command: UC07's `follows` link from a domain; LA-AUT-UC05's from a use case; `lathe link follows` |
| LA-TRC-CMD02 | Give a setting value | A3 | | (INV01, INV02, INV03) | **New** as a command: DR05; `lathe add setting_value` |

### Read models and fields

Every read model here is worked out on each load from the typed tables; none is written by a command.

| ID | Title | Parent | Reads | Source |
| --- | --- | --- | --- | --- |
| LA-TRC-RM01 | Coverage | LA-TRC | A3; and every domain's obligations, technical records and tests | A1, EN02 |
| LA-TRC-RM02 | Coverage gaps | LA-TRC | likewise | EN03 |
| LA-TRC-RM03 | Tests by state | LA-TRC | every domain's tests | EN01 |
| LA-TRC-RM04 | Owed pattern rules | LA-TRC | A3; and the patterns' rules | EN07 |
| LA-TRC-RM05 | File facts | LA-TRC | every test and technical record that names a file, and the files | **New** as a kind: C06's `file_facts`; EN04 fields 5 and 6 |
| LA-TRC-RM06 | Record trace | LA-TRC | every record and link | **New** as a kind: C46's `traceOf` and the graph's `traceChain` |

| Read model | # | Name | Type | Meaning | Example | Source |
| --- | --- | --- | --- | --- | --- | --- |
| RM01 | 1 | Domain | → [AUT-A2] Domain | The domain counted. | TL-LEND | EN01 field 1 |
| RM01 | 2 | Obligation kind | text | The obligation kind counted. | invariant | EN02 field 1 |
| RM01 | 3 | Total | whole number | How many the domain owes. | 6 | field 2 |
| RM01 | 4 | Designed | whole number | How many have their design specified (UC02-R02). | 6 | field 3 |
| RM01 | 5 | Built | whole number | How many have that design's technical record naming a file that exists. | 6 | field 4 |
| RM01 | 6 | Proved | whole number | How many an automated or manual test proves, at a level its kind allows. | 6 | field 5 |
| RM01 | 7 | Not automated yet | whole number | How many are not proved but have a test not automated yet. | 0 | field 6 Planned, renamed with the state |
| RM02 | 1 | Domain | → [AUT-A2] Domain | The domain that owes the obligation. | TL-LEND | **New** (the gap's domain was its parent's) |
| RM02 | 2 | Obligation | text | The obligation's ID. | TL-LEND-EP06-R03 | EN03 field 1 |
| RM02 | 3 | Kind | text | The obligation's kind. | api_requirement | field 2 |
| RM02 | 4 | Missing | text | What it lacks: `designed`, `built` or `proved`. | proved | field 3, **rewritten** (was `satisfies` or `proves`) |
| RM03 | 1 | Domain | → [AUT-A2] Domain | The domain counted. | TL-LEND | EN01 field 1 |
| RM03 | 2 | Automated | whole number | The domain's tests that run as code. | 59 | field 2 |
| RM03 | 3 | Manual | whole number | The domain's tests a person carries out. | 5 | field 3 |
| RM03 | 4 | Not automated yet | whole number | The domain's tests not automated yet. | 0 | field 4 Planned tests, renamed |
| RM04 | 1 | Domain | → [AUT-A2] Domain | A domain that follows the rule's pattern. | TL-LEND | **New** (EN07's domain was its parent's) |
| RM04 | 2 | Pattern rule | text | The rule's ID. | TL-PAT-LIBRARIAN-ACTION-R01 | EN07 field 1 |
| RM04 | 3 | Standing | text | `owed`, `not applicable` or `waived` (SP02 to SP04). | owed | field 2 Applies, **rewritten** to say which |
| RM04 | 4 | Reasons | text, optional | For not applicable, each following use case and its reason; for waived, the values given. | TL-LEND-UC03: nothing is saved | **New** |
| RM05 | 1 | Record | text | The test or technical record that names the file. | TL-LEND-INV01-T | EN04 field 1 |
| RM05 | 2 | File | text | The file, from the product root. | test/domain-rules.test.ts | field 5 |
| RM05 | 3 | Exists | yes/no | Whether the file exists. | yes | **New** (C06's `file_exists`) |
| RM05 | 4 | Names its ID | yes/no | For a test, whether the file names the test's ID as a whole ID (DS01). | yes | field 6 Backed by, **rewritten** |
| RM06 | 1 | Record | text | The record traced. | TL-LEND-UC03-R02 | **New** |
| RM06 | 2 | Group | text | The group it falls in, by its label: Designed by, Proved by, or a link's label. | Proved by | **New** |
| RM06 | 3 | Linked record | text | The record in the group. | TL-LEND-UC03-R02-T01 | **New** |
| RM06 | 4 | Mark | text, optional | built or not built for a design; the state for a test. | automated | **New** |

### Queries

| ID | Title | Parent | Selects by | Uses | Source |
| --- | --- | --- | --- | --- | --- |
| LA-TRC-QRY01 | Count coverage | RM01 | | DS01, DS02 | UC01, UC02; F01. `Workspace.coverage[].obligations`; `lathe check`'s coverage lines; the product and domain pages |
| LA-TRC-QRY02 | List coverage gaps | RM02 | | | UC01-R02; F01 step 2. `Coverage.gaps`; the gap callouts and the not-designed, not-built and not-proved warnings |
| LA-TRC-QRY03 | Count tests by state | RM03 | | | UC06; F02, F06. `Coverage.tests` |
| LA-TRC-QRY04 | List the pattern rules a domain owes | RM04 | SP04 (and shows SP02, SP03 standings) | | UC12; F05. Patterns we follow, the pattern and pattern rule pages |
| LA-TRC-QRY05 | Trace a record | RM06 | | | UC14; F03 step 4. A record's Traceability section |
| LA-TRC-QRY06 | Trace an obligation in the graph | RM06 | | | UC10. The graph's trace mode |

### Policies
None. The old reacts_to TRC-A1→LA-CHK-EV02 goes with that event (la-chk.md, judgment call 4).

### Domain services

| ID | Title | Parent | Used by | Statement | Source |
| --- | --- | --- | --- | --- | --- |
| LA-TRC-DS01 | Whole-ID matching | LA-TRC | QRY01 | Finds whether a text names an ID as a whole ID: `TL-LEND-INV05` is not found in `TL-LEND-INV050` or `TL-LEND-INV05-T`. Otherwise a test could seem to be named by a file that names another. | DR04; `mentionsId` |
| LA-TRC-DS02 | Allowed test levels | LA-TRC | QRY01 | Gives the run by levels each test kind allows: constraint test unit; invariant and specification tests unit or database; domain service test unit; policy test database, api or e2e-api; use case test api, e2e-api, e2e-ui or manual; view test unit, e2e-ui or manual; endpoint test contract or api; flow test e2e-ui or manual; integration test contract, e2e-api or manual; pattern rule test any. | **New**: brief 108's allowed levels |

### Terms

| ID | Term | Meaning | Source |
| --- | --- | --- | --- |
| LA-TRC-TM01 | Obligation | A record that must be designed, built and proved: a constraint, invariant, specification, policy, domain service, UC requirement, view requirement, API requirement, pattern rule or standard rule, or a product's own obligation kind. | **New**: DR01 |
| LA-TRC-TM02 | Designed | An obligation whose design is specified: a flow step fulfills the UC requirement, or a technical record implements the design record. | **New**: DR01 |
| LA-TRC-TM03 | Built | A designed obligation whose implementing technical record names a file that exists. | **New**: DR03 |
| LA-TRC-TM04 | Proved | An obligation with a test, automated or manual, at a level its kind allows. | **New**: DR02 |
| LA-TRC-TM05 | Gap | An obligation that is not yet designed, built or proved, reported as a warning. | **New**: EN03 |
| LA-TRC-TM06 | Run by | How a test runs: its level, its state, and its file or the reason it is manual. | **New**: plan decision 21 |
| LA-TRC-TM07 | Not automated yet | A test written before its code exists, to show what will prove an obligation. It never counts as proof. | **New**: UC03 step 3 ("planned") |
| LA-TRC-TM08 | Follower | A domain or use case that follows a pattern. | **New**: EN05 |
| LA-TRC-TM09 | Owed | A pattern rule a domain must prove for itself, because it follows the rule's pattern. | **New**: DR07 |
| LA-TRC-TM10 | Not applicable | A pattern rule a domain does not owe, because every following use case there marks its setting not applicable. | **New**: DR09 |
| LA-TRC-TM11 | Waived | A pattern rule a domain does not owe, because no follower there gives a value that meets its applies-when setting. | **New**: DR39 |
| LA-TRC-TM12 | Trace | The records that design, build and prove one obligation, and the files they name. | **New**: UC10, UC14 |

## Use cases

### Capabilities

| ID | Title | Parent | Source |
| --- | --- | --- | --- |
| LA-TRC-CAP01 | Counting coverage | LA-TRC | CAP01; description **rewritten**: "How much of each obligation is designed, built and proved, what is proved only by tests not automated yet, and what is still missing." |
| LA-TRC-CAP02 | Proving with tests | LA-TRC | CAP02; description **rewritten**: "How a test is run, and how its file names it." |
| LA-TRC-CAP03 | Reading coverage and traces | LA-TRC | CAP03; description **rewritten**: "Coverage, tests by state, the patterns a domain owes and each record's traces, as the app shows them." |

### Use cases

Actors are unchanged. UC03 to UC05's old use case steps fold into their flows.

| ID | Title | Parent | Actors | Goal | Source |
| --- | --- | --- | --- | --- | --- |
| LA-TRC-UC01 | See a domain's coverage | CAP01 | Owner | **Rewritten** (below) | UC01 |
| LA-TRC-UC02 | Count coverage by the meta-model | CAP01 | Owner | **Rewritten** | UC02 |
| LA-TRC-UC03 | Record how a test is run | CAP02 | Owner, Agent | **Rewritten**; notes go | UC03 "Record how a test proves its obligations" |
| LA-TRC-UC04 | Prove the rules of the patterns a domain follows | CAP01 | Owner, Agent | **Rewritten**; notes rewritten | UC04 |
| LA-TRC-UC05 | Check that each test's file names it | CAP02 | Owner, Agent | **Rewritten**; notes rewritten | UC05 "Check every proof a test claims" |
| LA-TRC-UC06 | See each domain's tests by state | CAP01 | Owner, Agent | **Rewritten** | UC06 "See proof still owed and each domain's tests by state" |
| LA-TRC-UC07 | Follow a pattern per domain, with or without settings | CAP01 | Owner, Agent | **Rewritten** | UC07 |
| LA-TRC-UC08 | Report pattern rule tests that count nowhere and silent manual test files | CAP01 | Owner, Agent | **Rewritten** | UC08 "Name owed proofs and report proofs that count nowhere" |
| LA-TRC-UC09 | See each domain's coverage and the product's summary | CAP03 | Reader | as today | UC09 |
| LA-TRC-UC10 | Trace an obligation in the graph | CAP03 | Reader | **Rewritten** | UC10 "Trace a requirement in the graph" |
| LA-TRC-UC11 | See every obligation kind and test state | CAP03 | Reader | **Rewritten** | UC11 |
| LA-TRC-UC12 | See the patterns a domain follows and the rules it owes | CAP03 | Reader | **Rewritten** | UC12 |
| LA-TRC-UC13 | See tests by state with each domain's coverage | CAP03 | Reader | **Rewritten** | UC13 "See proof still owed and tests by state with each domain's coverage" |
| LA-TRC-UC14 | See what designs, builds and proves a record | CAP03 | Reader | **Rewritten** | UC14 "See what designs, proves and carries out a record" |

Goals:
- **UC01:** "The Owner asks how complete a domain is: how many of its obligations (constraints, invariants, specifications, policies, domain services, UC requirements, view requirements, API requirements, pattern rules, standard rules and any obligation kind the product declares) are designed, built and proved, how many have only a test not automated yet, and which ones are not done. LA-TRC-UC02 says how each is decided."
- **UC02:** "The Owner sees coverage for every kind of obligation the product has, its own kinds included. For each domain and obligation kind they see how many are designed, built, proved, and proved only by a test not automated yet, each decided from the tree: the steps and technical records that design and build it, and the tests under it."
- **UC03:** "A person writes each test under the one record it proves, of the test kind for that record, and says how it runs in its run by: a level (unit, database, api, contract, e2e-api, e2e-ui or manual), a state (automated, manual or not automated yet), and a file, or for a manual test the reason it is manual. The store refuses a run by that breaks these rules; `lathe check` reports a test whose file is missing or does not name it."
- **UC04:** "A pattern states behavior that several use cases share. Its rules are written once, as `pattern_rule` records under the pattern. Every domain that follows the pattern (the domain itself or one of its use cases `follows` it) must prove each rule in a pattern rule test of its own, naming the domain: proof in one domain says nothing about another. Pattern rules need proof only. A rule that depends on a setting names it, and a domain that follows only through use cases that all give that setting a not-applicable reason does not owe the rule. A rule that applies only for some values of a setting says so with an applies-when setting, and is waived, neither owed nor proved, in a domain where no follower gives a value that meets it." Notes: "The person writes the rules under the pattern, writes one pattern rule test per rule in each following domain, naming that domain, and runs `lathe check`. Coverage shows one pattern rule line per domain; the gaps and the `not-proved` warnings name the rule and the domain that still owes it. The store refuses a rule naming a setting its pattern does not have, and a second test of one rule in one domain; a pattern nobody follows is reported."
- **UC05:** "A test says what it proves by where it sits. A person, or an AI agent, writes the test and its code, and `lathe check` confirms that the code names the test, so each test record leads to the code that runs it." Notes: "The person fixes each error by naming the test's ID in the test's name. A test whose file does not name it proves nothing: its obligation stays not proved, in the warnings and in coverage alike."
- **UC06:** "The Owner, or an Agent, runs `lathe check` or reads the workspace's coverage and learns how many tests each domain has by state, automated, manual and not automated yet, as a real product's test-coverage table counts them."
- **UC07:** "A real product adopts most of its patterns for a whole domain, writes several with no settings, and asks only for proof of their rules. The Owner, or an Agent, links a domain to a pattern with `follows`, and gives a pattern no `pattern_setting` rows where it has none. Coverage then counts each rule in that domain, as it does for a domain whose use cases follow the pattern, and asks only for proof. A use case that follows a pattern needs no requirements of its own. A product's own kind may be declared an obligation."
- **UC08:** "The Owner, or an Agent, runs `lathe check` and reads each pattern rule test whose domain does not owe its rule, with the reason, and each manual test whose file never mentions it."
- **UC10:** "The Reader picks an obligation, such as a UC requirement, and switches the graph to its traceability chain alone: the flow steps that fulfill it, the commands and queries they invoke and the views they happen in, the technical records that implement them, the tests under it, and the files they name. Gaps in the chain show at once."
- **UC11:** "The Reader reads coverage for every kind of obligation the model names (UC requirements, view and API requirements, the domain model's rules and any kind the product adds), finds each view or API requirement under its view or endpoint, and tells at a glance which tests are automated, which are manual and which are not automated yet."
- **UC12:** as today, with "whether the domain designs, builds and proves it" → "whether the domain proves it".
- **UC13:** "The Reader reads a product's or a domain's coverage and, with each domain's coverage, its tests by state; the product's summary totals them, as a real product's test-coverage table does."
- **UC14:** "The Reader opens a record and, below its text, reads its Traceability: for an obligation, what designs it (the flow steps that fulfill a UC requirement, or the technical record that implements any other), whether that is built, and the tests under it, each with its state, with a callout for each gap coverage finds. A use case shows its requirements in a table of Designed, Built and Proved. A technical record shows what it implements and that record's tests; a test shows what it proves and its run by. Every list is titled by its links' label, read from this record."

### UC requirements

Unchanged rows carry over with their IDs, titles, groups and statements. The Reader use cases' requirements, all about what a page shows, become view requirements (judgment call 6).

| ID | Group | Title | Change |
| --- | --- | --- | --- |
| UC01-R01 | | Coverage counts designed and proved obligations | **Rewritten**: "For each domain, coverage MUST give the number of obligations of each obligation kind, and how many of each are designed and how many are proved. Built counts are LA-TRC-UC01-R04; not-automated-yet counts are LA-TRC-UC02-R03." |
| UC01-R02 | | Coverage lists each gap with what it lacks | **Rewritten**: "Coverage MUST list each obligation that is not designed, not built or not proved, with its kind, saying which it lacks, and the `not-designed`, `not-built` and `not-proved` warnings MUST name exactly the obligations coverage counts as lacking it." (takes in DR15) |
| UC01-R03 | | Coverage gaps are warnings, not errors | **Rewritten**: "A gap MUST be reported as a warning, so that an honest, unfinished design still passes `lathe check`." |
| UC01-R04 | | Coverage reports built separately from designed | **Rewritten**: "For each domain, coverage MUST give how many obligations of each kind are built: the technical record that implements its design names a file that exists. The built count MUST never be more than the designed count, so a domain whose code does not exist yet shows as designed but not built." (DR03) |
| UC02-R01 | | Coverage counts every obligation kind | **Rewritten**: "For each domain, coverage MUST give one entry per obligation kind (constraint, invariant, specification, policy, domain service, UC requirement, view requirement, API requirement, pattern rule, standard rule, and every product kind declared an obligation), in schema order, even when the domain has none of that kind. Each entry MUST give the total and how many are designed, built, proved and not automated yet." |
| UC02-R02 | | Design and proof links are found by their role | **Rewritten**, title "Designed, built and proved follow from the tree": "An obligation MUST count as designed when its design is specified, as built when the technical record that implements that design names a file that exists, and as proved when a test under it is automated or manual, at a level its kind allows. A UC requirement is designed when a flow step of its use case fulfills it, and built when the handler of the command or query that step invokes names a file that exists. Any other obligation is designed when the technical record of its kind exists, and built when that record names a file that exists: a constraint's value type (of its value object), an invariant's data models (of its aggregate) or a unique key naming it, a specification's predicate, a policy's event handler, a domain service's service, a view requirement's UI components (of its view), an API requirement's endpoint handler (of its endpoint). A product relation declared with the `design` or `proof` role counts as design or proof of its target. Coverage is counted in the domain the obligation belongs to." (DR01; the per-kind list is brief 108's to settle) |
| UC02-R03 | | A planned test makes an obligation planned, not proved | **Rewritten**, title "A test not automated yet makes an obligation not automated yet, not proved": "An obligation MUST count as proved only when an automated or manual test proves it, and as not automated yet when it is not proved but a test not automated yet is meant to prove it. The `not-proved` warning for such an obligation SHOULD say that its test is not automated yet." (DR02) |
| UC02-R05 | | The check prints one coverage line per domain and obligation kind | **Rewritten**: "…with designed, built, proved and not-automated-yet counts out of the total…" (rest unchanged) |
| UC02-R06 | | Obligations and roles come from the schema's meta tables | **Rewritten**, title "Obligations come from the schema": "Coverage MUST read whether a kind is an obligation from `meta_kind.obligation`, a product's own kinds included, and the workspace MUST give each kind its `obligation`." (`full`, `proof`, `none` and `proof_only` go) |
| UC02-R07 | | Proof counts only at a level the test's kind allows | **New**: "A test MUST count as proof only when its run by level is one its kind allows (LA-TRC-DS02); at another level it counts as nothing, and LA-CHK-UC04-R04 reports it." |
| UC02-R08 | | A constraint counts in each domain that uses its value object | **New**: "A constraint, under a value object that belongs to no domain, MUST count in the coverage of each domain that has an entity field typed by the value object, and its one test proves it in each of them." |
| UC03-R01 | | An automated test's file names the test or every record it proves | **Rewritten**, title "Every test gives its run by": "Every test MUST give its run by: a level, a state, and a file when it is automated or a manual reason when it is manual. Its file MUST name the test's ID, as LA-TRC-UC05 sets out." |
| UC03-R02 | | A test's state is automated, manual or planned | **Rewritten**, title "A test's state is automated, manual or not automated yet": "A test's `state` MUST be one of `automated`, `manual` and `not automated yet`, and every test MUST give one: the store MUST refuse any other value, or none. The checks and coverage MUST read it the same way." |
| UC03-R03 | | Only an automated test needs a file | **Rewritten**, title "Only an automated test needs a file, and only a manual test gives a reason": "The store MUST refuse an automated test with no `file`, a manual test with no `manual_reason`, and a manual reason on any other test. A test not automated yet MAY name the file it will live in before that file exists; that MUST be a warning, not an error. Any other file a test names MUST exist (`test-file-missing`, an error)." |
| UC03-R04 | | A test may support an obligation without proving it | **Retired**: `supports` goes; a test proves exactly its parent |
| UC03-R05 | | A test that runs from a shared class names its key file | **Retired**: `key` and `key_file` go; a test file names the test's ID |
| UC03-R06 | | A test's level is one of seven | **New**: "A test's `level` MUST be one of unit, database, api, contract, e2e-api, e2e-ui and manual, and the store MUST refuse any other value, or none." |
| UC04-R01 | | A pattern rule is an obligation under a pattern | **Rewritten**: "A `pattern_rule` record MUST sit under a `pattern` and MUST be an obligation counted for proof alone (LA-TRC-UC07-R05), proved in each domain by a pattern rule test under it that names the domain, at most one per rule and domain. It MAY name, in its `setting` column, the one pattern setting it depends on." |
| UC04-R02 | | Each domain that follows a pattern owes its rules | **Rewritten**: "Coverage MUST count each pattern rule once in each domain that owes it (LA-TRC-SP04), on that domain's `pattern_rule` line. A domain that does not follow the pattern MUST NOT count the rule, and the rule's gaps MUST name it in each domain that owes it." |
| UC04-R03 | | A domain's own components and tests design and prove a pattern rule there | **Rewritten**, title "A domain's own pattern rule test proves a pattern rule there": "In each domain that owes a pattern rule, the rule MUST count as proved only when its pattern rule test naming that domain is automated or manual, and as not automated yet when that test is not automated yet. One domain's test MUST NOT count for another." (DR08, DR18) |
| UC04-R04 | | A pattern rule does not apply where its setting is Not applicable | unchanged |
| UC04-R05 | | Unsatisfied and unproved warnings name the pattern rule and the domain | **Rewritten**, title "Not-proved warnings name the pattern rule and the domain": "The `not-proved` warning MUST report a pattern rule once for each domain that owes it and lacks the proof, with a message naming the rule and the domain, such as \"Pattern rule TL-PAT-LIBRARIAN-ACTION-R01 is not proved in TL-LEND\", and MUST say when its test there is not automated yet." |
| UC04-R06 | | A pattern rule naming a setting its pattern does not have is refused | unchanged |
| UC04-R07 | | A pattern that no use case or domain follows is a warning | unchanged |
| UC04-R08 | | Any other obligation outside every domain is a warning | **Rewritten**: "An obligation that sits in no domain, other than a pattern rule under a pattern and a constraint under a value object (LA-TRC-UC02-R08), such as a product's own obligation kind declared under the product, MUST be reported as an `obligation-outside-domain` warning, since no domain's coverage counts it." |
| UC04-R09 | | A pattern rule no follower meets is waived in that domain | **Rewritten**: "…Elsewhere the rule MUST be waived (LA-TRC-SP03): neither owed nor proved, so it adds nothing to that domain's coverage, gaps or `not-proved` warnings, and a pattern rule test there counts nothing (LA-TRC-UC08-R02)…" (rest unchanged) |
| UC05-R01 | | A file that names the test's ID accepts all its claims | **Rewritten**, title "An automated test's file names the test's ID": "An automated test's `file` MUST name the test's own ID, matched only as a whole ID (LA-TRC-DS01). Otherwise the engine MUST report a `test-file-missing-id` error naming the test and the file, and the test MUST NOT count as proof." (DR04, DR11; takes in R04) |
| UC05-R02 | | Each proved ID the file leaves out is an error | **Retired**: `proof-not-in-file` goes (DR12) |
| UC05-R03 | | A test's key must be in its file | **Retired**: `key` goes (DR13) |
| UC05-R04 | | A test that proves nothing still needs its ID in its file | **Retired**: merged into R01; every test proves its parent |
| UC05-R05 | | A manual or planned test's claims are not checked | **Rewritten**, title "A manual or not-yet-automated test's file is checked only for existing": "The engine MUST NOT report `test-file-missing-id` for a manual test or a test not automated yet; a file it names is checked only for existing." (DR14) |
| UC06-R01 | | Coverage counts every obligation a planned test is meant to prove | **Retired**: `planned_any` goes (DR16) |
| UC06-R02 | | Coverage counts each domain's tests by state | **Rewritten**: "Each domain's coverage MUST report `tests`: how many tests sit in the domain with each state, automated, manual and not automated yet, each test counted once, in the domain its parent belongs to (a pattern rule test in the domain it names). A domain with no tests MUST report zero of each." (DR17) |
| UC06-R03 | | lathe check reports owed proof and tests by state | **Rewritten**, title "lathe check reports each domain's tests by state": "After a domain's obligation lines, `lathe check`'s coverage report MUST print one line with its tests by state, such as `LA-CHK tests: 50 automated, 0 manual, 7 not automated yet`." |
| UC07-R01 | Following | A domain may follow a pattern and then owes every rule | unchanged |
| UC07-R02 | Following | A domain follows a pattern itself or through any of its use cases | **Rewritten**: "Coverage and its warnings MUST treat a domain as following a pattern when the domain or any of its use cases follows it (LA-TRC-SP01)…" (rest unchanged) |
| UC07-R03 | Following | A pattern may have no settings | unchanged |
| UC07-R04 | Proof only | An obligation kind may need proof only | **Rewritten**, title "A product's own kind may be an obligation", group none: "A product kind MAY be declared an obligation (`product_kind.obligation`), and coverage MUST then count it as any other obligation kind." |
| UC07-R05 | Proof only | A proof-only obligation is counted for proof alone | **Rewritten**, title "A pattern rule is counted for proof alone": "For pattern rules, coverage MUST report designed and built as equal to the total and give no design or build gaps, and the `not-designed` and `not-built` warnings MUST NOT fire. Proved, not-automated-yet and proof gaps MUST work as for any obligation." (DR22) |
| UC07-R06 | Proof only | Pattern rules need proof only, and a product cannot widen them | **Rewritten**: "The store MUST refuse a product kind that takes the name of one of Lathe's tables, so a pattern rule asks for proof alone in every domain that owes it." |
| UC07-R07 | Following | A use case that follows a pattern is not asked for requirements | unchanged (DR23) |
| UC07-R08 | Fulfilling rules | Interaction requirements and flow steps may fulfill pattern rules | **Retired**: steps fulfill only their own use case's UC requirements (plan decision 12) |
| UC07-R09 | Fulfilling rules | A step may fulfill rules of the patterns its flow's use cases or domain follow | **Retired**: likewise; `flow-step-fulfills-outside-flow` becomes the schema's `step-fulfills-own-use-case` refusal |
| UC08-R01 | | Each proved obligation a planned test still owes is named | **Retired**: `proof-still-owed` goes (DR24, DR25) |
| UC08-R02 | | A test whose proof counts in no domain is reported | **Rewritten**, title "A pattern rule test in a domain that does not owe the rule is reported": "A pattern rule test naming a domain that does not follow its rule's pattern MUST be a `pattern-rule-test-outside-followers` error. One naming a domain that follows the pattern, but where the rule is not applicable or waived, MUST be a warning saying so. Each message MUST name the test, the rule, the domain and the reason." (DR26) |
| UC08-R03 | | A manual test whose file never mentions it is reported | **Rewritten**: "A manual test whose `file` exists but does not name the test's ID MUST get a `manual-test-file-silent` warning naming the test and the file. Automated tests and tests not automated yet MUST NOT get this warning." (DR27; LA-CHK-DR13's silent half) |
| UC09-R02 to R05 | | (four) | **Moved** to LA-V51-R01 to R03 |
| UC10-R01, R02 | | (two) | **Moved** to [EXP-V04]-R51, R52 |
| UC11-R01 to R04, R06, R07 | | (six) | **Moved** to LA-V51, [EXP-V02] and [EXP-V03] view requirements |
| UC11-R05 | | The record page shows what an interaction requirement fulfills | **Retired**: view and API requirements fulfill nothing; their parent is their view or endpoint |
| UC12-R01 to R06 | | (six) | **Moved** to [EXP-V02] and [EXP-V03] view requirements |
| UC13-R01 | | The planned bar shows proof still owed beyond the unproved | **Retired**: `planned_any` goes (DR36) |
| UC13-R02, R03 | | (two) | **Moved** to LA-V51-R03, R04 and [EXP-V02]-R51 |
| UC14-R01 to R04, R06 | | (five) | **Moved** to [EXP-V03]-R56 to R60 |
| UC14-R05 | | Every link is shown by its label | **Merged** into LA-EXP-V03-R07 "Links are shown by their labels, never by relation codes" (LA-EXP's), which says the same |

## Interaction design

### Flows

| ID | Title | Parent | Source |
| --- | --- | --- | --- |
| LA-TRC-UC01-FL | Read and close a domain's coverage gaps | UC01 | F01 |
| LA-TRC-UC02-FL | Count coverage for every obligation kind | UC02 | F01 |
| LA-TRC-UC03-FL | Write a test and its run by | UC03 | LA-CHK-F01 (it carried out UC03); UC03's steps 1–3 |
| LA-TRC-UC04-FL | Prove a followed pattern's rules in each domain | UC04 | F01 step 2; UC04's notes |
| LA-TRC-UC05-FL | Name the test in its code | UC05 | LA-CHK-F01 (it carried out UC05); UC05's steps 1–3 |
| LA-TRC-UC06-FL | See tests by state | UC06 | F02 |
| LA-TRC-UC07-FL | Follow a pattern for a whole domain | UC07 | **New** (UC07 was carried out by LA-AUT-F03); UC07's goal |
| LA-TRC-UC08-FL | Find pattern rule tests that count nowhere | UC08 | F01 |
| LA-TRC-UC09-FL | Read a product's coverage | UC09 | F03 step 1 |
| LA-TRC-UC10-FL | Trace an obligation in the graph | UC10 | **New** (carried out by LA-EXP-F01, which stays LA-EXP's) |
| LA-TRC-UC11-FL | Read coverage for every obligation kind | UC11 | F04 |
| LA-TRC-UC12-FL | Check how a domain proves the patterns it follows | UC12 | F05 |
| LA-TRC-UC13-FL | See tests by state with coverage | UC13 | F06 |
| LA-TRC-UC14-FL | Trace a requirement to what designs, builds and proves it | UC14 | F03 steps 2–4 |

### Flow steps

Step IDs are written short; in full they start `LA-TRC-`. [AUT-add-test] and [AUT-add-pattern-rule] stand for LA-AUT's commands that add those records (to resolve).

| ID | Path | Title | Invokes | In view | Fulfills | Source |
| --- | --- | --- | --- | --- | --- | --- |
| UC01-FL-S01 | main | The Owner runs `lathe check` and reads one coverage line per domain and obligation kind: designed, built, proved and not automated yet | QRY01 | | UC01-R01 | F01 step 1 |
| UC01-FL-S02 | main | Each gap names the obligation and what it lacks: its design, a built file or a test | QRY02 | | UC01-R02, UC01-R04 | F01 step 2 |
| UC01-FL-S03 | main | The gaps are warnings, so the check still passes | | | UC01-R03 | **New** (UC01-R03) |
| UC01-FL-S04 | main | An Agent closes each gap in that domain, and the next check counts it | | | | F01 step 3 |
| UC02-FL-S01 | main | The Owner runs `lathe check` on a product with every obligation kind, its own kinds among them | QRY01 | | UC02-R01, UC02-R06, UC02-R08 | F01 step 1 |
| UC02-FL-S02 | main | Coverage decides designed, built and proved from the tree, counting only tests at levels their kind allows | | | UC02-R02, UC02-R07 | **New** (UC02-R02) |
| UC02-FL-S03 | main | An obligation with only a test not automated yet counts as not automated yet, not proved | | | UC02-R03 | **New** (UC02-R03) |
| UC02-FL-S04 | main | The report prints one line per domain and obligation kind | | | UC02-R05 | F01 step 1 |
| UC03-FL-S01 | main | The Agent writes the test under the record it proves, with its level and state | [AUT-add-test] | | UC03-R01, UC03-R02, UC03-R06 | UC03 goal |
| UC03-FL-S02 | automated | An automated test names the file that runs it | | | UC03-R03 | UC03 step 1 |
| UC03-FL-S03 | manual | A manual test gives the reason it is manual, and its procedure in given, when and then | | | UC03-R03 | UC03 step 2 |
| UC03-FL-S04 | not automated yet | A test not automated yet may name the file it will live in; until the file exists that is a warning | | | UC03-R03 | UC03 step 3 |
| UC03-FL-S05 | refused | A test with an unknown state or level, an automated test with no file, or a manual reason on a test that is not manual is refused | | | UC03-R02, UC03-R03, UC03-R06 | UC03's notes |
| UC04-FL-S01 | main | The Owner writes the pattern's rules under the pattern, each naming the setting it depends on, if any | [AUT-add-pattern-rule] | | UC04-R01 | UC04 notes |
| UC04-FL-S02 | refused | A rule naming a setting its pattern does not have is refused | | | UC04-R06 | UC04 notes |
| UC04-FL-S03 | main | A domain follows the pattern, itself or through its use cases | CMD01 | | UC04-R02 | UC04 goal |
| UC04-FL-S04 | main | An Agent writes one pattern rule test per rule in each following domain, naming the domain | [AUT-add-test] | | UC04-R03 | UC04 notes |
| UC04-FL-S05 | main | `lathe check` counts each rule once in each domain that owes it, leaving out where it is not applicable or waived | QRY01 | | UC04-R02, UC04-R04, UC04-R09 | F01 step 2 |
| UC04-FL-S06 | main | The gaps and `not-proved` warnings name each rule with the domain that still owes it | QRY02 | | UC04-R05 | F01 step 2 |
| UC04-FL-S07 | main | A pattern nobody follows, and any obligation outside every domain, is a warning | | | UC04-R07, UC04-R08 | UC04 notes |
| UC05-FL-S01 | main | The Agent writes the test's code, naming the test's own ID in its name | | | | UC05 steps 1–2 |
| UC05-FL-S02 | main | `lathe check` reads each automated test's file for the test's ID, as a whole ID | QRY01 | | UC05-R01 | UC05 goal |
| UC05-FL-S03 | refused | A file that does not name its test is an error naming the test and the file, and the Agent names it | | | UC05-R01 | UC05 notes |
| UC05-FL-S04 | main | The file of a manual test or a test not automated yet is checked only for existing | | | UC05-R05 | UC05-R05 |
| UC06-FL-S01 | main | The Owner runs `lathe check` and, after each domain's obligation lines, reads its tests by state | QRY03 | | UC06-R02, UC06-R03 | F02 steps 1, 3 |
| UC06-FL-S02 | json | An Agent reads the same counts from `lathe check --json`, on each domain's coverage | QRY03 | | UC06-R02 | F02 step 4 |
| UC07-FL-S01 | main | The Owner links a domain to a pattern with `follows` | CMD01 | | UC07-R01 | UC07 goal |
| UC07-FL-S02 | main | They give the pattern's settings their values, or none where the pattern has none | CMD02 | | UC07-R03 | UC07 goal |
| UC07-FL-S03 | main | `lathe check` counts each of the pattern's rules in the domain, once, and asks only for proof | QRY01 | | UC07-R02, UC07-R05 | UC07 goal |
| UC07-FL-S04 | main | The domain's use cases that follow it are not asked for requirements of their own | | | UC07-R07 | UC07 goal |
| UC07-FL-S05 | main | A product kind declared an obligation is counted like Lathe's | | | UC07-R04 | UC07 goal |
| UC07-FL-S06 | refused | A product kind named like one of Lathe's tables is refused | | | UC07-R06 | UC07-R06 |
| UC08-FL-S01 | main | The Owner runs `lathe check` | QRY01 | | | F01 step 1 |
| UC08-FL-S02 | main | A pattern rule test in a domain that does not owe its rule is reported, with the reason | | | UC08-R02 | UC08 goal |
| UC08-FL-S03 | main | A manual test whose file does not name it is a warning | | | UC08-R03 | UC08 goal |
| UC09-FL-S01 | main | The Reader opens a product and reads each domain card's coverage bars | QRY01 | LA-V51 | | F03 step 1 |
| UC09-FL-S02 | main | They read the product's Summary: coverage, tests by state, open questions, errors and warnings | QRY03 | LA-V51 | | UC09 goal |
| UC09-FL-S03 | main | They read the product's open questions and problems | LA-CHK-QRY02 | LA-V51 | | UC09 goal |
| UC09-FL-S04 | main | They open a domain card to its domain page | | [EXP-V02] | | F03 step 2 |
| UC10-FL-S01 | main | The Reader focuses an obligation in the graph | | [EXP-V04] | | UC10 goal |
| UC10-FL-S02 | main | They switch to trace mode and see only its chain and the files it names | QRY06 | [EXP-V04] | | UC10 goal |
| UC11-FL-S01 | main | The Reader opens a product, then a domain, and reads one coverage group per obligation kind | QRY01 | [EXP-V02] | | F04 step 1 |
| UC11-FL-S02 | main | They open a gap, such as an API requirement no test proves yet, on its record page | QRY02 | [EXP-V03] | | F04 step 2 |
| UC11-FL-S03 | main | On the record page each test shows its state | QRY05 | [EXP-V03] | | F04 step 3 |
| UC12-FL-S01 | main | The Reader opens a domain page and unfolds Patterns we follow: each pattern, its rules, and whether this domain proves each | QRY04 | [EXP-V02] | | F05 step 1 |
| UC12-FL-S02 | main | They open a pattern: its settings, its rules, and the domains and use cases that follow it, with each domain's standing per rule | QRY04 | [EXP-V03] | | F05 step 2 |
| UC12-FL-S03 | main | In the graph, the pattern's rules sit under the pattern and each `follows` link is drawn as a cross-link | | [EXP-V04] | | F05 step 3 |
| UC13-FL-S01 | main | The Reader reads each domain card's tests by state | QRY03 | LA-V51 | | F06 step 2 |
| UC13-FL-S02 | main | In the product's Summary they read the tests by state in total | QRY03 | LA-V51 | | F06 step 3 |
| UC13-FL-S03 | main | They open a domain and read the same in its Coverage section | QRY03 | [EXP-V02] | | F06 step 4 |
| UC14-FL-S01 | main | The Reader opens a domain, searches for a requirement and opens it | | [EXP-V02] | | F03 step 2 |
| UC14-FL-S02 | main | Below its text, its Traceability lists what designs, builds and proves it, with a callout for each gap | QRY05 | [EXP-V03] | | F03 step 4 |
| UC14-FL-S03 | main | They follow a test to its record page: what it proves and its run by | QRY05 | [EXP-V03] | | F03 step 3 |
| UC14-FL-S04 | main | They follow a gap's callout to the page of the check that reports it | | [AUT-V03] | | F03 step 4 |

Every UC requirement that stays a UC requirement is fulfilled by at least one step of its own flow. The Reader use cases (UC09 to UC14) keep no UC requirements: their steps happen in the views whose requirements say what each page shows.

### Views and view requirements

| ID | Kind | Title | Statement or fields | Source |
| --- | --- | --- | --- | --- |
| LA-V51 | View | Product page | route `/<product-id>`; description **rewritten**: "The product's one page, at its ID: its description, its domains as cards with coverage bars (designed, built and proved) and tests by state, its summary of what Lathe counts across it, its open questions and its problems, with its facts, children and links both ways in the side bar." | TRC-V01 |
| LA-V51-R01 | View requirement | The product page shows each domain with its coverage | "The product page MUST show each domain as a card, linking to the domain page, with one group of small bars per obligation kind the engine reports for it, labeled with the kind's label and in the engine's order, each with designed, built, proved and not-automated-yet counts. It MUST NOT name obligation kinds of its own, and a count the engine does not report MUST NOT be shown as zero." | UC09-R02, UC09-R05, UC11-R01 (cards); DR32 |
| LA-V51-R02 | View requirement | The product page lists its open questions and problems | as UC09-R03 | UC09-R03 |
| LA-V51-R03 | View requirement | The product page sums up what Lathe counts across the product | "The product page MUST show, in a Summary section, what Lathe counts across the product's domains: designed, built and proved, totaled over every obligation kind; the not-automated-yet count on its own line, apart from proved; a Tests row totaling its domains' tests by state; its open questions; and its errors and warnings. A product with nothing to count MUST show zeros, not an empty section." | UC09-R04, UC11-R02, UC13-R03 |
| LA-V51-R04 | View requirement | Each domain card shows its tests by state | "Each domain card MUST show the domain's tests by state under its bars, such as `Tests 12 automated, 1 manual, 2 not automated yet`, from `Coverage.tests`." | UC13-R02 (product page) |
| [EXP-V02]-R51 | View requirement | The domain page's coverage shows every obligation kind and the tests by state | "The domain page's Coverage section MUST show one group of bars per obligation kind the engine reports, the pattern rule line among them, each with designed, built, proved and not-automated-yet counts, then the domain's tests by state. Its gaps MUST name each obligation, pattern rules included, that the domain does not yet design, build or prove." | UC11-R01 (domain page), UC12-R05, UC13-R02 (domain page); DR32 |
| [EXP-V02]-R52 | View requirement | View and API requirements are listed under their view or endpoint | "The domain page MUST list each view requirement and API requirement nested under its view or endpoint, and each record of an obligation kind a product adds under its parent, with its gaps and problems on its row. Searching for one MUST keep its view or endpoint shown above it." | UC11-R03, **rewritten** |
| [EXP-V02]-R53 | View requirement | Each test shows its state, and one not automated yet never looks like proof | "The domain page MUST tag each test with its state. A test not automated yet MUST look unfinished and MUST NOT be counted or drawn as proof." | UC11-R04 (domain page); DR33 |
| [EXP-V02]-R54 | View requirement | A domain page lists the patterns it follows | "A domain page MUST have a Patterns we follow section listing each pattern that the domain itself follows (\"followed by the whole domain\", with every rule applying) or that any of its use cases follows, with the use cases that follow it. Each pattern's rules MUST be folded under its row, one level deep like the rest of the page, and each rule MUST show whether this domain proves it (its pattern rule test naming the domain is automated or manual), with a test not automated yet shown apart, worked out as the engine counts it (LA-TRC-SP04). A domain that follows no pattern MUST say so." | UC12-R01, **rewritten**; DR34 |
| [EXP-V02]-R55 | View requirement | A rule the domain marks not applicable says so, with the use case and reason | as UC12-R02, with "instead of designed, built and proved" → "instead of its proof" | UC12-R02; DR35 |
| [EXP-V02]-R56 | View requirement | A waived rule says Waived here, with the value the domain gives | as UC12-R06, with "instead of designed, built and proved" → "instead of its proof" | UC12-R06 |
| [EXP-V03]-R51 | View requirement | A test's page shows its state | "The record page MUST show a test's state; for a test not automated yet it MUST look unfinished and say that it does not count as proof." | UC11-R04 (record page); DR33 |
| [EXP-V03]-R52 | View requirement | The record content can sit inside another view | as UC11-R06 | UC11-R06 |
| [EXP-V03]-R53 | View requirement | Every list stays at 10 rows and can be searched | as UC11-R07 | UC11-R07 |
| [EXP-V03]-R54 | View requirement | A pattern page shows its settings, rules and followers | as UC12-R03 | UC12-R03 |
| [EXP-V03]-R55 | View requirement | A pattern rule page shows the domains that owe it | "A pattern rule's page MUST list each domain that follows its pattern, with that domain's standing for the rule: proved, not automated yet, not proved, not applicable with the reasons, or waived." | UC12-R04, **rewritten** |
| [EXP-V03]-R56 | View requirement | An obligation lists what designs, builds and proves it | "An obligation's record page MUST show a Traceability section after its text and before its children, with these groups in this order, each left out when empty: Designed by (for a UC requirement the flow steps that fulfill it, for any other obligation the technical record that implements its design, each marked built or not built), Proved by (its tests, each with its state), then its other incoming links under their reverse labels, then its links out under their forward labels. Which links go in which group MUST follow only the schema: the tree, a relation's role, and whether the kind is an obligation. A group is titled by its links' label and holds each record once." | UC14-R01, **rewritten**; DR38 |
| [EXP-V03]-R57 | View requirement | Each gap shows as a callout linked to its check | "An obligation's Traceability MUST name each gap in a callout, \"Not designed yet\", \"Not built yet\" or \"Not proved yet\", saying when its test is not automated yet, taken from coverage's own gaps for the domain that owes it, never from a count of its own, so it never disagrees with the coverage marks or the checks. Each callout MUST link to the page of the check that reports it (`not-designed`, `not-built`, `not-proved`). A pattern rule MUST show one line for each domain that owes it, judged from that domain's test alone." | UC14-R02, **rewritten**; DR37 |
| [EXP-V03]-R58 | View requirement | A use case shows its requirements in a table | "A use case's Traceability MUST show a table with one row per UC requirement and the columns Requirement, Designed, Built and Proved, each cell linking the records that design, build or prove it and flagging a gap, followed by its flow and the patterns it follows." | UC14-R03, **rewritten** (Applies goes) |
| [EXP-V03]-R59 | View requirement | A technical record and a test show what they implement, prove and run from | "A technical record's Traceability MUST show what it implements, then that record's tests, rolled up, then its other links under their labels. A test's MUST show what it proves (its parent), then its run by: its level, its state, and the file that runs it, flagged when the file is missing, or its manual reason. Any other kind MUST show its links out under their forward labels and its links in under their reverse labels." | UC14-R04, **rewritten** |
| [EXP-V03]-R60 | View requirement | Domain events show what raises them and what hears them | "An aggregate's page MUST list its domain events in their own list titled \"Domain events\", each row one link to the event saying which commands raise it and how many policies hear it, and its list of other children MUST NOT list them again. An event's page MUST show its fields (its `event_field` rows), as an entity's page shows its fields, and its Traceability MUST list \"Raised by\" and \"Heard by\"; a policy MUST list its event under \"Hears\". Every one of these words MUST come from the relations' labels in the schema." | UC14-R06, **rewritten** (`raised_by` and `reacts_to` become `raises` and `hears`) |
| [EXP-V04]-R51 | View requirement | Trace mode shows only the traceability chain and its files | "In trace mode the graph MUST show only the obligation, what designs it (for a UC requirement, the flow steps that fulfill it, the commands and queries they invoke and the views they happen in), the technical records that implement those, the tests under it, and the files those technical records and tests name." | UC10-R01, **rewritten** |
| [EXP-V04]-R52 | View requirement | Trace mode is offered only for obligations | "The trace mode switch MUST be offered when the focused record is an obligation, and MUST NOT be offered for any other kind." | UC10-R02, **rewritten** (was requirements and domain rules) |

### Endpoints and integrations
None of Traceability's own. Coverage reaches the app through `GET /api/spec` (LA-PLT-E01), which exposes LA-PLT's load of the workspace.

## Technical specification

Each record names one file that exists today. Left out, and showing as not built: RM06's projection and table (the app works out a trace on each page) and DS02's service (brief 108 writes it).

| ID | Kind | Implements | File | What in the file | Source |
| --- | --- | --- | --- | --- | --- |
| LA-TRC-A3-REPO | Repository | A3 | lathe/src/store/store.ts | the store's `follows` links and `setting_value` rows | C11, C31 |
| LA-TRC-EN05-DM | Data model | EN05 | lathe/src/store/tables.ts | `FollowsRow` | C31 |
| LA-TRC-EN06-DM | Data model | EN06 | lathe/src/store/tables.ts | `SettingValueRow` | C11 |
| LA-TRC-EN05-TB | Table | EN05 | lathe/schema/010-links.sql | `follows`, storage table | C31 (its `follows` part) |
| LA-TRC-EN06-TB | Table | EN06 | lathe/schema/010-links.sql | `setting_value`, storage table | C11 |
| LA-TRC-SP01-PR | Predicate | SP01 | lathe/src/coverage.ts | the followers step of `owed_pattern_rules` (a domain itself, or its use cases) | C12, C25 |
| LA-TRC-SP02-PR | Predicate | SP02 | lathe/src/coverage.ts | `owed_pattern_rules`' not-applicable step | C12 |
| LA-TRC-SP03-PR | Predicate | SP03 | lathe/src/coverage.ts | `owed_pattern_rules`' applies-when step | C12 |
| LA-TRC-SP04-PR | Predicate | SP04 | lathe/src/coverage.ts | `owed_pattern_rules` | C12 |
| LA-TRC-CMD01-H | Command handler | CMD01 | lathe/src/store/store.ts | `link` on `follows` | to resolve with LA-PLT's write handler |
| LA-TRC-CMD02-H | Command handler | CMD02 | lathe/src/store/store.ts | `add` and `set` on `setting_value` | likewise |
| LA-TRC-RM01-PJ | Projection | RM01 | lathe/src/coverage.ts | `COVERAGE_VIEWS_SQL`: `obligation_kind`, `coverage_item`, `coverage_count`; pattern rules counted for proof alone | C01, C26 |
| LA-TRC-RM02-PJ | Projection | RM02 | lathe/src/coverage.ts | the `coverage_gap` view | C01 |
| LA-TRC-RM03-PJ | Projection | RM03 | lathe/src/coverage.ts | the `coverage_tests` view | C22 |
| LA-TRC-RM04-PJ | Projection | RM04 | lathe/src/coverage.ts | the `owed_pattern_rules` view | C12 |
| LA-TRC-RM05-PJ | Projection | RM05 | lathe/src/index.ts | `gatherFileFacts` | C06 |
| LA-TRC-RM01-TB | Table | RM01 | lathe/src/coverage.ts | `coverage_count`, storage view | C01 |
| LA-TRC-RM02-TB | Table | RM02 | lathe/src/coverage.ts | `coverage_gap`, storage view | C01 |
| LA-TRC-RM03-TB | Table | RM03 | lathe/src/coverage.ts | `coverage_tests`, storage view | C22 |
| LA-TRC-RM04-TB | Table | RM04 | lathe/src/coverage.ts | `owed_pattern_rules`, storage view | C12 |
| LA-TRC-RM05-TB | Table | RM05 | lathe/src/coverage.ts | `file_facts` (`FACT_TABLES_SQL`), storage table, filled by its projection on every load | C06 |
| LA-TRC-QRY01-H | Query handler | QRY01 | lathe/src/index.ts | `computeCoverage`, its obligations (`COVERAGE_COUNTS_SQL`) | C04 |
| LA-TRC-QRY02-H | Query handler | QRY02 | lathe/src/index.ts | `computeCoverage`, its gaps (`COVERAGE_GAPS_SQL`) | C04 |
| LA-TRC-QRY03-H | Query handler | QRY03 | lathe/src/index.ts | `computeCoverage`, its tests (`COVERAGE_TESTS_SQL`) | C04, C22 |
| LA-TRC-QRY04-H | Query handler | QRY04 | app/src/specs/patterns.ts | `patternsFollowedBy`, `followingDomains`, `ruleStatus` | C39 |
| LA-TRC-QRY05-H | Query handler | QRY05 | app/src/specs/trace.ts | `traceOf`, `judge`, `owingDomains`, `isBuilt` | C46 |
| LA-TRC-QRY06-H | Query handler | QRY06 | app/src/graph/model.ts | `traceChain` | LA-EXP-C03, C05's satisfies → UC10 (to resolve) |
| LA-TRC-DS01-SV | Service | DS01 | lathe/src/index.ts | `mentionsId` | C06 |
| LA-UI51 | UI component | renders LA-V51 | app/src/specs/SpecPages.tsx | `ProductWiki` | LA-EXP-C01's implements →TRC-V01 (to resolve: one UI component) |
| LA-UI52 | UI component | renders LA-V51, [EXP-V02] | app/src/specs/ProductHealth.tsx | `CoverageBars`, `obligationGroups`, `ProductSummary`, `TestCountsLine`, `sumTestCounts` | C36, C37, C43, C44 |
| LA-UI53 | UI component | renders [EXP-V03] | app/src/specs/Traceability.tsx | `Traceability` and its gap callouts, requirement table and run by | C45 |
| LA-UI54 | UI component | renders [EXP-V02], [EXP-V03] | app/src/specs/PatternParts.tsx | `DomainPatterns`, `PatternSections`, `PatternRuleSections`, `RuleMarks` | C40 |
| LA-UI55 | UI component | renders [EXP-V02], [EXP-V03], LA-V51 | app/src/specs/parts.tsx | the shared spec parts and `TestStateTag` | C38 |
| LA-UI56 | UI component | renders [EXP-V03], [EXP-V04] | app/src/specs/labels.ts | `linkLabel`, `relationLabelOf`, `groupByLabel` | C47 |
| LA-UI57 | UI component | renders [EXP-V02] | app/src/specs/SpecPages.tsx | `DomainWiki`'s Patterns we follow and Coverage sections | C41 (to resolve with LA-EXP's Domain page component) |

`lathe check`'s coverage and tests-by-state lines (C05, C23) are LA-CHK-CLI01's.

### Tables and keys

| Table | Name | Key | Kind | Columns | Target or invariant |
| --- | --- | --- | --- | --- | --- |
| EN05-TB | follows | (primary) | primary | source_id, target_id | |
| EN06-TB | setting_value | (primary) | primary | follower_id, pattern_id, setting | INV02 |
| EN06-TB | setting_value | (follows) | foreign | follower_id, pattern_id | EN05-TB (INV03) |

`follows.target_id` and `setting_value`'s key to `pattern_setting` point into LA-AUT's pattern tables: no foreign key is recorded (decision 7), though the SQL has them. The views RM01-TB to RM04-TB have no keys; RM05-TB's is its record.

### Check rows (product kind `check_row`, as in la-chk.md)

| ID | Check name | Severity | Reports | Source |
| --- | --- | --- | --- | --- |
| LA-TRC-CK01 | not-designed | warning | UC01-R02 | C02, C13, C27, **rewritten** from `unsatisfied` |
| LA-TRC-CK02 | not-built | warning | UC01-R02, R04 | the row `component-file-missing`, **rewritten** (it had no component) |
| LA-TRC-CK03 | not-proved | warning | UC01-R02, UC02-R03, UC04-R05 | C03, C14, C20, C28, **rewritten** from `unproved` |
| LA-TRC-CK04 | test-file-missing | error, or a warning for a test not automated yet | UC03-R03 | C09's check part, **rewritten** (no key file) |
| LA-TRC-CK05 | test-file-missing-id | error | UC05-R01 | C07, **rewritten** (no key; every automated test) |
| LA-TRC-CK06 | pattern-setting-missing | error | INV04 | C10 |
| LA-TRC-CK07 | pattern-not-followed | warning | UC04-R07 | C15 |
| LA-TRC-CK08 | obligation-outside-domain | warning | UC04-R08 | C16, **rewritten** (constraints count by UC02-R08) |
| LA-TRC-CK09 | pattern-rule-test-outside-followers | error or warning | UC08-R02 | **New**, replacing C33 `proof-counts-nowhere` |
| LA-TRC-CK10 | manual-test-file-silent | warning | UC08-R03 | C34, **rewritten** (the test's ID only) |
| LA-TRC-CK11 | use-case-without-requirements | warning | UC07-R07 | C29 |

CK09 is brief 108's to write; the apply step keeps it only if its row exists. The other names are proposals for the rewritten rows.

### Meets
LA-TRC-C02's and C03's meets of LA-STD-CODE-R01 go to LA-CHK-EN01-TB, the `check` table, since a product kind cannot be a `meets` source (see la-chk.md).

## Test plan

Levels as in la-chk.md: `lathe/test/` tests run the engine in process through its package API, **api** for use case tests and **database** for invariant and specification tests; tests that spawn `lathe` are **e2e-api**; the app's vitest tests are **unit**, as view tests. All automated unless marked. Each test's `it` name changes to its new ID.

### Invariant and specification tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| LA-TRC-INV01-T | INV01 | database, lathe/test/capabilities.test.ts | T18 |
| LA-TRC-INV02-T | INV02 | database, lathe/test/capabilities.test.ts | T19 |
| LA-TRC-INV03-T | INV03 | database, not automated yet | **New** |
| LA-TRC-INV04-T | INV04 | database, lathe/test/capabilities.test.ts | T17 |
| LA-TRC-SP01-T | SP01 | database, lathe/test/patterns-like-s2.test.ts | T52 |
| LA-TRC-SP02-T | SP02 | database, lathe/test/pattern-rules.test.ts | T25 |
| LA-TRC-SP03-T | SP03 | database, lathe/test/groups-and-waivers.test.ts | T118 |
| LA-TRC-SP04-T | SP04 | database, lathe/test/pattern-rules.test.ts | T21 |

### Domain service tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| LA-TRC-DS01-T01 | DS01 | unit, not automated yet | **New**: `mentionsId` alone (T11 and T42 prove it through a load, as a use case test) |
| LA-TRC-DS02-T01 | DS02 | unit, not automated yet | **New** |

### Use case tests

| ID | Parent | Run by | Source |
| --- | --- | --- | --- |
| UC01-R01-T01 | UC01-R01 | api, lathe/test/checks.test.ts | T01, its counts |
| UC01-R02-T01 | UC01-R02 | api, lathe/test/checks.test.ts | T01, its gaps |
| UC01-R02-T02 | UC01-R02 | api, lathe/test/product-checks.test.ts | T45 |
| UC01-R03-T01 | UC01-R03 | api, lathe/test/checks.test.ts | T03 |
| UC01-R04-T01 | UC01-R04 | api, lathe/test/checks.test.ts | T02 |
| UC02-R01-T01 | UC02-R01 | api, lathe/test/coverage.test.ts | T04 |
| UC02-R02-T01 | UC02-R02 | api, lathe/test/coverage.test.ts | T06 |
| UC02-R03-T01 | UC02-R03 | api, lathe/test/coverage.test.ts | T05 |
| UC02-R05-T01 | UC02-R05 | e2e-api, lathe/test/coverage.test.ts | T08 |
| UC02-R06-T01 | UC02-R06 | api, lathe/test/coverage.test.ts | T07 |
| UC02-R07-T01 | UC02-R07 | api, not automated yet | **New** |
| UC02-R08-T01 | UC02-R08 | api, not automated yet | **New** |
| UC03-R01-T01 | UC03-R01 | to resolve | LA-AUT-T17's part |
| UC03-R02-T01 | UC03-R02 | api, lathe/test/tests-and-meta.test.ts | T12 |
| UC03-R02-T02 | UC03-R02 | api, lathe/test/tests-and-meta.test.ts | T15 |
| UC03-R03-T01 | UC03-R03 | api, lathe/test/tests-and-meta.test.ts | T13 |
| UC03-R03-T02 | UC03-R03 | api, lathe/test/tests-and-meta.test.ts | T16 |
| UC03-R06-T01 | UC03-R06 | api, not automated yet | **New** |
| UC04-R01-T01 | UC04-R01 | api, lathe/test/pattern-rules.test.ts | T20 |
| UC04-R02-T01 | UC04-R02 | api, lathe/test/pattern-rules.test.ts | T22 |
| UC04-R03-T01 | UC04-R03 | api, lathe/test/pattern-rules.test.ts | T23 |
| UC04-R03-T02 | UC04-R03 | api, lathe/test/pattern-rules.test.ts | T24, **rewritten**: not automated yet per domain (no built for pattern rules) |
| UC04-R03-T03 | UC04-R03 | api, lathe/test/pattern-rules.test.ts | T35 |
| UC04-R04-T01 | UC04-R04 | api, lathe/test/pattern-rules.test.ts | T26 |
| UC04-R04-T02 | UC04-R04 | api, lathe/test/pattern-rules.test.ts | T27 |
| UC04-R05-T01 | UC04-R05 | api, lathe/test/pattern-rules.test.ts | T28 |
| UC04-R05-T02 | UC04-R05 | api, lathe/test/pattern-rules.test.ts | T30 |
| UC04-R06-T01 | UC04-R06 | api, lathe/test/pattern-rules.test.ts | T31 |
| UC04-R06-T02 | UC04-R06 | to resolve | LA-AUT-T32's part |
| UC04-R07-T01 | UC04-R07 | api, lathe/test/pattern-rules.test.ts | T32 |
| UC04-R07-T02 | UC04-R07 | api, lathe/test/pattern-rules.test.ts | T33 |
| UC04-R08-T01 | UC04-R08 | api, lathe/test/pattern-rules.test.ts | T34 |
| UC04-R09-T01 | UC04-R09 | api, lathe/test/groups-and-waivers.test.ts | T119 |
| UC05-R01-T01 | UC05-R01 | api, lathe/test/proof-claims.test.ts | T43 |
| UC05-R01-T02 | UC05-R01 | api, lathe/test/tests-and-meta.test.ts | T10, **rewritten** |
| UC05-R01-T03 | UC05-R01 | api, lathe/test/tests-and-meta.test.ts | T11 and T42 (a whole ID only), merged |
| UC05-R01-T04 | UC05-R01 | api, lathe/test/proof-claims.test.ts | T36 |
| UC05-R05-T01 | UC05-R05 | api, lathe/test/tests-and-meta.test.ts | T14 |
| UC05-R05-T02 | UC05-R05 | api, lathe/test/proof-claims.test.ts | T44 |
| UC06-R02-T01 | UC06-R02 | api, lathe/test/owed-proof.test.ts | T48 |
| UC06-R03-T01 | UC06-R03 | e2e-api, lathe/test/owed-proof.test.ts | T50, **rewritten** (no owed-proof part) |
| UC07-R01-T01 | UC07-R01 | api, lathe/test/patterns-like-s2.test.ts | T51 |
| UC07-R02-T01 | UC07-R02 | api, lathe/test/patterns-like-s2.test.ts | T53 |
| UC07-R02-T02 | UC07-R02 | api, lathe/test/patterns-like-s2.test.ts | T54 |
| UC07-R03-T01 | UC07-R03 | api, lathe/test/patterns-like-s2.test.ts | T55 |
| UC07-R04-T01 | UC07-R04 | api, lathe/test/patterns-like-s2.test.ts | T59, **rewritten** (no proof-only kind) |
| UC07-R04-T02 | UC07-R04 | to resolve | LA-AUT-T56's part |
| UC07-R05-T01 | UC07-R05 | api, lathe/test/patterns-like-s2.test.ts | T56 |
| UC07-R05-T02 | UC07-R05 | api, lathe/test/patterns-like-s2.test.ts | T57 |
| UC07-R05-T03 | UC07-R05 | api, lathe/test/patterns-like-s2.test.ts | T64 |
| UC07-R06-T01 | UC07-R06 | api, lathe/test/patterns-like-s2.test.ts | T58 |
| UC07-R07-T01 | UC07-R07 | api, lathe/test/patterns-like-s2.test.ts | T60 |
| UC08-R02-T01 | UC08-R02 | api, lathe/test/owed-and-silent.test.ts | T69, **rewritten** for pattern rule tests |
| UC08-R02-T02 | UC08-R02 | api, lathe/test/owed-and-silent.test.ts | T70, likewise |
| UC08-R02-T03 | UC08-R02 | api, lathe/test/owed-and-silent.test.ts | T71, likewise |
| UC08-R02-T04 | UC08-R02 | api, lathe/test/owed-and-silent.test.ts | T72, likewise |
| UC08-R02-T05 | UC08-R02 | api, lathe/test/owed-and-silent.test.ts | T73, likewise: a test in an owing domain is not reported |
| UC08-R03-T01 | UC08-R03 | api, lathe/test/owed-and-silent.test.ts | T74 |
| UC08-R03-T02 | UC08-R03 | api, lathe/test/owed-and-silent.test.ts | T75 |
| UC08-R03-T03 | UC08-R03 | api, lathe/test/owed-and-silent.test.ts | LA-CHK-T31, its silent-file part |

IDs in full start `LA-TRC-`.

### View tests

All unit, automated, in `app/test/`.

| ID | Parent | File | Source |
| --- | --- | --- | --- |
| LA-V51-R01-T01 | LA-V51-R01 | product-page.test.tsx | T82 |
| LA-V51-R01-T02 | LA-V51-R01 | product-page.test.tsx | T83 |
| LA-V51-R02-T01 | LA-V51-R02 | product-page.test.tsx | T84 |
| LA-V51-R03-T01 | LA-V51-R03 | product-page.test.tsx | T85 |
| LA-V51-R03-T02 | LA-V51-R03 | obligations.test.tsx | T90 |
| LA-V51-R03-T03 | LA-V51-R03 | owed-proof.test.tsx | T110, **rewritten** (no owed note) |
| LA-V51-R04-T01 | LA-V51-R04 | owed-proof.test.tsx | T109 |
| [EXP-V02]-R51-T01 | [EXP-V02]-R51 | obligations.test.tsx | T89 |
| [EXP-V02]-R51-T02 | [EXP-V02]-R51 | patterns.test.tsx | T103 |
| [EXP-V02]-R52-T01 | [EXP-V02]-R52 | obligations.test.tsx | T91, **rewritten** for view and API requirements |
| [EXP-V02]-R53-T01 | [EXP-V02]-R53 | obligations.test.tsx | T92 |
| [EXP-V02]-R54-T01 | [EXP-V02]-R54 | patterns.test.tsx | T98 |
| [EXP-V02]-R54-T02 | [EXP-V02]-R54 | patterns.test.tsx | T99, **rewritten** (proof only) |
| [EXP-V02]-R54-T03 | [EXP-V02]-R54 | patterns.test.tsx | T101 |
| [EXP-V02]-R54-T04 | [EXP-V02]-R54 | patterns.test.tsx | T104 |
| [EXP-V02]-R54-T05 | [EXP-V02]-R54 | patterns.test.tsx | T111 |
| [EXP-V02]-R55-T01 | [EXP-V02]-R55 | patterns.test.tsx | T100 |
| [EXP-V02]-R55-T02 | [EXP-V02]-R55 | patterns.test.tsx | T102 |
| [EXP-V02]-R56-T01 | [EXP-V02]-R56 | groups-and-waivers.test.tsx | T120 |
| [EXP-V03]-R51-T01 | [EXP-V03]-R51 | obligations.test.tsx | T93 |
| [EXP-V03]-R52-T01 | [EXP-V03]-R52 | obligations.test.tsx | T95 |
| [EXP-V03]-R53-T01 | [EXP-V03]-R53 | long-list.test.tsx | T96 |
| [EXP-V03]-R53-T02 | [EXP-V03]-R53 | long-list.test.tsx | T97 |
| [EXP-V03]-R54-T01 | [EXP-V03]-R54 | patterns.test.tsx | T105 |
| [EXP-V03]-R54-T02 | [EXP-V03]-R54 | patterns.test.tsx | T106 |
| [EXP-V03]-R55-T01 | [EXP-V03]-R55 | patterns.test.tsx | T107 |
| [EXP-V03]-R56-T01 | [EXP-V03]-R56 | traceability.test.tsx | T112 |
| [EXP-V03]-R57-T01 | [EXP-V03]-R57 | traceability.test.tsx | T113 |
| [EXP-V03]-R58-T01 | [EXP-V03]-R58 | traceability.test.tsx | T114 |
| [EXP-V03]-R59-T01 | [EXP-V03]-R59 | traceability.test.tsx | T115 |
| [EXP-V03]-R60-T01 | [EXP-V03]-R60 | to resolve | LA-PLT-T86's part |
| [EXP-V04]-R51-T01 | [EXP-V04]-R51 | graph/model.test.ts | T86 |
| [EXP-V04]-R51-T02 | [EXP-V04]-R51 | graph/GraphPage.test.tsx | T88 |
| [EXP-V04]-R52-T01 | [EXP-V04]-R52 | graph/model.test.ts | T87 |

### Flow, pattern rule and other tests
None exist. No old test walks a whole flow, so each of the fourteen flows shows as having no flow test.

## Counts

| Kind | Count | Kind | Count |
| --- | --- | --- | --- |
| Domain | 1 | Repository | 1 |
| Aggregate | 1 | Data model | 2 |
| Entity | 2 | Table | 7 |
| Entity field | 5 | Predicate | 4 |
| Value object | 0 | Projection | 5 |
| Invariant | 4 | Command handler | 2 |
| Specification | 4 | Query handler | 6 |
| Domain event | 0 | Service | 1 |
| Command | 2 | UI component | 7 |
| Read model | 6 | Check row (product kind) | 11 (1 new) |
| Read model field | 27 | Invariant test | 4 (1 new) |
| Query | 6 | Specification test | 4 |
| Policy | 0 | Domain service test | 2 (new) |
| Domain service | 2 | Use case test | 60 (3 new, 3 to resolve) |
| Term | 12 | View test | 34 (1 to resolve) |
| Capability | 3 | Flow | 14 |
| Use case | 14 | Flow step | 54 |
| UC requirement | 37 (of the old 71: 11 retired, 25 moved, 1 merged; 3 new) | View | 1 |
| View requirement | 22 | Integration | 0 |

104 tests: 94 from 93 of the domain's 120 old tests and LA-CHK-T31 (T01 splits; T11 and T42 merge), 6 new, and 4 whose source is another domain's test.

## Judgment calls and rewrites

1. **Subdomain type core.** Knowing what is designed, built and proved is Lathe's edge.
2. **Coverage is read models, not an aggregate.** A1's counts, gaps and tests by state are worked out on every load and written by nothing, so they become RM01 to RM03, read by QRY01 to QRY03. EN07 Owed pattern rule likewise becomes RM04.
3. **A2 Proof claim and EN04 retire.** A test now proves exactly its parent, so there is no claim to back. What survives is that an automated test's file names the test's ID (UC05-R01) and the file facts (RM05).
4. **Retired with the old proof model:** `supports` (UC03-R04, DR28, DR29), `key` and `key_file` (UC03-R05, UC05-R03, DR13, DR30, DR31), `proof-not-in-file` (UC05-R02, DR12), `planned_any` and `proof-still-owed` (UC06-R01, UC08-R01, UC13-R01, DR16, DR24, DR25, DR36), proof-only obligation kinds (`meta_kind.obligation` is a yes or no now; pattern rules keep "proof alone" as UC07-R05), pattern rules fulfilled by flows (UC07-R08, R09). The Owner may want "proof still owed" back: with one parent per test, an obligation's tests are listed under it, so a test not automated yet beside an automated one is in plain sight.
5. **Planned becomes not automated yet** everywhere: state, counts, bars and words.
6. **The Reader use cases' requirements become view requirements** (UC09 to UC14: 25 moved, 1 merged, 2 retired). Each says what a page shows, and is proved by an app test (unit), which a view test allows and a use case test does not. The Reader use cases keep their goals and flows, with no UC requirements of their own; `use-case-without-requirements` will warn on each of them. The alternative is to keep one goal-level UC requirement each, proved by a future e2e-ui test.
7. **View requirements sit under LA-EXP's views** (Domain page, Record page, Graph) where those pages show them, numbered from R51 so they don't clash with LA-EXP's own.
8. **Pattern following stays here, as A3,** with two commands, though `follows` and `setting_value` are written through the generic command layer. Pattern rules and settings stay LA-AUT's.
9. **The owed-pattern-rule logic becomes four specifications** (SP01 to SP04) over A3, with one predicate each in `owed_pattern_rules`. The app works out the same standing itself in `patterns.ts` (QRY04-H): see Findings.
10. **Constraints count in each domain that uses their value object** (UC02-R08), since value objects belong to no domain. The plan doesn't say where they count.
11. **Rules sorted:** DR05 → INV01, INV04; DR06 → INV02; DR07, DR19, DR21 → SP04; DR09, DR35 → SP02; DR20 → SP01, SP04; DR39 → SP03; DR04 → DS01, UC05-R01; DR01, DR03 → UC02-R02, UC01-R04; DR02 → UC02-R03; DR08, DR18 → UC04-R03; DR10 → UC04-R07, R08; DR11, DR14 → UC05-R01, R05; DR15 → UC01-R02; DR17 → UC06-R02; DR22 → UC07-R05; DR23 → UC07-R07; DR26 → UC08-R02; DR27 → UC08-R03; DR32 → LA-V51-R01, [EXP-V02]-R51; DR33 → [EXP-V02]-R53, [EXP-V03]-R51; DR34 → [EXP-V02]-R54; DR37 → [EXP-V03]-R57; DR38 → [EXP-V03]-R56. Retired as in call 4: DR12, DR13, DR16, DR24, DR25, DR28 to DR31, DR36.
12. **Check renames:** `unsatisfied` → `not-designed`, `unproved` → `not-proved`, `component-file-missing` → `not-built`; `proof-counts-nowhere` → `pattern-rule-test-outside-followers`. Retired rows: `proof-not-in-file`, `proof-still-owed`, `flow-step-fulfills-outside-flow`. Names are proposals; brief 108's rows decide them.
13. **DS02 Allowed test levels** holds brief 108's levels as a domain service that coverage and LA-CHK's `test-level-not-allowed` both read.
14. **Old tests split by what they prove.** Dropped, with their retired behavior: T09, T29, T37 to T41, T46, T47, T49, T61 to T63, T65 to T68, T76 to T81, T94, T108, T116, T117 (27). T09 asked that a file need not name its test, the opposite of UC05-R01 now; T29 asked for design of pattern rules, which need proof only; T117 showed domain rules' `involves`.
15. **Six new tests are not automated yet:** INV03, the two domain services, UC02-R07, UC02-R08 and UC03-R06.

## Findings in the code
- **Pattern standing is worked out twice:** in the engine's `owed_pattern_rules` view (lathe/src/coverage.ts) and again in the app's `patterns.ts`. QRY04 should read the engine's RM04, so the two never disagree.
- **The app works out each trace itself** (`traceOf`, `traceChain`): RM06 has no projection or table.
- **Code to remove when the engine and app cut over:** `planned_any` and `morePlanned`/`MorePlanned` (C21, C42, C44's owed note), the `supports`, `key` and `key_file` handling in `gatherFileFacts` (C19, C35), `file_mentions`, `proof_only` (C24, C26), and the proof checks' rows (C18, C32, C33).
- **`file_mentions` serves nothing in the new model:** only `proof-not-in-file` and `manual-test-file-silent`'s proved-ID half read it.

## What the plan didn't cover
| Need | Suggestion |
| --- | --- |
| Read models and specifications that read every domain's records (coverage, file facts, traces) and LA-AUT's patterns, while `reads` is domain-scoped | As in la-chk.md: record Lathe's store as a shared kernel these read, one exception each |
| Where a constraint counts, since its value object belongs to no domain, and in which domain its test is counted by state | UC02-R08: in each domain that uses the value object; its test in the product's summary |
| What "designed" means for each obligation kind other than a UC requirement | UC02-R02: the technical record of its kind exists; brief 108 settles it |
| A follower that may be either of two aggregates | EN05's Follower is text; a field typed by one of several aggregates would say it |
| Reader goals whose every requirement is about a page | View requirements (judgment call 6) |
| Owed proof beside existing proof (`planned_any`) | Retired (judgment call 4); the Owner may ask for it back |

## Cross-domain links to resolve

| Here | Names | What to resolve |
| --- | --- | --- |
| EN05 field 2 | [AUT-A5] Pattern | the new ID of LA-AUT-A5 |
| RM01–RM04 Domain fields | [AUT-A2] Domain | the new ID of LA-AUT-A2 |
| UC03-FL-S01, UC04-FL-S04 | [AUT-add-test] | LA-AUT's command that adds a test |
| UC04-FL-S01 | [AUT-add-pattern-rule] | LA-AUT's command that adds a pattern rule |
| CMD01-H, CMD02-H | LA-PLT's write handler | the same `store.ts` writes |
| Views [EXP-V02], [EXP-V03], [EXP-V04], [AUT-V03] | LA-EXP-V02 Domain page, V03 Record page, V04 Graph view; LA-AUT-V03 Check page | their new IDs; numbering under them from R51 |
| UC14-R05 | LA-EXP-V03-R07 | merged into it; its tests (T112's labels part, LA-EXP-T07, T135) go with it |
| [EXP-V03]-R60-T01 | LA-PLT-T86 | its part |
| UC03-R01-T01, UC04-R06-T02, UC07-R04-T02 | LA-AUT-T17, T32, T56 | their parts |
| QRY06-H | LA-EXP-C03, C05 satisfied UC10 | one record for `traceChain` |
| LA-UI51, LA-UI57 | LA-EXP-C01 (SpecPages.tsx) | one UI component per page |
| LA-UI55, UI56 | LA-EXP-C07, C08, C25, C50 depended on C38; LA-EXP-V03-R07 on C47 | LA-EXP may claim them |
| LA-TRC-F03 carried out LA-EXP-UC01, UC02, UC09 and fulfilled LA-EXP-UC02-R02 | LA-EXP's flows | their own flows |
| LA-EXP-F01 carried out UC10; LA-AUT-F03 carried out UC07 | LA-EXP's and LA-AUT's sheets | UC10-FL and UC07-FL are new here |
| LA-PLT-F05 used TRC-V01 | LA-PLT's steps | they happen in LA-V51 |
| Tests proving LA-AUT records (T04, T06 → AUT-DR12; T17, T18, T19 → AUT-UC05-R06, R07; T55 → AUT-DR32; T58, T64 → AUT-DR34; T59 → AUT-DR33; T62, T63 → AUT-DR35) and LA-EXP-DR27 (T112) | LA-AUT's and LA-EXP's sheets | their parts of these tests |
| Components satisfying LA-AUT, LA-EXP and LA-PAT records (C01–C03, C10, C11, C24, C30 → AUT; C40, C45, C47 → EXP; C45 → LA-PAT-APP-UX-R05) | those sheets | how each is built now |
| applies TRC-UC→AUT, EXP, CHK rules; AUT-UC05, UC13 → TRC-DR05, DR06, DR28–DR31 | | dropped (as all `applies`) |

## Accounted for

### Records

| Old | Count | Where it went |
| --- | --- | --- |
| domain LA-TRC | 1 | LA-TRC, subdomain core, description rewritten |
| aggregate A1 Coverage | 1 | RM01–RM03 (judgment call 2) |
| aggregate A2 Proof claim | 1 | retired (judgment call 3) |
| aggregate A3 Pattern following | 1 | A3 |
| entity EN01 | 1 | RM03 (and RM01's Domain) |
| entity EN02 | 1 | RM01 |
| entity EN03 | 1 | RM02 |
| entity EN04 | 1 | retired; its file facts → RM05 |
| entity EN05, EN06 | 2 | EN05, EN06 |
| entity EN07 | 1 | RM04 |
| entity_field EN01 1–4 | 4 | RM01 field 1; RM03 fields 1–4 |
| entity_field EN02 1–7 | 7 | RM01 fields 2–7; field 7 Still owed retired |
| entity_field EN03 1–3 | 3 | RM02 fields 2–4 |
| entity_field EN04 1–7 | 7 | fields 1, 5, 6 → RM05 fields 1, 2, 4; fields 2, 3, 4, 7 retired (claim, relation, state, counts in) |
| entity_field EN05 1–3 | 3 | EN05 fields 1, 2; field 3 → SP01 |
| entity_field EN06 1–2 | 2 | EN06 fields 1–3 (field 2 split) |
| entity_field EN07 1–2 | 2 | RM04 fields 2, 3 |
| domain_rule DR01–DR39 | 39 | judgment call 11; retired ones in call 4 |
| capability CAP01–CAP03 | 3 | descriptions rewritten |
| use_case UC01–UC14 | 14 | goals rewritten except UC09; six retitled |
| use_case_actor | 20 | unchanged |
| use_case_step UC03 ×3, UC05 ×3 | 6 | UC03-FL-S02–S04, UC05-FL-S01–S03 |
| requirement (71) | 71 | UC requirements table: 34 kept (unchanged or rewritten), 11 retired, 25 moved to view requirements, 1 merged into LA-EXP-V03-R07 |
| flow F01 | 1 | split: UC01-FL, UC02-FL, UC04-FL, UC08-FL |
| flow F02 | 1 | UC06-FL |
| flow F03 | 1 | UC09-FL, UC14-FL; its LA-EXP use cases to resolve |
| flow F04, F05, F06 | 3 | UC11-FL, UC12-FL, UC13-FL |
| view TRC-V01 | 1 | LA-V51 |
| layer LAY01–LAY06 | 6 | dropped: layers go |
| component C01 | 1 | RM01-PJ, RM02-PJ, RM01-TB, RM02-TB |
| component C02, C13, C27 | 3 | CK01 |
| component C03, C14, C20, C28 | 4 | CK03 |
| component C04 | 1 | QRY01-H, QRY02-H, QRY03-H; `readRecords` to resolve with LA-PLT |
| component C05, C23 | 2 | LA-CHK-CLI01; C23's owed part retired |
| component C06 | 1 | RM05-PJ, RM05-TB, DS01-SV |
| component C07 | 1 | CK05 |
| component C08, C09 | 2 | the test tables' run by columns, LA-AUT's (to resolve); C09's check → CK04 |
| component C10 | 1 | CK06 |
| component C11 | 1 | EN06-TB, EN06-DM, A3-REPO |
| component C12 | 1 | RM04-PJ, RM04-TB, SP01-PR–SP04-PR |
| component C15 | 1 | CK07 |
| component C16 | 1 | CK08 |
| component C17 | 1 | LA-AUT's pattern rule table (to resolve) |
| component C18, C19, C21, C32, C33, C35 | 6 | retired (judgment call 4); C33's role → CK09 |
| component C22 | 1 | RM03-PJ, RM03-TB |
| component C24 | 1 | to resolve with LA-PLT's workspace loader; `proof_only` retired |
| component C25 | 1 | SP01-PR |
| component C26 | 1 | RM01-PJ (proof alone for pattern rules) |
| component C29 | 1 | CK11 |
| component C30 | 1 | retired (UC07-R09) |
| component C31 | 1 | EN05-TB, EN05-DM; its `fulfills` and `supports` parts retired |
| component C34 | 1 | CK10 |
| component C36, C37, C43, C44 | 4 | LA-UI52 |
| component C38 | 1 | LA-UI55 |
| component C39 | 1 | QRY04-H |
| component C40 | 1 | LA-UI54 |
| component C41 | 1 | LA-UI57 |
| component C42 | 1 | retired with `planned_any` |
| component C45 | 1 | LA-UI53 |
| component C46 | 1 | QRY05-H |
| component C47 | 1 | LA-UI56 |
| test (120) | 120 | 93 to the Test plan above; 27 dropped (judgment call 14) |

### Links

| Old link | Rows | Where it went |
| --- | --- | --- |
| has_many EN01→EN02, EN01→EN03, EN05→EN07 | 3 | dropped with the entities that became read models |
| has_many EN05→EN06 | 1 | unchanged |
| relates_to TRC-A1→EXP-A1, PLT-A1; TRC-A2→PLT-A1, TRC-A1; TRC-A3→PLT-A1, TRC-A1 | 6 | dropped: A1 and A2 go; A3's references are EN05's fields |
| reacts_to TRC-A1→LA-CHK-EV02 | 1 | dropped with the event (la-chk.md) |
| applies TRC-UC→TRC-DR | 34 | dropped: a use case changes nothing |
| applies TRC-UC→AUT, CHK, EXP rules; AUT-UC→TRC-DR | 19 | dropped, likewise |
| carries_out TRC-F01→UC01, UC02, UC04, UC08 | 4 | each use case's own flow |
| carries_out TRC-F02→UC06, F04→UC11, F05→UC12, F06→UC13 | 4 | each flow's parent |
| carries_out TRC-F03→UC09, UC14 | 2 | UC09-FL, UC14-FL |
| carries_out TRC-F03→EXP-UC01, UC02, UC09 | 3 | to resolve in LA-EXP's flows |
| carries_out EXP-F01→UC10, AUT-F03→UC07, CHK-F01→UC03, UC05 | 4 | UC10-FL, UC07-FL, UC03-FL, UC05-FL |
| fulfills TRC-F02→UC06-R01, R02, R03 | 3 | UC06-FL-S01, S02 (R01 retired) |
| fulfills TRC-F04, F06, TRC-V01, EXP-F01, EXP-V02, EXP-V04 → UC09–UC13 requirements | 13 | dropped: those requirements are view requirements under their views |
| fulfills EXP-V03-R04, R05, R07 → UC12-R01, UC14-R05 | 3 | dropped: interaction requirements fulfill nothing |
| fulfills TRC-F03→EXP-UC02-R02 | 1 | to resolve in LA-EXP's flow |
| uses TRC-F03, F04, F06 → EXP-V01, V02, V03, PLT-E01, TRC-V01 | 11 | their steps happen in those views; the endpoint follows from the queries |
| uses TRC-V01→PLT-E01 | 1 | dropped: follows from the steps |
| uses PLT-F05→TRC-V01 | 1 | to resolve: LA-PLT's step happens in LA-V51 |
| uses LA-CHK-DF01-S03, S06 → TRC-C01, C04, C06 | 3 | dropped with DF01 (la-chk.md) |
| implements EXP-C01→TRC-V01 | 1 | LA-UI51 renders LA-V51 (to resolve) |
| depends_on TRC-C↔TRC-C | 15 | dropped: follows from the tree |
| depends_on TRC-C↔EXP, PLT, CHK components | 15 | dropped, likewise |
| meets TRC-C02, C03 → STD-CODE-R01 | 2 | LA-CHK-EN01-TB meets it |
| satisfies TRC-C→TRC obligations | 138 | replaced by the technical records above |
| satisfies TRC-C→AUT, CHK, EXP, PAT obligations | 16 | dropped; each built through its own domain's records (to resolve) |
| satisfies AUT-, CHK-, EXP-, PLT-C → TRC obligations | 25 | dropped likewise |
| proves TRC-T→TRC records | 193 | each new test's parent (Test plan) |
| proves TRC-T→AUT, EXP records | 12 | their parts to resolve in LA-AUT's and LA-EXP's sheets |
| proves AUT-, EXP-, PLT-T → TRC records | 7 | to resolve: their parts become UC03-R01, UC04-R06, UC07-R04 tests, [EXP-V03]-R60's, and LA-EXP-V03-R07's |

## Applied (brief 111)
Brief 111 wrote this sheet into `data/` with the other four; [la-id-map.json](la-id-map.json) maps every old ID to its new one (null for a dropped one). What it resolved here:
- **Numbers:** LA-V51, LA-UI52–UI54 and UI56 stand; LA-UI51 and UI57 are LA-UI90 (`SpecPages.tsx`), LA-UI55 is LA-UI100 (`parts.tsx`). `[EXP-V02]`, `[EXP-V03]`, `[EXP-V04]` are LA-V91, LA-V92, LA-V93; `[AUT-A2]` and `[AUT-A5]` are LA-AUT-A1.
- **Reader use cases keep an outcome:** UC09-R06, UC10-R03, UC11-R08, UC12-R07, UC13-R04 and UC14-R07, each proved by a manual use case test.
- **[AUT-add-test]** and **[AUT-add-pattern-rule]** are `LA-AUT-CMD01`. QRY04 selects by SP01–SP04.
- **Read models** RM01–RM06 are `fed_by` LA-AUT-EV01, EV03, LA-CHK-EV01 and LA-PLT-EV06.
- **Check rows:** CK08 and CK11 are gone (no such rows); `technical-file-missing` is CK12.
