-- ============================================================
-- Precio Justo OS — Initial Database Schema
-- Run this in Supabase SQL Editor (supabase.com > SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name         TEXT NOT NULL DEFAULT 'Mi Negocio',
  business_type         TEXT NOT NULL DEFAULT 'otro',
  phone                 TEXT,
  mp_user_id            TEXT,
  mp_access_token       TEXT,
  mp_subscription_id    TEXT,
  plan                  TEXT NOT NULL DEFAULT 'free_trial',
  plan_started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  onboarding_complete   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ─── PRODUCTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  sku                   TEXT,
  barcode               TEXT,
  category              TEXT,
  cost_price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  margin_pct            NUMERIC(6,2) GENERATED ALWAYS AS (
                          CASE WHEN sale_price = 0 THEN 0
                          ELSE ROUND(((sale_price - cost_price) / sale_price) * 100, 2)
                          END
                        ) STORED,
  stock_quantity        INTEGER NOT NULL DEFAULT 0,
  stock_alert_threshold INTEGER NOT NULL DEFAULT 5,
  image_url             TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own products" ON products
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_active ON products(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(user_id, category);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── SALES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name      TEXT NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1,
  unit_price        NUMERIC(12,2) NOT NULL,
  cost_price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(12,2) NOT NULL,
  margin_amount     NUMERIC(12,2),
  payment_method    TEXT NOT NULL DEFAULT 'efectivo',
  notes             TEXT,
  sold_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sales" ON sales
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sales_user_date ON sales(user_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(user_id, product_id);

-- ─── REPRICE EVENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reprice_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pct_increase      NUMERIC(6,2) NOT NULL,
  scope             TEXT NOT NULL DEFAULT 'all',
  category_filter   TEXT,
  products_affected INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reprice_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reprice events" ON reprice_events
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reprice_user ON reprice_events(user_id, created_at DESC);

-- ─── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, business_name, business_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'business_name', 'Mi Negocio'),
    COALESCE(NEW.raw_user_meta_data->>'business_type', 'otro')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
