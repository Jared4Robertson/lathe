---
id: LA-EXP-T170
kind: test
title: "Only boxes in view and big enough are drawn, each with its label, with bars for the rest, within a budget"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/map.test.ts
links:
  proves: [LA-EXP-DR60, LA-PAT-APP-UX-R11]
---
Frames a domain and expects only boxes in view and at least 3 pixels tall, each drawn as its ID alone (its label always drawn); far out, no box too small and a bar for each run of tiny children inside its parent's span; a forced box drawn whatever its size; the same view drawing the same; and a synthetic product of more than 3,000 nodes within the budget at every zoom.
