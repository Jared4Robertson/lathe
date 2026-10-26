---
id: LA-EXP-C25
kind: component
title: Flow steps table
parent: LA-EXP-LAY06
component_type: react component
file: app/src/specs/FlowSteps.tsx
links:
  satisfies: [LA-EXP-UC06-R01, LA-EXP-UC06-R02, LA-EXP-UC06-R03, LA-EXP-UC06-R06, LA-EXP-F03-R01, LA-EXP-F03-R02, LA-EXP-UC06-R07]
  implements: [LA-EXP-V03]
  depends_on: [LA-TRC-C38, LA-EXP-C02]
---
`FlowSteps` takes the index and a flow and, when the flow has steps, shows them as a table in order (`stepsOf`: by order as a number, then ID, invalid orders last), or a table per path when they sit on several (`pathsOf`: main first, then by name). Each row has a disclosure that unfolds the step's body and the titles and kinds of what it uses and carries out; the table has Expand all. A technical flow's steps read the same way, with the columns Component and Satisfies, and their transaction, locks and statements folded under each row. `RecordContent` shows it on a flow's and a technical flow's page.
