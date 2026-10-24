# Trial: Lathe on a slice of S2 Accounting

What happened when one slice of S2's Accounting domain was written as Lathe records and checked. Use this report to decide what to change in Lathe next. S2 is a client product: this report names S2's structures, kinds, ID patterns and counts only. It holds no requirement text, business rules, or client or partner names.

The trial product lives outside this repo, at `/private/tmp/claude-501/s2-accounting-trial/`:

- `lathe.config.json` and `lathe-meta/`: the product's config and its meta-model extension (4 kinds, 15 relations).
- `tools/gen.py`: the script that writes the records into `specs/`. The record bodies are short paraphrases.
- `backend/` and `frontend/`: symlinks to S2's code, read-only, so that `run_by` and `file` paths resolve without copying any code.
- `probe-root/`: a copy with five probe records that test specific limits (see section 4).

The folder is not a git repo, because the sandbox refused `git init` outside the worktree. Lathe did not need one.

## 1. The slice

- **Define:** the batch aggregate and the event aggregate (2 aggregates), 6 domain rules, 2 use cases (`ACC-022`, `ACC-030`) and their 4 requirements.
- **Interaction design:** the batch view `ACC-V13` with 3 of its view requirements and 2 design checks, 3 endpoints with 5 API requirements, and the 2 flows.
- **Technical specification:** 14 components (router, services, accessors, models, web components) and the 2 technical flows.
- **Tests:** 6 rule tests, 9 acceptance scenarios, 2 UI tests and 2 contract tests.
- **Other:** 1 open question, and 2 shared rules (an access standard and an API convention) that the slice cites.

That comes to 70 records and 170 links. For scale, the whole Accounting domain has 103 spec files. It holds 4 aggregates, 41 domain rules, 15 use cases with 68 requirements, 6 views with 25 view requirements and 14 design checks, 22 endpoints in 5 API files with 17 API requirements, 19 integration requirements in 3 integration files, 15 flows, about 137 acceptance scenarios, 15 UI tests and 54 contract tests.

## 2. Check result and coverage compared

`node lathe/bin/lathe.ts check --root /private/tmp/claude-501/s2-accounting-trial`:

```
Checked 70 records
Errors (6): [test-file-missing-id] ACC-DM-R010-RT … ACC-DM-R069-RT (one per rule test)
Coverage:
  ACC: requirements 4/4 satisfied, 4/4 proved; rules 6/6 satisfied, 6/6 proved; 0 gaps
6 errors, 0 warnings.  (exit 1)
```

How this compares with S2's own generated traceability for the same IDs:

| Item | S2 traceability | Lathe |
| --- | --- | --- |
| 4 use-case requirements | All cited by a design file, all proved by scenarios | 4/4 satisfied, 4/4 proved. These agree. |
| 6 domain rules | Each has its one rule test, automated, at the rule's level | 6/6 proved, but each rule test is an **error**, because S2's test file names the rule's ID, not a test ID (see 3.2) |
| 8 interaction requirements (view and API) | Each is listed with what it fulfills and the checks that cover it | **Not counted at all.** Coverage counts only `requirement` and `domain_rule`. |
| Flow steps per requirement | Listed (for example W6, W7, WA4) | Not expressible. A flow links to whole requirements only. |
| Test run state | Counted as automated, manual, or not automated yet | Not expressible. Every test needs an existing `run_by` file. |
| Design | "Designed" means that any technical-spec detail file cites the ID | "Satisfied" means a component links to it. I moved each step's citations onto that step's component, which is a judgement call. |

The numbers agree where both tools count. The real gaps are what Lathe leaves out: interaction requirements, flow steps, and test state. There is also a false error on every rule test.

Note: [types.ts](../../lathe/src/types.ts) declares `requirements_built` and `rules_built`, but on `pass-3` the engine's coverage output and the CLI do not include them, so I could not compare "built".

## 3. Findings

### 3.1 What mapped cleanly

- **The define stage.** Product, domain, aggregate, domain rule, use case and requirement, and the `applies` relation, matched S2's structure one to one. S2's IDs (`ACC-022`, `ACC-022-R001`, `ACC-DM-R046`, `ACC-V13`) pass Lathe's ID check unchanged, even though they do not follow Lathe's `<P>-<D>-UC01` convention. That is fine, because the convention is advice.
- **Code traceability.** All 14 component files exist. All 13 scenario, UI and contract tests passed the "file mentions the test ID" check: S2 writes each scenario ID into its test file, just as Lathe asks.
- **Endpoints, views and open questions.** An endpoint as method and route, a view, and an open question with an owner all map directly. S2's open questions are tables with an owner and what each one blocks; Lathe's `question` covers the first two.
- **No status in records.** S2 has a check that rejects history and planned work in current documents. This is the same principle as FORMAT.md section 8.

