---
name: discover-outcomes
description: Write or change a Lathe product's business outcomes - the discovery stage, first in the order - each a measurable statement with its measure and target, and link the capabilities that serve them and what measures them. Use when starting a product's spec, asking what a product is for or how its success is measured, adding a capability, or closing the coverage gaps outcome-not-served, outcome-not-measured and capability-serves-no-outcome and the warnings serves-no-outcome and outcome-target-undated, in a repo with lathe.config.json.
---

# Discover outcomes

Discovery is the first stage: before the domain model, write down what the product exists to achieve, as a handful of **business outcomes**, each one measurable. Every capability then names the outcomes it serves, and every outcome names what measures it, so the trace runs from why to proof: outcome, capability, use case, code, test.

## The test: would someone miss it?

A business outcome is a measurable change in the world that the product exists to bring about, for the people who use it (LA-STD-MODELING-R13). Before you write one, ask: **if the product disappeared, would someone notice this outcome was lost?**

- Yes, and you can say who and what they would lose: it is an outcome. "Members borrow the library's tools more often": members would notice.
- No, it is a property of the product or of how it is built ("The code is tested", "Pages load fast", "The data is checked"): it is not an outcome. Write it as a standard rule or a pattern rule instead, and let it serve the outcomes it protects.
- It has no measure, or its target has no date ("as many as possible", "two a month"): it is a wish until it says what is counted and by when (`outcome-target-undated` warns of a target with no date: give it a year, or a span from a known event such as "within a year of opening").

Everything else in the product serves at least one outcome, and Lathe works that out for you: a record **serves** an outcome when a use case whose capability serves that outcome reaches it (its steps, what they invoke and what that changes, checks, calls and reads, the views and endpoints involved, the patterns it follows). You never type that link: each record's page shows it on its Serves line, and the Serves read's get-serves and list-serves tools give it. The `serves-no-outcome` warning names each aggregate, read model or obligation no outcome reaches: write the use case that needs it (with a step that invokes what reaches it), or remove it.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files. Every kind belongs to one aggregate of Lathe's own model, and each aggregate has its own tools, named for the aggregate and the command. `check` runs the checks. Each command checks its aggregate's rules and is refused, with every reason, when it breaks them; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task.

- A record's links are fields of its own add and change: an outcome's `measured_by`, a capability's `serves`. On a change a list replaces the list. There are no tools that link or unlink.
- Each tool's input schema lists its fields, with each column's type and meaning. In a shell the same commands are `lathe <aggregate> <command> --<field> <value>` (`lathe business-outcome add-business-outcome --help` prints its fields; `npx lathe` in a product repo, `npm --prefix lathe run lathe -- <aggregate> <command> --root ..` in the Lathe repo), or the tool's own JSON with `--json -` (stdin) or `--json <file>`.
- Take each outcome's ID from `business_outcome_next_id`, with the product as `parent`: `TL-BO01`, `TL-BO02`.

The tools of this stage, by aggregate:

| Aggregate | Its tools |
| --- | --- |
| Business outcome | `business_outcome_add_business_outcome` (with what it is `measured_by`), `business_outcome_change_business_outcome`, `business_outcome_remove_business_outcome`; `business_outcome_get_business_outcome`, `business_outcome_list_business_outcomes`, `business_outcome_next_id` |
| Domain | `domain_change_capability` (with the outcomes it `serves`); `domain_get_domain` |

## A business outcome

| Column | What to write |
| --- | --- |
| `title` | The state wanted, as a noun phrase of 1 to 4 words: More tools in use. Not a task (Increase borrowing) or a feature (Online borrowing). |
| `product_id` | The product. An outcome sits under its product, never a domain: one outcome is usually served by capabilities of several domains. |
| `statement` | The outcome in one sentence, as a change in the world the product brings about, stated so it can be measured: "Members borrow the library's tools more often." Not a feature ("Members can borrow tools"), and not a task. |
| `measure` | What is counted to know whether it is reached, and how: "Loans opened per catalog tool per month." A measure someone can actually count, from the product's own data or its runs. |
| `target` | The value of the measure that counts as reached, and by when: "Two per tool per month within a year of opening." A target with no date is warned of (`outcome-target-undated`). |
| `measured_outside` | Only for an outcome nothing in the code can measure (adoption by other repos, sales): who counts what, and from where. Leave it out when a test or record can measure it. |
| `notes` | Anything longer, such as where the measure's numbers come from. |

