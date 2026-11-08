'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, CheckCircle2, Phone, MapPin, Truck, ShieldCheck, RefreshCw } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

export function Footer() {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { showToast } = useToast();

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      showToast('Veuillez entrer une adresse email valide', 'error');
      return;
    }
    setIsSubscribed(true);
    showToast('Merci ! Vous recevrez 10% de réduction par email.', 'success');
    setEmail('');
  };

  return (
    <footer className="bg-cream text-charcoal border-t border-border mt-auto">
      {/* Guarantees Strip */}
      <div className="border-b border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-4">
              <div className="w-12 h-12 rounded-full bg-cream flex items-center justify-center text-charcoal shrink-0">
                <Truck className="w-6 h-6 stroke-[1.5]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-charcoal uppercase tracking-wider font-sans">
                  Livraison 24/48h en Tunisie
                </h4>
                <p className="text-xs text-charcoal-500 mt-0.5">
                  Partout en Tunisie, offerte dès 200 TND d'achat
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center md:justify-start gap-4">
              <div className="w-12 h-12 rounded-full bg-cream flex items-center justify-center text-charcoal shrink-0">
                <RefreshCw className="w-6 h-6 stroke-[1.5]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-charcoal uppercase tracking-wider font-sans">
                  Échanges & Retours 14 Jours
                </h4>
                <p className="text-xs text-charcoal-500 mt-0.5">
                  Procédure simple et retour sans tracas
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center md:justify-start gap-4">
              <div className="w-12 h-12 rounded-full bg-cream flex items-center justify-center text-charcoal shrink-0">
                <ShieldCheck className="w-6 h-6 stroke-[1.5]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-charcoal uppercase tracking-wider font-sans">
                  Paiement à la Livraison
                </h4>
                <p className="text-xs text-charcoal-500 mt-0.5">
                  Réglez en espèces directement auprès du livreur
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Presentation */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              <span className="font-serif text-2xl tracking-[0.2em] font-medium text-charcoal">
                Top Tendance
              </span>
            </Link>
            <p className="text-xs leading-relaxed text-charcoal-600 max-w-sm">
              Maison de prêt-à-porter tunisienne célébrant l'élégance naturelle de la femme
              et la douceur poétique de l'enfance. Des matières nobles, des coupes intemporelles
              et un savoir-faire soigné.
            </p>
            <div className="space-y-1.5 pt-2 text-xs text-charcoal-600">
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-charcoal-400 shrink-0" />
                <span>Boutique : Rue El Hidaya, Ariana, Tunisie</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-charcoal-400 shrink-0" />
                <span>Service client : +216 52 293 651 (Lun - Sam, 9h-19h)</span>
              </p>
            </div>

            {/* Social Links */}
            <div className="pt-2">
              <span className="block text-xs font-medium text-charcoal mb-2">Suivez-nous :</span>
              <div className="flex items-center gap-3">
                <a
                  href="https://www.facebook.com/clothstoretoptendance"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Suivez Top Tendance sur Facebook"
                  className="w-8 h-8 rounded-full border border-border bg-white flex items-center justify-center text-charcoal hover:bg-charcoal hover:text-white hover:border-charcoal transition-colors duration-200"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a
                  href="https://www.instagram.com/toptendanceofficial/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Suivez Top Tendance sur Instagram"
                  className="w-8 h-8 rounded-full border border-border bg-white flex items-center justify-center text-charcoal hover:bg-charcoal hover:text-white hover:border-charcoal transition-colors duration-200"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                <a
                  href="https://www.pinterest.com/rabaatoptendance/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Suivez Top Tendance sur Pinterest"
                  className="w-8 h-8 rounded-full border border-border bg-white flex items-center justify-center text-charcoal hover:bg-charcoal hover:text-white hover:border-charcoal transition-colors duration-200"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0a12 12 0 0 0-4.37 23.18c-.05-.98-.09-2.48.02-3.55.1-.96.67-5.74.67-5.74s-.17-.34-.17-.86c0-.8.47-1.4 1.05-1.4.5 0 .74.37.74.82 0 .5-.32 1.25-.48 1.95-.14.58.29 1.05.86 1.05 1.03 0 1.83-1.09 1.83-2.66 0-1.39-1-2.37-2.43-2.37-1.66 0-2.63 1.24-2.63 2.53 0 .5.19 1.04.43 1.33.05.06.05.11.04.17-.04.18-.14.57-.16.65-.03.1-.09.12-.17.08-1.12-.52-1.82-2.15-1.82-3.46 0-2.82 2.05-5.41 5.91-5.41 3.1 0 5.51 2.21 5.51 5.16 0 3.08-1.94 5.56-4.64 5.56-.91 0-1.76-.47-2.05-1.03l-.56 2.13c-.2.78-.75 1.76-1.12 2.36A11.996 11.996 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Shop Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-charcoal font-sans">
              Boutique
            </h4>
            <ul className="space-y-2 text-xs text-charcoal-600">
              <li>
                <Link href="/women" className="hover:text-charcoal transition">
                  Collection Femme
                </Link>
              </li>
              <li>
                <Link href="/kids" className="hover:text-charcoal transition">
                  Collection Enfant
                </Link>
              </li>
              <li>
                <Link href="/kids?ageGroup=0-12m" className="hover:text-charcoal transition">
                  Bébé & Naissance (0-12m)
                </Link>
              </li>
              <li>
                <Link href="/search?tag=new" className="hover:text-charcoal transition">
                  Nouveautés de Saison
                </Link>
              </li>
              <li>
                <Link href="/search?tag=bestseller" className="hover:text-charcoal transition">
                  Meilleures Ventes
                </Link>
              </li>
            </ul>
          </div>

          {/* Help & Services */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-charcoal font-sans">
              Aide & Services
            </h4>
            <ul className="space-y-2 text-xs text-charcoal-600">
              <li>
                <Link href="/shipping-returns" className="hover:text-charcoal transition">
                  Livraison & Retours
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-charcoal transition">
                  À Propos de la Marque
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-charcoal transition">
                  Contact & Assistance
                </Link>
              </li>
              <li>
                <Link href="/account" className="hover:text-charcoal transition">
                  Suivi de Commande
                </Link>
              </li>
              <li>
                <Link href="/wishlist" className="hover:text-charcoal transition">
                  Ma Liste d'Envies
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Box */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-charcoal font-sans">
              Newsletter
            </h4>
            <p className="text-xs text-charcoal-600">
              Inscrivez-vous pour bénéficier de <strong>-10%</strong> sur votre première commande et
              accéder à nos ventes privées.
            </p>
            {isSubscribed ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Inscription confirmée !</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletter} className="space-y-2">
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Votre adresse email"
                    required
                    className="w-full bg-white border border-border py-2.5 pl-3 pr-9 text-xs text-charcoal placeholder-charcoal-400 focus:outline-hidden focus:border-charcoal transition"
                  />
                  <Mail className="absolute right-3 top-3 w-4 h-4 text-charcoal-400" />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-charcoal text-white text-xs uppercase tracking-widest font-medium hover:bg-charcoal-800 transition"
                >
                  S'inscrire
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Bar: Payments & Copyright */}
        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-charcoal-500">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <p>© {new Date().getFullYear()} Top Tendance Tunisie. Tous droits réservés.</p>
            <span className="hidden sm:inline text-gray-300">•</span>
            <Link
              href="/pos"
              className="text-charcoal-400 hover:text-charcoal transition underline-offset-2 hover:underline text-[11px]"
            >
              Espace Personnel & Caisse (POS)
            </Link>
          </div>

          {/* Payment badges */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-[11px] font-medium mr-1 text-charcoal-600">Moyens de paiement :</span>
            <span className="px-2.5 py-1 bg-white border border-border rounded text-[10px] font-semibold tracking-wider text-charcoal">
              PAIEMENT À LA LIVRAISON
            </span>
            <span className="px-2.5 py-1 bg-white border border-border rounded text-[10px] font-semibold tracking-wider text-charcoal">
              CARTE BANCAIRE
            </span>
            <span className="px-2.5 py-1 bg-white border border-border rounded text-[10px] font-semibold tracking-wider text-charcoal">
              E-DINAR
            </span>
            <span className="px-2.5 py-1 bg-white border border-border rounded text-[10px] font-semibold tracking-wider text-charcoal">
              KONNECT
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

