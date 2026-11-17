---
assurance:
  id: t-1
  base: sha256:7772ebcf63467e6c472bc02bbc38aafc3cfd5736a47404573e8f3d2b7ff152d3
---
# Each Brewed product Buy button reaches a working page

> For Pour-over Kettle, Burr Grinder, and Travel Press, selecting Buy opens a destination page that is not a 404 or error page.

## Step 1

At https://webflow-doctor-demo.webflow.io, open the Brewed home page and reach its products section.

## Step 2 @verifies ac-1, ac-2

From the Brewed products section at https://webflow-doctor-demo.webflow.io, follow the Pour-over Kettle Buy button, then assert its destination loads as a page rather than a 404 or error page.

## Step 3 @verifies ac-1, ac-2

From the Brewed products section at https://webflow-doctor-demo.webflow.io, follow the Burr Grinder Buy button, then assert its destination loads as a page rather than a 404 or error page.

## Step 4 @verifies ac-1, ac-2

From the Brewed products section at https://webflow-doctor-demo.webflow.io, follow the Travel Press Buy button, then assert its destination loads as a page rather than a 404 or error page.
