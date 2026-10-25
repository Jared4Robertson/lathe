---
id: LA-PLT-T87
kind: test
title: "Stability: switching the side bar's view and hovering graph nodes moves nothing outside the side bar"
parent: LA-PLT
test_type: acceptance
run_by: app/stability/side-bar.spec.ts
links:
  proves: [LA-EXP-UC12-R06, LA-PAT-APP-UX-R08]
---
On a record with the wiki and the graph open, switches the side bar to Outline, History and Details, then hovers three nodes and leaves, and expects no unexpected layout shift and the nav, the pane bars and titles, the graph's header and canvas, the side bar and its switcher to keep their boxes.
