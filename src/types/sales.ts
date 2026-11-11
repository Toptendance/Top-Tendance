export interface DetailedSaleItem {
  id: string;
  variant_id?: string;
  productName: string;
  sku?: string;
  barcode?: string;
  size?: string;
  color?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface DetailedSaleTransaction {
  id: string;
  created_at: string;
  cashier_name: string;
  cashier_id?: string;
  payment_method: string;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  items: DetailedSaleItem[];
}

export interface DetailedReturnTransaction {
  id: string;
  created_at: string;
  original_sale_id: string;
  cashier_name: string;
  cashier_id?: string;
  return_type: 'refund' | 'exchange';
  refund_payment_method: string;
  total_refunded_amount: number;
  reason?: string;
  items: Array<{
    id: string;
    variant_id?: string;
    productName: string;
    sku?: string;
    barcode?: string;
    size?: string;
    color?: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
}

export interface SalesFilterOptions {
  startDate?: string;
  endDate?: string;
  cashierId?: string;
  searchQuery?: string;
  limit?: number;
}

