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

- An **automated** test names the file that runs it in `run_by` (a path relative to the repo root). That file MUST contain the test record's ID **or** the ID of a record the test proves, for example in the test's name: `it('TL-LEND-T01 A loan cannot start on an unavailable tool', …)` or `it('TL-LEND-DR05 …', …)`. Products that key their tests by the rule they prove, as S2 does, need no separate test IDs in code.
- A **manual** test describes its procedure in its body; `run_by` is optional.
- A **planned** test is not written yet. It shows what is meant to prove an obligation, but it does not count as proof. A `component` record names its file in `file` (relative to the repo root); the design may name a file that does not exist yet, which is reported as a warning.

## 5. Checks

The engine runs every SQL file in `lathe/checks/`. Each returns rows of `(severity, check, record, message)`:

- **error**: the workspace is broken (duplicate ID, unknown kind, bad parent, missing required field, disallowed or dangling link, an automated test with no `run_by`, or whose `run_by` file is missing or mentions neither its ID nor an ID it proves, a bad or repeated capability order, a pattern setting a use case does not give, a pattern setting that is not a valid field name). `lathe check` exits non-zero.
- **warning**: work still to do, not breakage (a requirement or domain rule that no component satisfies or no test proves, a use case with no requirements, a component file that does not exist yet, a use case left outside its domain's capabilities, two followed patterns sharing a setting).

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
- A relation row identical to an existing one changes nothing.
- Two rows for the same kind within one folder are an error (`meta-duplicate-kind`).

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

## 11. Pattern rules

A pattern's rules are records, so that each domain that follows the pattern must design and prove them, as S2's "Patterns we follow" tables do. A `pattern_rule` sits under its pattern and states one rule with MUST / MUST NOT / SHOULD / MAY. Its ID is the pattern's ID with `-R<nn>`, such as `TL-PAT-LIBRARIAN-ACTION-R01`. When the rule depends on one of the pattern's settings, it names it in `setting`.

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
