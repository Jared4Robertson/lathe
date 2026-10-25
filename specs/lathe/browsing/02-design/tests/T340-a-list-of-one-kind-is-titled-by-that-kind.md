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
Expects an aggregate's page and inspector to title its children "Domain rules", with the list named "Domain rules of DM-SHOP-A1"; a use case's inspector to say "UC requirements"; a row's nested list to be named by its kind; a product's mixed children to stay "Children", tagged by kind; a group's members, on the wiki group page and in the inspector, to be titled "Use cases", with the wiki list named "Use cases of DM-SHOP/use_case"; and a renamed kind to title the list with its own label.
