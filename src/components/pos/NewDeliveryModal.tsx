'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabaseClient';
import {
  X,
  Search,
  Plus,
  Trash2,
  Package,
  Truck,
  Phone,
  MapPin,
  AlertCircle,
  Barcode,
  Loader2,
} from 'lucide-react';
import { formatPrice } from '@/utils/currency';

export const TUNISIAN_GOVERNORATES = [
  'Ariana',
  'Béja',
  'Ben Arous',
  'Bizerte',
  'Gabès',
  'Gafsa',
  'Jendouba',
  'Kairouan',
  'Kasserine',
  'Kébili',
  'Le Kef',
  'Mahdia',
  'La Manouba',
  'Médenine',
  'Monastir',
  'Nabeul',
  'Sfax',
  'Sidi Bouzid',
  'Siliana',
  'Sousse',
  'Tataouine',
  'Tozeur',
  'Tunis',
  'Zaghouan',
];

export const COURIERS = ['Aramex', 'Yalidine', 'Express', 'Livraison Propre'];

interface VariantOption {
  id: string;
  sku: string;
  barcode?: string | null;
  size: string | null;
  color: string | null;
  stock_quantity: number;
  product_id: string;
  product_name: string;
  price: number;
}

interface DeliveryItemDraft {
  variant_id: string;
  product_name: string;
  sku: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price: number;
  max_stock: number;
}

