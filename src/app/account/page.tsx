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

  const initials = userProfile?.full_name
    ? userProfile.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'CL';

  return (
    <div className="bg-cream min-h-screen py-8 sm:py-12 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Welcome Header */}
        <div className="bg-white border border-border rounded-xs p-6 sm:p-8 mb-8 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-cream flex items-center justify-center text-charcoal font-serif text-xl border border-border font-bold">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-serif text-charcoal font-semibold">
                  Bonjour, {userProfile?.full_name || currentUser?.email?.split('@')[0]}
                </h1>
                <span className="text-[10px] bg-charcoal text-white px-2 py-0.5 rounded uppercase font-semibold">
                  Membre Top Tendance
                </span>
              </div>
              <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
                Bienvenue dans votre espace client personnel
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs uppercase tracking-wider text-charcoal-600 hover:text-charcoal border border-border px-4 py-2 rounded-xs hover:bg-cream transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Tabs */}
          <div className="lg:col-span-1 space-y-2">
            <div className="bg-white border border-border rounded-xs p-3 shadow-xs space-y-1">
              <button
                onClick={() => setActiveTab('orders')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xs text-xs uppercase tracking-wider font-semibold transition ${
                  activeTab === 'orders'
                    ? 'bg-charcoal text-white'
                    : 'text-charcoal hover:bg-cream'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4" />
                  <span>Commandes En Ligne</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActiveTab('store_purchases')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xs text-xs uppercase tracking-wider font-semibold transition ${
                  activeTab === 'store_purchases'
                    ? 'bg-charcoal text-white'
                    : 'text-charcoal hover:bg-cream'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Store className="w-4 h-4" />
                  <span>Achats En Boutique</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActiveTab('addresses')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xs text-xs uppercase tracking-wider font-semibold transition ${
                  activeTab === 'addresses'
                    ? 'bg-charcoal text-white'
                    : 'text-charcoal hover:bg-cream'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4" />
                  <span>Mes Adresses</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xs text-xs uppercase tracking-wider font-semibold transition ${
                  activeTab === 'profile'
                    ? 'bg-charcoal text-white'
                    : 'text-charcoal hover:bg-cream'
                }`}
              >
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4" />
                  <span>Profil & Sécurité</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>

              <Link
                href="/wishlist"
                className="w-full flex items-center justify-between px-4 py-3 rounded-xs text-xs uppercase tracking-wider font-semibold text-charcoal hover:bg-cream transition"
              >
                <div className="flex items-center gap-3">
                  <Heart className="w-4 h-4" />
                  <span>Mes Favoris ({wishlistCount})</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Main Tab Content */}
          <div className="lg:col-span-3">
            {/* Tab 1: Online Orders */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="bg-white border border-border rounded-xs p-6 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
                    <div>
                      <h2 className="text-lg font-serif text-charcoal font-semibold">
                        Historique des Commandes en Ligne
                      </h2>
                      <p className="text-xs text-charcoal-500 mt-1">
                        Consultez le statut de vos livraisons et téléchargez vos factures
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {onlineOrders.map((order) => (
                      <div
                        key={order.id}
                        className="border border-border rounded-xs p-5 hover:border-charcoal transition bg-white"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/60 gap-3">
                          <div>
                            <span className="font-mono text-xs font-bold text-charcoal">
                              Réf: {order.id}
                            </span>
                            <span className="text-charcoal-400 text-xs ml-3 font-medium">
                              {order.date}
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border w-fit ${order.statusColor}`}
                          >
                            {order.statusLabel}
                          </span>
                        </div>

                        <div className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                            <p className="text-sm font-semibold text-charcoal">
                              {order.itemsPreview}
                            </p>
                            <p className="text-xs text-charcoal-500 mt-1">
                              Adresse: {order.deliveryAddress}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-charcoal-500">Total payé:</p>
                            <p className="text-lg font-serif font-bold text-charcoal">
                              {formatPrice(order.total)}
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-border/60 flex justify-end gap-3 text-xs">
                          <button
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-xs text-charcoal hover:bg-cream transition font-medium"
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
              <div className="bg-white border border-border rounded-xs p-6 shadow-xs space-y-6">
                <div className="border-b border-border pb-4">
                  <h2 className="text-lg font-serif text-charcoal font-semibold">
                    Mes Achats en Boutique (Caisse POS)
                  </h2>
                  <p className="text-xs text-charcoal-500 mt-1">
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
                  <div className="space-y-4">
                    {storePurchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="border border-border rounded-xs p-5 bg-white space-y-3"
                      >
                        <div className="flex justify-between items-center pb-2 border-b">
                          <div>
                            <span className="font-mono text-xs font-bold text-charcoal">
                              Ticket #{purchase.id.slice(0, 8)}
                            </span>
                            <span className="text-xs text-charcoal-400 ml-2">
                              {new Date(purchase.created_at).toLocaleString('fr-TN')}
                            </span>
                          </div>
                          <span className="text-xs bg-gray-100 text-charcoal-700 px-2 py-0.5 rounded uppercase font-semibold">
                            {purchase.payment_method}
                          </span>
                        </div>

                        <div className="text-xs space-y-1 text-charcoal-700">
                          {purchase.sale_items?.map((it: any) => (
                            <div key={it.id} className="flex justify-between">
                              <span>
                                {it.quantity}x {it.variant?.sku}
                              </span>
                              <span className="font-mono font-medium">
                                {Number(it.subtotal).toFixed(3)} DT
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t flex justify-between items-baseline font-bold text-sm">
                          <span>Total Réglé:</span>
                          <span className="font-mono">{Number(purchase.final_amount).toFixed(3)} DT</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Shipping Addresses */}
            {activeTab === 'addresses' && (
              <div className="bg-white border border-border rounded-xs p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h2 className="text-lg font-serif text-charcoal font-semibold">
                      Carnet d'Adresses en Tunisie
                    </h2>
                    <p className="text-xs text-charcoal-500 mt-1">
                      Gérez vos adresses de livraison pré-remplies pour les commandes en ligne
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddressModalOpen(true)}
                    className="flex items-center gap-1.5 bg-charcoal text-white text-xs font-semibold px-3 py-2 rounded-xs hover:bg-charcoal-600 transition"
                  >
                    <Plus size={14} /> Nouvelle Adresse
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.length === 0 ? (
                    <div className="col-span-2 text-center py-10 text-charcoal-400">
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
                            className="text-charcoal-400 hover:text-red-600 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-charcoal">{addr.full_name}</p>
                        <p className="text-xs text-charcoal-600">{addr.phone}</p>
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
              <div className="bg-white border border-border rounded-xs p-6 shadow-xs space-y-6">
                <div className="border-b border-border pb-4">
                  <h2 className="text-lg font-serif text-charcoal font-semibold">
                    Mon Profil & Sécurité
                  </h2>
                  <p className="text-xs text-charcoal-500 mt-1">
                    Informations personnelles et authentification
                  </p>
                </div>

                <div className="max-w-md space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-charcoal-700 mb-1">
                      Nom Complet
                    </label>
                    <input
                      type="text"
                      disabled
                      value={userProfile?.full_name || ''}
                      className="w-full text-xs p-2.5 border rounded-xs bg-cream-50 text-charcoal font-medium"
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
                      className="w-full text-xs p-2.5 border rounded-xs bg-cream-50 text-charcoal font-medium"
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
                      className="w-full text-xs p-2.5 border rounded-xs bg-cream-50 font-mono text-charcoal"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xs border border-border p-6 max-w-md w-full shadow-2xl">
            <h3 className="font-serif font-bold text-lg text-charcoal pb-3 border-b border-border">
              Ajouter une Adresse de Livraison
            </h3>

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
                  className="w-full p-2 border rounded-xs"
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
                  className="w-full p-2 border rounded-xs"
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
                  className="w-full p-2 border rounded-xs font-mono"
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
                  className="w-full p-2 border rounded-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-charcoal uppercase mb-1">Ville</label>
                  <input
                    type="text"
                    required
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    className="w-full p-2 border rounded-xs"
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
                    className="w-full p-2 border rounded-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-4 py-2 border rounded-xs hover:bg-cream transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bg-charcoal text-white px-5 py-2 rounded-xs font-bold hover:bg-charcoal-600 transition"
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
