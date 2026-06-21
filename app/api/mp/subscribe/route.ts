import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PLAN_AMOUNTS: Record<string, number> = {
  basico: 8900,
  estandar: 19900,
  pro: 38500,
};

const PLAN_NAMES: Record<string, string> = {
  basico: "Precio Justo OS Básico",
  estandar: "Precio Justo OS Estándar",
  pro: "Precio Justo OS Pro",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { plan } = await request.json();
  const amount = PLAN_AMOUNTS[plan];

  if (!amount) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }

  const mpAccessToken = process.env.MP_ACCESS_TOKEN;
  if (!mpAccessToken) {
    return NextResponse.json(
      { error: "Mercado Pago no configurado" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://preciojustoos.com";

  try {
    // Create MP Preapproval (recurring subscription)
    const res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${user.id}-${plan}-${Date.now()}`,
      },
      body: JSON.stringify({
        back_url: `${appUrl}/api/mp/callback?user=${user.id}&plan=${plan}`,
        reason: PLAN_NAMES[plan],
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "ARS",
        },
        payer_email: user.email,
        status: "pending",
      }),
    });

    const data = await res.json();

    if (data.init_point) {
      return NextResponse.json({ init_point: data.init_point });
    } else {
      console.error("MP preapproval error:", data);
      return NextResponse.json(
        { error: data.message || "Error al crear suscripción" },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error("MP request failed:", err);
    return NextResponse.json({ error: "Error de red" }, { status: 500 });
  }
}
