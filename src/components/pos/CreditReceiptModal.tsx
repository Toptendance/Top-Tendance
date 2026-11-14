'use client';

import React from 'react';
import { X, Printer } from 'lucide-react';

interface CreditReceiptItem {
  variant_id: string;
  sku: string;
  name: string;
  size: string | null;
  color: string | null;
  unit_price: number;
  quantity: number;
}

interface CreditReceiptData {
  creditId: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  depositAmount: number;
  depositMethod: 'cash' | 'card';
  remainingBalance: number;
  dueDate: string;
  notes: string;
  items: CreditReceiptItem[];
  createdAt: string;
  cashierName: string;
}

interface CreditReceiptModalProps {
  receipt: CreditReceiptData | null;
  onClose: () => void;
}

export default function CreditReceiptModal({ receipt, onClose }: CreditReceiptModalProps) {
  if (!receipt) return null;

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-4 sm:p-6 text-gray-900 flex flex-col max-h-[92vh]">
        <div className="flex justify-between items-center mb-3 sm:mb-4 pb-2 border-b">
          <h3 className="font-bold text-base sm:text-lg">Bon de Crédit / Ticket Débiteur</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Printable credit ticket */}
        <div
          id="credit-receipt-print-area"
          className="flex-1 overflow-y-auto font-mono text-xs border p-4 bg-gray-50 rounded-lg"
        >
          {/* Header */}
          <div className="text-center pb-3 border-b border-dashed border-gray-400">
            <h2 className="text-base font-extrabold uppercase tracking-wider">Top Tendance</h2>
            <p className="text-[11px] text-gray-500">Mode & Prêt-à-porter — Tunis, Tunisie</p>
            <p className="text-[10px] mt-1 font-bold text-orange-600 uppercase tracking-wider">
              ★ BON DE VENTE À CRÉDIT ★
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              Réf: {receipt.creditId.slice(0, 8).toUpperCase()}
            </p>
            <p className="text-[10px] text-gray-400">
              {new Date(receipt.createdAt).toLocaleString('fr-TN')}
            </p>
            <p className="text-[10px] text-gray-500">Caissier: {receipt.cashierName}</p>
          </div>

          {/* Customer info */}
          <div className="py-3 border-b border-dashed border-gray-400 space-y-1">
            <p className="font-bold text-gray-700 uppercase text-[10px]">Informations Client</p>
            <p>
              <span className="text-gray-500">Nom: </span>
              <span className="font-semibold">{receipt.customerName}</span>
            </p>
            <p>
              <span className="text-gray-500">Tél: </span>
              <span className="font-semibold">+216 {receipt.customerPhone}</span>
            </p>
            {receipt.dueDate && (
              <p>
                <span className="text-gray-500">Échéance: </span>
                <span className="font-semibold">{receipt.dueDate}</span>
              </p>
            )}
            {receipt.notes && (
              <p>
                <span className="text-gray-500">Notes: </span>
                {receipt.notes}
              </p>
            )}
          </div>

          {/* Items */}
          <div className="py-3 border-b border-dashed border-gray-400 space-y-2">
            <div className="flex justify-between font-bold text-gray-700">
              <span>ARTICLES</span>
              <span>TOTAL</span>
            </div>
            {receipt.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-gray-500 text-[10px]">
                    {item.sku}
                    {item.size ? ` • ${item.size}` : ''}
                    {item.color ? ` • ${item.color}` : ''}
                  </p>
                  <p className="text-gray-500">
                    {item.quantity} x {item.unit_price.toFixed(3)} DT
                  </p>
                </div>
                <span className="font-semibold">
                  {(item.unit_price * item.quantity).toFixed(3)} DT
                </span>
              </div>
            ))}
          </div>

          {/* Financial summary */}
          <div className="pt-3 space-y-1">
            <div className="flex justify-between font-bold text-sm border-t pt-2">
              <span>TOTAL ARTICLES:</span>
              <span>{receipt.totalAmount.toFixed(3)} DT</span>
            </div>
            {receipt.depositAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>
                  Acompte versé ({receipt.depositMethod === 'cash' ? 'Espèces' : 'Carte'}):
                </span>
                <span>-{receipt.depositAmount.toFixed(3)} DT</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-base text-orange-700 border-t pt-2 mt-1">
              <span>RESTE À PAYER:</span>
              <span>{receipt.remainingBalance.toFixed(3)} DT</span>
            </div>
          </div>

          {/* Signature lines */}
          <div className="mt-6 pt-4 border-t border-dashed border-gray-400 space-y-5 text-[10px] text-gray-600">
            <div>
              <p className="mb-5">Signature du client :</p>
              <div className="border-b border-gray-400 w-full" />
            </div>
            <div>
              <p className="mb-5">Signature du caissier :</p>
              <div className="border-b border-gray-400 w-full" />
            </div>
            <p className="text-center text-gray-400 mt-2 leading-relaxed">
              Je reconnais avoir pris les articles ci-dessus et m'engage à régler le solde dû dans les délais convenus.
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 bg-black text-white py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-800 font-medium transition"
          >
            <Printer size={18} /> Imprimer Bon
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

