---
id: LA-MOD-DR04
kind: domain_rule
title: A part belongs to at most one aggregate
parent: LA-MOD-A1
---
A term that an aggregate `contains` MUST NOT be contained by any other aggregate, so that links to it are never ambiguous. Only aggregates contain things, and they contain only entities and value objects.
