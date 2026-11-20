'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  FolderTree,
  AlertTriangle,
  RefreshCw,
  Camera,
  Printer,
  Edit2,
  Trash2,
  Plus,
  Minus,
  Barcode,
  Check,
} from 'lucide-react';
import { ProductWithVariants, SelectedVariantItem } from './types';

export interface InventoryTableSectionProps {
  products: ProductWithVariants[];
  categories: { id: string; name: string }[];
  loading: boolean;
  selectedVariants: Map<string, SelectedVariantItem>;
  onToggleSelectVariant: (item: SelectedVariantItem) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onSelectAllUnprinted: () => void;
  onQuickStockUpdate: (variantId: string, delta: number) => Promise<void>;
  onDirectStockCommit: (variantId: string, newStock: number) => Promise<void>;
  onOpenTagModal: (variant: any) => void;
  onOpenEditVariant: (product: any, variant: any) => void;
  onOpenAddVariant: (product: any, variant: any) => void;
  onOpenDeleteVariant: (variantInfo: any) => void;
  onOpenCategoryModal: () => void;
  onBatchTogglePrinted: (status: boolean) => Promise<void>;
  onTogglePrintedStatus: (variantId: string, currentStatus?: boolean) => Promise<void>;
  onRefresh?: () => void;
  onOpenScanner?: () => void;
  isCashier?: boolean;
}

