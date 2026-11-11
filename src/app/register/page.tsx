'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/utils/supabaseClient';

export default function RegisterPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeTerms: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      const redirectUrl = `${window.location.origin}/auth/callback?next=/account`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la connexion Google', 'error');
      setGoogleLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.password) {
      showToast('Veuillez remplir tous les champs obligatoires.', 'error');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showToast('Les mots de passe ne correspondent pas.', 'error');
      return;
    }

    if (formData.password.length < 6) {
      showToast('Le mot de passe doit comporter au moins 6 caractères.', 'error');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      showToast('Compte créé avec succès ! Bienvenue chez Top Tendance.', 'success');
      router.push('/account');
    }, 1000);
  };

  return (
    <div className="bg-cream min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white border border-border p-8 rounded-xs shadow-xs">
        <div className="text-center mb-8">
          <span className="text-[11px] uppercase tracking-widest font-semibold text-charcoal-500">
            Rejoignez-nous
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif text-charcoal mt-1">Créer un Compte</h1>
          <p className="text-xs text-charcoal-600 mt-2">
            Profitez de -10% sur votre première commande et suivez vos achats.
          </p>
        </div>

        <div className="mb-6">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full py-3 px-4 bg-white border border-border hover:border-charcoal text-charcoal text-xs uppercase tracking-wider font-semibold rounded-xs transition shadow-2xs hover:shadow-xs flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{googleLoading ? 'Inscription en cours...' : "S'inscrire avec Google"}</span>
          </button>

          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-white px-3 text-[11px] text-charcoal-400 uppercase tracking-widest font-medium">
              ── ou avec votre email ──
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1.5">
                Prénom *
              </label>
              <input
                type="text"
                name="firstName"
                required
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Ex: Yasmine"
                className="w-full px-3 py-2 text-sm bg-cream/40 border border-border rounded-xs focus:border-charcoal focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1.5">
                Nom *
              </label>
              <input
                type="text"
                name="lastName"
                required
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Ex: Trabelsi"
                className="w-full px-3 py-2 text-sm bg-cream/40 border border-border rounded-xs focus:border-charcoal focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1.5">
              Adresse Email *
            </label>
            <div className="relative">
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="yasmine@example.tn"
                className="w-full pl-3.5 pr-10 py-2 text-sm bg-cream/40 border border-border rounded-xs focus:border-charcoal focus:outline-hidden"
              />
              <Mail className="absolute right-3 top-2.5 w-4 h-4 text-charcoal-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1.5">
              Numéro de téléphone (+216) *
            </label>
            <div className="relative">
              <input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="Ex: 98 123 456"
                className="w-full pl-3.5 pr-10 py-2 text-sm bg-cream/40 border border-border rounded-xs focus:border-charcoal focus:outline-hidden"
              />
              <Phone className="absolute right-3 top-2.5 w-4 h-4 text-charcoal-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1.5">
              Mot de Passe *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="Au moins 6 caractères"
                className="w-full pl-3.5 pr-10 py-2 text-sm bg-cream/40 border border-border rounded-xs focus:border-charcoal focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-charcoal-400 hover:text-charcoal"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1.5">
              Confirmer le Mot de Passe *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Répétez votre mot de passe"
              className="w-full px-3.5 py-2 text-sm bg-cream/40 border border-border rounded-xs focus:border-charcoal focus:outline-hidden"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-2 cursor-pointer text-xs text-charcoal-600">
              <input
                type="checkbox"
                name="agreeTerms"
                checked={formData.agreeTerms}
                onChange={handleChange}
                className="mt-0.5 rounded-xs border-border text-charcoal focus:ring-charcoal"
              />
              <span>J&apos;accepte les conditions générales de vente et la politique de confidentialité.</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3.5 bg-charcoal text-white text-xs uppercase tracking-widest font-semibold hover:bg-charcoal-800 disabled:opacity-50 transition rounded-xs flex items-center justify-center gap-2"
          >
            {loading ? 'Création en cours...' : 'Créer Mon Compte'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-xs text-charcoal-600">
            Déjà inscrit ?{' '}
            <Link
              href="/login"
              className="font-semibold text-charcoal hover:underline inline-flex items-center gap-1"
            >
              Se connecter <ArrowRight className="w-3 h-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

