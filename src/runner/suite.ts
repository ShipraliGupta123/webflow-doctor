export interface SuiteTest {
  id: string;
  name: string;
  path: string;
  weight: number; // used by the score: higher = more important to the business
}

// Explicit list: the mobile test is deliberately excluded (Kane can't run it at 390px).
export const SUITE: SuiteTest[] = [
  {
    id: 't-1',
    name: 'Buy buttons reach a working page',
    path: '.testmuai/tests/each-brewed-product-buy-button-reaches-a-working-page_test.md',
    weight: 3,
  },
  {
    id: 't-3',
    name: 'Desktop hero and product listings',
    path: '.testmuai/tests/desktop-hero-opens-brewed-s-three-product-listings_test.md',
    weight: 3,
  },
  {
    id: 't-4',
    name: 'Hero image alt text',
    path: '.testmuai/tests/brewed-hero-image-exposes-descriptive-non-empty-alt-text_test.md',
    weight: 2,
  },
  {
    id: 't-5',
    name: 'Footer contact email link',
    path: '.testmuai/tests/brewed-footer-exposes-the-store-s-contact-email-link_test.md',
    weight: 1,
  },
  {
    id: 't-6',
    name: 'Home page browser title',
    path: '.testmuai/tests/brewed-home-page-browser-title-matches-the-specified-title_test.md',
    weight: 2,
  }
];
