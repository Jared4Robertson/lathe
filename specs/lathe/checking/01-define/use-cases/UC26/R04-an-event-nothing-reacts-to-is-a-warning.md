---
id: LA-CHK-UC26-R04
kind: requirement
title: An event nothing reacts to is a warning
parent: LA-CHK-UC26
---
A domain event that no record links to with `reacts_to` MUST be an `event-unheard` warning that says this can be fine and suggests the aggregate, use case or component that might react.
