'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';
import ManualCreditModal, { ManualCreditFormData } from '@/components/pos/ManualCreditModal';
import {
  X,
  Search,
  RefreshCw,
  Banknote,
  CreditCard,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Wallet,
  RotateCcw,
  Minus,
  Plus,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface CreditItem {
  id: string;
  credit_id: string;
  variant_id: string;
  product_name: string;
  sku: string;
  size: string | null;
  color: string | null;
  quantity: number;
  returned_quantity: number;
  unit_price: number;
  subtotal: number;
}

interface CreditPayment {
  id: string;
  amount: number;
  payment_method: 'cash' | 'card';
  created_at: string;
}

interface CustomerCredit {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  total_amount: number;
  deposit_amount: number;
  remaining_balance: number;
  status: 'pending' | 'partially_paid' | 'settled' | 'cancelled';
  due_date: string | null;
  notes: string | null;
  created_at: string;
  credit_items?: CreditItem[];
  credit_payments?: CreditPayment[];
}

type StatusFilter = 'all' | 'pending' | 'partially_paid' | 'settled';

interface PaymentModalState {
  credit: CustomerCredit;
  amount: string;
  method: 'cash' | 'card';
  notes: string;
  isSubmitting: boolean;
  error: string | null;
}

interface ReturnModalState {
  credit: CustomerCredit;
  item: CreditItem;
  quantity: number;
  isSubmitting: boolean;
  error: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:         { label: 'Non payé',           color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  partially_paid:  { label: 'Partiellement réglé', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200'   },
  settled:         { label: 'Soldé',              color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  cancelled:       { label: 'Annulé',             color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-200'   },
};

// ── Main Component ───────────────────────────────────────────────────────────

interface CreditLedgerProps {
  /** When used as a full-page panel (inventory tab) pass nothing.
   *  When used as a modal overlay from POS, pass onClose. */
  onClose?: () => void;
  currentUserId?: string;
  /** Keeps the POS in-memory stock cache in sync after a credit return. */
  onCreditReturned?: (variantId: string, quantity: number) => void;
  /** Notifies POS that a cash/card credit payment was recorded. */
  onCreditPaymentRecorded?: () => void;
}

export default function CreditLedger({
  onClose,
  currentUserId,
  onCreditReturned,
  onCreditPaymentRecorded,
}: CreditLedgerProps) {
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<PaymentModalState | null>(null);
  const [returnModal, setReturnModal] = useState<ReturnModalState | null>(null);
  const [returnNotice, setReturnNotice] = useState<string | null>(null);
  const [isManualCreditModalOpen, setIsManualCreditModalOpen] = useState(false);
  const [isManualCreditSubmitting, setIsManualCreditSubmitting] = useState(false);

  // KPI derived
  const totalOutstanding = credits
    .filter((c) => c.status !== 'settled' && c.status !== 'cancelled')
    .reduce((s, c) => s + c.remaining_balance, 0);

  const totalRecoveredThisMonth = (() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return credits.flatMap((c) => c.credit_payments ?? [])
      .filter((p) => p.created_at >= monthStart)
      .reduce((s, p) => s + p.amount, 0);
  })();

  const totalDebtors = credits.filter(
    (c) => c.status !== 'settled' && c.status !== 'cancelled'
  ).length;

  // ── Fetch ──────────────────────────────────────────────────────────────

  const fetchCredits = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_credits')
        .select(`
          *,
          credit_items (
            id, credit_id, variant_id, product_name, sku, size, color,
            quantity, returned_quantity, unit_price, subtotal
          ),
          credit_payments (
            id, amount, payment_method, created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCredits((data as CustomerCredit[]) ?? []);
    } catch (err) {
      console.error('CreditLedger fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // ── Filtered list ──────────────────────────────────────────────────────

  const filtered = credits.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.customer_name.toLowerCase().includes(q) ||
      c.customer_phone.includes(q);
    const matchesStatus =
      statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ── Manual Old Credit insertion handler ───────────────────────────────
  const handleManualCreditSubmit = async (formData: ManualCreditFormData) => {
    setIsManualCreditSubmitting(true);
    try {
      // 1. Resolve cashier ID from props or auth session
      let cashierId = currentUserId ?? null;
      if (!cashierId) {
        const { data: { user } } = await supabase.auth.getUser();
        cashierId = user?.id ?? null;
      }

      // 2. Format historic creation timestamp
      const createdAtTimestamp = formData.originDate
        ? new Date(formData.originDate + 'T12:00:00Z').toISOString()
        : new Date().toISOString();

      // 3. Insert customer_credits record (no stock deduction!)
      const { data: newCredit, error: creditError } = await supabase
        .from('customer_credits')
        .insert({
          customer_name: formData.customerName,
          customer_phone: formData.customerPhone,
          customer_address: formData.customerAddress ?? null,
          customer_cin: formData.customerCin ?? null,
          total_amount: formData.totalAmount,
          deposit_amount: formData.depositAmount,
          remaining_balance: formData.remainingBalance,
          status: formData.status,
          due_date: formData.dueDate ?? null,
          notes: formData.notes ?? null,
          cashier_id: cashierId,
          created_at: createdAtTimestamp,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (creditError) throw creditError;

      // 4. If deposit > 0, insert credit payment record linked to this credit
      if (formData.depositAmount > 0 && newCredit?.id) {
        const { error: paymentError } = await supabase
          .from('credit_payments')
          .insert({
            credit_id: newCredit.id,
            amount: formData.depositAmount,
            payment_method: formData.depositMethod,
            received_by: cashierId,
            notes: "Acompte initial (Ancien Crédit)",
            created_at: createdAtTimestamp,
          });

        if (paymentError) {
          console.error('Initial deposit payment registration error:', paymentError);
        } else {
          onCreditPaymentRecorded?.();
        }
      }

      setIsManualCreditModalOpen(false);
      await fetchCredits();
    } catch (err: any) {
      console.error('Manual credit submission error:', err);
      throw err;
    } finally {
      setIsManualCreditSubmitting(false);
    }
  };

  // ── Payment submit ─────────────────────────────────────────────────────

  const handlePaymentSubmit = async () => {
    if (!paymentModal) return;
    const amount = parseFloat(paymentModal.amount);
    if (!amount || amount <= 0) {
      setPaymentModal((p) => p && ({ ...p, error: 'Montant invalide' }));
      return;
    }
    if (amount > paymentModal.credit.remaining_balance) {
      setPaymentModal((p) =>
        p && ({ ...p, error: `Le montant dépasse le solde restant (${paymentModal.credit.remaining_balance.toFixed(3)} DT)` })
      );
      return;
    }

    setPaymentModal((p) => p && ({ ...p, isSubmitting: true, error: null }));
    try {
      const { error } = await supabase.rpc('record_credit_payment', {
        p_credit_id:      paymentModal.credit.id,
        p_amount:         amount,
        p_payment_method: paymentModal.method,
        p_received_by:    currentUserId ?? null,
        p_notes:          paymentModal.notes.trim() || null,
      });
      if (error) throw error;
      setPaymentModal(null);
      onCreditPaymentRecorded?.();
      await fetchCredits();
    } catch (err: any) {
      setPaymentModal((p) => p && ({ ...p, isSubmitting: false, error: err.message }));
    }
  };

  // ── Credit item return ─────────────────────────────────────────────────

  const openReturnModal = (credit: CustomerCredit, item: CreditItem) => {
    const returnable = item.quantity - (item.returned_quantity ?? 0);
    if (returnable <= 0) return;
    setReturnModal({
      credit,
      item,
      quantity: returnable,
      isSubmitting: false,
      error: null,
    });
  };

  const handleReturnSubmit = async () => {
    if (!returnModal) return;
    const { item, quantity } = returnModal;
    const returnable = item.quantity - (item.returned_quantity ?? 0);

    if (quantity <= 0) {
      setReturnModal((m) => m && ({ ...m, error: 'Quantité invalide' }));
      return;
    }
    if (quantity > returnable) {
      setReturnModal((m) =>
        m && ({ ...m, error: `Quantité maximale retournable : ${returnable}` })
      );
      return;
    }

    const returnValue = item.unit_price * quantity;
    setReturnModal((m) => m && ({ ...m, isSubmitting: true, error: null }));

    try {
      const { data, error } = await supabase.rpc('return_credit_item', {
        p_credit_item_id: item.id,
        p_quantity: quantity,
        p_returned_by: currentUserId ?? null,
        p_reason: 'Retour article depuis le carnet de crédit',
      });
      if (error) throw error;

      const result = (data ?? {}) as {
        new_remaining_balance?: number;
        new_status?: string;
      };

      setReturnModal(null);
      setReturnNotice(
        `« ${item.product_name} » (×${quantity}) retourné. Stock réintégré et solde débiteur réduit de ${returnValue.toFixed(3)} DT — aucune sortie de caisse.` +
          (result.new_status === 'settled'
            ? ' Le crédit est désormais soldé.'
            : '')
      );
      onCreditReturned?.(item.variant_id, quantity);
      await fetchCredits();
    } catch (err: any) {
      setReturnModal((m) =>
        m && ({ ...m, isSubmitting: false, error: err.message })
      );
    }
  };

  // ── Status filter pills ────────────────────────────────────────────────

  const FILTER_PILLS: { key: StatusFilter; label: string }[] = [
    { key: 'all',           label: 'Tous'                  },
    { key: 'pending',       label: 'En cours (Non payé)'   },
    { key: 'partially_paid',label: 'Partiellement réglé'   },
    { key: 'settled',       label: 'Soldé'                 },
  ];

  // ── Render ─────────────────────────────────────────────────────────────

  const inner = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 border-b bg-white shrink-0">
        <div>
          <h2 className="font-black text-lg sm:text-xl text-gray-900 flex items-center gap-2">
            <Wallet size={20} className="text-orange-500" />
            Carnet de Crédit
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Suivi des ventes à terme et encaissements</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsManualCreditModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
            title="Enregistrer manuellement un ancien crédit ou une dette historique"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Ancien Crédit (Dette Historique)</span>
            <span className="sm:hidden">Ancien Crédit</span>
          </button>
          <button
            onClick={fetchCredits}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title="Rafraîchir"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 p-4 sm:p-5 border-b bg-gray-50 shrink-0">
        <div className="bg-white rounded-xl border p-3 sm:p-4 flex flex-col gap-1">
          <p className="text-[10px] sm:text-xs font-bold uppercase text-gray-500 leading-tight">
            Total Dettes en cours
          </p>
          <p className="text-base sm:text-xl font-black text-orange-600 font-mono">
            {totalOutstanding.toFixed(3)} <span className="text-xs font-normal text-gray-500">DT</span>
          </p>
          <AlertCircle size={14} className="text-orange-400 mt-auto" />
        </div>

        <div className="bg-white rounded-xl border p-3 sm:p-4 flex flex-col gap-1">
          <p className="text-[10px] sm:text-xs font-bold uppercase text-gray-500 leading-tight">
            Encaissé ce mois
          </p>
          <p className="text-base sm:text-xl font-black text-emerald-600 font-mono">
            {totalRecoveredThisMonth.toFixed(3)} <span className="text-xs font-normal text-gray-500">DT</span>
          </p>
          <TrendingUp size={14} className="text-emerald-400 mt-auto" />
        </div>

        <div className="bg-white rounded-xl border p-3 sm:p-4 flex flex-col gap-1">
          <p className="text-[10px] sm:text-xs font-bold uppercase text-gray-500 leading-tight">
            Clients débiteurs
          </p>
          <p className="text-base sm:text-xl font-black text-gray-900">
            {totalDebtors}
          </p>
          <Users size={14} className="text-gray-400 mt-auto" />
        </div>
      </div>

      {/* Search + Filter */}
      <div className="p-4 sm:p-5 border-b bg-white shrink-0 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom ou téléphone..."
            className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 focus:bg-white"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setStatusFilter(pill.key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition border ${
                statusFilter === pill.key
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Credit list */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
        {returnNotice && (
          <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1">{returnNotice}</div>
            <button
              onClick={() => setReturnNotice(null)}
              className="p-0.5 text-emerald-600 hover:text-emerald-900"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={22} className="animate-spin mr-2" /> Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <Wallet size={40} className="text-gray-200" />
            <p className="text-sm">Aucun crédit trouvé</p>
          </div>
        ) : (
          filtered.map((credit) => {
            const st = STATUS_LABELS[credit.status] ?? STATUS_LABELS.pending;
            const isExpanded = expandedId === credit.id;

            return (
              <div
                key={credit.id}
                className="bg-white border rounded-xl overflow-hidden shadow-xs"
              >
                {/* Credit row header */}
                <div className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm text-gray-900">{credit.customer_name}</p>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.bg} ${st.color}`}
                        >
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">+216 {credit.customer_phone}</p>
                      {credit.due_date && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          <Clock size={10} className="inline mr-1" />
                          Échéance : {credit.due_date}
                        </p>
                      )}
                      {credit.notes && (
                        <p className="text-xs text-gray-400 italic mt-0.5 truncate">{credit.notes}</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">Total</p>
                      <p className="font-mono font-semibold text-sm">{credit.total_amount.toFixed(3)} DT</p>
                      {credit.remaining_balance > 0 && (
                        <>
                          <p className="text-[10px] text-gray-400 mt-1">Reste</p>
                          <p className="font-mono font-black text-base text-orange-600">
                            {credit.remaining_balance.toFixed(3)} DT
                          </p>
                        </>
                      )}
                      {credit.status === 'settled' && (
                        <p className="text-xs text-emerald-600 font-bold flex items-center gap-1 justify-end mt-1">
                          <CheckCircle2 size={12} /> Soldé
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    {credit.status !== 'settled' && credit.status !== 'cancelled' && (
                      <button
                        onClick={() =>
                          setPaymentModal({
                            credit,
                            amount: '',
                            method: 'cash',
                            notes: '',
                            isSubmitting: false,
                            error: null,
                          })
                        }
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition"
                      >
                        <Banknote size={13} /> Encaisser un Règlement
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : credit.id)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-2 border rounded-lg hover:bg-gray-50 transition"
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      Détails
                    </button>
                  </div>
                </div>

                {/* Expandable: items + payment history */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-3 sm:p-4 space-y-4">
                    {/* Items */}
                    {(credit.credit_items?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-500 mb-2">Articles</p>
                        <div className="space-y-1.5">
                          {credit.credit_items!.map((item) => {
                            const returned = item.returned_quantity ?? 0;
                            const returnable = item.quantity - returned;
                            const canReturn =
                              returnable > 0 &&
                              credit.status !== 'settled' &&
                              credit.status !== 'cancelled';

                            return (
                              <div
                                key={item.id}
                                className="bg-white border rounded-lg px-3 py-2 text-xs space-y-2"
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <p className="font-semibold text-gray-800">{item.product_name}</p>
                                    <p className="text-gray-400 font-mono">
                                      {item.sku}
                                      {item.size ? ` • ${item.size}` : ''}
                                      {item.color ? ` • ${item.color}` : ''}
                                    </p>
                                    <p className="text-gray-500">
                                      {item.quantity} × {item.unit_price.toFixed(3)} DT
                                    </p>
                                    {returned > 0 && (
                                      <p className="text-[10px] font-semibold text-amber-600 mt-0.5">
                                        {returned >= item.quantity
                                          ? 'Retourné intégralement'
                                          : `${returned} déjà retourné(s) sur ${item.quantity}`}
                                      </p>
                                    )}
                                  </div>
                                  <p className="font-mono font-bold text-gray-700">
                                    {item.subtotal.toFixed(3)} DT
                                  </p>
                                </div>

                                {canReturn && (
                                  <button
                                    type="button"
                                    onClick={() => openReturnModal(credit, item)}
                                    className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-amber-300 bg-amber-50 text-amber-800 rounded-lg font-semibold hover:bg-amber-100 transition"
                                    title="Réintègre le stock et réduit le solde débiteur, sans sortie de caisse"
                                  >
                                    <RotateCcw size={12} /> Retourner cet article
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Payment history */}
                    {(credit.credit_payments?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-500 mb-2">
                          Historique des règlements
                        </p>
                        <div className="space-y-1.5">
                          {credit.credit_payments!
                            .slice()
                            .sort(
                              (a, b) =>
                                new Date(b.created_at).getTime() -
                                new Date(a.created_at).getTime()
                            )
                            .map((payment) => (
                              <div
                                key={payment.id}
                                className="flex justify-between items-center bg-white border border-emerald-100 rounded-lg px-3 py-2 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  {payment.payment_method === 'cash' ? (
                                    <Banknote size={12} className="text-emerald-600" />
                                  ) : (
                                    <CreditCard size={12} className="text-blue-600" />
                                  )}
                                  <div>
                                    <p className="font-semibold text-gray-700">
                                      {payment.payment_method === 'cash' ? 'Espèces' : 'Carte'}
                                    </p>
                                    <p className="text-gray-400">
                                      {new Date(payment.created_at).toLocaleString('fr-TN')}
                                    </p>
                                  </div>
                                </div>
                                <p className="font-mono font-bold text-emerald-700">
                                  +{payment.amount.toFixed(3)} DT
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ── Payment modal overlay ──────────────────────────────────────────────

  const paymentModalJsx = paymentModal && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-base text-gray-900">Encaisser un Règlement</h3>
          <button
            onClick={() => setPaymentModal(null)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Credit summary */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 text-sm">
          <p className="font-bold text-gray-800">{paymentModal.credit.customer_name}</p>
          <p className="text-gray-500 text-xs font-mono">+216 {paymentModal.credit.customer_phone}</p>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-500">Reste à payer:</span>
            <span className="font-mono font-black text-orange-700">
              {paymentModal.credit.remaining_balance.toFixed(3)} DT
            </span>
          </div>
        </div>

        {/* Amount */}
        <div className="mb-3">
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Montant reçu (DT) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            max={paymentModal.credit.remaining_balance}
            value={paymentModal.amount}
            onChange={(e) => setPaymentModal((p) => p && ({ ...p, amount: e.target.value }))}
            placeholder={`Max ${paymentModal.credit.remaining_balance.toFixed(3)} DT`}
            autoFocus
            className="w-full px-3 py-3 border rounded-xl text-lg font-mono font-bold text-right focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          {/* Quick amount buttons */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {[10, 20, 50].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPaymentModal((p) => p && ({ ...p, amount: v.toFixed(3) }))}
                className="px-2 py-1 text-xs font-mono font-semibold bg-gray-100 border rounded hover:bg-gray-200 transition"
              >
                {v} DT
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setPaymentModal((p) =>
                  p && ({ ...p, amount: p.credit.remaining_balance.toFixed(3) })
                )
              }
              className="px-2 py-1 text-xs font-mono font-semibold bg-orange-500 text-white rounded hover:bg-orange-600 transition"
            >
              Tout solder
            </button>
          </div>
        </div>

        {/* Payment method */}
        <div className="mb-3">
          <label className="block text-xs font-bold text-gray-700 mb-1">Mode de paiement</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentModal((p) => p && ({ ...p, method: 'cash' }))}
              className={`py-2.5 border rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition ${
                paymentModal.method === 'cash'
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 hover:border-gray-400 text-gray-700'
              }`}
            >
              <Banknote size={14} /> Espèces
            </button>
            <button
              type="button"
              onClick={() => setPaymentModal((p) => p && ({ ...p, method: 'card' }))}
              className={`py-2.5 border rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition ${
                paymentModal.method === 'card'
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 hover:border-gray-400 text-gray-700'
              }`}
            >
              <CreditCard size={14} /> Carte
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Notes <span className="font-normal text-gray-400">(optionnel)</span>
          </label>
          <input
            type="text"
            value={paymentModal.notes}
            onChange={(e) => setPaymentModal((p) => p && ({ ...p, notes: e.target.value }))}
            placeholder="Ex: Versement partiel, reste pour la semaine prochaine..."
            className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {paymentModal.error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {paymentModal.error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPaymentModal(null)}
            disabled={paymentModal.isSubmitting}
            className="flex-1 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium text-sm transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handlePaymentSubmit}
            disabled={paymentModal.isSubmitting || !paymentModal.amount}
            className="flex-1 bg-orange-500 text-white py-3 rounded-xl hover:bg-orange-600 font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {paymentModal.isSubmitting ? (
              <span>Enregistrement...</span>
            ) : (
              <>
                <CheckCircle2 size={16} /> Confirmer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Credit item return modal ───────────────────────────────────────────

  const returnModalJsx = returnModal && (() => {
    const returnable =
      returnModal.item.quantity - (returnModal.item.returned_quantity ?? 0);
    const returnValue = returnModal.item.unit_price * returnModal.quantity;
    const projectedBalance = Math.max(
      0,
      returnModal.credit.remaining_balance - returnValue
    );

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
              <RotateCcw size={17} className="text-amber-600" />
              Retourner un article
            </h3>
            <button
              onClick={() => setReturnModal(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
            >
              <X size={18} />
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm">
            <p className="font-bold text-gray-800">{returnModal.credit.customer_name}</p>
            <p className="text-gray-500 text-xs font-mono">
              +216 {returnModal.credit.customer_phone}
            </p>
            <div className="mt-2 pt-2 border-t border-amber-200">
              <p className="font-semibold text-gray-800">{returnModal.item.product_name}</p>
              <p className="text-gray-400 text-xs font-mono">
                {returnModal.item.sku}
                {returnModal.item.size ? ` • ${returnModal.item.size}` : ''}
                {returnModal.item.color ? ` • ${returnModal.item.color}` : ''}
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                {returnModal.item.unit_price.toFixed(3)} DT / unité
              </p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Quantité à retourner
            </label>
            <div className="flex items-center justify-between border rounded-xl px-3 py-2">
              <button
                type="button"
                onClick={() =>
                  setReturnModal((m) =>
                    m && ({ ...m, quantity: Math.max(1, m.quantity - 1) })
                  )
                }
                disabled={returnModal.quantity <= 1 || returnModal.isSubmitting}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition"
              >
                <Minus size={16} />
              </button>
              <span className="font-mono font-black text-lg">
                {returnModal.quantity}
                <span className="text-xs font-normal text-gray-400"> / {returnable}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  setReturnModal((m) =>
                    m && ({ ...m, quantity: Math.min(returnable, m.quantity + 1) })
                  )
                }
                disabled={returnModal.quantity >= returnable || returnModal.isSubmitting}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="bg-gray-50 border rounded-xl p-3 mb-4 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Valeur retournée :</span>
              <span className="font-mono font-bold text-amber-700">
                {returnValue.toFixed(3)} DT
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Solde débiteur actuel :</span>
              <span className="font-mono">{returnModal.credit.remaining_balance.toFixed(3)} DT</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t">
              <span className="text-gray-500">Nouveau solde :</span>
              <span className="font-mono font-black text-emerald-700">
                {projectedBalance.toFixed(3)} DT
              </span>
            </div>
          </div>

          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded-lg flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-emerald-600" />
            <span>
              L'article est réintégré au stock et sa valeur est déduite du solde
              débiteur. <strong>Aucune sortie de caisse</strong> n'est effectuée.
            </span>
          </div>

          {returnModal.error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {returnModal.error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setReturnModal(null)}
              disabled={returnModal.isSubmitting}
              className="flex-1 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium text-sm transition"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleReturnSubmit}
              disabled={returnModal.isSubmitting}
              className="flex-1 bg-amber-600 text-white py-3 rounded-xl hover:bg-amber-700 font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {returnModal.isSubmitting ? (
                <span>Enregistrement...</span>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Confirmer le retour
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  })();

  // ── Wrapper: modal overlay from POS or inline panel from inventory ─────

  if (onClose) {
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full sm:max-w-xl h-[94vh] sm:h-full shadow-2xl flex flex-col rounded-t-2xl sm:rounded-none animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
            {inner}
          </div>
        </div>
        {paymentModalJsx}
        {returnModalJsx}
        <ManualCreditModal
          isOpen={isManualCreditModalOpen}
          onClose={() => setIsManualCreditModalOpen(false)}
          onSubmit={handleManualCreditSubmit}
          isSubmitting={isManualCreditSubmitting}
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border shadow-xs flex flex-col min-h-[600px] max-h-[80vh]">
        {inner}
      </div>
      {paymentModalJsx}
      {returnModalJsx}
      <ManualCreditModal
        isOpen={isManualCreditModalOpen}
        onClose={() => setIsManualCreditModalOpen(false)}
        onSubmit={handleManualCreditSubmit}
        isSubmitting={isManualCreditSubmitting}
      />
    </>
  );
}

