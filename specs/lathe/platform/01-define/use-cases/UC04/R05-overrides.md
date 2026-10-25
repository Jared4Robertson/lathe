---
id: LA-PLT-UC04-R05
kind: requirement
title: A person can change the bindings
parent: LA-PLT-UC04
---
The app MUST read optional overrides from local storage (`lathe:keybindings`, a JSON map of command id to a binding or a list of bindings), ignore unknown commands and bad values, and say how in the shortcuts sheet, with each command's id shown.
