---
id: LA-CHK-DR186
kind: domain_rule
title: Every child entity is reached from its aggregate's root
parent: LA-CHK-A11
---
Each child entity SHOULD be reached from its aggregate's root by `has_one` or `has_many` links inside the aggregate, directly or through other children. `refers_to` links do not reach it.
