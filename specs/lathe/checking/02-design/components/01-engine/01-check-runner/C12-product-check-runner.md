---
id: LA-CHK-C12
kind: component
title: Product check runner
parent: LA-CHK-LAY02
component_type: module
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC05-R01, LA-CHK-UC05-R02, LA-CHK-UC05-R03, LA-CHK-UC05-R04, LA-CHK-UC05-R05, LA-CHK-DR08, LA-CHK-DR09, LA-CHK-DR10, LA-CHK-DR11]
  depends_on: [LA-CHK-C11]
---
`runChecks` in the engine: runs Lathe's check files, then the product's checks folder, through one runner that names each check by its file name and turns a failing query into an error naming the file. Before running the product's files it reports a missing folder as `product-checks-missing` and sets aside each file whose name is taken by one of Lathe's checks or by the engine, as `product-check-name-clash`.
