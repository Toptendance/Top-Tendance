# Spécifications Détaillées — Impression d'Étiquettes et Codes-Barres

**Projet** : Top Tendance  
**Format planche** : Feuille A4 – 40 étiquettes HERMA 8698 (4 colonnes × 10 lignes, 52.5 × 29.7 mm)  
**Imprimante cible** : Canon PIXMA G2010  
**Date d'inspection** : 26 Novembre 2026  

---

## 1. Stack Technique et Fichiers Impliqués

* **Framework & UI** : Next.js 14.2.24 (App Router), React 18.3.1, TypeScript 5.9.3, Tailwind CSS 3.4.17.
* **Moteur de rendu Code-barres** : `jsbarcode` ^3.12.3 (avec typages `@types/jsbarcode` ^3.11.4).
* **Base de données & Backend** : Supabase (`@supabase/supabase-js` ^2.119.0, PostgreSQL).
* **Icônes** : `lucide-react` ^0.475.0.

### Fichiers Sources Principaux
1. **`src/components/pos/BarcodeTagModal.tsx`** :
   * Composant `<SingleLabelItem>` : génère la disposition vectorielle de l'étiquette, le code-barres SVG, la typographie et les prix.
   * Composant `<BarcodeTagModal>` : gère la file d'attente d'articles, les réglages de quantité, la réutilisation d'une planche entamée (`startPosition`), le décalage de calibration Canon, la pagination multi-pages et le déclenchement de l'impression.
2. **`src/app/globals.css`** :
   * Règles `@media print` : format `@page`, marges nulles (`0mm`), grille CSS 4×10, dimensions des cellules (52.5 × 29.7 mm) et compensation de mise à l'échelle Canon (`zoom: 1.30 !important;`).
3. **`src/utils/barcodeGenerator.ts`** :
   * Algorithme de génération de code-barres EAN-13 (13 chiffres, préfixe interne `200`), calcul du chiffre de contrôle (modulo-10 EAN-13), détection de collisions et génération de SKU structurés.
4. **`src/app/inventory/page.tsx`** :
   * Héberge `<BarcodeTagModal>`, contrôle l'état du modal (`tagModalVariant`), et exécute la persistance du statut imprimé dans Supabase (`handleVariantsPrinted`).
5. **`src/components/inventory/InventoryTableSection.tsx`** :
   * Interface du tableau d'inventaire : déclenchement de l'impression individuelle ou par lot (`onOpenTagModal`), filtres par statut d'impression (*Tous*, *Non imprimés*, *Imprimés*).
6. **`src/components/inventory/NewProductModal.tsx` & `src/components/inventory/ProductVariantModals.tsx`** :
   * Attribution et validation des codes-barres lors de la création ou modification de produits et variantes.
7. **`supabase_step2_schema.sql`** :
   * Définition de la colonne `barcode TEXT UNIQUE` et de l'index `idx_variants_barcode` sur la table `variants`.

---

## 2. Méthode d'Impression

L'application utilise l'**impression native du navigateur** via l'API JavaScript `window.print()`, en ciblant un conteneur HTML masqué à l'écran et activé uniquement lors de l'impression (`print:block`).

### 2.1 Déclencheur JavaScript (`BarcodeTagModal.tsx`)
```typescript
const handlePrint = (testMode: boolean = false) => {
  setIsTestPage(testMode);
  if (!testMode && onPrinted) {
    const ids = items
      .map((it) => it.variantId)
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      onPrinted(ids);
    }
  }
  // Laisse le temps à React d'injecter la structure DOM d'impression
  setTimeout(() => {
    window.print();
  }, 100);
};
```

### 2.2 Structure HTML / JSX d'Impression (`BarcodeTagModal.tsx`)
```tsx
{/* Conteneur hors-écran activé uniquement à l'impression */}
<div
  id="print-sheets-container"
  className="hidden print:block"
  style={{
    left: `${offsetX / 1.30}mm`,
    top: `${offsetY / 1.30}mm`,
  }}
>
  {isTestPage ? (
    <div className="a4-print-sheet">
      {Array.from({ length: 40 }).map((_, idx) => (
        <div key={`test-${idx}`} className="a4-print-cell">
          <SingleLabelItem
            productName={items[0].productName}
            sku={items[0].sku}
            barcode={items[0].barcode}
            size={items[0].size}
            color={items[0].color}
            selling_price={items[0].selling_price}
            isTest={true}
            cellIndex={idx + 1}
          />
        </div>
      ))}
    </div>
  ) : (
    printPages.map((page, pageIdx) => (
      <div key={`page-${pageIdx}`} className="a4-print-sheet">
        {page.map((cell) => (
          <div key={cell.id} className="a4-print-cell">
            {cell.type === 'label' && cell.item ? (
              <SingleLabelItem
                productName={cell.item.productName}
                sku={cell.item.sku}
                barcode={cell.item.barcode}
                size={cell.item.size}
                color={cell.item.color}
                selling_price={cell.item.selling_price}
              />
            ) : (
              // Cellule d'espacement pour réutilisation de feuille entamée
              <div className="w-[52.5mm] h-[29.7mm] bg-transparent" />
            )}
          </div>
        ))}
      </div>
    ))
  )}
</div>
```

