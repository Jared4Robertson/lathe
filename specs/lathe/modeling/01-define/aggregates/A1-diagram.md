---
id: LA-MOD-A1
kind: aggregate
title: Diagram
parent: LA-MOD
links:
  relates_to: [LA-MOD-A2]
---
A named canvas of terms and the links between them, stored as `model/<slug>/terms.csv` and `model/<slug>/links.csv` and registered by one row in `model/diagrams.csv`.

A term has a name, a kind (aggregate, entity, value object, domain event, term, topic), a context, a status (decided, draft, open) and a definition. A link has a source, relation, target, cardinality, status and note. The whole diagram is checked as one unit by `lathe/diagrams/checks.sql`.

A diagram is for brainstorming before a domain is specified, which is why its terms and links carry a status. It is never turned into records or merged with them; a specified domain is drawn from its records instead.
