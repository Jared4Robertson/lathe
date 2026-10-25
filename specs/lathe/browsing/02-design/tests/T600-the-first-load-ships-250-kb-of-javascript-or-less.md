---
id: LA-BRW-T600
kind: test
title: "Performance: the first load ships 250 KB of JavaScript or less"
parent: LA-BRW
test_type: acceptance
run_by: app/perf/app.perf.ts
links:
  proves: [LA-PAT-APP-UX-R30]
---
Builds the app for production and expects the JavaScript that `index.html` loads at once (its scripts and module preloads) to be 250 KB or less gzipped; prints the largest chunks.
