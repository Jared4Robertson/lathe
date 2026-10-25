---
id: LA-PLT-UC08-R11
kind: requirement
title: Moving around answers within the performance budgets
parent: LA-PLT-UC08
---
Opening a record page, switching views and re-centering the graph MUST answer within the app's performance budgets (`LA-PAT-APP-UX-R11`): the page is interactive within 1.5 s, a view switch takes under 100 ms of main-thread work, and a re-center at depth 3 glides at 60 Hz, with at most 3 frames over 20 ms and none of 100 ms or more, so the shared motion keeps gliding while the new picture arrives.
