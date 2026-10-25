---
id: LA-BRW-DR306
kind: domain_rule
title: A domain's ERD draws one "reacts to" line per aggregate pair and event
parent: LA-BRW-A12
---
A domain's ERD MUST draw exactly one dashed "reacts to" line for each `reacts_to` link from an aggregate to an event that another aggregate raises, when either aggregate is in the domain, running from the raising aggregate to the reacting one. An aggregate reacting to its own event, and a use case or component reacting to an event, MUST NOT draw a line there.
