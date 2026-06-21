"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { Product } from "@/types/database";

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CatalogoPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low_stock">("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [selCategory, setSelCategory] = useState("todas");

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
    if (data) {
      setProducts(data);
      const cats = Array.from(new Set(data.map((p) => p.category).filter(Boolean))) as string[];
      setCategories(cats);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.sku || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "low_stock" && p.stock_quantity > p.stock_alert_threshold) return false;
    if (selCategory !== "todas" && p.category !== selCategory) return false;
    return true;
  });

  return (
    <div style={{ paddingBottom: "calc(var(--bottom-nav-h) + 16px)", background: "#F4F5F7", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ background: "#1A2A4A", padding: "48px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>Catálogo</h1>
          <Link
            href="/catalogo/nuevo"
            style={{
              background: "#E8680A", color: "#fff", borderRadius: 8,
              padding: "8px 14px", fontSize: 13, fontWeight: 700,
              textDecoration: "none", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            + Nuevo
          </Link>
        </div>
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px",
            borderRadius: 10, border: "none",
            fontSize: 14, background: "rgba(255,255,255,0.12)",
            color: "#fff", outline: "none",
          }}
        />
      </div>

      {/* Filter chips */}
      <div style={{ padding: "12px 16px", display: "flex", gap: 8, overflowX: "auto" }}>
        {["todas", ...categories].map((c) => (
          <button
            key={c}
            onClick={() => setSelCategory(c)}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              border: "none",
              background: selCategory === c ? "#1A2A4A" : "#fff",
              color: selCategory === c ? "#fff" : "#4A5568",
              fontSize: 12, fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            {c === "todas" ? "Todas" : c}
          </button>
        ))}
        <button
          onClick={() => setFilter(filter === "all" ? "low_stock" : "all")}
          style={{
            padding: "6px 12px",
            borderRadius: 20,
            border: "none",
            background: filter === "low_stock" ? "#E53E3E" : "#fff",
            color: filter === "low_stock" ? "#fff" : "#4A5568",
            fontSize: 12, fontWeight: 600,
            cursor: "pointer", whiteSpace: "nowrap",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          ⚠️ Stock bajo
        </button>
      </div>

      {/* Product list */}
      <div style={{ padding: "0 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div className="spinner" style={{ margin: "0 auto", borderTopColor: "#E8680A", borderColor: "#E2E8F0", width: 28, height: 28 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📦</p>
            <p style={{ color: "#718096", fontSize: 15 }}>
              {products.length === 0 ? "Sin productos todavía" : "Sin resultados"}
            </p>
            {products.length === 0 && (
              <Link
                href="/catalogo/nuevo"
                style={{ display: "inline-block", marginTop: 16, background: "#E8680A", color: "#fff", padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
              >
                Agregar primer producto
              </Link>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {filtered.map((p, i) => (
              <Link
                key={p.id}
                href={`/catalogo/${p.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 14px",
                  borderBottom: i < filtered.length - 1 ? "1px solid #F0F4F8" : "none",
                  textDecoration: "none",
                  gap: 12,
                }}
              >
                {/* Stock indicator */}
                <div
                  style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: p.stock_quantity === 0 ? "#E53E3E" : p.stock_quantity <= p.stock_alert_threshold ? "#F6AD55" : "#68D391",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1A2A4A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name}
                  </p>
                  <p style={{ fontSize: 12, color: "#718096" }}>
                    {p.category} • {p.stock_quantity} u. {p.sku ? `• ${p.sku}` : ""}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A" }}>
                    {fmt(p.sale_price)}
                  </p>
                  <p style={{ fontSize: 11, color: "#718096" }}>
                    Mg: {p.margin_pct?.toFixed(0) ?? "—"}%
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Summary bar */}
        {!loading && products.length > 0 && (
          <p style={{ textAlign: "center", fontSize: 12, color: "#A0AEC0", marginTop: 12 }}>
            {filtered.length} de {products.length} productos
          </p>
        )}
      </div>
    </div>
  );
}
