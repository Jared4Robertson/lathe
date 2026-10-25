---
id: LA-BRW-T498
kind: test
title: Sub-layers nest in Technical specification, and a domain rule under an entity sits under it
parent: LA-BRW
test_type: acceptance
run_by: app/test/traceability.test.tsx
links:
  proves: [LA-BRW-UC110-R08]
---
Adds a sub-layer with a component inside a layer, and expects the layer's group to hold the sub-layer's group and the component's branch to open through both layers; adds a domain rule under an entity, and expects the aggregate's page to list the entity with the rule folded under it and the rule's branch to open to the domain model.
