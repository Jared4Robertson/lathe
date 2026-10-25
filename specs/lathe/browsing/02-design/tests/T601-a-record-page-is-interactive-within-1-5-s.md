---
id: LA-BRW-T601
kind: test
title: "Performance: a record page is interactive within 1.5 s"
parent: LA-BRW
test_type: acceptance
run_by: app/perf/app.perf.ts
links:
  proves: [LA-BRW-UC117-R11, LA-PAT-APP-UX-R30]
---
Opens a record page three times on a warm server and expects the median time from navigation until its title is drawn and the long frames after it have ended to be under 1.5 s.
