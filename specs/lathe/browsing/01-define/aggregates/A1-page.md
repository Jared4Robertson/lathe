---
id: LA-BRW-A1
kind: aggregate
title: Page
parent: LA-BRW
links:
  relates_to: [LA-CHK-A2]
---
One place in the app, identified by its address: a diagram (`/diagrams/<slug>`), the products (`/`), a record at its bare ID (`/<id>`, a product's and a domain's being their overview), a group of a record's children of one kind (`/<parent-id>/<kind>`), the checks (`/checks`), the record format (`/format`), a kind's or a check's page in it (`/format/kinds/<kind>`, `/format/checks/<check>`), or Appearance (`/settings/appearance`). App pages are lowercase words, so no ID, which starts with a capital, can take their address. Every page shows a view of one loaded workspace.

A product, domain, record or group page shows its one focus in the views that are open, each a pane: Wiki, Graph and, on a domain, aggregate or entity page, Model. The address names them, as in `?view=wiki,graph`; the views never change the path, and the old `?view=split` opens the wiki and the graph. The older addresses lead to the same thing: `/records/<id>` and `/records/<parent-id>/<kind>` to the ID's, `/specs` to the products and `/specs/<product-id>` and `/specs/<product-id>/<domain-id>` to the product's and the domain's page, and the graph addresses (`/graph/<id>`, `/graph/<parent-id>/<kind>`, `/graph`, and `/specs/<product-id>/<domain-id>/graph`) to the same thing in the Graph view. Such a page has three columns: the navigation, the main view, and the inspector, which shows the focused record's facts. A format page has the same columns, with one pane and the kind's or check's facts in the inspector.

Spec pages only read that workspace. Records are changed in their files, by a person in an editor or by an agent, and reviewed in git. The Diagrams pages keep their form for creating a diagram (`LA-MOD-UC01`).
