'use client';

import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, Split, CheckCircle2 } from 'lucide-react';
import { playBeep } from '@/utils/posAudio';

interface PaymentDrawerProps {
  isOpen: boolean;
  totalAmount: number;
  onClose: () => void;
  onConfirmPayment: (paymentData: {
    paymentMethod: 'cash' | 'card' | 'split';
    discount: number;
    cashTendered?: number;
    changeDue?: number;
  }) => Promise<void>;
}

export default function PaymentDrawer({
  isOpen,
  totalAmount,
  onClose,
  onConfirmPayment,
}: PaymentDrawerProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('cash');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [cashTenderedInput, setCashTenderedInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const discount = Math.max(0, parseFloat(discountInput) || 0);
  const finalAmount = Math.max(0, totalAmount - discount);
  const cashTendered = parseFloat(cashTenderedInput) || 0;
  const changeDue = Math.max(0, cashTendered - finalAmount);

  useEffect(() => {
    if (isOpen) {
      setCashTenderedInput(finalAmount.toFixed(3));
      setErrorMsg(null);
    }
  }, [isOpen, finalAmount]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (discount > totalAmount) {
      setErrorMsg('La remise ne peut pas dépasser le montant total');
      playBeep('error');
      return;
    }

    if (paymentMethod === 'cash' && cashTendered < finalAmount) {
      setErrorMsg('Le montant reçu en espèces est insuffisant');
      playBeep('error');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmPayment({
        paymentMethod,
        discount,
        cashTendered: paymentMethod === 'cash' ? cashTendered : undefined,
        changeDue: paymentMethod === 'cash' ? changeDue : undefined,
      });
      playBeep('success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors du règlement');
      playBeep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col p-6 animate-in slide-in-from-right duration-200">
        <div className="flex justify-between items-center pb-4 border-b">
          <div>
            <h3 className="font-bold text-xl text-gray-900">Encaissement (F9)</h3>
            <p className="text-xs text-gray-500">Réglez la vente et imprimez le ticket</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between mt-6">
          <div className="space-y-6">
            {/* Total Recap Card */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Sous-total:</span>
                <span className="font-mono">{totalAmount.toFixed(3)} DT</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Remise (DT):</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="w-28 text-right font-mono p-1 border rounded bg-white text-sm focus:ring-1 focus:ring-black"
                />
              </div>
              <div className="flex justify-between text-xl font-extrabold text-gray-950 pt-2 border-t">
                <span>Net à Payer:</span>
                <span className="font-mono text-emerald-600">{finalAmount.toFixed(3)} DT</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Mode de Paiement
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition ${
                    paymentMethod === 'cash'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <Banknote size={20} />
                  <span className="text-xs font-semibold">Espèces</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition ${
                    paymentMethod === 'card'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <CreditCard size={20} />
                  <span className="text-xs font-semibold">Carte Bancaire</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('split')}
                  className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition ${
                    paymentMethod === 'split'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <Split size={20} />
                  <span className="text-xs font-semibold">Mixte</span>
                </button>
              </div>
            </div>

            {/* Cash Tendered Calculation */}
            {paymentMethod === 'cash' && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-emerald-950 mb-1">
                    Espèces Remises par le Client (DT):
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={cashTenderedInput}
                    onChange={(e) => setCashTenderedInput(e.target.value)}
                    autoFocus
                    className="w-full text-2xl font-mono font-bold text-right p-3 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                  <span className="font-semibold text-emerald-900 text-sm">Monnaie à rendre:</span>
                  <span className="font-mono text-2xl font-extrabold text-emerald-800">
                    {changeDue.toFixed(3)} DT
                  </span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}
          </div>

          <div className="pt-6 border-t flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium text-sm transition"
            >
              Annuler (Esc)
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-black text-white py-3 rounded-xl hover:bg-gray-800 font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg"
            >
              {isSubmitting ? (
                <span>Validation en cours...</span>
              ) : (
                <>
                  <CheckCircle2 size={18} /> Valider la Vente ({finalAmount.toFixed(3)} DT)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

