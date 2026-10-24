---
id: LA-CHK-UC06-R03
kind: requirement
title: A product extends the meta-model without forking Lathe
parent: LA-CHK-UC06
---
When `lathe.config.json` names a `metaExtensions` folder, the kinds and relations in its `kinds.csv` and `relations.csv` MUST be added to Lathe's default meta-model for that product only. A row for a kind Lathe already defines widens that kind rather than adding a second one (`LA-CHK-UC09`).
