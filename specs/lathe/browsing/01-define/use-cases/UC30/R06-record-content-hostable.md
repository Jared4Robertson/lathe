---
id: LA-BRW-UC30-R06
kind: requirement
title: The record content can sit inside another view
parent: LA-BRW-UC30
---
A record's content (header, body, fields, parent, children and links) MUST be one piece that takes a record ID and an `onNavigate` callback, apart from the page around it, so the graph can show it beside itself. Links inside it MUST go through `onNavigate` on a plain click and stay real links otherwise. It SHOULD read well at half the screen width.
