---
id: LA-BRW-EN01
kind: entity
title: Page
parent: LA-BRW-A1
role: root
links:
  has_many: [LA-BRW-EN02]
  refers_to: [LA-MOD-EN04, LA-CHK-EN06]
---
One place in the app, identified by its address, showing a view of one loaded workspace.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Address | Where the page is, to bookmark, share or reload. | Path, with the view as a query parameter. | /TL-LEND-DR05?view=wiki,graph |
| Page kind | What sort of place it is. | Products, product, domain, record, group, checks or format. | record |
| Focus | The product, domain or record the page is about. | Record reference, or none. | TL-LEND-DR05 |
| Group kind | On a group page, the kind of the focus's children shown. | Kind, or none. | None |
| View | How the focus is shown; it never changes the path. | `wiki`, `graph` or `split`. | split |
