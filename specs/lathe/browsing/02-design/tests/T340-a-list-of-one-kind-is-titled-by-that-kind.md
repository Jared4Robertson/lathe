---
id: LA-BRW-T340
kind: test
title: A list of children or members of one kind is titled by that kind
parent: LA-BRW
test_type: component
run_by: app/test/list-titles.test.tsx
links:
  proves: [LA-BRW-DR160]
---
Expects an aggregate's page to title its children "Domain rules", with the list named "Domain rules of DM-SHOP-A1", and the side bar not to repeat them, nor a use case's requirements; a row's nested list to be named by its kind; a product's mixed children, in its side bar, to stay "Children", tagged by kind; a group's members on the wiki group page to be titled "Use cases", with the list named "Use cases of DM-SHOP/use_case"; and a renamed kind to title the list with its own label.
