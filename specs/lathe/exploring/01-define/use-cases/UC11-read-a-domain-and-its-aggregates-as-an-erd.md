---
id: LA-EXP-UC11
kind: use_case
title: Read a domain and its aggregates as an ERD
parent: LA-EXP-CAP01
actor: Reader
links:
  applies: [LA-EXP-DR37, LA-EXP-DR38, LA-EXP-DR10, LA-EXP-DR48, LA-EXP-DR51, LA-EXP-DR52]
---
The reader opens the Model view on a domain and reads its domain model as an entity-relationship diagram: its aggregates and how their entities refer to each other. On an aggregate they read its entities with their fields and relationships, and on an entity the same diagram with that entity picked out. They also read cause and effect: the domain events each aggregate raises, the entity raising each, and the aggregates that react to them. They click a box to go to it, and read the key under the diagram for the colors, the line ends and the events.
