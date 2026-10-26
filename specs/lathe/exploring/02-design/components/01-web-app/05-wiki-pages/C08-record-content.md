---
id: LA-EXP-C08
kind: component
title: Record content
parent: LA-EXP-LAY06
component_type: react component
file: app/src/specs/RecordContent.tsx
links:
  implements: [LA-EXP-V03]
  satisfies: [LA-TRC-UC11-R04, LA-TRC-UC11-R05, LA-TRC-UC11-R06, LA-EXP-UC05-R14]
  depends_on: [LA-EXP-C02, LA-TRC-C38, LA-EXP-C09]
---
`RecordContent` takes the index, a record ID, an optional `onNavigate` and optional header actions, and shows the record: header, body, problems, fields, parent, children (under their groups, when they name one) and links both ways. A test shows its state, with a note when it is planned; an interaction requirement shows where it sits and what it fulfills. It is a CSS container, so its two columns fold into one below about 760 pixels of its own width, as at half the screen beside the graph.
