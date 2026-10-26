---
id: LA-PLT-T93
kind: test
title: "Performance: a graph re-center at depth 3 takes under 500 ms of main-thread work and glides at 60 Hz"
parent: LA-PLT
test_type: acceptance
run_by: app/perf/app.perf.ts
links:
  proves: [LA-PLT-UC09-R11, LA-PAT-APP-UX-R11]
---
In the Tree layout at depth 3 and in the Nested layout (which has no depth), re-centers three times on boxes in view, and expects each re-center, from the click until the glide has ended, to take under 500 ms of main-thread work, at most 3 of its frames to take more than 20 ms and none 100 ms or more; prints each re-center's work, its longest frame and how many frames took over 20 ms.
