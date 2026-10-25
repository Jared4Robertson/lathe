# Lathe spec format

Lathe stores a product's specifications as **records**: one Markdown file per record, with a YAML header for its structured fields. The files are the source of truth (readable, diffable, reviewable in git). The Lathe engine loads them into DuckDB, checks them against the **meta-model**, computes traceability, and serves them to the web app.

## 1. Where records live

Records live in the product's own repo, in the specs folder its `lathe.config.json` names (default `specs/`). See the [package README](README.md) for the config.

```
specs/
  <product-folder>/            one folder per product, e.g. tool-library, lathe
    product.md                 the product record (kind: product)
    <domain-folder>/           one folder per domain
      domain.md                the domain record (kind: domain)
      ...                      any nesting below; organise by SDLC stage, e.g.
      01-define/aggregates/loan.md
      01-define/use-cases/UC01-borrow-a-tool.md
      02-design/...
```

Every `*.md` file under `specs/` is a record, except files named `README.md`, which are ignored. Folder names are for people; the engine relies only on each record's fields.

## 2. Record file

```markdown
---
id: TL-LEND-UC01
kind: use_case
title: Borrow a tool
parent: TL-LEND
actor: Member
links:
  applies: [TL-LEND-DR01, TL-LEND-DR02]
---
A member borrows an available tool for a fixed loan period.
```

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | Yes | Unique across the whole workspace. Matches `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$`. Never reused or renumbered. |
| `kind` | Yes | One of the kinds in [meta/kinds.csv](meta/kinds.csv). |
| `title` | Yes | A short name. For a rule or requirement, the title is the rule in a few words ("A tool is lent to one member at a time"). |
| `parent` | Yes, except for `product` | The ID of the record this one belongs to. Its kind must be one of the kind's `parent_kinds`. |
| kind fields | As the kind requires | Plain string values, such as `actor` or `run_by`. A kind's `required_fields` must be present and non-empty. Any other plain string field is allowed and kept. |
| `links` | No | A map from relation name to a list of target IDs. Each relation must be allowed for this source kind and the target's kind by [meta/relations.csv](meta/relations.csv). |

The body (after the header) is Markdown prose. Requirements and domain rules state their rule in full in the body, using MUST / MUST NOT / SHOULD / MAY.

## 3. ID convention

Product prefix, domain code, then a kind code and number. The engine only checks the format and uniqueness; the convention keeps IDs readable.

| Kind | Pattern | Example |
| --- | --- | --- |
| product | `<P>` | `TL` |
| domain | `<P>-<D>` | `TL-LEND` |
| capability | `<P>-<D>-CAP<nn>` | `TL-LEND-CAP01` |
| pattern | `<P>-PAT-<name>` | `TL-PAT-LIBRARIAN-ACTION` |
| pattern_rule | `<pattern>-R<nn>` | `TL-PAT-LIBRARIAN-ACTION-R01` |
| flow_step | `<flow>-S<nn>` | `TL-LEND-F01-S01` |
| aggregate | `<P>-<D>-A<n>` | `TL-LEND-A1` |
| domain_rule | `<P>-<D>-DR<nn>` | `TL-LEND-DR01` |
| use_case | `<P>-<D>-UC<nn>` | `TL-LEND-UC01` |
| requirement (shown as *use-case requirement*) | `<use case>-R<nn>` | `TL-LEND-UC01-R01` |
| flow | `<P>-<D>-F<nn>` | `TL-LEND-F01` |
| view | `<P>-<D>-V<nn>` | `TL-LEND-V01` |
| endpoint | `<P>-<D>-E<nn>` | `TL-LEND-E01` |
| component | `<P>-<D>-C<nn>` | `TL-LEND-C01` |
| interaction_requirement | `<view, endpoint or flow>-R<nn>` | `TL-LEND-E03-R01` |
| test | `<P>-<D>-T<nn>` | `TL-LEND-T01` |
| question | `<P>-<D>-Q<nn>` (or `<P>-Q<nn>`) | `TL-LEND-Q01` |
| fitness | `<P>-FIT<nn>` | `LA-FIT01` |

## 4. Code traceability

A `test` record has a `state`: `automated` (the default when the field is absent), `manual`, or `planned`.

