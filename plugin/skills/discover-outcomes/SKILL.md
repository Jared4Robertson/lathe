---
name: discover-outcomes
description: Write or change a Lathe product's business outcomes - the discovery stage, first in the order - each a measurable statement with its measure and target, and link the capabilities that serve them and what measures them. Use when starting a product's spec, asking what a product is for or how its success is measured, adding a capability, or closing the coverage gaps outcome-not-served, outcome-not-measured and capability-serves-no-outcome, in a repo with lathe.config.json.
---

# Discover outcomes

Discovery is the first stage: before the domain model, write down what the product exists to achieve, as a handful of **business outcomes**, each one measurable. Every capability then names the outcomes it serves, and every outcome names what measures it, so the trace runs from why to proof: outcome, capability, use case, code, test.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files: `add`, `set`, `move`, `link`, `unlink` and `remove` write; `show`, `list` and `next_id` read; `check` runs the checks. Each write is checked against the schema and refused, with its reasons, when it breaks the model; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task.

- The `add` tool's input schema lists `business_outcome`'s columns. In a shell, `lathe add business_outcome --help` prints the same (`npx lathe` in a product repo; `npm --prefix lathe run lathe -- <command> --root ..` in the Lathe repo).
- Take each outcome's ID from `next_id`, with the product as `parent`: `TL-BO01`, `TL-BO02`.

## A business outcome

| Column | What to write |
| --- | --- |
| `title` | The state wanted, as a noun phrase of 1 to 4 words: More tools in use. Not a task (Increase borrowing) or a feature (Online borrowing). |
| `product_id` | The product. An outcome sits under its product, never a domain: one outcome is usually served by capabilities of several domains. |
| `statement` | The outcome in one sentence, as a change in the world the product brings about, stated so it can be measured: "Members borrow the library's tools more often." Not a feature ("Members can borrow tools"), and not a task. |
| `measure` | What is counted to know whether it is reached, and how: "Loans opened per catalog tool per month." A measure someone can actually count, from the product's own data or its runs. |
| `target` | The value of the measure that counts as reached, and by when: "Two per tool per month within a year of opening." |
| `measured_outside` | Only for an outcome nothing in the code can measure (adoption by other repos, sales): who counts what, and from where. Leave it out when a test or record can measure it. |
| `notes` | Anything longer, such as where the measure's numbers come from. |

Every title, here and in every kind, is in sentence case with no trailing period, and unique within its kind and product: the store refuses a duplicate or a trailing period. The product's own title is its proper name, such as Tool Library. Each skill names its own kinds.

Write a handful, not dozens: three to six outcomes cover most products. Two outcomes with the same measure are one outcome. An outcome that no capability could move is a wish; leave it out or say what would serve it.

## Capabilities serve outcomes

Link each capability to every outcome it serves, with `serves` (capability to business outcome). It is many to many: a capability may serve several outcomes, and an outcome is usually served by several capabilities.

Coverage reports two gaps until the links are in:

- `outcome-not-served`: an outcome no capability serves. Link the capabilities that move it, or, if none could, ask the Owner whether the outcome belongs to this product.
- `capability-serves-no-outcome`: a capability that serves no outcome. Link the outcomes it serves, or ask the Owner what the capability is for; a capability that serves nothing is a candidate to drop.

When you add a capability later (the `write-use-cases` skill), link the outcomes it serves in the same task.

## What measures an outcome

Link each outcome to what measures it, with `measured_by` (business outcome to test or record). What can measure one:

- **A test of any kind** that counts or holds the measure: a performance test for a time budget, an accessibility audit for violations, a specification test for a rule that keeps a count at zero. A test counts only when it runs: manual, or automated with its file naming its ID.
- **A record of the product's own kind** that computes the measure, such as a report script or a command whose output is the measure. Lathe allows it once the product declares the pair: a `product_relation` named `measured_by` from `business_outcome` to that kind.
- **Nothing in the code**, for an outcome only the world shows (adoption by other repos, sales): say so in `measured_outside`, with who counts it and from where. Prefer building the report when the product's own data holds the measure.

Coverage reports `outcome-not-measured` until one of these is in.

## Examples: the Tool Library

Two outcomes, and the capabilities that serve them:

```
add  { "business_outcome": { "id": "TL-BO01", "title": "More tools in use", "product_id": "TL",
       "statement": "Members borrow the library's tools more often.",
       "measure": "Loans opened per catalog tool per month.",
       "target": "Two per tool per month within a year of opening." } }
add  { "business_outcome": { "id": "TL-BO02", "title": "Tools back on time", "product_id": "TL",
       "statement": "Members bring borrowed tools back by their due date.",
       "measure": "Share of loans returned late, or still out and overdue, each month.",
       "target": "Under 5% each month by the end of the first year." } }
link { "source": "TL-LEND-CAP03", "relation": "serves", "target": "TL-BO01" }
link { "source": "TL-LEND-CAP03", "relation": "serves", "target": "TL-BO02" }
add  { "product_kind": { "name": "report", "product_id": "TL", "label": "Report", "parent_kind": "domain",
       "description": "A script that measures the library's business outcomes from its own records.",
       "stage": "technical-specification", "obligation": false, "id_pattern": "<domain>-RP<nn>" } }
add  { "product_relation": { "name": "measured_by", "source_kind": "business_outcome", "target_kind": "report", "product_id": "TL",
       "forward_label": "Measured by", "reverse_label": "Measures",
       "description": "The report measures the business outcome: it counts the measure from the library's records." } }
link { "source": "TL-BO01", "relation": "measured_by", "target": "TL-LEND-RP01" }
link { "source": "TL-BO02", "relation": "measured_by", "target": "TL-LEND-RP01" }
```

## Rules

- Specs name roles (Owner, Reader, Agent, or a product's own, such as Librarian), never people.
- Outcomes are the Owner's to decide: propose them from what the product's README and description say it is for, and ask the Owner when the purpose is unclear.
- Finish with the `check-and-fix` skill: no `outcome-not-served`, `outcome-not-measured` or `capability-serves-no-outcome` gap should be left.
