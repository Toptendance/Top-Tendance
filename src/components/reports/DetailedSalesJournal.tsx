'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Calendar,
  User,
  RotateCcw,
  Receipt,
  ChevronDown,
  ChevronRight,
  Clock,
  Banknote,
  CreditCard,
  Split,
  ShoppingBag,
  TrendingUp,
  Percent,
  Download,
  Filter
} from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';
import { formatPrice } from '@/utils/currency';
import { fetchDetailedSales } from '@/utils/salesService';
import { DetailedSaleTransaction } from '@/types/sales';

interface DetailedSalesJournalProps {
  onRefreshParent?: () => void;
}

export default function DetailedSalesJournal({ onRefreshParent }: DetailedSalesJournalProps) {
  // Period filter: 'today', '7', '30', 'custom'
  const [periodPreset, setPeriodPreset] = useState<'today' | '7' | '30' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Cashier filter
  const [cashierList, setCashierList] = useState<Array<{ id: string; full_name: string }>>([]);
  const [selectedCashierId, setSelectedCashierId] = useState<string>('all');

  // Search query (ticket, barcode, SKU, product name)
  const [searchQuery, setSearchQuery] = useState('');

  // Transactions & loading states
  const [transactions, setTransactions] = useState<DetailedSaleTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedSaleIds, setExpandedSaleIds] = useState<Set<string>>(new Set());

  // Load available cashiers for the dropdown
  useEffect(() => {
    async function loadCashiers() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', ['admin', 'manager', 'cashier'])
          .order('full_name', { ascending: true });

        if (!error && data) {
          setCashierList(data.filter((c) => c.full_name));
        }
      } catch (e) {
        console.error('Failed to load cashiers list:', e);
      }
    }
    loadCashiers();
  }, []);

  // Compute dates based on periodPreset
  const { startDateISO, endDateISO } = useMemo(() => {
    const now = new Date();
    let start = new Date();

    if (periodPreset === 'today') {
      start.setHours(0, 0, 0, 0);
      return {
        startDateISO: start.toISOString(),
        endDateISO: now.toISOString(),
      };
    } else if (periodPreset === '7') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return {
        startDateISO: start.toISOString(),
        endDateISO: now.toISOString(),
      };
    } else if (periodPreset === '30') {
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return {
        startDateISO: start.toISOString(),
        endDateISO: now.toISOString(),
      };
    } else {
      // custom
      let sISO: string | undefined = undefined;
      let eISO: string | undefined = undefined;
      if (customStartDate) {
        const d = new Date(customStartDate);
        d.setHours(0, 0, 0, 0);
        sISO = d.toISOString();
      }
      if (customEndDate) {
        const d = new Date(customEndDate);
        d.setHours(23, 59, 59, 999);
        eISO = d.toISOString();
      }
      return {
        startDateISO: sISO,
        endDateISO: eISO,
      };
    }
  }, [periodPreset, customStartDate, customEndDate]);

  // Load sales transactions
  const loadTransactions = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchDetailedSales({
        startDate: startDateISO,
        endDate: endDateISO,
        cashierId: selectedCashierId === 'all' ? undefined : selectedCashierId,
        searchQuery: searchQuery.trim() || undefined,
      });
      setTransactions(data);
    } catch (err: any) {
      console.error('Error loading sales journal:', err);
      setErrorMsg(err.message || 'Erreur lors du chargement des transactions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [startDateISO, endDateISO, selectedCashierId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTransactions();
  };

  const toggleExpand = (id: string) => {
    setExpandedSaleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandedSaleIds.size === transactions.length) {
      setExpandedSaleIds(new Set());
    } else {
      setExpandedSaleIds(new Set(transactions.map((t) => t.id)));
    }
  };

  // Quick summary aggregates
  const summary = useMemo(() => {
    let grossTotal = 0;
    let totalDiscount = 0;
    let netTotal = 0;
    let totalItemsCount = 0;

    for (const t of transactions) {
      grossTotal += t.total_amount;
      totalDiscount += t.discount_amount;
      netTotal += t.final_amount;
      for (const it of t.items) {
        totalItemsCount += it.quantity;
      }
    }

    const salesCount = transactions.length;
    const avgBasket = salesCount > 0 ? netTotal / salesCount : 0;

    return {
      salesCount,
      grossTotal,
      totalDiscount,
      netTotal,
      totalItemsCount,
      avgBasket,
    };
  }, [transactions]);

  return (
    <div className="space-y-4">
      {/* Controls & Filters Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Period selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1.5 mr-1">
              <Calendar size={14} className="text-gray-400" /> Période:
            </span>
            <div className="inline-flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPeriodPreset('today')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  periodPreset === 'today' ? 'bg-white text-black shadow-xs' : 'text-gray-500 hover:text-black'
                }`}
              >
                Aujourd'hui
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('7')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  periodPreset === '7' ? 'bg-white text-black shadow-xs' : 'text-gray-500 hover:text-black'
                }`}
              >
                7 jours
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('30')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  periodPreset === '30' ? 'bg-white text-black shadow-xs' : 'text-gray-500 hover:text-black'
                }`}
              >
                30 jours
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('custom')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  periodPreset === 'custom' ? 'bg-white text-black shadow-xs' : 'text-gray-500 hover:text-black'
                }`}
              >
                Personnalisé
              </button>
            </div>

            {/* Custom date range inputs */}
            {periodPreset === 'custom' && (
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-black"
                />
                <span className="text-gray-400 text-xs">à</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            )}
          </div>

          {/* Cashier filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1.5 whitespace-nowrap">
              <User size={14} className="text-gray-400" /> Caissier:
            </span>
            <select
              value={selectedCashierId}
              onChange={(e) => setSelectedCashierId(e.target.value)}
              className="text-xs px-3 py-1.5 border border-gray-200 rounded-xl bg-gray-50 font-medium focus:outline-none focus:ring-1 focus:ring-black min-w-[170px]"
            >
              <option value="all">Tous les caissiers</option>
              {cashierList.map((cashier) => (
                <option key={cashier.id} value={cashier.id}>
                  {cashier.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search bar and actions row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par #ticket, article, code-barres, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-2 bg-black hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition"
            >
              Filtrer
            </button>
          </form>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={toggleExpandAll}
              disabled={transactions.length === 0}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition disabled:opacity-50"
            >
              {expandedSaleIds.size === transactions.length ? 'Tout Réduire' : 'Tout Développer'}
            </button>

            <button
              type="button"
              onClick={() => {
                loadTransactions();
                if (onRefreshParent) onRefreshParent();
              }}
              disabled={isLoading}
              className="p-2 border border-gray-200 rounded-xl hover:bg-gray-100 text-gray-600 transition"
              title="Actualiser les ventes"
            >
              <RotateCcw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Sales count */}
        <div className="bg-white p-4 rounded-2xl border shadow-xs">
          <div className="text-[11px] font-bold uppercase text-gray-500 flex items-center justify-between mb-1">
            <span>Ventes Réalisées</span>
            <ShoppingBag size={15} className="text-indigo-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-gray-950">
            {summary.salesCount}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-medium">
            {summary.totalItemsCount} articles vendus au total
          </div>
        </div>

        {/* Panier Moyen */}
        <div className="bg-white p-4 rounded-2xl border shadow-xs">
          <div className="text-[11px] font-bold uppercase text-gray-500 flex items-center justify-between mb-1">
            <span>Panier Moyen</span>
            <TrendingUp size={15} className="text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600">
            {formatPrice(summary.avgBasket)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-medium">
            Par ticket de caisse
          </div>
        </div>

        {/* Total Brut */}
        <div className="bg-white p-4 rounded-2xl border shadow-xs">
          <div className="text-[11px] font-bold uppercase text-gray-500 flex items-center justify-between mb-1">
            <span>Chiffre Brut</span>
            <Banknote size={15} className="text-gray-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-gray-900">
            {formatPrice(summary.grossTotal)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-medium">
            Avant remises accordées
          </div>
        </div>

        {/* Remises accordées */}
        <div className="bg-white p-4 rounded-2xl border shadow-xs">
          <div className="text-[11px] font-bold uppercase text-gray-500 flex items-center justify-between mb-1">
            <span>Total Remises</span>
            <Percent size={15} className="text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-700">
            {formatPrice(summary.totalDiscount)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-medium">
            Net encaissé: <strong className="font-mono text-gray-700">{formatPrice(summary.netTotal)}</strong>
          </div>
        </div>
      </div>

      {/* Main Detailed Transactions Table */}
      <div className="bg-white rounded-2xl border shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={17} className="text-gray-700" />
            <h3 className="font-bold text-sm text-gray-900">
              Journal des Ventes & Transactions ({transactions.length})
            </h3>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            Tri chronologique inversé (plus récent en premier)
          </span>
        </div>

        {isLoading && (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
            <div className="w-7 h-7 border-2 border-black border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold">Chargement des transactions...</span>
          </div>
        )}

        {errorMsg && !isLoading && (
          <div className="p-6 text-center text-red-600 bg-red-50 text-xs">
            {errorMsg}
          </div>
        )}

        {!isLoading && !errorMsg && transactions.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <ShoppingBag size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-bold text-gray-700">Aucune vente ne correspond à ces critères</p>
            <p className="text-xs text-gray-400 mt-1">
              Modifiez la période ou le filtre caissier pour afficher l'historique des ventes.
            </p>
          </div>
        )}

        {!isLoading && !errorMsg && transactions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Date & Heure</th>
                  <th className="p-3">N° Ticket</th>
                  <th className="p-3">Caissier</th>
                  <th className="p-3 text-center">Paiement</th>
                  <th className="p-3 text-center">Articles</th>
                  <th className="p-3 text-right">Montant Brut</th>
                  <th className="p-3 text-right">Remise</th>
                  <th className="p-3 text-right">Total Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((sale) => {
                  const isExpanded = expandedSaleIds.has(sale.id);
                  const dateObj = new Date(sale.created_at);
                  const dateStr = dateObj.toLocaleDateString('fr-TN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });
                  const timeStr = dateObj.toLocaleTimeString('fr-TN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <React.Fragment key={sale.id}>
                      {/* Parent Sale Row */}
                      <tr
                        onClick={() => toggleExpand(sale.id)}
                        className={`cursor-pointer transition hover:bg-gray-50/80 ${
                          isExpanded ? 'bg-indigo-50/20' : ''
                        }`}
                      >
                        <td className="p-3 text-gray-400">
                          {isExpanded ? (
                            <ChevronDown size={15} className="text-black" />
                          ) : (
                            <ChevronRight size={15} />
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-bold text-gray-900">{dateStr}</div>
                          <div className="text-[11px] text-gray-400 font-mono flex items-center gap-1">
                            <Clock size={11} /> {timeStr}
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                          #{sale.id.slice(0, 8)}
                        </td>
                        <td className="p-3 text-gray-700 whitespace-nowrap">
                          <span className="font-medium bg-gray-100 px-2 py-0.5 rounded-md">
                            {sale.cashier_name}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
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
                              <>
                                <Split size={11} /> Mixte
                              </>
                            )}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className="font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                            {sale.items.length} {sale.items.length > 1 ? 'articles' : 'article'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-gray-600 whitespace-nowrap">
                          {formatPrice(sale.total_amount)}
                        </td>
                        <td className="p-3 text-right font-mono whitespace-nowrap">
                          {sale.discount_amount > 0 ? (
                            <span className="text-amber-600 font-bold">-{formatPrice(sale.discount_amount)}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-gray-950 whitespace-nowrap">
                          {formatPrice(sale.final_amount)}
                        </td>
                      </tr>

                      {/* Expandable Line-Items Breakdown Row */}
                      {isExpanded && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={9} className="p-3 sm:p-4 pl-10 border-b border-gray-200">
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs">
                              <div className="px-3 py-2 bg-gray-100/70 border-b border-gray-200 flex items-center justify-between text-[11px] font-bold text-gray-700">
                                <span>Détail des articles du ticket #{sale.id.slice(0, 8)}</span>
                                <span className="font-mono text-gray-500 font-normal">UUID: {sale.id}</span>
                              </div>
                              <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-[10px]">
                                  <tr>
                                    <th className="p-2 sm:p-2.5">Article</th>
                                    <th className="p-2 sm:p-2.5">SKU / Code-barres</th>
                                    <th className="p-2 sm:p-2.5 text-center">Taille / Couleur</th>
                                    <th className="p-2 sm:p-2.5 text-center">Quantité</th>
                                    <th className="p-2 sm:p-2.5 text-right">Prix Unitaire</th>
                                    <th className="p-2 sm:p-2.5 text-right">Sous-total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {sale.items.map((item, idx) => (
                                    <tr key={item.id || idx} className="hover:bg-gray-50/50">
                                      <td className="p-2 sm:p-2.5 font-bold text-gray-900">
                                        {item.productName}
                                      </td>
                                      <td className="p-2 sm:p-2.5 font-mono text-[11px] text-gray-500">
                                        {item.sku || '-'} {item.barcode ? `(${item.barcode})` : ''}
                                      </td>
                                      <td className="p-2 sm:p-2.5 text-center text-[11px]">
                                        {item.size ? (
                                          <span className="bg-gray-100 px-1.5 py-0.5 rounded mr-1 font-medium">
                                            {item.size}
                                          </span>
                                        ) : null}
                                        {item.color ? (
                                          <span className="bg-gray-100 px-1.5 py-0.5 rounded font-medium">
                                            {item.color}
                                          </span>
                                        ) : null}
                                        {!item.size && !item.color ? '-' : null}
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
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

