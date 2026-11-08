'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, PackageCheck, AlertCircle } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';

interface DeliveryReceivingModalProps {
  isOpen: boolean;
  variants: Array<{
    id: string;
    sku: string;
    productName: string;
    stock_quantity: number;
  }>;
  onClose: () => void;
  onSuccess: () => void;
}

interface ReceiveRow {
  variant_id: string;
  quantity: number;
  cost_price: string;
  reason: string;
}

export default function DeliveryReceivingModal({
  isOpen,
  variants,
  onClose,
  onSuccess,
}: DeliveryReceivingModalProps) {
  const [rows, setRows] = useState<ReceiveRow[]>([
    { variant_id: variants[0]?.id || '', quantity: 10, cost_price: '', reason: 'Livraison fournisseur' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const addRow = () => {
    setRows([
      ...rows,
      { variant_id: variants[0]?.id || '', quantity: 10, cost_price: '', reason: 'Livraison fournisseur' },
    ]);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof ReceiveRow, value: any) => {
    setRows(
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const formattedItems = rows.map((r) => ({
      variant_id: r.variant_id,
      quantity: Number(r.quantity),
      cost_price: r.cost_price ? Number(r.cost_price) : undefined,
      reason: r.reason,
    }));

    if (formattedItems.some((i) => !i.variant_id || i.quantity <= 0)) {
      setErrorMsg('Veuillez vérifier les articles et quantités saisies (doivent être > 0)');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('receive_stock', {
        p_items: formattedItems,
      });

      if (error) throw error;
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la réception du stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 max-w-2xl w-full flex flex-col max-h-[92vh]">
        <div className="flex justify-between items-center pb-3 border-b">
          <div className="flex items-center gap-2">
            <PackageCheck size={20} className="text-gray-900" />
            <h3 className="font-bold text-base sm:text-lg text-gray-900">Réceptionner une Livraison</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-hidden mt-4">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {rows.map((row, idx) => (
              <div
                key={idx}
                className="p-3 border rounded-xl bg-gray-50/50 flex flex-col md:flex-row gap-3 items-center"
              >
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                    Article (SKU)
                  </label>
                  <select
                    value={row.variant_id}
                    onChange={(e) => updateRow(idx, 'variant_id', e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg bg-white"
                  >
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.sku} - {v.productName} (Dispo: {v.stock_quantity})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-24">
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                    Qté reçue
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={row.quantity}
                    onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg font-mono text-right bg-white"
                  />
                </div>

                <div className="w-28">
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                    P.Achat (DT)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="Optionnel"
                    value={row.cost_price}
                    onChange={(e) => updateRow(idx, 'cost_price', e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg font-mono text-right bg-white"
                  />
                </div>

                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="text-gray-400 hover:text-red-600 self-end md:self-center p-2"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addRow}
              className="text-xs font-bold text-black border border-gray-300 hover:bg-gray-100 py-2 px-3 rounded-lg flex items-center gap-1.5 transition"
            >
              <Plus size={14} /> Ajouter un article
            </button>
          </div>

          <div className="pt-4 border-t flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 border rounded-xl text-xs font-semibold hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition"
            >
              {isSubmitting ? 'Traitement...' : 'Enregistrer la Réception (RPC)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

