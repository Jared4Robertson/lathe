---
name: check-and-fix
description: Run lathe check, fix every error it reports, and report warnings and coverage. Use after changing any Lathe spec record or meta-model file, before committing spec changes, or when asked whether the specs are consistent or how much is designed, built, proved and planned.
---

# Check and fix

`lathe check` loads every record, checks it against the meta-model, and prints errors, warnings and coverage. It exits 1 if there is any error.

## Run it

From the repo root (the folder with `lathe.config.json`):

- In a product repo: `npx lathe check`
- In the Lathe repo itself: `npm --prefix lathe run check`

Add `--json` for the whole workspace as JSON (records, links, problems, coverage) when you need to look something up.

The plugin's hook already runs the check after each edit to a spec record, `lathe.config.json` or a meta-model CSV, and shows you any errors. Run it yourself before you report or commit, because the hook does not show warnings or coverage.

## What each check means

Every problem names its check in brackets, such as `[dangling-link]`. Each check explains what it reports and how to fix it in the format reference, under its name:

- in a product repo, `npx lathe format` (the product's own checks included);
- in the Lathe repo, `npm --prefix lathe run lathe -- format --root ..`, or `lathe/REFERENCE.md` for Lathe's defaults; the app shows the same text at `/format/checks/<name>`.

Read the check's entry before you fix what it reports. A check name the reference does not list is the product's own: read its SQL file in the folder `lathe.config.json` names in `checks`.

## Errors: fix them now

An error means the specs are broken. Do not leave one behind.

- Fix the record that is wrong, not the one that reports it: a dangling link is usually a typo in the link, not a missing record.
- One mistake gives one error. A duplicated ID is reported once, as `duplicate-id`, without an error for each link to it, so fix the duplicate first and run the check again.
- Never renumber an existing record to fix an ID problem; give the wrong record a new, unused ID in its kind's pattern.
- A `parse-error` is a broken YAML header: the `---` lines, indentation, or a title with a colon that needs quotes.
- Never change the meta-model to make an error go away unless the user asked for a new kind or relation (see `extend-the-meta-model`).

## Warnings: work still to do

Warnings do not fail the check. They are gaps, and most say one of three things:

- **Something is not covered yet.** An obligation nothing designs (`unsatisfied`) or no automated or manual test proves (`unproved`), a component whose file does not exist yet, a proof still owed by a planned test. A planned test does not clear `unproved`.
- **Two stages do not join up yet.** A rule no use case applies, a use case without a flow, an interaction requirement that fulfills nothing, a test whose type does not match what it proves, a component that satisfies nothing (`component-satisfies-nothing`), a test that proves and supports nothing (`test-proves-nothing`). Fix the link, or remove what has no purpose; never the check.
- **A level of the spec is the wrong size.** `too-many-children`: a record has more children of one kind than `structure.maxChildren` in `lathe.config.json` (default 15; tests are never counted). Add a level between them: a capability for use cases or flows, a layer for components, another aggregate for domain rules. `lone-child`: a capability or layer holds only one record; merge it into a neighbor, or give it more. Moving a record changes only its `parent`, never its ID. Do not raise `structure.maxChildren` to silence the warning unless the user asks.

Fix the warnings your task is about; leave the rest and mention them.

## Coverage

Coverage has one line per domain and obligation kind, with four counts out of the total:

- **designed**: a `design` link (by default a component's `satisfies`) targets it;
- **built**: a component whose file exists designs it;
- **proved**: an automated or manual test `proves` it (any `proof` relation);
- **planned**: not proved, but a planned test is meant to prove it.

A proof-only kind, such as a pattern rule, shows `proof only` instead of designed and built. Each domain also has a line of test counts: automated, manual and planned. A planned obligation has a test still to write; one neither proved nor planned has no test at all.

## Report

Say, in a few lines:

1. Whether the check passes (the last line: `N errors, M warnings.`).
2. Each error you fixed and how.
3. The coverage lines for each domain you touched, as `lathe check` prints them, and the warnings your change added or cleared.
4. Any planned tests your change added, and why they are planned.
