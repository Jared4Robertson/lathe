---
id: LA-PLT-T71
kind: test
title: "Stability: the first load of the product, domain and record pages shifts nothing, also with slow fonts"
parent: LA-PLT
test_type: acceptance
run_by: app/stability/first-load.spec.ts
links:
  proves: [LA-PLT-UC09-R01, LA-PLT-DR18, LA-PAT-APP-UX-R08]
---
Loads each page with the probes installed before its scripts, and once with the app's font files held back 2.5 seconds, and expects no unexpected shift and the nav, the page, the first pane's bar and title and the side bar never to move.
