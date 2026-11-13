---
name: check-and-fix
description: Run lathe check, fix every error it reports, and report warnings, gaps and coverage; review the essential records with fresh eyes before proposing an essential change. Use after changing any Lathe spec data, before committing spec changes, when a write is refused, or when asked whether the spec is consistent or how much is designed, built and proved.
---

# Check and fix

The spec is typed data, changed only with Lathe's MCP tools (or the `lathe` CLI and the app), never by editing files. Each command refuses what breaks its aggregate's rules outright, so what is left for the check is what one command cannot settle: what nothing uses yet, what a later stage still owes, and whether the code backs what the tests claim.

Run the `check` tool (in a shell, `npx lathe check`, or `npm --prefix lathe run check` in the Lathe repo; it exits 1 on any error, and in a product whose check is strict on any warning beyond those it accepts and on any gap). Run it before you report or commit. Each problem names its check; `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo) explains every check and how to fix what it reports. Read the entry before you fix.

## When a command is refused

A refusal changed nothing and lists every reason, each with the rule it broke. Read the reasons; they say what to fix. Judgment on the usual ones:

- A key never changes and a change never takes a parent column. A record that needs another key or another parent is removed and added again, or moved with its aggregate's move command where there is one. Never renumber a record to get past a refusal.
- A title refused for a duplicate, a trailing period or whitespace: rename it by the naming convention of the skill that writes the kind. Never add a number or suffix just to make it unique.
- A removal refused because something references the record: change or remove those records first.
- Fix the record that is wrong, not the one that reports it.

## Errors and warnings

An error means the workspace is broken; do not leave one behind. Fix the warnings your task is about, leave the rest and mention them. Do not raise a size setting (`max_children`, `max_entities_per_aggregate`) to silence a warning unless the Owner asks: split or merge instead.

Every write's answer lists the warnings it introduced (`introduced`: each warning, and any `strict-check` or `strict-gaps` error, the check before it did not report: a strict product's first gap shows as its `strict-gaps` error), for every product. Fix them before your next write, while you know what caused them.

## Strict checks

A product makes its check strict with `product_setting_set_strict_check` (`lathe product-setting set-strict-check --product_id <id> --strict_check true`): any warning of the product then fails the check as a `strict-check` error, and the count line says the product is strict. While zero cannot be reached yet, the setting accepts a count of warnings (`--accepted_warnings`), a recorded deviation the Owner agreed, shown with the setting and on the Checks panel. The check fails above the count (fix the new warnings) and below it (lower the count to the new one with the same command), so the count only moves down. A count above the warnings there now is refused. Never raise it, never turn strictness off, and never silence a warning one by one: there is no ignore list. A deviation is recorded on the record it concerns (such as a slot's `fills_vary_by_design`), or the Owner decides.

A strict product's check also fails on any gap (an obligation not designed, built or proved, a record short of a minimum, an untraced file or route), as one `strict-gaps` error naming how many there are. Gaps have no accepted count: a gap is never a recorded deviation, only work to finish. List them with the Coverage gaps read model's list-coverage-gaps query (`lathe coverage-gaps list-coverage-gaps --product_id <id>`) or in the check's coverage, and close each one before you hand the work back.

Never change a product's own kinds or checks to make an error go away unless asked (`extend-the-meta-model`).

## No exceptions

A rule is never waived or recorded as a deliberate deviation. When a record cannot meet a rule, the model is wrong: change it until it does. A command that would change a second aggregate is fixed by splitting the aggregate, or by following the second change through an event and a policy (`model-a-domain`). Ask the Owner when the rule itself seems wrong; a standard is the Owner's to change.

## Review the essential records with fresh eyes

Essential records (outcomes, the domain model, use cases and their requirements, flows, views, terms, quality standards) are the Owner's decisions. A write that names technology in one, or links one to a technical record, is refused; what is already there is a warning (`accidental-in-essential`, `essential-restates-technical`, and `essential-repeated` for a statement repeated across use cases or views, which is a pattern in disguise). What no check can see takes a reader.

Before you propose adding, changing or removing an essential record, list the product's essential records alone, grouped by domain, with the Essential review's list-essential-records query. It leaves out the technical records, the patterns and the tests. Read each record as someone who knows the domain but not software, and ask: would they recognize this record and care about it? List every record that fails, with why (it names how the product is built, restates what the technical specification says, or repeats what a pattern should say once), and what it should say instead. Do not change an essential record on that finding alone: report the list for the Owner to decide.

## Accidental debt and pattern candidates

Every accidental record must be derived, provided or a fill (`accidental-not-accounted-for`). An engineering standard and its rules fill no slot: link the records that follow a rule to it with `meets`, or remove a rule that nothing follows. Fills are the product's accidental debt: coverage lists them, and each is a deliberate, visible deviation, not a failure. Read the debt by slot. A slot with three or more fills is a pattern candidate (`pattern-candidate`): report what the fills repeat so the Owner can have it written as a pattern and generated. A slot that gives the reason its fills vary by design (`fills_vary_by_design`) is not reported; if you find one whose fills do repeat, report it. Do not hide debt by deleting a fill or marking a record provided when it is not.

## Use case line checks

A use case is one role invoking one command, or asking one query: its result (LA-STD-MODELING-R15). Six checks read the line:

- `use-case-invokes-another-command` (error): a step, on any path or interface and whoever its subject, invokes a command that is not the use case's result. Split it: make the command its own use case, strung to this one in a journey when one waits on the other (`discover-outcomes`), or the command of a policy when the product does it on its own. The store refuses a write that adds one; unlink a step before you change the result away from its command.
- `use-case-identity-taken` (error): two use cases of a product share their first actor and their result. Merge the later into the earlier, moving its requirements, steps and tests. The store refuses a write that makes two share both.
- `use-case-result-not-invoked` (error): through some interface that offers it, no step of the main path invokes the result. Link the main-path step that invokes it, or make the result what the main path really ends in.
- `use-case-not-done` (error): a query use case's last main-path step that invokes anything asks something other than its result. Unlink the trailing query, make it a use case of its own, or make it the result. A command use case may ask queries after its result.
- `use-case-result-in-domain` (error): a use case's domain is not its result's aggregate's or read model's domain. Fix it with Move a use case: give it the result's domain, or a result of its own domain. The store refuses a write that makes it.
- `use-case-title-off-result` (warning): a command use case's title does not start with its command's verb. Retitle the use case with its command's verb, or rename the command when its verb is the one that is off.

Fix the use case, not the link: unlinking a step that does invoke a second command hides the second use case.

## Journey checks

- `step-order` (error) covers the steps of each path of a flow and of a journey: number them 1, 2, 3 without gaps, or move a step with the move command.
- `journey-of-one-use-case` (warning): a journey whose steps carry out fewer than two use cases is a use case (a step carrying out nothing yet counts as a use case to write); remove the journey, or add the steps it is missing.
- `handoff-not-connected` (warning): a handoff step whose policy hears no event the step before it on its path leads to: one raised by a command the previous use case's flow invokes, or by the previous handoff's command. Not read until that use case has a flow. Relink the step to the right policy, or fix the policy's event.
- `outcome-duration-without-journey` (warning): a measure that reads as a duration ("time/days/hours/minutes/weeks from", "how long", "median ... from", "from ... to") that no journey serves. Write the journey it times (`discover-outcomes`), or restate the measure if it is not a duration.
- `title-breaks-convention` covers a journey's title: verb first, a summary goal, no interface.
- Gaps: `journey-serves-no-outcome` (link the outcome), `journey-without-main-path` (add the main path's steps), `journey-step-unlinked` (write the use case or policy, then link the step), `journey-without-test` (add the journey test, `plan-tests`).
- A removal refused because a journey step carries the use case or policy out: relink or remove the step first.

## Gaps and coverage

Gaps are the "at least one" and "exactly one" a later stage still owes. They are work to do, not errors. Coverage counts obligations per domain:

- **designed**: its implementation is specified.
- **built**: every specific technical record that implements it names a file that exists, and there is at least one. A data model, a unique key or a component that only renders a view builds nothing; when something is reported not built, add the record that really builds it or write the code.
- **proved**: its tests exist at a level their kind allows, automated or manual. A test not automated yet is not proof.

## Report

Say, in a few lines: whether the check passes (the last line); each error you fixed and how; the essential records that failed the fresh-eyes review, when you proposed an essential change; the coverage for each domain you touched and the gaps and warnings your change added or cleared; and any tests not automated yet that you added, and why they wait.
