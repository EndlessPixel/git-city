import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { FREE_CLAIM_ITEM, grantFreeClaimItem } from "@/lib/items";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const githubLogin = (
    user.user_metadata.user_name ??
    user.user_metadata.preferred_username ??
    ""
  ).toLowerCase();

  if (!githubLogin) {
    return NextResponse.json(
      { error: "No GitHub username" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();

  // Must have claimed their building
  const { data: dev } = await admin
    .from("developers")
    .select("id, claimed, claimed_by")
    .eq("github_login", githubLogin)
    .single();

  if (!dev || !dev.claimed || dev.claimed_by !== user.id) {
    return NextResponse.json(
      { error: "You must claim your building first" },
      { status: 403 }
    );
  }

  const granted = await grantFreeClaimItem(dev.id);

  if (!granted) {
    return NextResponse.json(
      { error: "Already claimed", item_id: FREE_CLAIM_ITEM },
      { status: 409 }
    );
  }

  return NextResponse.json({
    claimed: true,
    item_id: FREE_CLAIM_ITEM,
  });
}
