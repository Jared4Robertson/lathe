---
id: LA-BRW-UC51-R07
kind: requirement
title: A command's keys suit the platform
parent: LA-BRW-UC51
---
A command MAY have other keys off a Mac. On a Mac, Ctrl means the Control key, so Ctrl+W leaves Cmd+W to the browser; elsewhere Ctrl+W closes the tab and Ctrl+G finds the next match, so the view toggles take Alt+W, Alt+G and Alt+M there. A binding that is reserved for the browser on the current platform MUST never be offered, even through an override, and tooltips, `aria-keyshortcuts`, the command palette and the shortcuts sheet MUST show the keys for the current platform.
