# Top Tendance - Scanner & Barcode Integration Status

## ✅ Issue Resolved Summary
- **Initial Problem**: The scanner made a beep ("PIP"), but nothing appeared in Windows, Notepad, or the POS dashboard.
- **Root Causes Identified & Solved**:
  1. **USB HID Mode**: Scanner was reconfigured into USB HID Keyboard mode.
  2. **Language Layout (QWERTY vs AZERTY)**: Initially output `-&ç&ààààààà"é` because the scanner was set to US keyboard layout. Switched to French keyboard layout.
  3. **Verified Output**: Correctly decodes and sends pure numeric barcode `6191000000032` followed by carriage return.
  4. **POS Cart Added**: Verified live on `toptendance.net/pos` with automatic item addition.

---

## 📋 Standard Operational Checklist for POS Cashiers

- [x] **Scanner Connection**: USB dongle / cable plugged in and detected in HID Keyboard mode.
- [x] **Keyboard Layout**: French / AZERTY configured so digits `0-9` type without shift-key errors.
- [x] **Auto-Enter Suffix**: Scanner sends `<Enter>` immediately after the code.
- [x] **Live POS Route**:
  - Open `toptendance.net/pos`
  - Press <kbd>F2</kbd> (Focus Scanner) if cursor is not in input.
  - Scan product tag -> Item automatically appears in *Panier en cours*.
  - Press <kbd>F9</kbd> to proceed to Payment.
