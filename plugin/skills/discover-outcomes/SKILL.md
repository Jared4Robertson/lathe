---
name: discover-outcomes
description: Write or change a Lathe product's business outcomes and journeys - the discovery stage, first in the order - each outcome a measurable statement with its measure and target, each journey the ordered use cases and handoffs from a trigger to a result, and link the capabilities and journeys that serve outcomes and what measures them. Use when starting a product's spec, asking what a product is for or how its success is measured, adding a capability, writing how use cases follow one another over time, or closing the coverage gaps outcome-not-served, outcome-not-measured, capability-serves-no-outcome, journey-serves-no-outcome, journey-without-main-path and journey-step-unlinked and the warnings serves-no-outcome, outcome-target-undated, outcome-duration-without-journey and journey-of-one-use-case, in a repo with lathe.config.json.
---

# Discover outcomes

Discovery is the first stage: before the domain model, write down what the product exists to achieve, as a handful of **business outcomes**, each measurable. Every capability then names the outcomes it serves, and every outcome names what measures it, so the trace runs from why to proof: outcome, journey or capability, use case, code, test.

Change the spec only with Lathe's MCP tools (or the `lathe` CLI), never by editing files. Fields, ID patterns and checks are in `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo). Outcomes sit under the product, never a domain: one outcome is usually served by capabilities of several domains.

## The test: would someone miss it?

A business outcome is a measurable change in the world that the product exists to bring about, for the people who use it. Before you write one, ask: **if the product disappeared, would someone notice this outcome was lost?**

- Yes, and you can say who and what they would lose: it is an outcome. "Members borrow the library's tools more often": members would notice.
- No, it is a property of the product or how it is built ("The code is tested", "Pages load fast", "The data is checked"): it is not an outcome. Write it as a standard rule or pattern rule, and let it serve the outcomes it protects.
- It has no measure, or its target has no date ("as many as possible", "two a month"): it is a wish until it says what is counted and by when. A year, or a span from a known event ("within a year of opening"), dates it.

Shape of a good one: a title naming the state wanted (More tools in use, not a task such as Increase borrowing or a feature such as Online borrowing); a statement that is a change in the world, not "Members can borrow tools"; a measure someone can actually count from the product's own data or runs; a target that is a value and a date.

An outcome's notes say how it serves the product's headline outcome, the one the product exists for: "Fewer lost tools keeps the shelves full, which is what brings members back to borrow." An outcome whose notes cannot say this is a candidate to drop or restate.

Write a handful, not dozens: three to six cover most products. Two outcomes with the same measure are one outcome. An outcome no capability could move is a wish; leave it out or say what would serve it.

Everything else in the product serves at least one outcome, and Lathe works that out: a record serves an outcome when a use case whose capability serves it, or that a step of a journey serving it carries out, reaches the record. You never type that link. A record that serves nothing is a warning: write the use case that needs it, or remove the record.

## Capabilities serve outcomes

It is many to many. Name every outcome each capability serves; coverage reports an outcome no capability serves, and a capability that serves no outcome. Do not invent an outcome to quiet either: for the first, ask whether the outcome belongs to this product; for the second, ask the Owner what the capability is for, since a capability that serves nothing is a candidate to drop. When you add a capability later (`write-use-cases`), name the outcomes it serves.

## Journeys

A capability says *what* the business can do; a **journey** says *in what order* it happens. A journey is an ordered string of steps from a **trigger** to a **result**, each step a use case (any actor, any domain) or a handoff, and it serves the outcomes that result moves. It is the product's, never a domain's: a journey crosses domains.

**When an outcome's measure is a duration** ("median days from a damage report to a repair"), that time is the length of a journey. Write the journey the measure times, and let it serve the outcome. Coverage warns `outcome-duration-without-journey` for a duration measure no journey serves. A duration inside one sitting by one actor (minutes to find the code behind a requirement) is a use case, not a journey. A count with no time order needs no journey.

**Write the trigger and result first.** The trigger is what starts it, in the world ("A tool is found damaged"); the result is what it ends in, which an outcome measures ("The tool is available to borrow again"). Both are required, in words, not event names. The title is a summary goal, verb first, naming no interface ("Get a damaged tool back in lending").

**Then the steps**, main path first, then each alternate path under its own name ("found outside a return"), each numbered 1, 2, 3 within its path. A step's title says what happens in the journey's words. A step **carries out** one use case, or one policy when it is a handoff: whenever an event, then a command, with no actor but the product. A use case is one role's one command or query, so a goal of several commands is a journey of command use cases, one step each. Steps have no actor of their own; they show their use case's. Link each step to what it carries out.

**Steps may stay unlinked** while their use cases do not exist yet. A journey is written in Discovery, before the use cases it needs, so each unlinked step (`journey-step-unlinked`) is a use case still to write (`write-use-cases`). Do not invent a use case to quiet the gap, and do not drop the step. A journey is not a promise: its promises are its steps' UC requirements and policies, and a journey test proves it (`plan-tests`).

**Closing the gaps.**
- `journey-serves-no-outcome`: a journey must serve an outcome. Link it to the outcome its result moves; if none fits, ask whether the journey belongs to this product.
- `journey-without-main-path`: add the steps of the main path.
- `journey-step-unlinked`: write the use case (or the policy) and link the step.
- `outcome-duration-without-journey`: write the journey the measure times, or restate the measure if it is not really a duration.
- `journey-of-one-use-case`: a journey needs at least two use cases to be one. With one it is a use case: remove the journey.

## What measures an outcome

Name what measures each outcome. What can:

- A test of any kind that counts or holds the measure: a performance test for a time budget, an accessibility audit for violations, a specification test for a rule that keeps a count at zero. A test counts only when it runs.
- A record of the product's own kind that computes the measure, such as a report script. The product declares the relation first (`extend-the-meta-model`).
- Nothing in the code, for an outcome only the world shows (adoption by other repos, sales): say who counts it and from where. Prefer building the report when the product's own data holds the measure.

## Rules

- Outcomes are the Owner's to decide: propose them from what the product's README and description say it is for, and ask when the purpose is unclear.
- Specs name roles (Owner, Reader, Agent, or a product's own), never people.
- Journeys are for time order across use cases; never write one for a single use case or a count.
- Finish with `check-and-fix`: no unserved or unmeasured outcome, no capability or journey serving nothing and no undated target should be left.
