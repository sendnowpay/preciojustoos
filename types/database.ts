export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BusinessType =
  | "kiosco"
  | "restaurante"
  | "petshop"
  | "mercado"
  | "bodega"
  | "otro";

export type Plan = "free_trial" | "basico" | "estandar" | "pro";
export type PaymentMethod = "efectivo" | "mp_qr" | "debito" | "credito" | "otro";

// ─── ROW TYPES ─────────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  business_name: string;
  business_type: BusinessType;
  phone: string | null;
  mp_user_id: string | null;
  mp_access_token: string | null;
  mp_subscription_id: string | null;
  plan: Plan;
  plan_started_at: string;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  cost_price: number;
  sale_price: number;
  margin_pct: number | null;
  stock_quantity: number;
  stock_alert_threshold: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  user_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  total_amount: number;
  margin_amount: number | null;
  payment_method: PaymentMethod;
  notes: string | null;
  sold_at: string;
  created_at: string;
}

export interface RepriceEvent {
  id: string;
  user_id: string;
  pct_increase: number;
  scope: "all" | "category" | "manual";
  category_filter: string | null;
  products_affected: number;
  created_at: string;
}

// ─── DATABASE INTERFACE (for Supabase typed client) ────────────────────────────
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, "id" | "margin_pct" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<Product, "id" | "margin_pct" | "created_at" | "updated_at">>;
      };
      sales: {
        Row: Sale;
        Insert: Omit<Sale, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<Sale, "id" | "created_at">>;
      };
      reprice_events: {
        Row: RepriceEvent;
        Insert: Omit<RepriceEvent, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<RepriceEvent, "id" | "created_at">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
