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
