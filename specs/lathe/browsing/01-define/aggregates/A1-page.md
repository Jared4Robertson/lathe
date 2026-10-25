---
id: LA-BRW-A1
kind: aggregate
title: Page
parent: LA-BRW
links:
  relates_to: [LA-CHK-A2]
---
One place in the app, identified by its address: a diagram (`/diagrams/<slug>`), the products (`/specs`), a product (`/specs/<product-id>`), a domain (`/specs/<product-id>/<domain-id>`), a record (`/records/<id>`), a group of a record's children of one kind (`/records/<parent-id>/<kind>`), the checks (`/checks`), or the record format (`/format`). Every page shows a view of one loaded workspace.

A product, domain, record or group page shows its one focus in the views that are open, each a pane: Wiki, Graph and, on a domain, aggregate or entity page, Model. The address names them, as in `?view=wiki,graph`; the views never change the path, and the old `?view=split` opens the wiki and the graph. The older graph addresses (`/graph/<id>`, `/graph/<parent-id>/<kind>`, `/graph`, and `/specs/<product-id>/<domain-id>/graph`) lead to the same thing in the Graph view. Such a page has three columns: the navigation, the main view, and the inspector, which shows the focused record's facts.

Spec pages only read that workspace. Records are changed in their files, by a person in an editor or by an agent, and reviewed in git. The Diagrams pages keep their form for creating a diagram (`LA-MOD-UC01`).
