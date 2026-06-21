"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NuevoProductoPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [stockAlert, setStockAlert] = useState("5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const margin =
    parseFloat(salePrice) > 0
      ? (((parseFloat(salePrice) - parseFloat(costPrice || "0")) / parseFloat(salePrice)) * 100).toFixed(1)
      : "0";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !salePrice) { setError("Nombre y precio de venta son requeridos"); return; }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { error: err } = await supabase.from("products").insert({
      user_id: user.id,
      name,
      sku: sku || null,
      category: category || null,
      cost_price: parseFloat(costPrice || "0"),
      sale_price: parseFloat(salePrice),
      stock_quantity: parseInt(stockQty || "0"),
      stock_alert_threshold: parseInt(stockAlert || "5"),
      is_active: true,
    });

    if (err) {
      setError("Error al guardar: " + err.message);
      setLoading(false);
    } else {
      router.push("/catalogo");
    }
  }

  return (
    <div style={{ paddingBottom: "calc(var(--bottom-nav-h) + 16px)", background: "#F4F5F7", minHeight: "100dvh" }}>
      <div className="page-header">
        <button onClick={() => router.back()} style={{ color: "#A0AEC0", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1>Nuevo Producto</h1>
      </div>

      <form onSubmit={handleSave} style={{ padding: "16px" }}>
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A", marginBottom: 14 }}>Información básica</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="label">Nombre *</label>
              <input type="text" className="input-field" placeholder="Ej: Coca Cola 2.25L" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="label">SKU / Código</label>
                <input type="text" className="input-field" placeholder="COC-225" value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
              <div>
                <label className="label">Categoría</label>
                <input type="text" className="input-field" placeholder="Bebidas" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A", marginBottom: 14 }}>Precios</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="label">Precio de costo</label>
              <input type="number" className="input-field" placeholder="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} inputMode="decimal" step="0.01" />
            </div>
            <div>
              <label className="label">Precio de venta *</label>
              <input type="number" className="input-field" placeholder="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} inputMode="decimal" step="0.01" required />
            </div>
          </div>
          {parseFloat(salePrice) > 0 && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#F0FFF4", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "#2D7D46", fontWeight: 600 }}>Margen calculado</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#2D7D46" }}>{margin}%</span>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A", marginBottom: 14 }}>Stock</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="label">Cantidad inicial</label>
              <input type="number" className="input-field" placeholder="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <label className="label">Alerta de stock bajo</label>
              <input type="number" className="input-field" placeholder="5" value={stockAlert} onChange={(e) => setStockAlert(e.target.value)} inputMode="numeric" />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: "#FFF5F5", border: "1px solid #FED7D7", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#C53030", marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {loading ? "Guardando..." : "Guardar producto"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.back()} style={{ marginTop: 10 }}>
          Cancelar
        </button>
      </form>
    </div>
  );
}
