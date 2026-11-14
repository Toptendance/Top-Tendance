# Checklist: Inclusion des Règlements de Crédits & Encaissés dans la Caisse du Jour (POS)

> **Problème identifié** : 
> Dans la barre supérieure de caisse (`DailySalesSummary.tsx` / `CAISSE DU JOUR`) :
> - Le total affiché était de **10,000 TND** au lieu du montant attendu.
> - **Cause racine exacte** :
>   1. Aujourd'hui, une vente standard de **98.000 TND** a été réalisée (`#b58fe34a`).
>   2. Un retour/remboursement de **-88.000 TND** a été enregistré aujourd'hui (`#1a0682ff`).
>   3. Le calcul actuel de la caisse est : `Net = Ventes (98.000) - Retours (88.000) = 10.000 TND`.
>   4. La vente à crédit de **88.000 TND** et ses encaissements d'acomptes/règlements (**50 DT + 38 DT** dans `credit_payments`) **ne sont pas comptabilisés dans le bandeau de caisse ni dans le Z-Report**, car `DailySalesSummary.tsx` et `fetchDailySales()` interrogent uniquement la table `sales` et `returns` !
>   5. Ni les acomptes initiaux à la vente à crédit, ni les encaissements différés ("Encaisser un règlement") ne figurent dans le journal de caisse du jour, faussant le montant réel des espèces en tiroir-caisse.

---

## 🔍 Diagnostic des Flux Financiers

| Source | Table Supabase | Pris en compte actuellement ? | Impact Caisse Espèces / Carte |
|---|---|---|---|
| Ventes Directes / Comptant | `sales` | ✅ OUI | Enregistré dans `sales` |
| Retours & Remboursements | `returns` | ✅ OUI | Déduit des ventes du jour |
| Acompte Vente à Crédit | `credit_payments` | ❌ NON | Argent physique reçu non comptabilisé en caisse |
| Règlements Crédit Différés | `credit_payments` | ❌ NON | Argent physique reçu non comptabilisé en caisse |
| Ventes à Crédit Non Payées | `customer_credits` | ❌ NON (normal) | Créance client (ne doit pas être comptée comme cash en caisse, mais peut être affichée en indicateur créances) |

---

## 📋 Plan d'Implémentation & Checklist

### Phase 1 : Données et Modèle de Calcul de Caisse
- [ ] **1.1 Extension du type `DailySalesData` (`src/components/pos/DailySalesSummary.tsx` & `src/types/sales.ts`)**
  - Ajouter :
    - `creditPaymentsTotal: number` (Total des règlements et acomptes de crédit encaissés aujourd'hui)
    - `creditCashPayments: number` (Acomptes/règlements en espèces)
    - `creditCardPayments: number` (Acomptes/règlements par carte)
    - `creditSalesAmount: number` (Total des marchandises sorties à crédit aujourd'hui)
  - Mettre à jour `netTotal` et `netCash` :
    - `netCash = (Ventes Cash - Retours Cash) + Règlements Crédit Espèces`
    - `netTotal = (Ventes Brutes - Remboursements) + Règlements Crédits Encaissés`

- [ ] **1.2 Requête des règlements de crédit du jour dans `fetchDailySales` (`src/app/pos/page.tsx`)**
  - Interroger `credit_payments` avec `created_at >= isoToday`.
  - Joindre ou ventiler selon `payment_method` (`cash` ou `card`).
  - Intégrer les montants encaissés dans les totaux `dailySales`.

- [ ] **1.3 Récupération détaillée dans `salesService.ts` (`fetchTodayDetailedCreditPayments`)**
  - Créer la fonction pour récupérer les règlements du jour avec le nom du client (`customer_credits(customer_name, customer_phone)`).

---

### Phase 2 : Interface Utilisateur POS (`DailySalesSummary.tsx`)
- [ ] **2.1 Affichage dans le bandeau supérieur rétractable**
  - Mettre en évidence :
    - **Espèces en caisse (Tiroir-Caisse)** intégrant les règlements de crédit.
    - Pill ou badge "Règlements Crédits (+X TND)".
- [ ] **2.2 Onglet "Journal des Opérations"**
  - Ajouter un sous-onglet ou une section dédiée : `Ventes`, `Retours`, et `Règlements Crédits`.
  - Permettre au caissier de visualiser chaque encaissement d'acompte/règlement avec l'heure, le client et le mode de règlement.
- [ ] **2.3 Mise à jour du Ticket Z / Z-Report (`ZReportModal.tsx`)**
  - Ligne distincte dans le rapport de clôture de caisse :
    - `Ventes Directes : X DT`
    - `Remboursements : -Y DT`
    - `Règlements Crédits Récupérés : +Z DT`
    - **Total Net en Caisse : (X - Y + Z) DT**

---

### Phase 3 : Vérification et Tests E2E
- [ ] **3.1 Test Vente à crédit avec acompte initial**
  - Vente de 100 DT avec 20 DT d'acompte espèces : la caisse physique augmente bien de 20 DT.
- [ ] **3.2 Test Règlement ultérieur dans le Carnet de Crédit**
  - Règlement de 50 DT en espèces : la caisse du jour s'incrémente immédiatement de 50 DT.
- [ ] **3.3 Test Cohérence Z-Report**
  - Le Z-Report matche exactement le comptage physique du tiroir-caisse.

