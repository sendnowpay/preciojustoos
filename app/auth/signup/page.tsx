"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const BUSINESS_TYPES = [
  { value: "kiosco", label: "🏪 Kiosco / Almacén" },
  { value: "restaurante", label: "🍽️ Restaurante / Bar" },
  { value: "petshop", label: "🐾 Pet Shop" },
  { value: "mercado", label: "🛒 Mercado / Mini-Super" },
  { value: "bodega", label: "🍷 Bodega / Venta Directa" },
  { value: "otro", label: "🏢 Otro" },
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("kiosco");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }

    setLoading(true);
    setError("");

    const supabase = createClient();

    // Create auth user
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          business_name: businessName,
          business_type: businessType,
        },
      },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Create profile
      await supabase.from("profiles").insert({
        id: data.user.id,
        business_name: businessName,
        business_type: businessType as "kiosco",
        phone: phone || null,
        plan: "free_trial",
        plan_started_at: new Date().toISOString(),
        onboarding_complete: false,
      });

      router.push("/onboarding");
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#F4F5F7",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#1A2A4A",
          padding: "32px 24px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "#E8680A", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="12" stroke="#fff" strokeWidth="2" />
            <path d="M11 16h10M16 11v10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>
          Crear cuenta
        </h1>
        <p style={{ color: "#A0AEC0", fontSize: 12, marginTop: 4 }}>
          30 días gratis • Sin tarjeta
        </p>

        {/* Progress indicator */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {[1, 2].map((s) => (
            <div
              key={s}
              style={{
                width: s === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: s <= step ? "#E8680A" : "rgba(255,255,255,0.3)",
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>
      </div>

      {/* Form */}
      <div style={{ flex: 1, padding: "24px 20px" }}>
        <div className="card">
          <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {step === 1 ? (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2A4A" }}>
                  Tu acceso
                </h2>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
                <div>
                  <label className="label">Contraseña</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <button type="submit" className="btn-primary">
                  Siguiente →
                </button>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2A4A" }}>
                  Tu negocio
                </h2>
                <div>
                  <label className="label">Nombre del negocio</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej: Kiosco El Trébol"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Tipo de negocio</label>
                  <select
                    className="input-field"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                  >
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">WhatsApp (opcional)</label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="+54 9 11 1234-5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                  />
                </div>

                {error && (
                  <div style={{ background: "#FFF5F5", border: "1px solid #FED7D7", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#C53030" }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setStep(1)}
                >
                  ← Atrás
                </button>
              </>
            )}
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 13, color: "#718096", marginTop: 16 }}>
          ¿Ya tenés cuenta?{" "}
          <Link href="/auth/login" style={{ color: "#E8680A", fontWeight: 600, textDecoration: "none" }}>
            Ingresar
          </Link>
        </p>
      </div>
    </div>
  );
}
