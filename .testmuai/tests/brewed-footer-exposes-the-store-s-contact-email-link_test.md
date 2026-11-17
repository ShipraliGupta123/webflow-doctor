---
assurance:
  id: t-5
  base: sha256:0c5255cd8380716e78fed087ef72129240d4511e778e5fe5fa6d46737816b9cb
---
# Brewed footer exposes the store's contact email link

> On Brewed's home page, the visitor finds the Get in touch heading and uses the footer contact link addressed to hello@brewed.example.com.

## Step 1 @verifies ac-17

At https://webflow-doctor-demo.webflow.io, reach the Brewed home page footer's contact area, then assert the footer shows the heading "Get in touch".

## Step 2 @verifies ac-18

In the Brewed home page footer's Get in touch area, assert that a contact email link is visible to the visitor and that it points to mailto:hello@brewed.example.com.

