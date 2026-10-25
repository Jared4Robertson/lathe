---
id: LA-EXP-T14
kind: test
title: The Links switch adds the records the focused record links to and from, one hop, in focus, with their links
parent: LA-EXP
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-EXP-UC03-R01, LA-EXP-DR49]
---
Turns Links on at a requirement and expects what satisfies, fulfills and proves it, one step away and reached from it, with their links and no ring of their own; none with Links off; only the focus's own links at depth 3; and the same result on every call.
