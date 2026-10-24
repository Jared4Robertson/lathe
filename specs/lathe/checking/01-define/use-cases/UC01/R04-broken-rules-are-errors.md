---
id: LA-CHK-UC01-R04
kind: requirement
title: Every broken record rule is reported as an error
parent: LA-CHK-UC01
---
The engine MUST report each breach of a record rule (duplicate or malformed ID, unknown kind, missing title, parent or required field, bad parent kind, unknown or disallowed relation, dangling link, a test whose `run_by` file is missing or lacks its ID) as an error problem naming the record.
