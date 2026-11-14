'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/utils/supabaseClient';
import {
  Truck,
  Package,
  Search,
  Filter,
  Plus,
  Printer,
  CheckCircle2,
  RotateCcw,
  Clock,
  AlertCircle,
  Phone,
  MapPin,
  ChevronRight,
  RefreshCw,
  DollarSign,
  ChevronDown,
} from 'lucide-react';
import { formatPrice } from '@/utils/currency';
import NewDeliveryModal from './NewDeliveryModal';
import DeliveryShippingSlipModal from './DeliveryShippingSlipModal';

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  variant_id: string;
  product_name: string;
  sku: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price: number;
}

export interface Delivery {
  id: string;
  tracking_number: string | null;
  courier_name: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_phone_alt: string | null;
  address: string;
  city: string;
  governorate: string;
  cod_amount: number;
  shipping_fee: number;
  status: 'preparing' | 'dispatched' | 'in_transit' | 'delivered' | 'returned' | 'cancelled';
  payment_status: 'unpaid' | 'paid' | 'remitted_by_courier';
  notes: string | null;
  created_at: string;
  delivered_at: string | null;
  delivery_items?: DeliveryItem[];
}

type TabPipeline = 'all' | 'preparing' | 'in_transit' | 'delivered' | 'returned';

