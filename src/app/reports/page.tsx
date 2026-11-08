'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';
import {
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  Calendar,
  CreditCard,
  Banknote,
  Split,
  History,
  ArrowLeft,
  RefreshCw,
  ShoppingBag,
  Award
} from 'lucide-react';
import Link from 'next/link';

export default function ReportsAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [salesAnalytics, setSalesAnalytics] = useState<any>(null);
  const [stockValuation, setStockValuation] = useState<any>(null);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'7' | '30' | '90'>('30');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const days = parseInt(selectedPeriod, 10);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 1. Fetch sales analytics RPC
      const { data: salesData, error: sErr } = await supabase.rpc('get_sales_analytics', {
        p_start_date: startDate.toISOString(),
        p_end_date: new Date().toISOString(),
      });
      if (!sErr && salesData) setSalesAnalytics(salesData);

      // 2. Fetch stock valuation RPC
      const { data: valData, error: vErr } = await supabase.rpc('get_stock_valuation');
      if (!vErr && valData) setStockValuation(valData);

      // 3. Fetch audit stock movements
      const { data: movData, error: mErr } = await supabase
        .from('stock_movements')
        .select(`
          id,
          quantity_change,
          movement_type,
          reason,
          created_at,
          created_by,
          profile:profiles (full_name),
          variant:variants (
            sku,
            product:products (name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(25);

      if (!mErr && movData) {
        setStockMovements(movData);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedPeriod]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans select-none">
      {/* Top Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/inventory"
            className="text-gray-500 hover:text-black flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 border rounded-lg hover:bg-gray-100 transition"
          >
            <ArrowLeft size={14} /> Retour à l'Inventaire
          </Link>
          <div className="h-4 w-px bg-gray-300" />
          <h1 className="font-extrabold text-xl text-gray-900 tracking-tight">
            Rapports & Statistiques Financières
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setSelectedPeriod('7')}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedPeriod === '7' ? 'bg-white text-black shadow-sm' : 'text-gray-500'
              }`}
            >
              7 jours
            </button>
            <button
              onClick={() => setSelectedPeriod('30')}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedPeriod === '30' ? 'bg-white text-black shadow-sm' : 'text-gray-500'
              }`}
            >
              30 jours
            </button>
            <button
              onClick={() => setSelectedPeriod('90')}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedPeriod === '90' ? 'bg-white text-black shadow-sm' : 'text-gray-500'
              }`}
            >
              3 mois
            </button>
          </div>

          <button
            onClick={fetchAnalytics}
            className="p-2 border rounded-xl hover:bg-gray-100 text-gray-600 transition"
            title="Actualiser"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase text-gray-500">Chiffre d'Affaires</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <DollarSign size={18} />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black font-mono text-gray-950">
                {Number(salesAnalytics?.gross_revenue || 0).toFixed(3)}{' '}
                <span className="text-xs font-normal">DT</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {salesAnalytics?.sales_count || 0} ventes encaissées
              </p>
            </div>
          </div>

          {/* Net Profit */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase text-gray-500">Bénéfice Net Réalisé</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black font-mono text-emerald-600">
                {Number(salesAnalytics?.net_profit || 0).toFixed(3)}{' '}
                <span className="text-xs font-normal">DT</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Coût marchandises: {Number(salesAnalytics?.total_cost || 0).toFixed(3)} DT
              </p>
            </div>
          </div>

          {/* Stock Valuation at Cost */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase text-gray-500">Valeur Stock (Coût Achat)</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Package size={18} />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black font-mono text-gray-950">
                {Number(stockValuation?.total_stock_valuation_cost || 0).toFixed(3)}{' '}
                <span className="text-xs font-normal">DT</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {stockValuation?.total_stock_units || 0} pièces en réserve
              </p>
            </div>
          </div>

          {/* Stock Valuation at Retail */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase text-gray-500">Valeur Vente Estimée</span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Layers size={18} />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black font-mono text-purple-600">
                {Number(stockValuation?.total_stock_valuation_retail || 0).toFixed(3)}{' '}
                <span className="text-xs font-normal">DT</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Marge moyenne estimée: {stockValuation?.estimated_margin_percent || 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Middle Row: Payment Methods & Best Sellers */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Payment Method Breakdown (5 cols) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
            <h3 className="font-bold text-sm text-gray-900 pb-3 border-b flex items-center gap-2">
              <CreditCard size={16} /> Répartition des Règlements
            </h3>

            <div className="space-y-3 my-4">
              {salesAnalytics?.payment_breakdown?.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Aucune transaction</p>
              ) : (
                salesAnalytics?.payment_breakdown?.map((pb: any) => {
                  const icon =
                    pb.method === 'cash' ? (
                      <Banknote size={16} className="text-emerald-600" />
                    ) : pb.method === 'card' ? (
                      <CreditCard size={16} className="text-blue-600" />
                    ) : (
                      <Split size={16} className="text-purple-600" />
                    );
                  return (
                    <div
                      key={pb.method}
                      className="p-3 border rounded-xl flex items-center justify-between bg-gray-50/50"
                    >
                      <div className="flex items-center gap-2.5">
                        {icon}
                        <span className="text-xs font-bold uppercase text-gray-700">
                          {pb.method === 'cash'
                            ? 'Espèces'
                            : pb.method === 'card'
                            ? 'Carte Bancaire'
                            : 'Mixte'}
                        </span>
                        <span className="text-[11px] text-gray-400 font-mono">
                          ({pb.count} reçus)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-sm text-gray-900">
                        {Number(pb.total).toFixed(3)} DT
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <p className="text-[10px] text-gray-400 border-t pt-2 text-right">
              Période: {selectedPeriod} derniers jours
            </p>
          </div>

          {/* Best-Sellers (7 cols) */}
          <div className="lg:col-span-7 bg-white p-5 rounded-2xl border shadow-sm">
            <h3 className="font-bold text-sm text-gray-900 pb-3 border-b flex items-center gap-2">
              <Award size={16} /> Top Ventes & Articles Phares
            </h3>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-gray-400 uppercase font-semibold text-[10px] border-b">
                  <tr>
                    <th className="pb-2">SKU</th>
                    <th className="pb-2 text-center">Qté Vendue</th>
                    <th className="pb-2 text-right">CA Réalisé (DT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {salesAnalytics?.best_sellers?.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-gray-400">
                        Aucun article vendu sur cette période
                      </td>
                    </tr>
                  ) : (
                    salesAnalytics?.best_sellers?.map((bs: any) => (
                      <tr key={bs.variant_id} className="hover:bg-gray-50/60">
                        <td className="py-2.5 font-mono font-semibold text-gray-900">
                          {bs.sku}
                        </td>
                        <td className="py-2.5 text-center font-bold text-gray-900">
                          {bs.quantity_sold}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-gray-950">
                          {Number(bs.revenue).toFixed(3)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bottom Row: Stock Movement Audit Log */}
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <h3 className="font-bold text-sm text-gray-900 pb-3 border-b flex items-center gap-2">
            <History size={16} /> Journal d'Audit des Mouvements de Stock
          </h3>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase border-b font-semibold text-[10px]">
                <tr>
                  <th className="p-3">Date / Heure</th>
                  <th className="p-3">Article / SKU</th>
                  <th className="p-3 text-center">Type</th>
                  <th className="p-3 text-center">Variation</th>
                  <th className="p-3">Motif / Justification</th>
                  <th className="p-3">Utilisateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stockMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      Aucun mouvement de stock enregistré
                    </td>
                  </tr>
                ) : (
                  stockMovements.map((m) => {
                    const isPositive = m.quantity_change > 0;
                    const typeLabel =
                      m.movement_type === 'sale'
                        ? 'Vente'
                        : m.movement_type === 'restock'
                        ? 'Réception'
                        : m.movement_type === 'return'
                        ? 'Retour'
                        : 'Ajustement';

                    return (
                      <tr key={m.id} className="hover:bg-gray-50/60 transition">
                        <td className="p-3 text-gray-500 font-mono text-[11px]">
                          {new Date(m.created_at).toLocaleString('fr-TN')}
                        </td>
                        <td className="p-3">
                          <p className="font-bold text-gray-900">
                            {m.variant?.product?.name || m.variant?.sku}
                          </p>
                          <p className="font-mono text-gray-400 text-[10px]">{m.variant?.sku}</p>
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-gray-100 text-gray-700">
                            {typeLabel}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-black">
                          <span
                            className={isPositive ? 'text-emerald-700' : 'text-red-600'}
                          >
                            {isPositive ? `+${m.quantity_change}` : m.quantity_change}
                          </span>
                        </td>
                        <td className="p-3 text-gray-600 text-xs">
                          {m.reason || '-'}
                        </td>
                        <td className="p-3 text-gray-500 text-xs">
                          {m.profile?.full_name || 'Système'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