- An **automated** test names the file that runs it in `run_by` (a path relative to the repo root). That file MUST name the test record's own ID **or else every** ID the test proves (each target of a `proof`-role link such as `proves`), for example in the test's name: `it('TL-LEND-T01 A loan cannot start on an unavailable tool', …)` or `it('TL-LEND-DR05 …', …)`. IDs are matched as whole IDs.
  - When the file names the test's own ID, the test record vouches for all its claims.
  - Otherwise each proved ID the file leaves out is its own `proof-not-in-file` error. Products that key their tests by the rule they prove, as Client does, need no separate test IDs in code, but a test that proves two rules must name both.
  - A test that proves nothing and whose file does not name its own ID is a `test-file-missing-id` error.
- An optional `key` field on a test gives other text the file must contain instead, for example a test function name or a pattern proof's heading: `key: test_librarian_actions_are_checked`. When `key` is present, the file MUST contain that text exactly, and the ID rules above do not apply; a file without it is a `test-file-missing-id` error.
- A **manual** test describes its procedure in its body; `run_by` is optional.
- A **planned** test is not written yet. It shows what is meant to prove an obligation, but it does not count as proof. A `component` record names its file in `file` (relative to the repo root); the design may name a file that does not exist yet, which is reported as a warning.

## 5. Checks

The engine runs every SQL file in `lathe/checks/`. Each returns rows of `(severity, check, record, message)`:

