---
id: LA-AUT-DR02
kind: domain_rule
title: A record ID matches the ID pattern
parent: LA-AUT-EN01
---
A record's ID MUST match `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$`. The convention for each kind in `lathe/meta/ids.csv`, shown in the format reference (product prefix, domain code, then kind code and number), SHOULD be followed, but only the pattern is checked.
