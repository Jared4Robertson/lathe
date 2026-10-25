---
id: LA-TRC-UC14-R06
kind: requirement
title: Domain events show what raises them and what reacts to them
parent: LA-TRC-UC14
---
An aggregate's page MUST list its domain events in their own list titled "Domain events" (LA-EXP-DR36), each row one link to the event saying which entity raises it and how many records react to it, and its list of other children MUST NOT list them again. An event's page MUST show its Fields table, as an entity's page does, and its Traceability MUST list "Raised by" and "Reacted to by"; a record that reacts to an event MUST list it under "Reacts to". Every one of these words MUST come from the relations' labels in the meta-model.
