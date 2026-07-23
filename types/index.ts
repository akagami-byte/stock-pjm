// =============================================================================
// 📦 BENGKEL LAS STOCK MANAGEMENT - COMPLETE TYPE DEFINITIONS
// =============================================================================
// This file contains ALL TypeScript types for the entire application.
// It covers database tables, enums, API request/response types,
// Zustand store state interfaces, and component prop types.
//
// References:
//   - REQUIREMENT_FINAL.md: Section 7 (Database Schema) + Appendix A-E
//   - ACTION_PLAN_FINAL.md: Business flows & status rules
//   - MASTER-PROMPT-FOR-AI.md: Architecture overview
// =============================================================================

// =============================================================================
// 1. ENUMS & LITERAL UNIONS
// =============================================================================

/**
 * Batch status following the 8-state machine.
 * Transitions:
 *   DRAFT → ACTIVE (scan + confirm)
 *   ACTIVE → AVAILABLE (manual)
 *   AVAILABLE → RESERVED | SOLD_OUT | OBSOLETE
 *   RESERVED → AVAILABLE | PARTIALLY_SOLD | SOLD_OUT
 *   PARTIALLY_SOLD → SOLD_OUT | AVAILABLE
 *   SOLD_OUT → PARTIALLY_SOLD | ARCHIVED
 *   OBSOLETE → ARCHIVED
 *   ARCHIVED → (terminal)
 */
export type BatchStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'AVAILABLE'
  | 'RESERVED'
  | 'PARTIALLY_SOLD'
  | 'SOLD_OUT'
  | 'OBSOLETE'
  | 'ARCHIVED';

/**
 * Product finishing type.
 * C = Chrome, P = Plating, S = Stainless
 */
export type Finishing = 'C' | 'P' | 'S';

/**
 * Barcode scan purpose type.
 * ACTIVATION  – First scan to activate DRAFT → ACTIVE
 * VIEW        – View batch details
 * PICKING     – Picking for order/transaction
 * RETURN      – Return scan
 * STOCK_OPNAME – Stock opname / audit
 */
export type ScanType =
  | 'ACTIVATION'
  | 'VIEW'
  | 'PICKING'
  | 'RETURN'
  | 'STOCK_OPNAME';

/**
 * Sales transaction lifecycle status.
 * RESERVED  – Items reserved, pending pickup
 * COMPLETED – Items picked up, sale finalized
 * CANCELLED – Transaction cancelled before pickup
 * RETURNED  – Items returned after completion
 */
export type TransactionStatus =
  | 'RESERVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RETURNED';

/**
 * Recent activity type for the dashboard feed.
 */
export type ActivityType =
  | 'BATCH_CREATED'
  | 'BATCH_ACTIVATED'
  | 'STATUS_CHANGED'
  | 'TRANSACTION';

/**
 * Sync queue operation types for offline-first.
 */
export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Sync queue item status.
 */
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

// =============================================================================
// 2. DATABASE TABLE INTERFACES (Supabase PostgreSQL)
// =============================================================================
// Column names match the exact Supabase schema.
/**
 * Table: `product_types`
 */

export interface Company {
 /** UUID primary key */
 company_id: string;
 /** Company name (unique) */
 company_name: string;
 /** Address */
 address: string | null;
 /** Phone */
 phone: string | null;
 /** Soft-active flag */
 is_active: boolean;
 /** FK → auth.users.id */
 created_by: string | null;
 /** Record creation timestamp */
 created_at: string;
 /** Last update timestamp */
 updated_at: string;
 /** URL logo/gambar perusahaan di S3 */
  image_url: string | null;
}

/**
 * Master table: Product Types (JENIS PRODUK).
 * e.g. "HGP" = Hollow Gate Pillar
 * Table: `product_types`
 */
export interface ProductType {
  /** UUID primary key */
  type_id: string;
  /** Short type code, max 3 chars (e.g. "HGP") – unique */
  type_code: string;
  /** Full type name (e.g. "Hollow Gate Pillar") */
  type_name: string;
  /** Soft-active flag */
  is_active: boolean;
  /** FK → auth.users.id (Supabase Auth) */
  created_by: string | null;
  /** Record creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** URL logo/gambar jenis produk */
  image_url?: string | null;
}

/**
 * Master table: Products (version-specific detail).
 * e.g. "01" = Hollow Gate Pillar 20cm
 * Table: `products`
 */
