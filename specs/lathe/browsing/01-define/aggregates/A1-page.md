---
id: LA-BRW-A1
kind: aggregate
title: Page
parent: LA-BRW
links:
  relates_to: [LA-CHK-A2]
---
One place in the app, identified by its address: a diagram (`/diagrams/<slug>`), a product (`/specs/<product-id>`), a domain (`/specs/<product-id>/<domain-id>`), a record (`/records/<id>`), the graph around a record (`/graph/<id>`), the checks (`/checks`), or the record format (`/format`). Every page shows a view of one loaded workspace.

Spec pages only read that workspace. Records are changed in their files, by a person in an editor or by an agent, and reviewed in git. The Diagrams pages keep their form for creating a diagram (`LA-MOD-UC01`).
