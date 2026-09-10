"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

interface Transaction {
  id: string;
  total_amount: number;
  payment_method: string;
  items_count: number;
  notes: string | null;
  receipt_sent: boolean;
  customer_phone: string | null;
  completed_at: string;
}

interface SaleLine {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  margin_amount: number | null;
}

const PM_LABELS: Record<string, string> = {
  efectivo: "💵 Efectivo",
  mp_qr: "📱 MP QR",
  debito: "💳 Débito",
  credito: "💳 Crédito",
  otro: "🔄 Otro",
};

export default function HistorialPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedLines, setExpandedLines] = useState<SaleLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"today" | "week" | "month">("today");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 40;

  const loadTransactions = useCallback(async () => {
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
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .gte("completed_at", from.toISOString())
      .order("completed_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (data) {
      setTransactions(page === 0 ? data : (prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, page]);

  useEffect(() => { setPage(0); setTransactions([]); }, [range]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  async function loadLines(txId: string) {
    if (expandedId === txId) { setExpandedId(null); return; }
    setExpandedId(txId);
    setLoadingLines(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("sales")
      .select("id, product_name, quantity, unit_price, total_amount, margin_amount")
      .eq("transaction_id", txId)
      .order("created_at");
    if (data) setExpandedLines(data);
    setLoadingLines(false);
  }

  // Summary stats
  const totalRevenue = transactions.reduce((s, t) => s + t.total_amount, 0);
  const totalTx = transactions.length;
  const avgTicket = totalTx > 0 ? totalRevenue / totalTx : 0;
  const byPayment: Record<string, number> = {};
  transactions.forEach((t) => {
    byPayment[t.payment_method] = (byPayment[t.payment_method] || 0) + t.total_amount;
  });

  // Group by day
  const byDay: Record<string, Transaction[]> = {};
  for (const t of transactions) {
    const day = new Date(t.completed_at).toLocaleDateString("es-AR", {
      weekday: "short", day: "2-digit", month: "short",
    });
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(t);
  }

  return (
    <div style={{ paddingBottom: "calc(var(--bottom-nav-h) + 16px)", background: "#F4F5F7", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ background: "#1A2A4A", padding: "48px 16px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>Historial</h1>
          <Link href="/cierre" style={{ background: "#E8680A", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
            📊 Cierre
          </Link>
        </div>

        {/* KPI bar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Ventas", value: String(totalTx) },
            { label: "Recaudado", value: fmt(totalRevenue) },
            { label: "Ticket prom.", value: fmt(avgTicket) },
          ].map((s) => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <p style={{ color: "#A0AEC0", fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>{s.label}</p>
              <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, marginTop: 2 }}>{s.value}</p>
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
                flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                background: range === r ? "#E8680A" : "rgba(255,255,255,0.12)",
                color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              {r === "today" ? "Hoy" : r === "week" ? "7 días" : "Este mes"}
            </button>
          ))}
        </div>
      </div>

      {/* Payment method breakdown */}
      {Object.keys(byPayment).length > 1 && (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {Object.entries(byPayment).map(([pm, amount]) => (
              <div key={pm} style={{ background: "#fff", borderRadius: 10, padding: "8px 12px", flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <p style={{ fontSize: 11, color: "#718096" }}>{PM_LABELS[pm] || pm}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A" }}>{fmt(amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div style={{ padding: "12px 16px" }}>
        {loading && page === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div className="spinner" style={{ margin: "0 auto", borderTopColor: "#E8680A", borderColor: "#E2E8F0", width: 28, height: 28 }} />
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📋</p>
            <p style={{ color: "#718096", fontSize: 15 }}>Sin ventas en este período</p>
          </div>
        ) : (
          <>
            {Object.entries(byDay).map(([day, dayTxs]) => {
              const dayTotal = dayTxs.reduce((s, t) => s + t.total_amount, 0);
              return (
                <div key={day} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.05em" }}>{day}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1A2A4A" }}>{fmt(dayTotal)} · {dayTxs.length} venta{dayTxs.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    {dayTxs.map((tx, i) => (
                      <div key={tx.id}>
                        <button
                          onClick={() => loadLines(tx.id)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "11px 14px",
                            borderBottom: (expandedId !== tx.id && i < dayTxs.length - 1) ? "1px solid #F0F4F8" : "none",
                            background: expandedId === tx.id ? "#FFF9F5" : "transparent",
                            width: "100%",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, color: "#718096" }}>{PM_LABELS[tx.payment_method] || tx.payment_method}</span>
                              <span style={{ fontSize: 11, color: "#A0AEC0" }}>{fmtTime(tx.completed_at)}</span>
                              {tx.receipt_sent && <span style={{ fontSize: 10, color: "#25D366", fontWeight: 700 }}>WA ✓</span>}
                            </div>
                            <p style={{ fontSize: 12, color: "#A0AEC0", marginTop: 2 }}>
                              {tx.items_count} item{tx.items_count !== 1 ? "s" : ""}
                              {tx.notes ? ` · ${tx.notes}` : ""}
                            </p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <p style={{ fontSize: 15, fontWeight: 700, color: "#1A2A4A" }}>{fmt(tx.total_amount)}</p>
                            <span style={{ color: "#A0AEC0", fontSize: 14 }}>{expandedId === tx.id ? "▲" : "▼"}</span>
                          </div>
                        </button>

                        {/* Expanded line items */}
                        {expandedId === tx.id && (
                          <div style={{ background: "#F8FAFC", borderBottom: i < dayTxs.length - 1 ? "1px solid #F0F4F8" : "none" }}>
                            {loadingLines ? (
                              <div style={{ textAlign: "center", padding: "12px" }}>
                                <div className="spinner" style={{ margin: "0 auto", width: 16, height: 16, borderTopColor: "#E8680A", borderColor: "#E2E8F0" }} />
                              </div>
                            ) : (
                              expandedLines.map((line) => (
                                <div key={line.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 14px 7px 22px", borderBottom: "1px solid #F0F4F8" }}>
                                  <span style={{ fontSize: 12, color: "#4A5568" }}>
                                    {line.product_name} × {line.quantity}
                                  </span>
                                  <div style={{ textAlign: "right" }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "#1A2A4A" }}>{fmt(line.total_amount)}</span>
                                    {line.margin_amount != null && (
                                      <span style={{ fontSize: 10, color: "#2D7D46", marginLeft: 6 }}>mg {fmt(line.margin_amount)}</span>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <button onClick={() => setPage(page + 1)} className="btn-secondary" disabled={loading}>
                {loading ? "Cargando..." : "Cargar más"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
