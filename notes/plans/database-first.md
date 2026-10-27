# Plan: database first, a table per kind

## Outcome
Lathe keeps every product's spec as structured data in a database whose schema enforces the model. There is a table per kind, with typed columns and real keys, so data that breaks the model can't be saved. Markdown files are no longer the source. The same principle holds across all of Lathe: every slice's aggregates are concrete tables, not generic records.

## Status
Draft (2026-10-26).

## Context
Today, Markdown files with YAML headers are the source. The engine reads them into DuckDB on every run, as generic tables:
- `records`, `fields` and `links`, all text;
- the meta-model CSVs (`kinds`, `relations`, `sections`, `kind_ids`) say what's allowed;
- `entity_tables`, `entity_fields` and `prose_mentions` read structure back out of prose.

Nothing is typed or constrained. SQL checks report broken data after it is written. A requirement and a test differ only by a `kind` string.

## Decisions (Owner)
1. **Move away from Markdown files completely.** The spec lives in a database as structured, schema-enforced data. This is a hard cutover: the current specs are imported once, then the Markdown read path and `specs/` go.
2. **A table per kind, with concrete modeling.** Domain, aggregate, use case, requirement, test and the rest each get their own table. Aggregate fields are typed columns, enforced by the database.
   - Containment is a foreign key: a requirement's `use_case_id`, an entity's `aggregate_id`.
   - Entity and event fields are rows of their own (`entity_field`), not Markdown tables.
   - Links that target several kinds (`satisfies`, `proves`) point at a shared supertype table (`obligation`), keeping real foreign keys.
   - A shared ID registry keeps every ID unique across tables, so a bare ID still resolves.
3. **The schema is the meta-model.** `kinds.csv`, `relations.csv`, `sections.csv` and `ids.csv` give way to the tables, columns and keys themselves, changed by migrations.
4. **Products may add their own kinds.** A product declares an extra kind, and Lathe generates its table from that declaration, with the same keys and enforcement as Lathe's own kinds. (Owner said yes to allowing product kinds; confirm this reading.)
5. **The principle holds across all of Lathe,** not just Authoring. Each slice's aggregates become concrete tables (see Scope).
6. **The source of truth is an operation log in the repo.**
   - Every write is appended to the log as one line of text, and the database is built by replaying it.
   - Branches merge by combining both logs and replaying them, so a conflict shows up as a constraint failure on replay.
   - Git keeps branches, review and history; the database is never committed.

## Scope
Each slice's aggregates, as tables:
- **Authoring:**
  - one table per spec kind: product, role, domain, capability, aggregate, entity, field, domain rule, domain event, use case, requirement, pattern, pattern rule, setting, standard, standard rule, layer, component, flow, flow step, technical flow and design step, view, API, endpoint, interaction requirement, integration, test, open question;
  - a link table per relation;
  - generated tables for product kinds.
- **Checking:**
  - `check` (name, severity, summary, explanation, query) in place of check files with headers;
  - `problem`, the result of a run;
  - structure size limits as typed settings.
  
  Most error checks become constraints, so a write that breaks them is refused. The checks that remain report warnings and gaps.
- **Traceability:** coverage and gaps as views over the tables. Proof claims and file facts as tables filled by scanning the code.
- **Exploring:** the reading model (pages, folders, the graph's tree) as queries over the tables. Saved reader state (tabs, spaces) as tables, if it is kept.
- **Platform:** workspace and products loaded, theme and settings as tables. Writes go through one command layer, used by the app, the CLI and the plugin's MCP tools. Each write is a transaction recorded with who made it (Owner or Agent), when and why.

Out of scope until decided: how far body prose becomes typed fields (Open questions 1).

## Changes to existing specs
To list once the open questions are settled. Expect:
- Authoring's format rules and FORMAT.md to become a schema reference;
- Checking's error checks to become constraints;
- Exploring to gain editing;
- Platform to gain the command layer and history.

## Build steps
To write once the open questions are settled.

## Open questions
1. **How far prose becomes typed fields:** for example, a requirement's `statement` and a test's `given`, `when` and `then`, with long notes only where a kind declares them. Recommendation: typed fields per kind. Owner to decide.
2. **Domain rules on the domain as well as an aggregate.** Recommendation: allow both, with `aggregate_id` optional and `domain_id` required. Owner to decide.
