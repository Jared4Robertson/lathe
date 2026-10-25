---
id: LA-CHK-DR210
kind: domain_rule
title: A domain rule under an entity belongs to its aggregate
parent: LA-CHK-A11
---
A domain rule MAY sit under an entity of its aggregate. It MUST then belong to that aggregate, domain and product, found by walking its parent chain, and every check and coverage MUST count it as a rule directly under the aggregate.
