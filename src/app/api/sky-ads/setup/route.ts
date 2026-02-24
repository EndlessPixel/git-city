import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

const ALLOWED_LINK = /^(https:\/\/|mailto:)/;

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const { ok } = rateLimit(`setup:${ip}`, 1, 5_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a few seconds." },
      { status: 429 },
    );
  }

  let body: {
    token?: string;
    brand?: string;
    description?: string;
    link?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token } = body;

  if (!token || typeof token !== "string" || token.length < 10) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Verify token matches an existing, active ad
  const { data: ad } = await sb
    .from("sky_ads")
    .select("id, active")
    .eq("tracking_token", token)
    .maybeSingle();

  if (!ad) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  }

  // Build update payload from optional fields
  const update: Record<string, string | null> = {};

  if (body.brand !== undefined) {
    const safeBrand = String(body.brand).slice(0, 60).trim();
    update.brand = safeBrand || null;
  }

  if (body.description !== undefined) {
    const safeDesc = String(body.description).slice(0, 200).trim();
    update.description = safeDesc || null;
  }

  if (body.link !== undefined) {
    const safeLink = String(body.link).trim();
    if (safeLink && !ALLOWED_LINK.test(safeLink)) {
      return NextResponse.json(
        { error: "Link must start with https:// or mailto:" },
        { status: 400 },
      );
    }
    update.link = safeLink || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error: updateError } = await sb
    .from("sky_ads")
    .update(update)
    .eq("id", ad.id);

  if (updateError) {
    console.error("Failed to update sky_ad:", updateError);
    return NextResponse.json({ error: "Failed to update ad" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
