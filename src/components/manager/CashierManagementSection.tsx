'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  KeyRound,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  Mail,
  Calendar,
  X,
  Eye,
  EyeOff,
  UserCheck,
  UserX
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';

interface CashierUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export default function CashierManagementSection() {
  const { showToast } = useToast();
  const [cashiers, setCashiers] = useState<CashierUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Deletion / Reset Password confirmation state
  const [cashierToDelete, setCashierToDelete] = useState<CashierUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cashierToReset, setCashierToReset] = useState<CashierUser | null>(null);
  const [newPasswordForReset, setNewPasswordForReset] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Fetch cashiers list
  const fetchCashiers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/manager/cashiers');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors du chargement des caissiers');
      }
      setCashiers(data.cashiers || []);
    } catch (err: any) {
      showToast(err.message || 'Impossible de charger la liste des caissiers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashiers();
  }, []);

  // Generate random secure password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
  };

  // Add cashier submit
  const handleAddCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setModalError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (password.length < 6) {
      setModalError('Le mot de passe doit comporter au moins 6 caractères');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/manager/cashiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'ajout du caissier");
      }

      showToast(`Caissier "${fullName.trim()}" ajouté avec succès !`, 'success');
      setIsAddModalOpen(false);
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      fetchCashiers();
    } catch (err: any) {
      setModalError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active/Inactive Status
  const handleToggleStatus = async (cashier: CashierUser) => {
    try {
      const newStatus = !cashier.is_active;
      const res = await fetch('/api/manager/cashiers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashierId: cashier.id,
          isActive: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors du changement de statut');
      }

      setCashiers((prev) =>
        prev.map((c) => (c.id === cashier.id ? { ...c, is_active: newStatus } : c))
      );
      showToast(
        `Caissier "${cashier.full_name}" marqué comme ${newStatus ? 'Actif' : 'Inactif'}`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la mise à jour', 'error');
    }
  };

  // Confirm Delete
  const handleDeleteCashier = async () => {
    if (!cashierToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/manager/cashiers?id=${cashierToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression');
      }
      showToast(`Compte caissier "${cashierToDelete.full_name}" supprimé`, 'success');
      setCashiers((prev) => prev.filter((c) => c.id !== cashierToDelete.id));
      setCashierToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Impossible de supprimer ce compte', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset Password Submit
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierToReset || !newPasswordForReset || newPasswordForReset.length < 6) {
      showToast('Le mot de passe doit comporter au moins 6 caractères', 'error');
      return;
    }
    setIsResetting(true);
    try {
      const res = await fetch('/api/manager/cashiers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashierId: cashierToReset.id,
          password: newPasswordForReset,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la réinitialisation');
      }
      showToast(`Nouveau mot de passe défini pour "${cashierToReset.full_name}"`, 'success');
      setCashierToReset(null);
      setNewPasswordForReset('');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la réinitialisation', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // Filtering
  const filteredCashiers = cashiers.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term))
    );
  });

  const activeCashiersCount = cashiers.filter((c) => c.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header Metric Counters & Action Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Total Caissiers
            </p>
            <p className="text-2xl font-black text-gray-900 mt-1">{cashiers.length}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Caissiers Actifs
            </p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{activeCashiersCount}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Droits Caisse
            </p>
            <p className="text-xs font-semibold text-gray-700 mt-1">
              Accès POS & Vente directe
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher caissier, email, tél..."
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:border-black transition"
          />
          <Search size={15} className="absolute left-3 top-3 text-gray-400" />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={fetchCashiers}
            disabled={loading}
            className="p-2.5 border rounded-xl text-gray-600 hover:text-black hover:bg-gray-50 transition"
            title="Rafraîchir"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-black hover:bg-gray-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 transition shadow-xs"
          >
            <UserPlus size={15} />
            <span>Nouveau Caissier</span>
          </button>
        </div>
      </div>

      {/* Cashier Table */}
      <div className="bg-white rounded-2xl border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Caissier</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Statut</th>
                <th className="py-3.5 px-4">Dernière Connexion</th>
                <th className="py-3.5 px-4">Date d'Ajout</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-gray-500" />
                    Chargement de l'équipe...
                  </td>
                </tr>
              ) : filteredCashiers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <Users size={32} className="mx-auto mb-2 text-gray-300" />
                    Aucun caissier trouvé.
                  </td>
                </tr>
              ) : (
                filteredCashiers.map((cashier) => (
                  <tr key={cashier.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0">
                          {cashier.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{cashier.full_name}</p>
                          <span className="inline-block text-[10px] text-gray-500 font-medium">
                            💼 Caissier Boutique
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <p className="flex items-center gap-1.5 text-gray-700 font-medium">
                          <Mail size={12} className="text-gray-400" /> {cashier.email}
                        </p>
                        {cashier.phone && (
                          <p className="flex items-center gap-1.5 text-gray-500">
                            <Phone size={12} className="text-gray-400" /> {cashier.phone}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleStatus(cashier)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                          cashier.is_active
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                        title="Cliquer pour changer le statut"
                      >
                        {cashier.is_active ? (
                          <>
                            <CheckCircle2 size={11} /> Actif
                          </>
                        ) : (
                          <>
                            <UserX size={11} /> Inactif
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-gray-600">
                      {cashier.last_sign_in_at
                        ? new Date(cashier.last_sign_in_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Jamais connecté'}
                    </td>

                    <td className="py-3.5 px-4 text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-gray-400" />
                        {new Date(cashier.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setCashierToReset(cashier)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Changer le mot de passe"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => setCashierToDelete(cashier)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Supprimer ce caissier"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Nouveau Caissier */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900">Ajouter un Caissier</h3>
                  <p className="text-[11px] text-gray-500">Création des accès Caisse & POS</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-black p-1"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddCashier} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  Nom Complet du Caissier *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Yasmine Trabelsi"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl font-medium focus:bg-white focus:outline-hidden focus:border-black transition"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  Adresse Email (Connexion) *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="caissier@toptendance.net"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl font-medium focus:bg-white focus:outline-hidden focus:border-black transition"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  💡 Si le caissier utilise son adresse Gmail, il pourra aussi se connecter en 1 clic via Google !
                </p>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  Numéro de Téléphone (Tunisie)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+216 52 000 000"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl font-medium focus:bg-white focus:outline-hidden focus:border-black transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px]">
                    Mot de Passe Initial *
                  </label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-[10px] font-bold text-purple-600 hover:underline"
                  >
                    Générer mot de passe
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Au moins 6 caractères"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl font-medium focus:bg-white focus:outline-hidden focus:border-black transition pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-black"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 border rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-black hover:bg-gray-800 text-white font-bold rounded-xl transition shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      Création...
                    </>
                  ) : (
                    'Confirmer & Créer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmation de Suppression */}
      {cashierToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="text-center">
              <h3 className="font-extrabold text-base text-gray-900">
                Supprimer le caissier ?
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Êtes-vous sûr de vouloir supprimer définitivement le compte de{' '}
                <strong>{cashierToDelete.full_name}</strong> ({cashierToDelete.email}) ?
              </p>
            </div>
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCashierToDelete(null)}
                className="flex-1 py-2.5 border rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteCashier}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow-xs text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Réinitialiser le mot de passe */}
      {cashierToReset && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-blue-600" />
                <h3 className="font-extrabold text-sm text-gray-900">
                  Nouveau mot de passe
                </h3>
              </div>
              <button
                onClick={() => setCashierToReset(null)}
                className="text-gray-400 hover:text-black"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Définir un nouveau mot de passe pour <strong>{cashierToReset.full_name}</strong>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <input
                type="password"
                required
                value={newPasswordForReset}
                onChange={(e) => setNewPasswordForReset(e.target.value)}
                placeholder="Nouveau mot de passe (min 6 caractères)"
                className="w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl font-medium focus:bg-white focus:outline-hidden focus:border-black transition"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCashierToReset(null)}
                  className="px-3.5 py-2 border rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-bold rounded-xl transition disabled:opacity-50"
                >
                  {isResetting ? 'Mise à jour...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

