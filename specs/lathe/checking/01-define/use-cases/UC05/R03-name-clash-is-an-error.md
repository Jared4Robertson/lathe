---
id: LA-CHK-UC05-R03
kind: requirement
title: A product check named like one of Lathe's checks is an error
parent: LA-CHK-UC05
---
A product check whose name equals one of Lathe's checks MUST NOT be run, and MUST be reported as a `product-check-name-clash` error naming its file.
