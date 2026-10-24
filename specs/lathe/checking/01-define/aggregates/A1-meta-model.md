---
id: LA-CHK-A1
kind: aggregate
title: Meta-model
parent: LA-CHK
---
The rules for records, stored as data: the **kinds** of record (`lathe/meta/kinds.csv`: kind, label, stage, parent kinds, required fields, whether it is an obligation, description) and the **relation rules** (`lathe/meta/relations.csv`: relation, source kind, target kind, role, description). A product adds kinds and relations, or widens default kinds, with its own extension folder. Changing a rule is a recorded, checked change to these files, which is Lathe's self-improvement hook. The meta-model is changed only by editing these files and reviewing the diff in git, like records; the web app does not edit it. The engine checks the meta-model itself as well as the records.
