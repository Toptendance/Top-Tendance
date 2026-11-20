'use client';

import React, { useState } from 'react';
import { FolderTree, AlertTriangle, Plus, Check, X, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient';
import { useToast } from '@/context/ToastContext';
import {
  CategoryManagerModalProps,
  VariantDeleteModalProps,
  ProductDeleteModalProps,
  InventoryCategory,
} from './types';

export {
  type CategoryManagerModalProps,
  type VariantDeleteModalProps,
  type ProductDeleteModalProps,
};

/**
 * 5.1 CategoryManagerModal Component
 * Allows adding new categories, inline editing of name & description,
 * and deleting categories with reference safety verification.
 */
export function CategoryManagerModal({
  isOpen,
  onClose,
  categories,
  productsCountMap,
  onCategoriesChanged,
  isCashier = false,
}: CategoryManagerModalProps) {
  const { showToast } = useToast();

  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatDesc, setEditingCatDesc] = useState('');
  const [catActionLoading, setCatActionLoading] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setEditingCatId(null);
    setCatError(null);
    setNewCatName('');
    setNewCatDesc('');
    onClose();
  };

  const getProductCount = (catId: string): number => {
    if (!productsCountMap) return 0;
    if (productsCountMap instanceof Map) {
      return productsCountMap.get(catId) || 0;
    }
    return productsCountMap[catId] || 0;
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCashier) {
      showToast('Action non autorisée pour le profil caissier.', 'error');
      return;
    }
    const trimmedName = newCatName.trim();
    if (!trimmedName) return;

    setCatActionLoading(true);
    setCatError(null);

    try {
      const { error } = await supabase
        .from('categories')
        .insert({
          name: trimmedName,
          description: newCatDesc.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      showToast(`Catégorie « ${trimmedName} » créée avec succès`, 'success');
      setNewCatName('');
      setNewCatDesc('');
      await onCategoriesChanged();
    } catch (err: any) {
      console.error('Failed to create category:', err);
      setCatError(err?.message || 'Erreur lors de la création de la catégorie');
    } finally {
      setCatActionLoading(false);
    }
  };

  const handleUpdateCategory = async (catId: string) => {
    const trimmedName = editingCatName.trim();
    if (!trimmedName) return;

    setCatActionLoading(true);
    setCatError(null);

    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: trimmedName,
          description: editingCatDesc.trim() || null,
        })
        .eq('id', catId);

      if (error) throw error;

      showToast('Catégorie mise à jour avec succès', 'success');
      setEditingCatId(null);
      await onCategoriesChanged();
    } catch (err: any) {
      console.error('Failed to update category:', err);
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
      // 1. Check local mapped count first
      const localCount = getProductCount(catId);
      if (localCount > 0) {
        setCatError(
          `Impossible de supprimer « ${catName} » : elle contient ${localCount} produit(s). Réaffectez-les avant de supprimer.`
        );
        return;
      }

      // 2. Safety guard: query database to verify no products reference this category
      const { count, error: countErr } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', catId);

      if (countErr) throw countErr;

      if (count && count > 0) {
        setCatError(
          `Impossible de supprimer « ${catName} » : elle contient ${count} produit(s). Réaffectez-les avant de supprimer.`
        );
        return;
      }

      const { error: delErr } = await supabase
        .from('categories')
        .delete()
        .eq('id', catId);

      if (delErr) throw delErr;

      showToast(`Catégorie « ${catName} » supprimée`, 'info');
      await onCategoriesChanged();
    } catch (err: any) {
      console.error('Failed to delete category:', err);
      setCatError(err?.message || 'Erreur lors de la suppression');
    } finally {
      setCatActionLoading(false);
    }
  };

  return (
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
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 text-sm font-semibold cursor-pointer"
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
          <form
            onSubmit={handleCreateCategory}
            className="mt-4 p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5"
          >
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
                className="w-full text-xs p-2.5 border rounded-lg bg-white outline-none focus:ring-1 focus:ring-black"
              />
              <input
                type="text"
                placeholder="Description (optionnel)"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                className="w-full text-xs p-2.5 border rounded-lg bg-white outline-none focus:ring-1 focus:ring-black"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={catActionLoading || !newCatName.trim()}
                className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-800 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus size={14} />
                <span>{catActionLoading ? 'Ajout...' : 'Ajouter'}</span>
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
            categories.map((c) => {
              const isEditing = editingCatId === c.id;
              const count = getProductCount(c.id);

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
                        className="w-full text-xs p-1.5 border rounded-md outline-none focus:ring-1 focus:ring-black"
                        autoFocus
                      />
                      <input
                        type="text"
                        placeholder="Description (optionnel)"
                        value={editingCatDesc}
                        onChange={(e) => setEditingCatDesc(e.target.value)}
                        className="w-full text-xs p-1.5 border rounded-md outline-none focus:ring-1 focus:ring-black"
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
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Sauvegarder"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCatId(null)}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition cursor-pointer"
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
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
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
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
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
            onClick={handleClose}
            className="px-4 py-2 border rounded-xl text-xs font-semibold hover:bg-gray-100 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 5.2 VariantDeleteModal Component
 * Soft-deletes a single variant. If it's the last variant of the model,
 * offers an upgrade to delete the entire product instead.
 */
export function VariantDeleteModal({
  variantToDelete,
  onClose,
  onConfirmDeleteVariant,
  onSwitchToDeleteProduct,
  isDeleting,
}: VariantDeleteModalProps) {
  if (!variantToDelete) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full flex flex-col">
        <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
          <AlertTriangle size={20} />
        </div>
        <h3 className="font-bold text-base text-gray-900">Supprimer cette variante ?</h3>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          Supprimer la variante{' '}
          <span className="font-semibold text-gray-800">« {variantToDelete.productName} »</span>
          {variantToDelete.size ? (
            <span>
              {' '}(Taille <span className="font-semibold text-gray-900">{variantToDelete.size}</span>)
            </span>
          ) : null}
          {variantToDelete.color ? <span> — Couleur {variantToDelete.color}</span> : null} ?
        </p>
        <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800">
          ✓ Les autres tailles et variantes de ce modèle restent conservées.
        </div>

        <div className="mt-5 pt-3 border-t flex flex-col gap-2">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="px-4 py-2 border rounded-xl text-xs font-semibold hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onConfirmDeleteVariant}
              className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 size={13} />
              {isDeleting ? 'Suppression...' : 'Supprimer la variante'}
            </button>
          </div>

          {variantToDelete.totalVariantsCount > 1 && (
            <div className="pt-2 border-t text-center">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() =>
                  onSwitchToDeleteProduct({
                    id: variantToDelete.productId,
                    name: variantToDelete.productName,
                  })
                }
                className="text-[11px] text-gray-500 hover:text-red-600 underline transition cursor-pointer"
              >
                Ou supprimer tout le modèle ({variantToDelete.totalVariantsCount} tailles)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 5.3 ProductDeleteModal Component
 * Soft-deletes the parent product and all its associated variants.
 */
export function ProductDeleteModal({
  productToDelete,
  onClose,
  onConfirmDeleteProduct,
  isDeleting,
}: ProductDeleteModalProps) {
  if (!productToDelete) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full flex flex-col">
        <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
          <AlertTriangle size={20} />
        </div>
        <h3 className="font-bold text-base text-gray-900">Supprimer tout le modèle ?</h3>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          Supprimer le modèle complet{' '}
          <span className="font-semibold text-gray-800">« {productToDelete.name} »</span> ? Cette
          action est irréversible. Le modèle et{' '}
          <span className="font-bold text-red-700">toutes ses variantes associées</span> ne seront
          plus visibles en caisse ni dans l&apos;inventaire.
        </p>
        <div className="mt-5 pt-3 border-t flex justify-end gap-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2 border rounded-xl text-xs font-semibold hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirmDeleteProduct}
            className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 size={13} />
            {isDeleting ? 'Suppression...' : 'Supprimer le modèle'}
          </button>
        </div>
      </div>
    </div>
  );
}
