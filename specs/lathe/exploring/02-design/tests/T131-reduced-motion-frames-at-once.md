---
id: LA-EXP-T131
kind: test
title: Under reduced motion focusing frames the new focus at once
parent: LA-EXP
test_type: component
run_by: app/test/graph/camera.test.tsx
links:
  proves: [LA-EXP-UC03-R09, LA-EXP-DR31, LA-EXP-DR59]
---
Asks for reduced motion, clicks a requirement in its use case's graph and expects one camera move, straight to the framed view.
