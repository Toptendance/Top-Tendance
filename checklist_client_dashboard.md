# Top Tendance - Navigation, Role-Based Access & Client Dashboard Plan

## Phase 1: Header & Footer Role-Based Navigation
- [x] **Header User / Account Dropdown (`src/components/common/Header.tsx`)**:
  - [x] Add `User` icon in the right-side action cluster (next to Wishlist & Cart).
  - [x] Implement active auth session listener with Supabase client.
  - [x] Role-sensitive dropdown menu:
    - **Guest (Not logged in)**: Links to `/login` (Se connecter) and `/register` (Créer un compte).
    - **Client (`role = 'client'`)**: Links to `/account` (Mon Espace Client) and Déconnexion.
    - **Cashier (`role = 'cashier'`)**: Quick link to `/pos` (Caisse Enregistreuse) and Déconnexion.
    - **Manager (`role = 'manager'`)**: Quick links to `/inventory` (Gestion Stock), `/reports` (Rapports Financiers), `/pos` (Caisse), and Déconnexion.
- [x] **Mobile Menu Integration (`src/components/common/MobileMenu.tsx`)**:
  - [x] Add account / staff shortcuts to the mobile drawer navigation.
- [x] **Footer Discrete Access (`src/components/common/Footer.tsx`)**:
  - [x] Add a discrete "Espace Personnel / Caisse" link in the footer bottom bar for direct staff access.

---

## Phase 2: Client Dashboard Architecture (`/account`)
- [x] **Tabbed Client Portal Layout**:
  - [x] Sidebar navigation: Mes Commandes, Mes Achats en Boutique, Mes Adresses, Mon Profil & Sécurité.
- [x] **Online Orders History**:
  - [x] Display orders placed on the website with status (`En attente`, `Expédiée`, `Livrée`).
  - [x] Order invoice download / printable receipt view.
- [x] **In-Store Purchases (Omnichannel History)**:
  - [x] View tickets and purchases made at the physical store linked to the customer's phone or email.
- [x] **Shipping Address Book**:
  - [x] Save default delivery details (Nom, Téléphone, Adresse, Ville/Gouvernorat).
- [x] **Wishlist Sync**:
  - [x] Cloud sync between authenticated customer account and local wishlist context.

---

## Phase 3: Route Protection & Middleware
- [x] Protect `/inventory` and `/reports` routes: enforce `role = 'manager'`.
- [x] Protect `/pos` route: enforce `role IN ('cashier', 'manager')`.
- [x] Protect `/account` route: redirect unauthenticated users to `/login`.

