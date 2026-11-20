'use client';

import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Edit2, Check } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';
import { useToast } from '@/context/ToastContext';
import { generateUniqueBarcode, generateVariantSku } from '@/utils/barcodeGenerator';
import {
  AddVariantModalProps,
  AddVariantFormState,
  EditVariantModalProps,
  EditingVariantData,
} from './types';

export { type AddVariantModalProps, type EditVariantModalProps };

/**
 * 4.1 AddVariantModal Component
 * Allows adding a new size/color variant to an existing model.
 */
export function AddVariantModal({
  targetProduct,
  onClose,
  onSuccess,
  existingBarcodes,
  onOpenTagModal,
}: AddVariantModalProps) {
  const { showToast } = useToast();

  const [addVariantForm, setAddVariantForm] = useState<AddVariantFormState>({
    size: 'M',
    color: 'Noir',
    selling_price: '79.000',
    cost_price: '35.000',
    stock_quantity: '5',
    low_stock_threshold: '5',
    sku: '',
    barcode: '',
  });
  const [addVariantError, setAddVariantError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-populate category, brand, default selling/cost prices when targetProduct opens
  useEffect(() => {
    if (targetProduct) {
      const color = targetProduct.defaultColor || 'Noir';
      const size = 'M';
      const initialSelling =
        targetProduct.defaultSellingPrice > 0
          ? targetProduct.defaultSellingPrice.toFixed(3)
          : '79.000';
      const initialCost =
        targetProduct.defaultCostPrice !== undefined && targetProduct.defaultCostPrice > 0
          ? targetProduct.defaultCostPrice.toFixed(3)
          : '35.000';

      setAddVariantForm({
        size,
        color,
        selling_price: initialSelling,
        cost_price: initialCost,
        stock_quantity: '5',
        low_stock_threshold: '5',
        sku: generateVariantSku(targetProduct.productName, size, color),
        barcode: generateUniqueBarcode(existingBarcodes),
      });
      setAddVariantError(null);
    }
  }, [targetProduct, existingBarcodes]);

  if (!targetProduct) return null;

  // Size quick selectors handler
  const handleUpdateSize = (newSize: string) => {
    const newSku = generateVariantSku(targetProduct.productName, newSize, addVariantForm.color);
    setAddVariantForm((prev) => ({
      ...prev,
      size: newSize,
      sku: newSku,
    }));
  };

  const handleUpdateColor = (newColor: string) => {
    const newSku = generateVariantSku(targetProduct.productName, addVariantForm.size, newColor);
    setAddVariantForm((prev) => ({
      ...prev,
      color: newColor,
      sku: newSku,
    }));
  };

  const handleRegenerateBarcode = () => {
    const freshBarcode = generateUniqueBarcode(existingBarcodes);
    setAddVariantForm((prev) => ({ ...prev, barcode: freshBarcode }));
  };

  // Form submission: creates variant in `variants` table and costs in `variant_costs`
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSize = addVariantForm.size.trim();
    if (!trimmedSize) {
      setAddVariantError('La taille est obligatoire.');
      return;
    }

    setIsSubmitting(true);
    setAddVariantError(null);

    try {
      const stockQty = Math.max(0, parseInt(addVariantForm.stock_quantity, 10) || 0);
      const sellingPrice = parseFloat(addVariantForm.selling_price) || 0;
      const costPrice = parseFloat(addVariantForm.cost_price) || 0;
      const lowThreshold = parseInt(addVariantForm.low_stock_threshold, 10) || 5;

      const barcodeToUse =
        addVariantForm.barcode.trim() || generateUniqueBarcode(existingBarcodes);
      const skuToUse =
        addVariantForm.sku.trim() ||
        generateVariantSku(targetProduct.productName, trimmedSize, addVariantForm.color);

      // 1. Insert into variants
      const { data: newVariant, error: vErr } = await supabase
        .from('variants')
        .insert({
          product_id: targetProduct.productId,
          sku: skuToUse,
          barcode: barcodeToUse,
          size: trimmedSize,
          color: addVariantForm.color.trim() || null,
          selling_price: sellingPrice,
          stock_quantity: stockQty,
          low_stock_threshold: lowThreshold,
          is_active: true,
          is_printed: false,
        })
        .select()
        .single();

      if (vErr) throw vErr;

      // 2. Insert into variant_costs if cost specified
      if (costPrice > 0 && newVariant) {
        await supabase.from('variant_costs').insert({
          variant_id: newVariant.id,
          cost_price: costPrice,
        });
      }

      // 3. Log stock movement
      if (stockQty > 0 && newVariant) {
        await supabase.from('stock_movements').insert({
          variant_id: newVariant.id,
          quantity_change: stockQty,
          movement_type: 'receiving',
          reference_id: 'Ajout Variante',
        });
      }

      showToast(
        `Variante "${trimmedSize}" ajoutée au modèle "${targetProduct.productName}" !`,
        'success'
      );

      // Optional: prompt label print for new variant
      if (newVariant && barcodeToUse && onOpenTagModal) {
        onOpenTagModal({
          variantId: newVariant.id,
          productName: targetProduct.productName,
          sku: newVariant.sku,
          barcode: barcodeToUse,
          size: newVariant.size,
          color: newVariant.color,
          selling_price: sellingPrice,
          stock_quantity: stockQty,
        });
      }

      onSuccess(newVariant);
      onClose();
    } catch (err: any) {
      console.error('Failed to add variant:', err);
      setAddVariantError(err.message || "Erreur lors de l'ajout de la variante");
      showToast(err.message || "Erreur lors de l'ajout de la variante", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 w-full sm:max-w-lg flex flex-col max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center pb-3 border-b">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-gray-900">
              Ajouter une Variante / Taille
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Modèle : <span className="font-bold text-gray-900">« {targetProduct.productName} »</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 text-sm font-semibold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {addVariantError && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
              {addVariantError}
            </div>
          )}

          {/* Locked Model Info Badge */}
          <div className="bg-gray-50 border rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-500">Catégorie : </span>
              <span className="font-semibold text-gray-800">{targetProduct.categoryName}</span>
            </div>
            {targetProduct.brand && (
              <div>
                <span className="text-gray-500">Marque : </span>
                <span className="font-semibold text-gray-800">{targetProduct.brand}</span>
              </div>
            )}
          </div>

          {/* Size Quick Selectors & Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-700">Taille *</label>
              <span className="text-[11px] text-gray-400">Cliquez pour choisir vite</span>
            </div>

            {/* Clothing sizes pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold text-gray-400 mr-0.5">Vêtements:</span>
              {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'TU'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleUpdateSize(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition ${
                    addVariantForm.size === s
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Shoe sizes pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-semibold text-gray-400 mr-0.5">Pointures:</span>
              {['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleUpdateSize(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition ${
                    addVariantForm.size === s
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Custom size input */}
            <div className="pt-1">
              <input
                type="text"
                required
                value={addVariantForm.size}
                onChange={(e) => handleUpdateSize(e.target.value)}
                placeholder="Ou tapez une taille personnalisée (ex: 38.5, 4 ans...)"
                className="w-full text-xs border rounded-xl px-3 py-2 focus:ring-1 focus:ring-black outline-none font-mono"
              />
            </div>
          </div>

          {/* Color & Initial Stock */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700">Couleur</label>
              <input
                type="text"
                value={addVariantForm.color}
                onChange={(e) => handleUpdateColor(e.target.value)}
                placeholder="Ex: Noir, Beige, Blanc..."
                className="w-full text-xs border rounded-xl px-3 py-2 mt-1 focus:ring-1 focus:ring-black outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700">Stock initial *</label>
              <input
                type="number"
                min="0"
                required
                value={addVariantForm.stock_quantity}
                onChange={(e) =>
                  setAddVariantForm({ ...addVariantForm, stock_quantity: e.target.value })
                }
                className="w-full text-xs border rounded-xl px-3 py-2 mt-1 focus:ring-1 focus:ring-black outline-none font-mono font-bold"
              />
            </div>
          </div>

          {/* Selling Price & Cost Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700">Prix de vente (DT) *</label>
              <input
                type="number"
                step="0.001"
                min="0"
                required
                value={addVariantForm.selling_price}
                onChange={(e) =>
                  setAddVariantForm({ ...addVariantForm, selling_price: e.target.value })
                }
                className="w-full text-xs border rounded-xl px-3 py-2 mt-1 focus:ring-1 focus:ring-black outline-none font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700">Prix d'achat / Coût (DT)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={addVariantForm.cost_price}
                onChange={(e) =>
                  setAddVariantForm({ ...addVariantForm, cost_price: e.target.value })
                }
                placeholder="Optionnel"
                className="w-full text-xs border rounded-xl px-3 py-2 mt-1 focus:ring-1 focus:ring-black outline-none font-mono"
              />
            </div>
          </div>

          {/* SKU & Barcode Generation */}
          <div className="bg-gray-50 border rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-gray-700">Identification Code-Barres & SKU</span>
              <button
                type="button"
                onClick={handleRegenerateBarcode}
                className="text-[11px] text-gray-600 hover:text-black flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RefreshCw size={11} /> Régénérer Code
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-400 text-[10px] block">SKU généré :</span>
                <input
                  type="text"
                  value={addVariantForm.sku}
                  onChange={(e) => setAddVariantForm({ ...addVariantForm, sku: e.target.value })}
                  className="w-full text-[11px] font-mono border bg-white rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-black outline-none"
                />
              </div>
              <div>
                <span className="text-gray-400 text-[10px] block">Code-barres EAN-13 :</span>
                <input
                  type="text"
                  value={addVariantForm.barcode}
                  onChange={(e) => setAddVariantForm({ ...addVariantForm, barcode: e.target.value })}
                  className="w-full text-[11px] font-mono border bg-white rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-black outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t flex justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 border rounded-xl text-xs font-semibold hover:bg-gray-100 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-black text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-gray-800 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus size={14} />
              {isSubmitting ? 'Ajout en cours...' : 'Ajouter la variante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * 4.2 EditVariantModal Component
 * Dual-entity update: updates `products` (name, brand, category_id)
 * and `variants` (size, color, prices, stock, barcode, SKU).
 * Upserts cost price in `variant_costs`.
 */
export function EditVariantModal({
  editingData,
  categories,
  onClose,
  onSuccess,
}: EditVariantModalProps) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<EditingVariantData | null>(editingData);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData(editingData);
    setError(null);
  }, [editingData]);

  if (!editingData || !formData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    if (!formData.name.trim()) {
      setError('Le nom du produit est obligatoire.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const sellingPrice = parseFloat(formData.sellingPrice) || 0;
      const costPrice = parseFloat(formData.costPrice) || 0;
      const stockQty = Math.max(0, parseInt(formData.stockQuantity, 10) || 0);
      const lowThreshold = parseInt(formData.lowStockThreshold, 10) || 5;

      // 1. Update product table
      const { error: pErr } = await supabase
        .from('products')
        .update({
          name: formData.name.trim(),
          brand: formData.brand.trim() || null,
          category_id: formData.categoryId || null,
        })
        .eq('id', formData.productId);

      if (pErr) throw pErr;

      // 2. Update variant table
      const { error: vErr } = await supabase
        .from('variants')
        .update({
          size: formData.size.trim() || null,
          color: formData.color.trim() || null,
          selling_price: sellingPrice,
          stock_quantity: stockQty,
          low_stock_threshold: lowThreshold,
          sku: formData.sku.trim(),
          barcode: formData.barcode.trim() || null,
        })
        .eq('id', formData.variantId);

      if (vErr) throw vErr;

      // 3. Upsert into variant_costs if costPrice provided
      if (costPrice > 0) {
        await supabase
          .from('variant_costs')
          .upsert(
            { variant_id: formData.variantId, cost_price: costPrice },
            { onConflict: 'variant_id' }
          );
      }

      showToast(`Article "${formData.name}" mis à jour avec succès`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update article/variant:', err);
      setError(err.message || 'Erreur lors de la mise à jour');
      showToast(err.message || 'Erreur lors de la mise à jour', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 w-full sm:max-w-lg flex flex-col max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center pb-3 border-b">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-gray-900 flex items-center gap-2">
              <Edit2 size={16} /> Modifier l'Article & Variante
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              SKU : <span className="font-mono font-semibold text-gray-800">{formData.sku}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 text-sm font-semibold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
              {error}
            </div>
          )}

          {/* Product Info Section */}
          <div className="bg-gray-50 border rounded-xl p-3.5 space-y-3">
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
              Informations Générales (Modèle)
            </span>
            <div>
              <label className="text-xs font-bold text-gray-700">Nom du produit *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full text-xs border bg-white rounded-xl px-3 py-2 mt-1 focus:ring-1 focus:ring-black outline-none font-semibold"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700">Catégorie</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full text-xs border bg-white rounded-xl px-3 py-2 mt-1 focus:ring-1 focus:ring-black outline-none"
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">Marque</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="Top Tendance"
                  className="w-full text-xs border bg-white rounded-xl px-3 py-2 mt-1 focus:ring-1 focus:ring-black outline-none"
                />
              </div>
            </div>
          </div>

          {/* Variant Info Section */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
              Spécifications de la Variante
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700">Taille *</label>
                <input
                  type="text"
                  required
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  placeholder="Ex: M, 38, L..."
                  className="w-full text-xs border rounded-xl px-3 py-2 mt-1 focus:ring-1 focus:ring-black outline-none font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">Couleur</label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="Ex: Noir, Beige..."
                  className="w-full text-xs border rounded-xl px-3 py-2 mt-1 focus:ring-1 focus:ring-black outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700">Stock en magasin *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                  className="w-full text-xs border rounded-xl px-3 py-2 mt-1 focus:ring-1 focus:ring-black outline-none font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">Seuil stock faible</label>
                <input
                  type="number"
                  min="0"
                  value={formData.lowStockThreshold}
                  onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                  className="w-full text-xs border rounded-xl px-3 py-2 mt-1 focus:ring-1 focus:ring-black outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700">Prix de vente (DT) *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                  className="w-full text-xs border rounded-xl px-3 py-2 mt-1 focus:ring-1 focus:ring-black outline-none font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">Prix d'achat / Coût (DT)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  placeholder="0.000"
                  className="w-full text-xs border rounded-xl px-3 py-2 mt-1 focus:ring-1 focus:ring-black outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-gray-600">SKU</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full text-[11px] font-mono border rounded-xl px-2.5 py-1.5 mt-0.5 focus:ring-1 focus:ring-black outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600">Code-barres</label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full text-[11px] font-mono border rounded-xl px-2.5 py-1.5 mt-0.5 focus:ring-1 focus:ring-black outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t flex justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 border rounded-xl text-xs font-semibold hover:bg-gray-100 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-black text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-gray-800 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Check size={14} />
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
