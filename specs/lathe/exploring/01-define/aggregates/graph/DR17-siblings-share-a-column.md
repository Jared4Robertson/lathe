---
id: LA-EXP-DR17
kind: domain_rule
title: Siblings share a column
parent: LA-EXP-A4
---
In the graph, every record or group with the same parent MUST sit in the same column, whatever its kind, so no sibling is further left or further right than another. A column is a depth in the parent/child tree around the focus; within a column, siblings MUST stay together, ordered by their parent's place, then by kind, then by ID.
