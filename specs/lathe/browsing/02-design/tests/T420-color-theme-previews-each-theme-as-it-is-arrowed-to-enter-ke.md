---
id: LA-BRW-T420
kind: test
title: "Color theme previews each theme as it is arrowed to; Enter keeps it and Escape puts back the one before"
parent: LA-BRW
test_type: component
run_by: app/test/themes.test.tsx
links:
  proves: [LA-BRW-UC114-R01, LA-BRW-UC114-R07]
  covers: [LA-BRW-C194, LA-BRW-C193]
---
Opens the picker with g then t, arrows to Workshop and expects it shown but not kept, Escape to put Lathe back, then filters to Midnight and keeps it with Enter, remembered with its stylesheet and announced.
