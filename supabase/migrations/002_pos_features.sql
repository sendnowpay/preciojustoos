-- ============================================================
-- Precio Justo OS — POS Features Migration
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ─── TRANSACTIONS (multi-item cart grouping) ──────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method  TEXT NOT NULL DEFAULT 'efectivo',
  notes           TEXT,
  items_count     INTEGER NOT NULL DEFAULT 0,
  receipt_sent    BOOLEAN NOT NULL DEFAULT FALSE,
  customer_phone  TEXT,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transactions" ON transactions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions(user_id, completed_at DESC);

-- ─── ADD transaction_id TO sales (backward compatible) ────────
ALTER TABLE sales ADD COLUMN IF NOT EXISTS
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sales_transaction
  ON sales(transaction_id);

-- ─── ADD barcode TO products (may already exist) ──────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS
  barcode TEXT;

CREATE INDEX IF NOT EXISTS idx_products_barcode
  ON products(user_id, barcode) WHERE barcode IS NOT NULL;

-- ─── CUSTOMERS (lightweight phone book) ───────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name              TEXT,
  phone             TEXT NOT NULL,
  total_purchases   INTEGER NOT NULL DEFAULT 0,
  total_spent       NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_purchase_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own customers" ON customers
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone
  ON customers(user_id, phone);

-- ─── ATOMIC complete_transaction RPC ──────────────────────────
-- Writes transaction + all sale lines + decrements stock atomically.
-- Returns the new transaction UUID.
CREATE OR REPLACE FUNCTION complete_transaction(
  p_user_id        UUID,
  p_payment_method TEXT,
  p_notes          TEXT,
  p_customer_phone TEXT,
  p_lines          JSONB
  -- Each element: {product_id, product_name, qty, unit_price, cost_price}
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tx_id    UUID;
  v_total    NUMERIC := 0;
  v_count    INTEGER := 0;
  v_line     JSONB;
  v_pid      UUID;
  v_pname    TEXT;
  v_qty      INTEGER;
  v_uprice   NUMERIC;
  v_cprice   NUMERIC;
  v_linetot  NUMERIC;
  v_margin   NUMERIC;
BEGIN
  -- Validate caller owns the products in the line items
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_pid := (v_line->>'product_id')::UUID;
    IF v_pid IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM products
        WHERE id = v_pid AND user_id = p_user_id AND is_active = TRUE
      ) THEN
        RAISE EXCEPTION 'Product % not found or not owned by user', v_pid;
      END IF;
    END IF;
  END LOOP;

  -- Calculate total and count
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_qty    := COALESCE((v_line->>'qty')::INTEGER, 1);
    v_uprice := COALESCE((v_line->>'unit_price')::NUMERIC, 0);
    v_total  := v_total + (v_qty * v_uprice);
    v_count  := v_count + 1;
  END LOOP;

  -- Insert transaction header
  INSERT INTO transactions (
    user_id, total_amount, payment_method,
    notes, items_count, customer_phone
  )
  VALUES (
    p_user_id, v_total, p_payment_method,
    p_notes, v_count, p_customer_phone
  )
  RETURNING id INTO v_tx_id;

  -- Insert each sale line + decrement stock
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_pid    := (v_line->>'product_id')::UUID;
    v_pname  := v_line->>'product_name';
    v_qty    := COALESCE((v_line->>'qty')::INTEGER, 1);
    v_uprice := COALESCE((v_line->>'unit_price')::NUMERIC, 0);
    v_cprice := COALESCE((v_line->>'cost_price')::NUMERIC, 0);
    v_linetot := v_qty * v_uprice;
    v_margin  := v_qty * (v_uprice - v_cprice);

    INSERT INTO sales (
      user_id, transaction_id, product_id, product_name,
      quantity, unit_price, cost_price,
      total_amount, margin_amount,
      payment_method, sold_at
    ) VALUES (
      p_user_id, v_tx_id, v_pid, v_pname,
      v_qty, v_uprice, v_cprice,
      v_linetot, v_margin,
      p_payment_method, NOW()
    );

    -- Decrement stock (don't go below 0)
    IF v_pid IS NOT NULL THEN
      UPDATE products
      SET stock_quantity = GREATEST(0, stock_quantity - v_qty)
      WHERE id = v_pid AND user_id = p_user_id;
    END IF;
  END LOOP;

  -- Upsert customer record
  IF p_customer_phone IS NOT NULL AND p_customer_phone != '' THEN
    INSERT INTO customers (user_id, phone, total_purchases, total_spent, last_purchase_at)
    VALUES (p_user_id, p_customer_phone, 1, v_total, NOW())
    ON CONFLICT (user_id, phone) DO UPDATE
      SET total_purchases = customers.total_purchases + 1,
          total_spent     = customers.total_spent + v_total,
          last_purchase_at = NOW();
  END IF;

  RETURN v_tx_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION complete_transaction TO authenticated;
