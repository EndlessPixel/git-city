import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const before = searchParams.get("before"); // UUID cursor

  const sb = getSupabaseAdmin();

  let query = sb
    .from("activity_feed")
    .select(`
      id,
      event_type,
      actor_id,
      target_id,
      metadata,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    // Get the created_at of the cursor event to page from there
    const { data: cursor } = await sb
      .from("activity_feed")
      .select("created_at")
      .eq("id", before)
      .single();

    if (cursor) {
      query = query.lt("created_at", cursor.created_at);
    }
  }

  const { data: events } = await query;

  if (!events || events.length === 0) {
    return NextResponse.json(
      { events: [], has_more: false },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  }

  // Collect all actor/target IDs to batch-fetch developer info
  const devIds = new Set<number>();
  for (const e of events) {
    if (e.actor_id) devIds.add(e.actor_id);
    if (e.target_id) devIds.add(e.target_id);
  }

  const devMap: Record<number, { login: string; avatar_url: string | null }> = {};
  if (devIds.size > 0) {
    const { data: devs } = await sb
      .from("developers")
      .select("id, github_login, avatar_url")
      .in("id", Array.from(devIds));

    for (const d of devs ?? []) {
      devMap[d.id] = { login: d.github_login, avatar_url: d.avatar_url };
    }
  }

  // Enrich events
  const enriched = events.map((e) => ({
    ...e,
    actor: e.actor_id ? devMap[e.actor_id] ?? null : null,
    target: e.target_id ? devMap[e.target_id] ?? null : null,
  }));

  return NextResponse.json(
    {
      events: enriched,
      has_more: events.length === limit,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
