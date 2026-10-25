---
id: LA-CHK-UC11-R01
kind: requirement
title: A pattern rule is an obligation under a pattern
parent: LA-CHK-UC11
---
A `pattern_rule` record MUST sit under a `pattern` and MUST be an obligation, proved by a test that `proves` it; by default it needs proof only (LA-CHK-UC19-R06), and a component MAY `satisfy` it. It MAY name, in a `setting` field, the one pattern setting it depends on.
