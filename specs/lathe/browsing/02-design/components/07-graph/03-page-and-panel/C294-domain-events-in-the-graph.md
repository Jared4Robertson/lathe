---
id: LA-BRW-C294
kind: component
title: Domain events in the graph
parent: LA-BRW-LAY14
component_type: react component
file: app/src/graph/GraphPage.tsx
links:
  satisfies: [LA-BRW-UC40-R07, LA-BRW-DR307]
  depends_on: [LA-BRW-C22]
---
The graph draws a domain event as a pill in the spark colors, and its `reacts_to` and `raised_by` links in their own line style (`relationStyle` gives them `event`): dashed in spark, with the Links switch on too, labeled with the relations' labels. The events reach their aggregate's "Domain events" group through the graph's tree, by the one-kind rule.
