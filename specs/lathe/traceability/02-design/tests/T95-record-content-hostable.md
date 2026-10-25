---
id: LA-TRC-T95
kind: test
title: The record content takes a record ID and sends the links it follows to its host
parent: LA-TRC
test_type: component
run_by: app/test/obligations.test.tsx
links:
  proves: [LA-TRC-UC11-R06]
---
Renders the record content on its own with an `onNavigate` spy and expects clicks on links in the body, aside and header to call it with the address while the browser address stays put, the container class that lets it fold at half width, and a message for an unknown ID.