### 3.2 What needed a meta-model extension

| Extension | Why S2 needs it | Belongs in Lathe's defaults? |
| --- | --- | --- |
| Kind `interaction_requirement` (parent: view or endpoint) and `fulfills` to requirement, domain rule and shared rule | S2's views, endpoints and integrations own their own requirements (`ACC-V13-R001`, `ACC-API-R004`), each of which fulfills a requirement or rule upstream. That is 61 of S2 Accounting's 170 statements. | **Yes.** It is the main gap. It also needs coverage and checks to count it (3.3). |
| Relation `carries_out` from flow to use case | S2 has one flow per use case. Lathe can only reach the use case through the flow's `fulfills` links to its requirements. | Yes. |
| Relation `fulfills` from flow to domain rule and to interaction requirement | S2's flow steps cite rules and interaction requirements as well as use-case requirements. | Yes. |
| Relation `runs` from test to flow | An S2 UI test runs a whole flow. One of the two UI tests in the slice proves no requirement at all. | Yes. |
| Kind `design_check` (parent: view), with `checks` to interaction requirement | Some requirements are verified by "design review" Given/When/Then checks, not by a test file. | Probably. Or let `test` carry `test_type: review` with no `run_by` (3.3). |
| Kind `design_flow` (parent: domain), with `deepens` to flow and `uses` to component | S2's technical spec has a step-by-step flow per use case. Each step names a component and method, its transaction and locks, a statement count, and what it satisfies. | Maybe. It is useful, but its value is in the step table, which Lathe cannot hold (3.4). |
| Kind `shared_rule` (parent: product), with `applies`, `satisfies` and `proves` | Cross-domain standards and pattern rules (`STD-…`, `SYS-…-R…`) are applied, built and proved inside each domain. | Yes, as a `standard` kind, or a shared domain the product's other domains can link into. |

Extensions cannot **widen** an existing kind. Probe P2 added a second `requirement` row whose parents include `view`: the engine kept both rows, the parent check still failed against the default row, and nothing reported the duplicate kind row. So a view's requirement had to become a new kind, and then:

- the coverage counts and the `unsatisfied` and `unproved` checks ignore it, because they name `requirement` and `domain_rule` in SQL;
- the `satisfies` and `proves` sources are fixed to `component` and `test` in the same SQL.

An extension can add kinds, but it cannot make them count.

**Rule tests** do not fit. S2 keys each rule test by the rule's own ID: one test per rule, and the test file names the rule. Lathe needs a separate test ID that the file mentions. Probe P5 (giving the test the rule's ID) gave a duplicate-ID error that then cascaded into 15 misleading "relation not allowed" errors, because every link to that ID now resolved to the wrong kind.

### 3.3 What Lathe could not express at all

- **Rules without an aggregate.** S2 has domain-wide rules (probe P1, `ACC-DM-R029`). Lathe requires a `domain_rule` to sit under an aggregate.
- **Records inside an aggregate.** An S2 aggregate is a root record plus child records (here, 4 records). Each has its own fields table, and rules attach to the record they constrain. Lathe has no `entity` or record kind below `aggregate`, and no fields.
- **Relationships between records,** including records in other domains, with cardinality. S2 checks that its Mermaid diagrams match a relationships table. Lathe has only `relates_to` between aggregates.
- **Value tables and state machines:** status values with their meanings, and allowed transitions. These exist only as prose.
- **Permissions and access rows.** Each use case has an action-to-permission table that fills in a shared access standard, and scenarios cite a specific row (for example "STD-… (Abandon a batch)"). Lathe has one plain string field, and no way to cite a row.
- **Information sets, business stages, and use-case settings** (also tables) for patterns such as Workflow run and Record view. S2's "follows pattern" link has no Lathe relation.
- **Flow step tables.** Steps W1…Wn and alternative paths WA1…, each with an actor, a place, what happens, and the IDs it fulfills. S2's traceability reports flow steps per requirement. Lathe collapses all of this into one list of links on the flow.
- **Technical-flow step tables.** These hold per-step transaction, lock and statement budgets, plus failure, limits and signals tables.
- **IDs cited in prose.** Bodies cite other IDs (here, `ACC-008-R033` and `ACC-DM-R039`, which are not in the trial). Probe P3 cited a made-up ID: Lathe reported nothing. S2 resolves every cited ID and also rejects retired IDs.
- **Integrations and exchanges** with other domains and outside systems (3 files and 19 requirements in Accounting). There is no kind for an exchange or an integration contract.
- **Tests of a component.** S2's engineering checks name the component they check, as well as what they prove. Lathe has no test-to-component relation.
- **Test state.** S2 marks a test as automated, manual, or not automated yet. In Lathe, a test that is not automated cannot be a record without an error.
- **Verification level.** Each S2 rule and requirement carries a level (unit, integration, api, contract, e2e-ui, design review). Lathe keeps it as a plain field, and nothing compares it with the proving test's `test_type` (probe P4).

