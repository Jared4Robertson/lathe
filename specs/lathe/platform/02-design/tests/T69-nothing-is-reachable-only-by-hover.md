---
id: LA-PLT-T69
kind: test
title: Nothing is reachable only by hover
parent: LA-PLT
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-UX-R07]
---
Reads the stylesheet and expects every control a hover reveals to be shown always on a coarse pointer, and the tooltip to open on keyboard focus as well as hover.
