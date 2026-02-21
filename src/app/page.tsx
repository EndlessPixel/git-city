"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase";
import {
  generateCityLayout,
  type CityBuilding,
  type CityPlaza,
  type CityDecoration,
} from "@/lib/github";
import Image from "next/image";
import Link from "next/link";

const CityCanvas = dynamic(() => import("@/components/CityCanvas"), {
  ssr: false,
});

const THEMES = [
  { name: "Sunset",   accent: "#c8e64a", shadow: "#5a7a00" },
  { name: "Midnight", accent: "#6090e0", shadow: "#203870" },
  { name: "Neon",     accent: "#e040c0", shadow: "#600860" },
  { name: "Dawn",     accent: "#e08860", shadow: "#804020" },
  { name: "Emerald",  accent: "#39d353", shadow: "#0e4429" },
  { name: "Vapor",    accent: "#e060a0", shadow: "#602050" },
];

interface CityStats {
  total_developers: number;
  total_contributions: number;
}

// ─── Loading phases for search feedback ─────────────────────
const LOADING_PHASES = [
  { delay: 0,     text: "Fetching GitHub profile..." },
  { delay: 2000,  text: "Analyzing contributions..." },
  { delay: 5000,  text: "Building the city block..." },
  { delay: 9000,  text: "Almost there..." },
  { delay: 13000, text: "This one's a big profile. Hang tight..." },
];

// Errors that won't change if you retry the same username
const PERMANENT_ERROR_CODES = new Set(["not-found", "org", "no-activity"]);

const ERROR_MESSAGES: Record<string, { primary: (u: string) => string; secondary: string; hasRetry?: boolean; hasLink?: boolean }> = {
  "not-found": {
    primary: (u) => `"@${u}" doesn't exist on GitHub`,
    secondary: "Check the spelling — could be a typo. GitHub usernames are case-insensitive.",
  },
  "org": {
    primary: (u) => `"@${u}" is an organization, not a person`,
    secondary: "Git City is for individual profiles. Try searching for one of its contributors by their personal username.",
  },
  "no-activity": {
    primary: (u) => `"@${u}" has no public activity yet`,
    secondary: "Is this you? Open your profile settings, scroll to 'Contributions & activity', and enable 'Include private contributions'. Then search again.",
    hasLink: true,
  },
  "rate-limit": {
    primary: () => "Search limit reached",
    secondary: "You can look up 10 new profiles per hour. Developers already in the city are unlimited.",
  },
  "github-rate-limit": {
    primary: () => "GitHub's API is temporarily unavailable",
    secondary: "Too many requests to GitHub. Try again in a few minutes.",
  },
  "network": {
    primary: () => "Couldn't reach the server",
    secondary: "Check your internet connection and try again.",
    hasRetry: true,
  },
  "generic": {
    primary: () => "Something went wrong",
    secondary: "An unexpected error occurred. Try again.",
    hasRetry: true,
  },
};

