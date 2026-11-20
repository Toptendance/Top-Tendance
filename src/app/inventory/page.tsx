'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Boxes,
  PackagePlus,
  AlertTriangle,
  TrendingUp,
  Plus,
  ArrowLeft,
  Users,
  Wallet,
  Truck,
} from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';
import { useToast } from '@/context/ToastContext';

// Auxiliary Sections & Modals
import BarcodeTagModal from '@/components/pos/BarcodeTagModal';
import DeliveryReceivingModal from '@/components/pos/DeliveryReceivingModal';
import MobileScannerModal from '@/components/pos/MobileScannerModal';
import CashierManagementSection from '@/components/manager/CashierManagementSection';
import CreditLedger from '@/components/pos/CreditLedger';
import DeliveryManagementSection from '@/components/pos/DeliveryManagementSection';

// Modular Inventory Components (Phases 2 - 5)
import InventoryTableSection from '@/components/inventory/InventoryTableSection';
import NewProductModal from '@/components/inventory/NewProductModal';
import { AddVariantModal, EditVariantModal } from '@/components/inventory/ProductVariantModals';
import {
  CategoryManagerModal,
  VariantDeleteModal,
  ProductDeleteModal,
} from '@/components/inventory/CategoryAndConfirmModals';

// Shared Inventory Types
import {
  ProductWithVariants,
  SelectedVariantItem,
  EditingVariantData,
  AddVariantProductInfo,
  VariantToDeleteInfo,
  ProductToDeleteInfo,
} from '@/types/inventory';

