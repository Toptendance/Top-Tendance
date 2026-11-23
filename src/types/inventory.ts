export interface VariantItem {
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
}

export interface ProductWithVariants {
  id: string;
  name: string;
  brand: string | null;
  category_id: string | null;
  is_active: boolean;
  category?: { name: string } | null;
  variants: VariantItem[];
}

export interface BatchVariantDraft {
  size: string;
  sku: string;
  barcode: string;
  stock: number;
  selling_price: string;
  cost_price: string;
}

export type VariantDraft = BatchVariantDraft;

export interface SelectedVariantItem {
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

export interface InventoryCategory {
  id: string;
  name: string;
  description?: string | null;
}

export interface ProductToDeleteInfo {
  id: string;
  name: string;
}

export interface VariantToDeleteInfo {
  variantId: string;
  productName: string;
  size: string | null;
  color: string | null;
  sku: string;
  productId: string;
  totalVariantsCount: number;
}

export interface AddVariantProductInfo {
  productId: string;
  productName: string;
  brand: string | null;
  categoryName: string;
  defaultSellingPrice: number;
  defaultCostPrice: number;
  defaultColor: string;
}

export interface AddVariantFormState {
  size: string;
  color: string;
  selling_price: string;
  cost_price: string;
  stock_quantity: string;
  low_stock_threshold: string;
  sku: string;
  barcode: string;
}

export interface EditingVariantData {
  productId: string;
  variantId: string;
  name: string;
  brand: string;
  categoryId: string;
  size: string;
  color: string;
  sellingPrice: string;
  costPrice: string;
  stockQuantity: string;
  lowStockThreshold: string;
  sku: string;
  barcode: string;
}

export interface ProductFormState {
  name: string;
  brand: string;
  category_id: string;
  sku: string;
  barcode: string;
  size: string;
  color: string;
  selling_price: string;
  cost_price: string;
  stock_quantity: string;
  low_stock_threshold: string;
}

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

export interface NewProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: { id: string; name: string }[];
  existingBarcodes: Set<string>;
  existingSkus: Set<string>;
  onSuccess: () => void;
}

export interface AddVariantModalProps {
  targetProduct: AddVariantProductInfo | null;
  onClose: () => void;
  onSuccess: (newVariant?: any) => void;
  existingBarcodes: Set<string>;
  existingSkus?: Set<string>;
  onOpenTagModal?: (variant: any) => void;
}

export interface EditVariantModalProps {
  editingData: EditingVariantData | null;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

export interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: InventoryCategory[];
  productsCountMap?: Record<string, number> | Map<string, number>;
  onCategoriesChanged: () => void | Promise<void>;
  isCashier?: boolean;
}

export interface VariantDeleteModalProps {
  variantToDelete: VariantToDeleteInfo | null;
  onClose: () => void;
  onConfirmDeleteVariant: () => Promise<void>;
  onSwitchToDeleteProduct: (productInfo: ProductToDeleteInfo) => void;
  isDeleting: boolean;
}

export interface ProductDeleteModalProps {
  productToDelete: ProductToDeleteInfo | null;
  onClose: () => void;
  onConfirmDeleteProduct: () => Promise<void>;
  isDeleting: boolean;
}

