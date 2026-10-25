---
id: LA-EXP-DR45
kind: domain_rule
title: The graph's tree is the nav's tree
parent: LA-EXP-A4
---
The graph MUST walk the same tree the nav shows, from the one folder model: a domain holds its stages (Define, Design) and the folders outside every stage, a stage its folders, a folder its records, and a product its Shared folder, then its domains, then its open questions and fitness. A folder that mixes kinds the nav lists side by side (Interaction design: flows, views, endpoints) MUST split into one group per kind; a folder of one kind, or one that lists containers and then the records outside any (Capabilities; Technical specification), MUST NOT. Empty stages and folders are not drawn. Every stage, folder and group MUST be a node with its own address (`/<domain-id>/define`, `/<domain-id>/design/technical-specification`), labeled and counted as in the nav.
