import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";

export const revalidate = 600; // ISR: regenerate every 10 minutes

export const metadata: Metadata = {
  title: "Leaderboard - Git City",
  description:
    "Top GitHub developers ranked by contributions in Git City.",
};

interface Developer {
  github_login: string;
  name: string | null;
  avatar_url: string | null;
  contributions: number;
  total_stars: number;
  primary_language: string | null;
  rank: number | null;
}

export default async function LeaderboardPage() {
  const supabase = await createServerSupabase();
  const accent = "#c8e64a";

  const { data: developers } = await supabase
    .from("developers")
    .select(
      "github_login, name, avatar_url, contributions, total_stars, primary_language, rank"
    )
    .order("rank", { ascending: true, nullsFirst: false })
    .limit(100);

  const devs: Developer[] = developers ?? [];

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-xs text-muted transition-colors hover:text-cream"
          >
            &larr; Back to City
          </Link>
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-3xl text-cream md:text-4xl">
            Leader<span style={{ color: accent }}>board</span>
          </h1>
          <p className="mt-3 text-xs text-muted normal-case">
            Top developers ranked by contributions
          </p>
        </div>

        {/* Table */}
        <div className="mt-8 border-[3px] border-border">
          {/* Header row */}
          <div className="flex items-center gap-4 border-b-[3px] border-border bg-bg-card px-5 py-3 text-xs text-muted">
            <span className="w-10 text-center">#</span>
            <span className="flex-1">Developer</span>
            <span className="hidden w-24 text-right sm:block">Stars</span>
            <span className="hidden w-24 text-right sm:block">Language</span>
            <span className="w-28 text-right">Contributions</span>
          </div>

          {/* Rows */}
          {devs.map((dev) => (
            <Link
              key={dev.github_login}
              href={`/dev/${dev.github_login}`}
              className="flex items-center gap-4 border-b border-border/50 px-5 py-3.5 transition-colors hover:bg-bg-card"
            >
              {/* Rank */}
              <span
                className="w-10 text-center text-sm font-bold"
                style={{
                  color:
                    dev.rank === 1
                      ? "#ffd700"
                      : dev.rank === 2
                        ? "#c0c0c0"
                        : dev.rank === 3
                          ? "#cd7f32"
                          : accent,
                }}
              >
                {dev.rank ?? "—"}
              </span>

              {/* Avatar + Name */}
              <div className="flex flex-1 items-center gap-3 overflow-hidden">
                {dev.avatar_url && (
                  <Image
                    src={dev.avatar_url}
                    alt={dev.github_login}
                    width={36}
                    height={36}
                    unoptimized
                    className="border-[2px] border-border"
                    style={{ imageRendering: "pixelated" }}
                  />
                )}
                <div className="overflow-hidden">
                  <p className="truncate text-sm text-cream">
                    {dev.name ?? dev.github_login}
                  </p>
                  {dev.name && (
                    <p className="truncate text-[10px] text-muted">
                      @{dev.github_login}
                    </p>
                  )}
                </div>
              </div>

              {/* Stars */}
              <span className="hidden w-24 text-right text-xs text-muted sm:block">
                {dev.total_stars.toLocaleString()}
              </span>

              {/* Language */}
              <span className="hidden w-24 text-right text-xs text-muted sm:block">
                {dev.primary_language ?? "—"}
              </span>

              {/* Contributions */}
              <span
                className="w-28 text-right text-sm"
                style={{ color: accent }}
              >
                {dev.contributions.toLocaleString()}
              </span>
            </Link>
          ))}

          {devs.length === 0 && (
            <div className="px-5 py-8 text-center text-xs text-muted normal-case">
              No developers in the city yet. Be the first!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="btn-press inline-block px-7 py-3.5 text-sm text-bg"
            style={{
              backgroundColor: accent,
              boxShadow: "4px 4px 0 0 #5a7a00",
            }}
          >
            Enter the City
          </Link>

          <p className="mt-6 text-[9px] text-muted normal-case">
            built by{" "}
            <a
              href="https://x.com/samuelrizzondev"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-cream"
              style={{ color: accent }}
            >
              @samuelrizzondev
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
