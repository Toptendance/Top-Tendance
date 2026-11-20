'use client';

import React, { useState } from 'react';
import { Layers, Sparkles, RefreshCw, Barcode, X } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';
import { useToast } from '@/context/ToastContext';
import { generateUniqueBarcode, generateVariantSku } from '@/utils/barcodeGenerator';
import { BatchVariantDraft, NewProductModalProps, ProductFormState } from './types';

export default function NewProductModal({
  isOpen,
  onClose,
  categories,
  existingBarcodes,
  existingSkus,
  onSuccess,
}: NewProductModalProps) {
  const { showToast } = useToast();

  // 3.2 Form State, Error States & Loading Indicators
  const [productForm, setProductForm] = useState<ProductFormState>({
    name: '',
    brand: 'Top Tendance',
    category_id: '',
    sku: '',
    barcode: '',
    size: 'M',
    color: 'Noir',
    selling_price: '79.000',
    cost_price: '35.000',
    stock_quantity: '10',
    low_stock_threshold: '5',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkuDuplicate, setIsSkuDuplicate] = useState(false);

  // Multi-size batch state
  const [isMultiSize, setIsMultiSize] = useState(false);
  const [shoeStart, setShoeStart] = useState(36);
  const [shoeEnd, setShoeEnd] = useState(40);
  const [customSizesInput, setCustomSizesInput] = useState('');
  const [batchVariants, setBatchVariants] = useState<BatchVariantDraft[]>([]);

  if (!isOpen) return null;

  // Real-time duplicate SKU check
  const checkSkuDuplicate = (skuToCheck: string): boolean => {
    const trimmed = skuToCheck.trim();
    if (!trimmed) return false;
    return existingSkus.has(trimmed);
  };

  const handleSkuChange = (val: string) => {
    setProductForm((prev) => ({ ...prev, sku: val }));
    const isDup = checkSkuDuplicate(val);
    setIsSkuDuplicate(isDup);
    if (isDup) {
      setFormError('Ce SKU est déjà utilisé par un autre article');
    } else if (formError?.includes('SKU')) {
      setFormError(null);
    }
  };

  // Automatic SKU generator
  const handleAutoGenerateSku = () => {
    const generated = generateVariantSku(
      productForm.name || 'PROD',
      productForm.size || 'STD',
      productForm.color || 'STD'
    );
    setProductForm((prev) => ({ ...prev, sku: generated }));
    const isDup = checkSkuDuplicate(generated);
    setIsSkuDuplicate(isDup);
    if (isDup) {
      setFormError('Ce SKU généré existe déjà. Veuillez le modifier.');
    } else if (formError?.includes('SKU')) {
      setFormError(null);
    }
  };

  // Helper to recompute multi-size draft table with unique barcodes
  const applySizeListToBatch = (sizes: string[]) => {
    const known = new Set<string>(existingBarcodes);
    const drafts: BatchVariantDraft[] = sizes.map((sz) => {
      const generatedBarcode = generateUniqueBarcode(known);
      known.add(generatedBarcode);
      return {
        size: sz,
        sku: generateVariantSku(productForm.name || 'PROD', sz, productForm.color || 'STD'),
        barcode: generatedBarcode,
        stock: parseInt(productForm.stock_quantity, 10) || 10,
        selling_price: productForm.selling_price || '79.000',
        cost_price: productForm.cost_price || '35.000',
      };
    });
    setBatchVariants(drafts);
  };

  // Multi-size presets
  const handleApplyShoeRange = (start: number, end: number) => {
    const list: string[] = [];
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    for (let i = min; i <= max; i++) {
      list.push(i.toString());
    }
    applySizeListToBatch(list);
  };

  const handleApplyClothingPreset = () => {
    applySizeListToBatch(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
  };

  const handleApplyCustomSizes = () => {
    const cleaned = customSizesInput
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (cleaned.length > 0) {
      applySizeListToBatch(cleaned);
    }
  };

  // 3.3 Supabase Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      setFormError('Le nom du produit est requis.');
      return;
    }
    if (isSkuDuplicate) {
      setFormError('Veuillez corriger le SKU dupliqué avant d’enregistrer.');
      return;
    }
    if (isMultiSize && batchVariants.length === 0) {
      setFormError('Veuillez ajouter au moins une taille au lot.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      // 1. Insert parent product into `products`
      const { data: prod, error: pErr } = await supabase
        .from('products')
        .insert({
          name: productForm.name.trim(),
          brand: productForm.brand || 'Top Tendance',
          category_id: productForm.category_id || null,
        })
        .select()
        .single();

      if (pErr) throw pErr;

      // 2. Insert single variant or batch variants into `variants`
      if (isMultiSize) {
        const variantsToInsert = batchVariants.map((item) => ({
          product_id: prod.id,
          sku: item.sku,
          barcode: item.barcode || null,
          size: item.size,
          color: productForm.color,
          selling_price: parseFloat(productForm.selling_price) || 0,
          stock_quantity: item.stock,
          low_stock_threshold: parseInt(productForm.low_stock_threshold, 10) || 5,
        }));

        const { data: insertedVariants, error: vErr } = await supabase
          .from('variants')
          .insert(variantsToInsert)
          .select();

        if (vErr) {
          // Rollback parent product if variant insert fails
          await supabase.from('products').delete().eq('id', prod.id);
          throw vErr;
        }

        // 3. Insert manager cost price into `variant_costs`
        if (productForm.cost_price && insertedVariants) {
          const costRows = insertedVariants.map((v) => ({
            variant_id: v.id,
            cost_price: parseFloat(productForm.cost_price),
          }));
          await supabase.from('variant_costs').insert(costRows);
        }

        // Log initial receiving movement for variants with stock > 0
        if (insertedVariants) {
          const movements = insertedVariants
            .filter((v) => v.stock_quantity > 0)
            .map((v) => ({
              variant_id: v.id,
              quantity_change: v.stock_quantity,
              movement_type: 'receiving',
              reference_id: 'Initial Lot',
            }));
          if (movements.length > 0) {
            await supabase.from('stock_movements').insert(movements);
          }
        }
      } else {
        // Single Variant insertion
        const skuToUse =
          productForm.sku.trim() ||
          generateVariantSku(productForm.name, productForm.size, productForm.color);

        const { data: variant, error: vErr } = await supabase
          .from('variants')
          .insert({
            product_id: prod.id,
            sku: skuToUse,
            barcode: productForm.barcode?.trim() || null,
            size: productForm.size || null,
            color: productForm.color || null,
            selling_price: parseFloat(productForm.selling_price) || 0,
            stock_quantity: parseInt(productForm.stock_quantity, 10) || 0,
            low_stock_threshold: parseInt(productForm.low_stock_threshold, 10) || 5,
          })
          .select()
          .single();

        if (vErr) {
          await supabase.from('products').delete().eq('id', prod.id);
          throw vErr;
        }

        // 3. Insert manager cost price into `variant_costs`
        if (productForm.cost_price && variant) {
          await supabase.from('variant_costs').insert({
            variant_id: variant.id,
            cost_price: parseFloat(productForm.cost_price),
          });
        }

        // Log initial receiving movement if stock > 0
        const initialQty = parseInt(productForm.stock_quantity, 10) || 0;
        if (initialQty > 0 && variant) {
          await supabase.from('stock_movements').insert({
            variant_id: variant.id,
            quantity_change: initialQty,
            movement_type: 'receiving',
            reference_id: 'Initial Stock',
          });
        }
      }

      // 4. Success toast notification, trigger onSuccess(), and close
      showToast(
        isMultiSize
          ? `Produit et lot de ${batchVariants.length} tailles créés avec succès !`
          : 'Produit et variante créés avec succès !',
        'success'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating product & variants:', err);
      if (
        err?.code === '23505' ||
        err?.message?.includes('variants_sku_key') ||
        err?.message?.includes('duplicate key') ||
        err?.message?.toLowerCase()?.includes('sku')
      ) {
        setIsSkuDuplicate(true);
        setFormError("Un SKU en doublon a été détecté. Modifiez-le ou utilisez 'Régénérer SKUs & Barcodes'.");
      } else {
        setFormError(err.message || 'Erreur lors de la création du produit');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 w-full sm:max-w-lg flex flex-col max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-3 border-b">
          <h3 className="font-bold text-base sm:text-lg text-gray-900">
            Nouveau Produit & Variante
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 text-sm font-semibold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 mt-4">
          {formError && (
            <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                Nom du Produit
              </label>
              <input
                type="text"
                required
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl"
                placeholder="Ex: Chemise Lin"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                Catégorie
              </label>
              <select
                value={productForm.category_id}
                onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl bg-white"
              >
                <option value="">Sélectionner</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mode Toggle: Single Variant vs Multi-Sizes */}
          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-gray-700" />
                <div>
                  <p className="text-xs font-bold text-gray-900">Tailles Multiples en Lot (Bottes, Vêtements...)</p>
                  <p className="text-[10px] text-gray-500">Générer automatiquement une plage de tailles avec codes uniques</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMultiSize}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsMultiSize(checked);
                    if (checked && batchVariants.length === 0) {
                      handleApplyShoeRange(shoeStart, shoeEnd);
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
              </label>
            </div>

            {isMultiSize && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2.5">
                {/* Multi-size presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-gray-600 uppercase mr-1">Préréglages:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShoeStart(36);
                      setShoeEnd(40);
                      handleApplyShoeRange(36, 40);
                    }}
                    className="text-[10px] bg-white border border-gray-300 hover:border-black px-2 py-1 rounded-md font-semibold text-gray-700 transition"
                  >
                    Bottes/Chaussures (36-40)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShoeStart(36);
                      setShoeEnd(41);
                      handleApplyShoeRange(36, 41);
                    }}
                    className="text-[10px] bg-white border border-gray-300 hover:border-black px-2 py-1 rounded-md font-semibold text-gray-700 transition"
                  >
                    36 à 41
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyClothingPreset}
                    className="text-[10px] bg-white border border-gray-300 hover:border-black px-2 py-1 rounded-md font-semibold text-gray-700 transition"
                  >
                    Vêtements (XS-XXL)
                  </button>
                </div>

                {/* Range Selector & Custom CSV */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center gap-1.5 bg-white p-1.5 border rounded-lg">
                    <span className="text-[10px] text-gray-500 font-bold">Plage pointures:</span>
                    <input
                      type="number"
                      min="20"
                      max="50"
                      value={shoeStart}
                      onChange={(e) => setShoeStart(parseInt(e.target.value, 10) || 36)}
                      className="w-12 text-center text-xs border rounded p-1 font-mono"
                    />
                    <span className="text-xs text-gray-400">à</span>
                    <input
                      type="number"
                      min="20"
                      max="50"
                      value={shoeEnd}
                      onChange={(e) => setShoeEnd(parseInt(e.target.value, 10) || 40)}
                      className="w-12 text-center text-xs border rounded p-1 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyShoeRange(shoeStart, shoeEnd)}
                      className="text-[10px] bg-black text-white px-2 py-1 rounded font-bold hover:bg-gray-800 ml-auto"
                    >
                      Appliquer
                    </button>
                  </div>

                  <div className="flex items-center gap-1 bg-white p-1.5 border rounded-lg">
                    <input
                      type="text"
                      placeholder="Tailles libres: 36,37,38..."
                      value={customSizesInput}
                      onChange={(e) => setCustomSizesInput(e.target.value)}
                      className="flex-1 text-xs border rounded p-1"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCustomSizes}
                      className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-1 rounded font-bold"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Single Variant Input Fields (only when isMultiSize is false) */}
          {!isMultiSize ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase">
                      SKU (Unique)
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoGenerateSku}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline"
                    >
                      <Sparkles size={11} /> Auto-générer
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={productForm.sku}
                    onChange={(e) => handleSkuChange(e.target.value)}
                    className={`w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl font-mono transition ${
                      isSkuDuplicate
                        ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-1 focus:ring-red-400'
                        : 'border-gray-200'
                    }`}
                    placeholder="Ex: ROBE-SAT-M-NOIR"
                  />
                  {isSkuDuplicate && (
                    <p className="text-[10px] text-red-600 mt-1">
                      SKU déjà existant dans la base.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Code-barres (EAN/Code128)
                  </label>
                  <input
                    type="text"
                    value={productForm.barcode}
                    onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl font-mono"
                    placeholder="619..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Taille
                  </label>
                  <input
                    type="text"
                    value={productForm.size}
                    onChange={(e) => setProductForm({ ...productForm, size: e.target.value })}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Couleur
                  </label>
                  <input
                    type="text"
                    value={productForm.color}
                    onChange={(e) => setProductForm({ ...productForm, color: e.target.value })}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl"
                  />
                </div>
              </div>
            </>
          ) : (
            /* Multi-Size Variant Table Preview */
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Couleur Commune
                  </label>
                  <input
                    type="text"
                    value={productForm.color}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProductForm({ ...productForm, color: val });
                      setBatchVariants((prev) =>
                        prev.map((v) => ({
                          ...v,
                          sku: generateVariantSku(productForm.name || 'PROD', v.size, val),
                        }))
                      );
                    }}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl"
                    placeholder="Ex: Noir"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      applySizeListToBatch(batchVariants.map((v) => v.size));
                    }}
                    className="w-full py-2.5 px-3 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <RefreshCw size={13} /> Régénérer SKUs & Barcodes
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-100 px-3 py-1.5 flex justify-between items-center text-[11px] font-bold text-gray-700">
                  <span>Tailles & Codes Générés ({batchVariants.length})</span>
                  <span className="text-[10px] text-gray-500 font-normal">Chaque taille a un code unique</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 text-xs">
                  {batchVariants.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">
                      Aucune taille sélectionnée. Cliquez sur un préréglage ci-dessus.
                    </div>
                  ) : (
                    batchVariants.map((item, idx) => (
                      <div key={idx} className="p-2 sm:p-2.5 flex flex-wrap items-center gap-2 hover:bg-gray-50">
                        <span className="inline-flex items-center justify-center w-8 h-7 bg-black text-white font-black text-xs rounded-lg">
                          {item.size}
                        </span>
                        <div className="flex-1 min-w-[130px]">
                          <p className="font-mono text-[10px] text-gray-500 truncate">{item.sku}</p>
                          <div className="flex items-center gap-1 text-[11px] font-mono text-gray-900 font-bold">
                            <Barcode size={12} className="text-gray-400" />
                            <span>{item.barcode}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-gray-400 font-bold uppercase">Qté:</label>
                          <input
                            type="number"
                            min="0"
                            value={item.stock}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setBatchVariants((prev) =>
                                prev.map((v, i) => (i === idx ? { ...v, stock: val } : v))
                              );
                            }}
                            className="w-14 text-center border rounded p-1 font-mono text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBatchVariants((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-gray-400 hover:text-red-600 p-1 rounded"
                          title="Supprimer cette taille"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                Prix Vente (DT)
              </label>
              <input
                type="number"
                step="0.001"
                required
                value={productForm.selling_price}
                onChange={(e) => setProductForm({ ...productForm, selling_price: e.target.value })}
                className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl font-mono text-right"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                Prix Achat (DT)
              </label>
              <input
                type="number"
                step="0.001"
                value={productForm.cost_price}
                onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
                className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl font-mono text-right"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                Stock Initial
              </label>
              <input
                type="number"
                min="0"
                value={productForm.stock_quantity}
                onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl font-mono text-right"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                Seuil alerte
              </label>
              <input
                type="number"
                min="1"
                value={productForm.low_stock_threshold}
                onChange={(e) => setProductForm({ ...productForm, low_stock_threshold: e.target.value })}
                className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl font-mono text-right"
              />
            </div>
          </div>

          <div className="pt-3 border-t flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 border rounded-xl text-xs font-semibold hover:bg-gray-100 text-center disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isSkuDuplicate}
              className="w-full sm:w-auto bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition text-center disabled:opacity-50"
            >
              {isSubmitting ? 'Création en cours...' : "Créer l'Article"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
