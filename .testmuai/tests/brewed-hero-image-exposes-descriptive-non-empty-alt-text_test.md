---
assurance:
  id: t-4
  base: sha256:ac45497bdb4e50468bc0db3d2f18e813e3c276496c9fc51c6bbbcda179703dba
---
# Brewed hero image exposes descriptive non-empty alt text

> The visitor's home-page hero image exposes non-empty alt text that describes its image content.

## Step 1 @verifies ac-6, ac-9

Open https://webflow-doctor-demo.webflow.io in a desktop browser viewport and locate the home-page hero, then assert the heading reads “Brewed — small-batch coffee gear” and the Shop now call-to-action is visible.

## Step 2 @verifies ac-7, ac-8

On the Brewed home-page hero, inspect the hero image and its DOM alt attribute alongside the image's visible content, then assert the alt text is non-empty and describes that image.
