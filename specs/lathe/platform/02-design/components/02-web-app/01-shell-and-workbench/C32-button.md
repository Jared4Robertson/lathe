---
id: LA-PLT-C32
kind: component
title: Button
parent: LA-PLT-LAY03
component_type: react component
file: app/src/components/Button.tsx
links:
  satisfies: [LA-PLT-DR20, LA-PAT-APP-UX-R09]
---
`Button` with three variants: `ghost` (the default), `primary` and `icon`, the last requiring a `label` for its accessible name. It takes an optional leading `icon` and a `danger` flag, defaults `type` to `button`, and renders a real `<a href>` drawn as a button when given `href`. `buttonClass()` gives the same look to a router link (`Link`, `SpecLink`), which a generic component cannot import. Its classes (`button`, `button-ghost`, `button-primary`, `button-danger`, and `icon-button` for the icon variant) are styled once in `app/src/styles.css`, with the hover tint, the shared focus ring, the pressed look of a toggle and a 44 px target on a coarse pointer. It replaces the outlined `.secondary` and the bordered `.tree-bulk` buttons.
