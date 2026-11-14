'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  ChevronRight,
  Heart,
  User,
  Sparkles,
  Flame,
  HelpCircle,
  CreditCard,
  Boxes,
  TrendingUp,
  LogOut,
  BookOpen,
  Truck
} from 'lucide-react';
import { useWishlist } from '@/context/WishlistContext';
import { supabase } from '@/utils/supabaseClient';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const [activeTab, setActiveTab] = useState<'women' | 'kids'>('women');
  const { wishlistCount } = useWishlist();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  const isStaff = userProfile?.role === 'manager' || userProfile?.role === 'cashier';

  useEffect(() => {
    async function loadAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setUserProfile(profile);
      }
    }
    loadAuth();
  }, [isOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUserProfile(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu principal">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-charcoal/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <aside className="fixed inset-y-0 left-0 w-full max-w-xs bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <Link
            href="/"
            onClick={onClose}
            className="font-serif text-lg tracking-wider font-semibold text-charcoal"
          >
            TOP TENDANCE
          </Link>
          <button
            onClick={onClose}
            className="p-2 text-charcoal-500 hover:text-charcoal hover:bg-cream rounded transition"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Switcher Tabs - Customer / Guest Only */}
        {!isStaff && (
          <div className="grid grid-cols-2 border-b border-border text-center text-xs font-semibold tracking-wider uppercase">
            <button
              onClick={() => setActiveTab('women')}
              className={`py-3.5 transition-colors border-b-2 ${
                activeTab === 'women'
                  ? 'border-charcoal text-charcoal bg-white font-bold'
                  : 'border-transparent text-charcoal-500 bg-cream-50 hover:text-charcoal'
              }`}
            >
              Femme
            </button>
            <button
              onClick={() => setActiveTab('kids')}
              className={`py-3.5 transition-colors border-b-2 ${
                activeTab === 'kids'
                  ? 'border-kids-peach text-kids-peach bg-kids-peach-light/40 font-bold'
                  : 'border-transparent text-charcoal-500 bg-cream-50 hover:text-charcoal'
              }`}
            >
              Enfant
            </button>
          </div>
        )}

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {/* Staff Workspace Menu (For Manager & Cashier on phone) */}
          {isStaff ? (
            <div className="p-4 space-y-3">
              {/* Staff Header Badge */}
              <div className="p-3 bg-cream-50 border border-border/80 rounded-xl">
                <p className="font-bold text-sm text-charcoal truncate">
                  {userProfile?.full_name || currentUser?.email || 'Membre Équipe'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <p className="text-xs font-medium text-charcoal-600">
                    {userProfile?.role === 'manager'
                      ? '👑 Responsable Boutique'
                      : '💼 Caissier'}
                  </p>
                </div>
              </div>

              {/* Staff Operations Links */}
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] uppercase font-semibold text-charcoal-400 tracking-widest px-1">
                  Espace Gestion & Caisse
                </p>
                <Link
                  href="/pos"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3.5 py-3 text-sm font-semibold text-charcoal bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 rounded-xl transition"
                >
                  <CreditCard className="w-5 h-5 text-amber-700" />
                  <div className="flex-1">
                    <div className="leading-tight">Caisse Enregistreuse (POS)</div>
                    <div className="text-[11px] text-charcoal-500 font-normal">Encaissement & Ventes</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-charcoal-400" />
                </Link>

                <Link
                  href="/inventory"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3.5 py-3 text-sm font-semibold text-charcoal hover:bg-cream border border-border/60 rounded-xl transition"
                >
                  <Boxes className="w-5 h-5 text-charcoal-700" />
                  <div className="flex-1">
                    <div className="leading-tight">Gestion Stock & Boutique</div>
                    <div className="text-[11px] text-charcoal-500 font-normal">Articles, Prix & Codes-barres</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-charcoal-400" />
                </Link>

                <Link
                  href="/inventory?tab=credit"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3.5 py-3 text-sm font-semibold text-charcoal hover:bg-cream border border-border/60 rounded-xl transition"
                >
                  <BookOpen className="w-5 h-5 text-charcoal-700" />
                  <div className="flex-1">
                    <div className="leading-tight">Carnet de Crédit</div>
                    <div className="text-[11px] text-charcoal-500 font-normal">Dettes & Règlements clients</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-charcoal-400" />
                </Link>

                <Link
                  href="/inventory?tab=shipping"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3.5 py-3 text-sm font-semibold text-charcoal hover:bg-cream border border-border/60 rounded-xl transition"
                >
                  <Truck className="w-5 h-5 text-charcoal-700" />
                  <div className="flex-1">
                    <div className="leading-tight">Colis & Livraisons</div>
                    <div className="text-[11px] text-charcoal-500 font-normal">Bordereaux & Suivi expéditions</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-charcoal-400" />
                </Link>

                <Link
                  href="/reports"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3.5 py-3 text-sm font-semibold text-charcoal hover:bg-cream border border-border/60 rounded-xl transition"
                >
                  <TrendingUp className="w-5 h-5 text-charcoal-700" />
                  <div className="flex-1">
                    <div className="leading-tight">Rapports & Ventes</div>
                    <div className="text-[11px] text-charcoal-500 font-normal">Chiffre du jour & Statistiques</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-charcoal-400" />
                </Link>
              </div>

              {/* Staff Logout */}
              <div className="pt-3 border-t border-border">
                <button
                  onClick={handleLogout}
                  className="w-full text-left flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition"
                >
                  <LogOut className="w-4 h-4 text-red-600" />
                  <span>Se déconnecter</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'women' ? (
                <div className="p-4 space-y-1">
                  <p className="text-[10px] uppercase font-semibold text-charcoal-400 tracking-widest px-3 py-1">
                    Catégories Femme
                  </p>
                  <Link
                    href="/women"
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-charcoal hover:bg-cream transition"
                  >
                    <span>Tout Voir en Femme</span>
                    <ChevronRight className="w-4 h-4 text-charcoal-400" />
                  </Link>
                  <Link
                    href="/women?subcategory=Robes"
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2 text-sm text-charcoal-700 hover:bg-cream transition"
                  >
                    <span>Robes & Combinaisons</span>
                  </Link>
                  <Link
                    href="/women?subcategory=Vestes & Manteaux"
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2 text-sm text-charcoal-700 hover:bg-cream transition"
                  >
                    <span>Vestes, Blazers & Manteaux</span>
                  </Link>
                  <Link
                    href="/women?subcategory=Pulls & Mailles"
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2 text-sm text-charcoal-700 hover:bg-cream transition"
                  >
                    <span>Pulls & Cachemires</span>
                  </Link>
                  <Link
                    href="/women?subcategory=Chemises & Blouses"
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2 text-sm text-charcoal-700 hover:bg-cream transition"
                  >
                    <span>Chemises en Soie & Lin</span>
                  </Link>
                  <Link
                    href="/women?subcategory=Pantalons"
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2 text-sm text-charcoal-700 hover:bg-cream transition"
                  >
                    <span>Pantalons & Ensembles</span>
                  </Link>
                </div>
              ) : (
                <div className="p-4 space-y-1">
                  <p className="text-[10px] uppercase font-semibold text-kids-peach tracking-widest px-3 py-1">
                    Âge d'abord (Kids)
                  </p>
                  <Link
                    href="/kids"
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-charcoal hover:bg-kids-peach-light transition rounded-kids"
                  >
                    <span>Tout l'univers Enfant</span>
                    <ChevronRight className="w-4 h-4 text-charcoal-400" />
                  </Link>
                  <Link
                    href="/kids?ageGroup=0-12m"
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2 text-sm text-charcoal-700 hover:bg-kids-peach-light/40 transition rounded-kids"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-kids-sage" />
                      Bébé & Naissance (0 - 12 mois)
                    </span>
                  </Link>
                  <Link
                    href="/kids?ageGroup=1-3y"
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2 text-sm text-charcoal-700 hover:bg-kids-peach-light/40 transition rounded-kids"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-kids-peach" />
                      Tout-petit (1 - 3 ans)
                    </span>
                  </Link>
                  <Link
                    href="/kids?ageGroup=4-7y"
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2 text-sm text-charcoal-700 hover:bg-kids-peach-light/40 transition rounded-kids"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-kids-sky" />
                      Enfant (4 - 7 ans)
                    </span>
                  </Link>
                  <Link
                    href="/kids?ageGroup=8-12y"
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2 text-sm text-charcoal-700 hover:bg-kids-peach-light/40 transition rounded-kids"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-charcoal" />
                      Junior (8 - 12 ans)
                    </span>
                  </Link>
                </div>
              )}

              {/* Highlights & Specials */}
              <div className="p-4 space-y-1">
                <Link
                  href="/search?tag=new"
                  onClick={onClose}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-charcoal hover:bg-cream transition"
                >
                  <Sparkles className="w-4 h-4 text-kids-peach" />
                  <span>Nouveautés</span>
                </Link>
                <Link
                  href="/search?tag=bestseller"
                  onClick={onClose}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-charcoal hover:bg-cream transition"
                >
                  <Flame className="w-4 h-4 text-sale" />
                  <span>Meilleures Ventes</span>
                </Link>
                <Link
                  href="/wishlist"
                  onClick={onClose}
                  className="flex items-center justify-between px-3 py-2 text-sm font-medium text-charcoal hover:bg-cream transition"
                >
                  <span className="flex items-center gap-2.5">
                    <Heart className="w-4 h-4 text-charcoal" />
                    <span>Mes Favoris</span>
                  </span>
                  {wishlistCount > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-charcoal text-white rounded-full">
                      {wishlistCount}
                    </span>
                  )}
                </Link>
              </div>

              {/* Client services */}
              <div className="p-4 space-y-1 text-xs text-charcoal-600 border-t border-border">
                {currentUser && (
                  <div className="px-3 py-2 bg-cream-50 rounded-lg mb-2">
                    <p className="font-semibold text-charcoal text-xs truncate">
                      {userProfile?.full_name || currentUser.email}
                    </p>
                    <p className="text-[10px] text-charcoal-500 capitalize">
                      Client
                    </p>
                  </div>
                )}

                <Link
                  href="/shipping-returns"
                  onClick={onClose}
                  className="block px-3 py-2 hover:text-charcoal transition"
                >
                  Livraison & Retours en Tunisie
                </Link>
                <Link
                  href="/about"
                  onClick={onClose}
                  className="block px-3 py-2 hover:text-charcoal transition"
                >
                  À Propos de Top Tendance
                </Link>
                <Link
                  href="/contact"
                  onClick={onClose}
                  className="block px-3 py-2 hover:text-charcoal transition"
                >
                  Boutique & Contact (Tunis)
                </Link>

                {!currentUser ? (
                  <Link
                    href="/login"
                    onClick={onClose}
                    className="flex items-center gap-2 px-3 py-2 font-medium text-charcoal hover:underline pt-2"
                  >
                    <User className="w-4 h-4" />
                    <span>Se connecter / S'inscrire</span>
                  </Link>
                ) : (
                  <button
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 font-medium text-red-600 hover:bg-red-50 rounded-lg pt-2 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Se déconnecter</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer info in drawer */}
        <div className="p-4 bg-cream-50 border-t border-border flex items-center justify-between text-xs text-charcoal-600">
          <span>Devise: <strong>TND (Dinar Tunisien)</strong></span>
          <span className="text-[11px] bg-white px-2 py-1 rounded border border-border">
            Tunisie 🇹🇳
          </span>
        </div>
      </aside>
    </div>
  );
}

