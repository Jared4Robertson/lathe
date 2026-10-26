---
id: LA-AUT-C71
kind: component
title: Technical flow relations
parent: LA-AUT-LAY02
component_type: meta-model
file: lathe/meta/relations.csv
links:
  satisfies: [LA-AUT-UC17-R01, LA-AUT-UC17-R03, LA-AUT-UC17-R04, LA-AUT-DR79]
---
In `relations.csv`: `deepens` from a technical flow to a flow, `uses` from a technical step to a component, and `satisfies` from a technical step to a requirement, domain rule, interaction requirement or pattern rule, with the `design` role, so coverage and `unsatisfied` count it as design without asking more of either.
