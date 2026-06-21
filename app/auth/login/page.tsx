"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email o contraseña incorrectos.");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
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
          padding: "48px 24px 32px",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "#E8680A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            aria-label="Precio Justo OS"
          >
            <circle cx="16" cy="16" r="12" stroke="#fff" strokeWidth="2" />
            <path
              d="M11 16h10M16 11v10"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M10 22l3-3M22 22l-3-3"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>
          Precio Justo OS
        </h1>
        <p style={{ color: "#A0AEC0", fontSize: 13, marginTop: 4 }}>
          Ingresá a tu negocio
        </p>
      </div>

      {/* Form */}
      <div style={{ flex: 1, padding: "32px 20px" }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div
                style={{
                  background: "#FFF5F5",
                  border: "1px solid #FED7D7",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#C53030",
                }}
              >
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 14, color: "#718096" }}>
          ¿No tenés cuenta?{" "}
          <Link
            href="/auth/signup"
            style={{ color: "#E8680A", fontWeight: 600, textDecoration: "none" }}
          >
            Registrate gratis
          </Link>
        </p>
      </div>
    </div>
  );
}
