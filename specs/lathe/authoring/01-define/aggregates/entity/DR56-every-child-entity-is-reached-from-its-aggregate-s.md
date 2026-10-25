---
id: LA-AUT-DR56
kind: domain_rule
title: Every child entity is reached from its aggregate's root
parent: LA-AUT-EN08
---
Each child entity SHOULD be reached from its aggregate's root by `has_one` or `has_many` links inside the aggregate, directly or through other children. `refers_to` links do not reach it.
