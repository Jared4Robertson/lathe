---
id: LA-EXP-T171
kind: test
title: A box too small on screen for its text is drawn plain and out of focus, and the summary counts the framed picture
parent: LA-EXP
test_type: component
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-EXP-DR60, LA-EXP-DR46]
---
Opens a domain's graph at depth 3 and expects a plain box with no text, hidden from assistive technology, not a Tab stop and named in its tooltip; the keyboard order over labeled boxes only, column by column; and the summary counting the framed picture.
