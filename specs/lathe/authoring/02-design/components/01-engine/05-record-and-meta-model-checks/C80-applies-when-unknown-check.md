---
id: LA-AUT-C80
kind: component
title: Applies when unknown check
parent: LA-AUT-LAY06
component_type: sql check
file: lathe/checks/36-applies-when-unknown.sql
links:
  satisfies: [LA-AUT-UC05-R09]
---
The `applies-when-unknown` check: reports as an error each pattern rule whose `applies_when` is not written `<setting> is <value>` or `<setting> is not <value>`, or names a setting its parent pattern does not list.
