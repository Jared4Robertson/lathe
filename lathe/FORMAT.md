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
| aggregate | `<P>-<D>-A<n>` | `TL-LEND-A1` |
| domain_rule | `<P>-<D>-DR<nn>` | `TL-LEND-DR01` |
| use_case | `<P>-<D>-UC<nn>` | `TL-LEND-UC01` |
| requirement | `<use case>-R<nn>` | `TL-LEND-UC01-R01` |
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

- An **automated** test names the file that runs it in `run_by` (a path relative to the repo root). That file MUST contain the test record's ID **or** the ID of a record the test proves, for example in the test's name: `it('TL-LEND-T01 A loan cannot start on an unavailable tool', …)` or `it('TL-LEND-DR05 …', …)`. Products that key their tests by the rule they prove, as Client does, need no separate test IDs in code.
- A **manual** test describes its procedure in its body; `run_by` is optional.
- A **planned** test is not written yet. It shows what is meant to prove an obligation, but it does not count as proof. A `component` record names its file in `file` (relative to the repo root); the design may name a file that does not exist yet, which is reported as a warning.

## 5. Checks

The engine runs every SQL file in `lathe/checks/`. Each returns rows of `(severity, check, record, message)`:

- **error**: the workspace is broken (duplicate ID, unknown kind, bad parent, missing required field, disallowed or dangling link, an automated test with no `run_by`, or whose `run_by` file is missing or mentions neither its ID nor an ID it proves, a bad or repeated capability order, a pattern setting a use case does not give, a pattern setting that is not a valid field name). `lathe check` exits non-zero.
- **warning**: work still to do, not breakage (a requirement or domain rule that no component satisfies or no test proves, a use case with no requirements, a component file that does not exist yet, a use case left outside its domain's capabilities, two followed patterns sharing a setting). The structural warnings say where two stages do not join up yet:
  - `rule-not-applied`: a domain rule that no use case `applies`.
  - `use-case-without-flow`: a use case that no flow `carries_out`, in a domain that has flows. A domain with no flows yet is not reported.
  - `interaction-requirement-fulfills-nothing`: an interaction requirement with no `fulfills` link.
  - `test-type-mismatch`: a test with `test_type: domain_rule` that proves requirements but no domain rule, or with `test_type: acceptance` that proves domain rules but no requirement. Other types, such as `unit`, are not compared.

One mistake gives one error. When an ID is duplicated, a link or parent that points at it is judged against every record with that ID, and is reported only if none of them allows it. A record whose parent does not exist is reported as `unknown-parent` only.

## 6. Coverage

Coverage follows the meta-model. A kind marked `obligation: yes` in `kinds.csv` (by default `domain_rule`, `requirement` and `interaction_requirement`) is something that must be designed, built and proved. A relation's `role` in `relations.csv` says what a link does: `design` (such as a component `satisfies` it) or `proof` (such as a test `proves` it).

For each domain and each obligation kind: how many records exist; how many are **designed** (a `design` link targets them), **built** (a `design` link from a component whose file exists), **proved** (a `proof` link from an automated or manual test), and **planned** (not proved, but a planned test is meant to prove them); plus the list of gaps. A product's own obligation kinds and relations, added by extension, are counted the same way.

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

A `pattern` sits under the product, since domains share it, and lists its **settings** in `settings`: setting names separated by spaces, each a valid field name (lower-case letters, digits and underscores, starting with a letter, and not `id`, `kind`, `title`, `parent` or `links`). Its body says what it is for, what each setting decides, and its rules, using MUST / MUST NOT / SHOULD / MAY.

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
