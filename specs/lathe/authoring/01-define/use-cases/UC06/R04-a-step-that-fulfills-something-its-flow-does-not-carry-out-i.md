---
id: LA-AUT-UC06-R04
kind: requirement
title: A step fulfilling something its flow does not carry out is a warning
parent: LA-AUT-UC06
---
A step that `fulfills` a record that is not a requirement of a use case its flow `carries_out`, a domain rule one of those use cases `applies`, or an interaction requirement that fulfills one of those or sits under the flow, MUST be reported as a `flow-step-fulfills-outside-flow` warning naming the target and the use cases compared.