Every title, here and in every kind, is in sentence case with no trailing period, and unique within its kind and product: a duplicate or a trailing period is refused. The product's own title is its proper name, such as Tool Library. Each skill names its own kinds.

Write a handful, not dozens: three to six outcomes cover most products. Two outcomes with the same measure are one outcome. An outcome that no capability could move is a wish; leave it out or say what would serve it.

## Capabilities serve outcomes

Name every outcome each capability serves in its `serves` (capability to business outcome), with `domain_change_capability`. It is many to many: a capability may serve several outcomes, and an outcome is usually served by several capabilities.

Coverage reports two gaps until the links are in:

- `outcome-not-served`: an outcome no capability serves. Name it in the `serves` of the capabilities that move it, or, if none could, ask the Owner whether the outcome belongs to this product.
- `capability-serves-no-outcome`: a capability that serves no outcome. Name the outcomes it serves, or ask the Owner what the capability is for; a capability that serves nothing is a candidate to drop.

When you add a capability later (the `write-use-cases` skill), give the outcomes it serves in its `serves`.

## What measures an outcome

Name what measures each outcome in its `measured_by` (business outcome to test or record). What can measure one:

- **A test of any kind** that counts or holds the measure: a performance test for a time budget, an accessibility audit for violations, a specification test for a rule that keeps a count at zero. A test counts only when it runs: manual, or automated with its file naming its ID.
- **A record of the product's own kind** that computes the measure, such as a report script or a command whose output is the measure. Lathe allows it once the product declares the pair: a product relation named `measured_by` from `business_outcome` to that kind (`product_declare_product_relation`, see `extend-the-meta-model`).
- **Nothing in the code**, for an outcome only the world shows (adoption by other repos, sales): say so in `measured_outside`, with who counts it and from where. Prefer building the report when the product's own data holds the measure.

Coverage reports `outcome-not-measured` until one of these is in.

## Examples: the Tool Library

Two outcomes, and a capability that serves them:

```
business_outcome_add_business_outcome { "id": "TL-BO01", "title": "More tools in use", "product_id": "TL",
       "statement": "Members borrow the library's tools more often.",
       "measure": "Loans opened per catalog tool per month.",
       "target": "Two per tool per month within a year of opening." }
business_outcome_add_business_outcome { "id": "TL-BO02", "title": "Tools back on time", "product_id": "TL",
       "statement": "Members bring borrowed tools back by their due date.",
       "measure": "Share of loans returned late, or still out and overdue, each month.",
       "target": "Under 5% each month by the end of the first year." }
domain_change_capability { "id": "TL-LEND-CAP03", "serves": ["TL-BO01", "TL-BO02"] }
```

A report of the product's own kind that measures them: the kind and the relation are declared first (`extend-the-meta-model`), then the report is added, then each outcome names it.

```
product_declare_product_kind { "name": "report", "product_id": "TL", "label": "Report", "parent_kind": "domain",
       "description": "A script that measures the library's business outcomes from its own records.",
       "stage": "technical-specification", "obligation": false, "id_pattern": "<domain>-RP<nn>" }
product_declare_product_relation { "name": "measured_by", "source_kind": "business_outcome", "target_kind": "report", "product_id": "TL",
       "forward_label": "Measured by", "reverse_label": "Measures",
       "description": "The report measures the business outcome: it counts the measure from the library's records." }
business_outcome_change_business_outcome { "id": "TL-BO01", "measured_by": ["TL-LEND-RP01"] }
business_outcome_change_business_outcome { "id": "TL-BO02", "measured_by": ["TL-LEND-RP01"] }
```

## Rules

- Specs name roles (Owner, Reader, Agent, or a product's own, such as Librarian), never people.
- Outcomes are the Owner's to decide: propose them from what the product's README and description say it is for, and ask the Owner when the purpose is unclear.
- Finish with the `check-and-fix` skill: no `outcome-not-served`, `outcome-not-measured` or `capability-serves-no-outcome` gap, and no `outcome-target-undated` warning, should be left. A `serves-no-outcome` warning is closed later, by the use case that needs the record (`write-use-cases`), or by removing the record.
