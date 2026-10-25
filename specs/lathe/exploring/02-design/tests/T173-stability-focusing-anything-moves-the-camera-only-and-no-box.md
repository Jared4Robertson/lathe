---
id: LA-EXP-T173
kind: test
title: "Stability: focusing anything moves the camera only, and no box changes its place or size"
parent: LA-EXP
test_type: acceptance
run_by: app/stability/graph.spec.ts
links:
  proves: [LA-EXP-UC03-R09, LA-EXP-DR57, LA-EXP-DR59, LA-PAT-APP-UX-R08]
---
Focuses a domain, a stage, a folder, a capability and a use case by clicking, then goes Back twice and Forward once, and expects each step stable, the camera different at each, and every box seen to keep the same place and size in the map throughout.