### 3.4 S2's quality checks compared with Lathe's

S2's checks come from two tools. One generates the traceability report (about 1,400 lines of Python). The other checks the documents (16 modules, about 6,000 lines, including a 2,300-line layout checker).

| Check | S2 | Lathe |
| --- | --- | --- |
| IDs are unique and well formed | Yes, with a regex per ID family | Yes |
| Links are typed and allowed by a meta-model | No: links are Markdown links with IDs in their text | **Yes**, which is Lathe's main strength |
| A cited ID exists | Yes, in tables, prose and scenarios, and retired IDs are rejected | Only in `links` (dangling-link). Not in prose. |
| A test file exists and names the test | It checks the folder matches the level; scenario files name their ID | Yes, file plus ID |
| A test's level matches the rule's or requirement's level | Yes | No |
| Every rule is applied by some use case | Yes (error) | No (probe P4 passed silently) |
| Every use case has a flow | Yes | No |
| Every interaction requirement fulfills something | Yes | No |
| A scenario cites only rules its use case applies | Yes | No |
| Every access or settings row is cited by a scenario | Yes | No |
| Requirement sentences use MUST, MUST NOT, SHOULD or MAY | Yes | No |
| Diagrams match the relationships table | Yes | No (diagram checks exist for CSV diagrams, but not against records) |
| No history or planned work in current documents | Yes | It is a rule in FORMAT.md, with no check |
| Coverage: designed and proved | Yes, plus pending design and test run state | Yes, for 2 kinds only |

## 4. Probes run

These ran in `probe-root/`, which is the trial plus five records:

| Probe | Result |
| --- | --- |
| P1: a domain rule under the domain | Error `parent-kind-not-allowed` |
| P2: an extension adds a second `requirement` row so that a requirement can sit under a view | Still an error. The duplicate kind row is not reported. |
| P3: an interaction requirement with no links, citing a made-up ID in its body | No problem reported |
| P4: a rule that no use case applies, with `verification: unit`, proved by an `integration` test | Only "unsatisfied". The missing use case and the level mismatch go unreported. |
| P5: a rule test keyed by its rule's ID | 1 duplicate-ID error plus 15 cascaded relation errors |

## 5. Recommended changes to Lathe, by priority