export interface Product {
  /** UUID primary key */
  product_id: string;
  /** FK → product_types.type_id */
  type_id: string;
  /** Version string (e.g. "01", "02") */
  version: string;
  /** Full product name (e.g. "Hollow Gate Pillar 20cm") */
  product_name: string;
  /** Optional product description */
  description: string | null;
  /** Base price per unit in IDR */
  base_price: number;
  /** Optional image URL (S3 signed URL) */
  image_url: string | null;
  /** Soft-active flag */
  is_active: boolean;
  /** FK → auth.users.id (Supabase Auth) */
  created_by: string | null;
  /** Record creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * Master table: Product variants (finishing only).
 * Each variant has a unique SKU (e.g. "HGP-01-C").
 * Version has moved to products table.
 * Table: `product_variants`
 */
export interface ProductVariant {
  /** UUID primary key */
  variant_id: string;
  /** FK → products.product_id */
  product_id: string;
  /** Finishing type: C (Chrome), P (Plating), S (Stainless) */
  finishing: Finishing;
  /** Full SKU string (e.g. "HGP-01-C") – unique */
  sku_full: string;
  /** Additional price per finishing (on top of product.base_price) */
  price_modifier: number;
  /** Optional variant description */
  description: string | null;
  /** Soft-active flag */
  is_active: boolean;
  /** FK → auth.users.id */
  created_by: string | null;
  /** Record creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * Stock batch – each batch represents a physical group of product units
 * with a unique barcode label.
 * Table: `stock_batch`
 */
export interface StockBatch {
  /** UUID primary key */
  batch_id: string;
  /** FK → product_variants.variant_id (MUST exist in master) */
  variant_id: string;
  /** Unique batch code (e.g. "AA0001") */
  batch_code: string;
  /** Original quantity when batch was created (≥ 1) */
  initial_qty: number;
  /** Current remaining quantity (≥ 0) */
  current_qty: number;
  /** Current batch status in the state machine */
  status: BatchStatus;
  /** Optional production date */
  production_date: string | null;
  /** Entry/creation timestamp */
  entry_date: string;
  /** FK → auth.users.id */
  created_by: string | null;
  /** Soft-delete timestamp (null = active) */
  deleted_at: string | null;
  /** Auto-purge deadline after soft-delete */
  restore_deadline: string | null;
  /** URL public gambar barcode di S3 IdCloudHost */
  barcode_url: string | null;
}

/**
 * Audit log for every batch status transition.
 * Table: `batch_status_log`
 */
export interface BatchStatusLog {
  /** UUID primary key */
  log_id: string;
  /** FK → stock_batch.batch_id */
  batch_id: string;
  /** Previous status (null for initial creation) */
  old_status: BatchStatus | null;
  /** New status after transition */
  new_status: BatchStatus;
  /** FK → auth.users.id */
  changed_by: string | null;
  /** Timestamp of the change */
  changed_at: string;
  /** Optional note/reason for the transition */
  note: string | null;
}

/**
 * Barcode scan history for audit trail.
 * Table: `batch_scan_history`
 */
export interface BatchScanHistory {
  /** UUID primary key */
  scan_id: string;
  /** FK → stock_batch.batch_id */
  batch_id: string;
  /** FK → auth.users.id */
  scanned_by: string | null;
  /** Purpose of the scan */
  scan_type: ScanType;
  /** When the scan occurred */
  scan_timestamp: string;
  /** Optional scan location */
  location: string | null;
  /** Optional notes */
  notes: string | null;
}

/**
 * Alternative/special pricing per variant + company.
 * Table: `alternative_prices`
 */
export interface AlternativePrice {
  /** UUID primary key */
  alt_price_id: string;
  /** FK → product_variants.variant_id */
  variant_id: string;
  /** Company name (free-text, not FK) */
  company_name: string;
  /** Proposed alternative price per unit */
  proposed_price: number;
  /** Minimum quantity for this price to apply */
  min_quantity: number;
  /** Optional reason for the alternative price */
  reason: string | null;
  /** FK → auth.users.id */
  requested_by: string | null;
  /** When the price was proposed */
  requested_at: string;
  /** Expiry date (null = permanent) */
  valid_until: string | null;
}

/**
 * Sales transaction record. Each row is one batch sold in a transaction.
 * Multiple rows with the same invoice_number form a multi-product transaction.
 * Table: `sales_transaction`
 */
export interface SalesTransaction {
  /** UUID primary key */
  sales_id: string;
  /** FK → stock_batch.batch_id */
  batch_id: string;
  /** Company name (free-text, auto-suggest from history) */
  company_name: string;
  /** Quantity sold from this batch */
  quantity_sold: number;
  /** Price per unit at time of sale */
  price_per_unit: number;
  /** FK → alternative_prices.alt_price_id (nullable) */
  alt_price_id: string | null;
  /** Computed: quantity_sold × price_per_unit (GENERATED ALWAYS) */
  total_amount: number;
  /** Transaction timestamp */
  transaction_date: string;
  /** Unique invoice number (e.g. "INV-001") */
  invoice_number: string | null;
  /** Transaction lifecycle status */
  status: TransactionStatus;
  /** When items were physically picked up */
  taken_date: string | null;
  /** FK → auth.users.id */
  created_by: string | null;
  /** Optional transaction notes */
  notes: string | null;
}

/**
 * User account from Supabase Auth + custom profile data.
 * Note: Supabase Auth manages the actual auth; this represents
 * the profile data we display in the app.
 */
export interface User {
  /** UUID from auth.users.id */
  id: string;
  /** User email */
  email: string;
  /** Display name */
  full_name: string | null;
  /** Profile avatar URL */
  avatar_url: string | null;
  /** Whether user is internal (premium) — gets Supabase sync access */
  is_premium: boolean;
  /** User role: owner (full access) or staff (limited: Label, Scan, Stok) */
  role: 'owner' | 'staff';
}

// =============================================================================
// 3. DATABASE VIEW INTERFACES (Dashboard Views)
// =============================================================================

/**
 * Dashboard summary view aggregation.
 * View: `dashboard_summary`
 */
export interface DashboardSummary {
  /** Total count of all batches (non-deleted) */
  total_batch: number;
  /** Sum of current_qty for AVAILABLE + PARTIALLY_SOLD batches */
  stock_tersedia: number;
  /** Sum of quantity_sold for today's COMPLETED transactions */
  terjual_hari_ini: number;
}

/**
 * Reserved batch list item for dashboard.
 * View: `reserved_batch`
 */
export interface ReservedBatchView {
  /** Batch code (e.g. "HGP-00-C-AA0001") */
  batch_code: string;
  /** Company that reserved */
  company_name: string;
  /** Quantity reserved/ordered */
  qty_dipesan: number;
  /** When the reservation was made */
  transaction_date: string;
  /** Pickup deadline (transaction_date + 3 days) */
  deadline: string;
}

/**
 * Low stock batch item for dashboard alerts.
 * View: `low_stock_batch`
 */
export interface LowStockBatchView {
  batch_id: string;
  batch_code: string;
  variant_id: string;
  current_qty: number;
  initial_qty: number;
  /** Remaining percentage (e.g. 3.50 means 3.5%) */
  percentage: number;
  status: BatchStatus;
}

/**
 * Recent activity feed item for dashboard.
 * View: `recent_activities`
 */
export interface RecentActivity {
  /** Activity type */
  type: ActivityType;
  /** Reference identifier (batch_code or invoice_number) */
  reference: string;
  /** FK → auth.users.id */
  created_by: string | null;
  /** When the activity occurred */
  occurred_at: string;
}

// =============================================================================
// 4. JOINED / ENRICHED TYPES (For UI Display)
// =============================================================================

/**
 * Product with its parent type info.
 */
export interface ProductWithType extends Product {
  /** Joined parent product type */
  type: ProductType;
}

/**
 * Product variant with parent product + type info, used in label creation & listings.
 */
export interface VariantWithProduct extends ProductVariant {
  /** Joined parent product (with type) */
  product: ProductWithType;
}

/**
 * Stock batch enriched with variant, product, and type info for display.
 */
export interface StockBatchWithDetails extends StockBatch {
  /** Joined variant data with product + type info */
  variant: VariantWithProduct;
  /** Joined sales transactions list */
  sales_transaction?: {
    company_name: string;
    status: string;
  }[];
}

/**
 * Sales transaction enriched with batch + product details.
 */
export interface SalesTransactionWithDetails extends SalesTransaction {
  /** Joined batch data with variant and product details */
  batch: StockBatchWithDetails;
  /** Joined alternative price (if used) */
  alternative_price: AlternativePrice | null;
}

/**
 * Grouped transaction by invoice number for multi-product display.
 */
export interface InvoiceGroup {
  /** Shared invoice number */
  invoice_number: string;
  /** Company name (same across all items in group) */
  company_name: string;
  /** Overall transaction status */
  status: TransactionStatus;
  /** Transaction date */
  transaction_date: string;
  /** Individual line items */
  items: SalesTransactionWithDetails[];
  /** Total amount across all items */
  total_amount: number;
  /** Total quantity across all items */
  total_quantity: number;
}

// =============================================================================
// 5. API REQUEST / INPUT TYPES
// =============================================================================

export interface CreateProductTypeInput {
  /** Short type code, max 3 chars (e.g. "HGP") */
  type_code: string;
  /** Full type name (e.g. "Hollow Gate Pillar") */
  type_name: string;
  /** Optional image URL */
  image_url?: string;
}

export interface UpdateProductTypeInput {
  type_name?: string;
  image_url?: string;
  is_active?: boolean;
}

/** Input for creating a new product in Master Data. */
export interface CreateProductInput {
  /** FK → product_types.type_id (required) */
  type_id: string;
  /** Version string, e.g. "01" (required) */
  version: string;
  /** Product display name (required) */
  product_name: string;
  /** Base price per unit in IDR (required, > 0) */
  base_price: number;
  /** Optional description */
  description?: string;
  /** Optional image URL (S3 signed URL) */
  image_url?: string;
}

/** Input for updating an existing product. */
export interface UpdateProductInput {
  product_name?: string;
  description?: string;
  image_url?: string;
  is_active?: boolean;
}

/** Input for creating a new product variant. */
export interface CreateVariantInput {
  /** FK → products.product_id (required) */
  product_id: string;
  /** Finishing type (required) */
  finishing: Finishing;
  /** Additional price per finishing (default 0) */
  price_modifier?: number;
  /** Optional description */
  description?: string;
}

/** Input for updating an existing variant. */
export interface UpdateVariantInput {
  finishing?: Finishing;
  price_modifier?: number;
  description?: string;
  is_active?: boolean;
}

/**
 * Input for the batch generation RPC.
 * Calls `generate_batch(variant_id, initial_qty, total_batches, created_by)`.
 */
export interface CreateBatchInput {
  /** FK → product_variants.variant_id (MUST exist & be active) */
  variant_id: string;
  /** Quantity of units per batch (≥ 1) */
  initial_qty: number;
  /** Number of batches to create (≥ 1) */
  total_batches: number;
  /** Optional production date */
  production_date?: string;
}

/** Response from the batch generation RPC. */
export interface CreateBatchResponse {
  success: boolean;
  message: string;
  total_batches: number;
  /** List of created batch codes */
  batch_codes?: string[];
}

/**
 * Input for changing a batch's status.
 * Follows the state machine rules.
 */
export interface UpdateBatchStatusInput {
  /** Target new status */
  new_status: BatchStatus;
  /** Company name (REQUIRED when AVAILABLE → RESERVED) */
  company_name?: string;
  /** Quantity for reservation */
  reserved_qty?: number;
  /** Optional note/reason for the transition */
  note?: string;
}

/** Input for recording a barcode scan event. */
export interface CreateScanInput {
  /** FK → stock_batch.batch_id */
  batch_id: string;
  /** Purpose of this scan */
  scan_type: ScanType;
  /** Optional location info */
  location?: string;
  /** Optional notes */
  notes?: string;
}

/**
 * A single line item in a multi-product transaction creation form.
 */
export interface TransactionLineItem {
  /** FK → stock_batch.batch_id */
  batch_id: string;
  /** Quantity to sell from this batch (≥ 1, ≤ batch.current_qty) */
  quantity_sold: number;
  /** Price per unit (from master or alternative) */
  price_per_unit: number;
  /** FK → alternative_prices.alt_price_id (optional) */
  alt_price_id?: string;
}

/**
 * Input for creating a new multi-product transaction.
 */
export interface CreateTransactionInput {
  /** Company name (REQUIRED) – auto-suggest from history or create new */
  company_name: string;
  /** One or more line items (each referencing a batch) */
  items: TransactionLineItem[];
  /** Optional transaction-level notes */
  notes?: string;
}

/** Input for proposing an alternative price. */
export interface CreateAlternativePriceInput {
  /** FK → product_variants.variant_id */
  variant_id: string;
  /** Company name */
  company_name: string;
  /** Proposed price per unit */
  proposed_price: number;
  /** Minimum quantity for this price */
  min_quantity: number;
  /** Optional reason */
  reason?: string;
  /** Expiry date (null = permanent) */
  valid_until?: string;
}

// =============================================================================
// 6. API RESPONSE TYPES
// =============================================================================

/** Generic paginated API response wrapper. */
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  /** Whether there are more items beyond this page */
  has_more: boolean;
}

/** Generic API error shape. */
export interface ApiError {
  message: string;
  code?: string;
  details?: string;
}

/** Standard API result wrapper (either success or error). */
export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

// =============================================================================
// 7. ZUSTAND STORE STATE INTERFACES
// =============================================================================

/** Authentication store state and actions. */
export interface AuthStoreState {
  /** Currently authenticated user (null if logged out) */
  user: User | null;
  /** Supabase session token */
  session: AuthSession | null;
  /** Whether the auth state is being resolved */
  loading: boolean;
  /** Last auth error message */
  error: string | null;
  /** Whether user is currently authenticated */
  isAuthenticated: boolean;
}

export interface AuthStoreActions {
  /** Sign in with email + password */
  login: (email: string, password: string) => Promise<void>;
  /** Register with email + password */
  signUp: (email: string, password: string) => Promise<void>;
  /** Sign out and clear session */
  logout: () => Promise<void>;
  /** Restore session from storage on app launch */
  restoreSession: () => Promise<void>;
  /** Clear error state */
  clearError: () => void;
}

export type AuthStore = AuthStoreState & AuthStoreActions;

/** Simplified auth session shape (from Supabase). */
export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: User;
}

