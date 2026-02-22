import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { receiver_login } = await request.json();
  if (!receiver_login || typeof receiver_login !== "string") {
    return NextResponse.json({ error: "Missing receiver_login" }, { status: 400 });
  }

  // Per-user rate limit: 1 req/sec
  const { ok } = rateLimit(`kudos:${user.id}`, 1, 1000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }

  const admin = getSupabaseAdmin();

  const githubLogin = (
    user.user_metadata.user_name ??
    user.user_metadata.preferred_username ??
    ""
  ).toLowerCase();

  // Fetch giver (must have claimed building)
  const { data: giver } = await admin
    .from("developers")
    .select("id, claimed")
    .eq("github_login", githubLogin)
    .single();

  if (!giver || !giver.claimed) {
    return NextResponse.json({ error: "Must claim building first" }, { status: 403 });
  }

  // Fetch receiver
  const { data: receiver } = await admin
    .from("developers")
    .select("id, claimed, github_login")
    .eq("github_login", receiver_login.toLowerCase())
    .single();

  if (!receiver) {
    return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
  }

  // No self-kudos
  if (giver.id === receiver.id) {
    return NextResponse.json({ error: "Cannot give kudos to yourself" }, { status: 400 });
  }

  // Check daily limit (20/day)
  const today = new Date().toISOString().split("T")[0];
  const { count } = await admin
    .from("developer_kudos")
    .select("giver_id", { count: "exact", head: true })
    .eq("giver_id", giver.id)
    .eq("given_date", today);

  if ((count ?? 0) >= 20) {
    return NextResponse.json({ error: "Daily kudos limit reached (20/day)" }, { status: 429 });
  }

  // Insert (ON CONFLICT DO NOTHING via PK constraint)
  const { error: insertError } = await admin
    .from("developer_kudos")
    .insert({
      giver_id: giver.id,
      receiver_id: receiver.id,
      given_date: today,
    });

  // Duplicate key = already given today, treat as success
  if (insertError && !insertError.code?.includes("23505")) {
    return NextResponse.json({ error: "Failed to give kudos" }, { status: 500 });
  }

  // Only increment + feed if the insert actually happened (no conflict)
  if (!insertError) {
    await admin.rpc("increment_kudos_count", { target_dev_id: receiver.id });

    await admin.from("activity_feed").insert({
      event_type: "kudos_given",
      actor_id: giver.id,
      target_id: receiver.id,
      metadata: {
        giver_login: githubLogin,
        receiver_login: receiver.github_login,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
