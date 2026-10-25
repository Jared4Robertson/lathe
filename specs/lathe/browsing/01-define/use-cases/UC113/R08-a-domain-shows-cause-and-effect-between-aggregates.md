---
id: LA-BRW-UC113-R08
kind: requirement
title: A domain's ERD shows which aggregates react to which aggregates' events
parent: LA-BRW-UC113
---
On a domain's ERD, a dashed "reacts to" line MUST run from an aggregate that raises an event to each aggregate that reacts to it, with an arrow at the reacting end, so the reader sees cause and effect: one line per aggregate pair and event (see LA-BRW-DR306). Hovering a line MUST show the event's name as its label; by touch the name always shows. An aggregate of another domain on either end is gray, faded context.
