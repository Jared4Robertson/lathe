---
id: LA-EXP-UC11-R07
kind: requirement
title: An aggregate's ERD shows the domain events it raises and who reacts to them
parent: LA-EXP-UC11
group: Domain events
---
On an aggregate's ERD, each of its domain events MUST appear as a rounded pill beside its entities, in the spark colors, naming the event and how many fields it carries. Where the event has `raised_by`, a short line MUST run to it from the entity that raises it; an event with none stands on its own. Each aggregate that reacts to the event, from this domain or another, MUST appear as faded context (another domain's gray and named in parentheses) at the end of a dashed "reacts to" line from the event. An event's page MUST offer the Model view, drawing its aggregate's ERD with its pill picked out.
