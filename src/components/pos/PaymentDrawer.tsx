'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, CreditCard, Banknote, Split, CheckCircle2, Clock } from 'lucide-react';
import { playBeep } from '@/utils/posAudio';

export interface PaymentDrawerCartItem {
  variant_id: string;
  sku: string;
  name: string;
  size: string | null;
  color: string | null;
  unit_price: number;
  quantity: number;
}

interface PaymentDrawerProps {
  isOpen: boolean;
  totalAmount: number;
  initialDiscount?: number;
  exchangeCredit?: number;
  onClose: () => void;
  onConfirmPayment: (paymentData: {
    paymentMethod: 'cash' | 'card' | 'split' | 'credit';
    discount: number;
    cashTendered?: number;
    changeDue?: number;
    creditData?: {
      customerName: string;
      customerPhone: string;
      depositAmount: number;
      depositMethod: 'cash' | 'card';
      dueDate: string;
      notes: string;
    };
  }) => Promise<void>;
}

function isValidTunisianPhone(phone: string): boolean {
  return /^[2345789]\d{7}$/.test(phone.trim());
}

export default function PaymentDrawer({
  isOpen,
  totalAmount,
  initialDiscount = 0,
  exchangeCredit = 0,
  onClose,
  onConfirmPayment,
}: PaymentDrawerProps) {
  // ── Regular payment state ───────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split' | 'credit'>('cash');
  const [discountInput, setDiscountInput] = useState<string>(
    initialDiscount > 0 ? initialDiscount.toFixed(3) : '0'
  );
  const [cashTenderedInput, setCashTenderedInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isCashCustomizedRef = useRef(false);

  // ── Credit payment state ────────────────────────────────────────────────
  const [creditCustomerName, setCreditCustomerName] = useState('');
  const [creditCustomerPhone, setCreditCustomerPhone] = useState('');
  const [creditDepositInput, setCreditDepositInput] = useState('0');
  const [creditDepositMethod, setCreditDepositMethod] = useState<'cash' | 'card'>('cash');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [creditNotes, setCreditNotes] = useState('');

  // ── Derived values ──────────────────────────────────────────────────────
  const discount = Math.max(0, parseFloat(discountInput) || 0);
  const effectiveTotal = Math.max(0, totalAmount - exchangeCredit);
  const finalAmount = Math.max(0, effectiveTotal - discount);
  const cashTendered = parseFloat(cashTenderedInput) || 0;
  const changeDue = Math.max(0, cashTendered - finalAmount);

  const creditDeposit = Math.max(0, parseFloat(creditDepositInput) || 0);
  const creditRemaining = Math.max(0, totalAmount - creditDeposit);

  const handleDiscountChange = (newDiscountStr: string) => {
    setDiscountInput(newDiscountStr);
    const newDiscount = Math.max(0, parseFloat(newDiscountStr) || 0);
    const newFinal = Math.max(0, effectiveTotal - newDiscount);
    if (!isCashCustomizedRef.current) {
      setCashTenderedInput(newFinal.toFixed(3));
    }
  };

  useEffect(() => {
    if (isOpen) {
      isCashCustomizedRef.current = false;
      setPaymentMethod('cash');
      const initDisc = initialDiscount > 0 ? initialDiscount.toFixed(3) : '0';
      setDiscountInput(initDisc);
      const net = Math.max(0, totalAmount - exchangeCredit - (parseFloat(initDisc) || 0));
      setCashTenderedInput(net.toFixed(3));
      setErrorMsg(null);
      setCreditCustomerName('');
      setCreditCustomerPhone('');
      setCreditDepositInput('0');
      setCreditDepositMethod('cash');
      setCreditDueDate('');
      setCreditNotes('');
    }
  }, [isOpen, totalAmount, exchangeCredit, initialDiscount]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (paymentMethod === 'credit') {
      if (!creditCustomerName.trim()) {
        setErrorMsg('Le nom du client est obligatoire');
        playBeep('error');
        return;
      }
      if (!isValidTunisianPhone(creditCustomerPhone)) {
        setErrorMsg('Numéro de téléphone invalide (8 chiffres tunisiens requis)');
        playBeep('error');
        return;
      }
      if (creditDeposit > totalAmount) {
        setErrorMsg("L'acompte ne peut pas dépasser le montant total");
        playBeep('error');
        return;
      }

      setIsSubmitting(true);
      try {
        await onConfirmPayment({
          paymentMethod: 'credit',
          discount: 0,
          creditData: {
            customerName: creditCustomerName.trim(),
            customerPhone: creditCustomerPhone.trim(),
            depositAmount: creditDeposit,
            depositMethod: creditDepositMethod,
            dueDate: creditDueDate,
            notes: creditNotes.trim(),
          },
        });
        playBeep('success');
      } catch (err: any) {
        setErrorMsg(err.message || 'Erreur lors de la vente à crédit');
        playBeep('error');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

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
          <div className="space-y-4 sm:space-y-5">

            {/* ── Payment Method Tabs ── */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Mode de Paiement
              </label>
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-2 sm:p-2.5 border rounded-xl flex flex-col items-center gap-1 transition min-h-[52px] justify-center ${
                    paymentMethod === 'cash'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <Banknote size={16} />
                  <span className="text-[10px] sm:text-xs font-semibold">Espèces</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-2 sm:p-2.5 border rounded-xl flex flex-col items-center gap-1 transition min-h-[52px] justify-center ${
                    paymentMethod === 'card'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <CreditCard size={16} />
                  <span className="text-[10px] sm:text-xs font-semibold">Carte</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('split')}
                  className={`p-2 sm:p-2.5 border rounded-xl flex flex-col items-center gap-1 transition min-h-[52px] justify-center ${
                    paymentMethod === 'split'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <Split size={16} />
                  <span className="text-[10px] sm:text-xs font-semibold">Mixte</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('credit')}
                  className={`p-2 sm:p-2.5 border rounded-xl flex flex-col items-center gap-1 transition min-h-[52px] justify-center ${
                    paymentMethod === 'credit'
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-orange-200 hover:border-orange-400 text-orange-700'
                  }`}
                >
                  <Clock size={16} />
                  <span className="text-[10px] sm:text-xs font-semibold leading-tight text-center">Crédit</span>
                </button>
              </div>
            </div>

            {/* ── CREDIT panel ── */}
            {paymentMethod === 'credit' && (
              <div className="space-y-4">
                {/* Live credit summary */}
                <div className="bg-orange-50 border border-orange-200 p-3.5 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-orange-800 uppercase tracking-wider">
                    Vente à Crédit / Paiement Différé
                  </p>
                  <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                    <span>Montant total articles:</span>
                    <span className="font-mono font-semibold">{totalAmount.toFixed(3)} DT</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm text-emerald-700">
                    <span>Acompte versé aujourd'hui:</span>
                    <span className="font-mono font-semibold">
                      {creditDeposit > 0 ? `-${creditDeposit.toFixed(3)} DT` : '0.000 DT'}
                    </span>
                  </div>
                  <div className="flex justify-between text-base sm:text-lg font-extrabold text-orange-700 pt-2 border-t border-orange-200">
                    <span>Reste à payer plus tard:</span>
                    <span className="font-mono">{creditRemaining.toFixed(3)} DT</span>
                  </div>
                </div>

                {/* Customer name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Nom complet du client <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={creditCustomerName}
                    onChange={(e) => setCreditCustomerName(e.target.value)}
                    placeholder="Ex: Mohamed Ben Ali"
                    className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    autoFocus
                  />
                </div>

                {/* Customer phone */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Numéro de téléphone <span className="text-red-500">*</span>
                    <span className="font-normal text-gray-400 ml-1">(8 chiffres)</span>
                  </label>
                  <div className="flex gap-2 items-center">
                    <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2.5 py-2.5 rounded-lg border border-gray-200 shrink-0">
                      +216
                    </span>
                    <input
                      type="tel"
                      value={creditCustomerPhone}
                      onChange={(e) =>
                        setCreditCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 8))
                      }
                      placeholder="2X XXX XXX"
                      className={`flex-1 px-3 py-2.5 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 ${
                        creditCustomerPhone.length === 8
                          ? isValidTunisianPhone(creditCustomerPhone)
                            ? 'border-emerald-400 focus:ring-emerald-400'
                            : 'border-red-400 focus:ring-red-400'
                          : 'border-gray-200 focus:ring-orange-400'
                      }`}
                      maxLength={8}
                    />
                  </div>
                </div>

                {/* Deposit amount */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Acompte versé aujourd'hui (DT)
                    <span className="font-normal text-gray-400 ml-1">(optionnel, défaut 0.000 DT)</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max={totalAmount}
                    value={creditDepositInput}
                    onChange={(e) => setCreditDepositInput(e.target.value)}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                {/* Deposit method — only shown when deposit > 0 */}
                {creditDeposit > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Mode de paiement de l'acompte
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCreditDepositMethod('cash')}
                        className={`py-2 border rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition ${
                          creditDepositMethod === 'cash'
                            ? 'border-black bg-black text-white'
                            : 'border-gray-200 hover:border-gray-400 text-gray-700'
                        }`}
                      >
                        <Banknote size={14} /> Espèces
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreditDepositMethod('card')}
                        className={`py-2 border rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition ${
                          creditDepositMethod === 'card'
                            ? 'border-black bg-black text-white'
                            : 'border-gray-200 hover:border-gray-400 text-gray-700'
                        }`}
                      >
                        <CreditCard size={14} /> Carte bancaire
                      </button>
                    </div>
                  </div>
                )}

                {/* Due date */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Date d'échéance convenue
                    <span className="font-normal text-gray-400 ml-1">(optionnel)</span>
                  </label>
                  <input
                    type="date"
                    value={creditDueDate}
                    onChange={(e) => setCreditDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Notes / Référence client
                    <span className="font-normal text-gray-400 ml-1">(optionnel)</span>
                  </label>
                  <textarea
                    value={creditNotes}
                    onChange={(e) => setCreditNotes(e.target.value)}
                    placeholder="Ex: Paiement prévu fin du mois, connue de Madame Fatma..."
                    rows={2}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  />
                </div>
              </div>
            )}

            {/* ── REGULAR payment panels ── */}
            {paymentMethod !== 'credit' && (
              <>
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

                {/* Cash Tendered */}
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
                      <span className="font-semibold text-emerald-900 text-xs sm:text-sm">
                        Monnaie à rendre:
                      </span>
                      <span className="font-mono text-xl sm:text-2xl font-extrabold text-emerald-800">
                        {changeDue.toFixed(3)} DT
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}
          </div>

          {/* ── Action buttons ── */}
          <div className="pt-4 sm:pt-6 border-t flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium text-sm transition text-center"
            >
              Annuler (Esc)
            </button>

            {paymentMethod === 'credit' ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:flex-1 bg-orange-500 text-white py-3.5 sm:py-3 rounded-xl hover:bg-orange-600 font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg min-h-[46px]"
              >
                {isSubmitting ? (
                  <span>Enregistrement en cours...</span>
                ) : (
                  <>
                    <Clock size={18} />
                    Valider Vente à Crédit ({totalAmount.toFixed(3)} DT)
                  </>
                )}
              </button>
            ) : (
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
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
