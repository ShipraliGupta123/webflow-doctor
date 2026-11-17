---
assurance:
  id: t-1
  base: sha256:20ef68cb8d35b549d64928d7bed8ffab4088cc8cac77565502ec6a6d590978f6
---
# Each Brewed product Buy button reaches a working page

> For Pour-over Kettle, Burr Grinder, and Travel Press, selecting Buy opens a destination page that is not a 404 or error page.

## Step 1

At https://webflow-doctor-demo.webflow.io, open the Brewed home page and reach its products section.

## Step 2 @verifies ac-1, ac-2

From the Brewed products section at https://webflow-doctor-demo.webflow.io, click the Pour-over Kettle Buy button, then assert the page that opens does not show a 404, "page not found", or error message.

## Step 3 @verifies ac-1, ac-2

From the Brewed products section at https://webflow-doctor-demo.webflow.io, click the Burr Grinder Buy button, then assert the page that opens does not show a 404, "page not found", or error message.

## Step 4 @verifies ac-1, ac-2

From the Brewed products section at https://webflow-doctor-demo.webflow.io, click the Travel Press Buy button, then assert the page that opens does not show a 404, "page not found", or error message.