interface NewDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewDeliveryModal({ isOpen, onClose, onSuccess }: NewDeliveryModalProps) {
  // Form state
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientPhoneAlt, setRecipientPhoneAlt] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [governorate, setGovernorate] = useState('Tunis');
  const [courierName, setCourierName] = useState('Aramex');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingFee, setShippingFee] = useState<number>(7.0);
  const [customCod, setCustomCod] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Items in shipment
  const [items, setItems] = useState<DeliveryItemDraft[]>([]);

  // Variants catalog for searching / scanning
  const [availableVariants, setAvailableVariants] = useState<VariantOption[]>([]);
  const [variantSearch, setVariantSearch] = useState('');
  const [isSearchingVariants, setIsSearchingVariants] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load catalog variants when modal opens
  useEffect(() => {
    if (isOpen) {
      loadVariants();
      // Generate a preliminary tracking number suggestion
      setTrackingNumber(`TRK-${Date.now().toString().slice(-6)}`);
      setError(null);
    } else {
      // Reset state
      setRecipientName('');
      setRecipientPhone('');
      setRecipientPhoneAlt('');
      setAddress('');
      setCity('');
      setGovernorate('Tunis');
      setCourierName('Aramex');
      setTrackingNumber('');
      setShippingFee(7.0);
      setCustomCod('');
      setNotes('');
      setItems([]);
      setVariantSearch('');
      setError(null);
    }
  }, [isOpen]);

  const loadVariants = async () => {
    setIsSearchingVariants(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('variants')
        .select(`
          id,
          sku,
          barcode,
          size,
          color,
          stock_quantity,
          product_id,
          products (
            name,
            price
          )
        `)
        .gt('stock_quantity', 0)
        .order('sku', { ascending: true })
        .limit(300);

      if (fetchErr) throw fetchErr;

      const formatted: VariantOption[] = (data || []).map((row: any) => ({
        id: row.id,
        sku: row.sku,
        barcode: row.barcode,
        size: row.size,
        color: row.color,
        stock_quantity: row.stock_quantity,
        product_id: row.product_id,
        product_name: row.products?.name || 'Produit sans nom',
        price: Number(row.products?.price || 0),
      }));

      setAvailableVariants(formatted);
    } catch (err: any) {
      console.error('Error fetching variants for delivery modal:', err);
    } finally {
      setIsSearchingVariants(false);
    }
  };

  // Filtered variants based on search
  const filteredVariants = useMemo(() => {
    if (!variantSearch.trim()) return [];
    const q = variantSearch.toLowerCase().trim();
    return availableVariants
      .filter(
        v =>
          v.product_name.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q) ||
          (v.barcode && v.barcode.toLowerCase().includes(q)) ||
          (v.size && v.size.toLowerCase().includes(q)) ||
          (v.color && v.color.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [availableVariants, variantSearch]);

  // Add variant to items
  const handleAddVariant = (v: VariantOption) => {
    const existing = items.find(i => i.variant_id === v.id);
    if (existing) {
      if (existing.quantity >= v.stock_quantity) {
        setError(`Stock max atteint pour ${v.product_name} (${v.stock_quantity} disponible)`);
        return;
      }
      setItems(items.map(i => (i.variant_id === v.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setItems([
        ...items,
        {
          variant_id: v.id,
          product_name: v.product_name,
          sku: v.sku,
          size: v.size,
          color: v.color,
          quantity: 1,
          unit_price: v.price,
          max_stock: v.stock_quantity,
        },
      ]);
    }
    setVariantSearch('');
    setError(null);
  };

  // Barcode enter key handler
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && variantSearch.trim()) {
      e.preventDefault();
      const code = variantSearch.trim();
      const match = availableVariants.find(
        v => (v.barcode && v.barcode === code) || v.sku.toLowerCase() === code.toLowerCase()
      );
      if (match) {
        handleAddVariant(match);
      } else if (filteredVariants.length > 0) {
        handleAddVariant(filteredVariants[0]);
      } else {
        setError(`Aucun article trouvé avec le code/SKU: ${code}`);
      }
    }
  };

  // Update item quantity
  const handleUpdateQty = (variant_id: string, delta: number) => {
    setItems(
      items
        .map(i => {
          if (i.variant_id !== variant_id) return i;
          const next = i.quantity + delta;
          if (next <= 0) return null;
          if (next > i.max_stock) {
            setError(`Stock insuffisant (${i.max_stock} max)`);
            return i;
          }
          return { ...i, quantity: next };
        })
        .filter(Boolean) as DeliveryItemDraft[]
    );
  };

  const handleRemoveItem = (variant_id: string) => {
    setItems(items.filter(i => i.variant_id !== variant_id));
  };

  // Calculations
  const itemsSubtotal = useMemo(() => {
    return items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  }, [items]);

  const computedCod = useMemo(() => {
    if (customCod !== '') {
      const val = parseFloat(customCod);
      return isNaN(val) ? 0 : val;
    }
    return itemsSubtotal + (Number(shippingFee) || 0);
  }, [customCod, itemsSubtotal, shippingFee]);

  // Submit delivery order
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!recipientName.trim()) {
      setError('Le nom du destinataire est obligatoire');
      return;
    }
    if (!recipientPhone.trim()) {
      setError('Le numéro de téléphone est obligatoire');
      return;
    }
    if (!address.trim()) {
      setError('L’adresse de livraison est obligatoire');
      return;
    }
    if (!city.trim()) {
      setError('La ville ou localité est obligatoire');
      return;
    }
    if (items.length === 0) {
      setError('Veuillez ajouter au moins un article à expédier');
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadItems = items.map(i => ({
        variant_id: i.variant_id,
        product_name: i.product_name,
        sku: i.sku,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        unit_price: i.unit_price,
      }));

      const { data, error: rpcErr } = await supabase.rpc('create_delivery_order', {
        p_recipient_name: recipientName.trim(),
        p_recipient_phone: recipientPhone.trim(),
        p_recipient_phone_alt: recipientPhoneAlt.trim() || null,
        p_address: address.trim(),
        p_city: city.trim(),
        p_governorate: governorate,
        p_items: payloadItems,
        p_tracking_number: trackingNumber.trim() || null,
        p_courier_name: courierName,
        p_cod_amount: computedCod,
        p_shipping_fee: Number(shippingFee) || 0,
        p_status: 'preparing',
        p_payment_status: 'unpaid',
        p_notes: notes.trim() || null,
      });

      if (rpcErr) throw rpcErr;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating delivery order:', err);
      setError(err.message || 'Erreur lors de la création du colis');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center">
              <Truck size={16} />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-gray-950">Nouvelle Expédition / Colis</h2>
              <p className="text-xs text-gray-500 font-medium">Créer et déduire du stock pour expédition</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Destinataire Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
              <Phone size={14} /> 1. Coordonnées Destinataire
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nom Complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mohamed Ben Ali"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone Principal *</label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: 98 123 456"
                  value={recipientPhone}
                  onChange={e => setRecipientPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Adresse de livraison *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 12 Rue de la République"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Tél Secondaire (Optionnel)</label>
                <input
                  type="tel"
                  placeholder="Ex: 22 987 654"
                  value={recipientPhoneAlt}
                  onChange={e => setRecipientPhoneAlt(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Gouvernorat (24) *</label>
                <select
                  value={governorate}
                  onChange={e => setGovernorate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black"
                >
                  {TUNISIAN_GOVERNORATES.map(gov => (
                    <option key={gov} value={gov}>
                      {gov}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Ville / Délégation *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: La Marsa / Menzah 6"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
          </div>

          {/* Transporteur & Expédition */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
              <Truck size={14} /> 2. Transporteur & Frais
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Transporteur</label>
                <select
                  value={courierName}
                  onChange={e => setCourierName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black"
                >
                  {COURIERS.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">N° de Suivi / Tracking</label>
                <input
                  type="text"
                  placeholder="Ex: ARM-789012"
                  value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Frais de port (DT)</label>
                <input
                  type="number"
                  step="0.500"
                  min="0"
                  value={shippingFee}
                  onChange={e => setShippingFee(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
          </div>

          {/* Sélection des articles & Scan */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-500">
              <span className="flex items-center gap-1.5">
                <Package size={14} /> 3. Articles du Colis
              </span>
              <span>{items.length} article(s)</span>
            </div>

            {/* Scan or search input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Search size={15} />
              </div>
              <input
                ref={barcodeInputRef}
                type="text"
                value={variantSearch}
                onChange={e => setVariantSearch(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Scanner code-barres ou rechercher par nom / SKU..."
                className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                <Barcode size={16} />
              </div>

              {/* Suggestions dropdown */}
              {filteredVariants.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-20 divide-y divide-gray-100">
                  {filteredVariants.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleAddVariant(v)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between text-xs transition"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{v.product_name}</p>
                        <p className="text-[11px] text-gray-500">
                          SKU: {v.sku} {v.size && `| T: ${v.size}`} {v.color && `| C: ${v.color}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-gray-900">{formatPrice(v.price)}</span>
                        <p className="text-[10px] text-emerald-600 font-bold">Stock: {v.stock_quantity}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected items table */}
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 font-medium">
                  Aucun article sélectionné. Scannez un code-barres ou recherchez ci-dessus.
                </div>
              ) : (
                items.map(item => (
                  <div key={item.variant_id} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{item.product_name}</p>
                      <p className="text-[11px] text-gray-500">
                        SKU: {item.sku} {item.size && `• ${item.size}`} {item.color && `• ${item.color}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.variant_id, -1)}
                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-bold text-gray-900">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.variant_id, 1)}
                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>

                    <div className="w-24 text-right font-bold text-gray-900">
                      {formatPrice(item.quantity * item.unit_price)}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.variant_id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Montant COD & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Total Contre-Remboursement (COD)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.500"
                  min="0"
                  placeholder={computedCod.toFixed(3)}
                  value={customCod}
                  onChange={e => setCustomCod(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-black"
                />
                <span className="text-xs font-bold text-gray-400">DT</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Articles: {formatPrice(itemsSubtotal)} + Livraison: {formatPrice(shippingFee)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Notes / Instructions</label>
              <input
                type="text"
                placeholder="Ex: Appeler avant livraison / Ne pas ouvrir sans payer"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        </form>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
          <div className="text-xs">
            <span className="text-gray-500 font-medium">Total COD: </span>
            <span className="font-black text-gray-950 text-sm">{formatPrice(computedCod)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-100 transition"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || items.length === 0}
              className="px-5 py-2.5 bg-black text-white rounded-xl font-black text-xs hover:bg-gray-800 disabled:opacity-50 transition flex items-center gap-2 shadow-lg shadow-black/10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Truck size={14} />
                  <span>Créer et Expédier</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
