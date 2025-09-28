export interface Item {
  item_id: number;
  item_name: string;
  model_number?: string;
  sku?: string | null;
  uom: 'pc' | 'pack';
  brand: number;
  brand_name?: string;
  total_quantity: number;
  active_batches_count: number;
  created_at?: string;
  updated_at?: string;
  tier_pricing?: ItemTierPricing[];
  // Legacy fields for backward compatibility
  item_type?: string;
  category?: string;
  threshold_value?: number;
  availability_status?: string;
  // Deprecated - use total_quantity instead
  quantity?: number;
}

export interface ItemBatch {
  batch_id?: number;
  item: number;
  batch_number: number;
  cost_price: number;
  initial_quantity: number;
  remaining_quantity: number;
  created_at: string;
  transaction?: number;
  item_name?: string;
  item_sku?: string;
  brand_name?: string;
  transaction_reference?: string;
  created_at_formatted?: string;
}

// Pricing tier types
export type PricingTier = 'SRP' | 'RD' | 'PD' | 'DD' | 'CD' | 'RS' | 'SUB-RS';

export interface ItemTierPricing {
  item: number;
  pricing_tier: PricingTier;
  price: number;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerBrandPricing {
  customer: number;
  brand: number;
  pricing_tier: PricingTier;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerSpecialPricing {
  customer: number;
  item: number;
  discount: number;
  created_at?: string;
  updated_at?: string;
  created_by?: number;
}

export interface Brand {
    brand_id: number;
    brand_name: string;
    street_number?: string | null;
    street_name: string;
    city: string;
    barangay?: string | null;
    region?: string | null;
    postal_code?: string | null;
    tin?: string | null;
    landline_number?: string | null;
    contact_person?: string | null;
    mobile_number?: string | null;
    email?: string | null;
    vat_classification: string;
    status: 'Active' | 'Archived';
}

export interface TransactionItem {
    item: number;
    item_name: string;
    model_number: string;
    quantity_change: number;
    requested_quantity?: number;
    final_quantity?: number;
    brand_name?: string;
    unit_price?: number;
    total_price?: number;
    batch_number?: string;
    batch_id?: number;
    batch_remaining_quantity?: number;
    cost_price?: number;
    expiry_date?: string;
}

export interface Transaction {
    transaction_id: number;
    brand?: number;
    brand_name?: string;
    transaction_status: 'Pending' | 'Completed' | 'Cancelled';
    transaction_type: 'INCOMING' | 'OUTGOING' | 'ADJUSTMENT';
    transacted_date: string;
    created_at: string;
    due_date?: string;
    priority_status?: 'Normal' | 'Urgent' | 'Critical';
    reference_number: string;
    customer_name?: string;
    notes?: string;
    items?: TransactionItem[];
    created_by?: string;
    account_id?: number;
  }

  export interface TransactionCreate {
    transaction_type: 'INCOMING' | 'OUTGOING' | 'ADJUSTMENT' | 'Receive Products (from Brands)' | 'Sell Products (to Customers)' | 'Manual correction';
    transaction_status: 'Pending' | 'Completed' | 'Cancelled';
    reference_number?: string;
    brand?: number;
    customer_name?: string;
    priority_status?: 'Normal' | 'Urgent' | 'Critical';
    due_date?: string;
    notes?: string;
    items: {
      item: number;
      quantity_change: number;
      requested_quantity?: number;
      notes?: string;
      // Fields for receive transactions (batch creation)
      batch_number?: string;
      cost_price?: number;
      cost_tier?: string;
      expiry_date?: string;
      tier_discount_percentage?: number;
      tier_discount_amount?: number;
      // Fields for sell transactions (batch selection)
      batch_id?: number;
      price_tier?: string;
      unit_price?: number;
      total_price?: number;
    }[];
    account?: number;
  }

export interface APIResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: Item[];
}

export interface InventoryStats {
    total_items: number;
    low_stock: number;
    out_of_stock: number;
}

export interface InventoryBatch {
    batch_id: number;
    batch_number: string;
    item: number;
    item_name?: string;
    cost_price: number;
    cost_tier: string;
    cost_tier_display?: string;
    initial_quantity: number;
    quantity_available: number;
    quantity_reserved: number;
    expiry_date?: string;
    manufacturing_date?: string;
    purchase_date?: string;
    batch_status: 'Active' | 'Expired' | 'Damaged' | 'Returned' | 'Sold Out';
    batch_status_display?: string;
    tier_discount_percentage: number;
    tier_discount_amount: number;
    effective_cost_price: number;
    is_expired?: boolean;
    days_to_expiry?: number;
    quantity_sold?: number;
    can_sell_at_tier?: string[];
    created_at?: string;
    updated_at?: string;
    notes?: string;
}

export interface InventoryChange {
  item: number;
  item_name: string;
  quantity_change: number;
  requested_quantity?: number;
  request_date?: string;
  request_status?: string;
  notes?: string;
  account?: {
    account_id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  // Timeline/audit trail fields (optional for compatibility)
  transaction_id?: number;
  transaction_type?: string;
  transaction_notes?: string;
  brand_name?: string;
  customer_name?: string;
  reference_number?: string;
  transaction_code?: string;
  transacted_date?: string;
}

// Add these to your Item interface
export interface BeautyProductItem extends Item {
    shade_color?: string;
    size_volume?: string;
    expiry_date?: string;
    batch_number?: string;
    product_line?: string;
    skin_type?: 'Normal' | 'Dry' | 'Oily' | 'Combination' | 'Sensitive' | 'All Types';
    ingredients?: string;
}

export interface Customer {
    customer_id: number;
    id: number; // Add for compatibility
    company_name: string;
    contact_person: string;
    address: string;
    contact_number: string;
    tin_id?: string | null;
    customer_type: 'International' | 'Distributor' | 'Physical Store' | 'Reseller' | 'Direct Customer';
    platform: 'whatsapp' | 'messenger' | 'viber' | 'business_suite';
    status: 'Active' | 'Archived';
    created_at: string;
    // Legacy field for backward compatibility
    pricing_tier?: 'RD' | 'PD' | 'DD' | 'CD' | 'RS' | 'SUB' | 'SRP';
}

export interface CustomerSpecialPrice {
    id: number;
    customer: number;
    customer_name: string;
    item: number;
    item_name: string;
    item_sku: string;
    special_price: number;
    standard_price: number;
    approval_status: 'Pending' | 'Approved' | 'Rejected';
    is_approved: boolean;
    approved_by?: number | null;
    approved_by_username?: string | null;
    approved_at?: string | null;
    requested_by: number;
    requested_by_name: string;
    created_by: number;
    created_by_username: string;
    created_at: string;
}

// Add InventoryItem type alias for compatibility
export type InventoryItem = Item;