### 2.3 Feuilles de Style CSS d'Impression (`src/app/globals.css`)
```css
@media print {
  @page {
    size: A4 portrait;
    margin: 0mm;
  }

  html, body {
    width: 210mm !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    overflow: visible !important;
  }

  /* Neutralise la modale d'affichage */
  .barcode-modal-wrapper {
    position: static !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: visible !important;
    background: transparent !important;
  }

  /* Masque tout le contenu standard */
  body * {
    visibility: hidden !important;
  }

  /* Révèle uniquement le conteneur d'étiquettes */
  #print-sheets-container,
  #print-sheets-container * {
    visibility: visible !important;
  }

  #print-sheets-container {
    display: block !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 210mm !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    background: #ffffff !important;
    zoom: 1.30 !important; /* Facteur de compensation pilote Canon G2010 */
  }

  /* Planche A4 = Grille CSS 4 colonnes × 10 lignes */
  .a4-print-sheet {
    width: 210mm !important;
    height: auto !important;
    min-height: 297mm !important;
    max-height: 297mm !important;
    display: grid !important;
    grid-template-columns: repeat(4, 52.5mm) !important;
    grid-template-rows: repeat(10, 29.7mm) !important;
    page-break-after: always !important;
    break-after: page !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
  }

  .a4-print-sheet:last-child {
    page-break-after: avoid !important;
    break-after: avoid !important;
  }

  /* Cellule d'étiquette unitaire */
  .a4-print-cell {
    width: 52.5mm !important;
    height: 29.7mm !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    background: #ffffff !important;
    display: flex !important;
    align-items: stretch !important;
  }
}
```

---

## 3. Bibliothèque de Code-Barres, Version, Format et Paramètres

* **Bibliothèque** : `jsbarcode`
* **Version** : `^3.12.3`
* **Format / Symbologie** : `'CODE128'`
* **Calcul dynamique de la largeur de barre** :
  ```typescript
  const barcodeLength = cleanBarcode.length;
  const barWidth = barcodeLength > 16 ? 1.05 : barcodeLength > 13 ? 1.2 : 1.35;
  ```
  *(Pour les codes standards générés à 13 chiffres, `barcodeLength = 13`, donc `barWidth = 1.35`).*
* **Configuration JsBarcode complète** (`SingleLabelItem` dans `BarcodeTagModal.tsx`) :
  ```typescript
  JsBarcode(svgRef.current, cleanBarcode, {
    format: 'CODE128',
    width: barWidth,        // 1.35 pour 13 chiffres
    height: 40,             // ~10-11mm en coordonnées vectorielles SVG
    displayValue: true,     // Affiche les chiffres sous les barres
    fontSize: 9,            // Taille de police 9px
    font: 'monospace',      // Typographie à chasse fixe
    textMargin: 2,          // Espacement de 2px entre barres et chiffres
    margin: 0,              // 0 marge interne dans JsBarcode (géré par le conteneur)
  });
  ```

---

## 4. Type de Sortie du Code-Barres et Redimensionnement

* **Type de sortie** : **SVG Vectoriel** (`<svg ref={svgRef} className="w-full h-auto block" style={{ maxHeight: '14mm' }} />`).
* **Format matriciel (PNG/Canvas)** : Aucun rendu matriciel ; JsBarcode injecte directement des balises `<rect>` pour les barres et `<text>` pour les chiffres dans le DOM SVG.
* **Mise à l'échelle via ViewBox** :
  ```typescript
  const widthAttr = svgRef.current.getAttribute('width');
  const heightAttr = svgRef.current.getAttribute('height');
  if (widthAttr && heightAttr) {
    svgRef.current.setAttribute('viewBox', `0 0 ${widthAttr} ${heightAttr}`);
  }
  ```
* **Distorsion / Étirement** : Le code-barres n'est **pas étiré ni déformé**. Grâce au `viewBox` et au comportement SVG natif (`preserveAspectRatio: xMidYMid meet`), le ratio d'aspect des barres est préservé, s'adaptant à la largeur disponible (`47.5mm` effectifs) et plafonné à `maxHeight: 14mm`.

