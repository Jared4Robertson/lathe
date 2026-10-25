---
id: LA-AUT-UC10-R06
kind: requirement
title: A part outside its aggregate is an error
parent: LA-AUT-UC10
---
A `has_one` or `has_many` to an entity in another aggregate MUST be a `has-crosses-aggregate` error that says to use `refers_to` or move the part. A `refers_to` across aggregates or domains MUST NOT be reported.
