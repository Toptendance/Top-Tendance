# Checklist: Impression Planches d'Étiquettes A4 (HERMA Top Stick A4/40)

## 1. Contexte & Spécifications Matériel
- **Format Papier :** Feuille A4 (210 mm × 297 mm)
- **Modèle planche :** HERMA Top Stick A4/40 (sans marge de bordure / 0 margin sheet)
- **Grille :** 4 colonnes × 10 lignes = 40 étiquettes par page
- **Dimensions Étiquette unitaire :** Exactement 52.5 mm × 29.7 mm ($4 \times 52.5\text{ mm} = 210\text{ mm}$, $10 \times 29.7\text{ mm} = 297\text{ mm}$)
- **Imprimante cible :** Canon G2410 jet d'encre via navigateur Chrome
- **Type Code-Barres :** CODE128 vectoriel (SVG) compatible douchette USB

---

## 2. Checklist des Modifications

### A. Mise à Jour des Dimensions & Titres
- [x] Mettre à jour les dimensions de 50 × 30 mm vers **52.5 × 29.7 mm** partout.
- [x] Modifier le titre de la modale : `Étiquette Code-Barres (52.5mm × 29.7mm) - Planche A4`.
- [x] Mettre à jour le composant unitaire d'étiquette pour adopter le ratio exact de 52.5 mm × 29.7 mm.

### B. Contrôles & Formulaire dans la Modale
- [x] **Champ Quantité :**
  - Ajout d'un champ input numérique `Quantité` (valeur par défaut = 1, min = 1).
  - Permet d'imprimer $N$ exemplaires de l'étiquette sélectionnée.
- [x] **Champ Position de Départ :**
  - Ajout d'un champ input `Commencer à l'étiquette n°` (de 1 à 40, défaut = 1).
  - Décale le début de l'impression pour réutiliser les planches entamées (en insérant des cellules vides transparentes).
- [x] **Mini-Visualiseur / Grille d'Aperçu (4 × 10) :**
  - Affichage interactif ou visuel compact des 40 cases de la feuille.
  - Cellules déjà consommées grisées/barrées (de 1 à startPos - 1).
  - Cellules actives mises en surbrillance/numérotées.
- [x] **Bouton Page de Test (Calibration) :**
  - Bouton permettant de basculer en mode calibration ou d'imprimer une feuille test.
  - Imprime sur papier ordinaire les contours fins de chaque case (1 à 40) avec leur numéro d'emplacement pour vérifier l'alignement mécanique de la Canon G2410.
- [x] **Réglages Décalage (Offsets mm) :**
  - Ajout d'inputs de calibration fine : Décalage horizontal (X) et vertical (Y) en millimètres.
  - Sauvegarde locale (`localStorage`) pour conserver les réglages de l'imprimante sans modifier le code.

### C. Design & Rendu de l'Étiquette Unitaire
- [x] **Suppression des bordures d'impression :**
  - Pas de bordure imprimée sur l'étiquette finale (fond transparent, pas de trait de découpe en mode normal).
- [x] **Zone de sécurité / Marges internes configurables :**
  - Marges internes par défaut : ~2 mm haut, ~3-4 mm côtés et bas (adapté aux marges non imprimables de la Canon G2410).
  - Réglage configurable centralisé.
- [x] **Typographie & Hiérarchie d'information :**
  - Nom du produit en gras, tronqué proprement sans déborder.
  - SKU, Taille (`T: ...`) et Couleur.
  - Nom de boutique : `Top Tendance`.
  - Prix en DT bien lisible (`font-mono font-black`).
  - Tailles de police optimisées et compactes pour éviter tout écrasement du code-barres.
- [x] **Code-Barres SVG Vectoriel (JsBarcode) :**
  - Code-barres au format SVG net et vectoriel (hauteur $\ge 10\text{ mm}$).
  - Espacement blanc latéral de sécurité (quiet zone) d'au moins 3 mm de chaque côté.
  - Préservation du format CODE128 pour compatibilité immédiate avec la douchette USB.

### D. Layout d'Impression Multi-Pages CSS (@media print)
- [x] Configuration de la règle `@page` :
  ```css
  @page {
    size: 210mm 297mm;
    margin: 0mm;
  }
  ```
- [x] Masquage complet de tous les éléments d'interface (header, navbar, modals, boutons, fonds).
- [x] Structure de grille d'impression stricte :
  - Conteneur de page : `width: 210mm; height: 297mm; display: grid; grid-template-columns: repeat(4, 52.5mm); grid-template-rows: repeat(10, 29.7mm); page-break-after: always;`
  - Cellule unitaire : `width: 52.5mm; height: 29.7mm; box-sizing: border-box; overflow: hidden;`
- [x] Gestion automatique du saut de page (`break-after: page` / `page-break-after: always`) lorsque le total des cellules (cases sautées + quantité) dépasse 40.
- [x] Forcer l'impression en noir pur monochrome (`color-adjust: exact`, `-webkit-print-color-adjust: exact`).
- [x] Masquer les en-têtes et pieds de page Chrome (date, URL, titre).

---

## 3. Guide de Configuration Navigateur (Chrome / Canon G2410)
À communiquer à l'utilisateur lors de la livraison :
1. **Destination :** Canon G2410 series.
2. **Format de papier :** A4.
3. **Marges :** **Aucune** (None / 0 mm).
4. **Échelle :** **Par défaut (100%)** — ne pas cocher "Ajuster à la page" (Fit to page).
5. **Options :**
   - Décocher **En-têtes et pieds de page**.
   - Cocher ou décocher Graphiques d'arrière-plan selon le besoin (la grille de test peut nécessiter d'être visible).

