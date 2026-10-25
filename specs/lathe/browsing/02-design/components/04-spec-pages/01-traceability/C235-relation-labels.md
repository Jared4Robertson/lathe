---
id: LA-BRW-C235
kind: component
title: Relation labels
parent: LA-BRW-LAY11
component_type: module
file: app/src/specs/labels.ts
links:
  satisfies: [LA-BRW-UC118-R05, LA-BRW-DR243]
---
`linkLabel` names one link by its relation rule's `forward_label` or `reverse_label`, matched by the link's source and target kinds; `relationLabelOf` names a relation by its code alone, for legends; `groupByLabel` groups a record's links by those words. The record facts and inspector, the graph's edges, legend and connections, and the Model view's line titles all read them here.