- **error**: the workspace is broken (duplicate ID, unknown kind, bad parent, missing required field, disallowed or dangling link, an automated test with no `run_by`, or whose `run_by` file is missing or mentions neither its ID nor an ID it proves, a bad or repeated capability order, a pattern setting a use case does not give, a pattern setting that is not a valid field name, a pattern rule naming a setting its pattern does not have, a proof claim the test's file does not back (`proof-not-in-file`), a bad or repeated flow step order, a product check named like one of Lathe's or a product checks folder that does not exist). `lathe check` exits non-zero.
- **warning**: work still to do, not breakage (a requirement or domain rule that no component satisfies or no test proves, a use case with no requirements, a component file that does not exist yet, a use case left outside its domain's capabilities, two followed patterns sharing a setting, a pattern nobody follows, an obligation outside every domain, a record ID cited in prose that does not exist, a flow step fulfilling something outside its flow, a flow fulfilling something none of its steps do). The structural warnings say where two stages do not join up yet:
  - `rule-not-applied`: a domain rule that no use case `applies`.
  - `use-case-without-flow`: a use case that no flow `carries_out`, in a domain that has flows. A domain with no flows yet is not reported.
  - `interaction-requirement-fulfills-nothing`: an interaction requirement with no `fulfills` link.
  - `test-type-mismatch`: a test with `test_type: domain_rule` that proves requirements but no domain rule, or with `test_type: acceptance` that proves domain rules but no requirement. Other types, such as `unit`, are not compared.

  The proof warnings say where proof is still owed or is counted nowhere:
  - `proof-still-owed`: an obligation that is already proved, but that a planned test is also meant to prove, such as "TL-LEND-E06-R03 is proved, but planned test TL-LEND-T30 still owes a proof of it". There is one warning for each obligation and planned test, so the obligations that coverage counts in `planned_any` beyond `planned` are named. A pattern rule is judged in each domain that owes it, with only that domain's tests. An obligation not yet proved, whose test is only planned, is `unproved` instead.
  - `proof-counts-nowhere`: a test none of whose proofs counts in any domain's coverage: for example it proves only a rule of a pattern no domain follows, a pattern rule that only other domains owe, an obligation outside every domain, or a record that is not an obligation. The message gives the reason for each target. A test with at least one proof that counts is not reported, whatever its state.
  - `manual-test-file-silent`: a manual test whose `run_by` file exists but names neither the test's ID, nor any ID it proves, nor its `key`. Name the test in the file, or point `run_by` at the file that carries it out.

One mistake gives one error. When an ID is duplicated, a link or parent that points at it is judged against every record with that ID, and is reported only if none of them allows it. A record whose parent does not exist is reported as `unknown-parent` only.

## 6. Coverage

Coverage follows the meta-model. A kind marked `obligation: yes` in `kinds.csv` (by default `domain_rule`, `requirement`, `interaction_requirement` and `pattern_rule`) is something that must be designed, built and proved. A relation's `role` in `relations.csv` says what a link does: `design` (such as a component `satisfies` it) or `proof` (such as a test `proves` it).

Each obligation is counted in the domain that owes it. A record that sits in a domain is owed by that domain. A pattern rule sits under a pattern, outside every domain, and is owed instead by each domain that follows the pattern, where only that domain's own components and tests design and prove it (section 11). Any other obligation that sits in no domain is counted nowhere and reported as an `obligation-outside-domain` warning.

For each domain and each obligation kind: how many obligations it owes; how many are **designed** (a `design` link targets them), **built** (a `design` link from a component whose file exists), **proved** (a `proof` link from an automated or manual test), and **planned** (not proved, but a planned test is meant to prove them); plus the list of gaps. A pattern rule owed by several domains is counted, and has its gaps, in each of them. A product's own obligation kinds and relations, added by extension, are counted the same way.

## 7. Fitness

A `fitness` record is the judgment of the person a product serves: on a `date` (YYYY-MM-DD), a `score` (written `score: 4` or `score: "4"`) from 1 (does not serve its purpose) to 5 (serves it fully), and in the body the experiences behind it. Lathe never writes these itself. Signals it can count (coverage, open questions, checks) are evidence for that judgment, never the score.

## 8. What records do not carry

Records carry no status, approval or decision history: a record in the specs is in force, uncertainty is an open `question`, and git keeps the history. A decided question is removed and its answer written into the records it affects.

## 9. Extending the meta-model

A product adds to Lathe's meta-model with a `metaExtensions` folder (see the package README) holding a `kinds.csv` and/or `relations.csv` with the same columns.

- A **new kind** or **new relation** row is added as it is.
- A row whose `kind` already exists **widens** that kind: its `parent_kinds` and `required_fields` are added to the default's, and a non-empty `label`, `stage`, `obligation` or `description` replaces the default's. A product can, for example, let a `domain_rule` sit directly under a `domain`.
- A relation row with the same `relation`, `source_kind` and `target_kind` as an existing one is the same rule: a non-empty `role` or `description` replaces the default's, and an empty one keeps it. So restating a default rule, identically or in other words, changes nothing else, and a product can, for example, give a default relation the `design` role.
- Two rows for the same kind within one folder are an error (`meta-duplicate-kind`), and so are two rows for the same relation rule within one folder (`meta-duplicate-relation`). Each message names the folder's file.

## 10. Capabilities and patterns

A domain with more than a handful of use cases groups them into **capabilities**, and behaviour that several use cases share is written once as a **pattern**.

### Capabilities

A `capability` sits under a domain and gives its place in the domain in `order`, a whole number. Use cases, flows and tests may sit under a capability instead of directly under the domain, so that a capability is a slice through Define and Design: its use cases, the flows that carry them out, and the acceptance tests that prove them. Records under a capability still belong to its domain and count in that domain's coverage. Domain rules stay under their aggregates, and tests that prove only domain rules may stay under the domain.

```markdown
---
id: TL-LEND-CAP03
kind: capability
title: Lending
parent: TL-LEND
order: 3
---
Loans themselves: a member borrows a tool, and a librarian takes it back.
```

A use case then names the capability as its parent (`parent: TL-LEND-CAP03`). Its ID does not change: IDs are never renumbered, so moving a use case into a capability changes only its `parent`. Folder names are for people; a domain may keep its files where they are, or use folders such as `01-define/use-cases/03-lending/`.

- Each capability in a domain needs its own order (`capability-order` error); `1` and `01` are the same.
- Once a domain has capabilities, a use case left directly under the domain is a `use-case-outside-capability` warning. A domain with no capabilities is fine.

The domain's **use case index** comes from the records: its capabilities in order, each with its use cases, and the patterns each use case follows (or none).

### Patterns

A `pattern` sits under the product, since domains share it, and lists its **settings** in `settings`: setting names separated by spaces, each a valid field name (lower-case letters, digits and underscores, starting with a letter, and not `id`, `kind`, `title`, `parent` or `links`). Its body says what it is for and what each setting decides; its rules are `pattern_rule` records under it (section 11).

```markdown
---
id: TL-PAT-LIBRARIAN-ACTION
kind: pattern
title: Librarian action
parent: TL
settings: record required_input result
---
A librarian at the desk enters a few details, and the library saves one record and shows what it saved.
```

A use case **follows** the pattern with a `follows` link and gives each setting as a plain header field named exactly as the pattern lists it: a value, or `Not applicable:` (in any letter case) followed by a reason. The pattern's rules apply to the use case with those values; the use case's own requirements add only what is specific to it.

```markdown
---
id: TL-LEND-UC01
kind: use_case
title: Register a member
parent: TL-LEND-CAP01
actor: Librarian
record: Member
required_input: The member's name and a valid email address.
result: The new member with their ID, which goes on their card.
links:
  applies: [TL-LEND-DR01]
  follows: [TL-PAT-LIBRARIAN-ACTION]
---
```

In YAML, a value containing `: ` must be quoted, so write `audit: "Not applicable: nothing changes"`.

- A setting that a following use case does not give, or gives as `Not applicable:` with no reason, is a `pattern-setting-missing` error.
- A setting name that is not a valid field name is a `bad-pattern-settings` error on the pattern.
- A use case that follows two patterns sharing a setting name has one field for both: a `pattern-setting-clash` warning. Rename the setting in one of the patterns.

## 11. Pattern rules

A pattern's rules are records, so that each domain that follows the pattern must design and prove them, as Client's "Patterns we follow" tables do. A `pattern_rule` sits under its pattern and states one rule with MUST / MUST NOT / SHOULD / MAY. Its ID is the pattern's ID with `-R<nn>`, such as `TL-PAT-LIBRARIAN-ACTION-R01`. When the rule depends on one of the pattern's settings, it names it in `setting`.

```markdown
---
id: TL-PAT-LIBRARIAN-ACTION-R01
kind: pattern_rule
title: An action missing its required input is refused and saves nothing
parent: TL-PAT-LIBRARIAN-ACTION
setting: required_input
---
When the librarian leaves out any of the `required_input`, the library MUST refuse the action, say what is missing, and save nothing.
```

A domain **follows** a pattern when any of its use cases `follows` it. Each rule of the pattern is then an obligation **of that domain**, counted on the domain's Pattern rule coverage line:

- **designed** when a component in that domain `satisfies` it, and **built** when that component's file exists;
- **proved** when an automated or manual test in that domain `proves` it, and **planned** when only a planned test there does.

A component or test in another domain does not count: each domain applies the rule with its own setting values, so it proves the rule for itself. The rule's gaps, and its `unsatisfied` and `unproved` warnings, name the domain, such as "Pattern rule TL-PAT-LIBRARIAN-ACTION-R01 is not proved in TL-LEND".

```markdown
---
id: TL-LEND-T33
kind: test
title: Each librarian action missing its required input is refused, says what is missing, and saves nothing
parent: TL-LEND
test_type: acceptance
run_by: examples/tool-library/test/api.test.ts
links:
  proves: [TL-PAT-LIBRARIAN-ACTION-R01]
---
```

**Not applicable.** When a rule names a `setting` and every use case in a domain that follows the pattern gives that setting as `Not applicable:` with a reason, the rule does not apply in that domain and is not counted there. If even one following use case there gives the setting a value, the domain owes the rule. A rule with no `setting` applies in every domain that follows the pattern.

The checks for pattern rules:

- A rule's `setting` that is not one of its pattern's settings is a `pattern-rule-setting-unknown` error.
- A pattern that no use case follows is a `pattern-not-followed` warning: its rules are counted in no domain.
- Any other obligation that sits in no domain (possible only through an extension or a broken parent) is an `obligation-outside-domain` warning, never silently dropped.

## 12. Citing records in prose

A record's body may cite other records by ID in plain text, such as "the loan follows TL-LEND-DR05". The engine reads these citations so that a renamed or removed record does not leave a stale reference behind.

- A **citation** is a whole ID-shaped token in the body (the `id` format in section 2) that is the ID of a record, or that starts with a **known prefix** followed by `-`. The known prefixes are every `product` and `domain` ID, and the entries of the optional `idPrefixes` list in `lathe.config.json` (for example `["STD", "SYS"]`). `TL-LEND-DR05` is cited in "(TL-LEND-DR05)." and in a Markdown link `[TL-LEND-DR05](…)`, but nothing is cited in `TL-LEND-DR05a`. A token that is no record and has no known prefix, such as `ZZ-D-UC01`, is not read.
- A product's or domain's own ID (`TL`, `TL-LEND`) is a citation only when written as a code span holding just that ID (`` `TL-LEND` ``). In plain prose it is not read, because such short IDs are often ordinary words.
- Text in fenced code blocks (`` ``` `` or `~~~`), and in inline code spans holding anything more than one ID, is not read, so an example ID can be written in code (`see TL-LEND-DR99`). A code span holding exactly one ID and nothing else (`` `TL-LEND-DR05` ``) is read like plain prose, because writers often format IDs that way.
- A record's **mentions** (`SpecRecord.mentions`) are the IDs it cites that exist, in order of first mention, without repeats and without its own ID.
- A cited ID that is not a record (so one with a known prefix) is an `unknown-id-in-prose` warning on the citing record: fix the wording, or put the ID in code if it is an example.
- Mentions are not links. They do not count for coverage and are not checked against `relations.csv`; write a link in the header when a record satisfies, proves or applies another.

## 13. A product's own checks

A product can add checks of its own, so that its house rules live with the product instead of in Lathe. For example, Client requires each aggregate to have exactly one use case that follows its Record view pattern. Lathe does not ship that rule, but Client can keep it as its own check.

- `lathe.config.json` names a folder of the product's checks in `checks`, relative to the root (see the package README). Every `*.sql` file in it is a check, written exactly as Lathe's checks are (section 5): one `SELECT` over the same tables, returning rows of `(severity, check, record, message)`.
- The product's checks run after all of Lathe's checks, in file name order. Their problems are ordinary problems: `lathe check`, `--json` and the app show them with the others.
- A check's name is its file name without the leading number and `.sql`, as for Lathe's checks: `lathe-checks/01-endpoint-without-interaction-requirement.sql` is the check `endpoint-without-interaction-requirement`. The `check` column the SQL returns is ignored.
- A product check whose name equals one of Lathe's checks is not run. It is a `product-check-name-clash` error naming the file, so the two never mix in a report. Rename the file.
- A product check that fails to run is an error naming its file, as for Lathe's checks.
- A `checks` folder that the config names but that does not exist is a `product-checks-missing` error.

```sql
-- lathe-checks/01-one-record-view-per-aggregate.sql: Client's house rule
SELECT 'warning' AS severity, 'one-record-view-per-aggregate' AS "check", a.id AS record,
       'Aggregate ' || a.id || ' needs exactly one Record view use case.' AS message
FROM records a
WHERE a.kind = 'aggregate'
  AND (SELECT count(*) FROM records u
       JOIN links l ON l.path = u.path AND l.relation = 'follows' AND l.target = 'Client-PAT-RECORD-VIEW'
       JOIN fields f ON f.path = u.path AND f.name = 'record' AND f.value = a.id
       WHERE u.kind = 'use_case') <> 1
```

## 14. Flow steps

A flow can be written as **steps**, so that each step says what happens, where, and what it carries out, as Client's flow tables do. A `flow_step` sits under its flow and gives its place in the flow in `order`, a whole number. Its ID is the flow's ID with `-S<nn>`, such as `TL-LEND-F01-S01`. Its title says what happens in a few words, and its body may say more.

A step links to what it goes through with `uses` (a view, an endpoint or a component) and to what it carries out with `fulfills` (a requirement, an interaction requirement or a domain rule).

```markdown
---
id: TL-LEND-F01-S02
kind: flow_step
title: The member borrows the tool and sees the due date
parent: TL-LEND-F01
order: 2
links:
  uses: [TL-LEND-V01, TL-LEND-E04]
  fulfills: [TL-LEND-UC03-R01, TL-LEND-UC03-R02, TL-LEND-UC03-R03]
---
The member picks an available tool in the catalog and borrows it (`POST /loans`). The catalog shows the due date, or the reason the borrow was refused.
```

Once a flow has steps, what the flow fulfills is what its steps fulfill, so each `fulfills` link goes on the step that does it, and the flow itself need not repeat them. Steps are read in `order`; the IDs need not follow it, since IDs are never renumbered.

The checks for flow steps:

- A step's `order` that is not a whole number, or that another step of the same flow also has, is a `flow-step-order` error (`1` and `01` are the same). A missing order is `missing-required-field`.
- `flow-step-fulfills-outside-flow` (warning): a step fulfills something its flow does not carry out. A target is inside the flow when it is a requirement of a use case the flow `carries_out`, a domain rule one of those use cases `applies`, or an interaction requirement that fulfills one of those or sits under the flow. A step whose flow carries out no use case is not compared, and a target that does not exist is reported only as a `dangling-link`.
- `flow-fulfills-differs-from-steps` (warning): a flow that has steps fulfills something none of its steps fulfills. Move the link onto the step that carries it out. A flow without steps is not compared.