export default function InventoryDashboardPage() {
  const { showToast } = useToast();

  // 1. Core State
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'cashiers' | 'credits' | 'deliveries'>('inventory');
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // 2. Multi-Item Selection State (Batch Barcode Printing)
  const [selectedVariants, setSelectedVariants] = useState<Map<string, SelectedVariantItem>>(new Map());

  // 3. Modal Control States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [addVariantProduct, setAddVariantProduct] = useState<AddVariantProductInfo | null>(null);
  const [editingVariantData, setEditingVariantData] = useState<EditingVariantData | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [tagModalVariant, setTagModalVariant] = useState<any>(null);
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  // Delete Confirmation States
  const [productToDelete, setProductToDelete] = useState<ProductToDeleteInfo | null>(null);
  const [variantToDelete, setVariantToDelete] = useState<VariantToDeleteInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Profile check
  const isCashier = userProfile?.role === 'cashier';

  // --- Data Fetching ---
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch categories
      const { data: catData } = await supabase.from('categories').select('id, name');
      if (catData) setCategories(catData);

      // 2. Fetch products & active variants
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
            is_active,
            is_printed,
            last_printed_at
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

        const formatted: ProductWithVariants[] = prodData
          .map((p: any) => ({
            ...p,
            category: Array.isArray(p.category) ? p.category[0] : p.category,
            variants: (p.variants || [])
              .filter((v: any) => v.is_active !== false)
              .map((v: any) => ({
                ...v,
                selling_price: Number(v.selling_price),
                cost_price: costMap[v.id] || 0,
              })),
          }))
          .filter((p: any) => p.variants.length > 0);

        setProducts(formatted);
      }
    } catch (err) {
      console.error('Inventory fetch error:', err);
      showToast('Erreur lors du chargement de l\'inventaire', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchInventory();

    // Fetch user profile to detect cashier permissions
    async function loadUserProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profile) {
          setUserProfile(profile);
          if (profile.role === 'cashier') {
            setActiveTab((current) => (current === 'cashiers' ? 'inventory' : current));
          }
        }
      }
    }
    loadUserProfile();
  }, [fetchInventory]);

  // --- Derived Metrics ---
  const allVariants = useMemo(
    () => products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name }))),
    [products]
  );

  const lowStockVariants = useMemo(
    () => allVariants.filter((v) => v.stock_quantity <= v.low_stock_threshold),
    [allVariants]
  );

  const totalStockUnits = useMemo(
    () => allVariants.reduce((sum, v) => sum + v.stock_quantity, 0),
    [allVariants]
  );

  const existingBarcodes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      p.variants.forEach((v) => {
        if (v.barcode) set.add(v.barcode);
      });
    });
    return set;
  }, [products]);

  const existingSkus = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      p.variants.forEach((v) => {
        if (v.sku) set.add(v.sku.toLowerCase());
      });
    });
    return set;
  }, [products]);

  const productsCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      if (p.category_id) {
        map[p.category_id] = (map[p.category_id] || 0) + 1;
      }
    });
    return map;
  }, [products]);

  // --- Selection Handlers ---
  const handleToggleSelectVariant = useCallback((item: SelectedVariantItem) => {
    setSelectedVariants((prev) => {
      const next = new Map(prev);
      if (next.has(item.variantId)) {
        next.delete(item.variantId);
      } else {
        next.set(item.variantId, {
          ...item,
          quantity: Math.max(1, item.stock_quantity),
        });
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedVariants(new Map());
  }, []);

  const handleSelectAllVisible = useCallback(() => {
    const allPrintable: SelectedVariantItem[] = products.flatMap((p) =>
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

    const areAllSelected =
      allPrintable.length > 0 && allPrintable.every((v) => selectedVariants.has(v.variantId));

    if (areAllSelected) {
      setSelectedVariants(new Map());
    } else {
      setSelectedVariants((prev) => {
        const next = new Map(prev);
        allPrintable.forEach((v) => {
          if (!next.has(v.variantId)) {
            next.set(v.variantId, v);
          }
        });
        return next;
      });
    }
  }, [products, selectedVariants]);

  const handleSelectAllUnprinted = useCallback(() => {
    const unprinted: SelectedVariantItem[] = products.flatMap((p) =>
      p.variants
        .filter((v) => Boolean(v.barcode) && !v.is_printed)
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

    if (unprinted.length === 0) {
      showToast('Aucun article non imprimé trouvé', 'info');
      return;
    }

    setSelectedVariants((prev) => {
      const next = new Map(prev);
      unprinted.forEach((item) => {
        next.set(item.variantId, item);
      });
      return next;
    });
    showToast(`${unprinted.length} article(s) non imprimé(s) sélectionné(s)`, 'success');
  }, [products, showToast]);

  // --- Print Status Handlers ---
  const handleTogglePrintedStatus = useCallback(
    async (variantId: string, currentStatus?: boolean) => {
      const newStatus = !currentStatus;
      const nowIso = newStatus ? new Date().toISOString() : null;

      // Optimistic update
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          variants: p.variants.map((v) =>
            v.id === variantId
              ? { ...v, is_printed: newStatus, last_printed_at: nowIso }
              : v
          ),
        }))
      );

      try {
        const { error } = await supabase
          .from('variants')
          .update({
            is_printed: newStatus,
            last_printed_at: nowIso,
          })
          .eq('id', variantId);

        if (error) throw error;
        showToast(newStatus ? 'Marqué comme imprimé' : 'Marqué comme non imprimé', 'info');
      } catch (err: any) {
        console.error('Failed to update printed status:', err);
        showToast('Erreur mise à jour statut impression', 'error');
        fetchInventory();
      }
    },
    [fetchInventory, showToast]
  );

  const handleBatchTogglePrinted = useCallback(
    async (status: boolean) => {
      const ids = Array.from(selectedVariants.keys());
      if (ids.length === 0) return;
      const nowIso = status ? new Date().toISOString() : null;

      // Optimistic update
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          variants: p.variants.map((v) =>
            ids.includes(v.id)
              ? { ...v, is_printed: status, last_printed_at: nowIso }
              : v
          ),
        }))
      );

      try {
        const { error } = await supabase
          .from('variants')
          .update({ is_printed: status, last_printed_at: nowIso })
          .in('id', ids);

        if (error) throw error;
        showToast(
          status
            ? `${ids.length} article(s) marqué(s) comme imprimé(s)`
            : `${ids.length} article(s) marqué(s) comme non imprimé(s)`,
          'success'
        );
      } catch (err: any) {
        console.error('Failed to batch update printed status:', err);
        showToast('Erreur mise à jour statut impression', 'error');
        fetchInventory();
      }
    },
    [selectedVariants, fetchInventory, showToast]
  );

  const handleVariantsPrinted = useCallback(
    async (variantIds: string[]) => {
      if (!variantIds || variantIds.length === 0) return;
      const nowIso = new Date().toISOString();

      // Optimistic update
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          variants: p.variants.map((v) =>
            variantIds.includes(v.id)
              ? { ...v, is_printed: true, last_printed_at: nowIso }
              : v
          ),
        }))
      );

      try {
        const { error } = await supabase
          .from('variants')
          .update({
            is_printed: true,
            last_printed_at: nowIso,
          })
          .in('id', variantIds);

        if (error) throw error;
        showToast(`${variantIds.length} article(s) marqué(s) comme imprimé(s)`, 'success');
      } catch (err: any) {
        console.error('Failed to mark variants as printed:', err);
      }
    },
    [showToast]
  );

  // --- 4. High-Level Stock Update Handlers with Optimistic UI Updates ---
  const handleQuickStockUpdate = useCallback(
    async (variantId: string, delta: number) => {
      if (isCashier) {
        showToast('Action non autorisée pour le profil caissier.', 'error');
        return;
      }

      let previousStock = 0;
      for (const p of products) {
        const v = p.variants.find((item) => item.id === variantId);
        if (v) {
          previousStock = v.stock_quantity;
          break;
        }
      }

      const safeQty = Math.max(0, previousStock + delta);
      if (safeQty === previousStock) return;

      // Optimistic UI update
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          variants: p.variants.map((v) =>
            v.id === variantId ? { ...v, stock_quantity: safeQty } : v
          ),
        }))
      );

      try {
        const { error } = await supabase
          .from('variants')
          .update({ stock_quantity: safeQty })
          .eq('id', variantId);

        if (error) throw error;
        showToast(`Stock mis à jour : ${safeQty}`, 'success');
      } catch (err: any) {
        console.error('Failed to update stock:', err);
        showToast(err.message || 'Erreur lors de la mise à jour du stock', 'error');
        // Rollback
        setProducts((prev) =>
          prev.map((p) => ({
            ...p,
            variants: p.variants.map((v) =>
              v.id === variantId ? { ...v, stock_quantity: previousStock } : v
            ),
          }))
        );
      }
    },
    [isCashier, products, showToast]
  );

  const handleDirectStockCommit = useCallback(
    async (variantId: string, newStock: number) => {
      if (isCashier) {
        showToast('Action non autorisée pour le profil caissier.', 'error');
        return;
      }
      const safeQty = Math.max(0, Math.floor(newStock));

      let previousStock = 0;
      for (const p of products) {
        const v = p.variants.find((item) => item.id === variantId);
        if (v) {
          previousStock = v.stock_quantity;
          break;
        }
      }

      if (previousStock === safeQty) return;

      // Optimistic UI update
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          variants: p.variants.map((v) =>
            v.id === variantId ? { ...v, stock_quantity: safeQty } : v
          ),
        }))
      );

      try {
        const { error } = await supabase
          .from('variants')
          .update({ stock_quantity: safeQty })
          .eq('id', variantId);

        if (error) throw error;
        showToast(`Stock mis à jour : ${safeQty}`, 'success');
      } catch (err: any) {
        console.error('Failed to update stock:', err);
        showToast(err.message || 'Erreur lors de la mise à jour du stock', 'error');
        // Rollback
        setProducts((prev) =>
          prev.map((p) => ({
            ...p,
            variants: p.variants.map((v) =>
              v.id === variantId ? { ...v, stock_quantity: previousStock } : v
            ),
          }))
        );
      }
    },
    [isCashier, products, showToast]
  );

  // --- Modal Open Helpers ---
  const handleOpenAddVariant = useCallback(
    (product: ProductWithVariants, currentVariant?: any) => {
      if (isCashier) {
        showToast('Action non autorisée pour le profil caissier.', 'error');
        return;
      }
      const defaultVariant = currentVariant || product.variants[0];
      const defaultColor = defaultVariant?.color || 'Noir';
      setAddVariantProduct({
        productId: product.id,
        productName: product.name,
        brand: product.brand,
        categoryName: product.category?.name || 'Sans catégorie',
        defaultSellingPrice: defaultVariant?.selling_price || 0,
        defaultCostPrice: defaultVariant?.cost_price || 0,
        defaultColor,
      });
    },
    [isCashier, showToast]
  );

  const handleOpenEditVariant = useCallback(
    (product: ProductWithVariants, variant: any) => {
      if (isCashier) {
        showToast('Action non autorisée pour le profil caissier.', 'error');
        return;
      }
      setEditingVariantData({
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        brand: product.brand || 'Top Tendance',
        categoryId: product.category_id || '',
        size: variant.size || '',
        color: variant.color || '',
        sellingPrice: variant.selling_price ? variant.selling_price.toFixed(3) : '0.000',
        costPrice: variant.cost_price !== undefined ? variant.cost_price.toFixed(3) : '',
        stockQuantity: variant.stock_quantity ? variant.stock_quantity.toString() : '0',
        lowStockThreshold: variant.low_stock_threshold ? variant.low_stock_threshold.toString() : '5',
        sku: variant.sku || '',
        barcode: variant.barcode || '',
      });
    },
    [isCashier, showToast]
  );

  const handleOpenDeleteVariant = useCallback(
    (variantInfo: VariantToDeleteInfo) => {
      if (isCashier) {
        showToast('Action non autorisée pour le profil caissier.', 'error');
        return;
      }
      setVariantToDelete(variantInfo);
    },
    [isCashier, showToast]
  );

  // --- Deletion Confirm Handlers ---
  const handleDeleteProduct = useCallback(async () => {
    if (!productToDelete) return;
    if (isCashier) {
      showToast('Action non autorisée pour le profil caissier.', 'error');
      setProductToDelete(null);
      return;
    }

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

      // Soft-delete associated variants
      await supabase
        .from('variants')
        .update({ is_active: false })
        .eq('product_id', targetId);

      showToast(`Produit "${targetName}" supprimé`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la suppression', 'error');
      fetchInventory();
    } finally {
      setIsDeleting(false);
    }
  }, [productToDelete, isCashier, showToast, fetchInventory]);

  const handleDeleteVariant = useCallback(async () => {
    if (!variantToDelete) return;
    if (isCashier) {
      showToast('Action non autorisée pour le profil caissier.', 'error');
      setVariantToDelete(null);
      return;
    }

    setIsDeleting(true);
    const targetVariantId = variantToDelete.variantId;
    const targetProductId = variantToDelete.productId;
    const targetName = `${variantToDelete.productName}${variantToDelete.size ? ` (Taille ${variantToDelete.size})` : ''}`;
    const wasLastVariant = variantToDelete.totalVariantsCount <= 1;

    // Optimistic UI update: remove only this variant
    setProducts((prev) =>
      prev
        .map((p) => {
          if (p.id !== targetProductId) return p;
          return {
            ...p,
            variants: p.variants.filter((v) => v.id !== targetVariantId),
          };
        })
        .filter((p) => p.variants.length > 0)
    );
    setVariantToDelete(null);

    try {
      const { error: vErr } = await supabase
        .from('variants')
        .update({ is_active: false })
        .eq('id', targetVariantId);

      if (vErr) throw vErr;

      // If last variant of product, soft-delete parent product as well
      if (wasLastVariant) {
        await supabase
          .from('products')
          .update({ is_active: false })
          .eq('id', targetProductId);
      }

      showToast(`Variante "${targetName}" supprimée`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la suppression', 'error');
      fetchInventory();
    } finally {
      setIsDeleting(false);
    }
  }, [variantToDelete, isCashier, showToast, fetchInventory]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans select-none">
      {/* 6.2 Header + Tab Navigation */}
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
            Gestion Boutique & Responsable
          </h1>
        </div>

        {/* Tab Switchers */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Boxes size={14} /> Stock & Articles
          </button>
          {!isCashier && (
            <button
              onClick={() => setActiveTab('cashiers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'cashiers'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Users size={14} /> Équipe & Caissiers
            </button>
          )}
          <button
            onClick={() => setActiveTab('credits')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'credits'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Wallet size={14} /> Carnet de Crédit
          </button>
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'deliveries'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Truck size={14} /> Expéditions & Colis
          </button>
        </div>

        {activeTab === 'inventory' && (
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => setIsReceivingModalOpen(true)}
              className="flex-1 sm:flex-initial justify-center bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-bold py-2.5 px-3 sm:px-4 rounded-xl flex items-center gap-1.5 sm:gap-2 transition min-h-[40px] cursor-pointer"
            >
              <PackagePlus size={15} /> <span>Réception</span>
            </button>
            {!isCashier && (
              <button
                onClick={() => setIsProductModalOpen(true)}
                className="flex-1 sm:flex-initial justify-center bg-black hover:bg-gray-800 text-white text-xs font-bold py-2.5 px-3 sm:px-4 rounded-xl flex items-center gap-1.5 sm:gap-2 transition shadow-xs min-h-[40px] cursor-pointer"
              >
                <Plus size={15} /> <span>Nouveau Produit</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-3.5 sm:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
        {activeTab === 'deliveries' ? (
          <DeliveryManagementSection />
        ) : activeTab === 'credits' ? (
          <CreditLedger />
        ) : activeTab === 'cashiers' ? (
          <CashierManagementSection />
        ) : (
          <>
            {/* KPI Cards Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] sm:text-xs font-bold uppercase text-gray-500">
                    Total Unités en Stock
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5 sm:mt-1">
                    {totalStockUnits}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Boxes size={22} />
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] sm:text-xs font-bold uppercase text-gray-500">
                    Alertes Stock Faible
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5 sm:mt-1">
                    {lowStockVariants.length} articles
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle size={22} />
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-xs flex items-center justify-between sm:col-span-2 lg:col-span-1">
                <div>
                  <p className="text-[11px] sm:text-xs font-bold uppercase text-gray-500">
                    Références Catalogue
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5 sm:mt-1">
                    {allVariants.length} variantes
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <TrendingUp size={22} />
                </div>
              </div>
            </div>

            {/* Inventory Table Section (Filters, Search, Mobile Cards, Desktop Table, Batch Toolbar) */}
            <InventoryTableSection
              products={products}
              categories={categories}
              loading={loading}
              selectedVariants={selectedVariants}
              onToggleSelectVariant={handleToggleSelectVariant}
              onSelectAllVisible={handleSelectAllVisible}
              onClearSelection={handleClearSelection}
              onSelectAllUnprinted={handleSelectAllUnprinted}
              onQuickStockUpdate={handleQuickStockUpdate}
              onDirectStockCommit={handleDirectStockCommit}
              onOpenTagModal={(variant) => setTagModalVariant(variant)}
              onOpenEditVariant={handleOpenEditVariant}
              onOpenAddVariant={handleOpenAddVariant}
              onOpenDeleteVariant={handleOpenDeleteVariant}
              onOpenCategoryModal={() => setIsCategoryModalOpen(true)}
              onBatchTogglePrinted={handleBatchTogglePrinted}
              onTogglePrintedStatus={handleTogglePrintedStatus}
              onRefresh={fetchInventory}
              onOpenScanner={() => setIsCameraScannerOpen(true)}
              isCashier={isCashier}
            />
          </>
        )}
      </main>

      {/* --- Modals & Overlays --- */}

      {/* 3. New Product Modal */}
      <NewProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        categories={categories}
        existingBarcodes={existingBarcodes}
        existingSkus={existingSkus}
        onSuccess={fetchInventory}
      />

      {/* 4. Add Variant Modal */}
      <AddVariantModal
        targetProduct={addVariantProduct}
        onClose={() => setAddVariantProduct(null)}
        onSuccess={() => {
          fetchInventory();
          setAddVariantProduct(null);
        }}
        existingBarcodes={existingBarcodes}
        onOpenTagModal={(variant) => setTagModalVariant(variant)}
      />

      {/* 4. Edit Variant Modal */}
      <EditVariantModal
        editingData={editingVariantData}
        categories={categories}
        onClose={() => setEditingVariantData(null)}
        onSuccess={() => {
          fetchInventory();
          setEditingVariantData(null);
        }}
      />

      {/* 5. Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        productsCountMap={productsCountMap}
        onCategoriesChanged={fetchInventory}
        isCashier={isCashier}
      />

      {/* 5. Delete Variant Modal */}
      <VariantDeleteModal
        variantToDelete={variantToDelete}
        onClose={() => setVariantToDelete(null)}
        onConfirmDeleteVariant={handleDeleteVariant}
        onSwitchToDeleteProduct={(prod) => {
          setVariantToDelete(null);
          setProductToDelete(prod);
        }}
        isDeleting={isDeleting}
      />

      {/* 5. Delete Entire Product Modal */}
      <ProductDeleteModal
        productToDelete={productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirmDeleteProduct={handleDeleteProduct}
        isDeleting={isDeleting}
      />

      {/* Auxiliary: Barcode Tag Print Modal */}
      <BarcodeTagModal
        variant={tagModalVariant}
        onClose={() => setTagModalVariant(null)}
        onPrinted={handleVariantsPrinted}
      />

      {/* Auxiliary: Mobile Camera Barcode Scanner Modal */}
      <MobileScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={(code) => {
          setIsCameraScannerOpen(false);
          const found = allVariants.find(
            (v) => v.barcode === code || v.sku.toLowerCase() === code.toLowerCase()
          );
          if (found) {
            showToast(`Code scanné : ${found.productName} (${found.sku})`, 'success');
          } else {
            showToast(`Code scanné : ${code}`, 'info');
          }
        }}
        title="Recherche Inventaire par Caméra"
      />

      {/* Auxiliary: Delivery Receiving Modal */}
      <DeliveryReceivingModal
        isOpen={isReceivingModalOpen}
        variants={allVariants}
        onClose={() => setIsReceivingModalOpen(false)}
        onSuccess={fetchInventory}
      />
    </div>
  );
}
