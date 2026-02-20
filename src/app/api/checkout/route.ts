import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createCheckoutSession } from "@/lib/stripe";
import { createPixQrCode } from "@/lib/abacatepay";

// Defense-in-depth: per-user rate limit IN ADDITION to the IP-based
// middleware rate limit.  This one is keyed by Supabase user ID so it
// catches authenticated abuse even when requests come from different IPs.
// Note: in-memory – resets on deploy / cold-start.  Acceptable because
// the middleware already provides the primary protection layer.
const lastCheckout = new Map<string, number>();

export async function POST(request: Request) {
  // Auth required
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Rate limit: 1 checkout per 10 seconds per user
  const now = Date.now();
  const last = lastCheckout.get(user.id);
  if (last && now - last < 10_000) {
    return NextResponse.json({ error: "Too fast. Wait a few seconds." }, { status: 429 });
  }
  lastCheckout.set(user.id, now);

  const githubLogin = (
    user.user_metadata?.user_name ??
    user.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();

  if (!githubLogin) {
    return NextResponse.json({ error: "No GitHub login found" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Validate user has claimed building
  const { data: dev } = await sb
    .from("developers")
    .select("id, claimed, claimed_by")
    .eq("github_login", githubLogin)
    .single();

  if (!dev || !dev.claimed) {
    return NextResponse.json(
      { error: "You must claim your building first" },
      { status: 403 }
    );
  }

  // Validate claimed_by matches user
  if (dev.claimed_by !== user.id) {
    return NextResponse.json(
      { error: "This building is not yours" },
      { status: 403 }
    );
  }

  // Parse body
  let body: { item_id: string; provider: "stripe" | "abacatepay"; currency?: "usd" | "brl" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { item_id, provider, currency } = body;

  if (!item_id || !provider || !["stripe", "abacatepay"].includes(provider)) {
    return NextResponse.json({ error: "Invalid item_id or provider" }, { status: 400 });
  }

  // Validate item exists and is active
  const { data: item } = await sb
    .from("items")
    .select("*")
    .eq("id", item_id)
    .eq("is_active", true)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Item not found or inactive" }, { status: 404 });
  }

  // Billboard allows multiple purchases (Times Square style)
  if (item_id === "billboard") {
    // Count existing completed billboard purchases
    const { count: billboardCount } = await sb
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("developer_id", dev.id)
      .eq("item_id", "billboard")
      .eq("status", "completed");

    // Fetch building dimensions to calculate max slots
    const { data: devFull } = await sb
      .from("developers")
      .select("contributions, public_repos, rank")
      .eq("id", dev.id)
      .single();

    if (devFull) {
      // Replicate dimension calculation from github.ts
      const repoFactor = Math.min(1, devFull.public_repos / 100);
      const baseW = 14 + repoFactor * 16;
      const w = Math.round(baseW + 5); // approximate mid-seed
      const d = Math.round(12 + 10);   // approximate mid-seed
      // Height: simplified — use rank-based estimate
      const h = Math.max(30, 12 + Math.sqrt(devFull.contributions) * 3);

      const minBillArea = 10 * 8;
      const totalFaceArea = 2 * (w + d) * h;
      const maxSlots = Math.max(1, Math.floor(totalFaceArea / (minBillArea * 6)));

      if ((billboardCount ?? 0) >= maxSlots) {
        return NextResponse.json(
          { error: `Max billboard slots reached (${maxSlots})` },
          { status: 409 }
        );
      }
    }
  } else {
    // Non-billboard items: check if already owned
    const { data: existingPurchase } = await sb
      .from("purchases")
      .select("id")
      .eq("developer_id", dev.id)
      .eq("item_id", item_id)
      .eq("status", "completed")
      .maybeSingle();

    if (existingPurchase) {
      return NextResponse.json({ error: "Already owned" }, { status: 409 });
    }
  }

  // Check for existing pending purchase (prevent double-click)
  const { data: pendingPurchase } = await sb
    .from("purchases")
    .select("id")
    .eq("developer_id", dev.id)
    .eq("item_id", item_id)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingPurchase) {
    // Delete stale pending purchase to allow retry
    await sb.from("purchases").delete().eq("id", pendingPurchase.id);
  }

  try {
    if (provider === "stripe") {
      const useBrl = currency === "brl";
      const amountCents = useBrl ? item.price_brl_cents : item.price_usd_cents;
      const cur = useBrl ? "brl" : "usd";

      // Create pending purchase
      const { data: purchase, error: purchaseError } = await sb
        .from("purchases")
        .insert({
          developer_id: dev.id,
          item_id,
          provider: "stripe",
          amount_cents: amountCents,
          currency: cur,
          status: "pending",
        })
        .select("id")
        .single();

      if (purchaseError) {
        return NextResponse.json({ error: "Failed to create purchase" }, { status: 500 });
      }

      const { url } = await createCheckoutSession(item_id, dev.id, githubLogin, cur, user.email);
      return NextResponse.json({ url, purchase_id: purchase.id });
    } else {
      // AbacatePay
      const { data: purchase, error: purchaseError } = await sb
        .from("purchases")
        .insert({
          developer_id: dev.id,
          item_id,
          provider: "abacatepay",
          amount_cents: item.price_brl_cents,
          currency: "brl",
          status: "pending",
        })
        .select("id")
        .single();

      if (purchaseError) {
        return NextResponse.json({ error: "Failed to create purchase" }, { status: 500 });
      }

      const { brCode, brCodeBase64, pixId } = await createPixQrCode(item_id, dev.id, githubLogin);

      // Save PIX ID as provider_tx_id
      await sb
        .from("purchases")
        .update({ provider_tx_id: pixId })
        .eq("id", purchase.id);

      return NextResponse.json({ brCode, brCodeBase64, purchase_id: purchase.id });
    }
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
