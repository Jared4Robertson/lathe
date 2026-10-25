---
id: LA-AUT-UC14-R03
kind: requirement
title: A flow's steps are numbered within their path
parent: LA-AUT-UC14
---
A flow step MAY name its `path`, a short name such as main or refused; a step with no path MUST be on the main path. Within each path of a flow, the steps' orders MUST be whole numbers, unique and without gaps, and `flow-step-order` MUST report each break of this as an error.
