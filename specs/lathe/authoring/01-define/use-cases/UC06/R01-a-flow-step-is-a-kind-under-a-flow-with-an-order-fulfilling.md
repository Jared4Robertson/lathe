---
id: LA-AUT-UC06-R01
kind: requirement
title: A flow step sits under a flow, has an order and its own links
parent: LA-AUT-UC06
---
The meta-model MUST have a `flow_step` kind whose parent is a `flow` and which requires `order`, and MUST allow a step to `fulfills` a requirement, an interaction requirement or a domain rule, and to `uses` a view, an endpoint or a component.
