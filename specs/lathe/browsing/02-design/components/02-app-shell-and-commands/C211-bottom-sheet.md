---
id: LA-BRW-C211
kind: component
title: Bottom sheet
parent: LA-BRW-LAY02
component_type: react component
file: app/src/shell/BottomSheet.tsx
links:
  satisfies: [LA-BRW-UC116-R04, LA-BRW-UC116-R05, LA-BRW-DR223]
  depends_on: [LA-BRW-C58]
---
A sheet that rises from the bottom edge to half the screen, with a grab handle: a tap or a drag up takes it to full height, a drag down to half or away (`settle` weighs the distance and the speed of a flick), Escape or a tap on the dimmed page closes it, and Tab stays inside it. It follows the finger while dragged and slides with the shared motion tokens.
