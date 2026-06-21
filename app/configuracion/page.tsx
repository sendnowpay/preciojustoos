"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/database";

const PLAN_INFO = {
  free_trial: { label: "Prueba Gratuita", color: "#718096", bg: "#EDF2F7" },
  basico: { label: "Básico • ARS 8.900/mes", color: "#2C5282", bg: "#BEE3F8" },
  estandar: { label: "Estándar • ARS 19.900/mes", color: "#2D7D46", bg: "#C6F6D5" },
  pro: { label: "Pro • ARS 38.500/mes", color: "#975A16", bg: "#FEFCBF" },
};

const BUSINESS_TYPES = [
  { value: "kiosco", label: "🏪 Kiosco / Almacén" },
  { value: "restaurante", label: "🍽️ Restaurante / Bar" },
  { value: "petshop", label: "🐾 Pet Shop" },
  { value: "mercado", label: "🛒 Mercado / Mini-Super" },
  { value: "bodega", label: "🍷 Bodega / Venta Directa" },
  { value: "otro", label: "🏢 Otro" },
];

export default function ConfiguracionPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("kiosco");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadProfile = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      setProfile(data);
      setBusinessName(data.business_name);
      setBusinessType(data.business_type);
      setPhone(data.phone || "");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from("profiles").update({
      business_name: businessName,
      business_type: businessType as "kiosco",
      phone: phone || null,
    }).eq("id", user.id);
    showToast("Cambios guardados");
    setSaving(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  const planKey = (profile?.plan || "free_trial") as keyof typeof PLAN_INFO;
  const planInfo = PLAN_INFO[planKey];

  return (
    <div style={{ paddingBottom: "calc(var(--bottom-nav-h) + 16px)", background: "#F4F5F7", minHeight: "100dvh" }}>
      {toast && (
        <div className="toast-container">
          <div className="toast success">✓ {toast}</div>
        </div>
      )}

      <div style={{ background: "#1A2A4A", padding: "48px 16px 20px" }}>
        <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Configuración</h1>
        <p style={{ color: "#A0AEC0", fontSize: 13 }}>
          {loading ? "Cargando..." : profile?.business_name}
        </p>
      </div>

      {!loading && (
        <div style={{ padding: "16px" }}>
          {/* Plan badge */}
          <div className="card" style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 12, color: "#718096", marginBottom: 4 }}>Plan actual</p>
              <span
                className="badge"
                style={{ background: planInfo.bg, color: planInfo.color, fontSize: 13, padding: "4px 12px" }}
              >
                {planInfo.label}
              </span>
            </div>
            <a
              href="/suscripcion"
              style={{
                background: "#E8680A", color: "#fff",
                padding: "8px 14px", borderRadius: 8,
                fontSize: 12, fontWeight: 700, textDecoration: "none",
              }}
            >
              {profile?.plan === "free_trial" ? "Suscribirse" : "Cambiar plan"}
            </a>
          </div>

          {/* Business info */}
          <form onSubmit={handleSave}>
            <div className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A", marginBottom: 14 }}>Mi negocio</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="label">Nombre del negocio</label>
                  <input
                    type="text"
                    className="input-field"
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
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">WhatsApp del negocio</label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="+54 9 11 1234-5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 16 }}>
                {saving ? <span className="spinner" /> : null}
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>

          {/* Quick links */}
          <div className="card" style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
            {[
              { href: "/repricing", icon: "📈", label: "Actualizar precios masivo" },
              { href: "/csv-import", icon: "📋", label: "Importar inventario CSV" },
              { href: "/suscripcion", icon: "💳", label: "Gestionar suscripción" },
            ].map((item, i, arr) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  borderBottom: i < arr.length - 1 ? "1px solid #F0F4F8" : "none",
                  textDecoration: "none",
                  color: "#1A2A4A",
                }}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{item.label}</span>
                <span style={{ marginLeft: "auto", color: "#A0AEC0", fontSize: 16 }}>›</span>
              </a>
            ))}
          </div>

          {/* Mercado Pago status */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 22 }}>💳</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1A2A4A" }}>Mercado Pago</p>
                  <p style={{ fontSize: 12, color: "#718096" }}>
                    {profile?.mp_user_id ? "✓ Conectado" : "No conectado"}
                  </p>
                </div>
              </div>
              <a
                href="/suscripcion"
                style={{
                  background: profile?.mp_user_id ? "#C6F6D5" : "#FFF5EE",
                  color: profile?.mp_user_id ? "#2D7D46" : "#E8680A",
                  padding: "6px 12px", borderRadius: 8,
                  fontSize: 12, fontWeight: 700, textDecoration: "none",
                }}
              >
                {profile?.mp_user_id ? "Configurar" : "Conectar"}
              </a>
            </div>
          </div>

          {/* App info */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#A0AEC0" }}>Precio Justo OS v1.0</p>
            <p style={{ fontSize: 11, color: "#CBD5E0", marginTop: 2 }}>
              preciojustoos.com • soporte@preciojustoos.com
            </p>
          </div>

          <button
            onClick={handleLogout}
            style={{
              width: "100%", padding: "12px",
              border: "1.5px solid #E53E3E",
              borderRadius: 10, background: "none",
              color: "#E53E3E", fontSize: 14, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
