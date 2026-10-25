---
id: LA-AUT-EN02
kind: entity
title: Product extension
parent: LA-AUT-A1
role: child
---
What a product adds to Lathe: its `lathe.config.json` (its specs and checks folders, ID prefixes and size limit) and the rows of its meta-model extension folder, which add a kind, relation or folder or widen a default one.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Config | The product's settings file. | `lathe.config.json` at the product root. | { "specs": "specs" } |
| Folders | Where its specs, checks and meta-model extension are. | Folder paths, relative to the root. | specs, lathe-checks, lathe-meta |
| ID prefixes | Extra prefixes its prose cites. | List of ID-shaped prefixes. | ACME |
| Max children | The most children of one kind a record may hold. | Whole number, at least 1; 15 by default. | 15 |
| Extension rows | Rows in its extension's kinds, relations, sections and ids files, in the default files' columns. | CSV rows. | `pattern_rule,,,,,,yes,` |
| Effect | What each row does to the defaults. | Derived: adds, or widens or changes a default with the same name. | Widens pattern_rule to ask for design |
