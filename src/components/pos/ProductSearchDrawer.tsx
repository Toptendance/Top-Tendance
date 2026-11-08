'use client';

import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';

interface VariantSearchResult {
  id: string;
  sku: string;
  barcode: string | null;
  size: string | null;
  color: string | null;
  selling_price: number;
  stock_quantity: number;
  product: {
    name: string;
    brand: string | null;
  };
}

interface ProductSearchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVariant: (variant: {
    id: string;
    sku: string;
    name: string;
    size: string | null;
    color: string | null;
    selling_price: number;
    stock_quantity: number;
  }) => void;
}

export default function ProductSearchDrawer({
  isOpen,
  onClose,
  onSelectVariant,
}: ProductSearchDrawerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<VariantSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (query: string) => {
    setSearchTerm(query);
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('variants')
        .select(`
          id,
          sku,
          barcode,
          size,
          color,
          selling_price,
          stock_quantity,
          product:products (
            name,
            brand
          )
        `)
        .eq('is_active', true)
        .or(`sku.ilike.%${query}%,barcode.ilike.%${query}%`)
        .limit(20);

      if (!error && data) {
        // format results
        const formatted = data.map((d: any) => ({
          ...d,
          product: Array.isArray(d.product) ? d.product[0] : d.product,
        }));
        setResults(formatted);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/50 backdrop-blur-xs">
      <div className="bg-white w-full sm:max-w-md h-[90vh] sm:h-full shadow-2xl flex flex-col p-4 sm:p-6 rounded-t-2xl sm:rounded-none animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
        <div className="flex justify-between items-center pb-3 sm:pb-4 border-b">
          <h3 className="font-bold text-base sm:text-lg text-gray-900">Recherche d'articles</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher par SKU, code-barres..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto mt-4 space-y-2">
          {loading && (
            <p className="text-center text-sm text-gray-500 py-6">Recherche en cours...</p>
          )}

          {!loading && results.length === 0 && searchTerm && (
            <p className="text-center text-sm text-gray-500 py-6">Aucun article trouvé</p>
          )}

          {results.map((res) => (
            <div
              key={res.id}
              onClick={() => {
                onSelectVariant({
                  id: res.id,
                  sku: res.sku,
                  name: res.product?.name || res.sku,
                  size: res.size,
                  color: res.color,
                  selling_price: Number(res.selling_price),
                  stock_quantity: res.stock_quantity,
                });
                onClose();
              }}
              className="p-3 border rounded-lg hover:border-black cursor-pointer transition flex justify-between items-center group"
            >
              <div>
                <p className="font-semibold text-sm text-gray-900 group-hover:text-black">
                  {res.product?.name || res.sku}
                </p>
                <p className="text-xs text-gray-500">
                  SKU: {res.sku} {res.size ? `• T: ${res.size}` : ''} {res.color ? `• ${res.color}` : ''}
                </p>
                <p className="text-xs text-gray-400">Stock: {res.stock_quantity} dispo</p>
              </div>
              <div className="text-right">
                <span className="font-bold text-sm text-gray-900">
                  {Number(res.selling_price).toFixed(3)} DT
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

