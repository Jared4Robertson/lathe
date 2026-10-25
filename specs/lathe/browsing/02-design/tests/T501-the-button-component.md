---
id: LA-BRW-T501
kind: test
title: The Button component draws ghost, primary and icon buttons, and links as buttons
parent: LA-BRW
test_type: component
run_by: app/test/button.test.tsx
links:
  proves: [LA-PAT-APP-UX-R09, LA-BRW-DR260]
---
Renders `Button` in each variant and expects a `<button type="button">` with the ghost classes by default, the primary classes when asked, the `icon-button` class and an accessible name for the icon variant, a leading icon when given one, and a real `<a href>` with the button's classes when given `href`. Reads the stylesheet for the ghost hover tint, the primary fill and the coarse-pointer target.
