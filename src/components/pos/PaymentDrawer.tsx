'use client';

import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, Split, CheckCircle2 } from 'lucide-react';
import { playBeep } from '@/utils/posAudio';

interface PaymentDrawerProps {
  isOpen: boolean;
  totalAmount: number;
  initialDiscount?: number;
  exchangeCredit?: number;
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
  initialDiscount = 0,
  exchangeCredit = 0,
  onClose,
  onConfirmPayment,
}: PaymentDrawerProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('cash');
  const [discountInput, setDiscountInput] = useState<string>(
    initialDiscount > 0 ? initialDiscount.toFixed(3) : '0'
  );
  const [cashTenderedInput, setCashTenderedInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isCashCustomizedRef = React.useRef(false);

  const discount = Math.max(0, parseFloat(discountInput) || 0);
  const effectiveTotal = Math.max(0, totalAmount - exchangeCredit);
  const finalAmount = Math.max(0, effectiveTotal - discount);
  const cashTendered = parseFloat(cashTenderedInput) || 0;
  const changeDue = Math.max(0, cashTendered - finalAmount);

  // Handle discount change with smart sync for cashTenderedInput
  const handleDiscountChange = (newDiscountStr: string) => {
    setDiscountInput(newDiscountStr);
    const newDiscount = Math.max(0, parseFloat(newDiscountStr) || 0);
    const newFinal = Math.max(0, effectiveTotal - newDiscount);

    // If user hasn't typed an arbitrary tender amount, keep tender aligned with final net
    if (!isCashCustomizedRef.current) {
      setCashTenderedInput(newFinal.toFixed(3));
    }
  };

  // Reset and initialize fields only when the drawer opens
  useEffect(() => {
    if (isOpen) {
      isCashCustomizedRef.current = false;
      const initDisc = initialDiscount > 0 ? initialDiscount.toFixed(3) : '0';
      setDiscountInput(initDisc);
      const net = Math.max(0, totalAmount - exchangeCredit - (parseFloat(initDisc) || 0));
      setCashTenderedInput(net.toFixed(3));
      setErrorMsg(null);
    }
  }, [isOpen, totalAmount, exchangeCredit, initialDiscount]);

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/60 backdrop-blur-xs p-0 sm:p-0">
      <div className="bg-white w-full sm:max-w-lg h-[92vh] sm:h-full shadow-2xl flex flex-col p-4 sm:p-6 rounded-t-2xl sm:rounded-none animate-in slide-in-from-bottom sm:slide-in-from-right duration-200 overflow-y-auto">
        <div className="flex justify-between items-center pb-3 sm:pb-4 border-b">
          <div>
            <h3 className="font-bold text-lg sm:text-xl text-gray-900">Encaissement (F9)</h3>
            <p className="text-xs text-gray-500">Réglez la vente et imprimez le ticket</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between mt-4 sm:mt-6">
          <div className="space-y-4 sm:space-y-6">
            {/* Total Recap Card */}
            <div className="bg-gray-50 p-3.5 sm:p-4 rounded-xl border border-gray-200 space-y-2">
              <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                <span>Sous-total:</span>
                <span className="font-mono font-medium">{totalAmount.toFixed(3)} DT</span>
              </div>
              {exchangeCredit > 0 && (
                <div className="flex justify-between text-xs sm:text-sm text-indigo-700 font-semibold bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                  <span>Avoir d'échange appliqué:</span>
                  <span className="font-mono">-{exchangeCredit.toFixed(3)} DT</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-gray-600 font-medium">Remise (DT):</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={discountInput}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                  className="w-28 text-right font-mono p-1.5 border rounded-lg bg-white text-sm focus:ring-1 focus:ring-black"
                />
              </div>
              <div className="flex justify-between text-lg sm:text-xl font-extrabold text-gray-950 pt-2 border-t">
                <span>Net à Payer:</span>
                <span className="font-mono text-emerald-600">{finalAmount.toFixed(3)} DT</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Mode de Paiement
              </label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-2.5 sm:p-3 border rounded-xl flex flex-col items-center gap-1.5 transition min-h-[56px] justify-center ${
                    paymentMethod === 'cash'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <Banknote size={18} />
                  <span className="text-[11px] sm:text-xs font-semibold">Espèces</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-2.5 sm:p-3 border rounded-xl flex flex-col items-center gap-1.5 transition min-h-[56px] justify-center ${
                    paymentMethod === 'card'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <CreditCard size={18} />
                  <span className="text-[11px] sm:text-xs font-semibold">Carte</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('split')}
                  className={`p-2.5 sm:p-3 border rounded-xl flex flex-col items-center gap-1.5 transition min-h-[56px] justify-center ${
                    paymentMethod === 'split'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <Split size={18} />
                  <span className="text-[11px] sm:text-xs font-semibold">Mixte</span>
                </button>
              </div>
            </div>

            {/* Cash Tendered Calculation */}
            {paymentMethod === 'cash' && (
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 sm:p-4 rounded-xl space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-emerald-950 mb-1">
                    Espèces Remises par le Client (DT):
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={cashTenderedInput}
                    onChange={(e) => {
                      isCashCustomizedRef.current = true;
                      setCashTenderedInput(e.target.value);
                    }}
                    autoFocus
                    className="w-full text-xl sm:text-2xl font-mono font-bold text-right p-2.5 sm:p-3 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {/* Quick Cash Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[10, 20, 50, 100].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCashTenderedInput(val.toFixed(3))}
                      className="px-2.5 py-1 text-xs font-mono font-semibold bg-white border border-emerald-300 rounded hover:bg-emerald-100 transition text-emerald-900"
                    >
                      {val} DT
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCashTenderedInput(finalAmount.toFixed(3))}
                    className="px-2.5 py-1 text-xs font-mono font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
                  >
                    Montant Exact
                  </button>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                  <span className="font-semibold text-emerald-900 text-xs sm:text-sm">Monnaie à rendre:</span>
                  <span className="font-mono text-xl sm:text-2xl font-extrabold text-emerald-800">
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

          <div className="pt-4 sm:pt-6 border-t flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium text-sm transition text-center"
            >
              Annuler (Esc)
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:flex-1 bg-black text-white py-3.5 sm:py-3 rounded-xl hover:bg-gray-800 font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg min-h-[46px]"
            >
              {isSubmitting ? (
                <span>Validation en cours...</span>
              ) : (
                <>
                  <CheckCircle2 size={18} /> Valider ({finalAmount.toFixed(3)} DT)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