1. **Make coverage and the coverage checks driven by the meta-model, not by fixed kind names.** For example, add a column in `kinds.csv` that marks a kind as an obligation (to be satisfied and proved), and let the relations decide which kinds satisfy and prove. Reason: without this, no extension kind is ever counted. It also blocks recommendation 2.
2. **Add `interaction_requirement` (parent: view or endpoint) with `fulfills` to requirement and domain rule, as a default kind.** Reason: in a mature product like S2, about a third of the requirements live at the interaction level, and Lathe's coverage cannot see them today.
3. **Let a test prove what its file names.** Accept the `run_by` file mentioning either the test ID or the ID it proves (when there is one), or add an optional `key` field. Also allow a test `state` (automated, manual, planned) where only an automated test needs `run_by`. Reason: S2 keys every rule test by the rule, and plans tests before they exist. Today both cause false errors.
4. **Let extensions widen default kinds, and check the meta-model.** Merge a kind row with the same name into the default (add parent kinds and required fields), and report duplicate or unknown kinds in the meta-model. This also settles `LA-CHK-Q03`. Reason: probe P2 failed silently. A product cannot adapt the defaults without forking them.
5. **Add default relations:** `carries_out` (flow to use case), `fulfills` (flow to domain rule), `runs` (test to flow), and a test-to-component relation. Also allow `domain_rule` directly under a domain. Reason: these are common S2 shapes that cost no new kinds.
6. **Resolve IDs cited in prose.** Warn on any ID-shaped token in a body that is not a record, and optionally store such tokens as `mentions` links for the app to show. Reason: S2 relies heavily on prose citations, and a stale one is its most common kind of drift.
7. **Add the structural warnings S2 already finds useful:** a rule no use case applies; a use case with no flow; an interaction requirement that fulfills nothing; a test whose `test_type` differs from the `verification` of what it proves (once `verification` is a standard field). Reason: each one is cheap SQL and catches real gaps.
8. **Let a product add its own checks** with a `checks` folder in `lathe.config.json`, run after Lathe's. Reason: product rules such as S2's level matching and access-row citations do not belong in Lathe's defaults.
9. **Add a home for shared rules** (a `standard` kind, or a shared domain that other domains can link into). Reason: S2's cross-domain standards and pattern rules are applied and proved in every domain.
10. **Plan for structured tables (later).** Flow steps, value tables, state transitions, access rows and record fields are where S2 keeps most of its precision. A first step is to let flow steps be child records (`ACC-F022-W1`) that carry their own `fulfills` links. Reason: S2 reports traceability per flow step, and that is impossible while a flow is one record.
11. **Suppress cascaded errors.** When an ID is duplicated, skip the relation errors whose target is that ID. Reason: probe P5 turned 1 real error into 16.

## 6. Pass 4 re-run

