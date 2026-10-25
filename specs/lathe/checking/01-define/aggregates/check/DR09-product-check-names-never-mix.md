---
id: LA-CHK-DR09
kind: domain_rule
title: A product check never shares a name with one of Lathe's checks
parent: LA-CHK-A1
---
Each problem's check name MUST say whether Lathe or the product reported it. A product check MUST NOT take the name of one of Lathe's checks, or of a problem the engine reports itself (`parse-error`, `parent-cycle`, `product-check-name-clash`, `product-checks-missing`).
