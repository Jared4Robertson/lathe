---
id: LA-CHK-UC04-R09
kind: requirement
title: A component that satisfies nothing is a warning
parent: LA-CHK-UC04
---
A component with no `satisfies` link to an obligation that exists MUST be reported as a `component-satisfies-nothing` warning, whose message says to link what it designs or implements (for shared infrastructure, what it makes possible) or remove it.
