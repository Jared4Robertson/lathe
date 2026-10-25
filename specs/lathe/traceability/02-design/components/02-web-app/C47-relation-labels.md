---
id: LA-TRC-C47
kind: component
title: Relation labels
parent: LA-TRC-LAY06
component_type: module
file: app/src/specs/labels.ts
links:
  satisfies: [LA-TRC-UC14-R05, LA-EXP-V03-R07]
---
`linkLabel` names one link by its relation rule's `forward_label` or `reverse_label`, matched by the link's source and target kinds; `relationLabelOf` names a relation by its code alone, for legends; `groupByLabel` groups a record's links by those words. The record facts and side bar, the graph's edges, legend and connections, and the Model view's line titles all read them here.
