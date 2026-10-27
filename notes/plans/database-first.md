# Plan: database first, a table per kind

## Outcome
Lathe keeps every product's spec as structured data in a database whose schema enforces the model. There is a table per kind, with typed columns and real keys, so data that breaks the model can't be saved. Markdown files are no longer the source. The same principle holds across all of Lathe: every slice's aggregates are concrete tables, not generic records.

## Status
Agreed (2026-10-26).

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
4. **Products may add their own kinds.** A product declares an extra kind, and Lathe generates its table from that declaration, with the same keys and enforcement as Lathe's own kinds.
5. **The principle holds across all of Lathe,** not just Authoring. Each slice's aggregates become concrete tables (see Scope).
6. **The source of truth is one JSONL file per table in the repo,** such as `data/requirement.jsonl`.
   - Each file holds one row per line, sorted by ID, with columns in a fixed order, so a change to a row is a one-line diff.
   - DuckDB loads the files into the typed tables, with their keys and constraints. A file that breaks the schema fails to load with a constraint error.
   - Every write goes through the command layer, which validates and then rewrites the affected lines.
   - Git is the history: `git log` and `git blame` show what changed and when, and the commit author shows whether the Owner or an Agent made it.
   - The database itself is never committed.
   - A merge driver for the data files keeps both sides' lines, sorts them again and runs the constraints. A real clash, such as one ID added twice or one row changed on both sides, fails with a clear error. (Owner chose this over an operation log.)
7. **Text is typed fields per kind,** in place of a free Markdown body.
   - For example, a requirement's one-sentence `statement`, a test's `given`, `when` and `then`, and a use case's `actor` and `goal`.
   - Long notes exist only where a kind declares a notes field.
   - The parsing and checks that read structure out of prose go: Fields tables, prose citations and body sections.
8. **A domain rule always names its domain, and may name an aggregate.** `domain_id` is required and `aggregate_id` optional. A rule that spans aggregates leaves `aggregate_id` empty and names what it touches with `involves` links.

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
- **Platform:** workspace and products loaded, theme and settings as tables. Writes go through one command layer, used by the app, the CLI and the plugin's MCP tools; each write is one transaction. History is git's, per decision 6.

## Changes to existing specs
Lathe's own spec moves into `data/` in the import (build step 3). The records that describe what changes are then updated through the command layer:
- **Authoring:**
  - the record format becomes the schema: Domain model A1 Meta-model, and the format use cases and rules;
  - FORMAT.md gives way to a schema reference generated from the tables;
  - the Product extension aggregate becomes the product-kind declaration.
- **Checking:**
  - check records describe constraints and queries, not SQL files with headers;
  - error checks the schema now enforces are retired as checks and kept as constraints;
  - the Check aggregate gains the problem table.
- **Traceability:** coverage and gaps are views. Proof claims read code-scan tables, and prose mentions go.
- **Exploring:** pages read the tables, records are edited with forms generated from the schema, and History reads git.
- **Platform:**
  - the workspace loads `data/` in place of `specs/`;
  - the app server gains the write API;
  - live reload watches `data/`;
  - the command layer is a new aggregate;
  - the merge driver is set up per repo.
- **Plugin:** skills write through MCP tools, never files.

## Build steps
1. **Schema:**
   - SQL migrations in `lathe/schema/`: a table per kind with typed columns, keys and checks;
   - the ID registry and the `obligation` supertype;
   - a link table per relation;
   - the product-kind declaration and its table generator.
   
   Everything else depends on this.
2. **Store:**
   - load `data/*.jsonl` into the typed tables;
   - the command layer: validate in a transaction, then rewrite the affected files deterministically, sorted by ID with fixed column order;
   - the merge driver and `.gitattributes`.
3. **Import:**
   - a one-time converter from every product's Markdown (LA, the Tool Library and the test fixtures) into `data/`, placing body text in typed fields;
   - kinds that need notes declare them;
   - the converter reports anything it can't place, and the owner settles those before the cutover.
4. **Engine:**
   - checks rewritten against the typed tables, with error checks moved to constraints;
   - coverage as views;
   - the Markdown reader, `lathe format`, the meta CSVs, prose parsing and FORMAT.md deleted;
   - REFERENCE.md generated from the schema.
5. **Writers:**
   - CLI commands per kind (add, set, move, link, remove);
   - the plugin's MCP tools;
   - the plugin's skills rewritten to use them.
6. **App:**
   - the server reads the database and serves the write API;
   - pages read the typed tables;
   - forms generated from the schema;
   - History from git;
   - live reload on `data/`.
7. **Lathe's own spec:** update the records listed under Changes to existing specs through the command layer, then delete `specs/`.

Steps 3 to 6 run in parallel once 1 and 2 land, on one integration branch for the hard cutover. Step 7 follows, then the full checks run once.
## Open questions
None.
