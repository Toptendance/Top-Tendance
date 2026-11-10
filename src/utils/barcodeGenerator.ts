/**
 * Barcode & SKU generation utility for Top Tendance.
 * Generates collision-resistant, retail-compliant unique barcodes (EAN-13 / Code-128 compatible)
 * and structured SKUs for variant batch creation.
 */

/**
 * Calculates EAN-13 check digit for a 12-digit string.
 */
function calculateEan13CheckDigit(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = parseInt(digits12[i], 10);
    sum += i % 2 === 0 ? n : n * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * Generates a unique 13-digit retail barcode using store internal prefix '200'.
 * Format: 200 (3 digits) + timestamp/random payload (9 digits) + check digit (1 digit)
 *
 * @param existingBarcodes Optional set or array of barcodes to avoid collisions against
 */
export function generateUniqueBarcode(existingBarcodes?: Set<string> | string[]): string {
  const existingSet = existingBarcodes instanceof Set ? existingBarcodes : new Set(existingBarcodes || []);

  let attempts = 0;
  while (attempts < 1000) {
    attempts++;
    // Internal store prefix: '200'
    const prefix = '200';
    // 9 pseudo-random numeric digits with microsecond component
    const nowMod = (Date.now() % 1000000).toString().padStart(6, '0');
    const rand3 = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const first12 = `${prefix}${nowMod}${rand3}`;
    const checkDigit = calculateEan13CheckDigit(first12);
    const candidate = `${first12}${checkDigit}`;

    if (!existingSet.has(candidate)) {
      existingSet.add(candidate);
      return candidate;
    }
  }

  // Fallback timestamp-based code in unlikely case of repeated collisions
  return `200${Date.now()}`.slice(0, 13);
}

/**
 * Generates a batch of unique barcodes, ensuring none collide with each other or existing ones.
 *
 * @param count Number of unique barcodes needed
 * @param existingBarcodes Optional existing barcodes
 */
export function generateBatchBarcodes(count: number, existingBarcodes?: Set<string> | string[]): string[] {
  const set = existingBarcodes instanceof Set ? new Set(existingBarcodes) : new Set(existingBarcodes || []);
  const results: string[] = [];

  for (let i = 0; i < count; i++) {
    const barcode = generateUniqueBarcode(set);
    results.push(barcode);
    set.add(barcode);
  }

  return results;
}

/**
 * Generates a clean structured SKU for a variant.
 * Format: BASE-SIZE-COLOR (e.g. BOTT-CUIR-38-NOIR)
 */
export function generateVariantSku(productName: string, size: string, color: string): string {
  const cleanStr = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ' ')
      .trim();

  const nameParts = cleanStr(productName)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length <= 4 ? word : word.slice(0, 4)));

  const baseName = nameParts.length > 0 ? nameParts.join('-') : 'PROD';
  const cleanSize = cleanStr(size) || 'U';
  const cleanColor = cleanStr(color) || 'STD';

  return `${baseName}-${cleanSize}-${cleanColor}`;
}

