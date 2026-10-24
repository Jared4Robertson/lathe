---
id: LA-CHK-DR113
kind: domain_rule
title: A step check compares only what it can judge
parent: LA-CHK-A3
---
A flow step check MUST report only the mistake it is for: a missing order is left to `missing-required-field`, a target that does not exist to `dangling-link`, and the steps of a flow that carries out no use case are not compared with it.
