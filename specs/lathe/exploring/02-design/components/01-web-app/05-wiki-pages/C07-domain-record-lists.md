---
id: LA-EXP-C07
kind: component
title: Domain page record lists
parent: LA-EXP-LAY06
component_type: react component
file: app/src/specs/SpecPages.tsx
links:
  implements: [LA-EXP-V02]
  satisfies: [LA-TRC-UC11-R03, LA-TRC-UC11-R04]
  depends_on: [LA-TRC-C37, LA-TRC-C38, LA-EXP-C08, LA-EXP-C09]
---
The domain page's lists, where each design group (flows, views, endpoints) nests its interaction requirements and the records of any other obligation kind under each record, as the define groups nest rules and requirements. Each test row carries its state tag, and a planned test's row is dimmed. The record page here is only chrome around the record content.
