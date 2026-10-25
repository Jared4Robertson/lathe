---
id: LA-CHK-DR06
kind: domain_rule
title: One mistake gives one error
parent: LA-CHK-EN02
---
A check MUST NOT report an error that only follows from a mistake another check already reports. A link or parent that resolves to a duplicated ID MUST be judged against every record with that ID, and a record whose parent does not exist MUST NOT have that parent's kind judged.
