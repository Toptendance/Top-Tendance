'use client';

import React, { useState } from 'react';
import { X, Printer, CheckCircle, ShieldAlert, DollarSign, Banknote, CreditCard, ShoppingBag } from 'lucide-react';
import { formatPrice } from '@/utils/currency';
import { DailySalesData } from './DailySalesSummary';

interface ZReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: DailySalesData;
  cashierName?: string;
  cashierRole?: string;
}

export default function ZReportModal({
  isOpen,
  onClose,
  stats,
  cashierName = 'Caissier',
  cashierRole = 'cashier',
}: ZReportModalProps) {
  const [openingFloat, setOpeningFloat] = useState<string>('150.000'); // Default float fond de caisse
  const [closingCashCounted, setClosingCashCounted] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isFinalized, setIsFinalized] = useState(false);

  if (!isOpen) return null;

  const floatVal = parseFloat(openingFloat) || 0;
  const countedCash = parseFloat(closingCashCounted) || 0;
  const expectedCashInDrawer = floatVal + stats.cashTotal;
  const cashDiscrepancy = closingCashCounted ? countedCash - expectedCashInDrawer : 0;

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('fr-TN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const currentTime = new Date().toLocaleTimeString('fr-TN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono">
              Z
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider">Clôture de Caisse (Rapport Z)</h2>
              <p className="text-xs text-gray-400">
                {currentDate} • {currentTime}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content (Printable Region) */}
        <div id="z-report-printable" className="p-6 space-y-6 max-h-[75vh] overflow-y-auto font-sans">
          {/* Identity & Register info */}
          <div className="flex justify-between items-center text-xs border-b pb-3">
            <div>
              <span className="text-gray-500">Boutique: </span>
              <strong className="text-gray-900 font-bold">Top Tendance</strong>
            </div>
            <div>
              <span className="text-gray-500">Agent: </span>
              <strong className="text-gray-900 font-bold">{cashierName}</strong> ({cashierRole})
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">
              1. Bilan Financier de la Journée
            </h3>
            
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Nombre de Ventes Réalisées:</span>
                <span className="font-mono font-bold text-gray-900">{stats.salesCount}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <Banknote size={15} className="text-amber-600" /> Total Espèces (Cash):
                </span>
                <span className="font-mono font-bold text-amber-700">{formatPrice(stats.cashTotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <CreditCard size={15} className="text-blue-600" /> Total Cartes / TPE:
                </span>
                <span className="font-mono font-bold text-blue-700">{formatPrice(stats.cardTotal)}</span>
              </div>
              {stats.splitTotal > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Paiements Mixtes / Split:</span>
                  <span className="font-mono font-bold text-gray-900">{formatPrice(stats.splitTotal)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-base font-black">
                <span className="text-gray-900">Chiffre d'Affaires Brut (TTC):</span>
                <span className="font-mono text-emerald-600">{formatPrice(stats.grossTotal)}</span>
              </div>
            </div>
          </div>

          {/* Cash Drawer Reconciliation */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">
              2. Rapprochement du Tiroir-Caisse
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Fond de caisse initial (DT):
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-1 focus:ring-black outline-none"
                  placeholder="150.000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Espèces comptées en caisse (DT):
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={closingCashCounted}
                  onChange={(e) => setClosingCashCounted(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-1 focus:ring-black outline-none"
                  placeholder="Ex: 850.000"
                />
              </div>
            </div>

            {/* Expected vs Actual Drawer math */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-blue-900">Total théorique attendu en caisse (Fond + Espèces):</span>
                <span className="font-mono font-bold text-blue-950">{formatPrice(expectedCashInDrawer)}</span>
              </div>

              {closingCashCounted && (
                <div className="flex justify-between items-center pt-1.5 border-t border-blue-200 font-bold">
                  <span className="flex items-center gap-1">
                    Écart de Caisse:
                  </span>
                  <span
                    className={`font-mono text-sm ${
                      Math.abs(cashDiscrepancy) < 0.001
                        ? 'text-emerald-700'
                        : cashDiscrepancy > 0
                        ? 'text-blue-700'
                        : 'text-red-600'
                    }`}
                  >
                    {cashDiscrepancy > 0 ? '+' : ''}
                    {formatPrice(cashDiscrepancy)} {Math.abs(cashDiscrepancy) < 0.001 ? '(Parfait)' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Observations / Remarques (Optionnel):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex: Remise fidélité accordée, retour vêtement..."
              className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-1 focus:ring-black outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <Printer size={15} /> Imprimer Ticket Z
          </button>

          <button
            type="button"
            onClick={() => {
              setIsFinalized(true);
              setTimeout(() => {
                onClose();
              }, 1200);
            }}
            className={`w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white rounded-xl transition flex items-center justify-center gap-1.5 shadow-md ${
              isFinalized ? 'bg-emerald-600' : 'bg-black hover:bg-gray-800'
            }`}
          >
            {isFinalized ? (
              <>
                <CheckCircle size={15} /> Caisse Clôturée avec Succès
              </>
            ) : (
              'Valider la Clôture de Journée'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