export default function InventoryTableSection({
  products,
  categories,
  loading,
  selectedVariants,
  onToggleSelectVariant,
  onSelectAllVisible,
  onClearSelection,
  onSelectAllUnprinted,
  onQuickStockUpdate,
  onDirectStockCommit,
  onOpenTagModal,
  onOpenEditVariant,
  onOpenAddVariant,
  onOpenDeleteVariant,
  onOpenCategoryModal,
  onBatchTogglePrinted,
  onTogglePrintedStatus,
  onRefresh,
  onOpenScanner,
  isCashier = false,
}: InventoryTableSectionProps) {
  // 2.2 Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);
  const [printFilter, setPrintFilter] = useState<'all' | 'unprinted' | 'printed'>('all');

  // Inline Stock Edit State
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockVal, setEditingStockVal] = useState<string>('');
  const [isUpdatingStock, setIsUpdatingStock] = useState<string | null>(null);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

  // Filter products & variants according to active search, category, low stock & print filters
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (selectedCategory !== 'all' && p.category_id !== selectedCategory) return false;
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchesName = p.name.toLowerCase().includes(term);
          const matchesSku = p.variants.some((v) =>
            v.sku.toLowerCase().includes(term) ||
            (v.barcode && v.barcode.includes(term))
          );
          if (!matchesName && !matchesSku) return false;
        }
        return true;
      })
      .map((p) => {
        let vars = p.variants;
        if (filterLowStockOnly) {
          vars = vars.filter((v) => v.stock_quantity <= v.low_stock_threshold);
        }
        if (printFilter === 'unprinted') {
          vars = vars.filter((v) => !v.is_printed);
        } else if (printFilter === 'printed') {
          vars = vars.filter((v) => Boolean(v.is_printed));
        }
        return {
          ...p,
          variants: vars,
        };
      })
      .filter((p) => p.variants.length > 0);
  }, [products, selectedCategory, searchTerm, filterLowStockOnly, printFilter]);

  // Printable visible variants that have barcodes
  const visiblePrintableVariants = useMemo(() => {
    return filteredProducts.flatMap((p) =>
      p.variants
        .filter((v) => Boolean(v.barcode))
        .map((v) => ({
          variantId: v.id,
          productName: p.name,
          sku: v.sku,
          barcode: v.barcode!,
          size: v.size,
          color: v.color,
          selling_price: v.selling_price,
          stock_quantity: v.stock_quantity,
          quantity: Math.max(1, v.stock_quantity),
        }))
    );
  }, [filteredProducts]);

  const areAllVisibleSelected =
    visiblePrintableVariants.length > 0 &&
    visiblePrintableVariants.every((v) => selectedVariants.has(v.variantId));

  // Handlers for quick stock updates
  const handleQuickDelta = async (variantId: string, delta: number) => {
    if (isCashier) return;
    setIsUpdatingStock(variantId);
    try {
      await onQuickStockUpdate(variantId, delta);
    } finally {
      setIsUpdatingStock(null);
    }
  };

  const handleStockInputSubmit = async (variantId: string) => {
    const parsed = parseInt(editingStockVal, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setIsUpdatingStock(variantId);
      try {
        await onDirectStockCommit(variantId, parsed);
      } finally {
        setIsUpdatingStock(null);
      }
    }
    setEditingStockId(null);
  };

  const handleBatchPrintToggle = async (status: boolean) => {
    setIsBatchUpdating(true);
    try {
      await onBatchTogglePrinted(status);
    } finally {
      setIsBatchUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 2.2 Search & Filter Controls */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border shadow-xs flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center justify-between">
        {/* Search input by product name, SKU, or barcode */}
        <div className="relative flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher nom, SKU ou code-barres..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-9 py-2 border rounded-xl text-xs sm:text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black min-h-[40px]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                title="Effacer la recherche"
              >
                <X size={15} />
              </button>
            )}
          </div>
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              title="Scanner un code avec la caméra"
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 min-h-[40px] transition shrink-0"
            >
              <Camera size={16} />
              <span className="hidden sm:inline">Caméra</span>
            </button>
          )}
        </div>

        <div className="flex gap-2 w-full sm:w-auto items-center flex-wrap sm:flex-nowrap">
          {/* Print status pills: Tous, Non imprimés, Imprimés */}
          <div className="inline-flex rounded-xl bg-gray-100 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setPrintFilter('all')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition ${
                printFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => setPrintFilter('unprinted')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition ${
                printFilter === 'unprinted'
                  ? 'bg-white text-amber-700 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Non imprimés
            </button>
            <button
              type="button"
              onClick={() => setPrintFilter('printed')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition ${
                printFilter === 'printed'
                  ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Imprimés
            </button>
          </div>

          {/* Low-stock quick toggle button */}
          <button
            type="button"
            onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 min-h-[40px] border transition ${
              filterLowStockOnly
                ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300'
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
            }`}
            title="Filtrer les articles avec stock bas"
          >
            <AlertTriangle size={15} className={filterLowStockOnly ? 'text-white' : 'text-amber-500'} />
            <span className="hidden sm:inline">Stock faible</span>
          </button>

          {/* Category dropdown selector */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 sm:flex-initial text-xs border rounded-xl p-2.5 bg-gray-50 focus:bg-white min-h-[40px] text-gray-800"
          >
            <option value="all">Toutes Catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Category Manager button */}
          <button
            type="button"
            onClick={onOpenCategoryModal}
            title="Gérer les catégories"
            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 min-h-[40px] transition shrink-0"
          >
            <FolderTree size={15} />
            <span className="hidden md:inline">Gérer les catégories</span>
          </button>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              title="Rafraîchir"
              className="p-2.5 border rounded-xl hover:bg-gray-100 text-gray-600 min-h-[40px] flex items-center justify-center shrink-0"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 2.3 Views: Mobile Cards & Desktop Table */}
      <div className="bg-white rounded-2xl border shadow-xs overflow-hidden">
        {/* Mobile Card View (shown below md screen breakpoint) */}
        <div className="block md:hidden divide-y divide-gray-100">
          {/* Mobile Select All & Quick Selection Bar */}
          {visiblePrintableVariants.length > 0 && (
            <div className="p-3 bg-gray-50 flex flex-wrap items-center justify-between gap-2 border-b">
              <button
                type="button"
                onClick={onSelectAllVisible}
                className="flex items-center gap-2 text-xs font-semibold text-gray-700"
              >
                <input
                  type="checkbox"
                  checked={areAllVisibleSelected}
                  onChange={onSelectAllVisible}
                  className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                />
                <span>Sélectionner tout ({visiblePrintableVariants.length})</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onSelectAllUnprinted}
                  className="px-2 py-1 bg-white border border-gray-300 hover:border-black rounded-lg text-[11px] font-semibold text-gray-800 transition"
                >
                  Non imprimés
                </button>
                {selectedVariants.size > 0 && (
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="text-[11px] text-gray-500 hover:text-black underline"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              Chargement de l'inventaire...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              Aucun produit ne correspond aux critères
            </div>
          ) : (
            filteredProducts.map((product) =>
              product.variants.map((variant) => {
                const isLowStock = variant.stock_quantity <= variant.low_stock_threshold;
                const isSelected = selectedVariants.has(variant.id);
                return (
                  <div
                    key={variant.id}
                    className={`p-4 space-y-2.5 transition-colors ${
                      isSelected ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {variant.barcode ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              onToggleSelectVariant({
                                variantId: variant.id,
                                productName: product.name,
                                sku: variant.sku,
                                barcode: variant.barcode!,
                                size: variant.size,
                                color: variant.color,
                                selling_price: variant.selling_price,
                                stock_quantity: variant.stock_quantity,
                                quantity: Math.max(1, variant.stock_quantity),
                              })
                            }
                            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-black focus:ring-black cursor-pointer shrink-0"
                          />
                        ) : (
                          <div className="w-4 h-4 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 text-sm">{product.name}</p>
                          <p className="font-mono text-gray-500 text-xs mt-0.5">{variant.sku}</p>
                        </div>
                      </div>

                      {/* Stock Stepper / Direct Input */}
                      {editingStockId === variant.id ? (
                        <div className="inline-flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            min="0"
                            value={editingStockVal}
                            onChange={(e) => setEditingStockVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleStockInputSubmit(variant.id);
                              if (e.key === 'Escape') setEditingStockId(null);
                            }}
                            onBlur={() => handleStockInputSubmit(variant.id)}
                            autoFocus
                            className="w-16 h-7 text-center font-mono font-bold text-xs bg-white border-2 border-black rounded-lg shadow-xs focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 shrink-0">
                          {!isCashier && (
                            <button
                              type="button"
                              disabled={variant.stock_quantity <= 0 || isUpdatingStock === variant.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickDelta(variant.id, -1);
                              }}
                              title="Diminuer le stock (-1)"
                              className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition shadow-2xs"
                            >
                              <Minus size={11} strokeWidth={2.5} />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isCashier}
                            onClick={() => {
                              if (!isCashier) {
                                setEditingStockId(variant.id);
                                setEditingStockVal(variant.stock_quantity.toString());
                              }
                            }}
                            title={!isCashier ? 'Cliquer pour modifier directement le stock' : undefined}
                            className={`px-2 py-0.5 rounded-full font-mono font-bold text-xs transition ${
                              isLowStock
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            } ${!isCashier ? 'cursor-pointer hover:ring-1 hover:ring-gray-300' : 'cursor-default'}`}
                          >
                            Stock: {variant.stock_quantity}
                          </button>
                          {!isCashier && (
                            <button
                              type="button"
                              disabled={isUpdatingStock === variant.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickDelta(variant.id, 1);
                              }}
                              title="Augmenter le stock (+1)"
                              className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition shadow-2xs"
                            >
                              <Plus size={11} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                      {variant.size && (
                        <span className="bg-gray-100 px-2 py-0.5 rounded font-mono">T: {variant.size}</span>
                      )}
                      {variant.color && (
                        <span className="bg-gray-100 px-2 py-0.5 rounded font-mono">{variant.color}</span>
                      )}
                      {/* Printed status badge */}
                      <button
                        type="button"
                        onClick={() => onTogglePrintedStatus(variant.id, variant.is_printed)}
                        title="Cliquer pour changer le statut d'impression"
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition ${
                          variant.is_printed
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {variant.is_printed ? '✓ Imprimé' : 'Non imprimé'}
                      </button>
                      <span className="font-mono text-[11px] text-gray-400 ml-auto">
                        {variant.barcode || 'Sans code'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                      <div>
                        <span className="text-gray-500">P. Vente: </span>
                        <span className="font-mono font-bold text-gray-950 text-sm">
                          {variant.selling_price.toFixed(3)} DT
                        </span>
                        {variant.cost_price !== undefined && (
                          <span className="text-gray-400 text-[11px] ml-2 font-mono">
                            (Coût: {variant.cost_price.toFixed(3)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {variant.barcode && (
                        <button
                          onClick={() =>
                            onOpenTagModal({
                              variantId: variant.id,
                              productName: product.name,
                              sku: variant.sku,
                              barcode: variant.barcode!,
                              size: variant.size,
                              color: variant.color,
                              selling_price: variant.selling_price,
                            })
                          }
                          className="flex-1 justify-center px-3 py-2 border rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition inline-flex items-center gap-1 min-h-[38px]"
                        >
                          <Barcode size={14} /> Étiquette
                        </button>
                      )}
                      {!isCashier && (
                        <button
                          type="button"
                          onClick={() => onOpenEditVariant(product, variant)}
                          title="Modifier les détails de ce produit ou variante"
                          className="flex-1 justify-center px-3 py-2 border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1 min-h-[38px]"
                        >
                          <Edit2 size={13} /> Modifier
                        </button>
                      )}
                      {!isCashier && (
                        <button
                          type="button"
                          onClick={() => onOpenAddVariant(product, variant)}
                          title="Ajouter une nouvelle taille ou variante à ce modèle"
                          className="flex-1 justify-center px-3 py-2 border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1 min-h-[38px]"
                        >
                          <Plus size={14} /> + Taille
                        </button>
                      )}
                      {!isCashier && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenDeleteVariant({
                              variantId: variant.id,
                              productName: product.name,
                              size: variant.size,
                              color: variant.color,
                              sku: variant.sku,
                              productId: product.id,
                              totalVariantsCount: product.variants.length,
                            })
                          }
                          title="Supprimer cette variante"
                          className="px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1 min-h-[38px]"
                        >
                          <Trash2 size={14} /> Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Desktop Table View (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase border-b font-semibold sticky top-0 z-10">
              <tr>
                <th className="p-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={areAllVisibleSelected}
                    onChange={onSelectAllVisible}
                    title="Sélectionner / désélectionner tout"
                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                  />
                </th>
                <th className="p-4">Produit / SKU</th>
                <th className="p-4">Attributs</th>
                <th className="p-4">Code-barres</th>
                <th className="p-4 text-center">Étiquette</th>
                <th className="p-4 text-right">P. Vente (DT)</th>
                <th className="p-4 text-right">P. Achat (DT)</th>
                <th className="p-4 text-center">Stock</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    Chargement de l'inventaire...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    Aucun produit ne correspond aux critères
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) =>
                  product.variants.map((variant) => {
                    const isLowStock = variant.stock_quantity <= variant.low_stock_threshold;
                    const isSelected = selectedVariants.has(variant.id);
                    return (
                      <tr
                        key={variant.id}
                        className={`transition ${
                          isSelected
                            ? 'bg-amber-50/60 hover:bg-amber-100/60'
                            : 'hover:bg-gray-50/80'
                        }`}
                      >
                        <td className="p-4 text-center">
                          {variant.barcode ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                onToggleSelectVariant({
                                  variantId: variant.id,
                                  productName: product.name,
                                  sku: variant.sku,
                                  barcode: variant.barcode!,
                                  size: variant.size,
                                  color: variant.color,
                                  selling_price: variant.selling_price,
                                  stock_quantity: variant.stock_quantity,
                                  quantity: Math.max(1, variant.stock_quantity),
                                })
                              }
                              className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                            />
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-gray-900">{product.name}</p>
                          <p className="font-mono text-gray-500 text-[11px]">{variant.sku}</p>
                        </td>
                        <td className="p-4 text-gray-600">
                          {variant.size ? (
                            <span className="bg-gray-100 px-2 py-0.5 rounded font-mono mr-1">T: {variant.size}</span>
                          ) : null}
                          {variant.color ? (
                            <span className="bg-gray-100 px-2 py-0.5 rounded font-mono">{variant.color}</span>
                          ) : null}
                        </td>
                        <td className="p-4 font-mono text-gray-700">
                          {variant.barcode || <span className="text-gray-400 italic">Non assigné</span>}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => onTogglePrintedStatus(variant.id, variant.is_printed)}
                            title="Cliquer pour basculer le statut d'impression"
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition ${
                              variant.is_printed
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                            }`}
                          >
                            {variant.is_printed ? '✓ Imprimé' : 'Non imprimé'}
                          </button>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-gray-950">
                          {variant.selling_price.toFixed(3)}
                        </td>
                        <td className="p-4 text-right font-mono text-gray-600 bg-amber-50/40">
                          {variant.cost_price !== undefined ? `${variant.cost_price.toFixed(3)}` : '-'}
                        </td>
                        <td className="p-4 text-center">
                          {editingStockId === variant.id ? (
                            <div className="inline-flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                value={editingStockVal}
                                onChange={(e) => setEditingStockVal(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleStockInputSubmit(variant.id);
                                  if (e.key === 'Escape') setEditingStockId(null);
                                }}
                                onBlur={() => handleStockInputSubmit(variant.id)}
                                autoFocus
                                className="w-16 h-7 text-center font-mono font-bold text-xs bg-white border-2 border-black rounded-lg shadow-xs focus:outline-none"
                              />
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-center gap-1.5">
                              {!isCashier && (
                                <button
                                  type="button"
                                  disabled={variant.stock_quantity <= 0 || isUpdatingStock === variant.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickDelta(variant.id, -1);
                                  }}
                                  title="Diminuer le stock (-1)"
                                  className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition shadow-2xs"
                                >
                                  <Minus size={12} strokeWidth={2.5} />
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isCashier}
                                onClick={() => {
                                  if (!isCashier) {
                                    setEditingStockId(variant.id);
                                    setEditingStockVal(variant.stock_quantity.toString());
                                  }
                                }}
                                title={!isCashier ? 'Cliquer pour modifier directement le stock' : undefined}
                                className={`px-2.5 py-1 rounded-full font-mono font-bold text-xs transition ${
                                  isLowStock
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                    : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                } ${!isCashier ? 'cursor-pointer hover:ring-1 hover:ring-gray-300' : 'cursor-default'}`}
                              >
                                {variant.stock_quantity}
                              </button>
                              {!isCashier && (
                                <button
                                  type="button"
                                  disabled={isUpdatingStock === variant.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickDelta(variant.id, 1);
                                  }}
                                  title="Augmenter le stock (+1)"
                                  className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition shadow-2xs"
                                >
                                  <Plus size={12} strokeWidth={2.5} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          {variant.barcode && (
                            <button
                              onClick={() =>
                                onOpenTagModal({
                                  variantId: variant.id,
                                  productName: product.name,
                                  sku: variant.sku,
                                  barcode: variant.barcode!,
                                  size: variant.size,
                                  color: variant.color,
                                  selling_price: variant.selling_price,
                                })
                              }
                              className="px-2.5 py-1.5 border rounded-lg text-[11px] font-semibold text-gray-700 hover:border-black hover:bg-black hover:text-white transition inline-flex items-center gap-1"
                            >
                              <Barcode size={13} /> Étiquette
                            </button>
                          )}
                          {!isCashier && (
                            <button
                              type="button"
                              onClick={() => onOpenEditVariant(product, variant)}
                              title="Modifier les détails de ce produit ou variante"
                              className="px-2.5 py-1.5 border border-gray-200 text-gray-700 hover:border-black hover:bg-black hover:text-white rounded-lg text-[11px] font-semibold transition inline-flex items-center gap-1"
                            >
                              <Edit2 size={13} /> Modifier
                            </button>
                          )}
                          {!isCashier && (
                            <button
                              type="button"
                              onClick={() => onOpenAddVariant(product, variant)}
                              title="Ajouter une nouvelle taille ou variante à ce modèle"
                              className="px-2.5 py-1.5 border border-gray-200 text-gray-700 hover:border-black hover:bg-black hover:text-white rounded-lg text-[11px] font-semibold transition inline-flex items-center gap-1"
                            >
                              <Plus size={13} /> Variante
                            </button>
                          )}
                          {!isCashier && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenDeleteVariant({
                                  variantId: variant.id,
                                  productName: product.name,
                                  size: variant.size,
                                  color: variant.color,
                                  sku: variant.sku,
                                  productId: product.id,
                                  totalVariantsCount: product.variants.length,
                                })
                              }
                              title="Supprimer cette variante"
                              className="px-2.5 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-lg text-[11px] font-semibold transition inline-flex items-center gap-1"
                            >
                              <Trash2 size={13} /> Supprimer
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Batch Action Toolbar */}
      {selectedVariants.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-gray-950 text-white px-4 sm:px-6 py-3 rounded-2xl shadow-2xl border border-gray-800 flex items-center gap-3 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-black font-extrabold text-xs flex items-center justify-center">
              {selectedVariants.size}
            </span>
            <span className="text-xs sm:text-sm font-semibold">
              {selectedVariants.size > 1 ? 'articles sélectionnés' : 'article sélectionné'}
            </span>
          </div>

          <div className="h-4 w-px bg-gray-700 hidden sm:block" />

          <div className="flex items-center gap-2 flex-wrap">
            {/* Batch print tags */}
            <button
              type="button"
              onClick={() => {
                const list = Array.from(selectedVariants.values());
                if (list.length === 1) {
                  onOpenTagModal(list[0]);
                } else {
                  onOpenTagModal(list);
                }
              }}
              className="bg-white hover:bg-gray-100 text-gray-900 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-xs"
            >
              <Printer size={15} />
              <span>Imprimer</span>
              <span className="px-1.5 py-0.5 rounded-md bg-gray-200 text-gray-800 font-mono text-[10px]">
                {Array.from(selectedVariants.values()).reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </button>

            {/* Batch mark as printed */}
            <button
              type="button"
              disabled={isBatchUpdating}
              onClick={() => handleBatchPrintToggle(true)}
              className="px-2.5 sm:px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              title="Marquer la sélection comme imprimée"
            >
              <Check size={13} />
              <span className="hidden md:inline">Marquer imprimés</span>
            </button>

            {/* Batch mark as unprinted */}
            <button
              type="button"
              disabled={isBatchUpdating}
              onClick={() => handleBatchPrintToggle(false)}
              className="px-2.5 sm:px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition disabled:opacity-50"
              title="Marquer la sélection comme non imprimée"
            >
              <span className="hidden md:inline">Marquer non imprimés</span>
            </button>

            <button
              type="button"
              onClick={onClearSelection}
              className="text-gray-400 hover:text-white px-2 sm:px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
              title="Désélectionner tout"
            >
              <X size={14} />
              <span className="hidden sm:inline">Désélectionner</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
