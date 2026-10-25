---
id: LA-CHK-C141
kind: component
title: Proof counts nowhere check
parent: LA-CHK
component_type: sql check
file: lathe/checks/54-proof-counts-nowhere.sql
links:
  satisfies: [LA-CHK-UC20-R02, LA-CHK-DR142, LA-CHK-DR144]
---
The `proof-counts-nowhere` warning: each test's proof links to existing records, each judged as counting or not by the domains that owe it, with a reason for each target that does not count. A test is reported when none counts.
