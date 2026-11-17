---
assurance:
  id: t-5
  base: sha256:19395954c98821c5e7b46921e918fa2f19c0e75511782c754fdd03bed9056ea9
---
# Brewed footer exposes the store's contact email link

> On Brewed's home page, the visitor finds the Get in touch heading and uses the footer contact link addressed to hello@brewed.example.com.

## Step 1 @verifies ac-17

At https://webflow-doctor-demo.webflow.io, reach the Brewed home page footer's contact area, then assert the footer shows the heading "Get in touch".

## Step 2 @verifies ac-18

In the Brewed home page footer's Get in touch area, inspect the contact email link as the visitor's way to initiate contact, then assert its href is mailto:hello@brewed.example.com.
