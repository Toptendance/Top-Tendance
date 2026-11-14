'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  RotateCcw, 
  Receipt, 
  CheckCircle, 
  AlertCircle, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Barcode, 
  Calendar, 
  CreditCard, 
  Banknote, 
  Gift, 
  ArrowRight,
  Camera
} from 'lucide-react';
import MobileScannerModal from '@/components/pos/MobileScannerModal';
import { supabase } from '@/utils/supabaseClient';
import { formatPrice } from '@/utils/currency';
import { playBeep } from '@/utils/posAudio';

interface ReturnExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyExchangeCredit?: (creditAmount: number, details: any) => void;
  onReturnCompleted?: (returnedItems: Array<{ variant_id: string; quantity: number }>) => void;
  initialSaleId?: string | null;
}

export default function ReturnExchangeModal({
  isOpen,
  onClose,
  onApplyExchangeCredit,
  onReturnCompleted,
  initialSaleId,
}: ReturnExchangeModalProps) {
  const [receiptQuery, setReceiptQuery] = useState(initialSaleId || '');
  const [isLoadingSale, setIsLoadingSale] = useState(false);
  const [saleData, setSaleData] = useState<any | null>(null);
  const [multipleSales, setMultipleSales] = useState<any[]>([]);
  const [matchedVariantInfo, setMatchedVariantInfo] = useState<{ name: string; sku: string; barcode?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected items to return: map of sale_item_id -> quantity to return
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  // Already-returned quantities per sale_item_id (from previous returns on this sale)
  const [alreadyReturnedQtys, setAlreadyReturnedQtys] = useState<Record<string, number>>({});
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [returnType, setReturnType] = useState<'refund' | 'exchange'>('refund');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'card' | 'store_credit'>('cash');
  const [reason, setReason] = useState('Changement de taille / convenance');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  useEffect(() => {
    if (initialSaleId && isOpen) {
      setReceiptQuery(initialSaleId);
      // Auto trigger lookup for initial sale
      (async () => {
        setIsLoadingSale(true);
        setErrorMsg(null);
        try {
          const fullSale = await fetchSaleById(initialSaleId);
          setSaleData(fullSale);
        } catch (err: any) {
          setErrorMsg(err.message || 'Erreur lors du chargement de la vente');
        } finally {
          setIsLoadingSale(false);
        }
      })();
    }
  }, [initialSaleId, isOpen]);

  if (!isOpen) return null;

  // Helper: fetch a single sale with full relations by ID
  const fetchSaleById = async (saleId: string) => {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        customer_phone,
        total_amount,
        discount_amount,
        final_amount,
        payment_method,
        created_at,
        cashier:profiles (full_name),
        sale_items (
          id,
          variant_id,
          quantity,
          unit_price,
          subtotal,
          variant:variants (
            sku,
            barcode,
            size,
            color,
            product:products (name)
          )
        )
      `)
      .eq('id', saleId)
      .maybeSingle();

    if (error || !data) {
      throw new Error(`Impossible de charger les détails du ticket ${saleId.slice(0, 8)}`);
    }

    // Fetch already-returned quantities for this sale's items
    const saleItemIds = (data.sale_items || []).map((si: any) => si.id);
    if (saleItemIds.length > 0) {
      const { data: returnedRows } = await supabase
        .from('return_items')
        .select('sale_item_id, quantity')
        .in('sale_item_id', saleItemIds);

      const qtysMap: Record<string, number> = {};
      (returnedRows || []).forEach((r: any) => {
        qtysMap[r.sale_item_id] = (qtysMap[r.sale_item_id] || 0) + r.quantity;
      });
      setAlreadyReturnedQtys(qtysMap);
    } else {
      setAlreadyReturnedQtys({});
    }

    return data;
  };

  // Search original sale - Universal Search (UUID, Prefix, Barcode, or SKU)
  const handleSearchSale = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = (customQuery !== undefined ? customQuery : receiptQuery).trim();
    if (!query) return;

    setIsLoadingSale(true);
    setErrorMsg(null);
    setSaleData(null);
    setMultipleSales([]);
    setMatchedVariantInfo(null);
    setReturnQtys({});
    setAlreadyReturnedQtys({});
    setSuccessResult(null);

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);

      // Path 1: Direct UUID lookup
      if (isUuid) {
        const fullSale = await fetchSaleById(query);
        setSaleData(fullSale);
        playBeep('success');
        return;
      }

      // Path 2: Check if query matches a product Barcode or SKU
      let variantQuery = supabase
        .from('variants')
        .select(`
          id,
          sku,
          barcode,
          size,
          color,
          product:products (name)
        `);

      // Support exact, partial, or zero-padded variation of barcode/sku
      // E.g., user entering 61910000018 for barcode 6191000000018
      const digitMatch = query.match(/^(\d{4,6})0*(\d+)$/);
      let filter = `barcode.eq.${query},sku.eq.${query},barcode.ilike.%${query}%,sku.ilike.%${query}%`;
      
      if (digitMatch) {
        const prefix = digitMatch[1];
        const suffix = digitMatch[2];
        filter += `,barcode.ilike.${prefix}%${suffix}`;
      }

      const { data: variants, error: vErr } = await variantQuery
        .or(filter)
        .limit(5);

      if (!vErr && variants && variants.length > 0) {
        const matchedVariantIds = variants.map((v) => v.id);
        const topVariant = variants[0];
        const prodName = Array.isArray(topVariant.product)
          ? topVariant.product[0]?.name
          : (topVariant.product as any)?.name || topVariant.sku;

        setMatchedVariantInfo({
          name: prodName,
          sku: topVariant.sku,
          barcode: topVariant.barcode || undefined,
        });

        // Find recent sales containing any of these matched variants
        const { data: saleItems, error: siErr } = await supabase
          .from('sale_items')
          .select(`
            id,
            sale_id,
            variant_id,
            quantity,
            unit_price,
            sale:sales (
              id,
              total_amount,
              discount_amount,
              final_amount,
              payment_method,
              created_at,
              cashier:profiles (full_name)
            )
          `)
          .in('variant_id', matchedVariantIds)
          .order('sale_id', { ascending: false })
          .limit(100);

        if (!siErr && saleItems && saleItems.length > 0) {
          // For each sale_item, fetch already-returned quantity from return_items
          const saleItemIds = saleItems.map((si) => si.id);
          const { data: returnedRows } = await supabase
            .from('return_items')
            .select('sale_item_id, quantity')
            .in('sale_item_id', saleItemIds);

          // Build a map: sale_item_id → total qty already returned
          const returnedQtyMap: Record<string, number> = {};
          (returnedRows || []).forEach((r: any) => {
            returnedQtyMap[r.sale_item_id] = (returnedQtyMap[r.sale_item_id] || 0) + r.quantity;
          });

          // Only keep sale_items where there is still returnable quantity
          const returnableSaleItems = saleItems.filter((si: any) => {
            const alreadyReturned = returnedQtyMap[si.id] || 0;
            return alreadyReturned < si.quantity;
          });

          // Deduplicate sales by sale_id — only from returnable items
          const salesMap = new Map<string, any>();
          returnableSaleItems.forEach((item: any) => {
            if (item.sale && !salesMap.has(item.sale_id)) {
              salesMap.set(item.sale_id, item.sale);
            }
          });
          const matchingSales = Array.from(salesMap.values());

          if (matchingSales.length === 1) {
            // Exactly one returnable sale found: auto-load it
            const fullSale = await fetchSaleById(matchingSales[0].id);
            setSaleData(fullSale);
            playBeep('success');
            return;
          } else if (matchingSales.length > 1) {
            // Multiple returnable sales found: let cashier pick
            setMultipleSales(matchingSales);
            playBeep('success');
            return;
          } else {
            // All sales for this article have already been fully returned
            const prodName = matchedVariantInfo?.name || query;
            setErrorMsg(
              `Article « ${prodName} » déjà retourné intégralement. Aucun retour supplémentaire possible pour cet article.`
            );
            playBeep('error');
            return;
          }
        }
      }

      // Path 3: Search by ticket ID prefix or substring in sales table
      const { data: prefixSales, error: pErr } = await supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          discount_amount,
          final_amount,
          payment_method,
          created_at,
          cashier:profiles (full_name)
        `)
        .ilike('id', `${query}%`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!pErr && prefixSales && prefixSales.length > 0) {
        if (prefixSales.length === 1) {
          const fullSale = await fetchSaleById(prefixSales[0].id);
          setSaleData(fullSale);
          playBeep('success');
          return;
        } else {
          setMultipleSales(prefixSales);
          playBeep('success');
          return;
        }
      }

      // No ticket or article found
      setErrorMsg(`Aucun ticket ou article trouvé pour la référence "${query}". Vérifiez le code-barres ou l'ID ticket.`);
      playBeep('error');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la recherche du ticket');
      playBeep('error');
    } finally {
      setIsLoadingSale(false);
    }
  };

  const handleSelectSaleFromList = async (saleId: string) => {
    setIsLoadingSale(true);
    setErrorMsg(null);
    try {
      const fullSale = await fetchSaleById(saleId);
      setSaleData(fullSale);
      setMultipleSales([]);
      playBeep('success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Impossible de charger ce ticket');
      playBeep('error');
    } finally {
      setIsLoadingSale(false);
    }
  };

  const handleQtyChange = (saleItemId: string, maxQty: number, delta: number) => {
    const current = returnQtys[saleItemId] || 0;
    const next = Math.max(0, Math.min(maxQty, current + delta));
    setReturnQtys((prev) => ({
      ...prev,
      [saleItemId]: next,
    }));
  };

  // Compute total return refund amount
  const itemsToReturnList = saleData?.sale_items
    ?.map((si: any) => {
      const qty = returnQtys[si.id] || 0;
      return {
        sale_item_id: si.id,
        variant_id: si.variant_id,
        unit_price: Number(si.unit_price),
        quantity: qty,
        subtotal: Number(si.unit_price) * qty,
        name: Array.isArray(si.variant?.product)
          ? si.variant?.product[0]?.name
          : si.variant?.product?.name || si.variant?.sku,
        sku: si.variant?.sku,
        size: si.variant?.size,
        color: si.variant?.color,
      };
    })
    .filter((item: any) => item.quantity > 0) || [];

  const totalReturnAmount = itemsToReturnList.reduce(
    (acc: number, item: any) => acc + item.subtotal,
    0
  );

  // Submit return or exchange
  const handleProcessReturn = async () => {
    if (itemsToReturnList.length === 0) {
      setErrorMsg('Veuillez sélectionner au moins un article à retourner');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payloadItems = itemsToReturnList.map((i: any) => ({
        sale_item_id: i.sale_item_id,
        variant_id: i.variant_id,
        quantity: i.quantity,
      }));

      // Guard: an article still tied to an unpaid credit must never trigger a
      // cash/card refund. It has to be returned from the Credit Ledger instead.
      if (returnType === 'refund') {
        const variantIds = Array.from(
          new Set(itemsToReturnList.map((i: any) => i.variant_id))
        );

        const { data: creditItemsData, error: creditItemsErr } = await supabase
          .from('credit_items')
          .select('id, credit_id, variant_id, quantity, returned_quantity')
          .in('variant_id', variantIds);

        if (creditItemsErr) throw creditItemsErr;

        if (creditItemsData && creditItemsData.length > 0) {
          const creditIds = Array.from(
            new Set(creditItemsData.map((ci: any) => ci.credit_id))
          );

          const { data: activeCredits, error: creditsErr } = await supabase
            .from('customer_credits')
            .select('id, customer_name, customer_phone, status, remaining_balance')
            .in('id', creditIds)
            .in('status', ['pending', 'partially_paid'])
            .gt('remaining_balance', 0);

          if (creditsErr) throw creditsErr;

          const activeCreditMap = new Map<string, any>(
            (activeCredits || []).map((c: any) => [c.id, c])
          );
          const normalizePhone = (value: string | null | undefined) =>
            (value || '').replace(/\D/g, '');
          const salePhone = normalizePhone(saleData.customer_phone);

          const conflictingItem = creditItemsData.find((ci: any) => {
            const credit = activeCreditMap.get(ci.credit_id);
            if (!credit) return false;

            const remainingQty =
              Number(ci.quantity) - Number(ci.returned_quantity || 0);
            if (remainingQty <= 0) return false;

            // Only block on a confident match: same customer phone + same
            // variant. This avoids blocking unrelated cash-sale returns.
            return salePhone
              ? normalizePhone(credit.customer_phone) === salePhone
              : false;
          });

          if (conflictingItem) {
            const credit = activeCreditMap.get(conflictingItem.credit_id);
            setErrorMsg(
              `Cet article est lié à une vente à crédit non réglée` +
                (credit?.customer_name ? ` (client : ${credit.customer_name})` : '') +
                `. Aucun remboursement en espèces n'est autorisé. ` +
                `Utilisez le Carnet de Crédit > « Retourner cet article ».`
            );
            playBeep('error');
            return;
          }
        }
      }

      const { data, error } = await supabase.rpc('process_return_exchange', {
        p_original_sale_id: saleData.id,
        p_returned_items: payloadItems,
        p_return_type: returnType,
        p_refund_method: refundMethod,
        p_reason: reason,
      });

      if (error) {
        throw new Error(error.message);
      }

      playBeep('success');
      setSuccessResult(data || { total_refunded_amount: totalReturnAmount });

      // Notify parent to refresh cache stock for returned variants
      if (onReturnCompleted) {
        onReturnCompleted(
          itemsToReturnList.map((i: any) => ({
            variant_id: i.variant_id,
            quantity: i.quantity,
          }))
        );
      }

      // If exchange, pass credit amount to cart
      if (returnType === 'exchange' && onApplyExchangeCredit) {
        onApplyExchangeCredit(totalReturnAmount, {
          saleId: saleData.id,
          returnedItems: itemsToReturnList,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Échec du traitement du retour');
      playBeep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
              <RotateCcw size={18} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider">
                Gestion Retours & Échanges
              </h2>
              <p className="text-xs text-gray-400">
                Recherche universelle : ID ticket, scan du ticket, ou code-barres article
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto font-sans">
          {/* Step 1: Universal Ticket & Barcode Search */}
          <div>
            <form onSubmit={handleSearchSale} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
                <input
                  type="text"
                  value={receiptQuery}
                  onChange={(e) => setReceiptQuery(e.target.value)}
                  placeholder="ID Ticket (ex: b33477ac) ou Code-barres article (ex: 6191000000018)..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-mono focus:border-black outline-none"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shrink-0"
                title="Scanner avec la caméra du téléphone"
              >
                <Camera size={14} />
                <span className="hidden sm:inline">Caméra</span>
              </button>
              <button
                type="submit"
                disabled={isLoadingSale}
                className="bg-black hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shrink-0"
              >
                {isLoadingSale ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search size={14} /> Rechercher
                  </>
                )}
              </button>
            </form>
            <p className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1">
              <Barcode size={13} className="text-gray-400" />
              Scannez directement avec la douchette ou saisissez la référence.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Multiple Sales Selection List */}
          {multipleSales.length > 0 && !saleData && (
            <div className="space-y-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt size={14} className="text-indigo-600" />
                    Plusieurs tickets trouvés ({multipleSales.length})
                  </h3>
                  {matchedVariantInfo && (
                    <p className="text-[11px] text-indigo-800 mt-0.5">
                      Article : <strong>{matchedVariantInfo.name}</strong> ({matchedVariantInfo.sku})
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-indigo-600 font-medium">Sélectionnez le ticket client :</span>
              </div>

              <div className="space-y-2">
                {multipleSales.map((sale) => (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => handleSelectSaleFromList(sale.id)}
                    className="w-full text-left bg-white hover:bg-indigo-50/80 p-3 rounded-lg border border-indigo-200 hover:border-indigo-400 transition flex items-center justify-between group shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                          #{sale.id.slice(0, 8)}
                        </span>
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <Calendar size={12} className="text-gray-400" />
                          {new Date(sale.created_at).toLocaleString('fr-TN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Caissier : {Array.isArray(sale.cashier) ? sale.cashier[0]?.full_name : sale.cashier?.full_name || 'Caisse'} • Mode : <span className="uppercase">{sale.payment_method}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block uppercase">Total</span>
                        <span className="font-mono font-bold text-sm text-gray-900">
                          {formatPrice(sale.final_amount)}
                        </span>
                      </div>
                      <ArrowRight size={16} className="text-gray-400 group-hover:text-indigo-600 transition group-hover:translate-x-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Success Notification */}
          {successResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle size={18} className="text-emerald-600" />
                <span>
                  {returnType === 'exchange'
                    ? 'Échange validé avec succès !'
                    : 'Retour & Remboursement enregistrés !'}
                </span>
              </div>
              <p className="text-xs text-emerald-800">
                Montant de l'opération :{' '}
                <strong className="font-mono text-sm">
                  {formatPrice(successResult.total_refunded_amount || totalReturnAmount)}
                </strong>
                . Le stock a été automatiquement réintégré en magasin.
              </p>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {/* Sale details & Items selector */}
          {saleData && !successResult && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-wrap justify-between items-center text-xs gap-2">
                <div>
                  <span className="text-gray-500">Ticket: </span>
                  <span className="font-mono font-bold text-gray-900">#{saleData.id.slice(0, 8)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Date: </span>
                  <span className="font-medium text-gray-900">
                    {new Date(saleData.created_at).toLocaleString('fr-TN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Total payé: </span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatPrice(saleData.final_amount)}
                  </span>
                </div>
              </div>

              {/* Legacy discount notice if applicable */}
              {Number(saleData.discount_amount || 0) > 0 &&
                saleData.sale_items?.length > 0 &&
                Math.abs(
                  saleData.sale_items.reduce((acc: number, si: any) => acc + Number(si.unit_price) * si.quantity, 0) -
                    Number(saleData.final_amount)
                ) > 0.05 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-lg flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0 text-amber-600" />
                    <span>
                      Ticket avec remise globale ({formatPrice(saleData.discount_amount)}). Les prix affichés ci-dessous proviennent d'une vente antérieure à la répartition automatique par article.
                    </span>
                  </div>
                )}

              {/* Items List */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
                  Sélectionnez les articles à retourner :
                </label>

                <div className="border border-gray-200 rounded-xl divide-y overflow-hidden max-h-56 overflow-y-auto">
                  {saleData.sale_items?.map((si: any) => {
                    const returnQty = returnQtys[si.id] || 0;
                    const alreadyReturned = alreadyReturnedQtys[si.id] || 0;
                    const maxReturnable = si.quantity - alreadyReturned;
                    const fullyReturned = maxReturnable <= 0;
                    const prodName = Array.isArray(si.variant?.product)
                      ? si.variant?.product[0]?.name
                      : si.variant?.product?.name || si.variant?.sku;

                    return (
                      <div
                        key={si.id}
                        className={`p-3 flex items-center justify-between text-xs transition ${
                          fullyReturned
                            ? 'bg-gray-50 opacity-60'
                            : returnQty > 0
                            ? 'bg-indigo-50/60'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex-1 pr-3">
                          <p className="font-bold text-gray-900 flex items-center gap-1.5">
                            {prodName}
                            {fullyReturned && (
                              <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                                Déjà retourné
                              </span>
                            )}
                          </p>
                          <p className="text-gray-500 font-mono text-[11px]">
                            SKU: {si.variant?.sku}{' '}
                            {si.variant?.barcode && `• CB: ${si.variant.barcode}`}{' '}
                            {si.variant?.size && `• T: ${si.variant.size}`}{' '}
                            {si.variant?.color && `• C: ${si.variant.color}`}
                          </p>
                          <p className="text-gray-700 font-mono mt-0.5">
                            {formatPrice(si.unit_price)} x {si.quantity} achetés
                            {alreadyReturned > 0 && (
                              <span className="text-red-500 ml-1">
                                ({alreadyReturned} déjà retourné{alreadyReturned > 1 ? 's' : ''})
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Qty controls */}
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center border rounded-lg bg-white overflow-hidden ${fullyReturned ? 'border-gray-200 opacity-40 pointer-events-none' : 'border-gray-300'}`}>
                            <button
                              type="button"
                              onClick={() => handleQtyChange(si.id, maxReturnable, -1)}
                              disabled={returnQty === 0 || fullyReturned}
                              className="p-1.5 hover:bg-gray-100 disabled:opacity-40 transition"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="w-8 text-center font-mono font-bold text-gray-900">
                              {returnQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQtyChange(si.id, maxReturnable, 1)}
                              disabled={returnQty >= maxReturnable || fullyReturned}
                              className="p-1.5 hover:bg-gray-100 disabled:opacity-40 transition"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <span className="text-[11px] text-gray-400">/ {maxReturnable} max</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mode Selection: Refund vs Exchange */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnType('refund')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition ${
                    returnType === 'refund'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <RotateCcw size={14} /> Remboursement / Annulation
                  </span>
                  <span className="text-[11px] opacity-80">
                    Rendre les fonds au client (Espèces / Carte)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setReturnType('exchange')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition ${
                    returnType === 'exchange'
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <ShoppingBag size={14} /> Échange Immédiat
                  </span>
                  <span className="text-[11px] opacity-80">
                    Déduire la valeur des articles retournés du panier POS
                  </span>
                </button>
              </div>

              {/* Method if refund */}
              {returnType === 'refund' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Mode de Remboursement :</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRefundMethod('cash')}
                      className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                        refundMethod === 'cash'
                          ? 'border-amber-600 bg-amber-50 text-amber-800 font-bold'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      <Banknote size={14} /> Espèces
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundMethod('card')}
                      className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                        refundMethod === 'card'
                          ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      <CreditCard size={14} /> Carte Bancaire
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundMethod('store_credit')}
                      className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                        refundMethod === 'store_credit'
                          ? 'border-purple-600 bg-purple-50 text-purple-800 font-bold'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      <Gift size={14} /> Bon d'Achat
                    </button>
                  </div>
                </div>
              )}

              {/* Total return calculation */}
              <div className="bg-gray-900 text-white p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wider block">
                    Valeur des Articles Retournés
                  </span>
                  <span className="text-xs text-gray-300">
                    {itemsToReturnList.length} référence(s) sélectionnée(s)
                  </span>
                </div>
                <div className="text-xl font-black font-mono text-emerald-400">
                  {formatPrice(totalReturnAmount)}
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleProcessReturn}
                disabled={itemsToReturnList.length === 0 || isSubmitting}
                className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-md"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : returnType === 'exchange' ? (
                  <>
                    <ShoppingBag size={16} /> Appliquer Avoir Échange ({formatPrice(totalReturnAmount)})
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} /> Valider Retour & Remboursement
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Camera Barcode Scanner Modal */}
      <MobileScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        title="Scanner Article / Ticket"
        onScan={(decoded) => {
          setIsCameraOpen(false);
          setReceiptQuery(decoded);
          handleSearchSale(undefined, decoded);
        }}
      />
    </div>
  );
}
