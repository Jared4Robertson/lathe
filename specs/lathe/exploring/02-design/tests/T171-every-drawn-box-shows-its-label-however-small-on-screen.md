---
id: LA-EXP-T171
kind: test
title: "Every drawn box shows its label, however small on screen, and is a keyboard stop; the summary counts the framed picture"
parent: LA-EXP
test_type: component
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-EXP-DR60, LA-EXP-DR46]
---
Opens a domain's graph at depth 3 with sixty requirements a few pixels tall and expects every drawn box to show its kind and ID line and its title, with an accessible name and not hidden from assistive technology, no plain box; the keyboard order over every drawn box, column by column; and the summary counting the framed picture.
