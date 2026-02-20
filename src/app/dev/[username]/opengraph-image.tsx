import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

export const alt = "Developer Profile - Git City";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const fontData = await readFile(
    join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf")
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: dev } = await supabase
    .from("developers")
    .select("github_login, name, avatar_url, contributions, public_repos, total_stars, rank, primary_language")
    .eq("github_login", username.toLowerCase())
    .single();

  const accent = "#c8e64a";
  const bg = "#0d0d0f";
  const cream = "#e8dcc8";
  const border = "#2a2a30";
  const cardBg = "#1c1c20";
  const muted = "#8c8c9c";

  if (!dev) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bg,
            fontFamily: "Silkscreen",
            color: cream,
            fontSize: 48,
            border: `6px solid ${border}`,
          }}
        >
          Developer not found
        </div>
      ),
      {
        ...size,
        fonts: [
          { name: "Silkscreen", data: fontData, style: "normal" as const, weight: 400 as const },
        ],
      }
    );
  }

  const stats = [
    { label: "CONTRIBUTIONS", value: dev.contributions.toLocaleString() },
    { label: "REPOS", value: dev.public_repos.toLocaleString() },
    { label: "STARS", value: dev.total_stars.toLocaleString() },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: bg,
          fontFamily: "Silkscreen",
          padding: 60,
          border: `6px solid ${border}`,
        }}
      >
        {/* Top section: Avatar + Info */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {dev.avatar_url && (
            <img
              src={dev.avatar_url}
              width={120}
              height={120}
              style={{
                border: `4px solid ${border}`,
              }}
            />
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dev.name && (
              <div
                style={{
                  display: "flex",
                  fontSize: 40,
                  color: cream,
                  textTransform: "uppercase",
                }}
              >
                {dev.name}
              </div>
            )}
            <div
              style={{
                display: "flex",
                fontSize: 24,
                color: muted,
                textTransform: "uppercase",
              }}
            >
              {`@${dev.github_login}`}
            </div>
            {dev.rank && (
              <div
                style={{
                  display: "flex",
                  fontSize: 18,
                  color: accent,
                  border: `3px solid ${accent}`,
                  padding: "4px 12px",
                  marginTop: 4,
                  textTransform: "uppercase",
                }}
              >
                {`#${dev.rank} in the city`}
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 48,
            flex: 1,
          }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: cardBg,
                border: `3px solid ${border}`,
                padding: 24,
              }}
            >
              <div style={{ display: "flex", fontSize: 48, color: accent }}>{stat.value}</div>
              <div
                style={{
                  display: "flex",
                  fontSize: 14,
                  color: muted,
                  marginTop: 12,
                  textTransform: "uppercase",
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom branding */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 32,
          }}
        >
          {dev.primary_language ? (
            <div style={{ display: "flex", fontSize: 16, color: muted, textTransform: "uppercase" }}>
              {dev.primary_language}
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              textTransform: "uppercase",
            }}
          >
            <span style={{ fontSize: 20, color: cream }}>GIT</span>
            <span style={{ fontSize: 20, color: accent }}>CITY</span>
            <span style={{ fontSize: 13, color: muted, marginLeft: 8 }}>by @samuelrizzondev</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Silkscreen",
          data: fontData,
          style: "normal" as const,
          weight: 400 as const,
        },
      ],
    }
  );
}
