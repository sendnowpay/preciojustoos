"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";

interface CSVRow {
  name: string;
  sku?: string;
  category?: string;
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
  stock_alert_threshold?: number;
}

export default function CsvImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file, "utf-8");
  }

  function parseCSV(text: string) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) { setErrors(["El archivo está vacío o sin datos"]); return; }

    const headers = lines[0].toLowerCase().split(/[,;]/).map((h) => h.trim().replace(/['"]/g, ""));
    const errs: string[] = [];
    const parsed: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(/[,;]/).map((v) => v.trim().replace(/['"]/g, ""));
      const get = (key: string) => vals[headers.indexOf(key)] || "";

      const name = get("nombre") || get("name") || get("producto");
      const salePrice = parseFloat(get("precio_venta") || get("precio") || get("sale_price") || "0");

      if (!name) { errs.push(`Fila ${i + 1}: falta nombre`); continue; }
      if (salePrice <= 0) { errs.push(`Fila ${i + 1}: precio de venta inválido`); continue; }

      parsed.push({
        name,
        sku: get("sku") || get("codigo") || undefined,
        category: get("categoria") || get("category") || undefined,
        cost_price: parseFloat(get("costo") || get("cost_price") || get("precio_costo") || "0"),
        sale_price: salePrice,
        stock_quantity: parseInt(get("stock") || get("cantidad") || get("stock_quantity") || "0"),
        stock_alert_threshold: parseInt(get("alerta") || get("stock_alert") || "5"),
      });
    }

    setErrors(errs);
    setRows(parsed);
    setDone(false);
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImporting(false); return; }

    // Insert in batches of 50
    const BATCH = 50;
    let imported = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH).map((r) => ({
        ...r,
        user_id: user.id,
        is_active: true,
        stock_alert_threshold: r.stock_alert_threshold || 5,
      }));
      const { error } = await supabase.from("products").insert(batch);
      if (!error) imported += batch.length;
    }

    setToast(`✓ ${imported} productos importados al catálogo`);
    setTimeout(() => setToast(null), 4000);
    setDone(true);
    setImporting(false);
  }

  return (
    <div style={{ paddingBottom: "calc(var(--bottom-nav-h) + 16px)", background: "#F4F5F7", minHeight: "100dvh" }}>
      {toast && (
        <div className="toast-container">
          <div className="toast success">✓ {toast}</div>
        </div>
      )}

      <div className="page-header">
        <button onClick={() => router.back()} style={{ color: "#A0AEC0", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1>Importar Inventario</h1>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Template download */}
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A", marginBottom: 8 }}>Paso 1: Descargá la plantilla</h2>
          <p style={{ fontSize: 13, color: "#718096", marginBottom: 12, lineHeight: 1.5 }}>
            Tu archivo CSV debe tener las siguientes columnas (podés usar punto y coma o coma como separador):
          </p>
          <div style={{ background: "#F0F4F8", borderRadius: 8, padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "#2D3748", overflowX: "auto", whiteSpace: "nowrap", marginBottom: 12 }}>
            nombre, sku, categoria, costo, precio_venta, stock, alerta
          </div>
          <button
            onClick={() => {
              const csv = "nombre;sku;categoria;costo;precio_venta;stock;alerta\n" +
                "Coca Cola 2.25L;COC225;Bebidas;1200;2200;24;5\n" +
                "Galletitas Oreo;ORE100;Golosinas;450;950;48;10\n" +
                "Papel Higiénico;PAP001;Limpieza;800;1500;20;6";
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "plantilla_pjo.csv";
              a.click();
            }}
            className="btn-secondary"
            style={{ fontSize: 13 }}
          >
            📥 Descargar plantilla CSV
          </button>
        </div>

        {/* Upload */}
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A", marginBottom: 12 }}>Paso 2: Subí tu archivo</h2>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFile}
            style={{ display: "none" }}
          />
          <button
            className="btn-secondary"
            onClick={() => fileRef.current?.click()}
            style={{ fontSize: 14 }}
          >
            📁 Elegir archivo CSV
          </button>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="card" style={{ marginBottom: 12, background: "#FFF5F5" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#C53030", marginBottom: 8 }}>
              {errors.length} advertencias:
            </p>
            {errors.slice(0, 5).map((e, i) => (
              <p key={i} style={{ fontSize: 12, color: "#C53030", marginBottom: 4 }}>• {e}</p>
            ))}
            {errors.length > 5 && (
              <p style={{ fontSize: 12, color: "#C53030" }}>...y {errors.length - 5} más</p>
            )}
          </div>
        )}

        {/* Preview */}
        {rows.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1A2A4A" }}>
                Vista previa ({rows.length} productos)
              </h2>
              <span className="badge badge-blue">{rows.length} filas</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ fontSize: 12, width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Nombre", "Cat.", "Costo", "Venta", "Stock"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "4px 6px", color: "#718096", fontWeight: 600, borderBottom: "1px solid #E2E8F0" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F0F4F8" }}>
                      <td style={{ padding: "6px 6px", color: "#1A2A4A", fontWeight: 500, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</td>
                      <td style={{ padding: "6px 6px", color: "#718096" }}>{r.category || "—"}</td>
                      <td style={{ padding: "6px 6px", color: "#718096" }}>${r.cost_price.toLocaleString("es-AR")}</td>
                      <td style={{ padding: "6px 6px", color: "#2D7D46", fontWeight: 700 }}>${r.sale_price.toLocaleString("es-AR")}</td>
                      <td style={{ padding: "6px 6px", color: "#718096" }}>{r.stock_quantity}</td>
                    </tr>
                  ))}
                  {rows.length > 10 && (
                    <tr>
                      <td colSpan={5} style={{ padding: "8px 6px", color: "#A0AEC0", fontSize: 11, textAlign: "center" }}>
                        +{rows.length - 10} más...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rows.length > 0 && !done && (
          <button
            className="btn-primary"
            onClick={handleImport}
            disabled={importing}
            style={{ fontSize: 15 }}
          >
            {importing ? <span className="spinner" /> : "📋"}
            {importing ? `Importando...` : `Importar ${rows.length} productos`}
          </button>
        )}

        {done && (
          <button
            className="btn-primary"
            onClick={() => router.push("/catalogo")}
            style={{ fontSize: 15 }}
          >
            Ver catálogo →
          </button>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
