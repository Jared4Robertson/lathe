---
id: LA-CHK-UC17-R03
kind: requirement
title: Two steps of one flow with the same order are an error
parent: LA-CHK-UC17
---
Two steps under the same flow whose orders are the same number (so `1` and `01` clash) MUST each be reported as a `flow-step-order` error naming the other. Steps of different flows MAY share an order.
