import React from 'react';
import Link from 'next/link';
import { Shield, Lock, Eye, FileText, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'Politique de Confidentialité | Top Tendance Tunisie',
  description: 'Découvrez comment Top Tendance protège vos données personnelles conformément à la législation tunisienne et aux standards internationaux.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-cream min-h-screen py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-[0.2em] font-semibold text-charcoal-500 mb-2 block">
            Protection de vos données
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-charcoal mb-3">
            Politique de Confidentialité
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
              <Shield className="w-5 h-5 text-charcoal-600" />
              <h2>1. Introduction & Engagement</h2>
            </div>
            <p>
              La société <strong>Top Tendance</strong> (accessible sur <em>https://toptendance.net</em>) accorde une importance primordiale à la confidentialité et à la protection des données personnelles de ses clients, utilisateurs et visiteurs.
            </p>
            <p>
              La présente Politique de Confidentialité a pour objectif de vous informer de manière claire et transparente sur la façon dont nous recueillons, utilisons, stockons et protégeons vos informations personnelles lors de votre navigation, de la création de votre compte, ou lors de vos achats en ligne et en boutique.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-charcoal font-serif text-lg border-b border-border pb-2">
              <Eye className="w-5 h-5 text-charcoal-600" />
              <h2>2. Données Personnelles Collectées</h2>
            </div>
            <p>Nous pouvons recueillir et traiter les données suivantes :</p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li>
                <strong>Données d'identification et de contact :</strong> Nom, prénom, adresse email, numéro de téléphone tunisien (+216), adresse postale de livraison et gouvernorat.
              </li>
              <li>
                <strong>Authentification Google (OAuth) :</strong> Lorsque vous choisissez la connexion via Google, nous recevons votre identifiant Google, votre nom complet et votre adresse email vérifiée afin de créer ou synchroniser votre compte de manière sécurisée.
              </li>
              <li>
                <strong>Données de commande & facturation :</strong> Historique des achats, articles commandés, préférences de livraison et reçus de caisse.
              </li>
              <li>
                <strong>Données techniques de navigation :</strong> Adresse IP, type de navigateur, cookies de session strictement nécessaires à la navigation et au panier d'achat.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-charcoal font-serif text-lg border-b border-border pb-2">
              <FileText className="w-5 h-5 text-charcoal-600" />
              <h2>3. Finalités du Traitement</h2>
            </div>
            <p>Vos données sont exclusivement utilisées pour :</p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li>Assurer la création et la gestion de votre compte client ou profil membre.</li>
              <li>Traiter, expédier et assurer le suivi de vos commandes partout en Tunisie.</li>
              <li>Faciliter le contact téléphonique pour la confirmation de livraison avec nos transporteurs partenaires (Aramex, etc.).</li>
              <li>Gérer le service après-vente, les échanges d'articles sous 14 jours et les tickets de caisse.</li>
              <li>Améliorer la sécurité de notre plateforme contre les fraudes et abus.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-charcoal font-serif text-lg border-b border-border pb-2">
              <Lock className="w-5 h-5 text-charcoal-600" />
              <h2>4. Sécurité & Partage des Données</h2>
            </div>
            <p>
              <strong>Top Tendance ne vend, ne loue, ni ne cède vos données personnelles à des tiers à des fins publicitaires.</strong>
            </p>
            <p>
              Vos informations sont stockées dans des environnements sécurisés bénéficiant d'un chiffrement moderne (protocoles HTTPS/TLS, contrôle d'accès PostgreSQL via Row Level Security).
            </p>
            <p>
              Le partage de données est strictement restreint aux prestataires techniques indispensables :
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
              <li>Transporteurs et livreurs partenaires : uniquement pour le nom, téléphone et adresse de livraison.</li>
              <li>Fournisseurs d'authentification certifiés (Google Identity Services, Supabase Auth).</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-charcoal font-serif text-lg border-b border-border pb-2">
              <CheckCircle2 className="w-5 h-5 text-charcoal-600" />
              <h2>5. Vos Droits & Contact</h2>
            </div>
            <p>
              Conformément à la Loi Organique n° 2004-63 du 27 juillet 2004 relative à la protection des données à caractère personnel en Tunisie, vous disposez d'un droit d'accès, de rectification, d'opposition et de suppression de vos données personnelles.
            </p>
            <p>
              Pour exercer vos droits ou pour toute question relative à notre politique de confidentialité, vous pouvez nous contacter :
            </p>
            <div className="bg-cream/60 p-4 rounded-xs border border-border/80 text-xs space-y-1">
              <p><strong>Top Tendance Tunisie</strong></p>
              <p>Adresse : Rue El Hidaya, Ariana, Tunisie</p>
              <p>Téléphone : +216 52 293 651</p>
              <p>Email : contact@toptendance.net</p>
            </div>
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

