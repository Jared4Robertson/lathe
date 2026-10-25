---
id: LA-TRC-UC04-R01
kind: requirement
title: A pattern rule is an obligation under a pattern
parent: LA-TRC-UC04
---
A `pattern_rule` record MUST sit under a `pattern` and MUST be an obligation, proved by a test that `proves` it; by default it needs proof only (LA-TRC-UC07-R06), and a component MAY `satisfy` it. It MAY name, in a `setting` field, the one pattern setting it depends on.
