---
name: discover-outcomes
description: Write or change a Lathe product's business outcomes - the discovery stage, first in the order - each a measurable statement with its measure and target, and link the capabilities that serve them. Use when starting a product's spec, asking what a product is for or how its success is measured, adding a capability, or closing the coverage gaps outcome-not-served and capability-serves-no-outcome, in a repo with lathe.config.json.
---

# Discover outcomes

Discovery is the first stage: before the domain model, write down what the product exists to achieve, as a handful of **business outcomes**, each one measurable. Every capability then names the outcomes it serves, so the trace runs from why to proof: outcome, capability, use case, code, test.

## How you write

The spec is typed data in the repo's `data/` folder, one table per kind. Change it only with Lathe's MCP tools, never by editing files: `add`, `set`, `move`, `link`, `unlink` and `remove` write; `show`, `list` and `next_id` read; `check` runs the checks. Each write is checked against the schema and refused, with its reasons, when it breaks the model; a refusal changes nothing, so fix the input and try again. Writes never commit: commit per task.

- The `add` tool's input schema lists `business_outcome`'s columns. In a shell, `lathe add business_outcome --help` prints the same (`npx lathe` in a product repo; `npm --prefix lathe run lathe -- <command> --root ..` in the Lathe repo).
- Take each outcome's ID from `next_id`, with the product as `parent`: `TL-BO01`, `TL-BO02`.

## A business outcome

| Column | What to write |
| --- | --- |
| `title` | The outcome in a few words: More tools in use. |
| `product_id` | The product. An outcome sits under its product, never a domain: one outcome is usually served by capabilities of several domains. |
| `statement` | The outcome in one sentence, as a change in the world the product brings about, stated so it can be measured: "Members borrow the library's tools more often." Not a feature ("Members can borrow tools"), and not a task. |
| `measure` | What is counted to know whether it is reached, and how: "Loans opened per catalog tool per month." A measure someone can actually count, from the product's own data or its runs. |
| `target` | The value of the measure that counts as reached, and by when: "Two per tool per month within a year of opening." |
| `notes` | Anything longer, such as where the measure's numbers come from. |

Write a handful, not dozens: three to six outcomes cover most products. Two outcomes with the same measure are one outcome. An outcome that no capability could move is a wish; leave it out or say what would serve it.

## Capabilities serve outcomes

Link each capability to every outcome it serves, with `serves` (capability to business outcome). It is many to many: a capability may serve several outcomes, and an outcome is usually served by several capabilities.

Coverage reports two gaps until the links are in:

- `outcome-not-served`: an outcome no capability serves. Link the capabilities that move it, or, if none could, ask the Owner whether the outcome belongs to this product.
- `capability-serves-no-outcome`: a capability that serves no outcome. Link the outcomes it serves, or ask the Owner what the capability is for; a capability that serves nothing is a candidate to drop.

When you add a capability later (the `write-use-cases` skill), link the outcomes it serves in the same task.

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
```

## Rules

- Specs name roles (Owner, Reader, Agent, or a product's own, such as Librarian), never people.
- Outcomes are the Owner's to decide: propose them from what the product's README and description say it is for, and ask the Owner when the purpose is unclear.
- Finish with the `check-and-fix` skill: no `outcome-not-served` or `capability-serves-no-outcome` gap should be left.
