'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  Phone,
  MapPin,
  CreditCard,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  Banknote,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export interface ManualCreditFormData {
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerCin?: string;
  totalAmount: number;
  depositAmount: number;
  depositMethod: 'cash' | 'card';
  originDate: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  notes?: string;
  status: 'pending' | 'partially_paid' | 'settled';
  remainingBalance: number;
}

interface ManualCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ManualCreditFormData) => Promise<void> | void;
  isSubmitting?: boolean;
}

export default function ManualCreditModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: ManualCreditModalProps) {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCin, setCustomerCin] = useState('');
  const [totalAmountStr, setTotalAmountStr] = useState('');
  const [depositAmountStr, setDepositAmountStr] = useState('0');
  const [depositMethod, setDepositMethod] = useState<'cash' | 'card'>('cash');
  const [originDate, setOriginDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Live calculations
  const parsedTotal = parseFloat(totalAmountStr) || 0;
  const parsedDeposit = parseFloat(depositAmountStr) || 0;
  const remainingBalance = Math.max(0, parsedTotal - parsedDeposit);

  // Auto status calculation
  const computedStatus: 'pending' | 'partially_paid' | 'settled' = useMemo(() => {
    if (parsedTotal <= 0) return 'pending';
    if (parsedDeposit <= 0) return 'pending';
    if (parsedDeposit >= parsedTotal) return 'settled';
    return 'partially_paid';
  }, [parsedTotal, parsedDeposit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validation
    const trimmedName = customerName.trim();
    if (!trimmedName) {
      setValidationError('Le nom complet du client est obligatoire.');
      return;
    }

    const cleanPhone = customerPhone.replace(/\s+/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      setValidationError('Veuillez renseigner un numéro de téléphone valide (au moins 8 chiffres).');
      return;
    }

    if (parsedTotal <= 0) {
      setValidationError('Le montant total de la dette doit être supérieur à 0 DT.');
      return;
    }

    if (parsedDeposit < 0) {
      setValidationError("L'acompte initial ne peut pas être négatif.");
      return;
    }

    if (parsedDeposit > parsedTotal) {
      setValidationError("L'acompte initial ne peut pas dépasser le montant total de la dette.");
      return;
    }

    try {
      await onSubmit({
        customerName: trimmedName,
        customerPhone: cleanPhone,
        customerAddress: customerAddress.trim() || undefined,
        customerCin: customerCin.trim() || undefined,
        totalAmount: parsedTotal,
        depositAmount: parsedDeposit,
        depositMethod,
        originDate,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
        status: computedStatus,
        remainingBalance,
      });
    } catch (err: any) {
      setValidationError(err?.message || "Une erreur est survenue lors de l'enregistrement.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full flex flex-col my-auto border border-gray-100 overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b bg-gradient-to-r from-orange-50 via-white to-orange-50/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-gray-900">
                Saisie Manuelle Ancien Crédit
              </h3>
              <p className="text-xs text-gray-500">
                Dette historique ou report sans code-barres (aucun impact sur le stock)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Section: Identité Client */}
          <div className="space-y-3 bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
            <span className="font-bold text-[11px] uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <User size={13} /> Informations Client
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Nom Complet du Client <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mohamed Ben Salah"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-2.5 bg-white border rounded-xl focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Téléphone (8 chiffres) <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: 98 123 456"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full p-2.5 bg-white border rounded-xl font-mono focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-600 mb-1">
                  Adresse / Ville <span className="text-gray-400 font-normal">(Optionnel)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Hammamet Centre"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full p-2.5 bg-white border rounded-xl focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-600 mb-1">
                  N° CIN <span className="text-gray-400 font-normal">(Optionnel)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: 08123456"
                  value={customerCin}
                  onChange={(e) => setCustomerCin(e.target.value)}
                  className="w-full p-2.5 bg-white border rounded-xl font-mono focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Montants & Acompte */}
          <div className="space-y-3 bg-orange-50/40 p-3.5 rounded-xl border border-orange-100">
            <span className="font-bold text-[11px] uppercase tracking-wider text-orange-900 flex items-center gap-1.5">
              <Banknote size={13} /> Montant & Modalités de la Dette
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-800 mb-1">
                  Montant Total de la Dette (DT) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  placeholder="0.000"
                  value={totalAmountStr}
                  onChange={(e) => setTotalAmountStr(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-orange-200 rounded-xl font-mono text-base font-bold text-gray-900 text-right focus:border-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-800 mb-1">
                  Acompte Initial Déjà Versé (DT)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max={parsedTotal > 0 ? parsedTotal : undefined}
                  placeholder="0.000"
                  value={depositAmountStr}
                  onChange={(e) => setDepositAmountStr(e.target.value)}
                  className="w-full p-2.5 bg-white border rounded-xl font-mono text-base font-semibold text-gray-800 text-right focus:border-orange-500 outline-none"
                />
              </div>
            </div>

            {parsedDeposit > 0 && (
              <div className="bg-white p-2.5 rounded-xl border border-orange-200 flex items-center justify-between gap-3 animate-in fade-in duration-150">
                <span className="font-semibold text-gray-700">Mode de paiement de l'acompte :</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositMethod('cash')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1 ${
                      depositMethod === 'cash'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Banknote size={13} /> Espèces
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositMethod('card')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1 ${
                      depositMethod === 'card'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <CreditCard size={13} /> Carte Bancaire
                  </button>
                </div>
              </div>
            )}

            {/* Live Calculation Pill */}
            <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-gray-500 block text-[11px]">Reste à Payer (Solde Débiteur) :</span>
                <span className="text-lg font-black font-mono text-orange-600">
                  {remainingBalance.toFixed(3)} DT
                </span>
              </div>
              <div className="text-right">
                <span className="text-gray-500 block text-[11px]">Statut initial :</span>
                <span
                  className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                    computedStatus === 'settled'
                      ? 'bg-emerald-100 text-emerald-800'
                      : computedStatus === 'partially_paid'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}
                >
                  {computedStatus === 'settled' ? (
                    <>
                      <CheckCircle2 size={12} /> Soldé
                    </>
                  ) : computedStatus === 'partially_paid' ? (
                    <>
                      <Clock size={12} /> Partiellement réglé
                    </>
                  ) : (
                    <>
                      <Clock size={12} /> Non payé
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Dates & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <Calendar size={13} /> Date d'Origine de la Dette
              </label>
              <input
                type="date"
                required
                value={originDate}
                onChange={(e) => setOriginDate(e.target.value)}
                className="w-full p-2.5 bg-white border rounded-xl font-mono focus:ring-1 focus:ring-orange-500 outline-none"
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                Permet d'enregistrer la date exacte du carnet papier
              </span>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <Calendar size={13} /> Date d'Échéance Prévue
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-2.5 bg-white border rounded-xl font-mono focus:ring-1 focus:ring-orange-500 outline-none"
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                Date convenue pour le règlement (optionnel)
              </span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1 flex items-center gap-1">
              <FileText size={13} /> Notes & Détails de la Dette Historique
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Ancien carnet 2024 page 14 — Solde reporté sans code-barres"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-white border rounded-xl focus:ring-1 focus:ring-orange-500 outline-none resize-none"
            />
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-3 border-t flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 border rounded-xl font-semibold text-gray-700 hover:bg-gray-100 transition text-center disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <ShieldCheck size={14} />
              <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer la Dette'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
