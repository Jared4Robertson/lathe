---
id: LA-BRW-C33
kind: component
title: Record content
parent: LA-BRW
component_type: react component
file: app/src/specs/RecordContent.tsx
links:
  implements: [LA-BRW-V04]
  satisfies: [LA-BRW-UC30-R04, LA-BRW-UC30-R05, LA-BRW-UC30-R06]
  depends_on: [LA-BRW-C07, LA-BRW-C32, LA-BRW-C34]
---
`RecordContent` takes the index, a record ID, an optional `onNavigate` and optional header actions, and shows the record: header, body, problems, fields, parent, children and links both ways. A test shows its state, with a note when it is planned; an interaction requirement shows where it sits and what it fulfills. It is a CSS container, so its two columns fold into one below about 760 pixels of its own width, as at half the screen beside the graph.
