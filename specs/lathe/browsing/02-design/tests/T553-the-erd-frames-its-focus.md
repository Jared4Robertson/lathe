---
id: LA-BRW-T553
kind: test
title: "The ERD frames its boxes in focus only, and its context boxes are out of focus"
parent: LA-BRW
test_type: component
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-BRW-UC113-R06, LA-BRW-DR303]
---
Expects the framed boxes to leave out the ring, and on the page the ring box faded and aria-hidden, its line faded, and the key explaining it.
