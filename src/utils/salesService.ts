import { supabase } from '@/utils/supabaseClient';
import { DetailedSaleTransaction, DetailedSaleItem, SalesFilterOptions } from '@/types/sales';

/**
 * Normalizes Supabase sale records into typed DetailedSaleTransaction objects.
 */
export function normalizeSaleRecord(record: any): DetailedSaleTransaction {
  // Cashier name resolution (profiles joined as cashier)
  let cashierName = 'Caissier inconnu';
  if (record.cashier) {
    if (Array.isArray(record.cashier) && record.cashier.length > 0) {
      cashierName = record.cashier[0]?.full_name || cashierName;
    } else if (typeof record.cashier === 'object') {
      cashierName = record.cashier.full_name || cashierName;
    }
  }

  // Normalize sale items
  const items: DetailedSaleItem[] = Array.isArray(record.sale_items)
    ? record.sale_items.map((item: any) => {
        const variant = item.variant;
        let productName = 'Article sans nom';
        if (variant?.product) {
          if (Array.isArray(variant.product) && variant.product.length > 0) {
            productName = variant.product[0]?.name || productName;
          } else if (typeof variant.product === 'object') {
            productName = variant.product.name || productName;
          }
        }

        return {
          id: item.id || '',
          variant_id: item.variant_id,
          productName,
          sku: variant?.sku || undefined,
          barcode: variant?.barcode || undefined,
          size: variant?.size || undefined,
          color: variant?.color || undefined,
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
          subtotal: Number(item.subtotal) || (Number(item.unit_price || 0) * Number(item.quantity || 1)),
        };
      })
    : [];

  return {
    id: record.id,
    created_at: record.created_at,
    cashier_name: cashierName,
    cashier_id: record.cashier_id,
    payment_method: record.payment_method || 'cash',
    total_amount: Number(record.total_amount) || 0,
    discount_amount: Number(record.discount_amount) || 0,
    final_amount: Number(record.final_amount) || 0,
    items,
  };
}

/**
 * Fetches detailed sales transactions with joined sale_items, variants, and product names.
 */
export async function fetchDetailedSales(options: SalesFilterOptions = {}): Promise<DetailedSaleTransaction[]> {
  try {
    let query = supabase
      .from('sales')
      .select(`
        id,
        cashier_id,
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
      .order('created_at', { ascending: false });

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }
    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }
    if (options.cashierId) {
      query = query.eq('cashier_id', options.cashierId);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching detailed sales:', error);
      throw error;
    }

    if (!data) return [];

    let results = data.map(normalizeSaleRecord);

    // Optional client-side search query filtering if provided (ID prefix, barcode, SKU, or product name)
    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.trim().toLowerCase();
      results = results.filter((sale) => {
        const matchesSaleId = sale.id.toLowerCase().includes(q);
        const matchesCashier = sale.cashier_name.toLowerCase().includes(q);
        const matchesItems = sale.items.some((item) =>
          item.productName.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.toLowerCase().includes(q)) ||
          (item.sku && item.sku.toLowerCase().includes(q))
        );
        return matchesSaleId || matchesCashier || matchesItems;
      });
    }

    return results;
  } catch (err) {
    console.error('Failed to load detailed sales transactions:', err);
    throw err;
  }
}

/**
 * Fetches today's sales transactions for the active cashier shift / POS.
 */
export async function fetchTodayDetailedSales(): Promise<DetailedSaleTransaction[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return fetchDetailedSales({
    startDate: todayStart.toISOString(),
  });
}

