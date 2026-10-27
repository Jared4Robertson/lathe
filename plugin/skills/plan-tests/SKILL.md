---
name: plan-tests
description: Write or change Lathe test records and the tests they name - automated, manual or planned. Use when planning which tests prove which requirements, domain rules and interaction requirements, when writing a test for a Lathe test record, or when deciding whether to plan a test instead of writing it, in a repo with lathe.config.json.
---

# Plan tests

A `test` record says what one test proves and how it is run. An obligation (a requirement, domain rule, interaction requirement, pattern rule, or a product's own obligation kind) is **proved** when an automated or manual test `proves` it, and **planned** when only a planned test does.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files: `add`, `set`, `move`, `link`, `unlink` and `remove` write; `show`, `list` and `next_id` read; `check` runs the checks. Each write is checked against the schema and refused, with its reasons, when it breaks the model; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task, the test record with its test.

- `lathe add test --help` in a shell prints the test table's columns, as the `add` tool's input schema does (`npx lathe` in a product repo; `npm --prefix lathe run lathe -- <command> --root ..` in the Lathe repo).
- Take each new test's ID from `next_id` (`kind`: `test`, `parent`: its domain or capability). IDs are never reused or renumbered.

## The record

| Column | Meaning |
| --- | --- |
| `id` | `<P>-<D>-T<nn>`, the next free number in the domain. |
| `domain_id`, `capability_id` | The domain, and, when the domain has capabilities, the capability of the use cases whose requirements it proves. A test that proves only domain rules stays under the domain. |
| `title` | What the test shows, as a sentence. |
| `test_type` | Required, in lower case: for example `domain_rule`, `requirement`, `endpoint`, `unit`, `acceptance`. |
| `state` | Required: `automated`, `manual` or `planned`. |
| `file` | The test file, as a path from the repo root. Required for an automated test (the store refuses one without); optional for manual and planned ones. |
| `key` | Optional. Text the `file` must contain in place of an ID, such as a test function name. |
| `key_file` | Optional, with `file`. The file that holds the key (or the IDs) when the test runs from a shared class in another file, as a path from the repo root. That file is then read in place of `file`, which must still exist. |
| `given`, `when`, `then` | What the test does: the state it starts from, the action, and what it expects. For a manual test they are the procedure a person follows. |

Its links:

- `proves`: the obligations this test proves.
- `supports`: the obligations it backs without proving them, such as a check of a lock, a transaction or a budget the design chose. Support is never proof, so the file need not name these IDs.
- `runs` a flow it walks end to end and `covers` a component it exercises; neither counts as proof. `meets` a standard rule it follows.

## The three states

- **automated**: code runs it. `file` must name a file that exists and names this test's ID, or every ID it proves, or its `key` (see below). A missing file is `test-file-missing`; each proved ID the file leaves out is `proof-not-in-file`; a missing key, or a file that names no ID of a test that proves nothing, is `test-file-missing-id`.
- **manual**: a person runs it, following its `given`, `when` and `then`. It counts as proof. Use it only for what code cannot sensibly check (a smoke test of the README's steps, a look at a printed page). If it names a `file`, the file must exist.
- **planned**: not written yet. It shows what will prove an obligation, but it is not proof: coverage counts the obligation as **planned**, and the `unproved` warning stays. If it names a `file`, the file must exist, so leave `file` out until the file is written.

## Three ways code can carry the proof

An automated test's `file` must contain **one** of:

1. **the test record's ID**, for example in the test's name: `it('TL-LEND-T01 A second member with the same email is rejected', ...)`. The test record then vouches for everything it `proves`.
2. **every ID the test proves**: `it('TL-LEND-DR01 Email is unique, whatever its case', ...)`. Use this when the product keys its tests by the rule they prove; the code then needs no separate test ID. A test that proves two records must name both: each one the file leaves out is a `proof-not-in-file` error.
3. **the test's `key`**, when the record has one: text the file must contain exactly, such as a test function name (`test_librarian_actions_are_checked`) or the heading of a dedicated proof file that names no ID. With a `key`, the ID rules do not apply.

When the proof sits in a shared class that the `file` inherits from another file, name that file in `key_file`: the key, or the IDs, are looked for there instead. A key file that is missing or outside the repo root is `test-file-missing`.

An engineering check that tests a mechanism (a lock, a transaction, a budget) backs an obligation but does not prove it: link it with `supports`, not `proves`. A test that only supports owes no ID in its file, and its links never count in coverage.

IDs are matched as whole IDs: `TL-LEND-DR05` is not found in `TL-LEND-DR050` or `TL-LEND-DR05-R01`. Pick one style per product and keep to it. Put the ID at the start of the test's name, so a failing test points straight at its record.

## When to plan instead of write

Write the test with the record when you can: the code under test exists, or you are writing it now. Plan it (`state: planned`, no `file`) when:

- the design is ready but the code it tests is not written yet;
- the test needs something not in place yet (a fixture, a browser runner, a second service);
- you are laying out what will prove a set of obligations before building them.

Say in `given`, `when` and `then` what it will check, and in the title or `then` why it is planned. When the test is written, `set` its `state` to `automated` and its `file` in one write. Never mark a test automated before its file names the ID, every ID it proves, or its key.

## Examples

An automated test keyed by its own ID:

```
add  { "test": { "id": "TL-LEND-T01", "title": "A second member with the same email is rejected, whatever its case",
       "domain_id": "TL-LEND", "test_type": "domain_rule", "state": "automated", "file": "test/domain-rules.test.ts",
       "given": "A registered member", "when": "Another member registers with the same email in a different case and with spaces",
       "then": "It is refused as email_taken" } }
link { "source": "TL-LEND-T01", "relation": "proves", "target": "TL-LEND-DR01" }
```

```ts
it('TL-LEND-T01 A second member with the same email is rejected, whatever its case', () => {
  // ...
});
```

A planned test of an interaction requirement:

```
add  { "test": { "id": "TL-LEND-T14", "title": "Borrowing a tool on loan answers 409 tool_on_loan",
       "domain_id": "TL-LEND", "test_type": "endpoint", "state": "planned",
       "given": "A tool on loan to one member (planned: the HTTP test harness is not set up yet)",
       "when": "Another member borrows it", "then": "409 { \"error\": \"tool_on_loan\" }, and no second loan" } }
link { "source": "TL-LEND-T14", "relation": "proves", "target": "TL-LEND-E04-R01" }
```

Once it is written: `set { "test": { "id": "TL-LEND-T14", "state": "automated", "file": "test/loans-api.test.ts" } }`.

## Rules

- Write an automated test record and its test together.
- One test proves one behavior. It may prove several records when they are one behavior (an interaction requirement, the use case requirement it fulfills, and the domain rule behind them).
- Every test proves or supports at least one obligation. One that does neither is a `test-proves-nothing` warning, whatever its state; `runs` and `covers` say what it touches, not what it shows, and `meets` names a standard rule it follows. Link what it proves, or remove it.
- Aim for every obligation to be proved; each one that is not is an `unproved` warning and a gap in coverage, and a planned test does not clear it.
- Finish with the `check-and-fix` skill.
