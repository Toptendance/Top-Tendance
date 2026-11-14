'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';
import BarcodeTagModal from '@/components/pos/BarcodeTagModal';
import DeliveryReceivingModal from '@/components/pos/DeliveryReceivingModal';
import MobileScannerModal from '@/components/pos/MobileScannerModal';
import CashierManagementSection from '@/components/manager/CashierManagementSection';
import CreditLedger from '@/components/pos/CreditLedger';
import DeliveryManagementSection from '@/components/pos/DeliveryManagementSection';
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
  Trash2,
  Camera,
  Sparkles,
  FolderTree,
  Check,
  X,
  Layers,
  Sliders,
  CheckSquare,
  Square,
  Printer,
  Users,
  Wallet,
  Truck
} from 'lucide-react';
import { generateUniqueBarcode, generateVariantSku } from '@/utils/barcodeGenerator';
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
    is_printed?: boolean;
    last_printed_at?: string | null;
  }>;
}

export default function InventoryDashboardPage() {
  const { showToast } = useToast();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'cashiers' | 'credits' | 'deliveries'>('inventory');
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);
  const [printFilter, setPrintFilter] = useState<'all' | 'unprinted' | 'printed'>('all');

  // Multi-item selection for batch barcode printing
  const [selectedVariants, setSelectedVariants] = useState<
    Map<
      string,
      {
        variantId: string;
        productName: string;
        sku: string;
        barcode: string;
        size: string | null;
        color: string | null;
        selling_price: number;
        stock_quantity: number;
        quantity: number;
      }
    >
  >(new Map());

  // Modals state
  const [tagModalVariant, setTagModalVariant] = useState<any>(null);
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatDesc, setEditingCatDesc] = useState('');
  const [catActionLoading, setCatActionLoading] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
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
  const [isSkuDuplicate, setIsSkuDuplicate] = useState(false);

  // Multi-size batch state
  const [isMultiSize, setIsMultiSize] = useState(false);
  const [shoeStart, setShoeStart] = useState(36);
  const [shoeEnd, setShoeEnd] = useState(40);
  const [customSizesInput, setCustomSizesInput] = useState('');
  interface VariantDraft {
    size: string;
    sku: string;
    barcode: string;
    stock: number;
    selling_price: string;
    cost_price: string;
  }
  const [batchVariants, setBatchVariants] = useState<VariantDraft[]>([]);

  // Collect existing barcodes in memory to prevent client-side collisions
  const getKnownBarcodes = (): Set<string> => {
    const set = new Set<string>();
    products.forEach((p) => {
      p.variants.forEach((v) => {
        if (v.barcode) set.add(v.barcode);
      });
    });
    return set;
  };

  // Helper to recompute multi-size draft table
  const applySizeListToBatch = (sizes: string[]) => {
    const known = getKnownBarcodes();
    const drafts: VariantDraft[] = sizes.map((sz) => {
      const generatedBarcode = generateUniqueBarcode(known);
      known.add(generatedBarcode);
      return {
        size: sz,
        sku: generateVariantSku(productForm.name || 'PROD', sz, productForm.color || 'STD'),
        barcode: generatedBarcode,
        stock: parseInt(productForm.stock_quantity) || 10,
        selling_price: productForm.selling_price || '79.000',
        cost_price: productForm.cost_price || '35.000',
      };
    });
    setBatchVariants(drafts);
  };

  const handleApplyShoeRange = (start: number, end: number) => {
    const list: string[] = [];
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    for (let i = min; i <= max; i++) {
      list.push(i.toString());
    }
    applySizeListToBatch(list);
  };

  const handleApplyClothingPreset = () => {
    applySizeListToBatch(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
  };

  const handleApplyCustomSizes = () => {
    const cleaned = customSizesInput
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (cleaned.length > 0) {
      applySizeListToBatch(cleaned);
    }
  };

  // Helper: Generate structured SKU from product name, size, and color
  const generateSku = (name: string, size: string, color: string): string => {
    return generateVariantSku(name, size, color);
  };

  const handleAutoGenerateSku = () => {
    const newSku = generateSku(productForm.name, productForm.size, productForm.color);
    setProductForm((prev) => ({ ...prev, sku: newSku }));
    setIsSkuDuplicate(false);
    if (formError && formError.includes('SKU')) {
      setFormError(null);
    }
  };

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

    // Fetch user profile to detect cashier role
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
          // If cashier is on cashiers tab, force switch to inventory
          if (profile.role === 'cashier') {
            setActiveTab((current) => (current === 'cashiers' ? 'inventory' : current));
          }
        }
      }
    }
    loadUserProfile();
  }, []);

  const isCashier = userProfile?.role === 'cashier';

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

  // All visible variants currently displayed in table that have barcodes
  const visiblePrintableVariants = filteredProducts.flatMap((p) =>
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

  const areAllVisibleSelected =
    visiblePrintableVariants.length > 0 &&
    visiblePrintableVariants.every((v) => selectedVariants.has(v.variantId));

  const toggleSelectAllVisible = () => {
    if (areAllVisibleSelected) {
      // Unselect all visible
      setSelectedVariants((prev) => {
        const next = new Map(prev);
        visiblePrintableVariants.forEach((v) => next.delete(v.variantId));
        return next;
      });
    } else {
      // Select all visible
      setSelectedVariants((prev) => {
        const next = new Map(prev);
        visiblePrintableVariants.forEach((v) => {
          if (!next.has(v.variantId)) {
            next.set(v.variantId, v);
          }
        });
        return next;
      });
    }
  };

  const toggleSelectVariant = (item: {
    variantId: string;
    productName: string;
    sku: string;
    barcode: string;
    size: string | null;
    color: string | null;
    selling_price: number;
    stock_quantity: number;
  }) => {
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
  };

  const handleClearSelection = () => {
    setSelectedVariants(new Map());
  };

  // Select all unprinted items across visible filtered inventory
  const handleSelectAllUnprinted = () => {
    const unprinted = visiblePrintableVariants.filter((v) => {
      // Find original variant from products to get is_printed status
      for (const p of products) {
        const found = p.variants.find((vr) => vr.id === v.variantId);
        if (found) return !found.is_printed;
      }
      return true;
    });

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
  };

  // Toggle or set printed status for variant(s)
  const handleTogglePrintedStatus = async (variantId: string, currentStatus?: boolean) => {
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
  };

  // Callback after printing from BarcodeTagModal
  const handleVariantsPrinted = async (variantIds: string[]) => {
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
  };

  // Handle Create Product & Variant
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCashier) {
      showToast('Action non autorisée pour le profil caissier.', 'error');
      return;
    }
    setFormError(null);
    setIsSkuDuplicate(false);
    try {
      if (isMultiSize && batchVariants.length === 0) {
        setFormError('Veuillez ajouter au moins une taille au lot.');
        return;
      }

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

      // 2. Prepare variants to insert (single vs batch)
      if (isMultiSize) {
        const variantsToInsert = batchVariants.map((item) => ({
          product_id: prod.id,
          sku: item.sku,
          barcode: item.barcode || null,
          size: item.size,
          color: productForm.color,
          selling_price: parseFloat(productForm.selling_price),
          stock_quantity: item.stock,
          low_stock_threshold: parseInt(productForm.low_stock_threshold),
        }));

        const { data: insertedVariants, error: vErr } = await supabase
          .from('variants')
          .insert(variantsToInsert)
          .select();

        if (vErr) {
          await supabase.from('products').delete().eq('id', prod.id);
          throw vErr;
        }

        // Insert costs into variant_costs for all variants
        if (productForm.cost_price && insertedVariants) {
          const costRows = insertedVariants.map((v) => ({
            variant_id: v.id,
            cost_price: parseFloat(productForm.cost_price),
          }));
          await supabase.from('variant_costs').insert(costRows);
        }

        // Log initial receiving movement for variants with stock > 0
        if (insertedVariants) {
          const movements = insertedVariants
            .filter((v) => v.stock_quantity > 0)
            .map((v) => ({
              variant_id: v.id,
              quantity_change: v.stock_quantity,
              movement_type: 'receiving',
              reference_id: 'Initial Lot',
            }));
          if (movements.length > 0) {
            await supabase.from('stock_movements').insert(movements);
          }
        }
      } else {
        // Single Variant insertion
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

        if (vErr) {
          // If variant insert failed, rollback product to prevent orphaned records
          await supabase.from('products').delete().eq('id', prod.id);
          throw vErr;
        }

        // Insert cost price into variant_costs
        if (productForm.cost_price) {
          await supabase.from('variant_costs').insert({
            variant_id: variant.id,
            cost_price: parseFloat(productForm.cost_price),
          });
        }

        // Log initial receiving movement if stock > 0
        if (parseInt(productForm.stock_quantity) > 0) {
          await supabase.from('stock_movements').insert({
            variant_id: variant.id,
            quantity_change: parseInt(productForm.stock_quantity),
            movement_type: 'receiving',
            reference_id: 'Initial Stock',
          });
        }
      }

      setIsProductModalOpen(false);
      setIsMultiSize(false);
      setBatchVariants([]);
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
      if (err?.code === '23505' || err?.message?.includes('variants_sku_key') || err?.message?.includes('duplicate key') || err?.message?.toLowerCase()?.includes('sku')) {
        setIsSkuDuplicate(true);
        setFormError("Un SKU en doublon a été détecté. Modifiez-le ou utilisez 'Régénérer SKUs & Barcodes'.");
      } else {
        setFormError(err.message || 'Erreur lors de la création');
      }
    }
  };

  // Category Management Handlers
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCashier) {
      showToast('Action non autorisée pour le profil caissier.', 'error');
      return;
    }
    if (!newCatName.trim()) return;
    setCatActionLoading(true);
    setCatError(null);
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          name: newCatName.trim(),
          description: newCatDesc.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      showToast(`Catégorie « ${newCatName.trim()} » créée avec succès`, 'success');
      setNewCatName('');
      setNewCatDesc('');
      fetchInventory();
    } catch (err: any) {
      setCatError(err?.message || 'Erreur lors de la création de la catégorie');
    } finally {
      setCatActionLoading(false);
    }
  };

  const handleUpdateCategory = async (catId: string) => {
    if (!editingCatName.trim()) return;
    setCatActionLoading(true);
    setCatError(null);
    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: editingCatName.trim(),
          description: editingCatDesc.trim() || null,
        })
        .eq('id', catId);

      if (error) throw error;
      showToast(`Catégorie mise à jour`, 'success');
      setEditingCatId(null);
      fetchInventory();
    } catch (err: any) {
      setCatError(err?.message || 'Erreur lors de la mise à jour');
    } finally {
      setCatActionLoading(false);
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (isCashier) {
      showToast('Action non autorisée pour le profil caissier.', 'error');
      return;
    }
    setCatActionLoading(true);
    setCatError(null);
    try {
      // Guard: Check if products belong to this category
      const { count, error: countErr } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', catId);

      if (countErr) throw countErr;

      if (count && count > 0) {
        setCatError(`Impossible de supprimer « ${catName} » : elle contient ${count} produit(s). Réaffectez-les avant de supprimer.`);
        return;
      }

      const { error: delErr } = await supabase
        .from('categories')
        .delete()
        .eq('id', catId);

      if (delErr) throw delErr;
      showToast(`Catégorie « ${catName} » supprimée`, 'info');
      if (selectedCategory === catId) {
        setSelectedCategory('all');
      }
      fetchInventory();
    } catch (err: any) {
      setCatError(err?.message || 'Erreur lors de la suppression');
    } finally {
      setCatActionLoading(false);
    }
  };

  // Handle Soft Delete Product
  const handleDeleteProduct = async () => {
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
            Gestion Boutique & Responsable
          </h1>
        </div>

        {/* Tab switchers in Header */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'credits'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Wallet size={14} /> Carnet de Crédit
          </button>
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
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
              className="flex-1 sm:flex-initial justify-center bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-bold py-2.5 px-3 sm:px-4 rounded-xl flex items-center gap-1.5 sm:gap-2 transition min-h-[40px]"
            >
              <PackagePlus size={15} /> <span>Réception</span>
            </button>
            {!isCashier && (
              <button
                onClick={() => setIsProductModalOpen(true)}
                className="flex-1 sm:flex-initial justify-center bg-black hover:bg-gray-800 text-white text-xs font-bold py-2.5 px-3 sm:px-4 rounded-xl flex items-center gap-1.5 sm:gap-2 transition shadow-xs min-h-[40px]"
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
          <div className="relative flex-1 w-full flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Rechercher nom, SKU ou code-barres..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs sm:text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black min-h-[40px]"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsCameraScannerOpen(true)}
              title="Scanner un code avec la caméra"
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 min-h-[40px] transition shrink-0"
            >
              <Camera size={16} />
              <span className="hidden sm:inline">Caméra</span>
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto items-center flex-wrap sm:flex-nowrap">
            {/* Filter by Print Status */}
            <select
              value={printFilter}
              onChange={(e) => setPrintFilter(e.target.value as any)}
              className="text-xs border rounded-xl p-2.5 bg-gray-50 focus:bg-white min-h-[40px] font-medium"
              title="Filtrer selon le statut d'impression des étiquettes"
            >
              <option value="all">Toutes étiquettes</option>
              <option value="unprinted">Non imprimés seulement</option>
              <option value="printed">Déjà imprimés</option>
            </select>

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
              type="button"
              onClick={() => {
                setCatError(null);
                setIsCategoryModalOpen(true);
              }}
              title="Gérer les catégories"
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 min-h-[40px] transition shrink-0"
            >
              <FolderTree size={15} />
              <span className="hidden md:inline">Gérer Catégories</span>
            </button>

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
            {/* Mobile Select All & Quick Selection Bar */}
            {visiblePrintableVariants.length > 0 && (
              <div className="p-3 bg-gray-50 flex flex-wrap items-center justify-between gap-2 border-b">
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={areAllVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                  />
                  <span>Sélectionner tout ({visiblePrintableVariants.length})</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllUnprinted}
                    className="px-2 py-1 bg-white border border-gray-300 hover:border-black rounded-lg text-[11px] font-semibold text-gray-800 transition"
                  >
                    Non imprimés
                  </button>
                  {selectedVariants.size > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSelection}
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
                                toggleSelectVariant({
                                  variantId: variant.id,
                                  productName: product.name,
                                  sku: variant.sku,
                                  barcode: variant.barcode!,
                                  size: variant.size,
                                  color: variant.color,
                                  selling_price: variant.selling_price,
                                  stock_quantity: variant.stock_quantity,
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
                        {/* Printed status badge */}
                        <button
                          type="button"
                          onClick={() => handleTogglePrintedStatus(variant.id, variant.is_printed)}
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
                              setTagModalVariant({
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
                            onClick={() => setProductToDelete({ id: product.id, name: product.name })}
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
              <thead className="bg-gray-50 text-gray-500 uppercase border-b font-semibold">
                <tr>
                  <th className="p-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={areAllVisibleSelected}
                      onChange={toggleSelectAllVisible}
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
                                  toggleSelectVariant({
                                    variantId: variant.id,
                                    productName: product.name,
                                    sku: variant.sku,
                                    barcode: variant.barcode!,
                                    size: variant.size,
                                    color: variant.color,
                                    selling_price: variant.selling_price,
                                    stock_quantity: variant.stock_quantity,
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
                            {variant.size ? <span className="bg-gray-100 px-2 py-0.5 rounded font-mono mr-1">T: {variant.size}</span> : null}
                            {variant.color ? <span className="bg-gray-100 px-2 py-0.5 rounded font-mono">{variant.color}</span> : null}
                          </td>
                          <td className="p-4 font-mono text-gray-700">
                            {variant.barcode || <span className="text-gray-400 italic">Non assigné</span>}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleTogglePrintedStatus(variant.id, variant.is_printed)}
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
                                onClick={() => setProductToDelete({ id: product.id, name: product.name })}
                                title="Supprimer ce produit"
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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  // If single item selected, open modal with that single item;
                  // otherwise pass the array to tagModalVariant once updated in Step B
                  const list = Array.from(selectedVariants.values());
                  if (list.length === 1) {
                    setTagModalVariant(list[0]);
                  } else {
                    setTagModalVariant(list);
                  }
                }}
                className="bg-white hover:bg-gray-100 text-gray-900 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-xs"
              >
                <Printer size={15} />
                <span>Imprimer les étiquettes</span>
                <span className="px-1.5 py-0.5 rounded-md bg-gray-200 text-gray-800 font-mono text-[10px]">
                  {Array.from(selectedVariants.values()).reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </button>

              <button
                type="button"
                onClick={handleClearSelection}
                className="text-gray-400 hover:text-white px-2 sm:px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                title="Désélectionner tout"
              >
                <X size={14} />
                <span className="hidden sm:inline">Désélectionner</span>
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Barcode Tag Generator Modal */}
      <BarcodeTagModal
        variant={tagModalVariant}
        onClose={() => setTagModalVariant(null)}
        onPrinted={handleVariantsPrinted}
      />

      {/* Mobile Camera Barcode Scanner Modal */}
      <MobileScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={(code) => {
          setSearchTerm(code);
          setIsCameraScannerOpen(false);
        }}
        title="Recherche Inventaire par Caméra"
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

              {/* Mode Toggle: Single Variant vs Multi-Sizes */}
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={15} className="text-gray-700" />
                    <div>
                      <p className="text-xs font-bold text-gray-900">Tailles Multiples en Lot (Bottes, Vêtements...)</p>
                      <p className="text-[10px] text-gray-500">Générer automatiquement une plage de tailles avec codes uniques</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMultiSize}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsMultiSize(checked);
                        if (checked && batchVariants.length === 0) {
                          handleApplyShoeRange(shoeStart, shoeEnd);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                  </label>
                </div>

                {isMultiSize && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2.5">
                    {/* Presets */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-600 uppercase mr-1">Préréglages:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShoeStart(36);
                          setShoeEnd(40);
                          handleApplyShoeRange(36, 40);
                        }}
                        className="text-[10px] bg-white border border-gray-300 hover:border-black px-2 py-1 rounded-md font-semibold text-gray-700 transition"
                      >
                        Bottes/Chaussures (36-40)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShoeStart(36);
                          setShoeEnd(41);
                          handleApplyShoeRange(36, 41);
                        }}
                        className="text-[10px] bg-white border border-gray-300 hover:border-black px-2 py-1 rounded-md font-semibold text-gray-700 transition"
                      >
                        36 à 41
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyClothingPreset}
                        className="text-[10px] bg-white border border-gray-300 hover:border-black px-2 py-1 rounded-md font-semibold text-gray-700 transition"
                      >
                        Vêtements (XS-XXL)
                      </button>
                    </div>

                    {/* Range Selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div className="flex items-center gap-1.5 bg-white p-1.5 border rounded-lg">
                        <span className="text-[10px] text-gray-500 font-bold">Plage pointures:</span>
                        <input
                          type="number"
                          min="20"
                          max="50"
                          value={shoeStart}
                          onChange={(e) => setShoeStart(parseInt(e.target.value) || 36)}
                          className="w-12 text-center text-xs border rounded p-1 font-mono"
                        />
                        <span className="text-xs text-gray-400">à</span>
                        <input
                          type="number"
                          min="20"
                          max="50"
                          value={shoeEnd}
                          onChange={(e) => setShoeEnd(parseInt(e.target.value) || 40)}
                          className="w-12 text-center text-xs border rounded p-1 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyShoeRange(shoeStart, shoeEnd)}
                          className="text-[10px] bg-black text-white px-2 py-1 rounded font-bold hover:bg-gray-800 ml-auto"
                        >
                          Appliquer
                        </button>
                      </div>

                      <div className="flex items-center gap-1 bg-white p-1.5 border rounded-lg">
                        <input
                          type="text"
                          placeholder="Tailles libres: 36,37,38..."
                          value={customSizesInput}
                          onChange={(e) => setCustomSizesInput(e.target.value)}
                          className="flex-1 text-xs border rounded p-1"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCustomSizes}
                          className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-1 rounded font-bold"
                        >
                          Ajouter
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Single Variant Input Fields (only when isMultiSize is false) */}
              {!isMultiSize ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-gray-700 uppercase">
                          SKU (Unique)
                        </label>
                        <button
                          type="button"
                          onClick={handleAutoGenerateSku}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline"
                        >
                          <Sparkles size={11} /> Auto-générer
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        value={productForm.sku}
                        onChange={(e) => {
                          setProductForm({ ...productForm, sku: e.target.value });
                          if (isSkuDuplicate) setIsSkuDuplicate(false);
                        }}
                        className={`w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl font-mono transition ${
                          isSkuDuplicate
                            ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-1 focus:ring-red-400'
                            : 'border-gray-200'
                        }`}
                        placeholder="Ex: ROBE-SAT-M-NOIR"
                      />
                      {isSkuDuplicate && (
                        <p className="text-[10px] text-red-600 mt-1">
                          SKU déjà existant dans la base.
                        </p>
                      )}
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
                </>
              ) : (
                /* Multi-Size Variant Table Preview */
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                        Couleur Commune
                      </label>
                      <input
                        type="text"
                        value={productForm.color}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProductForm({ ...productForm, color: val });
                          setBatchVariants((prev) =>
                            prev.map((v) => ({
                              ...v,
                              sku: generateVariantSku(productForm.name || 'PROD', v.size, val),
                            }))
                          );
                        }}
                        className="w-full text-sm sm:text-xs p-2.5 sm:p-2 border rounded-xl"
                        placeholder="Ex: Noir"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          applySizeListToBatch(batchVariants.map((v) => v.size));
                        }}
                        className="w-full py-2.5 px-3 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                      >
                        <RefreshCw size={13} /> Régénérer SKUs & Barcodes
                      </button>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-100 px-3 py-1.5 flex justify-between items-center text-[11px] font-bold text-gray-700">
                      <span>Tailles & Codes Générés ({batchVariants.length})</span>
                      <span className="text-[10px] text-gray-500 font-normal">Chaque taille a un code unique</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 text-xs">
                      {batchVariants.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-400">
                          Aucune taille sélectionnée. Cliquez sur un préréglage ci-dessus.
                        </div>
                      ) : (
                        batchVariants.map((item, idx) => (
                          <div key={idx} className="p-2 sm:p-2.5 flex flex-wrap items-center gap-2 hover:bg-gray-50">
                            <span className="inline-flex items-center justify-center w-8 h-7 bg-black text-white font-black text-xs rounded-lg">
                              {item.size}
                            </span>
                            <div className="flex-1 min-w-[130px]">
                              <p className="font-mono text-[10px] text-gray-500 truncate">{item.sku}</p>
                              <div className="flex items-center gap-1 text-[11px] font-mono text-gray-900 font-bold">
                                <Barcode size={12} className="text-gray-400" />
                                <span>{item.barcode}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <label className="text-[10px] text-gray-400 font-bold uppercase">Qté:</label>
                              <input
                                type="number"
                                min="0"
                                value={item.stock}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setBatchVariants((prev) =>
                                    prev.map((v, i) => (i === idx ? { ...v, stock: val } : v))
                                  );
                                }}
                                className="w-14 text-center border rounded p-1 font-mono text-xs"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setBatchVariants((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              className="text-gray-400 hover:text-red-600 p-1 rounded"
                              title="Supprimer cette taille"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

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
      {/* Category Manager Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 max-w-lg w-full flex flex-col my-auto border border-gray-100 max-h-[88vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FolderTree size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">
                    Gestion des Catégories
                  </h3>
                  <p className="text-xs text-gray-400">
                    Ajouter, renommer ou supprimer des catégories
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCatId(null);
                  setCatError(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Error Banner */}
            {catError && (
              <div className="mt-3 p-2.5 bg-red-50 text-red-700 text-xs rounded-lg flex items-start gap-1.5 border border-red-200">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{catError}</span>
              </div>
            )}

            {/* New Category Form (Managers Only) */}
            {!isCashier && (
              <form onSubmit={handleCreateCategory} className="mt-4 p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                  + Nouvelle Catégorie
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nom (ex: Accessoires)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="w-full text-xs p-2.5 border rounded-lg bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Description (optionnel)"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    className="w-full text-xs p-2.5 border rounded-lg bg-white"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={catActionLoading || !newCatName.trim()}
                    className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-800 disabled:opacity-50 transition flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>Ajouter</span>
                  </button>
                </div>
              </form>
            )}

            {/* Categories List */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                Catégories existantes ({categories.length})
              </span>

              {categories.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">Aucune catégorie</p>
              ) : (
                categories.map((c: any) => {
                  const isEditing = editingCatId === c.id;
                  const count = products.filter((p) => p.category_id === c.id).length;

                  return (
                    <div
                      key={c.id}
                      className="p-3 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-gray-300 transition"
                    >
                      {isEditing ? (
                        <div className="flex-1 space-y-1.5">
                          <input
                            type="text"
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                            className="w-full text-xs p-1.5 border rounded-md"
                            autoFocus
                          />
                          <input
                            type="text"
                            placeholder="Description (optionnel)"
                            value={editingCatDesc}
                            onChange={(e) => setEditingCatDesc(e.target.value)}
                            className="w-full text-xs p-1.5 border rounded-md"
                          />
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900 truncate">
                              {c.name}
                            </span>
                            <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">
                              {count} article{count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {c.description && (
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">
                              {c.description}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateCategory(c.id)}
                              disabled={catActionLoading}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                              title="Sauvegarder"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCatId(null)}
                              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition"
                              title="Annuler"
                            >
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            {!isCashier && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCatId(c.id);
                                  setEditingCatName(c.name);
                                  setEditingCatDesc(c.description || '');
                                  setCatError(null);
                                }}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
                                title="Renommer"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {!isCashier && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(c.id, c.name)}
                                disabled={catActionLoading}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold hover:bg-gray-100"
              >
                Fermer
              </button>
            </div>
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

