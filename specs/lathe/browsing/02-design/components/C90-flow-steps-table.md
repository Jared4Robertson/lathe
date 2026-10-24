---
id: LA-BRW-C90
kind: component
title: Flow steps table
parent: LA-BRW
component_type: react component
file: app/src/specs/FlowSteps.tsx
links:
  satisfies: [LA-BRW-UC80-R01, LA-BRW-UC80-R02, LA-BRW-UC80-R03, LA-BRW-DR90, LA-BRW-DR91]
  implements: [LA-BRW-V04]
  depends_on: [LA-BRW-C32, LA-BRW-C07]
---
`FlowSteps` takes the index and a flow and, when the flow has steps, shows them as a table in order (`stepsOf`: by order as a number, then ID, invalid orders last). Each row has a disclosure that unfolds the step's body and the titles and kinds of what it uses and fulfills; the table has Expand all. `RecordContent` shows it on a flow's page.
