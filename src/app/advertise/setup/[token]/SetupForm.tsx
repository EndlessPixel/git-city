"use client";

import { useState } from "react";
import Link from "next/link";

const ACCENT = "#c8e64a";

export function SetupForm({
  token,
  initialBrand,
  initialDescription,
  initialLink,
}: {
  token: string;
  initialBrand: string;
  initialDescription: string;
  initialLink: string;
}) {
  const [brand, setBrand] = useState(initialBrand);
  const [description, setDescription] = useState(initialDescription);
  const [link, setLink] = useState(initialLink);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const linkValid =
    !link || link.startsWith("https://") || link.startsWith("mailto:");

  async function handleSave() {
    if (!linkValid) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/sky-ads/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          brand: brand || undefined,
          description: description || undefined,
          link: link || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setSaving(false);
        return;
      }

      window.location.href = `/advertise/track/${token}`;
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      {/* Brand name */}
      <div>
        <label className="block text-[10px] text-muted normal-case">
          Brand name
        </label>
        <input
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          maxLength={60}
          placeholder="Your Company"
          className="mt-1 w-full border-[3px] border-border bg-transparent px-3 py-2 font-pixel text-xs text-cream outline-none transition-colors focus:border-[#c8e64a]"
        />
        <p className="mt-1 text-[9px] text-muted normal-case">
          {brand.length}/60
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-[10px] text-muted normal-case">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="Shown when someone clicks your ad"
          className="mt-1 w-full border-[3px] border-border bg-transparent px-3 py-2 font-pixel text-xs text-cream normal-case outline-none transition-colors focus:border-[#c8e64a]"
        />
        <p className="mt-1 text-[9px] text-muted normal-case">
          {description.length}/200
        </p>
      </div>

      {/* Link */}
      <div>
        <label className="block text-[10px] text-muted normal-case">
          Link
        </label>
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://yoursite.com"
          className="mt-1 w-full border-[3px] border-border bg-transparent px-3 py-2 font-pixel text-xs text-cream outline-none transition-colors focus:border-[#c8e64a]"
        />
        {link && !linkValid && (
          <p className="mt-1 text-[9px] normal-case" style={{ color: "#ff6b6b" }}>
            Must start with https:// or mailto:
          </p>
        )}
        <p className="mt-1 text-[9px] text-muted normal-case">
          Where should clicks go?
        </p>
      </div>

      {/* Error */}
      {error && (
        <p
          className="text-center text-[10px] normal-case"
          style={{ color: "#ff6b6b" }}
        >
          {error}
        </p>
      )}

      {/* CTAs */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !linkValid}
          className="btn-press inline-block px-7 py-3.5 text-sm text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            backgroundColor: ACCENT,
            boxShadow: "4px 4px 0 0 #5a7a00",
          }}
        >
          {saving ? "Saving..." : "Save & View Dashboard"}
        </button>
        <Link
          href={`/advertise/track/${token}`}
          className="text-[10px] text-muted normal-case transition-colors hover:text-cream"
        >
          Skip to dashboard &rarr;
        </Link>
      </div>
    </div>
  );
}
