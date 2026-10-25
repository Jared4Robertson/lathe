---
id: LA-PLT-T89
kind: test
title: "Performance: a record page is interactive within 1.5 s"
parent: LA-PLT
test_type: acceptance
run_by: app/perf/app.perf.ts
links:
  proves: [LA-PLT-UC08-R11, LA-PAT-APP-UX-R11]
---
Opens a record page three times on a warm server and expects the median time from navigation until its title is drawn and the long frames after it have ended to be under 1.5 s.
