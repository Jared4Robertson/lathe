---
id: LA-AUT-UC17
kind: use_case
title: Write how the system carries out a flow, as a technical flow
parent: LA-AUT-CAP03
actor: Owner, Agent
links:
  applies: [LA-AUT-DR78, LA-AUT-DR79, LA-AUT-DR80]
---
The owner, or an agent, writes how the system carries out a flow as a technical flow, as a real product's technical specification does: ordered steps, each naming the component that does it, the transaction and locks it takes, and the obligations it designs. A step's `satisfies` counts as design, so an obligation designed in a step is not reported unsatisfied.
