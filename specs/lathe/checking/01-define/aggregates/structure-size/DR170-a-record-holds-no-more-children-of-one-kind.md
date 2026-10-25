---
id: LA-CHK-DR170
kind: domain_rule
title: A record holds no more children of one kind than the product allows
parent: LA-CHK-A10
---
A record SHOULD hold at most `structure.maxChildren` children of any one kind. More than that means a level is missing between them, which is work still to do, not breakage.