---

## 5. Taille de Page, Marges, Grille et Échelle

* **Format de page** : `A4 portrait` (`210mm × 297mm`).
* **Marges de page** : `margin: 0mm` dans `@page`, et `margin: 0 !important; padding: 0 !important;` sur `html, body`.
* **Colonnes de la grille** : `4` (`grid-template-columns: repeat(4, 52.5mm) !important;`).
* **Lignes de la grille** : `10` (`grid-template-rows: repeat(10, 29.7mm) !important;`).
* **Espacements (gaps)** : `0mm` (aucun gap : $4 \times 52.5\text{mm} = 210\text{mm}$, $10 \times 29.7\text{mm} = 297\text{mm}$).
* **Échelle & Compensation Pilote Canon G2010** :
  * Le conteneur `#print-sheets-container` intègre `zoom: 1.30 !important;` dans le CSS.
  * Décalage matériel paramétrable en mm dans la modale :
    `left: ${offsetX / 1.30}mm`, `top: ${offsetY / 1.30}mm` (enregistré dans le `localStorage` sous `herma_a4_offset_x` et `herma_a4_offset_y`).
  * Réglages de la boîte de dialogue d'impression Chrome :
    * Format : **A4**
    * Marges : **Aucune (None)**
    * Échelle : **100% / Par défaut (Default)**

---

## 6. Dimensions d'Étiquette, Padding, Bordures et Débordements

* **Cellule Grille (`.a4-print-cell`)** :
  * Largeur : `52.5mm !important`
  * Hauteur : `29.7mm !important`
  * Box-sizing : `border-box !important`
  * Débordement : `overflow: hidden !important`
  * Affichage : `display: flex !important; align-items: stretch !important`
* **Corps de l'Étiquette (`SingleLabelItem`)** :
  * Largeur : `w-[52.5mm]`
  * Hauteur : `h-[29.7mm]`
  * Box-sizing : `box-border`
  * Padding : `style={{ padding: '1.5mm 2.5mm' }}` (vertical : **1.5mm**, horizontal : **2.5mm**)
  * Bordures :
    * Étiquette normale de production : **Aucune bordure extérieure** (`border: 0`).
    * Séparateur interne : `border-t border-gray-300 pt-0.5` au-dessus de la ligne Enseigne / Prix.
    * Étiquette de test (`isTest`) : `border border-dashed border-gray-400 p-1`.
  * Débordements : `overflow-hidden` sur le conteneur principal, tronquage de texte via `truncate w-full` (nom) et `truncate max-w-[55%]` / `truncate max-w-[45%]` (SKU / Variante).

---

## 7. Tailles de Police et Hauteurs des Éléments

Le composant organise les données en 3 blocs verticaux répartis via `flex flex-col justify-between items-center text-center` sur les `29.7mm` :

| Bloc | Élément | Taille de Police / Classes CSS | Hauteur & Contraintes |
| :--- | :--- | :--- | :--- |
| **Haut** | Nom du produit | `text-[9px] font-black uppercase tracking-tight` | `leading-tight truncate w-full` |
| **Haut** | Référence (SKU) | `text-[7.5px] font-mono font-bold text-gray-800` | `truncate max-w-[55%]` |
| **Haut** | Variante (Taille/Couleur) | `text-[7.5px] font-mono font-semibold text-gray-900` | `truncate max-w-[45%] text-right` |
| **Milieu** | Code-barres SVG (barres) | Coordonnées vectorielles `height: 40` | `maxHeight: '14mm'`, `w-full h-auto block` |
| **Milieu** | Numéro code-barres (chiffres) | `fontSize: 9` (`font: monospace`) | `textMargin: 2` sous les barres |
| **Bas** | Enseigne (« Top Tendance ») | `text-[7.5px] font-extrabold uppercase tracking-wider` | `leading-none` |
| **Bas** | Prix de vente | `text-[10px] font-black font-mono tracking-tight` | `leading-none`, formaté en `#.000 DT` |

---

## 8. Largeur, Hauteur, Épaisseur de Barre et Zones Silencieuses (Quiet Zones)

* **Largeur de barre unitaire (`barWidth`)** :
  * `1.35` (largeur nominale pour codes $\le 13$ caractères).
* **Hauteur du code-barres** :
  * Dans JsBarcode : `height: 40` (unités vectorielles).
  * Hauteur maximale rendue : `maxHeight: '14mm'` (englobant barres + marge de 2px + texte de 9px).