/** Product (Master Data) store state and actions. */
export interface ProductStoreState {
  /** Cached list of product types */
  productTypes: ProductType[];
  /** Cached list of products */
  products: Product[];
  /** Cached list of variants (all) */
  variants: ProductVariant[];
  /** Currently selected product for detail view */
  selectedProduct: Product | null;
  /** Whether data is being fetched */
  loading: boolean;
  /** Last error message */
  error: string | null;
}

export interface ProductStoreActions {
  /** Fetch all active product types from Supabase */
  fetchProductTypes: () => Promise<void>;
  /** Fetch all active products from Supabase */
  fetchProducts: () => Promise<void>;
  /** Fetch products for a specific type */
  fetchProductsByType: (typeId: string) => Promise<Product[]>;
  /** Fetch variants for a specific product */
  fetchVariantsByProduct: (productId: string) => Promise<ProductVariant[]>;
  /** Create a new product type */
  createProductType: (input: CreateProductTypeInput) => Promise<ProductType>;
  /** Update an existing product type */
  updateProductType: (typeId: string, input: UpdateProductTypeInput) => Promise<void>;
  /** Create a new product in Master Data */
  createProduct: (input: CreateProductInput) => Promise<Product>;
  /** Update an existing product */
  updateProduct: (productId: string, input: UpdateProductInput) => Promise<void>;
  /** Create a new product variant */
  createVariant: (input: CreateVariantInput) => Promise<ProductVariant>;
  /** Update an existing variant */
  updateVariant: (variantId: string, input: UpdateVariantInput) => Promise<void>;
  /** Set selected product for detail view */
  setSelectedProduct: (product: Product | null) => void;
  /** Clear error state */
  clearError: () => void;
}

