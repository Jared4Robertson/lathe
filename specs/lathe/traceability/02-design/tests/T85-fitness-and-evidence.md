---
id: LA-TRC-T85
kind: test
title: The product page shows the latest fitness and its history apart from the evidence
parent: LA-TRC
test_type: component
run_by: app/test/product-page.test.tsx
links:
  proves: [LA-TRC-UC09-R04]
---
Opens a product with two fitness records and checks the latest score, date and rendered body, the history newest first, and a separate Evidence section with counted signals and no score. Opens a product with no fitness record and checks the explanation and its link to the format section, then that the format page has that section.
