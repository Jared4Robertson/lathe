---
id: LA-AUT-UC06-R03
kind: requirement
title: A bad or repeated capability order is an error
parent: LA-AUT-UC06
---
The engine MUST report a `capability-order` error for a capability whose `order` is not a whole number, and for each capability whose order, read as a number, equals another capability's in the same domain. Capabilities in different domains MAY share an order.
