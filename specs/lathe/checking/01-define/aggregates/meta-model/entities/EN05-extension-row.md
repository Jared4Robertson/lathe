---
id: LA-CHK-EN05
kind: entity
title: Extension row
parent: LA-CHK-A1
role: child
---
One row a product adds in its own meta-model extension folder, which adds a kind, relation or folder or widens a default one.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Folder | The product's extension folder, as its config names it. | Folder path, relative to the root. | lathe-meta |
| File | Which of the three files the row is in. | `kinds.csv`, `relations.csv` or `sections.csv`. | kinds.csv |
| Row | The row itself, in the same columns as the default file. | One CSV row. | `pattern_rule,,,,,,yes,` |
| Effect | What the row does to the defaults. | Derived: adds, or widens or changes a default with the same name. | Widens pattern_rule to ask for design |
