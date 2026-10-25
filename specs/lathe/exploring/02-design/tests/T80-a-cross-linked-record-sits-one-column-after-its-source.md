---
id: LA-EXP-T80
kind: test
title: A cross-linked record sits one column after its source
parent: LA-EXP
test_type: unit
run_by: app/test/graph/columns.test.ts
links:
  proves: [LA-EXP-DR17, LA-EXP-UC03-R08]
---
With parent lines hidden expects a view one column after the requirement it fulfills and an endpoint one after the view; expects a test one column after the requirement it proves, unless the domain is shown, when it sits beside the use case as the domain's child.