The same slice, reworked for the pass-4 format and checked with the pass-4 engine. The re-run lives at `/private/tmp/claude-501/s2-accounting-trial-pass4/` (a copy of the first trial's folder, which is kept as it was). Its `tools/gen.py` writes both `specs/` and `probe-root/specs/`, so the main records and the probes stay in step.

### 6.1 What changed in the trial

- **Before any rework,** the unchanged first-trial folder gave 4 `meta-duplicate-relation` errors and no others. Its extension restated four relation rules that pass 4 now has as defaults, with different descriptions (see 6.4, item A). The six false rule-test errors had already gone.
- **Interaction requirements** use the default kind. The extension no longer defines the kind, nor its `fulfills`, `satisfies` and `proves` rules.
- **Rule tests** keep their `-RT` record IDs, but their code needs no test ID: each file names only the rule, and the check accepts it.
- **Design checks** are now `test` records with `state: manual` and `test_type: design review`, which prove the view's interaction requirements. The `design_check` kind and the `checks` relation are gone.
- **A domain-wide rule** (`ACC-DM-R029`) now sits directly under the domain, because the extension widens `domain_rule`'s parents. It has its rule test, a component that satisfies it, and the use case that applies it. In the first trial this was probe P1.
- **Pattern proofs,** the domain's own proof of each shared rule it adopts, are new: one `planned` test (S2 marks it "not automated yet") and one automated contract test.
- **The extension shrank** from 4 kinds and 15 relations to 3 kind rows and 10 relations. The kind rows are 1 widening (`domain_rule` under `domain`) and 2 new kinds (`design_flow`, and `shared_rule` marked `obligation: yes`). The 10 relations are `carries_out`, `fulfills` from flow to domain rule and to interaction requirement, `fulfills` and `applies` to shared rule, `satisfies` (design) and `proves` (proof) to shared rule, `runs`, `deepens`, and `uses` from design flow to component.

That comes to 74 records and 175 links. The 24 tests are 21 automated, 2 manual and 1 planned.

### 6.2 Check result and coverage compared

`node lathe/bin/lathe.ts check --root /private/tmp/claude-501/s2-accounting-trial-pass4`:

```
Checked 74 records
Errors (1): [test-file-missing-id] ACC-SYS-API-R004-PT (the automated pattern proof; its file names no ID)
Coverage:
  ACC domain_rule: 7/7 designed, 7/7 built, 7/7 proved, 0/7 planned; 0 gaps
  ACC requirement: 4/4 designed, 4/4 built, 4/4 proved, 0/4 planned; 0 gaps
  ACC interaction_requirement: 8/8 designed, 8/8 built, 8/8 proved, 0/8 planned; 0 gaps
1 errors, 0 warnings.  (exit 1)
```

| Obligation kind (slice count) | S2 traceability | Lathe, pass 4 | First trial |
| --- | --- | --- | --- |
| Use-case requirement (4) | All have a design file, all proved by scenarios | 4/4 designed, built, proved. These agree. | 4/4, agreed |
| Domain rule (7) | Each has its one automated rule test, and a design file | 7/7 designed, built, proved, with no false errors. These agree. | 6/6, with 6 false errors |
| Interaction requirement (8) | Each fulfills something; 5 are covered by contract tests and 3 by design-review checks | 8/8 designed, built, proved (3 by manual tests). These agree. | Not counted |
| Shared rule (2) | One pattern proof automated, one not automated yet | **Not counted at all** (6.4, B), and the automated pattern proof is a false error (6.4, D) | Not counted |
| Flow steps per requirement | Listed | Still not expressible | Not expressible |
| Test run state | Automated, manual, not automated yet | Expressible, and it drives "proved" and "planned". Lathe does not count tests by state, as S2's report does. | Not expressible |
| Built | Not reported | Reported: every component file exists | Not reported |

All three default obligation kinds now agree with S2. The disagreements that are left are about shared rules and flow steps.

### 6.3 The first report's recommendations

| # | Recommendation | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Meta-model-driven coverage | **Done** | The extension kind `shared_rule` is counted once it sits in a domain (probe P7). An obligation outside a domain is still not counted (6.4, B). |
| 2 | Default `interaction_requirement` | **Done** | Also allowed under a flow. It needed no extension. |
| 3 | A test proves what its file names, plus test state | **Done**, with gaps | The rule tests pass. `manual` and `planned` work (P10 shows "planned 1/9"). Gaps: the record still needs its own ID, and see 6.4, items C, D, E and F. |
| 4 | Widening and meta-model checks | **Done** for kinds | P2 (a requirement under a view) now passes, and the meta checks catch duplicates. Relation rules cannot be restated or widened (6.4, A). |
| 5 | Default relations, and a rule under a domain | **Partly done** | A rule under a domain is possible by widening, not by default. `carries_out`, `fulfills` from flow to rule, `runs`, and a test-to-component relation are still extensions. |
| 6 | Resolve IDs cited in prose | **Open** | P3: a made-up ID in a body is still not reported. |
| 7 | Structural warnings | **Open** | P3: an interaction requirement that fulfills nothing gives only "unsatisfied" and "unproved". P4: a rule that no use case applies, proved at the wrong level, gives nothing beyond those two. |
| 8 | Product checks folder | **Open** | `lathe.config.json` has no `checks` key. |
| 9 | A home for shared rules | **Partly done** | An extension kind under a shared domain works and is counted (P7). But the count lands in the shared domain, not in the domain that adopts the rule, and a rule under the product is not counted. |
| 10 | Structured tables | **Open** | Flow steps and the other tables are still prose. |
| 11 | Suppress cascaded errors | **Open** | P5 still gives 1 duplicate-ID error plus 15 cascaded `relation-not-allowed` errors. |

### 6.4 What is new, broken or still awkward

- **A. Restating a default relation is an error.** FORMAT.md section 9 says an identical row changes nothing, but "identical" includes the description and the role. So a product's existing extension broke on upgrade with 4 `meta-duplicate-relation` errors (P6 reproduces it). The message does not say which folders list the rule, and a product cannot change a default relation's role or description.
- **B. An obligation outside a domain is silently left out.** Coverage counts only records that sit in a domain. Shared rules under the product are marked `obligation: yes`, yet they get no coverage line and no note, while `unsatisfied` and `unproved` still check them. S2's shared rules sit outside every domain.
- **C. One mention covers every proof.** If a test's file names any one ID it proves, the test passes for all of them. In P4, a test claims to prove two rules, its file names only one, and nothing is reported.
- **D. Pattern proofs keyed by file are false errors.** S2 records a pattern proof in its test plan as the path of a dedicated file, and that file names no ID at all. Lathe calls it `test-file-missing-id`. That is the main trial's only error.
- **E. A planned test cannot name its future file.** P8: a planned test whose `run_by` does not exist yet is an error (`test-file-missing`). A component that names a future file is only a warning.
- **F. `state` is matched case-sensitively in some places and not in others.** P11 (`state: Manual`): the checks give `bad-test-state` and `test-run-by-missing`, but coverage lower-cases the value and counts the test as manual proof. The record is both broken and counted.
- **G. "Planned" hides behind other proof.** The access rule's planned pattern proof is not visible, because scenarios already prove the rule. S2 reports "pattern proofs still needed" separately (20 in Accounting). Lathe cannot say that one kind of proof is still owed.
- **H. Smaller points.** The CLI prints "1 errors". A manual test may name a `run_by` file that never mentions it, and nothing checks it (P9). The coverage output keeps the older fixed fields (`requirements`, `rules`) next to the per-kind list.

### 6.5 Probes on pass 4

These run in `probe-root/`: the main records plus 13 probe records, and one more relation row in its extension.

| Probe | First trial | Pass 4 |
| --- | --- | --- |
| P1: a domain rule under the domain | Error | Passes by widening (now in the main trial) |
| P2: a requirement under a view, by widening | Error, and the duplicate row went unreported | Passes |
| P3: an interaction requirement that fulfills nothing, citing a made-up ID | Nothing reported | Only `unsatisfied` and `unproved`. The prose ID goes unreported. |
| P4: a rule that no use case applies, proved at the wrong level | Only `unsatisfied` | Same. The test also passes the file check when its file names only the other ID it proves (C). |
| P5: a rule test keyed by its rule's ID | 1 + 15 errors | Same, 1 + 15 |
| P6: an extension restates a default relation rule with other words | (new) | `meta-duplicate-relation`, with no folder named |
| P7: an extension `shared_rule` in a shared domain, proved by a manual test | (new) | Counted under the shared domain: 1/1 proved, 0/1 designed |
| P8: a planned test whose `run_by` file does not exist yet | (new) | Error `test-file-missing` |
| P9: a manual test naming a file that never mentions it | (new) | Nothing reported |
| P10: a rule that only a planned test proves | (new) | "planned 1/9", and the warning "its test is only planned". This works as documented. |
| P11: `state: Manual`, with a capital letter | (new) | Two errors, but counted as proof |

### 6.6 What to change next, by priority

1. **Count every obligation, and give shared rules a home.** Count obligations that sit outside a domain (a product-level line), or at least report that they are left out. Then decide where adoption is counted: S2 proves each shared rule once per adopting domain, so a "proved in domain X" link, or counting by the proving test's domain, would match S2. Reason: this is the only default-format gap left in the coverage comparison (B, recommendation 9).
2. **Make every proof claim checkable.** When a file does not name the test's own ID, require it to name each ID the test proves, or report each one it leaves out. Add an optional `key` field (the text the file must contain, such as a test function name) for files that name no ID. Reason: C lets a claim go unchecked, and D is the main trial's one false error.
3. **Resolve IDs cited in prose** (unchanged recommendation 6). Reason: this is S2's most common kind of drift, and P3 still passes silently.
4. **Add the structural warnings** (unchanged recommendation 7): a rule no use case applies, a use case with no flow, an interaction requirement that fulfills nothing, and a level mismatch. Reason: each is a small SQL file, and P3 and P4 show they are still missing.
5. **Make the S2 shapes default** (rest of recommendation 5): `carries_out`, `fulfills` from flow to domain rule and to interaction requirement, `runs`, a test-to-component relation, and `domain` among `domain_rule`'s parents. Reason: 4 of the trial's 10 extension relations (and its one widening) are generic, not specific to S2.
6. **Let extensions restate or widen relation rules.** Treat a row with the same relation, source and target as the same rule, with a non-empty role or description replacing the default's, and name the folders in `meta-duplicate-relation`. Reason: A breaks existing product extensions on upgrade.
7. **Make test state consistent and planned-friendly.** Read `state` the same way in every check and in coverage (either lower-case it everywhere or reject it everywhere). Make a missing `run_by` file a warning for a planned test. Reason: F and E.
8. **Suppress cascaded errors** (unchanged recommendation 11). Reason: P5 still turns 1 error into 16.
9. **Let a product add its own checks** (unchanged recommendation 8). Reason: S2's level matching and access-row citations still have no home.
10. **Show owed proof, and count tests by state.** Let coverage report a planned proof even when other tests already prove the obligation, and add a count of tests by state. Reason: G, and S2's test-coverage table.
11. **Plan for structured tables, later** (unchanged recommendation 10), starting with flow steps as child records.
