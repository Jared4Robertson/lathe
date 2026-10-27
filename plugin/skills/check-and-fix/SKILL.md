---
name: check-and-fix
description: Run lathe check, fix every error it reports, and report warnings and coverage. Use after changing any Lathe spec data, before committing spec changes, or when asked whether the spec is consistent or how much is designed, built, proved and planned.
---

# Check and fix

The spec is typed data, changed only with Lathe's MCP tools (or the `lathe` CLI and the app), never by editing files. Every write goes through Lathe's command layer, which refuses what breaks the model outright: a link to a record that does not exist, a link between kinds its relation does not join, an ID used twice, a missing required column, a value of the wrong type, a second root in an aggregate. What is left for the check is what a single write cannot settle: gaps, links between stages, structure sizes, and whether the code backs what the tests claim.

## Run it

- With the plugin: the `check` tool. It returns every error and warning, and a last line `N errors, M warnings.`
- In a shell, from the repo root (the folder with `lathe.config.json`): `npx lathe check` in a product repo, `npm --prefix lathe run check` in the Lathe repo. It also prints coverage, and exits 1 on any error. Add `--json` for the whole workspace as JSON.

Run it before you report or commit.

## When a write is refused

A refused write changed nothing. Its result lists every reason, each with the rule it broke in brackets, such as `[foreign-key]` or `[required]`:

- Fix what the write gives, not the data it names: a foreign-key refusal is usually a typo in an ID. `show` the record, or `list` the table with a `parent`, to find the right one.
- A record's parent columns change only with `move`. A key never changes: a row that needs another key is removed and added again.
- A removal is refused while anything still references the record, and the refusal names what does: unlink or move those first.
- Never renumber an existing record to get past a refusal.

## What each check means

Every problem names its check in brackets, such as `[unproved]`. `REFERENCE.md` in the Lathe package (`lathe/REFERENCE.md` in the Lathe repo, `node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo) explains each check, Lathe's and the product's own, with how to fix what it reports; `list` on the `check` table gives the same rows. Read the check's entry before you fix what it reports.

## Errors: fix them now

An error means the spec is broken. Do not leave one behind.

- Fix the record that is wrong, not the one that reports it.
- Most errors the check still reports are about files: a test whose `file` is missing, or does not name what the test proves (see `plan-tests`).
- Never change a product's own kinds or checks to make an error go away unless the user asked for that (see `extend-the-meta-model`).

## Warnings: work still to do

Warnings do not fail the check. They are gaps, and most say one of three things:

- **Something is not covered yet.** An obligation nothing designs (`unsatisfied`) or no automated or manual test proves (`unproved`), a component whose file does not exist yet, a proof still owed by a planned test. A planned test does not clear `unproved`.
- **Two stages do not join up yet.** A rule no use case applies, a use case without a flow, an interaction requirement that fulfills nothing, a test whose type does not match what it proves, a component that satisfies nothing (`component-satisfies-nothing`), a test that proves and supports nothing (`test-proves-nothing`). Fix the link, or remove what has no purpose; never the check.
- **A level of the spec is the wrong size.** `too-many-children`: a record has more children of one kind than the product's `max_children` setting allows (default 15; tests are never counted). Add a level between them: a capability for use cases or flows, a layer for components, another aggregate for domain rules, and `move` the records into it. `lone-child`: a capability or layer holds only one record; merge it into a neighbor, or give it more. Moving a record changes only its parent, never its ID. Do not raise `max_children` to silence the warning unless the user asks.

Fix the warnings your task is about; leave the rest and mention them.

## Coverage

`lathe check` prints one coverage line per domain and obligation kind, with four counts out of the total:

- **designed**: a `design` link (by default a component's `satisfies`) targets it;
- **built**: a component whose file exists designs it;
- **proved**: an automated or manual test `proves` it (any `proof` relation);
- **planned**: not proved, but a planned test is meant to prove it.

A proof-only kind, such as a pattern rule, shows `proof only` instead of designed and built. Each domain also has a line of test counts: automated, manual and planned. A planned obligation has a test still to write; one neither proved nor planned has no test at all.

## Report

Say, in a few lines:

1. Whether the check passes (the last line: `N errors, M warnings.`).
2. Each error you fixed and how, and any refused write you had to change.
3. The coverage lines for each domain you touched, as `lathe check` prints them, and the warnings your change added or cleared.
4. Any planned tests your change added, and why they are planned.
