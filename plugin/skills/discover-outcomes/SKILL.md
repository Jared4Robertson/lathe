---
name: discover-outcomes
description: Write or change a Lathe product's business outcomes - the discovery stage, first in the order - each a measurable statement with its measure and target, and link the capabilities that serve them and what measures them. Use when starting a product's spec, asking what a product is for or how its success is measured, adding a capability, or closing the coverage gaps outcome-not-served, outcome-not-measured and capability-serves-no-outcome and the warnings serves-no-outcome and outcome-target-undated, in a repo with lathe.config.json.
---

# Discover outcomes

Discovery is the first stage: before the domain model, write down what the product exists to achieve, as a handful of **business outcomes**, each measurable. Every capability then names the outcomes it serves, and every outcome names what measures it, so the trace runs from why to proof: outcome, capability, use case, code, test.

Change the spec only with Lathe's MCP tools (or the `lathe` CLI), never by editing files. Fields, ID patterns and checks are in `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo). Outcomes sit under the product, never a domain: one outcome is usually served by capabilities of several domains.

## The test: would someone miss it?

A business outcome is a measurable change in the world that the product exists to bring about, for the people who use it. Before you write one, ask: **if the product disappeared, would someone notice this outcome was lost?**

- Yes, and you can say who and what they would lose: it is an outcome. "Members borrow the library's tools more often": members would notice.
- No, it is a property of the product or how it is built ("The code is tested", "Pages load fast", "The data is checked"): it is not an outcome. Write it as a standard rule or pattern rule, and let it serve the outcomes it protects.
- It has no measure, or its target has no date ("as many as possible", "two a month"): it is a wish until it says what is counted and by when. A year, or a span from a known event ("within a year of opening"), dates it.

Shape of a good one: a title naming the state wanted (More tools in use, not a task such as Increase borrowing or a feature such as Online borrowing); a statement that is a change in the world, not "Members can borrow tools"; a measure someone can actually count from the product's own data or runs; a target that is a value and a date.

Write a handful, not dozens: three to six cover most products. Two outcomes with the same measure are one outcome. An outcome no capability could move is a wish; leave it out or say what would serve it.

Everything else in the product serves at least one outcome, and Lathe works that out: a record serves an outcome when a use case whose capability serves it reaches the record. You never type that link. A record that serves nothing is a warning: write the use case that needs it, or remove the record.

## Capabilities serve outcomes

It is many to many. Name every outcome each capability serves; coverage reports an outcome no capability serves, and a capability that serves no outcome. Do not invent an outcome to quiet either: for the first, ask whether the outcome belongs to this product; for the second, ask the Owner what the capability is for, since a capability that serves nothing is a candidate to drop. When you add a capability later (`write-use-cases`), name the outcomes it serves.

## What measures an outcome

Name what measures each outcome. What can:

- A test of any kind that counts or holds the measure: a performance test for a time budget, an accessibility audit for violations, a specification test for a rule that keeps a count at zero. A test counts only when it runs.
- A record of the product's own kind that computes the measure, such as a report script. The product declares the relation first (`extend-the-meta-model`).
- Nothing in the code, for an outcome only the world shows (adoption by other repos, sales): say who counts it and from where. Prefer building the report when the product's own data holds the measure.

## Rules

- Outcomes are the Owner's to decide: propose them from what the product's README and description say it is for, and ask when the purpose is unclear.
- Specs name roles (Owner, Reader, Agent, or a product's own), never people.
- Finish with `check-and-fix`: no unserved or unmeasured outcome, no capability serving nothing and no undated target should be left.
