---
id: LA-EXP-C59
kind: component
title: Domain events in the graph
parent: LA-EXP-LAY03
component_type: react component
file: app/src/graph/GraphPage.tsx
links:
  satisfies: [LA-EXP-UC04-R07, LA-EXP-DR52]
  depends_on: [LA-EXP-C05]
---
The graph draws a domain event as a pill in the spark colors, and its `reacts_to` and `raised_by` links in their own line style (`relationStyle` gives them `event`): dashed in spark, with the Links switch on too, labeled with the relations' labels. The events reach their aggregate's "Domain events" group through the graph's tree, by the one-kind rule.
