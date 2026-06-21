"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

export default function RepricingPage() {
  const router = useRouter();
  const [pct, setPct] = useState(15);
  const [scope, setScope] = useState<"all" | "category">("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [selCategory, setSelCategory] = useState("");
  const [preview, setPreview] = useState<{ name: string; before: number; after: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadPreview = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    let query = supabase.from("products").select("id,name,sale_price,category").eq("user_id", user.id).eq("is_active", true);
    if (scope === "category" && selCategory) query = query.eq("category", selCategory);

    const { data } = await query.order("name").limit(20);
    if (data) {
      const cats = Array.from(new Set(data.map((p) => p.category).filter(Boolean))) as string[];
      setCategories(cats);
      setPreview(data.map((p) => ({
        name: p.name,
        before: p.sale_price,
        after: Math.round(p.sale_price * (1 + pct / 100)),
      })));
    }
    setApplied(false);
    setLoading(false);
  }, [pct, scope, selCategory]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  async function handleApply() {
    if (!confirm(`¿Aplicar +${pct}% a ${preview.length} productos?`)) return;
    setApplying(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setApplying(false); return; }

    let query = supabase.from("products").select("id,sale_price").eq("user_id", user.id).eq("is_active", true);
    if (scope === "category" && selCategory) query = query.eq("category", selCategory);
    const { data: products } = await query;

    if (products) {
      for (const p of products) {
        await supabase
          .from("products")
          .update({ sale_price: Math.round(p.sale_price * (1 + pct / 100)) })
          .eq("id", p.id);
      }
      // Log the reprice event
      await supabase.from("reprice_events").insert({
        user_id: user.id,
        pct_increase: pct,
        scope: scope === "all" ? "all" : "category",
        category_filter: scope === "category" ? selCategory : null,
        products_affected: products.length,
      });
    }

    showToast(`✓ ${products?.length ?? 0} productos actualizados con +${pct}%`, "success");
    setApplied(true);
    setApplying(false);
    loadPreview();
  }

  const totalDiff = preview.reduce((sum, p) => sum + (p.after - p.before), 0);

  return (
    <div style={{ paddingBottom: "calc(var(--bottom-nav-h) + 16px)", background: "#F4F5F7", minHeight: "100dvh" }}>
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>{toast.type === "success" ? "✓" : "✕"} {toast.msg}</div>
        </div>
      )}

      <div className="page-header">
        <button onClick={() => router.back()} style={{ color: "#A0AEC0", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1>Actualizar Precios</h1>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Inflation context */}
        <div className="alert-banner" style={{ background: "#FFFBEB", borderColor: "#F6AD55", color: "#975A16", marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <span style={{ fontSize: 13 }}>
            Inflación Argentina: ~3% mensual. Actualizá tus precios regularmente.
          </span>
        </div>

        {/* Controls */}
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A", marginBottom: 14 }}>Configurar ajuste</h2>

          <label className="label">Porcentaje de aumento</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <input
              type="range"
              min={1}
              max={100}
              value={pct}
              onChange={(e) => setPct(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: "#E8680A" }}
            />
            <div style={{
              background: "#E8680A", color: "#fff", borderRadius: 8,
              padding: "6px 12px", fontSize: 20, fontWeight: 800, minWidth: 70, textAlign: "center"
            }}>
              +{pct}%
            </div>
          </div>

          {/* Quick preset buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {[5, 10, 15, 20, 30, 50].map((p) => (
              <button
                key={p}
                onClick={() => setPct(p)}
                style={{
                  padding: "6px 14px", borderRadius: 20,
                  border: pct === p ? "none" : "1.5px solid #E2E8F0",
                  background: pct === p ? "#E8680A" : "#fff",
                  color: pct === p ? "#fff" : "#4A5568",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                +{p}%
              </button>
            ))}
          </div>

          {/* Scope */}
          <label className="label">Alcance</label>
          <div style={{ display: "flex", gap: 8, marginBottom: scope === "category" ? 12 : 0 }}>
            {(["all", "category"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                style={{
                  flex: 1, padding: "10px 0",
                  borderRadius: 8,
                  border: scope === s ? "2px solid #E8680A" : "1.5px solid #E2E8F0",
                  background: scope === s ? "#FFF5EE" : "#fff",
                  color: scope === s ? "#E8680A" : "#4A5568",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                {s === "all" ? "🏪 Todos" : "🗂️ Por categoría"}
              </button>
            ))}
          </div>
          {scope === "category" && (
            <div style={{ marginTop: 12 }}>
              <label className="label">Categoría</label>
              <select className="input-field" value={selCategory} onChange={(e) => setSelCategory(e.target.value)}>
                <option value="">Seleccionar...</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A" }}>
              Vista previa ({preview.length} productos)
            </h2>
            {totalDiff > 0 && (
              <span style={{ fontSize: 12, color: "#2D7D46", fontWeight: 600 }}>
                +{fmt(totalDiff / preview.length)} prom.
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div className="spinner" style={{ margin: "0 auto", borderTopColor: "#E8680A", borderColor: "#E2E8F0", width: 20, height: 20 }} />
            </div>
          ) : preview.length === 0 ? (
            <p style={{ color: "#718096", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
              Sin productos para mostrar
            </p>
          ) : (
            <div>
              {preview.slice(0, 8).map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F0F4F8" }}>
                  <p style={{ fontSize: 13, color: "#1A2A4A", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{p.name}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: "#A0AEC0", textDecoration: "line-through" }}>{fmt(p.before)}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#2D7D46" }}>{fmt(p.after)}</span>
                  </div>
                </div>
              ))}
              {preview.length > 8 && (
                <p style={{ fontSize: 12, color: "#718096", textAlign: "center", padding: "8px 0 2px" }}>
                  +{preview.length - 8} productos más...
                </p>
              )}
            </div>
          )}
        </div>

        <button
          className="btn-primary"
          onClick={handleApply}
          disabled={applying || preview.length === 0 || (scope === "category" && !selCategory)}
          style={{ fontSize: 16 }}
        >
          {applying ? <span className="spinner" /> : "📈"}
          {applying ? "Aplicando..." : `Aplicar +${pct}% a ${preview.length} productos`}
        </button>

        {applied && (
          <button
            className="btn-secondary"
            onClick={() => router.push("/catalogo")}
            style={{ marginTop: 10 }}
          >
            Ver catálogo actualizado →
          </button>
        )}
      </div>
    </div>
  );
}
