---
id: LA-AUT-T71
kind: test
title: An entity sits under an aggregate, needs a role, and links by has_one, has_many and refers_to
parent: LA-AUT
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-AUT-UC11-R01]
---
Expects the `entity` kind's stage, folder, parent kinds and required `role`, and the three relations from entity to entity, loaded from the meta-model.
