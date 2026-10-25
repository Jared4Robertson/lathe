---
id: LA-CHK-C72
kind: component
title: Unknown ID in prose check
parent: LA-CHK-LAY04
component_type: sql check
file: lathe/checks/41-unknown-id-in-prose.sql
links:
  satisfies: [LA-CHK-UC13-R04, LA-CHK-DR72]
---
The `unknown-id-in-prose` check: one warning for each row of `prose_mentions` whose cited ID no record has.
