---
id: LA-CHK-UC22-R03
kind: requirement
title: A component outside its domain's layers is a warning
parent: LA-CHK-UC22
---
A component that sits directly under a domain that has at least one layer MUST be a `component-outside-layer` warning naming the component and the domain. A component in a domain with no layers, and a component in a layer, MUST NOT be reported.
