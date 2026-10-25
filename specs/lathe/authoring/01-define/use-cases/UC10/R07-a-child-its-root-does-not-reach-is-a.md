---
id: LA-AUT-UC10-R07
kind: requirement
title: A child its root does not reach is a warning
parent: LA-AUT-UC10
---
A child entity that no `has_one` or `has_many` reaches from its aggregate's root, directly or through other children, MUST be an `entity-unreferenced` warning. An aggregate without exactly one root MUST NOT have its children judged.
