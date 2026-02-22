import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { checkAchievements } from "@/lib/achievements";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const githubLogin = (
    data.user.user_metadata.user_name ??
    data.user.user_metadata.preferred_username ??
    ""
  ).toLowerCase();

  const admin = getSupabaseAdmin();

  if (githubLogin) {
    // Auto-claim: if building exists and not yet claimed, claim it
    await admin
      .from("developers")
      .update({
        claimed: true,
        claimed_by: data.user.id,
        claimed_at: new Date().toISOString(),
        fetch_priority: 1,
      })
      .eq("github_login", githubLogin)
      .eq("claimed", false);

    // Fetch dev record for achievement check + referral processing
    // Uses try-catch to avoid breaking login if v2 columns/tables don't exist yet
    try {
      const { data: dev } = await admin
        .from("developers")
        .select("id, contributions, public_repos, total_stars, kudos_count, referral_count, referred_by")
        .eq("github_login", githubLogin)
        .single();

      if (dev) {
        // Process referral (from ?ref= param forwarded by client)
        const ref = searchParams.get("ref");
        if (ref && ref !== githubLogin && !dev.referred_by) {
          const { data: referrer } = await admin
            .from("developers")
            .select("id, github_login")
            .eq("github_login", ref.toLowerCase())
            .single();

          if (referrer) {
            await admin
              .from("developers")
              .update({ referred_by: referrer.github_login })
              .eq("id", dev.id);

            await admin.rpc("increment_referral_count", { referrer_dev_id: referrer.id });

            await admin.from("activity_feed").insert({
              event_type: "referral",
              actor_id: referrer.id,
              target_id: dev.id,
              metadata: { referrer_login: referrer.github_login, referred_login: githubLogin },
            });

            // Check referral achievements for the referrer
            const { data: referrerFull } = await admin
              .from("developers")
              .select("referral_count, kudos_count, contributions, public_repos, total_stars")
              .eq("id", referrer.id)
              .single();

            if (referrerFull) {
              const giftsSent = await countGifts(admin, referrer.id, "sent");
              const giftsReceived = await countGifts(admin, referrer.id, "received");
              await checkAchievements(referrer.id, {
                contributions: referrerFull.contributions,
                public_repos: referrerFull.public_repos,
                total_stars: referrerFull.total_stars,
                referral_count: referrerFull.referral_count,
                kudos_count: referrerFull.kudos_count,
                gifts_sent: giftsSent,
                gifts_received: giftsReceived,
              }, referrer.github_login);
            }
          }
        }

        // Run achievement check for this developer
        const giftsSent = await countGifts(admin, dev.id, "sent");
        const giftsReceived = await countGifts(admin, dev.id, "received");
        await checkAchievements(dev.id, {
          contributions: dev.contributions,
          public_repos: dev.public_repos,
          total_stars: dev.total_stars,
          referral_count: dev.referral_count ?? 0,
          kudos_count: dev.kudos_count ?? 0,
          gifts_sent: giftsSent,
          gifts_received: giftsReceived,
        }, githubLogin);
      }
    } catch {
      // Silently skip v2 features if tables/columns don't exist yet
      console.warn("Auth callback: skipping v2 achievement/referral check (migration may not have run)");
    }
  }

  // Support ?next= param for post-login redirect (e.g. /shop)
  const next = searchParams.get("next");
  if (next === "/shop" && githubLogin) {
    const { data: dev } = await admin
      .from("developers")
      .select("github_login")
      .eq("github_login", githubLogin)
      .single();

    if (!dev) {
      return NextResponse.redirect(`${origin}/?user=${githubLogin}`);
    }

    return NextResponse.redirect(`${origin}/shop/${githubLogin}`);
  }

  return NextResponse.redirect(`${origin}/?user=${githubLogin}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countGifts(admin: any, devId: number, direction: "sent" | "received"): Promise<number> {
  const column = direction === "sent" ? "developer_id" : "gifted_to";
  const { count } = await admin
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq(column, devId)
    .eq("status", "completed")
    .not("gifted_to", "is", null);
  return count ?? 0;
}
