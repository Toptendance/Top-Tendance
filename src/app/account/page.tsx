'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Package, 
  MapPin, 
  Heart, 
  LogOut, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  Plus,
  Store,
  Printer,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { formatPrice } from '@/utils/currency';
import { useWishlist } from '@/context/WishlistContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/utils/supabaseClient';

export default function AccountPage() {
  const router = useRouter();
  const { wishlistCount } = useWishlist();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'orders' | 'store_purchases' | 'addresses' | 'profile'>('orders');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Addresses state
  const [addresses, setAddresses] = useState<any[]>([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [newAddress, setNewAddress] = useState({
    title: 'Domicile',
    full_name: '',
    phone: '',
    address_line: '',
    city: 'Tunis',
    governorate: 'Tunis',
    postal_code: '',
  });

  // Store purchases state (omnichannel)
  const [storePurchases, setStorePurchases] = useState<any[]>([]);

  // Online orders mock (or DB)
  const [onlineOrders, setOnlineOrders] = useState([
    {
      id: 'TT-892401',
      date: '28 Octobre 2026',
      total: 189.0,
      status: 'In Transit',
      statusLabel: 'En cours de livraison (Aramex)',
      statusColor: 'bg-amber-50 text-amber-800 border-amber-200',
      itemsCount: 1,
      itemsPreview: 'Robe Longue Ceinturée en Lin Pur (Taille M, Sable Doré)',
      deliveryAddress: 'Les Berges du Lac 2, Tunis',
    },
    {
      id: 'TT-814920',
      date: '14 Octobre 2026',
      total: 247.0,
      status: 'Delivered',
      statusLabel: 'Livrée',
      statusColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      itemsCount: 2,
      itemsPreview: 'Cardigan Côtelé en Maille Douce + Ensemble Salopette Bébé',
      deliveryAddress: 'Ennasr 2, Ariana',
    },
  ]);

  useEffect(() => {
    async function initUser() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/login');
        return;
      }
      setCurrentUser(session.user);

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setUserProfile(profile);

      // Staff safeguard: Cashiers and Managers don't use the customer account page
      if (profile?.role === 'cashier' || profile?.role === 'manager') {
        router.replace('/pos');
        return;
      }

      // Fetch customer addresses
      const { data: addrData } = await supabase
        .from('customer_addresses')
        .select('*')
        .order('is_default', { ascending: false });
      if (addrData) setAddresses(addrData);

      // Fetch in-store purchases linked to customer
      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          discount_amount,
          final_amount,
          payment_method,
          created_at,
          sale_items (
            id,
            quantity,
            unit_price,
            subtotal,
            variant:variants (sku)
          )
        `)
        .order('created_at', { ascending: false });

      if (salesData) {
        setStorePurchases(salesData);
      }

      setLoading(false);
    }
    initUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    showToast('Déconnexion effectuée avec succès.', 'info');
    router.push('/');
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('customer_addresses')
        .insert({
          user_id: currentUser.id,
          title: newAddress.title,
          full_name: newAddress.full_name || userProfile?.full_name || '',
          phone: newAddress.phone,
          address_line: newAddress.address_line,
          city: newAddress.city,
          governorate: newAddress.governorate,
          postal_code: newAddress.postal_code,
          is_default: addresses.length === 0,
        })
        .select()
        .single();

      if (error) throw error;
      setAddresses([...addresses, data]);
      setIsAddressModalOpen(false);
      showToast('Adresse enregistrée avec succès.', 'success');
      setNewAddress({
        title: 'Domicile',
        full_name: '',
        phone: '',
        address_line: '',
        city: 'Tunis',
        governorate: 'Tunis',
        postal_code: '',
      });
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la sauvegarde', 'error');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await supabase.from('customer_addresses').delete().eq('id', id);
      setAddresses(addresses.filter((a) => a.id !== id));
      showToast('Adresse supprimée.', 'info');
    } catch (err) {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-charcoal" />
      </div>
    );
  }

  // Prevent flash of customer account UI for staff before redirect finishes
  if (userProfile?.role === 'cashier' || userProfile?.role === 'manager') {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-charcoal" />
        <p className="text-xs text-charcoal-500 font-medium">Redirection vers l'espace caisse & gestion...</p>
      </div>
    );
  }

  const initials = userProfile?.full_name
    ? userProfile.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'CL';

  return (
    <div className="bg-cream min-h-screen py-6 sm:py-12 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Welcome Header */}
        <div className="bg-white border border-border rounded-xs p-4 sm:p-8 mb-6 sm:mb-8 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4 w-full sm:w-auto">
            <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full bg-cream flex items-center justify-center text-charcoal font-serif text-lg sm:text-xl border border-border font-bold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-lg sm:text-2xl font-serif text-charcoal font-semibold truncate">
                  Bonjour, {userProfile?.full_name || currentUser?.email?.split('@')[0]}
                </h1>
                <span className="text-[9px] sm:text-[10px] bg-charcoal text-white px-2 py-0.5 rounded uppercase font-semibold shrink-0">
                  Membre Top Tendance
                </span>
              </div>
              <p className="text-xs sm:text-sm text-charcoal-500 mt-0.5 sm:mt-1">
                Bienvenue dans votre espace client personnel
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full sm:w-auto justify-center flex items-center gap-2 text-xs uppercase tracking-wider text-charcoal-600 hover:text-charcoal border border-border px-4 py-2.5 sm:py-2 rounded-xs hover:bg-cream transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* Tabs Navigation: Horizontal scroll on mobile, vertical sidebar on lg+ */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-border rounded-xs p-2 sm:p-3 shadow-xs">
              <div className="flex flex-row lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xs text-xs uppercase tracking-wider font-semibold whitespace-nowrap transition shrink-0 lg:w-full ${
                    activeTab === 'orders'
                      ? 'bg-charcoal text-white'
                      : 'text-charcoal hover:bg-cream bg-cream/30 lg:bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <Package className="w-4 h-4 shrink-0" />
                    <span>Commandes</span>
                  </div>
                  <ChevronRight className="w-4 h-4 hidden lg:block" />
                </button>

                <button
                  onClick={() => setActiveTab('store_purchases')}
                  className={`flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xs text-xs uppercase tracking-wider font-semibold whitespace-nowrap transition shrink-0 lg:w-full ${
                    activeTab === 'store_purchases'
                      ? 'bg-charcoal text-white'
                      : 'text-charcoal hover:bg-cream bg-cream/30 lg:bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <Store className="w-4 h-4 shrink-0" />
                    <span>Achats Boutique</span>
                  </div>
                  <ChevronRight className="w-4 h-4 hidden lg:block" />
                </button>

                <button
                  onClick={() => setActiveTab('addresses')}
                  className={`flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xs text-xs uppercase tracking-wider font-semibold whitespace-nowrap transition shrink-0 lg:w-full ${
                    activeTab === 'addresses'
                      ? 'bg-charcoal text-white'
                      : 'text-charcoal hover:bg-cream bg-cream/30 lg:bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>Adresses</span>
                  </div>
                  <ChevronRight className="w-4 h-4 hidden lg:block" />
                </button>

                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xs text-xs uppercase tracking-wider font-semibold whitespace-nowrap transition shrink-0 lg:w-full ${
                    activeTab === 'profile'
                      ? 'bg-charcoal text-white'
                      : 'text-charcoal hover:bg-cream bg-cream/30 lg:bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <User className="w-4 h-4 shrink-0" />
                    <span>Profil</span>
                  </div>
                  <ChevronRight className="w-4 h-4 hidden lg:block" />
                </button>

                <Link
                  href="/wishlist"
                  className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xs text-xs uppercase tracking-wider font-semibold text-charcoal hover:bg-cream bg-cream/30 lg:bg-transparent transition shrink-0 lg:w-full"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <Heart className="w-4 h-4 shrink-0" />
                    <span>Favoris ({wishlistCount})</span>
                  </div>
                  <ChevronRight className="w-4 h-4 hidden lg:block" />
                </Link>
              </div>
            </div>
          </div>

          {/* Main Tab Content */}
          <div className="lg:col-span-3">
            {/* Tab 1: Online Orders */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="bg-white border border-border rounded-xs p-4 sm:p-6 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border pb-4 mb-4 sm:mb-6">
                    <div>
                      <h2 className="text-base sm:text-lg font-serif text-charcoal font-semibold">
                        Historique des Commandes en Ligne
                      </h2>
                      <p className="text-xs text-charcoal-500 mt-0.5 sm:mt-1">
                        Consultez le statut de vos livraisons et vos reçus
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {onlineOrders.map((order) => (
                      <div
                        key={order.id}
                        className="border border-border rounded-xs p-4 sm:p-5 hover:border-charcoal transition bg-white"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-border/60 gap-2">
                          <div className="flex items-center justify-between sm:justify-start">
                            <span className="font-mono text-xs font-bold text-charcoal">
                              Réf: {order.id}
                            </span>
                            <span className="text-charcoal-400 text-xs ml-3 font-medium">
                              {order.date}
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold border w-fit ${order.statusColor}`}
                          >
                            {order.statusLabel}
                          </span>
                        </div>

                        <div className="py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                          <div className="w-full sm:w-auto">
                            <p className="text-xs sm:text-sm font-semibold text-charcoal leading-snug">
                              {order.itemsPreview}
                            </p>
                            <p className="text-xs text-charcoal-500 mt-1">
                              Adresse: {order.deliveryAddress}
                            </p>
                          </div>
                          <div className="w-full sm:w-auto flex items-center justify-between sm:block sm:text-right pt-2 sm:pt-0 border-t sm:border-0 border-border/40">
                            <p className="text-xs text-charcoal-500">Total payé:</p>
                            <p className="text-base sm:text-lg font-serif font-bold text-charcoal">
                              {formatPrice(order.total)}
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-border/60 flex justify-end gap-3 text-xs">
                          <button
                            onClick={() => window.print()}
                            className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 border border-border rounded-xs text-charcoal hover:bg-cream transition font-medium text-xs"
                          >
                            <Printer size={14} /> Facture PDF
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: In-Store Purchases */}
            {activeTab === 'store_purchases' && (
              <div className="bg-white border border-border rounded-xs p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-6">
                <div className="border-b border-border pb-4">
                  <h2 className="text-base sm:text-lg font-serif text-charcoal font-semibold">
                    Mes Achats en Boutique (Caisse POS)
                  </h2>
                  <p className="text-xs text-charcoal-500 mt-0.5 sm:mt-1">
                    Retrouvez tous les tickets et achats réglés directement en magasin
                  </p>
                </div>

                {storePurchases.length === 0 ? (
                  <div className="text-center py-12 text-charcoal-400">
                    <Store size={40} className="mx-auto mb-3 stroke-1 text-charcoal-300" />
                    <p className="text-sm">Aucun ticket en boutique enregistré</p>
                    <p className="text-xs text-charcoal-400 mt-1">
                      Donnez votre numéro de téléphone en caisse pour synchroniser vos prochains achats
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {storePurchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="border border-border rounded-xs p-4 sm:p-5 bg-white space-y-3"
                      >
                        <div className="flex flex-wrap justify-between items-center pb-2 border-b gap-1">
                          <div>
                            <span className="font-mono text-xs font-bold text-charcoal">
                              Ticket #{purchase.id.slice(0, 8)}
                            </span>
                            <span className="text-xs text-charcoal-400 ml-2">
                              {new Date(purchase.created_at).toLocaleString('fr-TN')}
                            </span>
                          </div>
                          <span className="text-[11px] bg-gray-100 text-charcoal-700 px-2 py-0.5 rounded uppercase font-semibold">
                            {purchase.payment_method}
                          </span>
                        </div>

                        <div className="text-xs space-y-1.5 text-charcoal-700">
                          {purchase.sale_items?.map((it: any) => (
                            <div key={it.id} className="flex justify-between items-center gap-2">
                              <span className="truncate">
                                {it.quantity}x {it.variant?.sku}
                              </span>
                              <span className="font-mono font-medium shrink-0">
                                {Number(it.subtotal).toFixed(3)} DT
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t flex justify-between items-baseline font-bold text-sm">
                          <span>Total Réglé:</span>
                          <span className="font-mono text-base">{Number(purchase.final_amount).toFixed(3)} DT</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Shipping Addresses */}
            {activeTab === 'addresses' && (
              <div className="bg-white border border-border rounded-xs p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-serif text-charcoal font-semibold">
                      Carnet d'Adresses en Tunisie
                    </h2>
                    <p className="text-xs text-charcoal-500 mt-0.5 sm:mt-1">
                      Gérez vos adresses de livraison pré-remplies pour les commandes en ligne
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddressModalOpen(true)}
                    className="w-full sm:w-auto justify-center flex items-center gap-1.5 bg-charcoal text-white text-xs font-semibold px-4 py-2.5 sm:py-2 rounded-xs hover:bg-charcoal-600 transition"
                  >
                    <Plus size={14} /> Nouvelle Adresse
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {addresses.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-charcoal-400">
                      <MapPin size={36} className="mx-auto mb-2 text-charcoal-300 stroke-1" />
                      <p className="text-sm">Aucune adresse enregistrée</p>
                    </div>
                  ) : (
                    addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="border border-border rounded-xs p-4 bg-white relative space-y-1.5"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-xs uppercase text-charcoal">
                            {addr.title}
                          </span>
                          <button
                            onClick={() => handleDeleteAddress(addr.id)}
                            aria-label="Supprimer l'adresse"
                            className="text-charcoal-400 hover:text-red-600 p-1.5 rounded-xs hover:bg-red-50 transition"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-charcoal">{addr.full_name}</p>
                        <p className="text-xs text-charcoal-600 font-mono">{addr.phone}</p>
                        <p className="text-xs text-charcoal-600">{addr.address_line}</p>
                        <p className="text-xs text-charcoal-600">
                          {addr.city}, {addr.governorate} {addr.postal_code}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Profile & Security */}
            {activeTab === 'profile' && (
              <div className="bg-white border border-border rounded-xs p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-6">
                <div className="border-b border-border pb-4">
                  <h2 className="text-base sm:text-lg font-serif text-charcoal font-semibold">
                    Mon Profil & Sécurité
                  </h2>
                  <p className="text-xs text-charcoal-500 mt-0.5 sm:mt-1">
                    Informations personnelles et authentification
                  </p>
                </div>

                <div className="w-full max-w-md space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-charcoal-700 mb-1">
                      Nom Complet
                    </label>
                    <input
                      type="text"
                      disabled
                      value={userProfile?.full_name || ''}
                      className="w-full text-xs p-3 border rounded-xs bg-cream-50 text-charcoal font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-charcoal-700 mb-1">
                      Adresse Email
                    </label>
                    <input
                      type="email"
                      disabled
                      value={currentUser?.email || ''}
                      className="w-full text-xs p-3 border rounded-xs bg-cream-50 text-charcoal font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-charcoal-700 mb-1">
                      Rôle de compte
                    </label>
                    <input
                      type="text"
                      disabled
                      value={userProfile?.role || 'client'}
                      className="w-full text-xs p-3 border rounded-xs bg-cream-50 font-mono text-charcoal"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Address Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-lg sm:rounded-xs border border-border p-5 sm:p-6 w-full sm:max-w-md shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-serif font-bold text-base sm:text-lg text-charcoal">
                Ajouter une Adresse de Livraison
              </h3>
              <button
                onClick={() => setIsAddressModalOpen(false)}
                className="text-charcoal-400 hover:text-charcoal p-1 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-bold text-charcoal uppercase mb-1">
                  Intitulé (ex: Domicile, Bureau)
                </label>
                <input
                  type="text"
                  required
                  value={newAddress.title}
                  onChange={(e) => setNewAddress({ ...newAddress, title: e.target.value })}
                  className="w-full p-2.5 border rounded-xs text-sm sm:text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal uppercase mb-1">
                  Nom et Prénom
                </label>
                <input
                  type="text"
                  required
                  value={newAddress.full_name}
                  onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                  className="w-full p-2.5 border rounded-xs text-sm sm:text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal uppercase mb-1">
                  Téléphone (Tunisie)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+216 ..."
                  value={newAddress.phone}
                  onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                  className="w-full p-2.5 border rounded-xs font-mono text-sm sm:text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal uppercase mb-1">
                  Adresse (Rue, Immeuble, Appartement)
                </label>
                <input
                  type="text"
                  required
                  value={newAddress.address_line}
                  onChange={(e) => setNewAddress({ ...newAddress, address_line: e.target.value })}
                  className="w-full p-2.5 border rounded-xs text-sm sm:text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-charcoal uppercase mb-1">Ville</label>
                  <input
                    type="text"
                    required
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    className="w-full p-2.5 border rounded-xs text-sm sm:text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-charcoal uppercase mb-1">
                    Gouvernorat
                  </label>
                  <input
                    type="text"
                    required
                    value={newAddress.governorate}
                    onChange={(e) => setNewAddress({ ...newAddress, governorate: e.target.value })}
                    className="w-full p-2.5 border rounded-xs text-sm sm:text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-charcoal uppercase mb-1">Code Postal</label>
                <input
                  type="text"
                  value={newAddress.postal_code}
                  onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                  className="w-full p-2.5 border rounded-xs text-sm sm:text-xs font-mono"
                  placeholder="ex: 1053"
                />
              </div>

              <div className="pt-4 border-t flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 border rounded-xs hover:bg-cream transition text-center font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-charcoal text-white px-5 py-2.5 rounded-xs font-bold hover:bg-charcoal-600 transition text-center"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
