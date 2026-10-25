---
id: LA-BRW-T604
kind: test
title: "Performance: opening the Model pane takes under 100 ms of main-thread work"
parent: LA-BRW
test_type: acceptance
run_by: app/perf/app.perf.ts
links:
  proves: [LA-BRW-UC117-R11, LA-PAT-APP-UX-R30]
---
On an aggregate, opens the Model pane once (loading its code and ELK, measured without a budget), closes it, opens it again and expects that switch to take under 100 ms of main-thread work; measures how long a domain's ERD takes to be drawn after its page.
