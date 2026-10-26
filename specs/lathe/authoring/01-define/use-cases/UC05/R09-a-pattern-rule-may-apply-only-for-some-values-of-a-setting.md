---
id: LA-AUT-UC05-R09
kind: requirement
title: A pattern rule may apply only for some values of a setting
parent: LA-AUT-UC05
---
A pattern rule MAY say in `applies_when` that it applies only for some values of one of its pattern's settings, written `<setting> is <value>` or `<setting> is not <value>`. `applies-when-unknown` MUST report as an error a field that is not written this way, or that names a setting its pattern does not list, and such a field MUST waive nothing.
