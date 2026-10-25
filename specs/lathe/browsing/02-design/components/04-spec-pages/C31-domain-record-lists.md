---
id: LA-BRW-C31
kind: component
title: Domain page record lists
parent: LA-BRW-LAY04
component_type: react component
file: app/src/specs/SpecPages.tsx
links:
  implements: [LA-BRW-V03]
  satisfies: [LA-BRW-UC30-R03, LA-BRW-UC30-R04]
  depends_on: [LA-BRW-C30, LA-BRW-C32, LA-BRW-C33, LA-BRW-C34]
---
The domain page's lists, where each design group (flows, views, endpoints) nests its interaction requirements and the records of any other obligation kind under each record, as the define groups nest rules and requirements. Each test row carries its state tag, and a planned test's row is dimmed. The record page here is only chrome around the record content.
