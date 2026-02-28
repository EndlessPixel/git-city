import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

const VALID_EVENTS = new Set(["impression", "click", "cta_click"]);

async function hashIP(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const { ok } = rateLimit(`ad:${ip}`, 120, 60_000);
  if (!ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: {
    ad_id?: string;
    event_type?: string;
    event_types?: string[];
    github_login?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { ad_id, github_login } = body;
  if (!ad_id || typeof ad_id !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Support both single event_type and batch event_types[]
  const types: string[] = [];
  if (body.event_type && VALID_EVENTS.has(body.event_type)) {
    types.push(body.event_type);
  }
  if (Array.isArray(body.event_types)) {
    for (const t of body.event_types) {
      if (typeof t === "string" && VALID_EVENTS.has(t) && !types.includes(t)) {
        types.push(t);
      }
    }
  }

  if (types.length === 0) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  const ipHash = await hashIP(ip);
  const userAgent = request.headers.get("user-agent")?.slice(0, 256) ?? null;
  const login = typeof github_login === "string" ? github_login.slice(0, 39).toLowerCase() : null;

  const sb = getSupabaseAdmin();
  const rows = types.map((event_type) => ({
    ad_id,
    event_type,
    ip_hash: ipHash,
    user_agent: userAgent,
    github_login: login,
  }));

  await sb.from("sky_ad_events").insert(rows);

  return NextResponse.json({ ok: true }, { status: 201 });
}
