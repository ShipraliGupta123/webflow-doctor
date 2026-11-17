---
assurance:
  id: t-4
  base: sha256:ef8613f5f0dfe2d788af6996e1117747ae7b7bfbfe3f17583412b9a3bfdffe8d
---
# Brewed hero image exposes descriptive non-empty alt text

> The visitor's home-page hero image exposes non-empty alt text that describes its image content.

## Step 1 @verifies ac-6, ac-9

Open https://webflow-doctor-demo.webflow.io in a desktop browser viewport and locate the home-page hero, then assert the heading reads “Brewed — small-batch coffee gear” and the Shop now call-to-action is visible.

## Step 2 @verifies ac-7

On the Brewed home-page hero, read the hero image's alt attribute from the DOM, then assert the alt attribute value is not an empty string.

## Step 3 @verifies ac-8

On the Brewed home-page hero, compare the hero image's alt text with what the image visibly shows, then assert the alt text describes that image.

