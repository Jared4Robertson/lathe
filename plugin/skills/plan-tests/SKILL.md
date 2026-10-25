---
name: plan-tests
description: Write or change Lathe test records and the tests they name - automated, manual or planned. Use when planning which tests prove which requirements, domain rules and interaction requirements, when writing a test for a Lathe test record, or when deciding whether to plan a test instead of writing it, in a repo with lathe.config.json.
---

# Plan tests

A `test` record says what one test proves and how it is run. An obligation (a requirement, domain rule, interaction requirement, or a product's own obligation kind) is **proved** when an automated or manual test `proves` it, and **planned** when only a planned test does.

## The record

| Field | Meaning |
| --- | --- |
| `id` | `<P>-<D>-T<nn>`, the next free number in the domain. |
| `parent` | The domain, or, when the domain has capabilities, the capability of the use cases whose requirements it proves. A test that proves only domain rules stays under the domain. |
| `title` | What the test shows, as a sentence. |
| `test_type` | Required. For example `domain_rule`, `requirement`, `endpoint`. |
| `state` | `automated` (the default when absent), `manual` or `planned`. Any other value is an error. |
| `run_by` | The test file, as a path from the repo root. Required for an automated test; optional for manual and planned ones. |
| `key` | Optional. Text the `run_by` file must contain instead of an ID, such as a test function name. |
| `key_file` | Optional. The file that holds the key (or the IDs) when the test runs from a shared class in another file, as a path from the repo root. That file is then read instead of `run_by`, which must still exist. |
| `links.proves` | The obligations this test proves. |
| `links.supports` | The obligations this test backs without proving them, such as a check of a lock, a transaction or a budget the design chose. Support is never proof, so the file need not name these IDs. |

The body says what the test does: the set-up, the action and what it expects. For a manual test it is the procedure a person follows.

## The three states

- **automated**: code runs it. `run_by` must name a file that exists and names this test's ID, or every ID it proves, or its `key` (see below). A missing `run_by` is the error `test-run-by-missing`; a missing file is `test-file-missing`; each proved ID the file leaves out is `proof-not-in-file`; a missing key, or a file that names no ID of a test that proves nothing, is `test-file-missing-id`.
- **manual**: a person runs it, following the body. It counts as proof. Use it only for what code cannot sensibly check (a smoke test of the README's steps, a look at a printed page). If it names `run_by`, the file must exist.
- **planned**: not written yet. It shows what will prove an obligation, but it is not proof: coverage counts the obligation as **planned**, and the `unproved` warning stays. If it names `run_by`, the file must exist, so leave `run_by` out until the file is written.

## Three ways code can carry the proof

An automated test's `run_by` file must contain **one** of:

1. **the test record's ID**, for example in the test's name: `it('TL-LEND-T01 A second member with the same email is rejected', ...)`. The test record then vouches for everything it `proves`.
2. **every ID the test proves**: `it('TL-LEND-DR01 Email is unique, whatever its case', ...)`. Use this when the product keys its tests by the rule they prove; the code then needs no separate test ID. A test that proves two records must name both: each one the file leaves out is a `proof-not-in-file` error.
3. **the test's `key`**, when the record has one: text the file must contain exactly, such as a test function name (`key: test_librarian_actions_are_checked`) or the heading of a dedicated proof file that names no ID. With a `key`, the ID rules do not apply.

When the proof sits in a shared class that the `run_by` file inherits from another file, name that file in `key_file`: the key, or the IDs, are looked for there instead. A key file that is missing or outside the repo root is `test-file-missing`.

An engineering check that tests a mechanism (a lock, a transaction, a budget) backs an obligation but does not prove it: link it with `supports`, not `proves`. A test that only supports owes no ID in its file, and its links never count in coverage.

IDs are matched as whole IDs: `TL-LEND-DR05` is not found in `TL-LEND-DR050` or `TL-LEND-DR05-R01`. Pick one style per product and keep to it. Put the ID at the start of the test's name, so a failing test points straight at its record.

## When to plan instead of write

Write the test with the record when you can: the code under test exists, or you are writing it now. Plan it (`state: planned`, no `run_by`) when:

- the design is ready but the code it tests is not written yet;
- the test needs something not in place yet (a fixture, a browser runner, a second service);
- you are laying out what will prove a set of obligations before building them.

Say in the body why it is planned and what it will check. When the test is written, set `state` to `automated` (or remove it) and add `run_by` in the same change. Never mark a test automated before its file names the ID, every ID it proves, or its key.

## Examples

An automated test keyed by its own ID:

```markdown
---
id: TL-LEND-T01
kind: test
title: "A second member with the same email is rejected, whatever its case"
parent: TL-LEND
test_type: domain_rule
state: automated
run_by: test/domain-rules.test.ts
links:
  proves: [TL-LEND-DR01]
---
Registers a member, then registers another with the same email in a different case and with spaces: refused as `email_taken`.
```

```ts
it('TL-LEND-T01 A second member with the same email is rejected, whatever its case', () => {
  // ...
});
```

A planned test of an interaction requirement:

```markdown
---
id: TL-LEND-T14
kind: test
title: Borrowing a tool on loan answers 409 tool_on_loan
parent: TL-LEND
test_type: endpoint
state: planned
links:
  proves: [TL-LEND-E04-R01]
---
Planned: the HTTP test harness is not set up yet. Will borrow a tool, borrow it again as another member, and expect `409 { "error": "tool_on_loan" }` with no second loan created.
```

## Rules

- Write an automated test record and its test together.
- One test proves one behavior. It may prove several records when they are one behavior (an interaction requirement, the use case requirement it fulfills, and the domain rule behind them).
- Quote a title that contains a colon or starts with a special character.
- Every test proves or supports at least one obligation. One that does neither is a `test-proves-nothing` warning, whatever its state; `runs` and `covers` say what it touches, not what it shows. Link what it proves, or remove it.
- Aim for every obligation to be proved; each one that is not is a warning and a gap in coverage, and a planned test does not clear it.
- Finish with the `check-and-fix` skill.
