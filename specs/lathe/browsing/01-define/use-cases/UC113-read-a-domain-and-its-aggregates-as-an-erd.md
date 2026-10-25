---
id: LA-BRW-UC113
kind: use_case
title: Read a domain and its aggregates as an ERD
parent: LA-BRW-CAP01
actor: Reader
links:
  applies: [LA-BRW-DR170, LA-BRW-DR171, LA-BRW-DR52, LA-BRW-DR302, LA-BRW-DR303, LA-BRW-DR306, LA-BRW-DR307]
---
The reader opens the Model view on a domain and reads its domain model as an entity-relationship diagram: its aggregates and how their entities refer to each other. On an aggregate they read its entities with their fields and relationships, and on an entity the same diagram with that entity picked out. They also read cause and effect: the domain events each aggregate raises, the entity raising each, and the aggregates that react to them. They click a box to go to it, and read the key under the diagram for the colors, the line ends and the events.
