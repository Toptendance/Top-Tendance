# Checklist: Correction Caisse du Jour & Gestion des Retours sur Ventes à Crédit

> **Statut** : En mode Planification (Ne pas implémenter sans validation)  
> **Objectif** : Restaurer le solde réel de caisse à **98.000 TND** et empêcher qu'un retour d'article à crédit ne déduise indûment du cash de la caisse.

---

## 🔍 Diagnostic Détaillé du Problème

### 1. Pourquoi la caisse affiche 10.000 TND au lieu de 98.000 TND ?
- **Vente réelle du jour** : 1 robe / article à **98.000 TND** (ID `#b58fe34a`).
- **Test crédit** : Vente à crédit enregistrée dans `customer_credits` pour **88.000 TND** (ID `#9e3cfe45`). La vente à crédit n'a pas été insérée dans `sales`, donc les ventes brutes restent à 98.000 TND.
- **Test retour de l'article** : Le caissier a utilisé le modal standard de retour. Le système a lié le retour à un ancien ticket de caisse de 88 DT (`#abadffee`) et a émis un **remboursement en espèces de -88.000 TND** (`#1a0682ff`).
- **Calcul effectué par le POS** :
  $$\text{Net Caisse} = 98.000\text{ (Vente)} - 88.000\text{ (Remboursement Cash)} = \mathbf{10.000\text{ TND}}$$
- **Anomalie** : L'article ayant été pris à crédit, aucun cash n'aurait dû sortir de la caisse. Le solde réel doit être de **98.000 TND**.

---

## 📋 Plan d'Action & Checklist

### Phase 1 : Correction Immédiate du Solde de Caisse (Données de Test)
- [ ] **1.1 Supprimer l'opération de retour de test erronée (`#1a0682ff`)**
  - Supprimer la ligne de remboursement de 88.000 DT dans la table `returns` et `return_items`.
  - Réajuster le stock incrémenté indûment par ce faux retour si nécessaire.
- [ ] **1.2 Vérifier la caisse du jour dans `/pos`**
  - Confirmer que le bandeau affiche immédiatement :
    - `CAISSE DU JOUR : 98,000 TND`
    - `Brut : 98,000 TND`
    - `0 retours`
    - `1 vente`

---

### Phase 2 : Gestion Métier des Retours pour Articles à Crédit
- [x] **2.1 Bloquer le remboursement cash sur un article non réglé**
  - Si un client retourne un article vendu à crédit :
    - Si la dette n'est **pas payée** $\rightarrow$ **Pas de sortie de caisse**. On annule ou réduit le montant restant dû dans `customer_credits` (`remaining_balance = remaining_balance - montant_article`).
    - L'article est réintégré en stock (`stock_quantity = stock_quantity + qty`).
    - Un mouvement de stock est journalisé : `credit_return`.
  - ✅ Implémenté via le RPC atomique `return_credit_item` (`supabase_step14_credit_return_rpc.sql`) : aucune écriture dans `returns` / `credit_payments`, donc aucun impact caisse.
  - ✅ Garde-fou ajouté dans `ReturnExchangeModal.tsx` : le remboursement espèces/carte est bloqué si l'article est lié à un crédit actif non soldé, avec renvoi vers le Carnet de Crédit.
- [x] **2.2 Action "Retour Article" directement depuis le Carnet de Crédit (`CreditLedger.tsx`)**
  - Ajouter un bouton d'action par ligne d'article dans l'accordéon du carnet de crédit : `"Retourner cet article"`.
  - Cette action :
    1. Réintègre l'article dans le stock (`variants.stock_quantity`).
    2. Déduit la valeur de l'article du solde débiteur du client.
    3. N'impacte **JAMAIS** la caisse d'espèces du jour (aucun décompte sur les 98 DT).
  - ✅ Implémenté avec modal de confirmation, sélection de quantité, suivi `credit_items.returned_quantity` et bannière de succès. Aucune ligne de remboursement n'est créée.

---

### Phase 3 : Intégration Caisse Globale (Crédits + Comptant)
- [x] **3.1 Intégrer les encaissements réels de crédit dans la Caisse du Jour**
  - Quand un client verse un acompte ou règle sa dette en espèces (`credit_payments` avec `payment_method = 'cash'`), ce cash physique doit être compté dans le tiroir-caisse sans doubler les ventes d'articles.
  - ✅ Implémenté : `fetchDailySales` agrège les `credit_payments` du jour. `netCash = espèces ventes + encaissements crédits espèces - remboursements cash`. Rafraîchissement après acompte de vente à crédit, règlement dans `CreditLedger`, ou insertion `credit_payments`.
- [x] **3.2 Clôture de Caisse (Z-Report)**
  - Détail clair :
    - Espèces ventes directes
    - Espèces encaissements crédits
    - Moins remboursements réels effectués en cash
    - **Total espèces physiques en caisse**
  - ✅ Implémenté dans `ZReportModal.tsx` avec ces 4 lignes distinctes, plus la ventilation cartes/TPE des encaissements crédits.

---

### Phase 4 : Validation & Test Scénarios
- [ ] **4.1 Test scénario complet** :
  1. Vente directe 98 DT $\rightarrow$ Caisse = 98 DT.
  2. Vente à crédit 88 DT avec acompte 0 DT $\rightarrow$ Caisse = 98 DT (Dette client = 88 DT).
  3. Retour de l'article à crédit $\rightarrow$ Dette client = 0 DT, Stock réintégré, **Caisse reste à 98 DT**.

