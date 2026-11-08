'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';
import BarcodeTagModal from '@/components/pos/BarcodeTagModal';
import DeliveryReceivingModal from '@/components/pos/DeliveryReceivingModal';
import { useToast } from '@/context/ToastContext';
import {
  Boxes,
  PackagePlus,
  AlertTriangle,
  Barcode,
  Search,
  Plus,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Edit2,
  Trash2
} from 'lucide-react';
import Link from 'next/link';

interface ProductWithVariants {
  id: string;
  name: string;
  brand: string | null;
  category_id: string | null;
  is_active: boolean;
  category?: { name: string } | null;
  variants: Array<{
    id: string;
    sku: string;
    barcode: string | null;
    size: string | null;
    color: string | null;
    selling_price: number;
    stock_quantity: number;
    low_stock_threshold: number;
    is_active: boolean;
    cost_price?: number;
  }>;
}

export default function InventoryDashboardPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Modals state
  const [tagModalVariant, setTagModalVariant] = useState<any>(null);
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New product / variant form state
  const [productForm, setProductForm] = useState({
    name: '',
    brand: 'Top Tendance',
    category_id: '',
    sku: '',
    barcode: '',
    size: 'M',
    color: 'Noir',
    selling_price: '79.000',
    cost_price: '35.000',
    stock_quantity: '10',
    low_stock_threshold: '5',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      // 1. Fetch categories
      const { data: catData } = await supabase.from('categories').select('id, name');
      if (catData) setCategories(catData);

      // 2. Fetch products & variants
      const { data: prodData, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          brand,
          category_id,
          is_active,
          category:categories (name),
          variants (
            id,
            sku,
            barcode,
            size,
            color,
            selling_price,
            stock_quantity,
            low_stock_threshold,
            is_active
          )
        `)
        .eq('is_active', true)
        .order('name');

      if (!error && prodData) {
        // Fetch manager-isolated costs
        const { data: costs } = await supabase.from('variant_costs').select('variant_id, cost_price');
        const costMap: Record<string, number> = {};
        costs?.forEach((c) => {
          costMap[c.variant_id] = Number(c.cost_price);
        });

        const formatted = prodData.map((p: any) => ({
          ...p,
          category: Array.isArray(p.category) ? p.category[0] : p.category,
          variants: (p.variants || []).map((v: any) => ({
            ...v,
            selling_price: Number(v.selling_price),
            cost_price: costMap[v.id] || 0,
          })),
        }));
        setProducts(formatted);
      }
    } catch (err) {
      console.error('Inventory fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Compute metrics
  const allVariants = products.flatMap((p) =>
    p.variants.map((v) => ({ ...v, productName: p.name }))
  );
  const lowStockVariants = allVariants.filter(
    (v) => v.stock_quantity <= v.low_stock_threshold
  );
  const totalStockUnits = allVariants.reduce((sum, v) => sum + v.stock_quantity, 0);

  // Filter products & variants
  const filteredProducts = products
    .filter((p) => {
      if (selectedCategory !== 'all' && p.category_id !== selectedCategory) return false;
      if (searchTerm) {
        const matchesName = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSku = p.variants.some((v) =>
          v.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (v.barcode && v.barcode.includes(searchTerm))
        );
        if (!matchesName && !matchesSku) return false;
      }
      return true;
    })
    .map((p) => {
      if (filterLowStockOnly) {
        return {
          ...p,
          variants: p.variants.filter((v) => v.stock_quantity <= v.low_stock_threshold),
        };
      }
      return p;
    })
    .filter((p) => p.variants.length > 0);

  // Handle Create Product & Variant
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      // 1. Insert product
      const { data: prod, error: pErr } = await supabase
        .from('products')
        .insert({
          name: productForm.name,
          brand: productForm.brand,
          category_id: productForm.category_id || null,
        })
        .select()
        .single();

      if (pErr) throw pErr;

      // 2. Insert variant
      const { data: variant, error: vErr } = await supabase
        .from('variants')
        .insert({
          product_id: prod.id,
          sku: productForm.sku,
          barcode: productForm.barcode || null,
          size: productForm.size,
          color: productForm.color,
          selling_price: parseFloat(productForm.selling_price),
          stock_quantity: parseInt(productForm.stock_quantity),
          low_stock_threshold: parseInt(productForm.low_stock_threshold),
        })
        .select()
        .single();

      if (vErr) throw vErr;

      // 3. Insert cost price into variant_costs
      if (productForm.cost_price) {
        await supabase.from('variant_costs').insert({
          variant_id: variant.id,
          cost_price: parseFloat(productForm.cost_price),
        });
      }

      setIsProductModalOpen(false);
      setProductForm({
        name: '',
        brand: 'Top Tendance',
        category_id: '',
        sku: '',
        barcode: '',
        size: 'M',
        color: 'Noir',
        selling_price: '79.000',
        cost_price: '35.000',
        stock_quantity: '10',
        low_stock_threshold: '5',
      });
      fetchInventory();
    } catch (err: any) {
      setFormError(err.message || 'Erreur lors de la création');
    }
  };

  // Handle Soft Delete Product
  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    setIsDeleting(true);
    const targetId = productToDelete.id;
    const targetName = productToDelete.name;

    // Optimistic UI update
    setProducts((prev) => prev.filter((p) => p.id !== targetId));
    setProductToDelete(null);

    try {
      // Soft-delete product
      const { error: pErr } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', targetId);

      if (pErr) throw pErr;

      // Also soft-delete associated variants so POS ignores them immediately
      await supabase
        .from('variants')
        .update({ is_active: false })
        .eq('product_id', targetId);

      showToast(`Produit "${targetName}" supprimé`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la suppression', 'error');
      // Rollback on error
      fetchInventory();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans select-none">
      {/* Header */}
      <header className="bg-white border-b px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 z-30 shadow-xs gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-4 w-full sm:w-auto">
          <Link
            href="/pos"
            className="text-gray-500 hover:text-black flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 border rounded-lg hover:bg-gray-100 transition"
          >
            <ArrowLeft size={14} /> <span className="hidden xs:inline">Aller à la </span>Caisse (POS)
          </Link>
          <div className="h-4 w-px bg-gray-300 hidden sm:block" />
          <h1 className="font-extrabold text-base sm:text-xl text-gray-900 tracking-tight">
            Gestion Stock & Inventaire
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsReceivingModalOpen(true)}
            className="flex-1 sm:flex-initial justify-center bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-bold py-2.5 px-3 sm:px-4 rounded-xl flex items-center gap-1.5 sm:gap-2 transition min-h-[40px]"
          >
            <PackagePlus size={15} /> <span>Réception</span>
          </button>
          <button
            onClick={() => setIsProductModalOpen(true)}
            className="flex-1 sm:flex-initial justify-center bg-black hover:bg-gray-800 text-white text-xs font-bold py-2.5 px-3 sm:px-4 rounded-xl flex items-center gap-1.5 sm:gap-2 transition shadow-xs min-h-[40px]"
          >
            <Plus size={15} /> <span>Nouveau Produit</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-3.5 sm:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] sm:text-xs font-bold uppercase text-gray-500">Total Unités en Stock</p>
              <p className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5 sm:mt-1">{totalStockUnits}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Boxes size={22} />
            </div>
          </div>

          <div
            onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
            className={`p-4 sm:p-5 rounded-2xl border shadow-xs flex items-center justify-between cursor-pointer transition ${
              filterLowStockOnly
                ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-400'
                : 'bg-white hover:border-amber-400'
            }`}
          >
            <div>
              <p
                className={`text-[11px] sm:text-xs font-bold uppercase ${
                  filterLowStockOnly ? 'text-amber-100' : 'text-gray-500'
                }`}
              >
                Alertes Stock Faible ({lowStockVariants.length})
              </p>
              <p className="text-xl sm:text-2xl font-black mt-0.5 sm:mt-1">{lowStockVariants.length} articles</p>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                filterLowStockOnly
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              <AlertTriangle size={22} />
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-xs flex items-center justify-between sm:col-span-2 lg:col-span-1">
            <div>
              <p className="text-[11px] sm:text-xs font-bold uppercase text-gray-500">Références Catalogue</p>
              <p className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5 sm:mt-1">{allVariants.length} variantes</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp size={22} />
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border shadow-xs flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-3 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher nom, SKU ou code-barres..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs sm:text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black min-h-[40px]"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto items-center">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 sm:flex-initial text-xs border rounded-xl p-2.5 bg-gray-50 focus:bg-white min-h-[40px]"
            >
              <option value="all">Toutes Catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              onClick={fetchInventory}
              title="Rafraîchir"
              className="p-2.5 border rounded-xl hover:bg-gray-100 text-gray-600 min-h-[40px] flex items-center justify-center shrink-0"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Inventory View */}
        <div className="bg-white rounded-2xl border shadow-xs overflow-hidden">
          {/* Mobile Card View (shown below md screen breakpoint) */}
          <div className="block md:hidden divide-y divide-gray-100">
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
                  return (
                    <div key={variant.id} className="p-4 space-y-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 text-sm">{product.name}</p>
                          <p className="font-mono text-gray-500 text-xs mt-0.5">{variant.sku}</p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full font-mono font-bold text-xs shrink-0 ${
                            isLowStock
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Stock: {variant.stock_quantity}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                        {variant.size && (
                          <span className="bg-gray-100 px-2 py-0.5 rounded font-mono">T: {variant.size}</span>
                        )}
                        {variant.color && (
                          <span className="bg-gray-100 px-2 py-0.5 rounded font-mono">{variant.color}</span>
                        )}
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
                              setTagModalVariant({
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
                        <button
                          type="button"
                          onClick={() => setProductToDelete({ id: product.id, name: product.name })}
                          className="px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1 min-h-[38px]"
                        >
                          <Trash2 size={14} /> Supprimer
                        </button>
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
              <thead className="bg-gray-50 text-gray-500 uppercase border-b font-semibold">
                <tr>
                  <th className="p-4">Produit / SKU</th>
                  <th className="p-4">Attributs</th>
                  <th className="p-4">Code-barres</th>
                  <th className="p-4 text-right">P. Vente (DT)</th>
                  <th className="p-4 text-right">P. Achat (DT)</th>
                  <th className="p-4 text-center">Stock</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      Chargement de l'inventaire...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      Aucun produit ne correspond aux critères
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) =>
                    product.variants.map((variant) => {
                      const isLowStock = variant.stock_quantity <= variant.low_stock_threshold;
                      return (
                        <tr key={variant.id} className="hover:bg-gray-50/80 transition">
                          <td className="p-4">
                            <p className="font-bold text-gray-900">{product.name}</p>
                            <p className="font-mono text-gray-500 text-[11px]">{variant.sku}</p>
                          </td>
                          <td className="p-4 text-gray-600">
                            {variant.size ? <span className="bg-gray-100 px-2 py-0.5 rounded font-mono mr-1">T: {variant.size}</span> : null}
                            {variant.color ? <span className="bg-gray-100 px-2 py-0.5 rounded font-mono">{variant.color}</span> : null}
                          </td>
                          <td className="p-4 font-mono text-gray-700">
                            {variant.barcode || <span className="text-gray-400 italic">Non assigné</span>}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-gray-950">
                            {variant.selling_price.toFixed(3)}
                          </td>
                          <td className="p-4 text-right font-mono text-gray-600 bg-amber-50/40">
                            {variant.cost_price !== undefined ? `${variant.cost_price.toFixed(3)}` : '-'}
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full font-mono font-bold ${
                                isLowStock
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {variant.stock_quantity}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {variant.barcode && (
                              <button
                                onClick={() =>
                                  setTagModalVariant({
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
                            <button
                              type="button"
                              onClick={() => setProductToDelete({ id: product.id, name: product.name })}
                              title="Supprimer ce produit"
                              className="px-2.5 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-lg text-[11px] font-semibold transition inline-flex items-center gap-1"
                            >
                              <Trash2 size={13} /> Supprimer
                            </button>
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
      </main>

      {/* Barcode Tag Generator Modal */}
      <BarcodeTagModal
        variant={tagModalVariant}
        onClose={() => setTagModalVariant(null)}
      />

      {/* Delivery Receiving Modal */}
      <DeliveryReceivingModal
        isOpen={isReceivingModalOpen}
        variants={allVariants}
        onClose={() => setIsReceivingModalOpen(false)}
        onSuccess={fetchInventory}
      />

      {/* New Product & Variant Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 w-full sm:max-w-lg flex flex-col max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b">
              <h3 className="font-bold text-base sm:text-lg text-gray-900">
                Nouveau Produit & Variante
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5 sm:space-y-4 mt-4">
              {formError && (
                <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Nom du Produit
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl"
                    placeholder="Ex: Chemise Lin"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Catégorie
                  </label>
                  <select
                    value={productForm.category_id}
                    onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl bg-white"
                  >
                    <option value="">Sélectionner</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    SKU (Unique)
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl font-mono"
                    placeholder="CHEM-LIN-BLANC-M"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Code-barres (EAN/Code128)
                  </label>
                  <input
                    type="text"
                    value={productForm.barcode}
                    onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl font-mono"
                    placeholder="619..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Taille
                  </label>
                  <input
                    type="text"
                    value={productForm.size}
                    onChange={(e) => setProductForm({ ...productForm, size: e.target.value })}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Couleur
                  </label>
                  <input
                    type="text"
                    value={productForm.color}
                    onChange={(e) => setProductForm({ ...productForm, color: e.target.value })}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Prix Vente (DT)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={productForm.selling_price}
                    onChange={(e) => setProductForm({ ...productForm, selling_price: e.target.value })}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl font-mono text-right"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Prix Achat (DT)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={productForm.cost_price}
                    onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl font-mono text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Stock Initial
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.stock_quantity}
                    onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl font-mono text-right"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Seuil alerte
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={productForm.low_stock_threshold}
                    onChange={(e) => setProductForm({ ...productForm, low_stock_threshold: e.target.value })}
                    className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl font-mono text-right"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 border rounded-xl text-xs font-semibold hover:bg-gray-100 text-center"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition text-center"
                >
                  Créer l'Article
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full flex flex-col">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
              <AlertTriangle size={20} />
            </div>
            <h3 className="font-bold text-base text-gray-900">
              Supprimer le produit ?
            </h3>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              Supprimer <span className="font-semibold text-gray-800">« {productToDelete.name} »</span> ? Cette action est irréversible. Le produit et ses variantes ne seront plus visibles en caisse ni dans l'inventaire.
            </p>
            <div className="mt-5 pt-3 border-t flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold hover:bg-gray-100 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteProduct}
                className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