function SearchFeedback({
  feedback,
  accentColor,
  onDismiss,
  onRetry,
}: {
  feedback: { type: "loading" | "error"; code?: string; username?: string; raw?: string } | null;
  accentColor: string;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  // Phased loading messages
  useEffect(() => {
    if (feedback?.type !== "loading") { setPhaseIndex(0); return; }
    const timers = LOADING_PHASES.map((phase, i) =>
      setTimeout(() => setPhaseIndex(i), phase.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [feedback?.type]);

  // Auto-dismiss errors after 8s (except persistent ones)
  useEffect(() => {
    if (feedback?.type !== "error") return;
    const code = feedback.code ?? "generic";
    if (code === "no-activity" || code === "network" || code === "generic") return;
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [feedback, onDismiss]);

  if (!feedback) return null;

  // Loading state
  if (feedback.type === "loading") {
    return (
      <div className="flex items-center gap-2 py-1 animate-[fade-in_0.15s_ease-out]">
        <span className="blink-dot h-2 w-2 flex-shrink-0" style={{ backgroundColor: accentColor }} />
        <span className="text-[11px] text-muted normal-case">{LOADING_PHASES[phaseIndex].text}</span>
      </div>
    );
  }

  // Error state
  const code = feedback.code ?? "generic";
  const msg = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.generic;
  const u = feedback.username ?? "";

  return (
    <div
      className="relative w-full max-w-md border-[3px] bg-bg-raised/90 px-4 py-3 backdrop-blur-sm animate-[fade-in_0.15s_ease-out]"
      style={{ borderColor: code === "rate-limit" ? accentColor + "66" : "rgba(248, 81, 73, 0.4)" }}
    >
      <button onClick={onDismiss} className="absolute top-2 right-2 text-[10px] text-muted transition-colors hover:text-cream">&#10005;</button>
      <p className="text-[11px] text-cream normal-case pr-4">{msg.primary(u)}</p>
      <p className="mt-1 text-[10px] text-muted normal-case">{msg.secondary}</p>
      {msg.hasLink && (
        <a
          href="https://github.com/settings/profile"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[10px] normal-case transition-colors hover:text-cream"
          style={{ color: accentColor }}
        >
          Open Profile Settings &rarr;
        </a>
      )}
      {msg.hasRetry && (
        <button
          onClick={onRetry}
          className="btn-press mt-2 border-[2px] border-border px-3 py-1 text-[10px] text-cream transition-colors hover:border-border-light"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const userParam = searchParams.get("user");

  const [username, setUsername] = useState("");
  const failedUsernamesRef = useRef<Map<string, string>>(new Map()); // username -> error code
  const [buildings, setBuildings] = useState<CityBuilding[]>([]);
  const [plazas, setPlazas] = useState<CityPlaza[]>([]);
  const [decorations, setDecorations] = useState<CityDecoration[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    type: "loading" | "error";
    code?: "not-found" | "org" | "no-activity" | "rate-limit" | "github-rate-limit" | "network" | "generic";
    username?: string;
    raw?: string;
  } | null>(null);
  const [flyMode, setFlyMode] = useState(false);
  const [exploreMode, setExploreMode] = useState(false);
  const [themeIndex, setThemeIndex] = useState(0);
  const [hud, setHud] = useState({ speed: 0, altitude: 0 });
  const [flyPaused, setFlyPaused] = useState(false);
  const [flyPauseSignal, setFlyPauseSignal] = useState(0);
  const [stats, setStats] = useState<CityStats>({ total_developers: 0, total_contributions: 0 });
  const [focusedBuilding, setFocusedBuilding] = useState<string | null>(null);
  const [shareData, setShareData] = useState<{
    login: string;
    contributions: number;
    rank: number | null;
    avatar_url: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [purchasedItem, setPurchasedItem] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<CityBuilding | null>(null);
  const [giftClaimed, setGiftClaimed] = useState(false);
  const [claimingGift, setClaimingGift] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  const theme = THEMES[themeIndex];
  const didInit = useRef(false);
  const savedFocusRef = useRef<string | null>(null);

  // Detect mobile/touch device
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640 || "ontouchstart" in window);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auth state listener
  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getSession().then(({ data: { session: s } }: { data: { session: Session | null } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, s: Session | null) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const authLogin = (
    session?.user?.user_metadata?.user_name ??
    session?.user?.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();

  // ESC: layered dismissal
  // During fly mode: only close overlays (profile card) — AirplaneFlight handles pause/exit
  // Outside fly mode: share modal → profile card → focus → explore mode
  useEffect(() => {
    if (flyMode && !selectedBuilding) return;
    if (!flyMode && !exploreMode && !focusedBuilding && !shareData && !selectedBuilding && !giftClaimed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        if (flyMode && selectedBuilding) {
          setSelectedBuilding(null);
          setFocusedBuilding(null);
        } else if (!flyMode) {
          if (giftClaimed) setGiftClaimed(false);
          else if (shareData) { setShareData(null); setFocusedBuilding(null); }
          else if (selectedBuilding) { setSelectedBuilding(null); setFocusedBuilding(null); }
          else if (focusedBuilding) setFocusedBuilding(null);
          else if (exploreMode) { setExploreMode(false); setFocusedBuilding(savedFocusRef.current); savedFocusRef.current = null; }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flyMode, exploreMode, focusedBuilding, shareData, selectedBuilding, giftClaimed]);

  const reloadCity = useCallback(async (bustCache = false) => {
    const cacheBust = bustCache ? `&_t=${Date.now()}` : "";
    const res = await fetch(`/api/city?from=0&to=500${cacheBust}`);
    if (!res.ok) return null;
    const data = await res.json();
    setStats(data.stats);
    if (data.developers.length === 0) return null;

    // Render downtown immediately
    const layout = generateCityLayout(data.developers);
    setBuildings(layout.buildings);
    setPlazas(layout.plazas);
    setDecorations(layout.decorations);

    const total = data.stats?.total_developers ?? 0;
    if (total <= 500) return layout.buildings;

    // Background-fetch remaining developers in chunks
    let allDevs = [...data.developers];
    const CHUNK = 500;
    for (let from = 500; from < total; from += CHUNK) {
      const chunkRes = await fetch(
        `/api/city?from=${from}&to=${from + CHUNK}${cacheBust}`
      );
      if (!chunkRes.ok) break;
      const chunk = await chunkRes.json();
      if (chunk.developers.length === 0) break;
      allDevs = [...allDevs, ...chunk.developers];
    }

    // Regenerate full layout with all developers
    const fullLayout = generateCityLayout(allDevs);
    setBuildings(fullLayout.buildings);
    setPlazas(fullLayout.plazas);
    setDecorations(fullLayout.decorations);
    return fullLayout.buildings;
  }, []);

  // Load city from Supabase on mount
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    async function loadCity() {
      try {
        await reloadCity();
      } catch {
        // City might be empty, that's ok
      } finally {
        setInitialLoading(false);
      }
    }

    loadCity();
  }, [reloadCity]);

  // Focus on building from ?user= query param
  const didFocusUserParam = useRef(false);
  useEffect(() => {
    if (userParam && buildings.length > 0 && !didFocusUserParam.current) {
      didFocusUserParam.current = true;
      setFocusedBuilding(userParam);
      const found = buildings.find(
        (b) => b.login.toLowerCase() === userParam.toLowerCase()
      );
      if (found) {
        setSelectedBuilding(found);
        setExploreMode(true);
      }
    }
  }, [userParam, buildings]);

  // Detect post-purchase redirect (?purchased=item_id)
  const purchasedParam = searchParams.get("purchased");
  useEffect(() => {
    if (purchasedParam) {
      setPurchasedItem(purchasedParam);
      // Reload city to reflect new purchase
      reloadCity();
      // Clear purchased param from URL after a delay
      const timer = setTimeout(() => setPurchasedItem(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [purchasedParam, reloadCity]);

  const searchUser = useCallback(async () => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) return;

    // Check if this username already failed with a permanent error
    const cachedError = failedUsernamesRef.current.get(trimmed);
    if (cachedError) {
      setFeedback({ type: "error", code: cachedError as any, username: trimmed });
      return;
    }

    setLoading(true);
    setFeedback({ type: "loading" });
    setFocusedBuilding(null);
    setSelectedBuilding(null);
    setShareData(null);

    try {
      // Check if dev already exists in the city before the fetch
      const existedBefore = buildings.some(
        (b) => b.login.toLowerCase() === trimmed
      );

      // Add/refresh the developer
      const devRes = await fetch(`/api/dev/${encodeURIComponent(trimmed)}`);
      const devData = await devRes.json();

      if (!devRes.ok) {
        let code: "not-found" | "org" | "no-activity" | "rate-limit" | "github-rate-limit" | "generic" = "generic";
        if (devRes.status === 404) code = "not-found";
        else if (devRes.status === 429) {
          code = devData.error?.includes("GitHub") ? "github-rate-limit" : "rate-limit";
        } else if (devRes.status === 400) {
          if (devData.error?.includes("Organization")) code = "org";
          else if (devData.error?.includes("no public activity")) code = "no-activity";
        }
        // Cache permanent errors so we don't re-fetch
        if (PERMANENT_ERROR_CODES.has(code)) {
          failedUsernamesRef.current.set(trimmed, code);
        }
        setFeedback({ type: "error", code, username: trimmed, raw: devData.error });
        return;
      }

      setFeedback(null);

      // Reload city with cache-bust so the new dev is included
      const updatedBuildings = await reloadCity(true);

      // Focus camera on the searched building
      setFocusedBuilding(devData.github_login);

      if (!existedBefore) {
        // New developer: show the share modal
        setShareData({
          login: devData.github_login,
          contributions: devData.contributions,
          rank: devData.rank,
          avatar_url: devData.avatar_url,
        });
        setCopied(false);
      } else {
        // Existing developer: enter explore mode and show profile card (like a click)
        const foundBuilding = updatedBuildings?.find(
          (b: CityBuilding) => b.login.toLowerCase() === trimmed
        );
        if (foundBuilding) {
          setSelectedBuilding(foundBuilding);
          setExploreMode(true);
        }
      }
      setUsername("");
    } catch {
      setFeedback({ type: "error", code: "network", username: trimmed });
    } finally {
      setLoading(false);
    }
  }, [username, buildings, reloadCity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchUser();
  };

  const handleSignIn = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    setSession(null);
  };

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await fetch("/api/claim", { method: "POST" });
      if (res.ok) {
        await reloadCity();
      }
    } finally {
      setClaiming(false);
    }
  };

  const handleClaimFreeGift = async () => {
    setClaimingGift(true);
    try {
      const res = await fetch("/api/claim-free-item", { method: "POST" });
      if (res.ok) {
        await reloadCity();
        setGiftClaimed(true);
      }
    } finally {
      setClaimingGift(false);
    }
  };

  // Determine if the logged-in user can claim their building
  const myBuilding = authLogin
    ? buildings.find((b) => b.login.toLowerCase() === authLogin)
    : null;
  const canClaim = !!session && !!myBuilding && !myBuilding.claimed;

  // Shop link: logged in + claimed → own shop, otherwise → /shop landing
  const shopHref =
    session && myBuilding?.claimed
      ? `/shop/${myBuilding.login}`
      : "/shop";

  // Show free gift CTA when user claimed but hasn't picked up the free item
  const hasFreeGift =
    !!session &&
    !!myBuilding?.claimed &&
    !myBuilding.owned_items.includes("flag");

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg font-pixel uppercase text-warm">
      {/* 3D Canvas */}
      <CityCanvas
        buildings={buildings}
        plazas={plazas}
        decorations={decorations}
        flyMode={flyMode}
        onExitFly={() => { setFlyMode(false); setFlyPaused(false); }}
        themeIndex={themeIndex}
        onHud={(s, a) => setHud({ speed: s, altitude: a })}
        onPause={(p) => setFlyPaused(p)}
        focusedBuilding={focusedBuilding}
        accentColor={theme.accent}
        onClearFocus={() => setFocusedBuilding(null)}
        flyPauseSignal={flyPauseSignal}
        flyHasOverlay={!!selectedBuilding}
        onBuildingClick={(b) => {
          setSelectedBuilding(b);
          setFocusedBuilding(b.login);
          if (flyMode) {
            // Auto-pause flight to show profile card
            setFlyPauseSignal(s => s + 1);
          } else if (!exploreMode) {
            setExploreMode(true);
          }
        }}
      />

      {/* ─── Fly Mode HUD ─── */}
      {flyMode && (
        <div className="pointer-events-none fixed inset-0 z-30">
          {/* Top bar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <div className="inline-flex items-center gap-3 border-[3px] border-border bg-bg/70 px-5 py-2.5 backdrop-blur-sm">
              <span
                className={`h-2 w-2 flex-shrink-0 ${flyPaused ? "" : "blink-dot"}`}
                style={{ backgroundColor: flyPaused ? "#f85149" : theme.accent }}
              />
              <span className="text-[10px] text-cream">
                {flyPaused ? "Paused" : "Fly"}
              </span>
            </div>
          </div>

          {/* Flight data */}
          <div className="absolute bottom-4 left-3 text-[9px] leading-loose text-muted sm:bottom-6 sm:left-6 sm:text-[10px]">
            <div className="flex items-center gap-2">
              <span>SPD</span>
              <span style={{ color: theme.accent }} className="w-6 text-right">
                {Math.round(hud.speed)}
              </span>
              <div className="flex h-[6px] w-20 items-center border border-border/60 bg-bg/50">
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${Math.round(((hud.speed - 20) / 140) * 100)}%`,
                    backgroundColor: theme.accent,
                  }}
                />
              </div>
            </div>
            <div>
              ALT{" "}
              <span style={{ color: theme.accent }}>
                {Math.round(hud.altitude)}
              </span>
            </div>
          </div>

          {/* Controls hint */}
          <div className="absolute bottom-4 right-3 text-right text-[8px] leading-loose text-muted sm:bottom-6 sm:right-6 sm:text-[9px]">
            {flyPaused ? (
              <>
                <div>
                  <span className="text-cream">Drag</span> orbit
                </div>
                <div>
                  <span className="text-cream">Scroll</span> zoom
                </div>
                <div>
                  <span className="text-cream">WASD</span> resume
                </div>
                <div>
                  <span style={{ color: theme.accent }}>ESC</span> exit
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-cream">Mouse</span> steer
                </div>
                <div>
                  <span className="text-cream">Shift</span> boost
                </div>
                <div>
                  <span className="text-cream">Alt</span> slow
                </div>
                <div>
                  <span className="text-cream">Scroll</span> base speed
                </div>
                <div>
                  <span style={{ color: theme.accent }}>P</span> pause
                </div>
                <div>
                  <span style={{ color: theme.accent }}>ESC</span> pause
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Explore Mode: minimal UI ─── */}
      {exploreMode && !flyMode && (
        <div className="pointer-events-none fixed inset-0 z-20">
          {/* Back button */}
          <div className="pointer-events-auto absolute top-3 left-3 sm:top-4 sm:left-4">
            <button
              onClick={() => { setExploreMode(false); setFocusedBuilding(savedFocusRef.current); savedFocusRef.current = null; }}
              className="flex items-center gap-2 border-[3px] border-border bg-bg/70 px-3 py-1.5 text-[10px] backdrop-blur-sm transition-colors"
              style={{ borderColor: undefined }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.accent + "80")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
            >
              <span style={{ color: theme.accent }}>ESC</span>
              <span className="text-cream">Back</span>
            </button>
          </div>

          {/* Theme switcher (bottom-left) */}
          <div className="pointer-events-auto absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
            <button
              onClick={() => setThemeIndex((i) => (i + 1) % THEMES.length)}
              className="flex items-center gap-2 border-[3px] border-border bg-bg/70 px-3 py-1.5 text-[10px] backdrop-blur-sm transition-colors"
              style={{ borderColor: undefined }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.accent + "80")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
            >
              <span style={{ color: theme.accent }}>&#9654;</span>
              <span className="text-cream">{theme.name}</span>
            </button>
          </div>

          {/* Navigation hints (bottom-right) */}
          <div className="absolute bottom-3 right-3 text-right text-[8px] leading-loose text-muted sm:bottom-4 sm:right-4 sm:text-[9px]">
            <div><span className="text-cream">Drag</span> orbit</div>
            <div><span className="text-cream">Scroll</span> zoom</div>
            <div><span className="text-cream">Right-drag</span> pan</div>
            <div><span className="text-cream">Click</span> building</div>
            <div><span style={{ color: theme.accent }}>ESC</span> back</div>
          </div>
        </div>
      )}

      {/* Shop & Auth moved to center buttons area */}

      {/* ─── Main UI Overlay ─── */}
      {!flyMode && !exploreMode && (
        <div
          className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-between pt-12 pb-4 px-3 sm:py-8 sm:px-4"
          style={{
            background:
              "linear-gradient(to bottom, rgba(13,13,15,0.88) 0%, rgba(13,13,15,0.55) 30%, transparent 60%, transparent 85%, rgba(13,13,15,0.5) 100%)",
          }}
        >
          {/* Top */}
          <div className="pointer-events-auto flex w-full max-w-2xl flex-col items-center gap-3 sm:gap-5">
            <div className="text-center">
              <h1 className="text-2xl text-cream sm:text-3xl md:text-5xl">
                Git{" "}
                <span style={{ color: theme.accent }}>City</span>
              </h1>
              <p className="mt-2 text-[10px] leading-relaxed text-muted normal-case">
                A global city of GitHub developers. Find yourself.
              </p>
            </div>

            {/* Search */}
            <form
              onSubmit={handleSubmit}
              className="flex w-full max-w-md items-center gap-2"
            >
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (feedback?.type === "error") setFeedback(null);
                }}
                placeholder="find yourself in the city"
                className="min-w-0 flex-1 border-[3px] border-border bg-bg-raised px-3 py-2 text-xs text-cream outline-none transition-colors placeholder:text-dim sm:px-4 sm:py-2.5"
                style={{ borderColor: undefined }}
                onFocus={(e) => (e.currentTarget.style.borderColor = theme.accent)}
                onBlur={(e) => (e.currentTarget.style.borderColor = "")}
              />
              <button
                type="submit"
                disabled={loading || !username.trim()}
                className="btn-press flex-shrink-0 px-4 py-2 text-xs text-bg disabled:opacity-40 sm:px-5 sm:py-2.5"
                style={{
                  backgroundColor: theme.accent,
                  boxShadow: `4px 4px 0 0 ${theme.shadow}`,
                }}
              >
                {loading ? <span className="blink-dot inline-block">_</span> : "Search"}
              </button>
            </form>

            {/* Search Feedback: loading phases + errors */}
            <SearchFeedback feedback={feedback} accentColor={theme.accent} onDismiss={() => setFeedback(null)} onRetry={searchUser} />

            {initialLoading && (
              <p className="text-[10px] text-muted normal-case">
                Loading city...
              </p>
            )}
          </div>

          {/* Center - Explore buttons + Shop + Auth */}
          {buildings.length > 0 && (
            <div className="pointer-events-auto flex flex-col items-center gap-3">
              {/* Free Gift CTA — above primary actions */}
              {hasFreeGift && (
                <button
                  onClick={handleClaimFreeGift}
                  disabled={claimingGift}
                  className="gift-cta btn-press px-7 py-3 text-xs sm:py-3.5 sm:text-sm text-bg disabled:opacity-60"
                  style={{
                    backgroundColor: theme.accent,
                    ["--gift-glow-color" as string]: theme.accent + "66",
                    ["--gift-shadow-color" as string]: theme.shadow,
                  }}
                >
                  {claimingGift ? "Opening..." : "\uD83C\uDF81 Open Free Gift!"}
                </button>
              )}

              {/* Primary actions */}
              <div className="flex items-center gap-3 sm:gap-4">
                <button
                  onClick={() => setExploreMode(true)}
                  className="btn-press px-7 py-3 text-xs sm:py-3.5 sm:text-sm text-bg"
                  style={{
                    backgroundColor: theme.accent,
                    boxShadow: `4px 4px 0 0 ${theme.shadow}`,
                  }}
                >
                  Explore City
                </button>
                {!isMobile && (
                  <button
                    onClick={() => { setFocusedBuilding(null); setFlyMode(true); }}
                    className="btn-press px-7 py-3 text-xs sm:py-3.5 sm:text-sm text-bg"
                    style={{
                      backgroundColor: theme.accent,
                      boxShadow: `4px 4px 0 0 ${theme.shadow}`,
                    }}
                  >
                    &#9992; Fly
                  </button>
                )}
              </div>

              {/* Secondary actions: Shop + Auth */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Link
                  href={shopHref}
                  className="btn-press border-[3px] border-border bg-bg/80 px-4 py-1.5 text-[10px] backdrop-blur-sm transition-colors hover:border-border-light"
                  style={{ color: theme.accent }}
                >
                  Shop
                </Link>
                {!session ? (
                  <button
                    onClick={handleSignIn}
                    className="btn-press flex items-center gap-1.5 border-[3px] border-border bg-bg/80 px-3 py-1.5 text-[10px] backdrop-blur-sm transition-colors hover:border-border-light"
                  >
                    <span style={{ color: theme.accent }}>G</span>
                    <span className="text-cream">Sign in</span>
                  </button>
                ) : (
                  <>
                    {canClaim && (
                      <button
                        onClick={handleClaim}
                        disabled={claiming}
                        className="btn-press px-3 py-1.5 text-[10px] text-bg disabled:opacity-40"
                        style={{
                          backgroundColor: theme.accent,
                          boxShadow: `2px 2px 0 0 ${theme.shadow}`,
                        }}
                      >
                        {claiming ? "..." : "Claim"}
                      </button>
                    )}
                    <Link
                      href={`/dev/${authLogin}`}
                      className="border-[3px] border-border bg-bg/80 px-3 py-1.5 text-[10px] text-cream normal-case backdrop-blur-sm transition-colors hover:border-border-light"
                    >
                      @{authLogin}
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="border-[2px] border-border bg-bg/80 px-2 py-1 text-[9px] text-muted backdrop-blur-sm transition-colors hover:text-cream hover:border-border-light"
                    >
                      Sign Out
                    </button>
                  </>
                )}
              </div>

              {isMobile && (
                <a
                  href="/leaderboard"
                  className="btn-press border-[3px] border-border bg-bg-raised px-5 py-2 text-[10px] backdrop-blur-sm"
                  style={{ color: theme.accent }}
                >
                  &#9819; Leaderboard
                </a>
              )}
            </div>
          )}

          {/* Bottom */}
          <div className="pointer-events-auto flex w-full flex-col items-center gap-3 sm:flex-row sm:items-end sm:justify-between">
            {/* Theme switcher */}
            <button
              onClick={() => setThemeIndex((i) => (i + 1) % THEMES.length)}
              className="group flex items-center gap-2 border-[3px] border-border bg-bg-raised px-3 py-1.5 text-[10px] transition-colors"
              style={{ borderColor: undefined }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = theme.accent + "80")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "")
              }
            >
              <span style={{ color: theme.accent }}>&#9654;</span>
              <span className="text-cream">{theme.name}</span>
              <span className="text-dim">
                {themeIndex + 1}/{THEMES.length}
              </span>
            </button>

            {/* Info */}
            <div className="text-center">
              {stats.total_developers > 0 ? (
                <p className="text-[10px] text-dim">
                  {stats.total_developers} developer{stats.total_developers !== 1 && "s"} in
                  the city
                </p>
              ) : buildings.length > 0 ? (
                <p className="text-[10px] text-dim">
                  {buildings.length} building{buildings.length !== 1 && "s"} in
                  the city
                </p>
              ) : (
                <p className="text-[10px] text-dim normal-case">
                  Search for a GitHub username to join the city
                </p>
              )}
              <p className="mt-1 text-[9px] text-muted normal-case">
                built by{" "}
                <a
                  href="https://x.com/samuelrizzondev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-cream"
                  style={{ color: theme.accent }}
                >
                  @samuelrizzondev
                </a>
              </p>
            </div>

            {/* Mini Leaderboard - hidden on mobile */}
            {buildings.length > 0 && (
              <div className="hidden w-[200px] sm:block">
                <a
                  href="/leaderboard"
                  className="mb-2 block text-right text-xs text-muted transition-colors hover:text-cream normal-case"
                >
                  Leaderboard &rarr;
                </a>
                <div className="border-[2px] border-border bg-bg-raised/80 backdrop-blur-sm">
                  {buildings
                    .slice()
                    .sort((a, b) => a.rank - b.rank)
                    .slice(0, 5)
                    .map((b) => (
                      <a
                        key={b.login}
                        href={`/dev/${b.login}`}
                        className="flex items-center justify-between px-3 py-1.5 transition-colors hover:bg-bg-card"
                      >
                        <span className="flex items-center gap-2 overflow-hidden">
                          <span
                            className="text-[10px]"
                            style={{
                              color:
                                b.rank === 1
                                  ? "#ffd700"
                                  : b.rank === 2
                                    ? "#c0c0c0"
                                    : b.rank === 3
                                      ? "#cd7f32"
                                      : theme.accent,
                            }}
                          >
                            #{b.rank}
                          </span>
                          <span className="truncate text-[10px] text-cream normal-case">
                            {b.login}
                          </span>
                        </span>
                        <span className="ml-2 flex-shrink-0 text-[10px] text-muted">
                          {b.contributions.toLocaleString()}
                        </span>
                      </a>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Purchase Toast ─── */}
      {purchasedItem && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2">
          <div
            className="border-[3px] px-5 py-2.5 text-[10px] text-bg"
            style={{
              backgroundColor: theme.accent,
              borderColor: theme.shadow,
            }}
          >
            Item purchased! Effect applied to your building.
          </div>
        </div>
      )}

      {/* ─── Navigation Hints (bottom-right, when building selected) ─── */}
      {selectedBuilding && (!flyMode || flyPaused) && (
        <div className="pointer-events-none fixed bottom-3 right-3 z-30 text-right text-[8px] leading-loose text-muted sm:bottom-6 sm:right-6 sm:text-[9px]">
          <div><span className="text-cream">Drag</span> orbit</div>
          <div><span className="text-cream">Scroll</span> zoom</div>
          <div><span className="text-cream">Right-drag</span> pan</div>
          <div><span style={{ color: theme.accent }}>ESC</span> close</div>
        </div>
      )}

      {/* ─── Building Profile Card ─── */}
      {selectedBuilding && (!flyMode || flyPaused) && (
        <div className="pointer-events-auto fixed bottom-3 left-3 z-40 sm:bottom-6 sm:left-6">
          <div className="relative border-[3px] border-border bg-bg-raised/95 backdrop-blur-sm w-[280px] sm:w-[320px]">
            {/* Close */}
            <button
              onClick={() => { setSelectedBuilding(null); setFocusedBuilding(null); }}
              className="absolute top-2 right-2 text-[10px] text-muted transition-colors hover:text-cream z-10"
            >
              ESC
            </button>

            {/* Header with avatar + name */}
            <div className="flex items-center gap-3 p-4 pb-3">
              {selectedBuilding.avatar_url && (
                <Image
                  src={selectedBuilding.avatar_url}
                  alt={selectedBuilding.login}
                  width={48}
                  height={48}
                  className="border-[2px] border-border flex-shrink-0"
                  style={{ imageRendering: "pixelated" }}
                />
              )}
              <div className="min-w-0 flex-1">
                {selectedBuilding.name && (
                  <p className="truncate text-sm text-cream">{selectedBuilding.name}</p>
                )}
                <p className="truncate text-[10px] text-muted">@{selectedBuilding.login}</p>
                {selectedBuilding.claimed && (
                  <span
                    className="mt-1 inline-block px-1.5 py-0.5 text-[8px] text-bg"
                    style={{ backgroundColor: theme.accent }}
                  >
                    Claimed
                  </span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-px bg-border/30 mx-4 mb-3 border border-border/50">
              {[
                { label: "Rank", value: `#${selectedBuilding.rank}` },
                { label: "Contribs", value: selectedBuilding.contributions.toLocaleString() },
                { label: "Repos", value: selectedBuilding.public_repos.toLocaleString() },
                { label: "Stars", value: selectedBuilding.total_stars.toLocaleString() },
              ].map((s) => (
                <div key={s.label} className="bg-bg-card p-2 text-center">
                  <div className="text-xs" style={{ color: theme.accent }}>{s.value}</div>
                  <div className="text-[8px] text-muted mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Language */}
            {selectedBuilding.primary_language && (
              <div className="mx-4 mb-3 text-[10px] text-muted">
                Language: <span className="text-cream">{selectedBuilding.primary_language}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 p-4 pt-0">
              <Link
                href={`/dev/${selectedBuilding.login}`}
                className="btn-press flex-1 py-2 text-center text-[10px] text-bg"
                style={{
                  backgroundColor: theme.accent,
                  boxShadow: `2px 2px 0 0 ${theme.shadow}`,
                }}
              >
                View Profile
              </Link>
              <a
                href={`https://github.com/${selectedBuilding.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press flex-1 border-[2px] border-border py-2 text-center text-[10px] text-cream transition-colors hover:border-border-light"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ─── Share Modal ─── */}
      {shareData && !flyMode && !exploreMode && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
            onClick={() => { setShareData(null); setFocusedBuilding(null); }}
          />

          {/* Modal */}
          <div className="relative mx-3 border-[3px] border-border bg-bg-raised p-4 text-center sm:mx-0 sm:p-6">
            {/* Close */}
            <button
              onClick={() => { setShareData(null); setFocusedBuilding(null); }}
              className="absolute top-2 right-3 text-[10px] text-muted transition-colors hover:text-cream"
            >
              &#10005;
            </button>

            {/* Avatar */}
            {shareData.avatar_url && (
              <Image
                src={shareData.avatar_url}
                alt={shareData.login}
                width={48}
                height={48}
                className="mx-auto mb-3 border-[2px] border-border"
                style={{ imageRendering: "pixelated" }}
              />
            )}

            <p className="text-xs text-cream normal-case">
              <span style={{ color: theme.accent }}>@{shareData.login}</span> joined the city!
            </p>

            <p className="mt-2 text-[10px] text-muted normal-case">
              Rank <span style={{ color: theme.accent }}>#{shareData.rank ?? "?"}</span>
              {" · "}
              <span style={{ color: theme.accent }}>{shareData.contributions.toLocaleString()}</span> contributions
            </p>

            {/* Buttons */}
            <div className="mt-4 flex flex-col items-center gap-2 sm:mt-5 sm:flex-row sm:justify-center sm:gap-3">
              <button
                onClick={() => {
                  setShareData(null);
                  setExploreMode(true);
                }}
                className="btn-press px-4 py-2 text-[10px] text-bg"
                style={{
                  backgroundColor: theme.accent,
                  boxShadow: `3px 3px 0 0 ${theme.shadow}`,
                }}
              >
                Explore Building
              </button>

              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                  `Check out @${shareData.login}'s building in Git City by @samuelrizzondev: ${shareData.contributions.toLocaleString()} contributions, Rank #${shareData.rank ?? "?"}. Find yours →`
                )}&url=${encodeURIComponent(
                  `${window.location.origin}/dev/${shareData.login}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press border-[3px] border-border px-4 py-2 text-[10px] text-cream transition-colors hover:border-border-light"
              >
                Share on X
              </a>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/dev/${shareData.login}`
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="btn-press border-[3px] border-border px-4 py-2 text-[10px] text-cream transition-colors hover:border-border-light"
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>

            {/* View profile link */}
            <a
              href={`/dev/${shareData.login}`}
              className="mt-4 inline-block text-[9px] text-muted transition-colors hover:text-cream normal-case"
            >
              View full profile &rarr;
            </a>
          </div>
        </div>
      )}

      {/* ─── Free Gift Celebration Modal ─── */}
      {giftClaimed && !flyMode && !exploreMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
            onClick={() => setGiftClaimed(false)}
          />

          {/* Modal */}
          <div
            className="relative mx-3 border-[3px] border-border bg-bg-raised p-5 text-center sm:mx-0 sm:p-7 animate-[gift-bounce_0.5s_ease-out]"
            style={{ borderColor: theme.accent + "60" }}
          >
            {/* Close */}
            <button
              onClick={() => setGiftClaimed(false)}
              className="absolute top-2 right-3 text-[10px] text-muted transition-colors hover:text-cream"
            >
              ESC
            </button>

            <div className="text-3xl sm:text-4xl mb-3">{"\uD83C\uDF89"}</div>

            <p className="text-sm text-cream sm:text-base">Gift Unlocked!</p>

            <div
              className="mt-4 inline-flex items-center gap-3 border-[2px] border-border bg-bg-card px-5 py-3"
            >
              <span className="text-2xl">{"\uD83C\uDFC1"}</span>
              <div className="text-left">
                <p className="text-xs text-cream">Flag</p>
                <p className="text-[9px] text-muted normal-case">
                  A flag on top of your building
                </p>
              </div>
            </div>

            {/* Upsell strip */}
            <div className="mt-5 w-full max-w-[280px]">
              <p className="mb-2 text-[9px] tracking-widest text-muted uppercase">
                Upgrade your building
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { emoji: "\uD83C\uDF3F", name: "Garden", price: "$0.75" },
                  { emoji: "\u2728", name: "Neon", price: "$1.00" },
                  { emoji: "\uD83D\uDD25", name: "Fire", price: "$1.00" },
                ].map((item) => (
                  <Link
                    key={item.name}
                    href={shopHref}
                    onClick={() => setGiftClaimed(false)}
                    className="flex flex-col items-center gap-1 border-[2px] border-border bg-bg-card px-2 py-2.5 transition-colors hover:border-border-light"
                  >
                    <span className="text-xl">{item.emoji}</span>
                    <span className="text-[8px] text-cream leading-tight">
                      {item.name}
                    </span>
                    <span
                      className="text-[9px] font-bold"
                      style={{ color: theme.accent }}
                    >
                      {item.price}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
              <button
                onClick={() => {
                  setGiftClaimed(false);
                  if (myBuilding) {
                    setFocusedBuilding(myBuilding.login);
                    setSelectedBuilding(myBuilding);
                    setExploreMode(true);
                  }
                }}
                className="btn-press px-5 py-2.5 text-[10px] text-bg"
                style={{
                  backgroundColor: theme.accent,
                  boxShadow: `3px 3px 0 0 ${theme.shadow}`,
                }}
              >
                View in City
              </button>
              <Link
                href={shopHref}
                onClick={() => setGiftClaimed(false)}
                className="btn-press border-[3px] border-border px-5 py-2 text-[10px] text-cream transition-colors hover:border-border-light"
              >
                Visit Shop {"→"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
