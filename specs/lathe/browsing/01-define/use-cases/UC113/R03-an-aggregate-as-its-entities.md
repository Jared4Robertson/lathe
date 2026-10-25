---
id: LA-BRW-UC113-R03
kind: requirement
title: An aggregate's ERD draws its entities with their fields and relationships
parent: LA-BRW-UC113
---
On an aggregate the Model view MUST draw one box per entity, with its title, a root mark on the root, and each field's name and kind of value, and a line for each `has_one` (one to one), `has_many` (one to many) and `refers_to` (many to one) link its entities hold, with those crow's-foot ends. An entity it refers to in another aggregate of the domain MUST be labeled with that aggregate in parentheses, and one in another domain MUST appear gray, labeled "(Domain · Aggregate)".
