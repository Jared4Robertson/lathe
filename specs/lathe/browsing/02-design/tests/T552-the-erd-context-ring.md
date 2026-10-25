---
id: LA-BRW-T552
kind: test
title: "An aggregate's ERD shows what its referenced entities refer to one ring out; a domain's ERD fades other domains' aggregates"
parent: LA-BRW
test_type: unit
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-BRW-UC113-R06]
---
Expects the Loan ERD's own and referenced entities in focus, Member's Account as context with its line, nothing further, and the domain ERD's other-domain aggregate faded.
