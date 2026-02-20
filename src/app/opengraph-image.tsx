import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Git City - Your GitHub as a 3D City";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const fontData = await readFile(
    join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf")
  );

  const accent = "#c8e64a";
  const bg = "#0d0d0f";
  const cream = "#e8dcc8";
  const border = "#2a2a30";
  const muted = "#8c8c9c";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          fontFamily: "Silkscreen",
          border: `6px solid ${border}`,
        }}
      >
        {/* Pixel corner decorations */}
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            width: 40,
            height: 40,
            borderTop: `4px solid ${accent}`,
            borderLeft: `4px solid ${accent}`,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            width: 40,
            height: 40,
            borderTop: `4px solid ${accent}`,
            borderRight: `4px solid ${accent}`,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            width: 40,
            height: 40,
            borderBottom: `4px solid ${accent}`,
            borderLeft: `4px solid ${accent}`,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            width: 40,
            height: 40,
            borderBottom: `4px solid ${accent}`,
            borderRight: `4px solid ${accent}`,
            display: "flex",
          }}
        />

        {/* Title */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            textTransform: "uppercase",
          }}
        >
          <span style={{ fontSize: 96, color: cream }}>GIT</span>
          <span style={{ fontSize: 96, color: accent }}>CITY</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 20,
            color: muted,
            textTransform: "uppercase",
          }}
        >
          Your GitHub as a 3D City
        </div>

        {/* Divider */}
        <div
          style={{
            marginTop: 32,
            width: 200,
            height: 4,
            backgroundColor: accent,
            display: "flex",
          }}
        />

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 16,
            color: muted,
            textTransform: "uppercase",
            gap: 12,
          }}
        >
          <span>Explore</span>
          <span>·</span>
          <span>Fly</span>
          <span>·</span>
          <span>Discover</span>
        </div>

        {/* Creator */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            right: 32,
            display: "flex",
            fontSize: 14,
            color: muted,
          }}
        >
          by @samuelrizzondev
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
