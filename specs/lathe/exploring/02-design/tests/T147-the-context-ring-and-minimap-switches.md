---
id: LA-EXP-T147
kind: test
title: Filters have a Show context ring switch, on by default, and a Minimap switch, off by default, both kept while walking
parent: LA-EXP
test_type: component
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-EXP-UC03-R01, LA-EXP-UC03-R15]
---
Opens Filters, expects the two switches and the trace preset worded with relation labels, switches the ring off (no context nodes, the summary without faded ones) and the minimap on, then walks on and expects both kept.
