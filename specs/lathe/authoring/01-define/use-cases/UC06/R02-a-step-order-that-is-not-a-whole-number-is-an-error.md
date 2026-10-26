---
id: LA-AUT-UC06-R02
kind: requirement
title: A step order that is not a whole number is an error
parent: LA-AUT-UC06
---
A flow step whose `order` is not a whole number MUST be reported as a `step-order` error on that step, quoting the order. A step with no order MUST be reported only as `missing-required-field`.
