---
id: LA-AUT-UC11-R04
kind: requirement
title: An aggregate without exactly one root is an error
parent: LA-AUT-UC11
---
An aggregate with entities but no root, or with more than one, MUST be an `aggregate-root` error that names the roots it has and says how to fix it.
