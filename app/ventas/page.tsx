"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Product } from "@/types/database";

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

const PAYMENT_METHODS = [
  { value: "efectivo", label: "💵 Efectivo" },
  { value: "mp_qr", label: "📱 Mercado Pago QR" },
  { value: "debito", label: "💳 Débito" },
  { value: "credito", label: "💳 Crédito" },
  { value: "otro", label: "🔄 Otro" },
];

export default function VentasPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadProducts = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name");
    if (data) setProducts(data);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const filtered = search.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.sku || "").toLowerCase().includes(search.toLowerCase()) ||
          (p.barcode || "").includes(search)
      )
    : products;

  function selectProduct(p: Product) {
    setSelected(p);
    setPrice(p.sale_price);
    setQty(1);
    setSearch(p.name);
  }

  async function handleSave() {
    if (!selected) {
      showToast("Seleccioná un producto", "error");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const total = qty * price;
    const marginAmt = qty * (price - selected.cost_price);

    const { error } = await supabase.from("sales").insert({
      user_id: user.id,
      product_id: selected.id,
      product_name: selected.name,
      quantity: qty,
      unit_price: price,
      cost_price: selected.cost_price,
      total_amount: total,
      margin_amount: marginAmt,
      payment_method: paymentMethod as "efectivo",
      notes: notes || null,
      sold_at: new Date().toISOString(),
    });

    if (!error && selected.stock_quantity > 0) {
      // Decrement stock
      await supabase
        .from("products")
        .update({ stock_quantity: selected.stock_quantity - qty })
        .eq("id", selected.id);
    }

    if (error) {
      showToast("Error al guardar la venta", "error");
    } else {
      showToast(`Venta guardada: ${fmt(total)}`, "success");
      // Reset form
      setSelected(null);
      setSearch("");
      setQty(1);
      setPrice(0);
      setNotes("");
      await loadProducts();
    }
    setLoading(false);
  }

  const total = qty * price;
  const margin = selected ? qty * (price - selected.cost_price) : 0;
  const marginPct = price > 0 ? ((price - (selected?.cost_price || 0)) / price) * 100 : 0;

  return (
    <div style={{ paddingBottom: "calc(var(--bottom-nav-h) + 16px)", background: "#F4F5F7", minHeight: "100dvh" }}>
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === "success" ? "✓" : "✕"} {toast.msg}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <button onClick={() => router.back()} style={{ color: "#A0AEC0", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>Registrar Venta</h1>
      </div>

      <div style={{ padding: "16px 16px" }}>
        {/* Product search */}
        <div className="card" style={{ marginBottom: 12 }}>
          <label className="label">Producto</label>
          <input
            type="text"
            className="input-field"
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (selected && e.target.value !== selected.name) setSelected(null);
            }}
          />

          {/* Dropdown results */}
          {search.trim() && !selected && filtered.length > 0 && (
            <div
              style={{
                marginTop: 8,
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {filtered.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProduct(p)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    padding: "10px 12px",
                    background: "#fff",
                    border: "none",
                    borderBottom: "1px solid #F0F4F8",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#1A2A4A" }}>{p.name}</p>
                    <p style={{ fontSize: 12, color: "#718096" }}>
                      Stock: {p.stock_quantity} • {p.category}
                    </p>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#E8680A" }}>
                    {fmt(p.sale_price)}
                  </p>
                </button>
              ))}
            </div>
          )}

          {search.trim() && !selected && filtered.length === 0 && (
            <p style={{ color: "#718096", fontSize: 13, marginTop: 8 }}>
              Sin resultados.{" "}
              <a href="/catalogo/nuevo" style={{ color: "#E8680A" }}>
                Agregar producto →
              </a>
            </p>
          )}
        </div>

        {/* Sale details — shown when product selected */}
        {selected && (
          <>
            <div className="card" style={{ marginBottom: 12 }}>
              {/* Product info */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: "1px solid #F0F4F8",
                }}
              >
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#1A2A4A" }}>
                    {selected.name}
                  </p>
                  <p style={{ fontSize: 12, color: "#718096", marginTop: 2 }}>
                    Costo: {fmt(selected.cost_price)} • Stock: {selected.stock_quantity} u.
                  </p>
                </div>
                <button
                  onClick={() => { setSelected(null); setSearch(""); }}
                  style={{ color: "#A0AEC0", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}
                >
                  ×
                </button>
              </div>

              {/* Qty + Price row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="label">Cantidad</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: "#F0F4F8", border: "none",
                        fontSize: 18, cursor: "pointer", fontWeight: 700, color: "#1A2A4A",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >−</button>
                    <input
                      type="number"
                      className="input-field"
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ textAlign: "center", padding: "10px 8px" }}
                      inputMode="numeric"
                    />
                    <button
                      onClick={() => setQty(qty + 1)}
                      style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: "#E8680A", border: "none",
                        fontSize: 18, cursor: "pointer", fontWeight: 700, color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >+</button>
                  </div>
                </div>
                <div>
                  <label className="label">Precio unitario</label>
                  <input
                    type="number"
                    className="input-field"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    inputMode="decimal"
                  />
                </div>
              </div>
            </div>

            {/* Payment method */}
            <div className="card" style={{ marginBottom: 12 }}>
              <label className="label">Forma de pago</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.value}
                    onClick={() => setPaymentMethod(pm.value)}
                    style={{
                      padding: "10px 8px",
                      borderRadius: 8,
                      border: paymentMethod === pm.value ? "2px solid #E8680A" : "1.5px solid #E2E8F0",
                      background: paymentMethod === pm.value ? "#FFF5EE" : "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      color: paymentMethod === pm.value ? "#E8680A" : "#4A5568",
                    }}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Total summary */}
            <div
              className="card"
              style={{
                marginBottom: 16,
                background: "#1A2A4A",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#A0AEC0", fontSize: 13 }}>Subtotal ({qty} u.)</span>
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>
                  {fmt(total)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#A0AEC0", fontSize: 13 }}>Margen</span>
                <span
                  style={{
                    color: margin >= 0 ? "#68D391" : "#FC8181",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {fmt(margin)} ({marginPct.toFixed(1)}%)
                </span>
              </div>
              <div className="divider" style={{ background: "rgba(255,255,255,0.1)" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#A0AEC0", fontSize: 13, fontWeight: 700 }}>TOTAL</span>
                <span style={{ color: "#E8680A", fontSize: 22, fontWeight: 800 }}>
                  {fmt(total)}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="card" style={{ marginBottom: 16 }}>
              <label className="label">Nota (opcional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej: mesa 3, cliente habitual..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={loading || price === 0}
              style={{ fontSize: 16 }}
            >
              {loading ? <span className="spinner" /> : "✓"}
              {loading ? "Guardando..." : `Confirmar venta • ${fmt(total)}`}
            </button>
          </>
        )}

        {/* Empty state */}
        {!selected && !search && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>🛒</p>
            <p style={{ color: "#718096", fontSize: 15 }}>
              Buscá un producto para comenzar
            </p>
            <p style={{ color: "#A0AEC0", fontSize: 13, marginTop: 4 }}>
              Podés buscar por nombre, SKU o código de barras
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
