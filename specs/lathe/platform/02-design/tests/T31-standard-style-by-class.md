---
id: LA-PLT-T31
kind: test
title: "Styles are set by class: no selector names only elements, beyond the base styles"
parent: LA-PLT
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R02]
---
Reads every style rule in `app/src/styles.css` (not keyframe steps) and expects each selector to name a class, attribute or ID, unless it names only base elements.
