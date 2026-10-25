# Trial 4: how close Lathe is to S2's organization

Trial 4 converted three whole S2 domains into Lathe records and checked them, to measure what Lathe can organize as well as S2 does since trial 3. It added capabilities, folders, layers, entities and domain events, the structure-size checks, relation labels, the generated reference, test-plan grouping by proof, and the Model view. This page holds findings only, in general terms. It has no requirement text, business rules, IDs, or client or partner names. The converted records, the converter and its outputs stay in the session's scratch folder, outside the repo.

## 1. What was converted

A converter read each domain's S2 folder tree and wrote one Lathe trial root per domain. Each root holds the product, the patterns that domain adopts, and the domain. Record bodies are S2's own text, so the prose checks ran on real material. Code paths resolve through read-only links to S2's code, so `run_by`, `key` and `file` were checked against the real files.

| Domain shape | S2 files | Lathe records | Links | Aggregates / entities | Use cases (capabilities) | Flow steps | Components (layers) | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A: small administrative domain with an outside sign-in provider | 67 | 472 | 663 | 2 / 3 | 8 (2) | 72 | 53 (6) | 192 |
| B: scheduled-job domain that produces files and sends them | 72 | 807 | 1,179 | 2 / 6 | 9 (5) | 100 | 72 (6) | 316 |
| C: batch-pipeline domain (extract, load, record views) | 121 | 1,179 | 1,781 | 8 / 13 | 15 (8) | 150 | 172 (7) | 441 |

Every stage was converted: entities with their Fields tables, domain rules, relationships, capabilities, use cases with their requirements, applied rules and pattern settings, views, endpoints, integrations, flows with every step of every path, layers and components, and every test family. These families are domain rule tests, pattern proofs, acceptance scenarios, UI tests, contract tests, engineering checks and design checks.

The only meta-model extension was an `integration` kind under the domain, with `interaction_requirement` widened to sit under it. `lathe check` on the smallest root takes about 1.3 seconds. `lathe format` ran cleanly on each root and showed the extension.

## 2. Scorecard

The grade is how well Lathe holds S2's organization for that area: 5 means everything S2 states is structured and checked, and 1 means prose only.

