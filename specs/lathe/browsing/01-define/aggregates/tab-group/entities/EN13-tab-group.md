---
id: LA-BRW-EN13
kind: entity
title: Tab group
parent: LA-BRW-A8
role: root
links:
  has_many: [LA-BRW-EN14]
  refers_to: [LA-BRW-EN03]
---
The tabs open in one space, in order, with one active.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Space | The space whose tabs these are. | Space reference. | LA |
| Tabs | The open tabs, left to right. | Ordered list of tabs, never empty. | Two tabs |
| Active tab | The tab shown, whose page the address names. | Tab reference. | The second tab |
