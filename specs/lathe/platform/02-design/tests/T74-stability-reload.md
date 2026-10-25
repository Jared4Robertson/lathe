---
id: LA-PLT-T74
kind: test
title: "Stability: a live reload keeps what is in view"
parent: LA-PLT
test_type: acceptance
run_by: app/stability/reload.spec.ts
links:
  proves: [LA-PLT-UC08-R07, LA-PAT-APP-UX-R08]
---
Edits a spec file in the suite's copy of the specs while the domain page is scrolled half-way (a paragraph above the view) and while the graph is open, and expects what was at the top of the view to stay there and the graph not to be drawn anew.