export type ProductStore = ProductStoreState & ProductStoreActions;

/** Batch / Label store state and actions. */
export interface BatchStoreState {
  /** Cached list of batches */
  batches: StockBatchWithDetails[];
  /** Total count from the server (for pagination) */
  totalCount: number;
  /** Currently selected batch for detail view */
  selectedBatch: StockBatchWithDetails | null;
  /** Whether data is being fetched */
  loading: boolean;
  /** Last error message */
  error: string | null;
}

export interface BatchStoreActions {
  /** Subscribe to realtime changes on stock_batch table */
  subscribeToRealtime: () => void;
  /** Unsubscribe from realtime changes */
  unsubscribeFromRealtime: () => void;
  /** Fetch all batches from Supabase */
  fetchBatches: (filters?: BatchFilterParams) => Promise<void>;
  /** Create new batch(es) via RPC with Master Data validation */
  createBatch: (input: CreateBatchInput) => Promise<CreateBatchResponse>;
  /** Fetch a single batch by ID with full details */
  fetchBatchById: (batchId: string) => Promise<StockBatchWithDetails>;
  /** Search batch by batch_code (for scanner) */
  findBatchByCode: (batchCode: string) => Promise<StockBatchWithDetails | null>;
  /** Update batch status (state machine enforced) */
  updateBatchStatus: (batchId: string, input: UpdateBatchStatusInput) => Promise<void>;
  /** Soft-delete a batch (move to trash) */
  softDeleteBatch: (batchId: string) => Promise<void>;
  /** Restore a batch from trash */
  restoreBatch: (batchId: string) => Promise<void>;
  /** Set selected batch for detail view */
  setSelectedBatch: (batch: StockBatchWithDetails | null) => void;
  /** Clear error state */
  clearError: () => void;
}

