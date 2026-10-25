---
id: LA-AUT-UC11-R03
kind: requirement
title: A role other than root or child is an error
parent: LA-AUT-UC11
---
An entity whose `role` is not root or child MUST be an `entity-role` error that says to set one of them. A missing role MUST be reported only as `missing-required-field`.
