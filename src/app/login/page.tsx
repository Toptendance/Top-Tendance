'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/utils/supabaseClient';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Veuillez renseigner votre email et mot de passe', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      showToast('Connexion réussie ! Bienvenue sur Top Tendance.', 'success');

      // Fetch user role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      const userRole = profile?.role;

      router.refresh();
      if (redirectTo) {
        router.push(redirectTo);
      } else if (userRole === 'manager') {
        router.push('/inventory');
      } else if (userRole === 'cashier') {
        router.push('/pos');
      } else {
        router.push('/account');
      }
    } catch (err: any) {
      showToast(err.message || 'Identifiants incorrects', 'error');
      setLoading(false);
    }
  };

  return (
    <div className="bg-cream min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white border border-border p-8 rounded-xs shadow-xs">
        <div className="text-center mb-8">
          <span className="text-[11px] uppercase tracking-widest font-semibold text-charcoal-500">
            Espace Client
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif text-charcoal mt-1">Connexion</h1>
          <p className="text-xs text-charcoal-600 mt-2">
            Accédez à vos commandes, adresses et avantages fidélité.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1.5">
              Adresse Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yasmine@example.tn"
                className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-cream/40 border border-border rounded-xs focus:border-charcoal focus:outline-hidden transition"
              />
              <Mail className="absolute right-3 top-3 w-4 h-4 text-charcoal-400" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700">
                Mot de Passe
              </label>
              <a href="#" className="text-[11px] text-charcoal-500 hover:underline">
                Oublié ?
              </a>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-cream/40 border border-border rounded-xs focus:border-charcoal focus:outline-hidden transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-charcoal-400 hover:text-charcoal"
                aria-label="Afficher/masquer le mot de passe"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>


          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-charcoal text-white text-xs uppercase tracking-widest font-semibold hover:bg-charcoal-800 disabled:opacity-50 transition rounded-xs flex items-center justify-center gap-2"
          >
            <Lock className="w-3.5 h-3.5" />
            {loading ? 'Connexion en cours...' : 'Se Connecter'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-xs text-charcoal-600">
            Nouveau chez Top Tendance ?{' '}
            <Link
              href="/register"
              className="font-semibold text-charcoal hover:underline inline-flex items-center gap-1"
            >
              Créer un compte <ArrowRight className="w-3 h-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center">Chargement...</div>}>
      <LoginForm />
    </Suspense>
  );
}
