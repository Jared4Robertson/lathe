---
id: LA-TRC-C33
kind: component
title: Proof counts nowhere check
parent: LA-TRC-LAY04
component_type: sql check
file: lathe/checks/54-proof-counts-nowhere.sql
links:
  satisfies: [LA-TRC-UC08-R02, LA-TRC-DR26, LA-CHK-DR13]
---
The `proof-counts-nowhere` warning: each test's proof links to existing records, each judged as counting or not by the domains that owe it, with a reason for each target that does not count. A test is reported when none counts.
