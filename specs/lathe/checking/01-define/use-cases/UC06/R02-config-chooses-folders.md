---
id: LA-CHK-UC06-R02
kind: requirement
title: The product's config chooses its folders
parent: LA-CHK-UC06
---
Every command MUST read the specs folder from the product's `lathe.config.json`, defaulting to `specs`, and MUST NOT read records from any other folder. A setting the config does not define MUST be refused with an error that names it.
