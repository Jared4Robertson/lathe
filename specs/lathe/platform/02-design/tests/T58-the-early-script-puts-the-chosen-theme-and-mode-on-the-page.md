---
id: LA-PLT-T58
kind: test
title: The early script puts the chosen theme and mode on the page before the app runs
parent: LA-PLT
test_type: unit
run_by: app/test/themes.test.tsx
links:
  proves: [LA-PLT-UC07-R07]
  covers: [LA-PLT-C27]
---
Runs the inline script from index.html with a stored stylesheet, theme and mode and expects them on the page, and with nothing stored expects the stylesheet's own Lathe theme following the system.
