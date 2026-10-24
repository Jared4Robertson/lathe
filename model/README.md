# Domain model data

The Lathe domain model, stored as plain CSV files that you can read, edit by hand and diff in git, and query with SQL through [DuckDB](https://duckdb.org).

| File | What it holds |
|---|---|
| `terms.csv` | One row per term: `name`, `kind`, `context`, `status`, `definition`. This is the glossary. |
| `links.csv` | One row per relationship: `source`, `relation`, `target`, `cardinality`, `status`, `note`. |
| `checks.sql` | Consistency checks. Run them after every edit. |
| `queries.sql` | Example questions to ask the model. |

## Allowed values
- **kind:** `aggregate`, `entity`, `value_object`, `domain_event`, `term`
- **context:** `people_and_tools`, `making_software`
- **relation:** `contains`, `serves`, `raises`, `prompts`, `changes`, `sets`, `is_a`
- **status:** `decided`, `draft`, `open` (open means unconfirmed, a "?" on the diagram)

## Running
From the repo root:

```bash
duckdb < model/checks.sql
```

```bash
duckdb < model/queries.sql
```

For your own questions, run `duckdb` and query the files directly, for example:

```sql
SELECT * FROM 'model/links.csv' WHERE target = 'Experience';
```
