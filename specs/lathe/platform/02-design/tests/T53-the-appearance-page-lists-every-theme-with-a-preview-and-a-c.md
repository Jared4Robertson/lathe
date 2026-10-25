---
id: LA-PLT-T53
kind: test
title: The Appearance page lists every theme with a preview, and a copy is edited live, renamed, reset and deleted
parent: LA-PLT
test_type: component
run_by: app/test/themes.test.tsx
links:
  proves: [LA-PLT-UC06-R03, LA-PLT-UC06-R04, LA-PLT-DR14, LA-PLT-DR15]
  covers: [LA-PLT-C23, LA-PLT-C21]
---
Expects the five built-ins with previews in their own colors, uses one, duplicates Workshop into an editor with colors grouped by purpose and light and dark side by side, changes a color, text size, radius, density, motion and a font and sees each in the theme's stylesheet at once, renames it, resets it to Workshop and deletes it, after which Lathe is in use again.
