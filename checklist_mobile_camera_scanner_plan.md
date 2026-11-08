# Architectural Plan: Mobile Phone Camera Barcode / QR Scanner Integration

## 🎯 Goal
Enable cashiers and warehouse managers to use their **smartphones (iOS Safari / Android Chrome)** to scan printed product barcodes (CODE128, EAN13) and QR codes directly from the browser without installing a native app.

---

## 🛠️ Technology Comparison & Recommendation

| Option | Library | Advantages | Disadvantages | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Option A (Recommended)** | **`html5-qrcode`** | • Production standard for web scanners<br>• Supports both 1D Barcodes (CODE128, EAN) & 2D QR<br>• Lightweight, handles camera permissions automatically<br>• Integrated flashlight/torch and flip camera | Needs HTTPS on mobile (already present on `toptendance.net`) | **BEST CHOICE** |
| **Option B** | **`@zxing/library`** | Very customizable, robust decoding engine | Larger bundle size, more manual camera boilerplate | Alternative |
| **Option C** | **Browser Native `BarcodeDetector` API** | Zero dependencies, hardware accelerated | Not supported in all iOS Safari versions | Too restrictive |

---

## 🏗️ Implementation Phases

### Phase 1: Install Camera Scanner Engine
- Add `html5-qrcode` dependency:
  ```bash
  npm install html5-qrcode
  ```

### Phase 2: Create Reusable Camera Scanner Modal (`MobileScannerModal.tsx`)
Create a lightweight, responsive modal component that:
1. Requests mobile camera permission (uses rear environment camera by default).
2. Displays a clean HUD with a target scanning square / reticle and active laser line.
3. Decodes CODE_128, EAN_13, UPC, and QR_CODE formats.
4. Includes:
   - **Vibration feedback** (`navigator.vibrate(100)`) on successful scan.
   - **Audio beep** (reusing existing `playBeep('success')`).
   - Camera flip (front/back) and Torch toggle button (if device flashlight supported).
   - Close / Cancel button.

### Phase 3: Integrate with POS & Inventory Screens
- **POS Screen ([`src/app/pos/page.tsx`](file:///c:/Users/dell/Top%20Tendance/src/app/pos/page.tsx))**:
  - Add a **"Scanner Caméra / Téléphone"** button beside the manual search button.
  - When scanned on phone: directly calls `handleBarcodeSubmit(code)` to add the item to the cart and plays sound.
- **Inventory Screen ([`src/app/inventory/page.tsx`](file:///c:/Users/dell/Top%20Tendance/src/app/inventory/page.tsx))**:
  - Add camera scan button in the search bar to jump immediately to that product.
  - In "Réception de Livraison" modal: use camera to scan incoming stock.

### Phase 4: Mobile Hardware & Browser Prerequisites
- Must run on **HTTPS** (already active on `https://toptendance.net/pos` - Chrome and Safari strictly block camera access on plain HTTP).
- iOS Safari requires explicit user tap to launch the camera stream.

---

## 🧪 Acceptance Test & Verification
- [ ] Open `https://toptendance.net/pos` on mobile phone browser (iOS / Android).
- [ ] Tap "Scanner Caméra" -> Browser asks for camera permission -> Allow.
- [ ] Point phone camera at printed tag.
- [ ] Beep plays + phone vibrates + item added immediately to cart.
- [ ] Works in both orientations (portrait & landscape).

