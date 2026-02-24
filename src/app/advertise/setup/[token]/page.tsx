import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SetupForm } from "./SetupForm";

const ACCENT = "#c8e64a";

export const metadata: Metadata = {
  title: "Set Up Your Ad - Git City",
  robots: { index: false, follow: false },
};

const VEHICLE_LABELS: Record<string, string> = {
  plane: "Plane",
  blimp: "Blimp",
  billboard: "Billboard",
  rooftop_sign: "Rooftop Sign",
  led_wrap: "LED Wrap",
};

const VEHICLE_ICONS: Record<string, string> = {
  plane: "\u2708",
  blimp: "\u25C6",
  billboard: "\uD83D\uDCCB",
  rooftop_sign: "\uD83D\uDD04",
  led_wrap: "\uD83D\uDCA1",
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SetupPage({ params }: Props) {
  const { token } = await params;

  if (!token || token.length < 10) notFound();

  const sb = getSupabaseAdmin();

  const { data: ad } = await sb
    .from("sky_ads")
    .select("id, text, color, bg_color, vehicle, brand, description, link")
    .eq("tracking_token", token)
    .maybeSingle();

  if (!ad) notFound();

  const vehicleLabel = VEHICLE_LABELS[ad.vehicle] ?? ad.vehicle;
  const vehicleIcon = VEHICLE_ICONS[ad.vehicle] ?? "\u2708";

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Success header */}
        <div className="text-center">
          <p
            className="text-3xl"
            style={{ color: ACCENT }}
          >
            +
          </p>
          <h1 className="mt-2 text-2xl text-cream">
            Your ad is <span style={{ color: ACCENT }}>live!</span>
          </h1>
          <p className="mt-3 text-[10px] text-muted normal-case">
            Payment confirmed. Your ad is now running in the city.
          </p>
        </div>

        {/* Ad preview */}
        <div className="mt-8 border-[3px] border-border p-5">
          <div className="flex items-center gap-3">
            <span className="text-lg">{vehicleIcon}</span>
            <span className="text-xs text-cream">{vehicleLabel}</span>
          </div>
          <div
            className="relative mt-3 overflow-hidden px-4 py-2.5 text-center tracking-widest"
            style={{
              backgroundColor: ad.bg_color,
              color: ad.color,
              fontFamily: "monospace",
              fontSize: "11px",
              letterSpacing: "0.15em",
              textShadow: `0 0 8px ${ad.color}44`,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.15) 41%)",
                backgroundSize: "3px 3px",
              }}
            />
            <span className="relative">{ad.text}</span>
          </div>
        </div>

        {/* Setup form */}
        <div className="mt-8">
          <h2 className="text-sm text-cream">
            Add <span style={{ color: ACCENT }}>details</span>{" "}
            <span className="text-[9px] text-muted normal-case">(optional)</span>
          </h2>
          <p className="mt-2 text-[10px] text-muted normal-case">
            These show when someone interacts with your ad. You can always update them later.
          </p>

          <SetupForm
            token={token}
            initialBrand={ad.brand ?? ""}
            initialDescription={ad.description ?? ""}
            initialLink={ad.link ?? ""}
          />
        </div>
      </div>
    </main>
  );
}
