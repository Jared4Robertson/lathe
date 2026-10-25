---
id: LA-BRW-T422
kind: test
title: "The Appearance page lists every theme with a preview, and a copy is edited live, renamed, reset and deleted"
parent: LA-BRW
test_type: component
run_by: app/test/themes.test.tsx
links:
  proves: [LA-BRW-UC114-R03, LA-BRW-UC114-R04, LA-BRW-DR203, LA-BRW-DR204]
  covers: [LA-BRW-C195, LA-BRW-C193]
---
Expects the five built-ins with previews in their own colors, uses one, duplicates Workshop into an editor with colors grouped by purpose and light and dark side by side, changes a color, text size, radius, density, motion and a font and sees each in the theme's stylesheet at once, renames it, resets it to Workshop and deletes it, after which Lathe is in use again.
