---
id: LA-TRC-C38
kind: component
title: Shared spec parts and the test state tag
parent: LA-TRC-LAY06
component_type: module
file: app/src/specs/parts.tsx
links:
  satisfies: [LA-TRC-UC11-R04, LA-TRC-UC11-R06, LA-TRC-DR33]
  depends_on: [LA-PLT-C07, LA-EXP-C09]
---
The pieces every spec page shares: record links, problem lists, sections and headers. `SpecLink` sends a plain click to the host's `onNavigate` when one is given (through a React context) and to the app's router otherwise. `testState` reads a test's state (automated when absent) and `TestStateTag` shows it, dashed and italic for a planned test, with a title saying whether it counts as proof.
