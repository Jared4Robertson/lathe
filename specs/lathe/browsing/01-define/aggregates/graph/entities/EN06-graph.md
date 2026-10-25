---
id: LA-BRW-EN06
kind: entity
title: Graph
parent: LA-BRW-A4
role: root
links:
  has_many: [LA-BRW-EN07, LA-BRW-EN08, LA-BRW-EN09]
  refers_to: [LA-BRW-EN01]
---
The drawing of a page's focus with the records around it, which the same settings always draw the same way.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Page | The page the graph is a view of. | Page reference. | /records/TL-LEND-DR05?view=split |
| Mode | Whether it reads along the parent and child tree, or along the trace from rule to test. | `hierarchy` or `trace`. | hierarchy |
| Depth | How far from the focus it reaches. | Whole number, at least 1. | 2 |
| Hidden kinds | Kinds the filters hide; never the focus's own. | List of kinds, or none. | None |
| Hidden relations | Relations the filters hide, with the paths through them. | List of relations, or none. | None |
