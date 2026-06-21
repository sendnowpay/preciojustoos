"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { Profile, Product, Sale } from "@/types/database";

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todaySales, setTodaySales] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [profileRes, salesRes, productsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("sales")
        .select("*")
        .eq("user_id", user.id)
        .gte("sold_at", today.toISOString())
        .order("sold_at", { ascending: false })
        .limit(5),
      supabase
        .from("products")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .filter("stock_quantity", "lte", "stock_alert_threshold"),
    ]);

    if (profileRes.data) setProfile(profileRes.data);

    if (salesRes.data) {
      setRecentSales(salesRes.data);
      setTodaySales(salesRes.data.length);
      setTodayRevenue(
        salesRes.data.reduce((sum, s) => sum + (s.total_amount || 0), 0)
      );
    }

    if (productsRes.data) {
      setLowStockCount(productsRes.data.length);
      setLowStockItems(productsRes.data.slice(0, 3));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? "Buenos días"
      : greetingHour < 18
      ? "Buenas tardes"
      : "Buenas noches";

  return (
    <div
      style={{
        paddingBottom: "calc(var(--bottom-nav-h) + 16px)",
        background: "#F4F5F7",
        minHeight: "100dvh",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#1A2A4A",
          padding: "52px 20px 20px",
        }}
      >
        <p style={{ color: "#A0AEC0", fontSize: 13 }}>{greeting} 👋</p>
        <h1
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: 700,
            marginTop: 2,
          }}
        >
          {loading ? "Cargando..." : profile?.business_name || "Mi Negocio"}
        </h1>

        {/* Today summary cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 20,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <p style={{ color: "#A0AEC0", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Ventas hoy
            </p>
            <p style={{ color: "#fff", fontSize: 28, fontWeight: 700, marginTop: 4 }}>
              {loading ? "—" : todaySales}
            </p>
          </div>
          <div
            style={{
              background: "rgba(232,104,10,0.2)",
              borderRadius: 12,
              padding: "14px 16px",
              border: "1px solid rgba(232,104,10,0.3)",
            }}
          >
            <p style={{ color: "#F5A65B", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Recaudado hoy
            </p>
            <p style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginTop: 4 }}>
              {loading ? "—" : fmt(todayRevenue)}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "20px 16px" }}>
        {/* Quick Actions */}
        <h2
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#718096",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 12,
          }}
        >
          Acciones rápidas
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            {
              href: "/ventas",
              icon: "💰",
              label: "Registrar venta",
              color: "#E8680A",
              bg: "#FFF5EE",
            },
            {
              href: "/repricing",
              icon: "📈",
              label: "Actualizar precios",
              color: "#1A2A4A",
              bg: "#EEF2FF",
            },
            {
              href: "/catalogo/nuevo",
              icon: "➕",
              label: "Agregar producto",
              color: "#2D7D46",
              bg: "#F0FFF4",
            },
            {
              href: "/csv-import",
              icon: "📋",
              label: "Importar CSV",
              color: "#2C5282",
              bg: "#EBF8FF",
            },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              style={{
                background: action.bg,
                borderRadius: 12,
                padding: "16px 14px",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              <span style={{ fontSize: 22 }}>{action.icon}</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: action.color,
                  lineHeight: 1.3,
                }}
              >
                {action.label}
              </span>
            </Link>
          ))}
        </div>

        {/* Low stock alerts */}
        {!loading && lowStockCount > 0 && (
          <>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#718096",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 12,
              }}
            >
              ⚠️ Stock bajo ({lowStockCount})
            </h2>
            <div className="card" style={{ marginBottom: 24 }}>
              {lowStockItems.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid #F0F4F8",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#1A2A4A" }}>
                      {p.name}
                    </p>
                    <p style={{ fontSize: 12, color: "#718096" }}>{p.category}</p>
                  </div>
                  <span className="badge badge-red">{p.stock_quantity} u.</span>
                </div>
              ))}
              {lowStockCount > 3 && (
                <Link
                  href="/catalogo?filter=low_stock"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "8px 0 2px",
                    fontSize: 13,
                    color: "#E8680A",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Ver todos ({lowStockCount - 3} más)
                </Link>
              )}
            </div>
          </>
        )}

        {/* Recent sales */}
        <h2
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#718096",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 12,
          }}
        >
          Ventas recientes
        </h2>

        {loading ? (
          <div className="card" style={{ padding: "32px 16px", textAlign: "center" }}>
            <div className="spinner" style={{ margin: "0 auto", borderTopColor: "#E8680A", borderColor: "#E2E8F0" }} />
          </div>
        ) : recentSales.length === 0 ? (
          <div
            className="card"
            style={{ textAlign: "center", padding: "32px 16px" }}
          >
            <p style={{ fontSize: 32, marginBottom: 8 }}>📊</p>
            <p style={{ color: "#718096", fontSize: 14 }}>
              Aún no hay ventas hoy.
            </p>
            <Link
              href="/ventas"
              style={{
                display: "inline-block",
                marginTop: 12,
                color: "#E8680A",
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Registrar primera venta →
            </Link>
          </div>
        ) : (
          <div className="card">
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid #F0F4F8",
                }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1A2A4A" }}>
                    {sale.product_name}
                  </p>
                  <p style={{ fontSize: 12, color: "#718096" }}>
                    {sale.quantity} u. •{" "}
                    {new Date(sale.sold_at).toLocaleTimeString("es-AR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A" }}>
                    {fmt(sale.total_amount)}
                  </p>
                  <span
                    className={`badge ${
                      sale.payment_method === "efectivo"
                        ? "badge-green"
                        : sale.payment_method === "mp_qr"
                        ? "badge-blue"
                        : "badge-gray"
                    }`}
                  >
                    {sale.payment_method === "mp_qr" ? "MP" : sale.payment_method}
                  </span>
                </div>
              </div>
            ))}
            <Link
              href="/historial"
              style={{
                display: "block",
                textAlign: "center",
                padding: "10px 0 2px",
                fontSize: 13,
                color: "#E8680A",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Ver historial completo →
            </Link>
          </div>
        )}

        {/* MP subscription banner */}
        {!loading && profile?.plan === "free_trial" && (
          <div
            style={{
              background: "linear-gradient(135deg, #1A2A4A 0%, #2A3E6A 100%)",
              borderRadius: 14,
              padding: "20px 16px",
              marginTop: 24,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 36 }}>⏰</div>
            <div style={{ flex: 1 }}>
              <p style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
                Período de prueba activo
              </p>
              <p style={{ color: "#A0AEC0", fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
                Suscribite para continuar usando Precio Justo OS sin interrupciones.
              </p>
              <Link
                href="/suscripcion"
                style={{
                  display: "inline-block",
                  marginTop: 10,
                  background: "#E8680A",
                  color: "#fff",
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Ver planes →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
