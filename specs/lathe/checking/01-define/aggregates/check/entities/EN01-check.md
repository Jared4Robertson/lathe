---
id: LA-CHK-EN01
kind: entity
title: Check
parent: LA-CHK-A1
role: root
links:
  has_many: [LA-CHK-EN02]
---
One rule the engine applies, one SQL file that returns rows of severity, check, record and message.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Name | The check's name, from its file name without the number and `.sql`. | Text, unique. | unproved |
| File | The SQL file that holds it. | File path. | lathe/checks/16-unproved.sql |
| Order | When it runs: Lathe's checks in file name order, then the product's own. | Whole number, from the file name. | 16 |
| Origin | Whether Lathe ships it or the product adds it. | `Lathe` or `product`. | Lathe |
| Summary | What it asks, in one sentence: the first paragraph of its header comment. | Text. | An obligation that no automated or manual test proves yet. |
| Explanation | What it reports, what it leaves to other checks, and how to fix it: the rest of the header. | Markdown. | A test proves an obligation through a `proof` link… |
| Severity | The severities it returns, from its header's `severity:` line. | `error`, `warning`, or both. | warning |
| Kinds | The kinds it concerns, from its header's optional `kinds:` line. | Kind references; none for any kind. | requirement domain_rule |