| Area | Grade | Trial 3 | What holds | What is still prose or lost |
| --- | --- | --- | --- | --- |
| Domain model | 4 | 2 | Aggregates, entities with Fields tables, root and child roles, and has/refers links. The ERD matches S2's aggregate diagrams. Every rule count matches S2 (98 of 98 rules in all). | Rules belong to the aggregate, not to the entity that S2 attaches them to. A relationship has no verb, no optional or required end, and only one link per pair. 11 entities keep value tables and state transitions as prose. S2's Fields column name differs from Lathe's by one word. |
| Use cases | 4 | 3 | Capabilities, use cases, requirements, applied rules and pattern settings (165 settings). Requirement counts and proof match S2 (206 of 206 proved). | 93 requirement groups (S2's subsections of a use case) have no level, so 4 use cases hold 20 to 27 requirements in one list. Business stages, access tables and information sets stay as prose. Each requirement's level and stage are unchecked plain fields. |
| Interaction design | 3 | 2 | Views, endpoints, flows, and flow steps with their own `uses` and `fulfills` links (322 steps). | Each flow has 2 to 5 paths (main, API, scheduled, and alternatives), and they collapse into one order. S2 groups endpoints by API file, with shared shapes (83) and file-level requirements; Lathe has no such level. Views have parts (74), with no level for them. Integrations needed an extension. An interaction requirement cannot fulfill a use case's goal. |
| Technical specification | 3 | 2 | Layers and components with real files, and satisfies links derived from component sections and technical-flow steps. Built coverage is right. | 31 technical flows have no kind. Their steps (component and method, transaction and locks, statement counts), failure tables, limits and signals are lost. Sub-layers (S2's numbered sub-files) have no level, so 7 layers hold 21 to 57 components. Non-code items (gateway routes, secrets, settings) have no home. |
| Test plan | 3 | 3 | Every test family converts, with `state`, `key` and `run_by`. Rules with a planned pattern proof match S2's "still needed" count in domains B and C (19 and 16). | Grouping by proof scatters S2's families (section 5). Engineering checks have no relation of their own. A `key` cannot follow a shared test class more than one import away. |
| Traceability | 4 | 3 | Coverage agrees with S2's generated report for UC requirements and domain rules in all three domains, and for pattern rules in domain A (26 proved, 25 still owed, both exactly as in S2). Prose citations now resolve S2's own IDs: 2,261 citations were read. | Pattern-rule proof falls short in B and C (sections 4.3 and 4.5). Design citations that sit only in a technical flow or an overview are lost. |
| Standards and patterns | 3 | 3 | Patterns, pattern rules, domain-level and use-case-level adoption, settings, and owed proofs: the count of rules with a planned proof matches S2's "pattern proofs still needed" count in domains B and C. | S2's engineering standards (a separate library of rule IDs that components and flows cite) have no kind. A rule cannot be made not applicable by a setting's value. Pattern rules have no groups (one pattern holds 80). |

## 3. What Lathe checks that S2 checks only by hand

- **Typed links.** Every link is checked against the meta-model's allowed kind pairs. In S2 a link is a Markdown link with an ID in its text, and its kind is never checked.
- **Steps inside their flow.** `flow-step-fulfills-outside-flow` checks that each step fulfills only what its flow's use cases, rules and patterns owe. S2 checks this only for scenarios.
- **Aggregate shape.** S2 checks that its diagrams match the relationships table. Lathe also checks one root per aggregate, that every child is reachable from the root, and that no part crosses an aggregate.
- **A proof claim per ID.** S2 counts a proof when the file carries the rule marker. Lathe checks each ID a test claims (or its key) separately.
- **Unproved interaction requirements.** In all three domains, S2's report lists 8 interaction requirements with no covering test, but does not count them as a gap. Lathe warns on each.
- **Size and shape of each level.** `too-many-children` found 23 places, and in 21 of them S2 does have a level that Lathe lacks (section 6).
- **Orders, sections and folders.** Capability and layer order, a kind's folder and stage, and every check's documentation are checked. S2 keeps these by convention.

## 4. Top 10 gaps, ranked

Sizes: **S** is a meta-model row or one check; **M** is a few checks, engine changes, or app work; **L** is a new modeling concept across engine, checks and app.

### 4.1 Missing grouping levels (M)

All 21 `too-many-children` hits that match an S2 level are levels Lathe cannot hold. These are requirement groups within a use case (93 groups), rules attached to an entity (one aggregate holds 18 rules), API files grouping endpoints (up to 34 endpoints in one domain), sub-layers (up to 57 components in one layer), flow paths (up to 16 steps in one order), and pattern rule groups (up to 80 rules in one pattern).

**Recommendation:** allow `domain_rule` under `entity`, and `layer` under `layer`. Add an optional `group` field on requirements and pattern rules, which the app shows as subheadings. Give flow steps a checked `path` (see 4.4). Add an API kind (4.6).

### 4.2 Technical flows have no home (L)

The trials have 31 technical flows with 199 step rows. Each row names the component and method, the transaction and locks, the statement count and what it satisfies, followed by failure, limits and signals tables. In S2 this is where much of the design is cited. The converter could only give each step's satisfies links to the components the step names. Where a step names no component, the design citation was lost (25 steps): this is the main cause of the 12 false `unsatisfied` warnings.

**Recommendation:** add a `design_flow` kind under a layer or domain that `deepens` a flow, with `design_step` children (`order`, `uses` component, `satisfies`) and optional `transaction`, `locks` and `statements` fields. Count a step's satisfies as design. Leave failure, limits and signals as body tables for now.

### 4.3 Engineering checks are treated as proof (S)

S2's engineering checks test the mechanisms the technical specification chooses: locks, transactions and budgets. They name the obligations they support, but they are never those obligations' proof, and S2's report does not count them. As `proves` links they gave 24 false `proof-not-in-file` errors and 24 false `proof-still-owed` warnings. A check that names only a mechanism gave 5 false `test-file-missing-id` errors.

**Recommendation:** add a `supports` relation from a test to any obligation, with no proof role, beside `covers` (a test to a component). Do not require a test whose only links are `covers` or `supports` to name its ID. Accept a `key` (the test function) instead.

### 4.4 Flow paths collapse into one order (S)

S2 flows have 2 to 5 paths: the web app, the API, the scheduled path and the alternative paths. In the trials there are 32 main web-app paths, 31 API paths, 7 scheduled paths, 27 web-app alternative paths and 31 API alternative paths. The converter kept the path only as an unchecked plain field and gave all of a flow's steps one order.

**Recommendation:** add a `path` field on `flow_step` (default `main`), check `order` within each path, and have the app show each path as its own table. Let an alternative step name the step it branches from (`from`).

### 4.5 A shared test class cannot carry the key (M)

S2 proves most pattern rules through shared conformance classes. The domain's test file inherits them, and the rule marker sits in the shared class. Keying each proof on the class or module the domain file names resolved 122 proofs. But 53 still failed `proof-not-in-file`, because the marker is two imports away. That leaves 49 owed rules in domain C that S2 counts as proved (69 of 134 proved, against S2's 115).

**Recommendation:** accept a `key_file` (the shared file that holds the marker) beside `key`. Check that the `run_by` file names the key, and that the key file holds the proved ID.

### 4.6 No API (endpoint group) or integration kind (S)

S2 has an API file per resource: its endpoints, its shared request and response shapes (83 in all), and requirements that belong to the whole file. A shared-rules file holds requirements that belong to no endpoint. The converter put these 11 requirements under an arbitrary endpoint. Integrations (5, with 14 exchanges) needed the trial's only extension.

**Recommendation:** add default kinds `api` (parent domain; it holds endpoints and interaction requirements) and `integration` (parent domain; it holds interaction requirements). Allow `interaction_requirement` directly under the domain for domain-wide API rules.

### 4.7 Test-plan groups do not match S2's test plan (S)

The app groups each test by the first kind it proves. S2's plan is grouped by family. In the trials, 143 acceptance scenarios that prove only domain rules or pattern rules fall into the domain-rule or pattern groups, and 2 fall into engineering. UI tests (which run a flow and prove nothing), and 74 of 78 design checks, land in Engineering checks. Engineering checks are scattered over all five groups, because they carry proves links.

**Recommendation:** put a test under a capability in Acceptance, whatever it proves. Add a UI tests group for tests with `runs`, and a Design checks group for manual tests of type design review. Put tests with `covers` or `supports` (4.3) in Engineering checks.

### 4.8 A rule cannot be not applicable by a setting's value (S)

S2 marks 18 workflow rules (15 in domain B, 3 in domain C) not applicable because of the value a use case gives a setting, such as a one-unit operation scope. Lathe exempts a rule only when every follower gives the setting as Not applicable, so all 18 are owed, which gives 18 false `unproved` warnings.

**Recommendation:** let a domain or use case waive a pattern rule with a reason, for example a `waives` link plus a `## Waived` table, or a per-rule `Not applicable:` value under its ID. Count waived rules as neither owed nor proved, as S2 does.

### 4.9 No home for engineering standards (M)

S2 keeps a library of engineering standards, each a rule with its own ID, outside every domain. Components and technical flows cite them, and so do some design-review rows. In the trials, about 40 of the 72 distinct unknown prose IDs are standards or other domains' IDs, and most of the 137 satisfies citations the converter had to drop point at standards. With no kind, a whole-product conversion would still report the standards as unknown.

**Recommendation:** add `standard` and `standard_rule` kinds at product level, as patterns are, that components `meet`. Check only that each cited rule exists, with no coverage owed.

### 4.10 Relationship detail and the Fields column (M)

S2's relationships table gives each relationship a verb (such as "signs in through") and an optional or required end. It sometimes has two different relationships between the same pair of records, and it has records that refer to themselves (3). Lathe's `has_*` and `refers_to` links carry none of this, and a pair can be linked only once per relation. S2's Fields tables call the second column Business meaning, so all 22 converted tables would fail `entity-fields` unless renamed.

**Recommendation:** read an optional `## Relationships` table on an entity (Relationship, Related record, Cardinality), as Fields tables are read, and draw its verbs in the ERD. Accept Business meaning as another name for Meaning.

### Smaller gaps

- Value tables and state transitions are prose in 11 entities. Use-case business stages, access tables and information sets are prose in 32 use cases.
- View parts (74) and API shapes (83) have no records.
- A `run_by` holds one file, but S2 has a test run by two (a list is a `parse-error`).
- An entity may link to itself with `has_many` with no warning.
- A domain-level ERD in S2 shows records (entities), not aggregates.

## 5. False warnings and false errors, with fixes

Counts are over the three trial roots. All three end with errors (22, 2 and 58), and almost all of them are the false errors below.

| Check | Count | Cause on real material | Suggested fix |
| --- | --- | --- | --- |
| `proof-not-in-file` (pattern proofs) | 53 | The rule marker sits in a shared class the domain's file inherits through another module | `key_file` (4.5) |
| `proof-not-in-file` (engineering checks) | 24 | Engineering checks support obligations; they do not prove them | `supports` relation (4.3) |
| `proof-still-owed` | 24 of 31 | Planned engineering checks owe no proof. The other 7 are planned pattern proofs for rules that other tests already prove, which S2 also lists as still needed. | `supports` relation (4.3) |
| `test-file-missing-id` | 5 | A check of a mechanism names no obligation and no test ID in its file | Accept `key` for tests whose only links are `covers` |
| `unproved` (pattern rules) | 18 | Not applicable by a setting's value | Waivers (4.8) |
| `unproved` (pattern rules) | 49 | The cascade from the 53 key failures: a failed proof counts as no proof | `key_file` (4.5) |
| `unsatisfied` | 12 | The design citation is in a technical-flow step or overview that names no component | `design_flow` (4.2) |
| `interaction-requirement-fulfills-nothing` | 4 | Two requirements fulfill a use case's goal, not one of its requirements. The other two fulfill pattern rules outside the domain's adopted set, which the slice does not hold. | Allow `fulfills` from an interaction requirement to a use case |
| `flow-step-fulfills-outside-flow` | 2 | A cascade of the row above: the step fulfills such a requirement | The same fix |
| `unknown-id-in-prose` | 194 (72 distinct IDs) | All are real IDs: engineering standards, platform and other domains' IDs, and pattern rules of patterns not converted. Some of this is the partial slice. The standards would stay unknown in a full conversion. | `standard` kinds (4.9). A product-level `externalIdPrefixes` setting for IDs kept outside the specs. |
| `lone-child` | 1 | S2's layers are one fixed architecture set in every domain, so a layer with one component is normal | Exempt layers, or make the check opt-in per kind |
| `entity-fields` (avoided by renaming) | 22 | Column named Business meaning | Accept the alias (4.10) |
| `too-many-children` | 2 of 23 | The two places where S2 keeps a flat list of more than 15: a web-app layer with 21 components in one file, and 22 domain-wide rules. The other 21 hits are real missing levels (6). | Keep the check. It is the trial's best guide to missing levels. |

## 6. The structure checks on real domains

- **`too-many-children`** fired 23 times across the three domains, at 15 per kind. In 21 places S2 has a level there that Lathe lacks: requirement groups, an entity between an aggregate and its rules, API files, sub-layers, flow paths and pattern rule files. So the check reads S2 well, and its hits are the to-do list for 4.1. The 2 others are flat lists that S2 is content with.
- **`lone-child`** fired once, on a layer that holds one component. It never fired on a capability, although 6 of the 15 capabilities hold one use case. Each of those also holds its flow and its tests, and the check counts children of every kind. That suits S2, where a one-use-case capability is normal. Counting use cases only would add 6 false warnings.
- Each domain has an infrastructure layer with no components, because its items (routes, secrets, settings) are not code files. No check reports an empty layer.

## 7. Folders, layers and the Model view against S2's folder tree

- **Folders.** S2's per-domain tree (Define: domain model, use cases; Design: interaction design, technical specification, test plan) maps one to one onto Lathe's sections. The shared patterns map onto Shared.
- **What has no folder.** These parts of S2's tree have no Lathe folder or kind:
  - the generated traceability page (Lathe computes coverage live, which is better);
  - user guides;
  - test setup and data;
  - a domain's UI component catalog;
  - technical flows;
  - the platform, a pseudo-domain with all its own stages;
  - the engineering standards library.
- **Layers.** S2 numbers one fixed set of 7 layers in every domain and skips the numbers a domain does not use. Lathe's layers and their order hold this, but two of S2's layers are folders of sub-files, which Lathe cannot nest (4.1).
- **Model view.** The aggregate ERD matches S2's aggregate diagrams. S2's domain diagram is drawn at record level, across aggregates and with other domains' records dashed. Lathe's is drawn at aggregate level, and other domains' records appear only when they are loaded: 14 of S2's 46 relationship rows point outside the domain. Verbs and optional ends are lost (4.10).

## 8. What to do next, in order

1. Add the missing levels (4.1, M): rules under an entity, nested layers, and a `group` on requirements and pattern rules. The structure check already finds every place they are needed.
2. Add `supports` and engineering-check handling (4.3, S), and `key_file` (4.5, M). Together they remove about 150 of the trial's false errors and warnings (sections 4.3 and 4.5).
3. Add flow-step paths (4.4, S), and API and integration kinds (4.6, S).
4. Group the test plan by family (4.7, S).
5. Add rule waivers (4.8, S), and `fulfills` from an interaction requirement to a use case.
6. Add design flows (4.2, L), standards (4.9, M), and relationship tables (4.10, M).
