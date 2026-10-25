---
id: LA-PLT-T80
kind: test
title: "Stability: switching theme moves nothing"
parent: LA-PLT
test_type: acceptance
run_by: app/stability/theme-and-mobile.spec.ts
links:
  proves: [LA-PLT-UC09-R09, LA-PAT-APP-UX-R08]
---
Switches from the default theme to Midnight through the Color theme pick (g t) on a record page with the graph open, and expects no layout shift at all and no key element to move.
