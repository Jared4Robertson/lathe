---
id: LA-PLT-T133
kind: test
title: Every box look, badge and line style the Graph view can draw is in its key
parent: LA-PLT
test_type: unit
run_by: app/test/marks-have-meaning.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R21]
---
Renders the Graph view's legend and expects an entry, with words beside it, for each box class the stylesheet styles on a graph node (except the text scaling, a layout), the bar, each badge, each line style a relation can take, and the cross-link.
