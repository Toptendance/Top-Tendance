# Test Products & Barcode Printing Checklist

## Objective
Seed 4 realistic fashion products with Tunisian barcodes (`619...`), verify their labels are printable (50mm × 30mm thermal format), and test scanning them in the POS.

---

### Step 1 — Database Seeding ✅
- [x] Ensure categories exist: `Chemises`, `Vestes & Manteaux`, `Pantalons`, `Robes`
- [x] Insert 4 products with active variants:
  - **Product 1**: Robe Soirée Satin (`ROBE-SAT-NOIR-M`, Barcode: `6191000000018`, Price: 149.000 DT, Cost: 70.000 DT, Stock: 15)
  - **Product 2**: Chemise Lin Blanche (`CHEM-LIN-BLC-L`, Barcode: `6191000000025`, Price: 89.000 DT, Cost: 40.000 DT, Stock: 25)
  - **Product 3**: Blazer Oversize Camel (`BLAZ-OVR-CAM-S`, Barcode: `6191000000032`, Price: 189.000 DT, Cost: 95.000 DT, Stock: 10)
  - **Product 4**: Pantalon Tailleur Noir (`PANT-TAIL-NOIR-38`, Barcode: `6191000000049`, Price: 119.000 DT, Cost: 55.000 DT, Stock: 20)
- [x] Insert corresponding cost prices into `variant_costs`

---

### Step 2 — Barcode Tag Printing Test (Inventory Dashboard) ✅
- [x] Go to `/inventory`
- [x] Verify all 4 products display with their barcode, attributes, and stock
- [x] Test the **« Étiquette »** button for each item
- [x] Verify thermal label preview (50mm × 30mm with barcode, SKU, product name, price in DT)
- [x] Test print action via browser print dialog (`window.print()` targeting thermal 50mm × 30mm)
- [x] Production build passes cleanly ✅

---

### Step 3 — POS Scanning & Sale Test
- [ ] Go to `/pos`
- [ ] Scan or input barcode `6191000000018` → Cart adds *Robe Soirée Satin* at 149.000 DT
- [ ] Scan or input barcode `6191000000025` → Cart adds *Chemise Lin Blanche* at 89.000 DT
- [ ] Scan or input barcode `6191000000032` → Cart adds *Blazer Oversize Camel* at 189.000 DT
- [ ] Scan or input barcode `6191000000049` → Cart adds *Pantalon Tailleur Noir* at 119.000 DT
- [ ] Complete payment and verify ticket generation + automatic stock decrement

