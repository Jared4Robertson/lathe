---
id: LA-EXP-C70
kind: component
title: Groups of requirements and rules
parent: LA-EXP-LAY07
component_type: module
file: app/src/specs/groups.ts
links:
  satisfies: [LA-EXP-UC05-R14, LA-AUT-UC13-R06]
---
Pure logic: sorts records into their `group`, the ungrouped ones first, then each group in the order it first appears, compared trimmed and in any letter case and headed as first written. The `Grouped` part in parts.tsx draws each group as a part of the page under its heading, which the Outline then lists.
