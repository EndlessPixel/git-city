import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ userA: string; userB: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userA, userB } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [{ data: devA }, { data: devB }] = await Promise.all([
    supabase
      .from("developers")
      .select("github_login, contributions, total_stars, rank")
      .eq("github_login", userA.toLowerCase())
      .single(),
    supabase
      .from("developers")
      .select("github_login, contributions, total_stars, rank")
      .eq("github_login", userB.toLowerCase())
      .single(),
  ]);

  const title = `@${userA} vs @${userB} - Git City`;

  if (!devA || !devB) {
    return {
      title,
      description: `Compare ${userA} and ${userB} in Git City`,
    };
  }

  const description = `@${devA.github_login} (#${devA.rank}, ${devA.contributions.toLocaleString()} contributions, ${devA.total_stars.toLocaleString()} stars) vs @${devB.github_login} (#${devB.rank}, ${devB.contributions.toLocaleString()} contributions, ${devB.total_stars.toLocaleString()} stars)`;

  return {
    title,
    description,
  };
}

export default async function ComparePage({ params }: Props) {
  const { userA, userB } = await params;
  redirect(`/?compare=${encodeURIComponent(userA)},${encodeURIComponent(userB)}`);
}
