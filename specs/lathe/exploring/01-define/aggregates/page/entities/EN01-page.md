---
id: LA-EXP-EN01
kind: entity
title: Page
parent: LA-EXP-A1
role: root
links:
  refers_to: [LA-PLT-EN01]
---
One place in the app, identified by its address, showing a view of one loaded workspace.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Address | Where the page is, to bookmark, share or reload. | Path, with the view as a query parameter. | /TL-LEND-DR05?view=wiki,graph |
| Page kind | What sort of place it is. | Diagram, products, product, domain, record, group, checks or format. | record |
| Focus | The product, domain or record the page is about. | Record reference, or none. | TL-LEND-DR05 |
| Group kind | On a group page, the kind of the focus's children shown. | Kind, or none. | None |
| View | How the focus is shown; it never changes the path. | `wiki`, `graph` or `split`. | split |
