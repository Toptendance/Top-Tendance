import React from 'react';
import Link from 'next/link';
import { BookOpen, Scale, CreditCard, RotateCcw, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: "Conditions Générales d'Utilisation et de Vente | Top Tendance Tunisie",
  description: "Consultez les Conditions Générales d'Utilisation (CGU) et de Vente (CGV) de Top Tendance Tunisie.",
};

export default function TermsOfServicePage() {
  return (
    <div className="bg-cream min-h-screen py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-[0.2em] font-semibold text-charcoal-500 mb-2 block">
            Cadre Légal & Engagements
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-charcoal mb-3">
            Conditions Générales d'Utilisation & de Vente
          </h1>
          <p className="text-xs sm:text-sm text-charcoal-600">
            Dernière mise à jour : 11 Novembre 2026
          </p>
        </div>

        {/* Content Box */}
        <div className="bg-white border border-border rounded-xs p-6 sm:p-10 shadow-xs space-y-8 text-charcoal-700 leading-relaxed text-sm">
          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-charcoal font-serif text-lg border-b border-border pb-2">
              <BookOpen className="w-5 h-5 text-charcoal-600" />
              <h2>1. Objet & Champ d'Application</h2>
            </div>
            <p>
              Les présentes Conditions Générales d'Utilisation et de Vente (ci-après « CGU / CGV ») régissent les relations contractuelles entre la boutique <strong>Top Tendance</strong>, dont le siège est situé à <em>Rue El Hidaya, Ariana, Tunisie</em>, et toute personne physique ou morale (ci-après le « Client » ou « l'Utilisateur ») navigant ou effectuant un achat sur le site <em>https://toptendance.net</em> ou en boutique physique.
            </p>
            <p>
              Toute commande passée ou création de compte implique l'adhésion entière et sans réserve du Client aux présentes conditions.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-charcoal font-serif text-lg border-b border-border pb-2">
              <Scale className="w-5 h-5 text-charcoal-600" />
              <h2>2. Compte Utilisateur & Authentification</h2>
            </div>
            <p>
              Pour commander en ligne ou accéder aux fonctionnalités de suivi de commande, le Client peut créer un compte utilisateur ou s'authentifier via les services tiers pris en charge (Google OAuth).
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li>Le Client s'engage à fournir des informations véridiques, exactes et à jour (nom, téléphone, adresse).</li>
              <li>Le Client est seul responsable de la confidentialité de ses identifiants de connexion.</li>
              <li>Top Tendance se réserve le droit de suspendre ou clôturer tout compte présentant des agissements frauduleux ou des coordonnées erronées.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-charcoal font-serif text-lg border-b border-border pb-2">
              <CreditCard className="w-5 h-5 text-charcoal-600" />
              <h2>3. Produits, Prix & Moyens de Paiement</h2>
            </div>
            <p>
              Les produits proposés à la vente sont ceux décrits sur le site. Les prix sont affichés en <strong>Dinars Tunisiens (TND / DT)</strong> toutes taxes comprises (TTC).
            </p>
            <p>Top Tendance propose plusieurs modes de règlement sécurisés :</p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li><strong>Paiement à la livraison (Espèces) :</strong> Le client règle la totalité du montant au livreur lors de la réception du colis.</li>
              <li><strong>Paiement en boutique / Caisse POS :</strong> Espèces, carte bancaire ou vente différée selon les accords boutique.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-charcoal font-serif text-lg border-b border-border pb-2">
              <RotateCcw className="w-5 h-5 text-charcoal-600" />
              <h2>4. Expédition, Livraison & Droit d'Échange</h2>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li>
                <strong>Délais de livraison :</strong> 24h à 48h ouvrables sur le Grand Tunis, et 48h à 72h ouvrables sur les autres gouvernorats de la Tunisie.
              </li>
              <li>
                <strong>Frais de port :</strong> Tarif standard de 7.000 DT, offerts pour toute commande égale ou supérieure à 200.000 DT.
              </li>
              <li>
                <strong>Droit d'échange sous 14 jours :</strong> Tout article non porté, non lavé, muni de ses étiquettes d'origine et du reçu de vente peut être échangé sous 14 jours suivant la réception.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-charcoal font-serif text-lg border-b border-border pb-2">
              <ShieldCheck className="w-5 h-5 text-charcoal-600" />
              <h2>5. Propriété Intellectuelle & Litiges</h2>
            </div>
            <p>
              Tous les éléments du site (photographies, textes, charte graphique, logo « Top Tendance ») sont protégés par le droit de la propriété intellectuelle en Tunisie. Toute reproduction sans autorisation préalable est interdite.
            </p>
            <p>
              Les présentes conditions sont soumises au droit tunisien. En cas de litige, une solution amiable sera recherchée en priorité avant tout recours devant les tribunaux compétents de l'Ariana / Tunis.
            </p>
          </section>
        </div>

        {/* Back link */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="text-xs uppercase tracking-wider font-semibold text-charcoal hover:underline"
          >
            ← Retour à l'accueil Top Tendance
          </Link>
        </div>
      </div>
    </div>
  );
}

