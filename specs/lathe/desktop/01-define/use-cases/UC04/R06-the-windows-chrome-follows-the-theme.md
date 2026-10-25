---
id: LA-DSK-UC04-R06
kind: requirement
title: The window's chrome follows the theme
parent: LA-DSK-UC04
---
When the theme or the light or dark mode changes, including the system's appearance while the mode is System, the app MUST send the theme's shell and ink colors to the shell through `window.latheDesktop.setChrome`. The shell MUST then set the window's background and, on Windows and Linux, the window controls' colors.
