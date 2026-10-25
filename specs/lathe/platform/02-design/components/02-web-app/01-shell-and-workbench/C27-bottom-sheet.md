---
id: LA-PLT-C27
kind: component
title: Bottom sheet
parent: LA-PLT-LAY03
component_type: react component
file: app/src/shell/BottomSheet.tsx
links:
  satisfies: [LA-PLT-UC07-R04, LA-PLT-UC07-R05, LA-PLT-DR17, LA-PLT-UC08-R10, LA-PLT-UC09-R03]
  depends_on: [LA-PLT-C08]
---
A sheet that rises from the bottom edge to half the screen, with a grab handle: a tap or a drag up takes it to full height, a drag down to half or away (`settle` weighs the distance and the speed of a flick), Escape or a tap on the dimmed page closes it, and Tab stays inside it. It follows the finger while dragged and slides with the shared motion tokens.