export type BatchStore = BatchStoreState & BatchStoreActions;

/** Stock management store state and actions. */
export interface StockStoreState {
  /** Filtered stock batches for stock list screen */
  stockItems: StockBatchWithDetails[];
  /** Trash items (soft-deleted batches) */
  trashItems: StockBatch[];
  /** Status filter applied to the list */
  statusFilter: BatchStatus | 'ALL';
  /** Whether data is being fetched */
  loading: boolean;
  /** Last error message */
  error: string | null;
}

export interface StockStoreActions {
  /** Fetch stock with optional filters */
  fetchStock: (filters?: BatchFilterParams) => Promise<void>;
  /** Fetch soft-deleted (trashed) batches */
  fetchTrash: () => Promise<void>;
  /** Set status filter */
  setStatusFilter: (status: BatchStatus | 'ALL') => void;
  /** Clear error state */
  clearError: () => void;
}

export type StockStore = StockStoreState & StockStoreActions;

/** Transaction store state and actions. */
export interface TransactionStoreState {
  /** Cached list of transactions */
  transactions: SalesTransactionWithDetails[];
  /** Grouped by invoice for multi-product display */
  invoiceGroups: InvoiceGroup[];
  /** Currently selected transaction for detail view */
  selectedTransaction: InvoiceGroup | null;
  /** Company names from history for auto-suggest */
  companyNames: string[];
  /** Whether data is being fetched */
  loading: boolean;
  /** Last error message */
  error: string | null;
}

export interface TransactionStoreActions {
  /** Fetch all transactions */
  fetchTransactions: (filters?: TransactionFilterParams) => Promise<void>;
  /** Create a new multi-product transaction */
  createTransaction: (input: CreateTransactionInput) => Promise<string>;
  /** Cancel a transaction */
  cancelTransaction: (salesId: string) => Promise<void>;
  /** Return a transaction */
  returnTransaction: (salesId: string) => Promise<void>;
  /** Fetch distinct company names for auto-suggest */
  fetchCompanyNames: (query?: string) => Promise<string[]>;
  /** Set selected transaction */
  setSelectedTransaction: (group: InvoiceGroup | null) => void;
  /** Clear error state */
  clearError: () => void;
}

export type TransactionStore = TransactionStoreState & TransactionStoreActions;

/** Dashboard store state and actions. */
export interface DashboardStoreState {
  /** Summary card data */
  summary: DashboardSummary | null;
  /** Reserved batches list */
  reservedBatches: ReservedBatchView[];
  /** Low stock alert items */
  lowStockBatches: LowStockBatchView[];
  /** Trashed batches for dashboard widget */
  trashBatches: StockBatch[];
  /** Recent activity feed */
  recentActivities: RecentActivity[];
  /** Whether data is being fetched */
  loading: boolean;
  /** Last error message */
  error: string | null;
}

export interface DashboardStoreActions {
  /** Fetch all dashboard data at once */
  fetchDashboardData: () => Promise<void>;
  /** Refresh just the summary */
  refreshSummary: () => Promise<void>;
  /** Clear error state */
  clearError: () => void;
}

export type DashboardStore = DashboardStoreState & DashboardStoreActions;

/** Offline sync store state and actions. */
export interface SyncStoreState {
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Number of items in the sync queue */
  pendingCount: number;
  /** Whether a sync operation is in progress */
  isSyncing: boolean;
  /** Last successful sync timestamp */
  lastSyncAt: string | null;
  /** Last sync error */
  error: string | null;
}

export interface SyncStoreActions {
  /** Set online/offline status */
  setOnline: (isOnline: boolean) => void;
  /** Add an item to the sync queue */
  addToQueue: (item: SyncQueueItem) => Promise<void>;
  /** Process all pending queue items */
  processQueue: () => Promise<void>;
  /** Pull latest data from server */
  pullData: () => Promise<void>;
  /** Get the current pending count */
  refreshPendingCount: () => Promise<void>;
  /** Clear error state */
  clearError: () => void;
}

