"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

interface DaySummary {
  totalRevenue: number;
  totalMargin: number;
  txCount: number;
  itemsSold: number;
  avgTicket: number;
  byPayment: Record<string, number>;
  topProducts: { name: string; qty: number; revenue: number }[];
  hourlyRevenue: { hour: number; revenue: number }[];
}

export default function CierrePage() {
  const router = useRouter();
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const PM_LABELS: Record<string, string> = {
    efectivo: "Efectivo",
    mp_qr: "Mercado Pago QR",
    debito: "Débito",
    credito: "Crédito",
    otro: "Otro",
  };

  const loadSummary = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const from = new Date(date);
    from.setHours(0, 0, 0, 0);
    const to = new Date(date);
    to.setHours(23, 59, 59, 999);

    const { data: txs } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .gte("completed_at", from.toISOString())
      .lte("completed_at", to.toISOString());

    const { data: sales } = await supabase
      .from("sales")
      .select("product_name, quantity, total_amount, margin_amount, sold_at")
      .eq("user_id", user.id)
      .gte("sold_at", from.toISOString())
      .lte("sold_at", to.toISOString());

    if (!txs || !sales) { setLoading(false); return; }

    const totalRevenue = txs.reduce((s, t) => s + t.total_amount, 0);
    const totalMargin = sales.reduce((s, t) => s + (t.margin_amount || 0), 0);
    const itemsSold = sales.reduce((s, t) => s + t.quantity, 0);

    const byPayment: Record<string, number> = {};
    txs.forEach((t) => {
      byPayment[t.payment_method] = (byPayment[t.payment_method] || 0) + t.total_amount;
    });

    // Top products
    const productMap: Record<string, { qty: number; revenue: number }> = {};
    sales.forEach((s) => {
      if (!productMap[s.product_name]) productMap[s.product_name] = { qty: 0, revenue: 0 };
      productMap[s.product_name].qty += s.quantity;
      productMap[s.product_name].revenue += s.total_amount;
    });
    const topProducts = Object.entries(productMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Hourly breakdown
    const hourlyMap: Record<number, number> = {};
    txs.forEach((t) => {
      const hour = new Date(t.completed_at).getHours();
      hourlyMap[hour] = (hourlyMap[hour] || 0) + t.total_amount;
    });
    const hourlyRevenue = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      revenue: hourlyMap[h] || 0,
    })).filter((h) => h.revenue > 0);

    setSummary({
      totalRevenue,
      totalMargin,
      txCount: txs.length,
      itemsSold,
      avgTicket: txs.length > 0 ? totalRevenue / txs.length : 0,
      byPayment,
      topProducts,
      hourlyRevenue,
    });
    setLoading(false);
  }, [date]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  function sendZReportToWhatsApp() {
    if (!summary) return;
    const d = new Date(date).toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" });
    const pmLines = Object.entries(summary.byPayment)
      .map(([pm, amt]) => `  ${PM_LABELS[pm] || pm}: ${fmt(amt)}`)
      .join("\n");
    const topLines = summary.topProducts.slice(0, 5)
      .map((p, i) => `  ${i + 1}. ${p.name} - ${p.qty} u. - ${fmt(p.revenue)}`)
      .join("\n");

    const text = [
      `*CIERRE DE CAJA*`,
      `*${d.toUpperCase()}*`,
      `------------------------`,
      `*Ventas:* ${summary.txCount}`,
      `*Items vendidos:* ${summary.itemsSold}`,
      `*Ticket promedio:* ${fmt(summary.avgTicket)}`,
      ``,
      `*RECAUDACION:*`,
      `*TOTAL: ${fmt(summary.totalRevenue)}*`,
      `Margen bruto: ${fmt(summary.totalMargin)} (${summary.totalRevenue > 0 ? ((summary.totalMargin / summary.totalRevenue) * 100).toFixed(1) : 0}%)`,
      ``,
      `*Por forma de pago:*`,
      pmLines,
      ``,
      `*Top productos:*`,
      topLines,
      `------------------------`,
      `Precio Justo OS`,
    ].join("\n");

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  const maxHourly = summary
    ? Math.max(...summary.hourlyRevenue.map((h) => h.revenue), 1)
    : 1;

  return (
    <div style={{ paddingBottom: "calc(var(--bottom-nav-h) + 16px)", background: "#F4F5F7", minHeight: "100dvh" }}>
      <div className="page-header">
        <button onClick={() => router.back()} style={{ color: "#A0AEC0", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1>Cierre de Caja</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ background: "none", border: "none", color: "#A0AEC0", fontSize: 13, cursor: "pointer" }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div className="spinner" style={{ margin: "0 auto", borderTopColor: "#E8680A", borderColor: "#E2E8F0", width: 32, height: 32 }} />
        </div>
      ) : !summary || summary.txCount === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>📊</p>
          <p style={{ color: "#718096", fontSize: 16 }}>Sin ventas para esta fecha</p>
          <p style={{ color: "#A0AEC0", fontSize: 13, marginTop: 4 }}>
            {new Date(date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>
      ) : (
        <div style={{ padding: "16px" }}>
          {/* Hero totals */}
          <div
            style={{
              background: "#1A2A4A",
              borderRadius: 14,
              padding: "20px 16px",
              marginBottom: 12,
            }}
          >
            <p style={{ color: "#A0AEC0", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total del día
            </p>
            <p style={{ color: "#fff", fontSize: 36, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>
              {fmt(summary.totalRevenue)}
            </p>
            <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
              <div>
                <p style={{ color: "#A0AEC0", fontSize: 11 }}>Margen bruto</p>
                <p style={{ color: "#68D391", fontSize: 16, fontWeight: 700 }}>
                  {fmt(summary.totalMargin)}{" "}
                  <span style={{ fontSize: 12, fontWeight: 500 }}>
                    ({summary.totalRevenue > 0 ? ((summary.totalMargin / summary.totalRevenue) * 100).toFixed(1) : 0}%)
                  </span>
                </p>
              </div>
              <div>
                <p style={{ color: "#A0AEC0", fontSize: 11 }}>Ticket prom.</p>
                <p style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>{fmt(summary.avgTicket)}</p>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            {[
              { label: "Ventas realizadas", value: String(summary.txCount), icon: "🧾" },
              { label: "Items vendidos", value: String(summary.itemsSold), icon: "📦" },
            ].map((s) => (
              <div key={s.label} className="card">
                <p style={{ fontSize: 22 }}>{s.icon}</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: "#1A2A4A", marginTop: 4 }}>{s.value}</p>
                <p style={{ fontSize: 12, color: "#718096" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* By payment method */}
          <div className="card" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
              Por forma de pago
            </h2>
            {Object.entries(summary.byPayment).sort((a, b) => b[1] - a[1]).map(([pm, amount]) => {
              const pct = (amount / summary.totalRevenue) * 100;
              return (
                <div key={pm} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: "#4A5568" }}>{PM_LABELS[pm] || pm}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1A2A4A" }}>
                      {fmt(amount)} <span style={{ color: "#718096", fontWeight: 400 }}>({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 6, background: "#F0F4F8", borderRadius: 3 }}>
                    <div style={{ height: 6, background: pm === "mp_qr" ? "#009ee3" : pm === "efectivo" ? "#2D7D46" : "#E8680A", borderRadius: 3, width: `${pct}%`, transition: "width 0.5s" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hourly chart */}
          {summary.hourlyRevenue.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                Ventas por hora
              </h2>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
                {Array.from({ length: 24 }, (_, h) => {
                  const found = summary.hourlyRevenue.find((x) => x.hour === h);
                  const rev = found?.revenue || 0;
                  const pct = rev > 0 ? (rev / maxHourly) * 100 : 0;
                  return (
                    <div
                      key={h}
                      title={`${h}:00 — ${fmt(rev)}`}
                      style={{
                        flex: 1,
                        height: `${Math.max(pct, rev > 0 ? 8 : 0)}%`,
                        background: rev > 0 ? "#E8680A" : "#F0F4F8",
                        borderRadius: "2px 2px 0 0",
                        transition: "height 0.3s",
                        minHeight: rev > 0 ? 4 : 0,
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "#A0AEC0" }}>0h</span>
                <span style={{ fontSize: 10, color: "#A0AEC0" }}>12h</span>
                <span style={{ fontSize: 10, color: "#A0AEC0" }}>23h</span>
              </div>
            </div>
          )}

          {/* Top products */}
          {summary.topProducts.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                Top productos
              </h2>
              {summary.topProducts.map((p, i) => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < summary.topProducts.length - 1 ? "1px solid #F0F4F8" : "none" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#A0AEC0", width: 16, textAlign: "center" }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1A2A4A" }}>{p.name}</p>
                    <p style={{ fontSize: 11, color: "#718096" }}>{p.qty} unidades</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1A2A4A" }}>{fmt(p.revenue)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <button
            onClick={sendZReportToWhatsApp}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: "#25D366",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "14px 20px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              marginBottom: 10,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Enviar cierre por WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}
