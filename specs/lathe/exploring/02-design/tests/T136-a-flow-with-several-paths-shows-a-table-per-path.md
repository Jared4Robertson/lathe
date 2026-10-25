---
id: LA-EXP-T136
kind: test
title: A flow with several paths shows a table per path, the main path first
parent: LA-EXP
test_type: acceptance
run_by: app/test/traceability.test.tsx
links:
  proves: [LA-EXP-UC06-R06]
---
Gives a flow steps on the main path (no path), an api path and a refused path written in mixed case, and expects three tables headed Main path, Api path and Refused path, each in its own step order.