export type SyncStore = SyncStoreState & SyncStoreActions;

/** UI store for global UI state. */
export interface UIStoreState {
  /** Whether a global loading overlay is visible */
  globalLoading: boolean;
  /** Toast notification queue */
  toastMessage: ToastMessage | null;
}

export interface UIStoreActions {
  /** Show/hide global loading overlay */
  setGlobalLoading: (loading: boolean) => void;
  /** Show a toast notification */
  showToast: (toast: ToastMessage) => void;
  /** Dismiss the current toast */
  dismissToast: () => void;
}

export type UIStore = UIStoreState & UIStoreActions;

// =============================================================================
// 8. OFFLINE / SQLITE TYPES
// =============================================================================

/** SQLite sync queue item – stored locally, pushed to server when online. */
export interface SyncQueueItem {
  /** Auto-increment ID (local SQLite) */
  queue_id?: number;
  /** Target table name (e.g. "stock_batch") */
  table_name: string;
  /** Record UUID on the server */
  record_id: string;
  /** Type of mutation */
  operation: SyncOperation;
  /** JSON-serialized payload */
  payload: string;
  /** When the item was queued */
  created_at: string;
  /** When the item was synced (null = pending) */
  synced_at: string | null;
  /** Number of failed sync attempts */
  retry_count: number;
}

/** Sync metadata – tracks last sync timestamp per table. */
export interface SyncMetadata {
  /** Table name */
  table_name: string;
  /** Last successful sync ISO timestamp */
  last_sync_at: string | null;
}

// =============================================================================
// 9. FILTER & QUERY PARAMETER TYPES
// =============================================================================

/** Filter parameters for batch/stock listing queries. */
export interface BatchFilterParams {
  /** Filter by batch status */
  status?: BatchStatus | BatchStatus[];
  /** Filter by variant */
  variant_id?: string;
  /** Filter by product */
  product_id?: string;
  /** Search by batch_code (partial match) */
  search?: string;
  /** Only show trashed items */
  trashed?: boolean;
  /** Sort field */
  sortBy?: 'entry_date' | 'current_qty' | 'batch_code' | 'status';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Pagination offset */
  offset?: number;
  /** Items per page */
  limit?: number;
}

/** Filter parameters for transaction listing queries. */
export interface TransactionFilterParams {
  /** Filter by transaction status */
  status?: TransactionStatus;
  /** Filter by company name (partial match) */
  company_name?: string;
  /** Filter by invoice number */
  invoice_number?: string;
  /** Filter by batch code */
  batch_code?: string;
  /** Start date filter */
  date_from?: string;
  /** End date filter */
  date_to?: string;
  /** Sort field */
  sortBy?: 'transaction_date' | 'total_amount' | 'company_name';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Pagination offset */
  offset?: number;
  /** Items per page */
  limit?: number;
}

/** Filter parameters for sales report. */
export interface ReportFilterParams {
  /** Start date of period */
  date_from: string;
  /** End date of period */
  date_to: string;
  /** Group results by */
  group_by: 'day' | 'week' | 'month';
  /** Filter by product */
  product_id?: string;
  /** Filter by company */
  company_name?: string;
  /** Filter by transaction status */
  status?: TransactionStatus;
}

// =============================================================================
// 10. REPORT & ANALYTICS TYPES
// =============================================================================

/** Sales trend data point for line chart. */
export interface SalesTrendPoint {
  /** Period label (e.g. "Jan", "Feb", "2026-01-15") */
  label: string;
  /** Total quantity sold in this period */
  quantity: number;
  /** Total revenue in this period */
  revenue: number;
}

/** Top product entry for bar chart. */
export interface TopProductEntry {
  /** Product code (e.g. "HGP-01-C") */
  product_code: string;
  /** Product name */
  product_name: string;
  /** Total quantity sold */
  total_quantity: number;
  /** Total revenue */
  total_revenue: number;
}

/** Top company entry for bar chart. */
export interface TopCompanyEntry {
  /** Company name */
  company_name: string;
  /** Total quantity purchased */
  total_quantity: number;
  /** Total revenue from this company */
  total_revenue: number;
  /** Number of transactions */
  transaction_count: number;
}

/** Complete sales report response. */
export interface SalesReport {
  /** Trend data points for line chart */
  trend: SalesTrendPoint[];
  /** Top selling products */
  top_products: TopProductEntry[];
  /** Top purchasing companies */
  top_companies: TopCompanyEntry[];
  /** Summary totals */
  summary: {
    total_transactions: number;
    total_quantity: number;
    total_revenue: number;
    /** Best selling product code */
    best_product: string | null;
    /** Biggest customer company */
    best_company: string | null;
  };
}

/** Company detail with purchase statistics. */
export interface CompanyDetail {
  /** Company name */
  company_name: string;
  /** Total transactions made */
  total_transactions: number;
  /** Total quantity purchased */
  total_quantity: number;
  /** Total revenue */
  total_revenue: number;
  /** Average revenue per transaction */
  avg_per_transaction: number;
  /** First purchase date */
  first_purchase: string | null;
  /** Latest purchase date */
  last_purchase: string | null;
  /** Transaction history */
  transactions: SalesTransactionWithDetails[];
}