export default function DeliveryManagementSection() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TabPipeline>('all');
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedSlipDelivery, setSelectedSlipDelivery] = useState<Delivery | null>(null);

  // Return modal confirmation state
  const [returnModalDelivery, setReturnModalDelivery] = useState<Delivery | null>(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load deliveries with items
  const loadDeliveries = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          delivery_items (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeliveries((data as Delivery[]) || []);
    } catch (err: any) {
      console.error('Error loading deliveries:', err);
      setActionError(err.message || 'Erreur lors du chargement des expéditions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  // Quick action: Mark as Delivered & Paid
  const handleMarkDeliveredPaid = async (deliveryId: string) => {
    setActionError(null);
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({
          status: 'delivered',
          payment_status: 'paid',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', deliveryId);

      if (error) throw error;

      setDeliveries(prev =>
        prev.map(d =>
          d.id === deliveryId
            ? { ...d, status: 'delivered', payment_status: 'paid', delivered_at: new Date().toISOString() }
            : d
        )
      );
    } catch (err: any) {
      console.error('Error updating delivery status to delivered:', err);
      setActionError(err.message || 'Impossible de mettre à jour le statut');
    }
  };

  // Quick action: Advance from preparing to dispatched/in_transit
  const handleMarkInTransit = async (deliveryId: string) => {
    setActionError(null);
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({
          status: 'in_transit',
        })
        .eq('id', deliveryId);

      if (error) throw error;

      setDeliveries(prev =>
        prev.map(d => (d.id === deliveryId ? { ...d, status: 'in_transit' } : d))
      );
    } catch (err: any) {
      console.error('Error updating status to in_transit:', err);
      setActionError(err.message || 'Impossible de mettre à jour le statut');
    }
  };

  // Quick action: Confirm delivery return RPC
  const handleConfirmReturn = async () => {
    if (!returnModalDelivery) return;
    setIsProcessingReturn(true);
    setActionError(null);
    try {
      const { data, error } = await supabase.rpc('process_delivery_return', {
        p_delivery_id: returnModalDelivery.id,
        p_notes: returnNotes.trim() || 'Retour colis / non livré',
      });

      if (error) throw error;

      setReturnModalDelivery(null);
      setReturnNotes('');
      await loadDeliveries();
    } catch (err: any) {
      console.error('Error processing delivery return:', err);
      setActionError(err.message || 'Erreur lors du retour en stock du colis');
    } finally {
      setIsProcessingReturn(false);
    }
  };

  // Filter deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(d => {
      // Pipeline status filter
      if (statusFilter === 'preparing' && d.status !== 'preparing') return false;
      if (statusFilter === 'in_transit' && d.status !== 'in_transit' && d.status !== 'dispatched') return false;
      if (statusFilter === 'delivered' && d.status !== 'delivered') return false;
      if (statusFilter === 'returned' && d.status !== 'returned') return false;

      // Courier filter
      if (courierFilter !== 'all' && d.courier_name !== courierFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = d.recipient_name.toLowerCase().includes(q);
        const matchPhone = d.recipient_phone.includes(q) || (d.recipient_phone_alt && d.recipient_phone_alt.includes(q));
        const matchCity = d.city.toLowerCase().includes(q) || d.governorate.toLowerCase().includes(q);
        const matchTracking = d.tracking_number && d.tracking_number.toLowerCase().includes(q);
        const matchItem = d.delivery_items?.some(i => i.product_name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
        if (!matchName && !matchPhone && !matchCity && !matchTracking && !matchItem) {
          return false;
        }
      }

      return true;
    });
  }, [deliveries, statusFilter, courierFilter, searchQuery]);

  // Statistics KPI counts
  const stats = useMemo(() => {
    const preparing = deliveries.filter(d => d.status === 'preparing');
    const inTransit = deliveries.filter(d => d.status === 'in_transit' || d.status === 'dispatched');
    const delivered = deliveries.filter(d => d.status === 'delivered');
    const returned = deliveries.filter(d => d.status === 'returned');

    const totalCodDelivered = delivered.reduce((sum, d) => sum + Number(d.cod_amount || 0), 0);
    const totalCodInTransit = inTransit.reduce((sum, d) => sum + Number(d.cod_amount || 0), 0);

    return {
      preparingCount: preparing.length,
      inTransitCount: inTransit.length,
      deliveredCount: delivered.length,
      returnedCount: returned.length,
      totalCodDelivered,
      totalCodInTransit,
    };
  }, [deliveries]);

  // Helper: Status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'preparing':
        return (
          <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-black uppercase">
            En préparation
          </span>
        );
      case 'in_transit':
      case 'dispatched':
        return (
          <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-black uppercase">
            En cours de route
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black uppercase">
            Livré & Encaissé
          </span>
        );
      case 'returned':
        return (
          <span className="inline-block px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-black uppercase">
            Retour Colis
          </span>
        );
      default:
        return (
          <span className="inline-block px-2.5 py-1 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-[10px] font-black uppercase">
            {status}
          </span>
        );
    }
  };

  // Helper: Delivery Card for Kanban
  const renderDeliveryCard = (d: Delivery) => {
    const totalItems = d.delivery_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    return (
      <div
        key={d.id}
        className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs hover:shadow-sm transition space-y-2.5"
      >
        {/* Top row: Courier + Tracking */}
        <div className="flex items-center justify-between">
          <span className="px-2 py-0.5 bg-gray-100 text-gray-900 rounded-md text-[10px] font-black uppercase tracking-wider">
            {d.courier_name}
          </span>
          <span className="text-[10px] font-mono text-gray-400">
            {d.tracking_number || `#${d.id.slice(0, 8)}`}
          </span>
        </div>

        {/* Recipient */}
        <div>
          <h4 className="font-extrabold text-xs text-gray-950 truncate">{d.recipient_name}</h4>
          <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1 mt-0.5">
            <Phone size={11} /> {d.recipient_phone}
          </p>
          <p className="text-[11px] text-gray-600 truncate flex items-center gap-1 mt-0.5">
            <MapPin size={11} className="shrink-0 text-gray-400" /> {d.city}, {d.governorate}
          </p>
        </div>

        {/* Items summary */}
        <div className="bg-gray-50 p-2 rounded-lg text-[11px] text-gray-600 space-y-1">
          <div className="flex justify-between font-bold text-gray-700">
            <span>{totalItems} article(s)</span>
            <span className="font-mono text-emerald-700 font-black">{formatPrice(d.cod_amount)}</span>
          </div>
          {d.delivery_items && d.delivery_items.length > 0 && (
            <p className="text-[10px] text-gray-400 truncate">
              {d.delivery_items.map(i => `${i.product_name} (×${i.quantity})`).join(', ')}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="pt-1 flex items-center gap-1.5 justify-between border-t border-gray-100">
          <button
            onClick={() => setSelectedSlipDelivery(d)}
            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
            title="Imprimer Bordereau"
          >
            <Printer size={13} />
          </button>

          <div className="flex items-center gap-1">
            {d.status === 'preparing' && (
              <button
                onClick={() => handleMarkInTransit(d.id)}
                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[10px] transition"
              >
                Expédier
              </button>
            )}

            {d.status !== 'delivered' && d.status !== 'returned' && (
              <button
                onClick={() => handleMarkDeliveredPaid(d.id)}
                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[10px] transition flex items-center gap-1"
              >
                <CheckCircle2 size={11} /> Livré & Payé
              </button>
            )}

            {d.status !== 'returned' && (
              <button
                onClick={() => setReturnModalDelivery(d)}
                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[10px] transition flex items-center gap-1"
              >
                <RotateCcw size={11} /> Retour
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };
  const kanbanColumns = useMemo(() => {
    return [
      {
        id: 'preparing',
        title: 'En préparation',
        emoji: '📦',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        items: filteredDeliveries.filter(d => d.status === 'preparing'),
      },
      {
        id: 'in_transit',
        title: 'Expédié / En route',
        emoji: '🚚',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
        items: filteredDeliveries.filter(d => d.status === 'in_transit' || d.status === 'dispatched'),
      },
      {
        id: 'delivered',
        title: 'Livré & Encaissé',
        emoji: '✅',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        items: filteredDeliveries.filter(d => d.status === 'delivered'),
      },
      {
        id: 'returned',
        title: 'Retour Colis',
        emoji: '↩️',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        items: filteredDeliveries.filter(d => d.status === 'returned'),
      },
    ];
  }, [filteredDeliveries]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-gray-500">En Préparation</p>
            <p className="text-xl sm:text-2xl font-black text-amber-600 mt-1">{stats.preparingCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Package size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-gray-500">En Cours de Route</p>
            <p className="text-xl sm:text-2xl font-black text-blue-600 mt-1">{stats.inTransitCount}</p>
            <p className="text-[10px] text-gray-400 font-medium">COD: {formatPrice(stats.totalCodInTransit)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Truck size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-gray-500">Livrés & Encaissés</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">{stats.deliveredCount}</p>
            <p className="text-[10px] text-emerald-600 font-bold">Enc.: {formatPrice(stats.totalCodDelivered)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-gray-500">Retours Colis</p>
            <p className="text-xl sm:text-2xl font-black text-rose-600 mt-1">{stats.returnedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <RotateCcw size={20} />
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700 text-xs font-bold">
            Fermer
          </button>
        </div>
      )}

      {/* Control Toolbar */}
      <div className="bg-white p-4 rounded-2xl border shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search & Filters */}
        <div className="flex flex-1 flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={15} />
            </div>
            <input
              type="text"
              placeholder="Rechercher par client, téléphone, ville ou tracking..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Transporteur Filter */}
          <select
            value={courierFilter}
            onChange={e => setCourierFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="all">Tous transporteurs</option>
            <option value="Aramex">Aramex</option>
            <option value="Yalidine">Yalidine</option>
            <option value="Express">Express</option>
            <option value="Livraison Propre">Livraison Propre</option>
          </select>

          {/* View mode toggle */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'kanban' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Pipeline Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'list' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Liste Détaillée
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadDeliveries}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition"
            title="Rafraîchir"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex-1 md:flex-initial bg-black hover:bg-gray-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-xs"
          >
            <Plus size={15} /> <span>Nouvelle Expédition</span>
          </button>
        </div>
      </div>

      {/* Pipeline Tabs filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'Toutes les expéditions', count: deliveries.length },
          { id: 'preparing', label: '📦 En préparation', count: stats.preparingCount },
          { id: 'in_transit', label: '🚚 En route / Expédiés', count: stats.inTransitCount },
          { id: 'delivered', label: '✅ Livrés & Payés', count: stats.deliveredCount },
          { id: 'returned', label: '↩️ Retours Colis', count: stats.returnedCount },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id as TabPipeline)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              statusFilter === tab.id
                ? 'bg-black text-white shadow-xs'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Main Content: Kanban or List */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {kanbanColumns.map(col => (
            <div key={col.id} className="bg-gray-50/70 p-3.5 rounded-2xl border border-gray-200/80 space-y-3">
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span>{col.emoji}</span>
                  <h3 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">{col.title}</h3>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-black border ${col.badgeClass}`}>
                  {col.items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                {col.items.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400 font-medium">Aucun colis</div>
                ) : (
                  col.items.map(d => renderDeliveryCard(d))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Destinataire</th>
                  <th className="py-3 px-4">Localisation</th>
                  <th className="py-3 px-4">Transporteur & Tracking</th>
                  <th className="py-3 px-4">Articles</th>
                  <th className="py-3 px-4 text-right">Montant COD</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">
                      Aucune expédition trouvée.
                    </td>
                  </tr>
                ) : (
                  filteredDeliveries.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50/60 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{d.recipient_name}</div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                          <Phone size={11} /> {d.recipient_phone}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-800">{d.city}</div>
                        <div className="text-[11px] text-gray-400">{d.governorate}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-[11px] font-bold text-gray-800">
                          {d.courier_name}
                        </span>
                        {d.tracking_number && (
                          <div className="text-[11px] font-mono text-gray-500 mt-0.5">{d.tracking_number}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-gray-700">
                          {d.delivery_items?.reduce((s, i) => s + i.quantity, 0) || 0} pièces
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700 font-mono text-sm">
                        {formatPrice(d.cod_amount)}
                      </td>
                      <td className="py-3 px-4 text-center">{renderStatusBadge(d.status)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedSlipDelivery(d)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                            title="Imprimer Bordereau"
                          >
                            <Printer size={14} />
                          </button>
                          {d.status !== 'delivered' && d.status !== 'returned' && (
                            <button
                              onClick={() => handleMarkDeliveredPaid(d.id)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[11px] transition"
                            >
                              Livré & Payé
                            </button>
                          )}
                          {d.status !== 'returned' && (
                            <button
                              onClick={() => setReturnModalDelivery(d)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[11px] transition"
                            >
                              Retour Colis
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Nouvelle Expédition */}
      <NewDeliveryModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={() => {
          loadDeliveries();
        }}
      />

      {/* Modal: Bordereau d'Expédition */}
      {selectedSlipDelivery && (
        <DeliveryShippingSlipModal
          delivery={selectedSlipDelivery}
          onClose={() => setSelectedSlipDelivery(null)}
        />
      )}

      {/* Modal: Confirmation Retour Colis */}
      {returnModalDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gray-950">Confirmer le Retour Colis</h3>
                <p className="text-xs text-gray-500 font-medium">Réintégration automatique du stock en rayon</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
              <p className="font-bold">Colis pour: {returnModalDelivery.recipient_name}</p>
              <p>Articles à réintégrer: {returnModalDelivery.delivery_items?.reduce((s, i) => s + i.quantity, 0) || 0} pièces</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Motif du retour (Optionnel)</label>
              <input
                type="text"
                placeholder="Ex: Client injoignable / Refus de paiement"
                value={returnNotes}
                onChange={e => setReturnNotes(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReturnModalDelivery(null)}
                disabled={isProcessingReturn}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-100 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmReturn}
                disabled={isProcessingReturn}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl font-black text-xs hover:bg-rose-700 transition flex items-center justify-center gap-2"
              >
                {isProcessingReturn ? 'Traitement...' : 'Valider Retour & Réintégrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
