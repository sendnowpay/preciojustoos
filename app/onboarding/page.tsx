"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STEPS = [
  {
    icon: "🎉",
    title: "¡Bienvenido a Precio Justo OS!",
    body: "Tu herramienta para manejar precios en Argentina con inflación. Todo en tu celular.",
    action: "Empezar",
  },
  {
    icon: "📦",
    title: "Cargá tu inventario",
    body: "Subí tus productos manualmente o importalos desde un Excel. Precio de costo, venta y margen automático.",
    action: "Entendido",
  },
  {
    icon: "📊",
    title: "Actualizá precios al toque",
    body: "Cuando suba el dólar, ajustá todos tus precios con un porcentaje en segundos.",
    action: "Perfecto",
  },
  {
    icon: "💳",
    title: "Integrá Mercado Pago",
    body: "Cobrá con QR, vinculá tus cobros y llevá el historial de ventas sin papel.",
    action: "¡Listo, comenzar!",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  async function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_complete: true })
        .eq("id", user.id);
    }
    router.push("/dashboard");
  }

  const current = STEPS[step];

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#1A2A4A",
      }}
    >
      {/* Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 28px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 72, marginBottom: 32, lineHeight: 1 }}>
          {current.icon}
        </div>
        <h1
          style={{
            color: "#fff",
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 16,
            lineHeight: 1.3,
          }}
        >
          {current.title}
        </h1>
        <p
          style={{
            color: "#A0AEC0",
            fontSize: 16,
            lineHeight: 1.6,
            maxWidth: 300,
          }}
        >
          {current.body}
        </p>
      </div>

      {/* Bottom */}
      <div style={{ padding: "0 24px 48px" }}>
        {/* Dots */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginBottom: 24,
          }}
        >
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background:
                  i === step ? "#E8680A" : "rgba(255,255,255,0.25)",
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>

        <button
          className="btn-primary"
          onClick={handleNext}
          disabled={loading}
          style={{ fontSize: 16 }}
        >
          {loading ? <span className="spinner" /> : null}
          {loading ? "Preparando..." : current.action}
        </button>

        {step < STEPS.length - 1 && (
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              marginTop: 12,
              background: "none",
              border: "none",
              color: "#A0AEC0",
              fontSize: 14,
              cursor: "pointer",
              width: "100%",
              textAlign: "center",
              padding: "8px 0",
            }}
          >
            Saltar
          </button>
        )}
      </div>
    </div>
  );
}
