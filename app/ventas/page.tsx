"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
import type { Product } from "@/types/database";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), { ssr: false });

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

interface CartLine {
  product: Product;
  qty: number;
  unitPrice: number;
}

const PAYMENT_METHODS = [
  { value: "efectivo", label: "💵 Efectivo" },
  { value: "mp_qr", label: "📱 MP QR" },
  { value: "debito", label: "💳 Débito" },
  { value: "credito", label: "💳 Crédito" },
  { value: "otro", label: "🔄 Otro" },
];

type Screen = "cart" | "payment" | "receipt";

export default function VentasPage() {
  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Cart
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [notes, setNotes] = useState("");

  // UI state
  const [screen, setScreen] = useState<Screen>("cart");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completedTxId, setCompletedTxId] = useState<string | null>(null);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [customerPhone, setCustomerPhone] = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [profileName, setProfileName] = useState("Mi Negocio");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load products + profile on mount
  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: prods }, { data: profile }] = await Promise.all([
      supabase.from("products").select("*").eq("user_id", user.id).eq("is_active", true).order("name"),
      supabase.from("profiles").select("business_name").eq("id", user.id).single(),
    ]);
    if (prods) setProducts(prods);
    if (profile) setProfileName(profile.business_name);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── SEARCH / FILTER ─────────────────────────────────────
  const filtered = search.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.sku || "").toLowerCase().includes(search.toLowerCase()) ||
          (p.barcode || "").includes(search)
      ).slice(0, 8)
    : [];

  // ─── BARCODE SCAN ─────────────────────────────────────────
  function handleScan(barcode: string) {
    setScanning(false);
    const match = products.find((p) => p.barcode === barcode || p.sku === barcode);
    if (match) {
      addToCart(match);
      showToast(`✓ ${match.name} agregado`, "success");
    } else {
      setSearch(barcode);
      setShowResults(true);
      showToast("Código no encontrado — buscá el producto", "error");
    }
  }

  // ─── CART OPERATIONS ─────────────────────────────────────
  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.findIndex((l) => l.product.id === product.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], qty: next[existing].qty + 1 };
        return next;
      }
      return [...prev, { product, qty: 1, unitPrice: product.sale_price }];
    });
    setSearch("");
    setShowResults(false);
    searchRef.current?.focus();
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.product.id === productId ? { ...l, qty: Math.max(0, l.qty + delta) } : l
        )
        .filter((l) => l.qty > 0)
    );
  }

  function setQty(productId: string, val: number) {
    if (val <= 0) {
      setCart((prev) => prev.filter((l) => l.product.id !== productId));
    } else {
      setCart((prev) =>
        prev.map((l) => (l.product.id === productId ? { ...l, qty: val } : l))
      );
    }
  }

  function setPrice(productId: string, val: number) {
    setCart((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, unitPrice: val } : l))
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  const cartTotal = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const cartMargin = cart.reduce(
    (s, l) => s + l.qty * (l.unitPrice - l.product.cost_price),
    0
  );
  const cartMarginPct = cartTotal > 0 ? (cartMargin / cartTotal) * 100 : 0;

  // ─── CONFIRM SALE ─────────────────────────────────────────
  async function confirmSale() {
    if (cart.length === 0) return;
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const lines = cart.map((l) => ({
      product_id: l.product.id,
      product_name: l.product.name,
      qty: l.qty,
      unit_price: l.unitPrice,
      cost_price: l.product.cost_price,
    }));

    const { data, error } = await supabase.rpc("complete_transaction", {
      p_user_id: user.id,
      p_payment_method: paymentMethod,
      p_notes: notes || null,
      p_customer_phone: customerPhone || null,
      p_lines: lines,
    });

    if (error) {
      showToast("Error al guardar: " + error.message, "error");
      setLoading(false);
      return;
    }

    setCompletedTxId(data as string);
    setCompletedTotal(cartTotal);
    setScreen("receipt");
    setLoading(false);
  }

  function resetCart() {
    setCart([]);
    setPaymentMethod("efectivo");
    setNotes("");
    setCustomerPhone("");
    setSearch("");
    setCompletedTxId(null);
    setCompletedTotal(0);
    setScreen("cart");
    setShowPhoneInput(false);
    loadData(); // refresh stock
  }

  // ─── WHATSAPP RECEIPT ─────────────────────────────────────
  function sendWhatsAppReceipt(phone?: string) {
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    const pmLabels: Record<string, string> = {
      efectivo: "Efectivo",
      mp_qr: "Mercado Pago QR",
      debito: "Debito",
      credito: "Credito",
      otro: "Otro",
    };

    const lines = cart
      .map((l) => {
        const name = l.product.name.substring(0, 20).padEnd(20);
        const total = fmt(l.qty * l.unitPrice);
        return `  ${name}  x${l.qty}   ${total}`;
      })
      .join("\n");

    const text = [
      `*Precio Justo OS*`,
      `------------------------`,
      `*${profileName}*`,
      `Fecha: ${dateStr} ${timeStr}`,
      ``,
      `*DETALLE:*`,
      lines,
      `------------------------`,
      `*TOTAL: ${fmt(completedTotal)}*`,
      `Pago: ${pmLabels[paymentMethod] || paymentMethod}`,
      `------------------------`,
      `Gracias por tu compra!`,
    ].join("\n");

    const target = phone || customerPhone;
    // wa.me accepts number without spaces or +
    const cleaned = target ? target.replace(/\D/g, "") : "";
    const url = cleaned
      ? `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, "_blank");

    // Mark receipt sent
    if (completedTxId) {
      const supabase = createClient();
      supabase.from("transactions").update({ receipt_sent: true }).eq("id", completedTxId);
    }
  }

  // ─── RENDER: RECEIPT SCREEN ───────────────────────────────
  if (screen === "receipt") {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#F4F5F7",
          paddingBottom: "calc(var(--bottom-nav-h) + 16px)",
        }}
      >
        {toast && (
          <div className="toast-container">
            <div className={`toast ${toast.type}`}>{toast.msg}</div>
          </div>
        )}

        {/* Success header */}
        <div
          style={{
            background: "#2D7D46",
            padding: "48px 20px 28px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              fontSize: 32,
            }}
          >
            ✓
          </div>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>Venta confirmada</p>
          <p style={{ color: "#fff", fontSize: 32, fontWeight: 800, marginTop: 4 }}>
            {fmt(completedTotal)}
          </p>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4 }}>
            {PAYMENT_METHODS.find((p) => p.value === paymentMethod)?.label} •{" "}
            {cart.length} item{cart.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div style={{ padding: "16px" }}>
          {/* Sale summary */}
          <div className="card" style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#718096", marginBottom: 10 }}>
              RESUMEN
            </p>
            {cart.map((l) => (
              <div
                key={l.product.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: "1px solid #F0F4F8",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#1A2A4A" }}>
                  {l.product.name} x{l.qty}
                </span>
                <span style={{ fontWeight: 600, color: "#1A2A4A" }}>
                  {fmt(l.qty * l.unitPrice)}
                </span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                paddingTop: 8,
              }}
            >
              <span style={{ fontSize: 13, color: "#718096" }}>Margen</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#2D7D46" }}>
                {fmt(cartMargin)} ({cartMarginPct.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* WhatsApp receipt */}
          <div className="card" style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#1A2A4A", marginBottom: 12 }}>
              Enviar recibo
            </p>

            {!showPhoneInput ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={() => sendWhatsAppReceipt()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#25D366",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "13px 16px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Enviar por WhatsApp
                </button>
                <button
                  onClick={() => setShowPhoneInput(true)}
                  style={{
                    background: "#fff",
                    border: "1.5px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "11px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#4A5568",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  📱 Enviar a número específico
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label className="label">Número del cliente (WhatsApp)</label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="+54 9 11 1234-5678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  inputMode="tel"
                  autoFocus
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    onClick={() => sendWhatsAppReceipt(customerPhone)}
                    style={{
                      background: "#25D366",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: "12px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Enviar
                  </button>
                  <button
                    onClick={() => setShowPhoneInput(false)}
                    className="btn-secondary"
                    style={{ padding: "12px" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <button
            className="btn-primary"
            onClick={resetCart}
            style={{ fontSize: 15, marginBottom: 10 }}
          >
            ➕ Nueva venta
          </button>
        </div>
      </div>
    );
  }

  // ─── RENDER: CART SCREEN ──────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#F4F5F7",
        paddingBottom: "calc(var(--bottom-nav-h) + 16px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {scanning && (
        <BarcodeScanner onScan={handleScan} onClose={() => setScanning(false)} />
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {/* Header — search bar + cart total */}
      <div style={{ background: "#1A2A4A", padding: "48px 16px 12px", flexShrink: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <h1 style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>
            Vender
          </h1>
          {cart.length > 0 && (
            <p style={{ color: "#E8680A", fontSize: 20, fontWeight: 800 }}>
              {fmt(cartTotal)}
            </p>
          )}
        </div>

        {/* Search + scan row */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar producto o escanear..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                fontSize: 14,
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                outline: "none",
              }}
            />
          </div>
          <button
            onClick={() => setScanning(true)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "#E8680A",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            title="Escanear código de barras"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4" />
              <line x1="7" y1="8" x2="7" y2="16" />
              <line x1="10" y1="8" x2="10" y2="16" />
              <line x1="13" y1="8" x2="13" y2="12" />
              <line x1="16" y1="8" x2="16" y2="16" />
            </svg>
          </button>
        </div>

        {/* Search results dropdown */}
        {showResults && filtered.length > 0 && (
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              marginTop: 6,
              overflow: "hidden",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            {filtered.map((p) => (
              <button
                key={p.id}
                onMouseDown={() => addToCart(p)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  padding: "10px 14px",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid #F0F4F8",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1A2A4A" }}>{p.name}</p>
                  <p style={{ fontSize: 11, color: "#718096" }}>
                    Stock: {p.stock_quantity}
                    {p.stock_quantity <= p.stock_alert_threshold && p.stock_quantity > 0
                      ? " ⚠️"
                      : p.stock_quantity === 0
                      ? " ❌ Sin stock"
                      : ""}
                    {p.sku ? ` • ${p.sku}` : ""}
                  </p>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#E8680A" }}>
                  {fmt(p.sale_price)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart lines */}
      <div style={{ flex: 1, padding: "12px 16px", overflowY: "auto" }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>🛒</p>
            <p style={{ color: "#718096", fontSize: 15 }}>El carrito está vacío</p>
            <p style={{ color: "#A0AEC0", fontSize: 13, marginTop: 6 }}>
              Buscá un producto o escaneá un código de barras
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 12 }}>
            {cart.map((line, i) => (
              <div
                key={line.product.id}
                style={{
                  padding: "10px 14px",
                  borderBottom: i < cart.length - 1 ? "1px solid #F0F4F8" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1A2A4A",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {line.product.name}
                    </p>
                    <p style={{ fontSize: 11, color: "#718096", marginTop: 1 }}>
                      {fmt(line.unitPrice)} c/u •{" "}
                      <span style={{ color: "#2D7D46", fontWeight: 600 }}>
                        mg{" "}
                        {(
                          ((line.unitPrice - line.product.cost_price) / Math.max(line.unitPrice, 1)) *
                          100
                        ).toFixed(0)}
                        %
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(line.product.id)}
                    style={{
                      color: "#E53E3E",
                      background: "none",
                      border: "none",
                      fontSize: 18,
                      cursor: "pointer",
                      padding: "0 4px",
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* Qty controls + line total */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      onClick={() => updateQty(line.product.id, -1)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "#F0F4F8",
                        border: "none",
                        fontSize: 18,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#1A2A4A",
                      }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={line.qty}
                      onChange={(e) => setQty(line.product.id, parseInt(e.target.value) || 0)}
                      inputMode="numeric"
                      style={{
                        width: 44,
                        textAlign: "center",
                        padding: "6px 4px",
                        border: "1.5px solid #E2E8F0",
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#1A2A4A",
                      }}
                    />
                    <button
                      onClick={() => updateQty(line.product.id, 1)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "#E8680A",
                        border: "none",
                        fontSize: 18,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                      }}
                    >
                      +
                    </button>

                    {/* Price override */}
                    <div style={{ marginLeft: 4 }}>
                      <input
                        type="number"
                        value={line.unitPrice}
                        onChange={(e) =>
                          setPrice(line.product.id, parseFloat(e.target.value) || 0)
                        }
                        inputMode="decimal"
                        style={{
                          width: 72,
                          padding: "6px 6px",
                          border: "1.5px solid #E2E8F0",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "#4A5568",
                          textAlign: "right",
                        }}
                      />
                    </div>
                  </div>

                  <p style={{ fontSize: 15, fontWeight: 700, color: "#1A2A4A" }}>
                    {fmt(line.qty * line.unitPrice)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {cart.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              className="input-field"
              placeholder="Nota (mesa, cliente, pedido...)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ background: "#fff" }}
            />
          </div>
        )}
      </div>

      {/* Bottom — payment + confirm */}
      {cart.length > 0 && (
        <div
          style={{
            background: "#fff",
            borderTop: "1px solid #E2E8F0",
            padding: "12px 16px calc(var(--bottom-nav-h) + 12px)",
            flexShrink: 0,
          }}
        >
          {/* Payment method pills */}
          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              paddingBottom: 10,
            }}
          >
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.value}
                onClick={() => setPaymentMethod(pm.value)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 20,
                  border:
                    paymentMethod === pm.value
                      ? "2px solid #E8680A"
                      : "1.5px solid #E2E8F0",
                  background: paymentMethod === pm.value ? "#FFF5EE" : "#fff",
                  color: paymentMethod === pm.value ? "#E8680A" : "#4A5568",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {pm.label}
              </button>
            ))}
          </div>

          {/* Totals row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div>
              <p style={{ fontSize: 12, color: "#718096" }}>
                {cart.reduce((s, l) => s + l.qty, 0)} items •{" "}
                <span style={{ color: "#2D7D46", fontWeight: 600 }}>
                  mg {cartMarginPct.toFixed(1)}%
                </span>
              </p>
            </div>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#1A2A4A" }}>
              {fmt(cartTotal)}
            </p>
          </div>

          <button
            className="btn-primary"
            onClick={confirmSale}
            disabled={loading || cart.length === 0}
            style={{ fontSize: 16 }}
          >
            {loading ? (
              <span className="spinner" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {loading ? "Procesando..." : `Confirmar • ${fmt(cartTotal)}`}
          </button>
        </div>
      )}
    </div>
  );
}
