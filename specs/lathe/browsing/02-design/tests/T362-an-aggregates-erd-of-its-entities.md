---
id: LA-BRW-T362
kind: test
title: "An aggregate's ERD shows each entity's title, root mark and fields with their kind of value, crow's-foot ends by cardinality, and entities from elsewhere labeled with their owner"
parent: LA-BRW
test_type: component
run_by: app/test/model.test.tsx
links:
  proves: [LA-BRW-UC113-R03, LA-BRW-DR171]
---
Builds an aggregate's ERD and expects the root's fields with their kinds, an entity of another aggregate labeled with it, one of another domain gray and labeled with its domain and aggregate, one-one, one-many and many-one ends, and lines from box edge to box edge; then draws it and expects the root mark, the fields list and the ends.