/** Company purchase statistics for stats modal. */
export interface CompanyStatistics {
  /** Most purchased product */
  favorite_product: { product_code: string; product_name: string; quantity: number } | null;
  /** Month with most transactions */
  busiest_month: { month: string; transaction_count: number } | null;
  /** Average units per transaction */
  avg_quantity_per_transaction: number;
  /** Average price per unit */
  avg_price_per_unit: number;
  /** Monthly purchase trend */
  monthly_trend: { month: string; quantity: number; revenue: number }[];
  /** Products purchased (breakdown) */
  product_breakdown: { product_code: string; quantity: number; percentage: number }[];
}

// =============================================================================
// 11. COMPONENT PROP TYPES
// =============================================================================

/** Standard button component props. */
export interface ButtonProps {
  /** Button label text */
  title: string;
  /** Press handler */
  onPress: () => void;
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether to show a loading spinner */
  loading?: boolean;
  /** Optional icon component to render before title */
  leftIcon?: React.ReactNode;
  /** Optional icon component to render after title */
  rightIcon?: React.ReactNode;
  /** Full width mode */
  fullWidth?: boolean;
}

/** Text input component props. */
export interface InputProps {
  /** Input label */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Current value */
  value: string;
  /** Change handler */
  onChangeText: (text: string) => void;
  /** Validation error message */
  error?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Input type hint */
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  /** Whether to mask input (password) */
  secureTextEntry?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Multi-line mode */
  multiline?: boolean;
  /** Number of lines (for multiline) */
  numberOfLines?: number;
  /** Maximum character count */
  maxLength?: number;
}

/** Card component props. */
export interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Press handler (makes card tappable) */
  onPress?: () => void;
  /** Optional title */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Custom padding */
  padding?: number;
}

/** Badge component props for status display. */
export interface BadgeProps {
  /** Status value to display */
  status: BatchStatus | TransactionStatus;
  /** Size variant */
  size?: 'sm' | 'md';
}

/** Searchable dropdown component props. */
export interface SearchableDropdownProps<T> {
  /** Label above the dropdown */
  label?: string;
  /** Placeholder when nothing is selected */
  placeholder?: string;
  /** List of items to select from */
  items: T[];
  /** Currently selected item */
  selectedItem: T | null;
  /** Selection handler */
  onSelect: (item: T) => void;
  /** How to extract display text from an item */
  getLabel: (item: T) => string;
  /** How to extract a unique key from an item */
  getKey: (item: T) => string;
  /** Validation error message */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
}

/** Image upload component props. */
export interface ImageUploadProps {
  /** Current image URI (local or remote) */
  imageUri: string | null;
  /** Handler called after successful pick/capture */
  onImageSelected: (uri: string) => void;
  /** Handler to clear the image */
  onImageRemoved: () => void;
  /** Maximum file size in bytes (default: 5MB) */
  maxSizeBytes?: number;
  /** Allowed mime types */
  allowedTypes?: string[];
  /** Whether the upload is disabled */
  disabled?: boolean;
}

/** Quantity input with +/- buttons component props. */
export interface QuantityInputProps {
  /** Current value */
  value: number;
  /** Change handler */
  onChange: (value: number) => void;
  /** Minimum allowed value (default: 1) */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Label text */
  label?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/** Batch/stock card component props (for list items). */
export interface BatchCardProps {
  /** The batch data to display */
  batch: StockBatchWithDetails;
  /** Press handler to navigate to detail */
  onPress: (batch: StockBatchWithDetails) => void;
  /** Whether to show a compact layout */
  compact?: boolean;
}

/** Transaction card component props. */
export interface TransactionCardProps {
  /** The invoice group to display */
  invoiceGroup: InvoiceGroup;
  /** Press handler to navigate to detail */
  onPress: (group: InvoiceGroup) => void;
}

/** Scan result display component props. */
export interface ScanResultProps {
  /** The found batch (null if not found) */
  batch: StockBatchWithDetails | null;
  /** Whether the batch lookup is loading */
  loading: boolean;
  /** Error message if lookup failed */
  error: string | null;
  /** Handler for the activate button (DRAFT batches only) */
  onActivate: (batchId: string) => void;
  /** Handler for navigating to batch detail */
  onViewDetail: (batchId: string) => void;
  /** Handler to reprint label */
  onReprint: (batchId: string) => void;
}

/** Label preview component props. */
export interface LabelPreviewProps {
  /** Batch codes to preview */
  batchCodes: string[];
  /** Product info for the label */
  product: Product;
  /** Variant info for the label */
  variant: ProductVariant;
  /** Quantity per batch */
  quantityPerBatch: number;
}

/** Status transition modal props. */
export interface StatusChangeModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Handler to close the modal */
  onClose: () => void;
  /** The batch being updated */
  batch: StockBatchWithDetails;
  /** Handler for confirming the status change */
  onConfirm: (input: UpdateBatchStatusInput) => Promise<void>;
  /** Allowed target statuses (computed from state machine) */
  allowedStatuses: BatchStatus[];
}

