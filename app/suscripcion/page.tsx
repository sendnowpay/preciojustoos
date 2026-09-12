"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";

const PLANS = [
  {
    key: "basico",
    name: "Básico",
    price: "ARS 12.900",
    period: "/mes",
    badge: null,
    tagline: "Para kioscos y almacenes",
    features: [
      "POS carrito multi-producto",
      "Escáner de código de barras",
      "Recibo por WhatsApp",
      "Hasta 200 productos",
      "Repricing masivo (inflación)",
      "Historial 30 días",
      "Alertas de stock bajo",
    ],
    highlighted: false,
  },
  {
    key: "estandar",
    name: "Estándar",
    price: "ARS 24.900",
    period: "/mes",
    badge: "MÁS POPULAR",
    tagline: "Para restaurantes y pet shops",
    features: [
      "Todo lo de Básico",
      "Hasta 1.000 productos",
      "Cierre de caja diario (Z-report)",
      "Historial 90 días",
      "Importación CSV masiva",
      "Integración MP QR",
      "Soporte por WhatsApp",
    ],
    highlighted: true,
  },
  {
    key: "pro",
    name: "Pro",
    price: "ARS 44.900",
    period: "/mes",
    badge: null,
    tagline: "Para mercados y distribuidores",
    features: [
      "Todo lo de Estándar",
      "Productos ilimitados",
      "Historial completo",
      "Múltiples dispositivos",
      "Reportes PDF exportables",
      "Soporte prioritario",
      "Onboarding personalizado",
    ],
    highlighted: false,
  },
];

export default function SuscripcionPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState("free_trial");
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlan() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
      if (data) setCurrentPlan(data.plan);
      setLoading(false);
    }
    loadPlan();
  }, []);

  async function handleSubscribe(planKey: string) {
    setSubscribing(planKey);

    // Call our API to create MP Preapproval
    const res = await fetch("/api/mp/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planKey }),
    });
    const data = await res.json();

    if (data.init_point) {
      // Redirect to Mercado Pago checkout
      window.location.href = data.init_point;
    } else if (data.error) {
      setToast("Error al procesar suscripción: " + data.error);
      setTimeout(() => setToast(null), 4000);
    }
    setSubscribing(null);
  }

  return (
    <div style={{ paddingBottom: "calc(var(--bottom-nav-h) + 16px)", background: "#F4F5F7", minHeight: "100dvh" }}>
      {toast && (
        <div className="toast-container">
          <div className="toast error">✕ {toast}</div>
        </div>
      )}

      <div style={{ background: "#1A2A4A", padding: "48px 16px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>💳</div>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>Elegí tu plan</h1>
        <p style={{ color: "#A0AEC0", fontSize: 13, marginTop: 4 }}>
          Pagá con Mercado Pago • Cancelá cuando quieras
        </p>
      </div>

      <div style={{ padding: "16px" }}>
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.key;
          return (
            <div
              key={plan.key}
              className="card"
              style={{
                marginBottom: 12,
                border: plan.highlighted ? "2px solid #E8680A" : "1px solid #E2E8F0",
                position: "relative",
              }}
            >
              {plan.badge && (
                <div
                  style={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#E8680A",
                    color: "#fff",
                    padding: "4px 16px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {plan.badge}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1A2A4A" }}>{plan.name}</h3>
                  <p style={{ fontSize: 11, color: "#718096", marginTop: 1, marginBottom: 4 }}>{plan.tagline}</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: "#E8680A", lineHeight: 1.2 }}>
                    {plan.price}
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#718096" }}>
                      {plan.period}
                    </span>
                  </p>
                </div>
                {isCurrent && (
                  <span className="badge badge-green" style={{ fontSize: 11 }}>Plan actual</span>
                )}
              </div>

              <ul style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4A5568" }}>
                    <span style={{ color: "#E8680A", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className={isCurrent ? "btn-secondary" : "btn-primary"}
                onClick={() => isCurrent ? null : handleSubscribe(plan.key)}
                disabled={!!subscribing || isCurrent || loading}
              >
                {subscribing === plan.key ? (
                  <><span className="spinner" /> Redirigiendo a MP...</>
                ) : isCurrent ? (
                  "Plan actual"
                ) : (
                  `Suscribirme con MP →`
                )}
              </button>
            </div>
          );
        })}

        <p style={{ textAlign: "center", fontSize: 12, color: "#A0AEC0", marginTop: 8, lineHeight: 1.5 }}>
          Los pagos se procesan de forma segura a través de Mercado Pago.
          Podés cancelar en cualquier momento desde tu cuenta de MP.
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
