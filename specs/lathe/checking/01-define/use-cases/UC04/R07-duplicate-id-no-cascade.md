---
id: LA-CHK-UC04-R07
kind: requirement
title: A duplicated ID gives one error, not one per link to it
parent: LA-CHK-UC04
---
When an ID is used by two or more records, the check MUST report the `duplicate-id` error, and MUST NOT report `relation-not-allowed` or `parent-kind-not-allowed` for a link or parent that one of the records with that ID allows. A link or parent that none of them allows MUST still be reported once, naming each kind the ID has.
