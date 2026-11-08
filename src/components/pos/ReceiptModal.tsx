'use client';

import React from 'react';
import { Printer, X } from 'lucide-react';

interface ReceiptModalProps {
  receipt: {
    sale_id: string;
    cashier_name: string;
    total_amount: number;
    discount_amount: number;
    final_amount: number;
    payment_method: string;
    items: Array<{
      variant_id: string;
      sku: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>;
    created_at: string;
    cash_tendered?: number;
    change_due?: number;
  } | null;
  onClose: () => void;
}

export default function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-gray-900 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h3 className="font-bold text-lg">Ticket de Caisse</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Printable thermal ticket layout */}
        <div id="receipt-print-area" className="flex-1 overflow-y-auto font-mono text-xs border p-4 bg-gray-50 rounded-lg">
          <div className="text-center pb-3 border-b border-dashed border-gray-400">
            <h2 className="text-base font-extrabold uppercase tracking-wider">Top Tendance</h2>
            <p className="text-[11px] text-gray-500">Mode & Prêt-à-porter</p>
            <p className="text-[10px] text-gray-500">Tunis, Tunisie</p>
            <p className="text-[10px] mt-1 text-gray-400">ID: {receipt.sale_id.slice(0, 8)}</p>
            <p className="text-[10px] text-gray-400">
              {new Date(receipt.created_at).toLocaleString('fr-TN')}
            </p>
            <p className="text-[10px] text-gray-500">Caissier: {receipt.cashier_name}</p>
          </div>

          <div className="py-3 border-b border-dashed border-gray-400 space-y-2">
            <div className="flex justify-between font-bold text-gray-700">
              <span>ARTICLES</span>
              <span>TOTAL</span>
            </div>
            {receipt.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{item.sku}</p>
                  <p className="text-gray-500">
                    {item.quantity} x {Number(item.unit_price).toFixed(3)} DT
                  </p>
                </div>
                <span className="font-semibold">{Number(item.subtotal).toFixed(3)} DT</span>
              </div>
            ))}
          </div>

          <div className="pt-3 space-y-1">
            <div className="flex justify-between">
              <span>Sous-total:</span>
              <span>{Number(receipt.total_amount).toFixed(3)} DT</span>
            </div>
            {receipt.discount_amount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Remise:</span>
                <span>-{Number(receipt.discount_amount).toFixed(3)} DT</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-1 border-t">
              <span>TOTAL TTC:</span>
              <span>{Number(receipt.final_amount).toFixed(3)} DT</span>
            </div>

            <div className="flex justify-between pt-1 text-gray-600">
              <span>Mode de paiement:</span>
              <span className="uppercase">{receipt.payment_method}</span>
            </div>

            {receipt.cash_tendered !== undefined && (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>Espèces reçues:</span>
                  <span>{Number(receipt.cash_tendered).toFixed(3)} DT</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Monnaie rendue:</span>
                  <span>{Number(receipt.change_due).toFixed(3)} DT</span>
                </div>
              </>
            )}
          </div>

          <div className="text-center mt-6 pt-3 border-t border-dashed border-gray-400 text-[10px] text-gray-500">
            <p>Merci pour votre visite !</p>
            <p>Les échanges sont acceptés sous 7 jours.</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 bg-black text-white py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-800 font-medium transition"
          >
            <Printer size={18} /> Imprimer Ticket
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

