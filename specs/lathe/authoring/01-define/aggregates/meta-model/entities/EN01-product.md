---
id: LA-AUT-EN01
kind: entity
title: Product
parent: LA-AUT-A1
role: root
links:
  has_many: [LA-AUT-EN03]
  has_one: [LA-AUT-EN02]
---
A product: the root of a set of specifications, with the roles its use cases name. Every record under it shares one shape, described here once: an ID, a kind, a title, a parent (none only for the product), its other header fields, its links to other records by relation, and a Markdown body whose cited IDs are its mentions.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The product's prefix, and the start of every ID under it. | Text in the ID format. | TL |
| Title | The product's name. | Text. | Tool Library |
| Actors | The roles its use cases name, separated by spaces. | List of role names. | Member Librarian |
| Icon and color | How the app's space rail shows it. | An icon name and a color, or none. | wrench, teal |
| Records | Every record under it, each with an ID, kind, title, parent, header fields, links and body. | Derived list of records. | TL-LEND-UC01 |
| Mentions | For each record, the existing records its body cites by ID, in order. | Derived list of record references. | TL-LEND-DR05 |
