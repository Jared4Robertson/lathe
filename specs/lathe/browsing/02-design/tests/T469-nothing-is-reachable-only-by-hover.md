---
id: LA-BRW-T469
kind: test
title: Nothing is reachable only by hover
parent: LA-BRW
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R16]
---
Reads the stylesheet and expects every control a hover reveals to be shown always on a coarse pointer, and the tooltip to open on keyboard focus as well as hover.
