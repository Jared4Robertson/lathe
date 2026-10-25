---
id: LA-CHK-DR199
kind: domain_rule
title: An event is raised inside its own aggregate
parent: LA-CHK-A13
---
A domain event's `raised_by`, when it has one, MUST name an entity of the event's own aggregate. An event MAY have no `raised_by`, such as one raised by time passing or in an aggregate with no entities.
