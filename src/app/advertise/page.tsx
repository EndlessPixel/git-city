import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { AdvertisePageTracker } from "./tracking";
import { AdPurchaseForm } from "./AdPurchaseForm";

const ACCENT = "#c8e64a";
const SHADOW = "#5a7a00";

export const metadata: Metadata = {
  title: "Advertise on Git City",
  description:
    "Put your brand in the sky and on buildings of a 3D city of GitHub developers. Planes, blimps, billboards, LED wraps, impression tracking, and click analytics.",
  openGraph: {
    title: "Advertise on Git City",
    description:
      "Your brand on 1,000+ developer buildings. Sky ads, building billboards, rooftop signs, LED wraps with full analytics.",
    siteName: "Git City",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@samuelrizzondev",
    site: "@samuelrizzondev",
  },
};

async function getStats() {
  const supabase = getSupabaseAdmin();

  const [devResult, impressionResult] = await Promise.all([
    supabase
      .from("developers")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("sky_ad_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "impression"),
  ]);

  return {
    devCount: devResult.count ?? 0,
    totalImpressions: impressionResult.count ?? 0,
  };
}

export default async function AdvertisePage() {
  const { devCount, totalImpressions } = await getStats();

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <AdvertisePageTracker />

      {/* ═══════════════════════════════════════════
          ZONE 1: THE BUILDER
          Purchase flow. Focused. No distractions.
          ═══════════════════════════════════════════ */}
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-10">
        {/* Nav */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-xs text-muted transition-colors hover:text-cream"
          >
            &larr; Back to City
          </Link>
          <div className="flex items-center gap-4 text-[9px] text-muted normal-case">
            <span>
              <span style={{ color: ACCENT }}>
                {devCount.toLocaleString()}+
              </span>{" "}
              buildings
            </span>
            <span>
              <span style={{ color: ACCENT }}>
                {totalImpressions.toLocaleString()}+
              </span>{" "}
              impressions
            </span>
          </div>
        </div>

        {/* Hero text */}
        <div className="mt-8 text-center">
          <h1 className="text-2xl text-cream sm:text-3xl">
            Your brand in the <span style={{ color: ACCENT }}>city</span>
          </h1>
          <p className="mt-2 text-[10px] text-muted normal-case">
            Pick a format, write your message, see it live. Pay when ready.
          </p>
        </div>

        {/* Purchase form: preview + control panel */}
        <div className="mt-6">
          <AdPurchaseForm />
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          ZONE 2: THE PROOF
          For people who scroll down to learn more.
          ═══════════════════════════════════════════ */}
      <div
        className="border-t-[3px] border-border"
        style={{ backgroundColor: "#080e1c" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-14">
          {/* How it works */}
          <div className="grid gap-6 sm:grid-cols-4">
            {[
              { n: "01", t: "Pick", d: "Choose sky or building format" },
              { n: "02", t: "Write", d: "Set your text and brand colors" },
              { n: "03", t: "Pay", d: "Instant Stripe checkout" },
              { n: "04", t: "Live", d: "Ad activates immediately" },
            ].map((s) => (
              <div key={s.n}>
                <span className="text-xl" style={{ color: ACCENT }}>
                  {s.n}
                </span>
                <h3 className="mt-1 text-xs text-cream">{s.t}</h3>
                <p className="mt-1 text-[9px] leading-relaxed text-muted normal-case">
                  {s.d}
                </p>
              </div>
            ))}
          </div>

          {/* Included features */}
          <div className="mt-12 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <p className="mb-2 text-xs text-cream sm:col-span-2">
              Every ad includes
            </p>
            {[
              "Custom text up to 80 characters",
              "Your brand colors on the LED panel",
              "Clickable link with UTM tracking",
              "Impression + click analytics",
              "Instant activation after payment",
              "Runs for the full paid duration",
            ].map((f) => (
              <p
                key={f}
                className="flex items-center gap-2 text-[10px] text-muted normal-case"
              >
                <span style={{ color: ACCENT }}>+</span>
                {f}
              </p>
            ))}
          </div>

          {/* FAQ */}
          <div className="mt-12">
            <p className="mb-4 text-xs text-cream">FAQ</p>
            <div className="space-y-3">
              {[
                {
                  q: "How many people will see my ad?",
                  a: `The city has ${devCount.toLocaleString()}+ developer buildings and growing. Every visitor sees ads as they explore.`,
                },
                {
                  q: "What formats are available?",
                  a: "Sky: planes with LED banners, blimps with LED screens. Building: billboards, rotating rooftop signs, LED wraps. All dot-matrix LED style.",
                },
                {
                  q: "Can I change my ad text?",
                  a: "Yes. One free text change per week. Email samuelrizzondev@gmail.com.",
                },
                {
                  q: "What if I want a refund?",
                  a: "Available within the first 3 days. After that it runs until the end of the paid period.",
                },
                {
                  q: "How do I pay?",
                  a: "Credit card, Apple Pay, or Google Pay via Stripe. No account needed.",
                },
                {
                  q: "How many slots per format?",
                  a: "4 plane, 2 blimp, 10 each for billboard, rooftop, and LED wrap. Limited inventory keeps your ad visible.",
                },
              ].map((item) => (
                <div key={item.q} className="border-[2px] border-border p-4">
                  <h3 className="text-[10px] text-cream">{item.q}</h3>
                  <p className="mt-1.5 text-[9px] leading-relaxed text-muted normal-case">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 text-center">
            <Link
              href="/"
              className="btn-press inline-block px-7 py-3.5 text-sm text-bg"
              style={{
                backgroundColor: ACCENT,
                boxShadow: `4px 4px 0 0 ${SHADOW}`,
              }}
            >
              Enter the City
            </Link>
            <p className="mt-4 text-[9px] text-muted normal-case">
              Questions?{" "}
              <a
                href="mailto:samuelrizzondev@gmail.com"
                className="transition-colors hover:text-cream"
                style={{ color: ACCENT }}
              >
                samuelrizzondev@gmail.com
              </a>
            </p>
            <p className="mt-4 text-[9px] text-muted normal-case">
              built by{" "}
              <a
                href="https://x.com/samuelrizzondev"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-cream"
                style={{ color: ACCENT }}
              >
                @samuelrizzondev
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
