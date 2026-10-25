---
id: LA-EXP-UC11-R02
kind: requirement
title: A domain's ERD draws its aggregates and how their entities refer to each other
parent: LA-EXP-UC11
---
On a domain the Model view MUST draw one box per aggregate, with its title, its root entity's name and its count of entities, and one line for each aggregate pair and direction that a `refers_to` link between their entities joins, with a crow's foot at the referring end and one at the other (many to one). An aggregate whose entities refer to no other aggregate MUST show its `relates_to` links instead, drawn dashed. A referenced aggregate in another domain MUST appear gray, labeled with its domain in parentheses.
