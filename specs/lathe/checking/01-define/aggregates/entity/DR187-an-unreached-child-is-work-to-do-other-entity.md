---
id: LA-CHK-DR187
kind: domain_rule
title: An unreached child is work to do; other entity mistakes break the ERD
parent: LA-CHK-A11
---
A child entity its root does not reach SHOULD be a warning, since the ERD can still be drawn. A bad role, an aggregate without exactly one root, a bad Fields table and a part outside its aggregate MUST be errors.
