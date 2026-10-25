---
id: LA-CHK-UC04-R02
kind: requirement
title: A use case no flow carries out is a warning once its domain has flows
parent: LA-CHK-UC04
---
A use case that no flow links to with `carries_out` MUST be reported as a `use-case-without-flow` warning, but only when the use case's domain has at least one flow. A flow that only `fulfills` the use case's requirements does not carry it out.
