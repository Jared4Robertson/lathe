---
id: LA-MOD-DR07
kind: domain_rule
title: A record ID matches the ID pattern
parent: LA-MOD-A2
---
A record's ID MUST match `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$`. The convention in `lathe/FORMAT.md` (product prefix, domain code, then kind code and number) SHOULD be followed, but only the pattern is checked.
