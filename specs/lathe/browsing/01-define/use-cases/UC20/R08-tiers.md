---
id: LA-BRW-UC20-R08
kind: requirement
title: The graph is laid out in tiers that follow the record hierarchy
parent: LA-BRW-UC20
---
The graph MUST be laid out left to right in tiers: product, then domain, then aggregates and use cases, then domain rules and requirements, then flows, views, endpoints and components, then tests. Ancestors MUST sit to the left of the focused record and children to its right, and every other record in the tier of its kind. Parent/child lines MUST be drawn as the solid spine of the tree and every other relation as a lighter, dashed cross-link. In trace mode the graph MUST also read left to right: the requirement or rule, what fulfills it, the components, the tests, then the files. Only when links within one tier form a cycle MAY the graph be drawn another way, and the page MUST then say so and name the cycle.
