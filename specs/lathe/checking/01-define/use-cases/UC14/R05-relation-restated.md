---
id: LA-CHK-UC14-R05
kind: requirement
title: An extension row for an existing relation rule is the same rule
parent: LA-CHK-UC14
---
A relation row in a product's extension with the same `relation`, `source_kind` and `target_kind` as a row Lathe already has MUST be merged into that rule, not added beside it. Its non-empty `role` or `description` MUST replace the default's, and an empty one MUST keep the default's.
