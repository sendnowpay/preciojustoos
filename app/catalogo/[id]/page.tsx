"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/database";

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [stockAlert, setStockAlert] = useState("5");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("products").select("*").eq("id", id).single();
    if (data) {
      setProduct(data);
      setName(data.name);
      setSku(data.sku || "");
      setCategory(data.category || "");
      setCostPrice(String(data.cost_price));
      setSalePrice(String(data.sale_price));
      setStockQty(String(data.stock_quantity));
      setStockAlert(String(data.stock_alert_threshold));
    }
  }, [id]);

  useEffect(() => { loadProduct(); }, [loadProduct]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    await supabase.from("products").update({
      name, sku: sku || null, category: category || null,
      cost_price: parseFloat(costPrice || "0"),
      sale_price: parseFloat(salePrice || "0"),
      stock_quantity: parseInt(stockQty || "0"),
      stock_alert_threshold: parseInt(stockAlert || "5"),
    }).eq("id", id);
    setToast("Guardado");
    setTimeout(() => setToast(null), 2500);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este producto?")) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("products").update({ is_active: false }).eq("id", id);
    router.push("/catalogo");
  }

  const margin = parseFloat(salePrice) > 0
    ? (((parseFloat(salePrice) - parseFloat(costPrice || "0")) / parseFloat(salePrice)) * 100).toFixed(1) : "0";

  if (!product) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh" }}>
        <div className="spinner" style={{ borderTopColor: "#E8680A", borderColor: "#E2E8F0", width: 28, height: 28 }} />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "calc(var(--bottom-nav-h) + 16px)", background: "#F4F5F7", minHeight: "100dvh" }}>
      {toast && (
        <div className="toast-container">
          <div className="toast success">✓ {toast}</div>
        </div>
      )}

      <div className="page-header">
        <button onClick={() => router.back()} style={{ color: "#A0AEC0", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {product.name}
        </h1>
        <button onClick={handleDelete} disabled={deleting} style={{ color: "#E53E3E", background: "none", border: "none", cursor: "pointer", padding: 4, fontSize: 13, fontWeight: 600 }}>
          Eliminar
        </button>
      </div>

      {/* Stock badge */}
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`badge ${product.stock_quantity === 0 ? "badge-red" : product.stock_quantity <= product.stock_alert_threshold ? "badge-yellow" : "badge-green"}`}>
            {product.stock_quantity === 0 ? "Sin stock" : product.stock_quantity <= product.stock_alert_threshold ? "Stock bajo" : "En stock"}
          </span>
          <span style={{ fontSize: 13, color: "#718096" }}>{product.stock_quantity} unidades • Alerta: {product.stock_alert_threshold}</span>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ padding: "12px 16px" }}>
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A", marginBottom: 14 }}>Información</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="label">Nombre</label>
              <input type="text" className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="label">SKU</label>
                <input type="text" className="input-field" value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
              <div>
                <label className="label">Categoría</label>
                <input type="text" className="input-field" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A", marginBottom: 14 }}>Precios</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="label">Costo</label>
              <input type="number" className="input-field" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} inputMode="decimal" step="0.01" />
            </div>
            <div>
              <label className="label">Venta</label>
              <input type="number" className="input-field" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} inputMode="decimal" step="0.01" required />
            </div>
          </div>
          {parseFloat(salePrice) > 0 && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#F0FFF4", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "#2D7D46", fontWeight: 600 }}>Margen</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#2D7D46" }}>{margin}%</span>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A", marginBottom: 14 }}>Stock</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="label">Cantidad actual</label>
              <input type="number" className="input-field" value={stockQty} onChange={(e) => setStockQty(e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <label className="label">Alerta mínima</label>
              <input type="number" className="input-field" value={stockAlert} onChange={(e) => setStockAlert(e.target.value)} inputMode="numeric" />
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <button type="button" className="btn-secondary" onClick={() => router.push(`/ventas?product=${id}`)} style={{ flex: 1 }}>
            💰 Vender
          </button>
        </div>
      </form>
    </div>
  );
}