/** Alternative price modal props. */
export interface AlternativePriceModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Handler to close the modal */
  onClose: () => void;
  /** Current master price */
  masterPrice: number;
  /** Variant for which the price is being set */
  variant: ProductVariant;
  /** Company name context */
  companyName: string;
  /** Handler for saving the alternative price */
  onSave: (input: CreateAlternativePriceInput) => Promise<void>;
}

// =============================================================================
// 12. TOAST / NOTIFICATION TYPES
// =============================================================================

/** Toast notification message. */
export interface ToastMessage {
  /** Unique ID for the toast */
  id?: string;
  /** Toast type / severity */
  type: 'success' | 'error' | 'warning' | 'info';
  /** Title text */
  title: string;
  /** Optional description */
  description?: string;
  /** Duration in ms (default: 3000) */
  duration?: number;
}

// =============================================================================
// 13. NAVIGATION PARAMETER TYPES
// =============================================================================

/**
 * Route parameters for dynamic route segments.
 * Used with Expo Router's useLocalSearchParams().
 */
export interface LabelDetailParams {
  /** batch_id UUID */
  id: string;
}

export interface StockDetailParams {
  /** batch_id UUID */
  id: string;
}

export interface TransactionDetailParams {
  /** sales_id UUID or invoice_number */
  id: string;
}

export interface MasterDetailParams {
  /** product_id UUID */
  id: string;
}

export interface ScanResultParams {
  /** Scanned batch_code */
  code: string;
}

// =============================================================================
// 14. UTILITY / HELPER TYPES
// =============================================================================

/**
 * Status transition map – defines which statuses can be reached from each status.
 */
export type StatusTransitionMap = Record<BatchStatus, BatchStatus[]>;

/**
 * Status color configuration for UI display.
 */
export interface StatusColorConfig {
  /** Background color (hex) */
  background: string;
  /** Text/foreground color (hex) */
  text: string;
  /** Emoji icon */
  icon: string;
  /** Human-readable label */
  label: string;
}

/** Map of all status color configurations. */
export type StatusColorMap = Record<BatchStatus, StatusColorConfig>;

/**
 * Finishing display label configuration.
 */
export interface FinishingConfig {
  /** Short code */
  code: Finishing;
  /** Full label */
  label: string;
  /** Description */
  description: string;
}

/** PDF label generation options. */
export interface LabelPdfOptions {
  /** Paper size preset */
  paperSize: 'A4' | 'A5' | 'THERMAL_80MM';
  /** Number of columns per page */
  columns: number;
  /** Number of rows per page */
  rows: number;
  /** Whether to include product name on label */
  showProductName: boolean;
  /** Whether to include price on label */
  showPrice: boolean;
  /** Whether to include QR code in addition to barcode */
  includeQr: boolean;
}

/** Invoice PDF generation options. */
export interface InvoicePdfOptions {
  /** Include company header */
  showCompanyHeader: boolean;
  /** Include notes */
  showNotes: boolean;
}

// =============================================================================
// 15. SUPABASE DATABASE TYPE WRAPPER
// =============================================================================
// Used for typed Supabase client queries: supabase.from<Database>('table')

export interface Database {
  public: {
    Tables: {
      product_types: {
        Row: ProductType;
        Insert: Omit<ProductType, 'type_id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProductType, 'type_id'>>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'product_id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Product, 'product_id'>>;
      };
      product_variants: {
        Row: ProductVariant;
        Insert: Omit<ProductVariant, 'variant_id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProductVariant, 'variant_id'>>;
      };
      stock_batch: {
        Row: StockBatch;
        Insert: Omit<StockBatch, 'batch_id' | 'entry_date'>;
        Update: Partial<Omit<StockBatch, 'batch_id'>>;
      };
      batch_status_log: {
        Row: BatchStatusLog;
        Insert: Omit<BatchStatusLog, 'log_id' | 'changed_at'>;
        Update: Partial<Omit<BatchStatusLog, 'log_id'>>;
      };
      batch_scan_history: {
        Row: BatchScanHistory;
        Insert: Omit<BatchScanHistory, 'scan_id' | 'scan_timestamp'>;
        Update: Partial<Omit<BatchScanHistory, 'scan_id'>>;
      };
      alternative_prices: {
        Row: AlternativePrice;
        Insert: Omit<AlternativePrice, 'alt_price_id' | 'requested_at'>;
        Update: Partial<Omit<AlternativePrice, 'alt_price_id'>>;
      };
      sales_transaction: {
        Row: SalesTransaction;
        Insert: Omit<SalesTransaction, 'sales_id' | 'total_amount' | 'transaction_date'>;
        Update: Partial<Omit<SalesTransaction, 'sales_id' | 'total_amount'>>;
      };
    };
    Views: {
      dashboard_summary: { Row: DashboardSummary };
      reserved_batch: { Row: ReservedBatchView };
      low_stock_batch: { Row: LowStockBatchView };
      recent_activities: { Row: RecentActivity };
    };
    Functions: {
      generate_batch: {
        Args: {
          p_variant_id: string;
          p_initial_qty: number;
          p_total_batches: number;
          p_created_by: string;
        };
        Returns: CreateBatchResponse;
      };
      restore_batch: {
        Args: { p_batch_id: string };
        Returns: { success: boolean; message: string };
      };
    };
    Enums: {
      batch_status: BatchStatus;
      finishing: Finishing;
      scan_type: ScanType;
      transaction_status: TransactionStatus;
    };
  };
}
