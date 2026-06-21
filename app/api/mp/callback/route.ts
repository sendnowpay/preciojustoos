import { NextResponse } from "next/server";

const PLAN_MAP: Record<string, string> = {
  basico: "basico",
  estandar: "estandar",
  pro: "pro",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user");
  const plan = searchParams.get("plan");
  const preapprovalId = searchParams.get("preapproval_id");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://preciojustoos.com";

  if (!userId || !plan) {
    return NextResponse.redirect(`${appUrl}/suscripcion?error=missing_params`);
  }

  if (preapprovalId && PLAN_MAP[plan]) {
    // Direct Supabase REST call with service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          plan: PLAN_MAP[plan],
          mp_subscription_id: preapprovalId,
          plan_started_at: new Date().toISOString(),
        }),
      });
    }
  }

  return NextResponse.redirect(`${appUrl}/dashboard?subscribed=1`);
}

// MP IPN webhook handler
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.type === "preapproval" && body.data?.id) {
      const mpAccessToken = process.env.MP_ACCESS_TOKEN;
      if (!mpAccessToken) return NextResponse.json({ ok: false });

      const res = await fetch(
        `https://api.mercadopago.com/preapproval/${body.data.id}`,
        { headers: { Authorization: `Bearer ${mpAccessToken}` } }
      );
      const preapproval = await res.json();

      if (preapproval.status === "authorized" && preapproval.id) {
        console.log("MP preapproval authorized:", preapproval.id);
      }
    }
  } catch (e) {
    console.error("MP webhook error:", e);
  }
  return NextResponse.json({ ok: true });
}
