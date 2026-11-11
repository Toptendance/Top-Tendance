'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, 
  ShoppingBag, 
  CreditCard, 
  Banknote, 
  ChevronUp, 
  ChevronDown, 
  RotateCcw,
  Receipt,
  Printer,
  ChevronRight,
  Clock,
  Layers,
  ArrowRightLeft,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatPrice } from '@/utils/currency';
import { fetchTodayDetailedSales, fetchTodayDetailedReturns } from '@/utils/salesService';
import { DetailedSaleTransaction, DetailedReturnTransaction } from '@/types/sales';

export interface DailySalesData {
  grossTotal: number;
  salesCount: number;
  cashTotal: number;
  cardTotal: number;
  splitTotal: number;
  refundsTotal: number;
  returnsCount: number;
  cashRefunds: number;
  cardRefunds: number;
  netTotal: number;
  netCash: number;
  netCard: number;
  cashFloat?: number; // Fond de caisse
}

interface DailySalesSummaryProps {
  stats: DailySalesData;
  onRefresh: () => void;
  isLoading?: boolean;
  onOpenZReport: () => void;
  userRole?: string;
  onReprintReceipt?: (receiptData: any) => void;
  onInitiateReturn?: (saleId: string) => void;
}

export default function DailySalesSummary({
  stats,
  onRefresh,
  isLoading = false,
  onOpenZReport,
  userRole,
  onReprintReceipt,
  onInitiateReturn,
}: DailySalesSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'history'>('metrics');
  const [historySubTab, setHistorySubTab] = useState<'sales' | 'returns'>('sales');
  
  // Detailed sales & returns state for today
  const [salesHistory, setSalesHistory] = useState<DetailedSaleTransaction[]>([]);
  const [returnsHistory, setReturnsHistory] = useState<DetailedReturnTransaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [expandedSaleIds, setExpandedSaleIds] = useState<Set<string>>(new Set());
  const [expandedReturnIds, setExpandedReturnIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');

  const loadSalesHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const [salesData, returnsData] = await Promise.all([
        fetchTodayDetailedSales(),
        fetchTodayDetailedReturns(),
      ]);
      setSalesHistory(salesData);
      setReturnsHistory(returnsData);
    } catch (err: any) {
      console.error('Failed to load today detailed sales & returns:', err);
      setHistoryError(err.message || 'Erreur lors du chargement des transactions');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Fetch history when user expands the panel or switches to the history tab
  useEffect(() => {
    if (isExpanded) {
      loadSalesHistory();
    }
  }, [isExpanded, loadSalesHistory, stats.salesCount, stats.returnsCount]);

  const toggleSaleExpanded = (saleId: string) => {
    setExpandedSaleIds((prev) => {
      const next = new Set(prev);
      if (next.has(saleId)) {
        next.delete(saleId);
      } else {
        next.add(saleId);
      }
      return next;
    });
  };

  const toggleReturnExpanded = (returnId: string) => {
    setExpandedReturnIds((prev) => {
      const next = new Set(prev);
      if (next.has(returnId)) {
        next.delete(returnId);
      } else {
        next.add(returnId);
      }
      return next;
    });
  };

  const handleReprint = (sale: DetailedSaleTransaction) => {
    if (!onReprintReceipt) return;
    onReprintReceipt({
      sale_id: sale.id,
      cashier_name: sale.cashier_name,
      total_amount: sale.total_amount,
      discount_amount: sale.discount_amount,
      final_amount: sale.final_amount,
      payment_method: sale.payment_method,
      items: sale.items.map((item) => ({
        variant_id: item.variant_id || item.id,
        sku: item.sku || item.productName,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      })),
      created_at: sale.created_at,
    });
  };

  // Filtered sales for search
  const filteredSales = salesHistory.filter((s) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.trim().toLowerCase();
    const idMatch = s.id.toLowerCase().includes(q);
    const cashierMatch = s.cashier_name.toLowerCase().includes(q);
    const itemMatch = s.items.some(
      (item) =>
        item.productName.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.barcode && item.barcode.toLowerCase().includes(q))
    );
    return idMatch || cashierMatch || itemMatch;
  });

  // Filtered returns for search
  const filteredReturns = returnsHistory.filter((r) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.trim().toLowerCase();
    const idMatch = r.id.toLowerCase().includes(q) || r.original_sale_id.toLowerCase().includes(q);
    const cashierMatch = r.cashier_name.toLowerCase().includes(q);
    const reasonMatch = r.reason?.toLowerCase().includes(q);
    const itemMatch = r.items.some(
      (item) =>
        item.productName.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.barcode && item.barcode.toLowerCase().includes(q))
    );
    return idMatch || cashierMatch || reasonMatch || itemMatch;
  });

  return (
    <div className="bg-white border-t border-gray-200 shadow-xl fixed bottom-0 left-0 right-0 z-30 transition-all duration-200 font-sans">
      {/* Top micro bar / Toggle trigger */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-2.5 bg-gradient-to-r from-gray-900 via-gray-950 to-black text-white flex items-center justify-between cursor-pointer hover:bg-black select-none text-xs sm:text-sm shadow-inner"
      >
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 font-bold tracking-wide">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="uppercase text-[11px] sm:text-xs text-gray-300 font-extrabold tracking-wider">Caisse du Jour</span>
          </div>

          <div className="h-3.5 w-px bg-gray-700 hidden xs:block" />

          {/* Net En Caisse (True Net Amount) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-gray-400 hidden xs:inline">Net:</span>
            <span className="font-mono font-black text-emerald-400 text-sm sm:text-base">
              {formatPrice(stats.netTotal ?? (stats.grossTotal - (stats.refundsTotal || 0)))}
            </span>
          </div>

          {/* Gross indicator if returns exist */}
          {(stats.refundsTotal || 0) > 0 && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-gray-400 bg-gray-800/60 px-2 py-0.5 rounded border border-gray-700">
              <span className="text-gray-400">Brut: {formatPrice(stats.grossTotal)}</span>
              <span className="text-rose-400 font-semibold">(-{formatPrice(stats.refundsTotal)})</span>
            </div>
          )}

          <div className="h-3.5 w-px bg-gray-700 hidden sm:block" />

          {/* Sales count badge */}
          <div className="hidden sm:flex items-center gap-1.5 text-gray-300 text-xs bg-gray-800/80 px-2 py-0.5 rounded-md border border-gray-700">
            <ShoppingBag size={13} className="text-emerald-400" />
            <span className="font-semibold">{stats.salesCount} {stats.salesCount > 1 ? 'ventes' : 'vente'}</span>
          </div>

          {/* Returns count badge if any */}
          {(stats.returnsCount || 0) > 0 && (
            <div className="hidden md:flex items-center gap-1.5 text-rose-300 text-xs bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-800/60">
              <RotateCcw size={12} className="text-rose-400" />
              <span className="font-semibold">{stats.returnsCount} retours</span>
            </div>
          )}

          {/* Payment breakdown preview with Cash Net */}
          <div className="hidden md:flex items-center gap-3 text-xs text-gray-300">
            <span className="flex items-center gap-1 font-mono" title={`Espèces net en tiroir (Reçu: ${formatPrice(stats.cashTotal)}, Remboursé: ${formatPrice(stats.cashRefunds || 0)})`}>
              <Banknote size={13} className="text-amber-400" />
              <span className="text-amber-300 font-bold">{formatPrice(stats.netCash ?? stats.cashTotal)}</span>
              {(stats.cashRefunds || 0) > 0 && (
                <span className="text-[10px] text-amber-500/80 font-normal">net</span>
              )}
            </span>
            <span className="flex items-center gap-1 font-mono">
              <CreditCard size={13} className="text-blue-400" />
              {formatPrice(stats.netCard ?? stats.cardTotal)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Quick toggle tab indicator when closed */}
          <span className="hidden lg:inline text-[11px] text-gray-400 bg-gray-800 hover:text-white px-2 py-1 rounded border border-gray-700">
            {isExpanded ? 'Réduire' : '📋 Détails & Historique'}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenZReport();
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-md transition flex items-center gap-1 shadow-xs"
            title="Clôture de Caisse / Rapport Z"
          >
            <Receipt size={13} />
            <span className="hidden xs:inline">Clôture Caisse (Z)</span>
          </button>

          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
              if (isExpanded) loadSalesHistory();
            }}
            disabled={isLoading || isLoadingHistory}
            className="p-1 text-gray-400 hover:text-white transition rounded"
            title="Actualiser les ventes"
          >
            <RotateCcw size={14} className={isLoading || isLoadingHistory ? 'animate-spin' : ''} />
          </button>

          <div className="text-gray-400 hover:text-white p-0.5">
            {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </div>
        </div>
      </div>

      {/* Expanded Drawer */}
      {isExpanded && (
        <div className="bg-gray-50 border-t border-gray-200 max-h-[75vh] flex flex-col overflow-hidden">
          {/* Tab navigation headers */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('metrics')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  activeTab === 'metrics'
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Layers size={13} />
                <span>Indicateurs Globaux</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Receipt size={13} />
                <span>📋 Journal des Opérations</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-mono">
                  {salesHistory.length + returnsHistory.length}
                </span>
              </button>
            </div>

            {activeTab === 'history' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Sub-tabs: Ventes vs Retours */}
                <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setHistorySubTab('sales')}
                    className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                      historySubTab === 'sales'
                        ? 'bg-white text-gray-900 shadow-2xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <span>Ventes</span>
                    <span className="text-[10px] font-mono bg-gray-200 px-1 rounded-full">
                      {salesHistory.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistorySubTab('returns')}
                    className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                      historySubTab === 'returns'
                        ? 'bg-white text-rose-700 shadow-2xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <span>Retours</span>
                    <span className="text-[10px] font-mono bg-rose-100 text-rose-800 px-1 rounded-full">
                      {returnsHistory.length}
                    </span>
                  </button>
                </div>

                <div className="relative flex-1 sm:w-56">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filtrer ticket, article..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tab 1: Global metrics breakdown */}
          {activeTab === 'metrics' && (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-w-7xl mx-auto w-full">
              {/* Net En Caisse */}
              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 shadow-2xs col-span-2 sm:col-span-2">
                <div className="text-[10px] sm:text-xs font-bold uppercase text-emerald-800 flex items-center justify-between mb-1">
                  <span>Net En Caisse (Chiffre Net)</span>
                  <DollarSign size={15} className="text-emerald-600" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-900 font-mono">
                  {formatPrice(stats.netTotal ?? (stats.grossTotal - (stats.refundsTotal || 0)))}
                </div>
                <div className="text-[11px] text-emerald-700 mt-1 font-medium flex items-center justify-between">
                  <span>Ventes brutes: {formatPrice(stats.grossTotal)}</span>
                  <span>Retours: -{formatPrice(stats.refundsTotal || 0)}</span>
                </div>
              </div>

              {/* Transactions Ventes */}
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="text-[10px] sm:text-xs font-bold uppercase text-gray-500 flex items-center justify-between mb-1">
                  <span>Ventes Réalisées</span>
                  <ShoppingBag size={15} className="text-indigo-600" />
                </div>
                <div className="text-lg sm:text-xl font-black text-gray-900 font-mono">
                  {stats.salesCount}
                </div>
                <div className="text-[11px] text-gray-400 mt-1 font-medium">
                  {stats.salesCount > 0 ? `Panier moyen: ${formatPrice(stats.grossTotal / stats.salesCount)}` : 'Aucune vente'}
                </div>
              </div>

              {/* Retours / Remboursements */}
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="text-[10px] sm:text-xs font-bold uppercase text-gray-500 flex items-center justify-between mb-1">
                  <span>Retours / Échanges</span>
                  <RotateCcw size={15} className="text-rose-600" />
                </div>
                <div className="text-lg sm:text-xl font-black text-rose-700 font-mono">
                  -{formatPrice(stats.refundsTotal || 0)}
                </div>
                <div className="text-[11px] text-gray-400 mt-1 font-medium">
                  {stats.returnsCount || 0} opération(s)
                </div>
              </div>

              {/* Espèces Net (Cash) */}
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="text-[10px] sm:text-xs font-bold uppercase text-gray-500 flex items-center justify-between mb-1">
                  <span>Espèces Net (Tiroir)</span>
                  <Banknote size={15} className="text-amber-600" />
                </div>
                <div className="text-lg sm:text-xl font-black text-amber-700 font-mono">
                  {formatPrice(stats.netCash ?? stats.cashTotal)}
                </div>
                <div className="text-[11px] text-gray-400 mt-1 font-medium flex justify-between">
                  <span>+{formatPrice(stats.cashTotal)}</span>
                  <span className="text-rose-500">-{formatPrice(stats.cashRefunds || 0)}</span>
                </div>
              </div>

              {/* Carte Bancaire / TPE Net */}
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                <div className="text-[10px] sm:text-xs font-bold uppercase text-gray-500 flex items-center justify-between mb-1">
                  <span>Carte / TPE Net</span>
                  <CreditCard size={15} className="text-blue-600" />
                </div>
                <div className="text-lg sm:text-xl font-black text-blue-700 font-mono">
                  {formatPrice(stats.netCard ?? stats.cardTotal)}
                </div>
                <div className="text-[11px] text-gray-400 mt-1 font-medium flex justify-between">
                  <span>+{formatPrice(stats.cardTotal)}</span>
                  <span className="text-rose-500">-{formatPrice(stats.cardRefunds || 0)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Chronological detailed operations list (Sales / Returns) */}
          {activeTab === 'history' && (
            <div className="p-4 overflow-y-auto max-h-[55vh] max-w-7xl mx-auto w-full space-y-2.5">
              {isLoadingHistory && (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Chargement des transactions du jour...</span>
                </div>
              )}

              {historyError && !isLoadingHistory && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{historyError}</span>
                </div>
              )}

              {/* Sub-tab 1: VENTES */}
              {!isLoadingHistory && !historyError && historySubTab === 'sales' && (
                <>
                  {filteredSales.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                      <ShoppingBag size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm font-bold text-gray-700">Aucune vente enregistrée aujourd'hui</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Les tickets validés au point de vente apparaîtront ici chronologiquement avec le détail de chaque article.
                      </p>
                    </div>
                  ) : (
                    filteredSales.map((sale) => {
                      const isItemExpanded = expandedSaleIds.has(sale.id);
                      const timeStr = new Date(sale.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });

                      return (
                        <div
                          key={sale.id}
                          className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 shadow-2xs transition overflow-hidden"
                        >
                          {/* Header Row */}
                          <div 
                            onClick={() => toggleSaleExpanded(sale.id)}
                            className="p-3 cursor-pointer flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50/70 select-none"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                                {isItemExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </div>

                              {/* Timestamp */}
                              <div className="flex items-center gap-1 font-mono font-bold text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                <Clock size={12} className="text-gray-400" />
                                <span>{timeStr}</span>
                              </div>

                              {/* Ticket ID */}
                              <div className="font-mono font-black text-xs text-gray-900 tracking-wider">
                                #{sale.id.slice(0, 8)}
                              </div>

                              {/* Cashier name */}
                              <div className="text-[11px] text-gray-500 hidden sm:inline">
                                par <span className="font-semibold text-gray-800">{sale.cashier_name}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 ml-auto">
                              {/* Payment method pill */}
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                  sale.payment_method === 'cash'
                                    ? 'bg-amber-100 text-amber-800'
                                    : sale.payment_method === 'card'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {sale.payment_method === 'cash' ? (
                                  <>
                                    <Banknote size={11} /> Espèces
                                  </>
                                ) : sale.payment_method === 'card' ? (
                                  <>
                                    <CreditCard size={11} /> Carte
                                  </>
                                ) : (
                                  'Mixte'
                                )}
                              </span>

                              {/* Final Amount */}
                              <div className="font-mono font-black text-sm text-emerald-600">
                                {formatPrice(sale.final_amount)}
                              </div>

                              {/* Items counter pill */}
                              <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                {sale.items.length} {sale.items.length > 1 ? 'articles' : 'article'}
                              </span>
                            </div>
                          </div>

                          {/* Expandable Line-Item Breakdown */}
                          {isItemExpanded && (
                            <div className="border-t border-gray-100 bg-gray-50/60 p-3 sm:p-4">
                              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-3">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-gray-100/70 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                                    <tr>
                                      <th className="p-2 sm:p-2.5">Article / Variantes</th>
                                      <th className="p-2 sm:p-2.5 text-center">Quantité</th>
                                      <th className="p-2 sm:p-2.5 text-right">Prix Unitaire</th>
                                      <th className="p-2 sm:p-2.5 text-right">Sous-total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {sale.items.map((item, idx) => (
                                      <tr key={item.id || idx} className="hover:bg-gray-50/50">
                                        <td className="p-2 sm:p-2.5">
                                          <div className="font-bold text-gray-900">{item.productName}</div>
                                          <div className="text-[11px] text-gray-500 flex flex-wrap items-center gap-2 mt-0.5">
                                            {item.size && (
                                              <span className="bg-gray-100 px-1.5 py-0.2 rounded font-medium">
                                                Taille: {item.size}
                                              </span>
                                            )}
                                            {item.color && (
                                              <span className="bg-gray-100 px-1.5 py-0.2 rounded font-medium">
                                                Couleur: {item.color}
                                              </span>
                                            )}
                                            {item.barcode && (
                                              <span className="font-mono text-gray-400 text-[10px]">
                                                Code-barres: {item.barcode}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="p-2 sm:p-2.5 text-center font-bold font-mono">
                                          x{item.quantity}
                                        </td>
                                        <td className="p-2 sm:p-2.5 text-right font-mono text-gray-600">
                                          {formatPrice(item.unit_price)}
                                        </td>
                                        <td className="p-2 sm:p-2.5 text-right font-mono font-bold text-gray-900">
                                          {formatPrice(item.subtotal)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                                {/* Discount summary if present */}
                                {sale.discount_amount > 0 && (
                                  <div className="p-2 bg-amber-50/60 border-t border-amber-100 flex items-center justify-between text-xs text-amber-800">
                                    <span className="font-semibold">Remise appliquée:</span>
                                    <span className="font-mono font-bold">-{formatPrice(sale.discount_amount)}</span>
                                  </div>
                                )}
                              </div>

                              {/* Quick Actions (Reprint & Return) */}
                              <div className="flex items-center justify-end gap-2">
                                {onReprintReceipt && (
                                  <button
                                    type="button"
                                    onClick={() => handleReprint(sale)}
                                    className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                                    title="Réimprimer le ticket de caisse"
                                  >
                                    <Printer size={13} className="text-gray-500" />
                                    <span>Imprimer Reçu</span>
                                  </button>
                                )}

                                {onInitiateReturn && (
                                  <button
                                    type="button"
                                    onClick={() => onInitiateReturn(sale.id)}
                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                                    title="Initier un retour ou échange pour ce ticket"
                                  >
                                    <ArrowRightLeft size={13} className="text-indigo-600" />
                                    <span>Retour / Échange</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* Sub-tab 2: RETOURS & ÉCHANGES */}
              {!isLoadingHistory && !historyError && historySubTab === 'returns' && (
                <>
                  {filteredReturns.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                      <RotateCcw size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm font-bold text-gray-700">Aucun retour enregistré aujourd'hui</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Les retours et échanges validés s'afficheront ici avec le montant remboursé et les articles réintégrés en stock.
                      </p>
                    </div>
                  ) : (
                    filteredReturns.map((ret) => {
                      const isItemExpanded = expandedReturnIds.has(ret.id);
                      const timeStr = new Date(ret.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });

                      return (
                        <div
                          key={ret.id}
                          className="bg-white rounded-xl border border-rose-200 hover:border-rose-300 shadow-2xs transition overflow-hidden"
                        >
                          {/* Header Row */}
                          <div 
                            onClick={() => toggleReturnExpanded(ret.id)}
                            className="p-3 cursor-pointer flex flex-wrap items-center justify-between gap-3 hover:bg-rose-50/40 select-none"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-md bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                                {isItemExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </div>

                              {/* Timestamp */}
                              <div className="flex items-center gap-1 font-mono font-bold text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                <Clock size={12} className="text-gray-400" />
                                <span>{timeStr}</span>
                              </div>

                              {/* Return & Original Sale ID */}
                              <div className="flex items-center gap-1.5 font-mono text-xs">
                                <span className="font-black text-rose-700">Retour #{ret.id.slice(0, 8)}</span>
                                <span className="text-gray-400 text-[11px]">(Vente #{ret.original_sale_id.slice(0, 8)})</span>
                              </div>

                              {/* Cashier name */}
                              <div className="text-[11px] text-gray-500 hidden sm:inline">
                                par <span className="font-semibold text-gray-800">{ret.cashier_name}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 ml-auto">
                              {/* Type badge (Refund vs Exchange) */}
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                  ret.return_type === 'exchange'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {ret.return_type === 'exchange' ? (
                                  <>
                                    <ArrowRightLeft size={11} /> Échange
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw size={11} /> Remboursement
                                  </>
                                )}
                              </span>

                              {/* Refund method pill */}
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                  ret.refund_payment_method === 'cash'
                                    ? 'bg-amber-100 text-amber-800'
                                    : ret.refund_payment_method === 'card'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {ret.refund_payment_method === 'cash' ? (
                                  <>
                                    <Banknote size={11} /> Espèces
                                  </>
                                ) : ret.refund_payment_method === 'card' ? (
                                  <>
                                    <CreditCard size={11} /> Carte
                                  </>
                                ) : (
                                  'Avoir'
                                )}
                              </span>

                              {/* Total refunded amount */}
                              <div className="font-mono font-black text-sm text-rose-600">
                                -{formatPrice(ret.total_refunded_amount)}
                              </div>

                              {/* Items counter pill */}
                              <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                {ret.items.length} {ret.items.length > 1 ? 'articles' : 'article'}
                              </span>
                            </div>
                          </div>

                          {/* Expandable Line-Item Breakdown */}
                          {isItemExpanded && (
                            <div className="border-t border-rose-100 bg-rose-50/20 p-3 sm:p-4">
                              {ret.reason && (
                                <div className="text-xs text-gray-600 mb-2 italic">
                                  Motif: <span className="text-gray-900 font-medium not-italic">{ret.reason}</span>
                                </div>
                              )}

                              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-gray-100/70 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                                    <tr>
                                      <th className="p-2 sm:p-2.5">Article Retourné</th>
                                      <th className="p-2 sm:p-2.5 text-center">Quantité Réintégrée</th>
                                      <th className="p-2 sm:p-2.5 text-right">Prix Unitaire</th>
                                      <th className="p-2 sm:p-2.5 text-right">Montant Déduit</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {ret.items.map((item, idx) => (
                                      <tr key={item.id || idx} className="hover:bg-rose-50/30">
                                        <td className="p-2 sm:p-2.5">
                                          <div className="font-bold text-gray-900">{item.productName}</div>
                                          <div className="text-[11px] text-gray-500 flex flex-wrap items-center gap-2 mt-0.5">
                                            {item.size && (
                                              <span className="bg-gray-100 px-1.5 py-0.2 rounded font-medium">
                                                Taille: {item.size}
                                              </span>
                                            )}
                                            {item.color && (
                                              <span className="bg-gray-100 px-1.5 py-0.2 rounded font-medium">
                                                Couleur: {item.color}
                                              </span>
                                            )}
                                            {item.sku && (
                                              <span className="font-mono text-gray-400 text-[10px]">
                                                SKU: {item.sku}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="p-2 sm:p-2.5 text-center font-bold font-mono text-emerald-600">
                                          +{item.quantity} en stock
                                        </td>
                                        <td className="p-2 sm:p-2.5 text-right font-mono text-gray-600">
                                          {formatPrice(item.unit_price)}
                                        </td>
                                        <td className="p-2 sm:p-2.5 text-right font-mono font-bold text-rose-600">
                                          -{formatPrice(item.subtotal)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
