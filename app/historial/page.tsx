"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Sale } from "@/types/database";

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

const PM_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  mp_qr: "MP QR",
  debito: "Débito",
  credito: "Crédito",
  otro: "Otro",
};

export default function HistorialPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"today" | "week" | "month">("week");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const loadSales = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const now = new Date();
    let from = new Date();
    if (range === "today") { from.setHours(0, 0, 0, 0); }
    else if (range === "week") { from.setDate(now.getDate() - 7); }
    else { from.setDate(1); from.setHours(0, 0, 0, 0); }

    const { data } = await supabase
      .from("sales")
      .select("*")
      .eq("user_id", user.id)
      .gte("sold_at", from.toISOString())
      .order("sold_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (data) setSales(page === 0 ? data : [...sales, ...data]);
    setLoading(false);
  }, [range, page]);

  useEffect(() => { setPage(0); }, [range]);
  useEffect(() => { loadSales(); }, [loadSales]);

  // Summary stats
  const totalRevenue = sales.reduce((s, x) => s + x.total_amount, 0);
  const totalMargin = sales.reduce((s, x) => s + (x.margin_amount || 0), 0);
  const avgMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  // Group by day
  const byDay: Record<string, Sale[]> = {};
  for (const s of sales) {
    const day = new Date(s.sold_at).toLocaleDateString("es-AR");
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(s);
  }

  return (
    <div style={{ paddingBottom: "calc(var(--bottom-nav-h) + 16px)", background: "#F4F5F7", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ background: "#1A2A4A", padding: "48px 16px 16px" }}>
        <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Historial</h1>

        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Ventas", value: String(sales.length) },
            { label: "Recaudado", value: fmt(totalRevenue) },
            { label: "Margen", value: `${avgMarginPct.toFixed(1)}%` },
          ].map((s) => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <p style={{ color: "#A0AEC0", fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>{s.label}</p>
              <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginTop: 2 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Range filter */}
        <div style={{ display: "flex", gap: 8 }}>
          {(["today", "week", "month"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                flex: 1, padding: "8px 0",
                borderRadius: 8,
                border: "none",
                background: range === r ? "#E8680A" : "rgba(255,255,255,0.12)",
                color: "#fff",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              {r === "today" ? "Hoy" : r === "week" ? "7 días" : "Este mes"}
            </button>
          ))}
        </div>
      </div>

      {/* Sales grouped by day */}
      <div style={{ padding: "16px" }}>
        {loading && page === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div className="spinner" style={{ margin: "0 auto", borderTopColor: "#E8680A", borderColor: "#E2E8F0", width: 28, height: 28 }} />
          </div>
        ) : sales.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📋</p>
            <p style={{ color: "#718096", fontSize: 15 }}>Sin ventas en este período</p>
          </div>
        ) : (
          <>
            {Object.entries(byDay).map(([day, daySales]) => {
              const dayTotal = daySales.reduce((s, x) => s + x.total_amount, 0);
              return (
                <div key={day} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {day}
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1A2A4A" }}>{fmt(dayTotal)}</p>
                  </div>
                  <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    {daySales.map((sale, i) => (
                      <div
                        key={sale.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          borderBottom: i < daySales.length - 1 ? "1px solid #F0F4F8" : "none",
                        }}
                      >
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#1A2A4A" }}>{sale.product_name}</p>
                          <p style={{ fontSize: 11, color: "#718096" }}>
                            {sale.quantity} u. • {fmtTime(sale.sold_at)} •{" "}
                            <span
                              style={{
                                color: sale.payment_method === "mp_qr" ? "#2C5282" : "#2D7D46",
                                fontWeight: 600,
                              }}
                            >
                              {PM_LABELS[sale.payment_method] || sale.payment_method}
                            </span>
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#1A2A4A" }}>{fmt(sale.total_amount)}</p>
                          {sale.margin_amount != null && (
                            <p style={{ fontSize: 10, color: sale.margin_amount >= 0 ? "#2D7D46" : "#E53E3E" }}>
                              mg {fmt(sale.margin_amount)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {sales.length >= PAGE_SIZE * (page + 1) && (
              <button
                onClick={() => setPage(page + 1)}
                className="btn-secondary"
                style={{ marginTop: 8 }}
                disabled={loading}
              >
                {loading ? "Cargando..." : "Cargar más"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
