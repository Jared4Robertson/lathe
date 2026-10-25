---
id: LA-AUT-UC07-R02
kind: requirement
title: A step order that is not a whole number is an error
parent: LA-AUT-UC07
---
A flow step whose `order` is not a whole number MUST be reported as a `flow-step-order` error on that step, quoting the order. A step with no order MUST be reported only as `missing-required-field`.
