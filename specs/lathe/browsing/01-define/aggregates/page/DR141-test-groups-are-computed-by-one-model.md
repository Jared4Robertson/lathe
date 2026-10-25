---
id: LA-BRW-DR141
kind: domain_rule
title: Test groups are computed by one model, never stored
parent: LA-BRW-A1
---
A test's group MUST be computed from its `proves` links each time the specs load, never stored in a record, and the side nav, the pages and the graph MUST take it from the same folder model, so they never disagree.
