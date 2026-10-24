---
id: LA-CHK-UC06-R01
kind: requirement
title: Init writes a config and a first product record
parent: LA-CHK-UC06
---
`lathe init --name <name> --prefix <prefix>` MUST write `lathe.config.json` when the repo has none, and MUST write a product record with that ID and title. It MUST refuse a prefix that is not a valid ID and MUST NOT overwrite an existing product record.
