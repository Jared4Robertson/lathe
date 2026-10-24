# Domain model data

The Lathe domain model, stored as plain CSV files that you can read, edit by hand and diff in git, and query with SQL through [DuckDB](https://duckdb.org). The model is split into diagrams, one folder each.

| File | What it holds |
|---|---|
| `diagrams.csv` | One row per diagram: `slug` (its folder name), `title`, `description`. This is the app's menu. |
| `<slug>/terms.csv` | One row per term: `name`, `kind`, `context`, `status`, `definition`. This is the diagram's glossary. |
| `<slug>/links.csv` | One row per relationship: `source`, `relation`, `target`, `cardinality`, `status`, `note`. |
| `../lathe/diagrams/checks.sql` | Consistency checks, shared by every diagram and shipped with Lathe. Run them after every edit. |
| `queries.sql` | Example questions to ask a diagram. |

Current diagrams:
- `people-and-tools`: the foundation, covering people, tools, and how actions and occurrences affect them.
- `sdlc-brainstorm`: a tree of software lifecycle activities, from defining the domain to designing the solution.

## Allowed values
- **kind:** `aggregate`, `entity`, `value_object`, `domain_event`, `term`, `topic` (a brainstorm node)
- **context:** `people_and_tools`, `making_software`, `sdlc`
- **relation:** `contains`, `serves`, `raises`, `prompts`, `changes`, `sets`, `is_a`, `includes` (topic to subtopic, forming a tree)
- **status:** `decided`, `draft`, `open` (open means unconfirmed, a "?" on the diagram)

## Running
From a diagram's folder:

```bash
cd model/people-and-tools && duckdb < ../../lathe/diagrams/checks.sql
```

```bash
cd model/people-and-tools && duckdb < ../queries.sql
```

For your own questions, run `duckdb` there and query the files directly, for example:

```sql
SELECT * FROM 'links.csv' WHERE target = 'Experience';
```

## Viewing
The app draws every diagram and has a menu to switch between them and create new ones. Each diagram has its own link, such as `http://localhost:5199/diagrams/people-and-tools`. This folder is named as the diagrams folder in the repo's `lathe.config.json`.

```bash
npm --prefix app run dev
```
