import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

export const alt = "Developer Comparison - Git City";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ userA: string; userB: string }>;
}) {
  const { userA, userB } = await params;

  const fontData = await readFile(
    join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf")
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const accent = "#c8e64a";
  const bg = "#0d0d0f";
  const cream = "#e8dcc8";
  const border = "#2a2a30";
  const cardBg = "#1c1c20";
  const muted = "#8c8c9c";

  const [{ data: devA }, { data: devB }] = await Promise.all([
    supabase
      .from("developers")
      .select("github_login, name, avatar_url, contributions, public_repos, total_stars, rank, kudos_count")
      .eq("github_login", userA.toLowerCase())
      .single(),
    supabase
      .from("developers")
      .select("github_login, name, avatar_url, contributions, public_repos, total_stars, rank, kudos_count")
      .eq("github_login", userB.toLowerCase())
      .single(),
  ]);

  if (!devA || !devB) {
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
          Comparison not found
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

  // Stats comparison
  const statDefs = [
    { label: "RANK", key: "rank" as const, invert: true },
    { label: "CONTRIBS", key: "contributions" as const, invert: false },
    { label: "STARS", key: "total_stars" as const, invert: false },
    { label: "REPOS", key: "public_repos" as const, invert: false },
    { label: "KUDOS", key: "kudos_count" as const, invert: false },
  ];

  let aWinsCount = 0;
  let bWinsCount = 0;
  const statRows = statDefs.map((s) => {
    const a: number = (devA as Record<string, number>)[s.key] ?? 0;
    const b: number = (devB as Record<string, number>)[s.key] ?? 0;
    let aWin = false;
    let bWin = false;
    if (s.invert) {
      aWin = a > 0 && (a < b || b === 0);
      bWin = b > 0 && (b < a || a === 0);
    } else {
      aWin = a > b;
      bWin = b > a;
    }
    if (aWin) aWinsCount++;
    if (bWin) bWinsCount++;
    return { label: s.label, a, b, aWin, bWin, isRank: s.key === "rank" };
  });

  const isTie = aWinsCount === bWinsCount;
  const winnerLogin = aWinsCount > bWinsCount ? devA.github_login : devB.github_login;
  const summary = isTie
    ? `Tie ${aWinsCount}-${bWinsCount}`
    : `@${winnerLogin} wins ${Math.max(aWinsCount, bWinsCount)}-${Math.min(aWinsCount, bWinsCount)}`;

  const aIsWinner = aWinsCount > bWinsCount;
  const bIsWinner = bWinsCount > aWinsCount;
  const aColor = aIsWinner || isTie ? accent : muted;
  const bColor = bIsWinner || isTie ? accent : muted;

  // Building heights proportional to contributions
  const maxContrib = Math.max(devA.contributions, devB.contributions, 1);
  const MIN_H = 160;
  const MAX_H = 330;
  const heightA = Math.round(MIN_H + (devA.contributions / maxContrib) * (MAX_H - MIN_H));
  const heightB = Math.round(MIN_H + (devB.contributions / maxContrib) * (MAX_H - MIN_H));

  // Building window generator
  const WSIZE = 20;
  const WGAP = 8;
  const WCOLS = 4;

  function renderWindows(bHeight: number, color: string) {
    const rowH = WSIZE + WGAP;
    const usable = bHeight - 30;
    const nRows = Math.max(2, Math.floor(usable / rowH));
    const rows = [];
    for (let r = 0; r < nRows; r++) {
      const cells = [];
      for (let c = 0; c < WCOLS; c++) {
        const lit = (r * 5 + c * 3) % 7 > 1;
        cells.push(
          <div
            key={c}
            style={{
              width: WSIZE,
              height: WSIZE,
              backgroundColor: lit ? color : `${color}18`,
            }}
          />
        );
      }
      rows.push(
        <div key={r} style={{ display: "flex", gap: WGAP }}>
          {cells}
        </div>
      );
    }
    return rows;
  }

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
          padding: "24px 40px",
          border: `6px solid ${border}`,
        }}
      >
        {/* Main area: buildings + stats */}
        <div style={{ display: "flex", flex: 1 }}>
          {/* Left column: Dev A */}
          <div
            style={{
              width: 310,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            {/* Avatar + Name */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
              {devA.avatar_url && (
                <img
                  src={devA.avatar_url}
                  width={64}
                  height={64}
                  style={{ border: `3px solid ${aColor}` }}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 28, color: cream, textTransform: "uppercase" }}>
                  {(devA.name ?? devA.github_login).slice(0, 12)}
                </div>
                <div style={{ display: "flex", fontSize: 18, color: muted }}>
                  @{devA.github_login}
                </div>
              </div>
            </div>
            {/* Building A */}
            <div
              style={{
                width: 190,
                height: heightA,
                backgroundColor: cardBg,
                borderTop: `6px solid ${aColor}`,
                borderLeft: `3px solid ${aIsWinner || isTie ? `${accent}50` : border}`,
                borderRight: `3px solid ${aIsWinner || isTie ? `${accent}50` : border}`,
                borderBottom: `3px solid ${aIsWinner || isTie ? `${accent}50` : border}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: 14,
                gap: WGAP,
              }}
            >
              {renderWindows(heightA, aColor)}
            </div>
          </div>

          {/* Center: VS + Stats */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {/* VS badge */}
            <div
              style={{
                display: "flex",
                fontSize: 48,
                color: accent,
                border: `4px solid ${accent}`,
                padding: "4px 30px",
                marginBottom: 24,
              }}
            >
              VS
            </div>
            {/* Stats rows */}
            {statRows.map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    width: 130,
                    fontSize: 36,
                    color: s.aWin ? accent : muted,
                  }}
                >
                  {s.isRank ? `#${s.a}` : s.a.toLocaleString()}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    width: 120,
                    fontSize: 16,
                    color: `${muted}aa`,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    width: 130,
                    fontSize: 36,
                    color: s.bWin ? accent : muted,
                  }}
                >
                  {s.isRank ? `#${s.b}` : s.b.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Right column: Dev B */}
          <div
            style={{
              width: 310,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            {/* Avatar + Name */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ display: "flex", fontSize: 28, color: cream, textTransform: "uppercase" }}>
                  {(devB.name ?? devB.github_login).slice(0, 12)}
                </div>
                <div style={{ display: "flex", fontSize: 18, color: muted }}>
                  @{devB.github_login}
                </div>
              </div>
              {devB.avatar_url && (
                <img
                  src={devB.avatar_url}
                  width={64}
                  height={64}
                  style={{ border: `3px solid ${bColor}` }}
                />
              )}
            </div>
            {/* Building B */}
            <div
              style={{
                width: 190,
                height: heightB,
                backgroundColor: cardBg,
                borderTop: `6px solid ${bColor}`,
                borderLeft: `3px solid ${bIsWinner || isTie ? `${accent}50` : border}`,
                borderRight: `3px solid ${bIsWinner || isTie ? `${accent}50` : border}`,
                borderBottom: `3px solid ${bIsWinner || isTie ? `${accent}50` : border}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: 14,
                gap: WGAP,
              }}
            >
              {renderWindows(heightB, bColor)}
            </div>
          </div>
        </div>

        {/* Ground line */}
        <div style={{ display: "flex", height: 4, backgroundColor: border }} />

        {/* Bottom: winner + branding */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 14,
          }}
        >
          <div style={{ display: "flex", fontSize: 28, color: accent, textTransform: "uppercase" }}>
            {summary}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              textTransform: "uppercase",
            }}
          >
            <span style={{ fontSize: 30, color: cream }}>GIT</span>
            <span style={{ fontSize: 30, color: accent }}>CITY</span>
            <span style={{ fontSize: 16, color: muted, marginLeft: 8 }}>by @samuelrizzondev</span>
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
