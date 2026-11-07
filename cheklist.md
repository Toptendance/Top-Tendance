# Checklist: Implementation of ClothingStore JSON-LD Schema

## 1. Preparation & Validation
- [x] Review schema fields against Google Rich Results & Schema.org specifications for `ClothingStore`:
  - Context & Type (`@context`, `@type: "ClothingStore"`)
  - Identity & URLs (`@id`, `url`)
  - Store details (`name`, `image`, `telephone`, `priceRange`)
  - Address (`address` with `PostalAddress`)
  - Coordinates (`geo` with `GeoCoordinates`)
  - Opening Hours (`openingHoursSpecification` with days and times)
  - Social Profiles (`sameAs`)
- [x] Verify image asset existence (`/images/top-tendance-store.jpg` in `public/images/`)
- [x] Note domain consistency: Schema uses `https://www.toptendance.net/` while Next.js layout metadata currently uses `https://top-tendance.tn` (verified: image asset exists; schema fields all adhere to valid Schema.org `ClothingStore` specification).

## 2. Implementation Strategy
- [x] Choose placement for schema injection:
  - Add to root layout (`src/app/layout.tsx`) inside the `<head>` or `<body>` using `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />` (recommended for site-wide local business presence).
- [x] Prepare schema data object cleanly in TypeScript or directly within the component to avoid XSS/escaping issues.

## 3. Social Media Links in Footer (Facebook, Instagram, Pinterest)
- [x] Inspect existing `src/components/common/Footer.tsx` layout and determine ideal location for social icons (e.g., under brand presentation or next to newsletter/bottom bar).
- [x] Add social media icons and links with target `_blank` and `rel="noopener noreferrer"` matching Schema URLs:
  - Facebook: `https://www.facebook.com/clothstoretoptendance`
  - Instagram: `https://www.instagram.com/toptendanceofficial/`
  - Pinterest: `https://www.pinterest.com/rabaatoptendance/`
- [x] Use clean SVG icons or accessible Lucide/custom social icons with hover micro-interactions.

## 4. Verification & Testing
- [x] Run build test (`npm run build`) to ensure TypeScript compilation and no syntax errors.
- [x] Inspect generated page HTML in development mode to ensure script tags render correctly.
- [x] Validate schema using Google Rich Results Test / Schema Markup Validator syntax check.
- [x] Verify social media links in footer work and open expected destinations in a new tab.
