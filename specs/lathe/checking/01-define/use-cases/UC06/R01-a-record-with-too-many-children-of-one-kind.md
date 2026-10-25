---
id: LA-CHK-UC06-R01
kind: requirement
title: A record with too many children of one kind is a warning
parent: LA-CHK-UC06
---
A record with more children of one kind than the product's `structure.maxChildren` MUST be a `too-many-children` warning that names the record, the kind and the count, and says to add a level between them, such as a capability, a layer or another aggregate. Children MUST be counted per kind, and tests MUST NOT be counted.
