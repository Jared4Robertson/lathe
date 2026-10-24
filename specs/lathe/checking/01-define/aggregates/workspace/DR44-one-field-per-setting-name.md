---
id: LA-CHK-DR44
kind: domain_rule
title: Patterns a use case follows do not share a setting name
parent: LA-CHK-A2
---
Two patterns that one use case follows SHOULD NOT list the same setting name. A use case has one field per name, so that one field would answer both patterns and could not give them different values. A shared name is reported as a warning, so that the person can rename the setting in one of the patterns.
