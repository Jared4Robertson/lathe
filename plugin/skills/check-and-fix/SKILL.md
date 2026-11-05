---
name: check-and-fix
description: Run lathe check, fix every error it reports, and report warnings, gaps and coverage; review the essential records with fresh eyes before proposing an essential change. Use after changing any Lathe spec data, before committing spec changes, when a write is refused, or when asked whether the spec is consistent or how much is designed, built and proved.
---

# Check and fix

The spec is typed data, changed only with Lathe's MCP tools (or the `lathe` CLI and the app), never by editing files. Each command refuses what breaks its aggregate's rules outright, so what is left for the check is what one command cannot settle: what nothing uses yet, what a later stage still owes, and whether the code backs what the tests claim.

Run the `check` tool (in a shell, `npx lathe check`, or `npm --prefix lathe run check` in the Lathe repo; it exits 1 on any error). Run it before you report or commit. Each problem names its check; `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo) explains every check and how to fix what it reports. Read the entry before you fix.

## When a command is refused

A refusal changed nothing and lists every reason, each with the rule it broke. Read the reasons; they say what to fix. Judgment on the usual ones:

- A key never changes and a change never takes a parent column. A record that needs another key or another parent is removed and added again, or moved with its aggregate's move command where there is one. Never renumber a record to get past a refusal.
- A title refused for a duplicate, a trailing period or whitespace: rename it by the naming convention of the skill that writes the kind. Never add a number or suffix just to make it unique.
- A removal refused because something references the record: change or remove those records first.
- Fix the record that is wrong, not the one that reports it.

## Errors and warnings

An error means the workspace is broken; do not leave one behind. Fix the warnings your task is about, leave the rest and mention them. Do not raise a size setting (`max_children`, `max_entities_per_aggregate`) to silence a warning unless the Owner asks: split or merge instead.

Never change a product's own kinds or checks to make an error go away unless asked (`extend-the-meta-model`).

## No exceptions

A rule is never waived or recorded as a deliberate deviation. When a record cannot meet a rule, the model is wrong: change it until it does. A command that would change a second aggregate is fixed by splitting the aggregate, or by following the second change through an event and a policy (`model-a-domain`). Ask the Owner when the rule itself seems wrong; a standard is the Owner's to change.

## Review the essential records with fresh eyes

Essential records (outcomes, the domain model, use cases and their requirements, flows, views, terms, quality standards) are the Owner's decisions. A write that names technology in one, or links one to a technical record, is refused; what is already there is a warning (`accidental-in-essential`, `essential-restates-technical`, and `essential-repeated` for a statement repeated across use cases or views, which is a pattern in disguise). What no check can see takes a reader.

Before you propose adding, changing or removing an essential record, list the product's essential records alone, grouped by domain, with the Essential review's list-essential-records query. It leaves out the technical records, the patterns and the tests. Read each record as someone who knows the domain but not software, and ask: would they recognize this record and care about it? List every record that fails, with why (it names how the product is built, restates what the technical specification says, or repeats what a pattern should say once), and what it should say instead. Do not change an essential record on that finding alone: report the list for the Owner to decide.

## Accidental debt and pattern candidates

Every accidental record must be derived, provided or a fill (`accidental-not-accounted-for`). An engineering standard and its rules fill no slot: link the records that follow a rule to it with `meets`, or remove a rule that nothing follows. Fills are the product's accidental debt: coverage lists them, and each is a deliberate, visible deviation, not a failure. Read the debt by slot. A slot with three or more fills is a pattern candidate (`pattern-candidate`): report what the fills repeat so the Owner can have it written as a pattern and generated. A slot that gives the reason its fills vary by design (`fills_vary_by_design`) is not reported; if you find one whose fills do repeat, report it. Do not hide debt by deleting a fill or marking a record provided when it is not.

## Use case line checks

A use case is one goal one actor sets out to finish in one sitting, which leaves something the business cares about true (LA-STD-MODELING-R15). Three warnings read the line:

- `use-case-changes-many-aggregates`: the use case's actors' own steps send commands of more than one aggregate, counted per interface that offers it (its shared steps and that interface's variants). Queries, steps on a path named refused and another actor's writes are not counted. Split it by goal; make the later change a policy that hears the first's event; make another actor's write the trigger, not a step; write a link from the record that owns it; or make the goals a journey (`discover-outcomes`).
- `use-case-title-joins-goals`: the title holds "and", "or" or a list outside a "with" phrase. Split it into a use case per goal, or name the parts of one thing with "with" ("Write a use case with its flow and tests").
- `another-actor-writes-in-a-step`: a step whose subject is a role that is not one of the use case's actors sends a command. Start the flow where the use case's actors take over, or make the write a use case of its own and string the two in a journey.

Fix the use case, not the step's wording: rewording a step so the check stops reading it hides the second goal.

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
