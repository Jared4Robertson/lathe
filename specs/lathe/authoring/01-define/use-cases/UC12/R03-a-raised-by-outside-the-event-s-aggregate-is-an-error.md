---
id: LA-AUT-UC12-R03
kind: requirement
title: A raised_by outside the event's aggregate is an error
parent: LA-AUT-UC12
---
A `raised_by` link to an entity that sits in another aggregate than the event MUST be a `raised-by-outside-aggregate` error that names both aggregates and the fix. An event with no `raised_by` MUST NOT be reported.
