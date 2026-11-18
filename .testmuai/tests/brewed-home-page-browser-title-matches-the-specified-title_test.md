---
assurance:
  id: t-6
  base: sha256:64d58da5c01f120aeb5c3a68216b53f8cfb52711c21adae894b584f431dcc392
---
# Brewed home-page browser title matches the specified title

> A visitor opens the Brewed home page and its browser title exactly matches the specified store title.

## Step 1 @verifies ac-19

Open https://webflow-doctor-demo.webflow.io, then assert the browser tab title (document.title) is 'Brewed — small-batch coffee gear'. Do not use the on-page heading for this check.
