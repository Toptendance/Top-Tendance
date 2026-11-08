# Checklist: Mobile-Friendly Responsiveness for Dashboards

**Project**: Top Tendance (Next.js 14 + Tailwind CSS + Supabase)  
**Status**: Planning / Not Started  
**Target Viewports**: 360px - 430px (Smartphones), 768px - 1024px (Tablets / iPad), 1280px+ (Desktop)

---

## 1. Customer Dashboard (`/account`)
- [x] **Navigation & Header Bar**
  - [x] Convert vertical/rigid tab headers into horizontally scrollable touch-friendly pills with active indicators (`overflow-x-auto`, `no-scrollbar`).
  - [x] Make user greeting and quick metrics (Orders count, Wishlist count, Default address) stack cleanly on small viewports (`flex-col sm:flex-row`).
  - [x] Optimize "Sign Out" button placement on mobile so it is accessible without cluttering top headers.
- [x] **Tab 1: Online Orders**
  - [x] Convert wide order status tables / rows into mobile card views.
  - [x] Format tracking info, status badges, price, and "View Details" / "Invoice" buttons with adequate touch targets (min 44px).
  - [x] Prevent date/order ID truncation on narrow screens (<375px).
- [x] **Tab 2: In-Store Purchases (Omnichannel POS Sales)**
  - [x] Stack ticket header (Store name, Date, Total, Payment method) into a clean mobile receipt card.
  - [x] Make itemized lists readable inside collapsible accordions or compact lists rather than fixed-width tables.
  - [x] Reposition receipt preview/print trigger for mobile printing compatibility.
- [x] **Tab 3: Address Book**
  - [x] Stack address cards to full width (`w-full`) with clear default badge tags.
  - [x] Optimize the "Add New Address" modal:
    - [x] Fullscreen or bottom-sheet drawer on mobile screens (`sm:max-w-lg w-full max-h-[90vh] overflow-y-auto`).
    - [x] Convert 2-column city/postal code inputs into single column stack on mobile (`grid grid-cols-1 sm:grid-cols-2`).
- [x] **Tab 4: Profile Settings**
  - [x] Make input fields, labels, and update buttons 100% full width on mobile screens with easy thumb access.

---

## 2. Cashier POS Terminal (`/pos`)
- [x] **Screen Layout & Adaptability**
  - [x] Transform the desktop two-column split (Scanner/Catalog left, Cart/Checkout right) into a fluid responsive layout or bottom-sheet cart on mobile screens.
  - [x] Add a sticky floating mobile cart summary bar at the bottom showing item count, total (DT), and a "Voir Panier / Payer" trigger button.
- [x] **Barcode & Quick Search Bar**
  - [x] Make the barcode input full-width with large tap targets.
  - [x] Provide quick toggle buttons for Cashiers using smartphone/tablet cameras or external Bluetooth scanners.
  - [x] Ensure on-screen keyboard doesn't hide essential buttons or cause horizontal scroll overflow.
- [x] **Cart Items & Quantity Steppers**
  - [x] Replace table/tight flex layout with touch-friendly cards:
    - Large increment/decrement buttons (`+` and `-`) with min 44×44px hit areas.
    - Prominent trash/remove icon.
    - Clear variant display (Size, Color, Price).
- [x] **Modals & Drawers**
  - [x] **Payment Drawer (`PaymentDrawer.tsx`)**:
    - Ensure keypad / quick cash buttons (10 DT, 20 DT, 50 DT, Exact) wrap cleanly and don't overflow on small mobile screens.
    - Full viewport height / bottom sheet styling with clear "Validate Sale" button.
  - [x] **Product Search Drawer (`ProductSearchDrawer.tsx`)**:
    - Fullscreen modal on mobile with instant search input auto-focused and scrollable variant results.
  - [x] **Receipt Modal (`ReceiptModal.tsx`)**:
    - Center thermal preview (80mm / 58mm style) scaled properly for mobile preview with single-tap WhatsApp share / print.

---

## 3. Manager Inventory Dashboard (`/inventory`)
- [x] **Header, Metrics & Quick Actions**
  - [x] Refactor KPI summary cards (Total Products, Low Stock Alert, Total Valuation) into a 1-col or 2-col responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
  - [x] Make action buttons ("Réceptionner Stock", "Nouveau Produit", "Export") stack or scroll horizontally without breaking header layout.
- [x] **Search, Filters & Category Pills**
  - [x] Make search bar and category filter dropdown stack vertically on mobile screens.
  - [x] Low-stock alert toggle switch positioned ergonomically for mobile thumbs.
- [x] **Product & Variants Inventory Table**
  - [x] Convert table to responsive card view on mobile screens (`< 768px`):
    - Product title, category tag, and thumbnail/icon.
    - Variant pills (Size/Color) with stock count badge and low-stock warning color.
    - Quick actions per variant: Print Tag, Adjust Stock, Delete.
  - [x] For tablet/desktop screens (`>= 768px`), keep table with horizontal scroll wrapper (`overflow-x-auto`).
- [x] **Modals**
  - [x] **Delivery Receiving Modal (`DeliveryReceivingModal.tsx`)**:
    - Make invoice details & variant selector responsive full width.
  - [x] **Barcode Tag Modal (`BarcodeTagModal.tsx`)**:
    - Scale tag preview for mobile screens and ensure print CSS works on mobile browser print dialogs.

---

## 4. Manager Analytics & Reports (`/reports`)
- [x] **Header & Period Selectors**
  - [x] Time range buttons (7 jours, 30 jours, 90 jours) converted to a full-width segmented control on mobile.
- [x] **Revenue & Profit KPI Cards**
  - [x] Grid stack: 1 column on mobile, 2 columns on tablet, 4 columns on desktop.
- [x] **Payment Breakdown & Charts**
  - [x] Adjust payment split cards (Espèces vs Carte vs Mixte) to stack cleanly without cut-off labels or numbers.
- [x] **Stock Movement Audit Log Table**
  - [x] Make table horizontally scrollable or convert to a timeline/activity card feed on mobile showing: timestamp, variant, user, quantity change (+/-), and movement type badge.

---

## 5. Global Mobile UI/UX & Common Shell Checks
- [x] **Viewport & Overflow Prevention**
  - [x] Ensure all parent dashboard containers have `max-w-full overflow-x-hidden` to prevent horizontal drift/wobble.
- [x] **Top Header & Role Badge Navigation**
  - [x] Verify `Header.tsx` and `MobileMenu.tsx` allow switching seamlessly between customer account, cashier POS, and manager inventory on mobile without text overlap.
- [x] **Touch Targets & Typography**
  - [x] Guarantee all buttons and interactive controls meet minimum WCAG accessibility standards (at least 44×44px).
  - [x] Ensure font sizes on inputs are at least 16px to prevent iOS Safari auto-zooming on focus.