* **Zones de silence (Quiet Zones à gauche et à droite)** :
  * JsBarcode est configuré avec `margin: 0`.
  * La zone de silence est garantie physiquement par le padding horizontal du conteneur de l'étiquette : `2.5mm` à gauche et `2.5mm` à droite (`padding: '1.5mm 2.5mm'`).
  * Largeur utile pour le code-barres : $52.5\text{mm} - (2 \times 2.5\text{mm}) = 47.5\text{mm}$.

---

## 9. Répartition des Étiquettes sur les Pages, Quantités et Répétitions

La logique de répartition est gérée dans `BarcodeTagModal.tsx` via `buildPrintPages()` :

### 9.1 File d'attente aplatie (`flatLabelsQueue`)
```typescript
const flatLabelsQueue: BarcodePrintItem[] = [];
items.forEach((item) => {
  for (let i = 0; i < item.printQty; i++) {
    flatLabelsQueue.push(item);
  }
});
```
Chaque article possède une quantité paramétrable (`printQty`). Si un article a une quantité de 5, il est dupliqué 5 fois consécutivement dans la file.

### 9.2 Réutilisation d'une planche entamée (`startPosition`)
* L'utilisateur peut définir la case de départ de `1` à `40`.
* Calcul du nombre total d'emplacements :
  `totalCellsNeeded = (startPosition - 1) + totalLabels;`
* Calcul du nombre total de pages A4 :
  `totalPages = Math.max(1, Math.ceil(totalCellsNeeded / 40));`

### 9.3 Remplissage des cellules (40 cases par feuille)
* **Cases 0 à `startPosition - 2`** : Cellules vides de saut `{ type: 'empty' }` (`<div className="w-[52.5mm] h-[29.7mm] bg-transparent" />`) pour préserver les étiquettes déjà décollées.
* **Cases d'impression** : Remplies par les étiquettes de `flatLabelsQueue`.
* **Cases de fin de dernière page** : Cellules vides transparentes `{ type: 'empty' }` pour maintenir l'alignement strict de la grille 4×10.

### 9.4 Ruptures de page CSS
* `.a4-print-sheet` : `page-break-after: always !important; break-after: page !important;`
* `.a4-print-sheet:last-child` : `page-break-after: avoid !important; break-after: avoid !important;`
* Empêche l'apparition de pages blanches surnuméraires à la fin de l'impression.

---

## 10. Création, Validation et Sauvegarde des Numéros de Code-Barres

### 10.1 Algorithme de Génération (`src/utils/barcodeGenerator.ts`)
* **Longueur** : 13 chiffres (structure conforme EAN-13).
* **Préfixe interne magasin** : `'200'` (réservé par GS1 pour la distribution interne restreinte).
* **Charge utile (9 chiffres)** :
  * 6 chiffres issus de l'horodatage microseconde : `(Date.now() % 1000000).toString().padStart(6, '0')`.
  * 3 chiffres pseudo-aléatoires : `Math.floor(Math.random() * 1000).toString().padStart(3, '0')`.
* **Chiffre de contrôle EAN-13 (13ème chiffre)** :
  Calculé par algorithme standard Modulo-10 :
  ```typescript
  function calculateEan13CheckDigit(digits12: string): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const n = parseInt(digits12[i], 10);
      sum += i % 2 === 0 ? n : n * 3;
    }
    const mod = sum % 10;
    return mod === 0 ? 0 : 10 - mod;
  }
  ```
* **Contrôle anti-collision local** :
  Vérification dans une boucle de 1000 tentatives contre le `Set` des codes existants en mémoire.

### 10.2 Validation
* **Côté client** : Vérification temps réel de l'unicité par rapport aux articles déjà chargés.
* **Côté base de données** :
  Contrainte d'unicité PostgreSQL définie dans `supabase_step2_schema.sql` :
  ```sql
  barcode TEXT UNIQUE
  CREATE INDEX IF NOT EXISTS idx_variants_barcode ON public.variants(barcode);
  ```
  Toute tentative d'insertion de doublon lève l'erreur PostgreSQL `23505` (`variants_barcode_key`), interceptée dans l'interface :
  ```typescript
  if (errMsg.includes('variants_barcode_key') || (errMsg.includes('barcode') && errMsg.includes('key'))) {
    displayError = 'Ce code-barres est déjà utilisé par un autre article.';
  }
  ```

### 10.3 Sauvegarde & Traçabilité
* **Création / Édition** : Enregistré dans la table `variants` via `supabase.from('variants').insert(...)` ou `.update(...)`.
* **Statut d'impression** : Dès confirmation d'impression (`handlePrint(false)`), la fonction `handleVariantsPrinted` met à jour Supabase :
  ```typescript
  await supabase
    .from('variants')
    .update({
      is_printed: true,
      last_printed_at: new Date().toISOString(),
    })
    .in('id', variantIds);
  ```
