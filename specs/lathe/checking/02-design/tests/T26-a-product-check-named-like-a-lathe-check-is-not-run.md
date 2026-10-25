---
id: LA-CHK-T26
kind: test
title: A product check named like one of Lathe's checks is an error and is not run
parent: LA-CHK
test_type: unit
run_by: lathe/test/product-checks.test.ts
links:
  proves: [LA-CHK-UC05-R03, LA-CHK-DR09]
---
Adds `02-unproved.sql` to the product's checks and expects one `product-check-name-clash` error naming the file, and none of that file's rows.
