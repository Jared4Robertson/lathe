---
id: LA-EXP-T147
kind: test
title: Filters have a Minimap switch, off by default and kept while walking, and the minimap is an overview of the whole map
parent: LA-EXP
test_type: component
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-EXP-UC03-R15]
---
Opens Filters and expects a Minimap switch, off, no context ring switch, and the trace preset worded with the relations' labels; switches the minimap on and expects an overview of the map's upper levels, the focus solid and the view outlined, still there after walking on.
