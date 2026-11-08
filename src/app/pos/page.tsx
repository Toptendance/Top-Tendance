'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { playBeep } from '@/utils/posAudio';
import PaymentDrawer from '@/components/pos/PaymentDrawer';
import ProductSearchDrawer from '@/components/pos/ProductSearchDrawer';
import ReceiptModal from '@/components/pos/ReceiptModal';
import {
  Barcode,
  Search,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  LogOut,
  User,
  ShoppingBag,
  AlertCircle
} from 'lucide-react';

interface CartItem {
  variant_id: string;
  sku: string;
  name: string;
  size: string | null;
  color: string | null;
  unit_price: number;
  quantity: number;
  stock_quantity: number;
}

export default function PosPage() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // POS Scanner & Cart state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartError, setCartError] = useState<string | null>(null);

  // Drawers and Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<any>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const lastScanTimeRef = useRef<number>(0);

  // Check auth status
  useEffect(() => {
    async function loadAuth() {
      setIsAuthLoading(true);
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
      setIsAuthLoading(false);
    }
    loadAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setUserProfile(profile);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Persistent focus on scanner input
  useEffect(() => {
    if (currentUser && !isSearchOpen && !isPaymentOpen && !completedReceipt) {
      const timer = setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentUser, isSearchOpen, isPaymentOpen, completedReceipt]);

  // Global hotkeys handler (F2 focus, F9 pay, Esc close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && !isPaymentOpen) {
          setIsPaymentOpen(true);
        }
      } else if (e.key === 'Escape') {
        if (isSearchOpen) setIsSearchOpen(false);
        if (isPaymentOpen) setIsPaymentOpen(false);
        if (completedReceipt) setCompletedReceipt(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, isPaymentOpen, isSearchOpen, completedReceipt]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      if (pError || !profile) {
        throw new Error('Aucun profil associé à ce compte');
      }
      setUserProfile(profile);
      playBeep('success');
    } catch (err: any) {
      setLoginError(err.message || 'Échec de connexion');
      playBeep('error');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCart([]);
  };

  // Add variant to cart helper
  const addVariantToCart = useCallback((variant: {
    id: string;
    sku: string;
    name: string;
    size: string | null;
    color: string | null;
    selling_price: number;
    stock_quantity: number;
  }) => {
    setCartError(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.variant_id === variant.id);
      if (existing) {
        if (existing.quantity >= variant.stock_quantity) {
          setCartError(`Stock insuffisant pour ${variant.sku} (max ${variant.stock_quantity})`);
          playBeep('error');
          return prev;
        }
        playBeep('success');
        return prev.map((i) =>
          i.variant_id === variant.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      } else {
        if (variant.stock_quantity < 1) {
          setCartError(`Article ${variant.sku} en rupture de stock`);
          playBeep('error');
          return prev;
        }
        playBeep('success');
        return [
          ...prev,
          {
            variant_id: variant.id,
            sku: variant.sku,
            name: variant.name,
            size: variant.size,
            color: variant.color,
            unit_price: variant.selling_price,
            quantity: 1,
            stock_quantity: variant.stock_quantity,
          },
        ];
      }
    });
  }, []);

  // Handle Barcode Scanner Submit (with Enter debouncing)
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = barcodeInput.trim();
    if (!barcode) return;

    const now = Date.now();
    // Debounce fast scans within 150ms
    if (now - lastScanTimeRef.current < 150) {
      return;
    }
    lastScanTimeRef.current = now;

    setBarcodeInput('');
    setCartError(null);

    try {
      const { data, error } = await supabase
        .from('variants')
        .select(`
          id,
          sku,
          barcode,
          size,
          color,
          selling_price,
          stock_quantity,
          is_active,
          product:products (name)
        `)
        .eq('barcode', barcode)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        // Fallback: check by SKU if barcode search fails
        const { data: skuData, error: skuError } = await supabase
          .from('variants')
          .select(`
            id,
            sku,
            barcode,
            size,
            color,
            selling_price,
            stock_quantity,
            is_active,
            product:products (name)
          `)
          .eq('sku', barcode)
          .eq('is_active', true)
          .maybeSingle();

        if (skuError || !skuData) {
          setCartError(`Code-barres / SKU introuvable: ${barcode}`);
          playBeep('error');
          return;
        }

        const prodName = Array.isArray(skuData.product)
          ? skuData.product[0]?.name
          : (skuData.product as any)?.name || skuData.sku;

        addVariantToCart({
          id: skuData.id,
          sku: skuData.sku,
          name: prodName,
          size: skuData.size,
          color: skuData.color,
          selling_price: Number(skuData.selling_price),
          stock_quantity: skuData.stock_quantity,
        });
        return;
      }

      const prodName = Array.isArray(data.product)
        ? data.product[0]?.name
        : (data.product as any)?.name || data.sku;

      addVariantToCart({
        id: data.id,
        sku: data.sku,
        name: prodName,
        size: data.size,
        color: data.color,
        selling_price: Number(data.selling_price),
        stock_quantity: data.stock_quantity,
      });
    } catch (err: any) {
      setCartError(err.message || 'Erreur lors du scan');
      playBeep('error');
    }
  };

  const updateQuantity = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.variant_id === variantId) {
            const newQty = item.quantity + delta;
            if (newQty > item.stock_quantity) {
              setCartError(`Stock max atteint pour ${item.sku}`);
              playBeep('error');
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (variantId: string) => {
    setCart((prev) => prev.filter((i) => i.variant_id !== variantId));
  };

  const totalCartAmount = cart.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  // Complete Sale RPC Call
  const handleConfirmPayment = async ({
    paymentMethod,
    discount,
    cashTendered,
    changeDue,
  }: {
    paymentMethod: 'cash' | 'card' | 'split';
    discount: number;
    cashTendered?: number;
    changeDue?: number;
  }) => {
    // Only pass {variant_id, quantity} to RPC
    const pItems = cart.map((item) => ({
      variant_id: item.variant_id,
      quantity: item.quantity,
    }));

    const { data, error } = await supabase.rpc('complete_sale', {
      p_items: pItems,
      p_payment_method: paymentMethod,
      p_discount: discount,
    });

    if (error) {
      throw new Error(error.message);
    }

    setCart([]);
    setIsPaymentOpen(false);
    setCompletedReceipt({
      ...data,
      cash_tendered: cashTendered,
      change_due: changeDue,
    });
  };

  // Auth loading view
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  // Login view if not authenticated
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 border">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black uppercase tracking-wider text-gray-900">
              Top Tendance POS
            </h1>
            <p className="text-sm text-gray-500 mt-1">Connexion Caissier & Gestionnaire</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="caissier@toptendance.tn"
                className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-black outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-black outline-none text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition duration-150 shadow-md text-sm mt-2"
            >
              Se Connecter à la Caisse
            </button>
          </form>
        </div>
      </div>
    );
  }

  // POS Screen
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans select-none">
      {/* Top Navigation Bar */}
      <header className="bg-black text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <h1 className="font-black text-lg tracking-wider uppercase">Top Tendance POS</h1>
          <span className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-full font-mono">
            V1.0
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <User size={16} className="text-gray-400" />
            <span className="font-medium text-gray-200">
              {userProfile?.full_name || currentUser.email}
            </span>
            <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono uppercase">
              {userProfile?.role || 'user'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg hover:bg-gray-800 transition"
          >
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </header>

      {/* Main POS Interface */}
      <div className="flex-1 p-6 grid grid-cols-12 gap-6 max-w-7xl mx-auto w-full overflow-hidden">
        {/* Left Column: Barcode & Product Action Area (7 cols) */}
        <div className="col-span-7 flex flex-col gap-4">
          {/* Scanner Card */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                <Barcode size={16} /> Scanner Code-barres (F2)
              </label>
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="text-xs font-semibold text-gray-700 hover:text-black flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition"
              >
                <Search size={14} /> Recherche Manuelle
              </button>
            </div>

            <form onSubmit={handleBarcodeSubmit} className="relative">
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scannez ou saisissez le code-barres / SKU..."
                className="w-full pl-4 pr-24 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl font-mono text-base focus:bg-white focus:border-black outline-none transition"
              />
              <button
                type="submit"
                className="absolute right-2 top-2 bottom-2 bg-black text-white px-4 rounded-lg font-bold text-xs hover:bg-gray-800 transition"
              >
                Ajouter
              </button>
            </form>

            {cartError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{cartError}</span>
              </div>
            )}
          </div>

          {/* Quick Help & Hotkeys Bar */}
          <div className="bg-white/60 border border-gray-200 p-3 rounded-xl flex items-center justify-between text-xs text-gray-500">
            <span className="font-semibold text-gray-700">Raccourcis Clavier:</span>
            <div className="flex gap-4">
              <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono text-black font-bold">F2</kbd> Focus Scanner</span>
              <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono text-black font-bold">F9</kbd> Encaissement</span>
              <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono text-black font-bold">Esc</kbd> Annuler</span>
            </div>
          </div>
        </div>

        {/* Right Column: Ticket / Cart (5 cols) */}
        <div className="col-span-5 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-gray-700" />
              <h2 className="font-bold text-base text-gray-900">Panier en cours</h2>
            </div>
            <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
              {cart.reduce((s, i) => s + i.quantity, 0)} articles
            </span>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[350px] max-h-[460px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                <Barcode size={48} className="stroke-1 mb-2 text-gray-300" />
                <p className="text-sm">Aucun article dans le panier</p>
                <p className="text-xs text-gray-400 mt-1">Scannez un code-barres pour commencer</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.variant_id}
                  className="flex items-center justify-between p-3 border rounded-xl hover:border-gray-300 bg-gray-50/50"
                >
                  <div className="flex-1 pr-2">
                    <p className="font-bold text-sm text-gray-900 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-gray-500 font-mono">
                      {item.sku} {item.size ? `• ${item.size}` : ''} {item.color ? `• ${item.color}` : ''}
                    </p>
                    <p className="text-xs font-bold text-gray-800 mt-0.5">
                      {item.unit_price.toFixed(3)} DT
                    </p>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.variant_id, -1)}
                      className="w-7 h-7 bg-white border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-100"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-8 text-center font-mono font-bold text-sm">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.variant_id, 1)}
                      className="w-7 h-7 bg-white border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-100"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.variant_id)}
                      className="ml-2 text-gray-400 hover:text-red-600 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Bottom Summary & Checkout Button */}
          <div className="p-4 border-t bg-gray-50 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold text-gray-600">Total à payer:</span>
              <span className="text-2xl font-black font-mono text-gray-950">
                {totalCartAmount.toFixed(3)} <span className="text-sm font-normal">DT</span>
              </span>
            </div>

            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setIsPaymentOpen(true)}
              className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition shadow-md"
            >
              <CreditCard size={18} />
              <span>Encaisser (F9)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Drawers and Modals */}
      <ProductSearchDrawer
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectVariant={addVariantToCart}
      />

      <PaymentDrawer
        isOpen={isPaymentOpen}
        totalAmount={totalCartAmount}
        onClose={() => setIsPaymentOpen(false)}
        onConfirmPayment={handleConfirmPayment}
      />

      <ReceiptModal
        receipt={completedReceipt}
        onClose={() => setCompletedReceipt(null)}
      />
    </div>
  );
}

