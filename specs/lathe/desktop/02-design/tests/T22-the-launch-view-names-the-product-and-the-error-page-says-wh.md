---
id: LA-DSK-T22
kind: test
title: The launch view names the product, and the error page says what failed and offers Retry, another folder and the folder itself
parent: LA-DSK
test_type: unit
run_by: desktop/test/launch.test.ts
links:
  proves: [LA-DSK-UC05-R05, LA-DSK-UC05-R10, LA-DSK-UC05-R11, LA-DSK-DR14]
---
Builds the launch view and the error page models, steps from the page's `data-specs`, reads the engine's message from the spec API's answer, runs only the buttons a page shows, and builds the About model with its versions and two links.
