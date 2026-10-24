---
id: LA-CHK-C40
kind: component
title: Capability order check
parent: LA-CHK
component_type: sql check
file: lathe/checks/28-capability-order.sql
links:
  satisfies: [LA-CHK-UC10-R03, LA-CHK-DR40]
---
The `capability-order` check: a capability whose `order` is not a whole number, and each capability whose order equals another's in the same domain, compared as numbers.
