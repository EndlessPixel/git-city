"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { ShopItem } from "@/lib/items";

const ShopPreview = dynamic(() => import("./ShopPreview"), { ssr: false });

export interface BuildingDims {
  width: number;
  height: number;
  depth: number;
}

interface Props {
  githubLogin: string;
  developerId: number;
  items: ShopItem[];
  ownedItems: string[];
  initialCustomColor: string | null;
  initialBillboardImages: string[];
  billboardSlots: number;
  buildingDims: BuildingDims;
}

interface PixModalData {
  brCode: string;
  brCodeBase64: string;
  purchaseId: string;
  itemName: string;
  githubLogin: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  effect: "Effects",
  structure: "Structures",
  identity: "Identity",
};

const CATEGORY_ORDER = ["effect", "structure", "identity"];

const ENABLE_PIX = false; // flip to true when AbacatePay is live

const ACCENT = "#c8e64a";
const SHADOW = "#5a7a00";
const PENDING_BILLBOARD_KEY = "pending_billboard";

// Save a File as base64 in localStorage for persistence across redirects
function savePendingBillboard(file: File): void {
  const reader = new FileReader();
  reader.onloadend = () => {
    try {
      localStorage.setItem(
        PENDING_BILLBOARD_KEY,
        JSON.stringify({ data: reader.result, type: file.type, name: file.name })
      );
    } catch {
      // localStorage full or unavailable — ignore
    }
  };
  reader.readAsDataURL(file);
}

function getPendingBillboard(): { data: string; type: string; name: string } | null {
  try {
    const raw = localStorage.getItem(PENDING_BILLBOARD_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearPendingBillboard(): void {
  try {
    localStorage.removeItem(PENDING_BILLBOARD_KEY);
  } catch {
    // ignore
  }
}

// Convert a base64 data URL to a File
function dataUrlToFile(dataUrl: string, name: string, type: string): File {
  const arr = dataUrl.split(",");
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], name, { type });
}

const PIX_EXPIRY_SECONDS = 900; // 15 minutes

function detectBrazil(): boolean {
  if (typeof navigator === "undefined") return false;
  const lang = navigator.language || "";
  return (
    lang.startsWith("pt") ||
    Intl.DateTimeFormat().resolvedOptions().timeZone?.startsWith(
      "America/Sao_Paulo"
    ) === true
  );
}

function formatPrice(item: ShopItem, isBrl: boolean): string {
  if (isBrl) {
    return `R$ ${(item.price_brl_cents / 100).toFixed(2).replace(".", ",")}`;
  }
  return `$${(item.price_usd_cents / 100).toFixed(2)}`;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ─── PIX Modal ─────────────────────────────────────────────── */

function PixModal({
  data,
  onClose,
  onCompleted,
}: {
  data: PixModalData;
  onClose: () => void;
  onCompleted: (itemId: string) => void;
}) {
  const [countdown, setCountdown] = useState(PIX_EXPIRY_SECONDS);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"polling" | "completed" | "expired">("polling");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Poll for payment status
  useEffect(() => {
    if (status !== "polling") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/checkout/status?purchase_id=${data.purchaseId}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json.status === "completed") {
          setStatus("completed");
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, data.purchaseId]);

  // Stop intervals when done
  useEffect(() => {
    if (status === "completed" || status === "expired") {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [status]);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }, [data.brCode]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative mx-4 w-full max-w-sm border-[2px] border-border bg-bg p-6">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-xs text-muted hover:text-cream"
        >
          &#10005;
        </button>

        <h3 className="mb-1 text-xs" style={{ color: ACCENT }}>
          PIX Payment
        </h3>
        <p className="mb-4 text-[9px] text-muted normal-case">
          {data.itemName}
        </p>

        {status === "completed" ? (
          <div className="py-6 text-center">
            <p className="mb-2 text-sm" style={{ color: ACCENT }}>
              &#10003; Payment confirmed!
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <a
                href={`/?user=${data.githubLogin}`}
                className="btn-press px-4 py-2 text-[10px] text-bg"
                style={{
                  backgroundColor: ACCENT,
                  boxShadow: `2px 2px 0 0 ${SHADOW}`,
                }}
              >
                View on map
              </a>
              <button
                onClick={() => onCompleted(data.purchaseId)}
                className="border-[2px] border-border px-4 py-2 text-[10px] text-cream hover:border-border-light"
              >
                Close
              </button>
            </div>
          </div>
        ) : status === "expired" ? (
          <div className="py-6 text-center">
            <p className="mb-2 text-xs text-red-400">QR code expired</p>
            <p className="text-[9px] text-muted normal-case">
              Close and try again to generate a new code.
            </p>
            <button
              onClick={onClose}
              className="mt-3 border-[2px] border-border px-4 py-2 text-[10px] text-cream hover:border-border-light"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* QR code */}
            <div className="mb-4 flex justify-center">
              {data.brCodeBase64 ? (
                <img
                  src={data.brCodeBase64}
                  alt="PIX QR Code"
                  className="h-48 w-48"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center border-[2px] border-border text-[9px] text-muted">
                  QR code unavailable
                </div>
              )}
            </div>

            {/* PIX code + copy */}
            <div className="mb-4">
              <p className="mb-1 text-[8px] text-muted">PIX code (copy &amp; paste):</p>
              <div className="flex items-stretch gap-1">
                <div className="flex-1 overflow-hidden border-[2px] border-border bg-bg-card px-2 py-1.5">
                  <p className="truncate text-[8px] text-cream normal-case">
                    {data.brCode}
                  </p>
                </div>
                <button
                  onClick={copyCode}
                  className="shrink-0 border-[2px] px-3 text-[9px] transition-colors"
                  style={{
                    borderColor: copied ? ACCENT : "var(--color-border)",
                    color: copied ? ACCENT : "var(--color-cream)",
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Timer + status */}
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-muted normal-case">
                Expires in{" "}
                <span style={{ color: countdown < 60 ? "#ef4444" : ACCENT }}>
                  {formatCountdown(countdown)}
                </span>
              </p>
              <p className="text-[9px] text-muted normal-case animate-pulse">
                Checking payment...
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Color Picker Panel ──────────────────────────────────────── */

function ColorPickerPanel({
  currentColor,
  isOwned,
  onColorChange,
  onSaved,
}: {
  currentColor: string | null;
  isOwned: boolean;
  onColorChange: (color: string) => void;
  onSaved: (color: string) => void;
}) {
  const [color, setColor] = useState(currentColor || ACCENT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (newColor: string) => {
    setColor(newColor);
    onColorChange(newColor);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/customizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: "custom_color", color }),
      });
      if (res.ok) {
        onSaved(color);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [color, onSaved]);

  return (
    <div className="mt-2 flex items-center gap-3 border-[2px] border-border/50 bg-bg/50 px-3 py-2">
      <input
        type="color"
        value={color}
        onChange={(e) => handleChange(e.target.value)}
        className="h-8 w-10 cursor-pointer border-[2px] border-border bg-transparent"
      />
      <span className="text-[10px] text-muted normal-case">{color}</span>
      {isOwned ? (
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-press ml-auto px-3 py-1 text-[10px] text-bg disabled:opacity-40"
          style={{
            backgroundColor: saved ? "#39d353" : ACCENT,
            boxShadow: `2px 2px 0 0 ${SHADOW}`,
          }}
        >
          {saving ? "..." : saved ? "Saved!" : "Save"}
        </button>
      ) : (
        <span className="ml-auto text-[9px] text-dim normal-case">Preview only</span>
      )}
    </div>
  );
}

/* ─── Billboard Upload Panel (Multi-Slot) ─────────────────────── */

function BillboardUploadPanel({
  images,
  slotCount,
  isOwned,
  autoUploading,
  onImagesChange,
  onPreviewChange,
}: {
  images: string[];
  slotCount: number;
  isOwned: boolean;
  autoUploading?: boolean;
  onImagesChange: (images: string[]) => void;
  onPreviewChange: (images: string[]) => void;
}) {
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [savedSlot, setSavedSlot] = useState<number | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleFileChange = useCallback((slotIndex: number) => {
    const file = fileRefs.current[slotIndex]?.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    // Create preview: copy current images and replace this slot
    const newImages = [...images];
    while (newImages.length <= slotIndex) newImages.push("");
    newImages[slotIndex] = url;
    onPreviewChange(newImages);
    // Save to localStorage so it survives Stripe redirect
    if (!isOwned) {
      savePendingBillboard(file);
    }
  }, [images, isOwned, onPreviewChange]);

  const handleUpload = useCallback(async (slotIndex: number) => {
    const file = fileRefs.current[slotIndex]?.files?.[0];
    if (!file) return;

    setUploadingSlot(slotIndex);
    setSavedSlot(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slot_index", slotIndex.toString());

      const res = await fetch("/api/customizations/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.images) {
          onImagesChange(data.images);
        }
        setSavedSlot(slotIndex);
        setTimeout(() => setSavedSlot(null), 2000);
      }
    } catch {
      // ignore
    } finally {
      setUploadingSlot(null);
    }
  }, [onImagesChange]);

  // Show at least 1 slot for non-owners (preview), or slotCount for owners
  const displaySlots = isOwned ? Math.max(slotCount, 1) : 1;

  return (
    <div className="mt-2 border-[2px] border-border/50 bg-bg/50 px-3 py-2">
      {isOwned ? (
        <>
          {autoUploading && (
            <div className="mb-2 border-[2px] border-dashed px-3 py-2 text-[10px] normal-case animate-pulse" style={{ borderColor: ACCENT, color: ACCENT }}>
              Uploading your billboard image...
            </div>
          )}
          {!autoUploading && images.filter(Boolean).length === 0 && (
            <div className="mb-2 border-[2px] border-dashed px-3 py-2 text-[10px] normal-case" style={{ borderColor: ACCENT, color: ACCENT }}>
              Upload an image to each slot below to display on your building!
            </div>
          )}
          <p className="mb-2 text-[9px] text-muted normal-case">
            {slotCount} billboard slot{slotCount !== 1 ? "s" : ""} — upload an image for each. Buy more to unlock more slots.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: displaySlots }).map((_, i) => {
              const img = images[i];
              const isUploading = uploadingSlot === i;
              const isSaved = savedSlot === i;

              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 border-[2px] border-border/30 bg-bg-card p-2"
                >
                  <p className="text-[8px] text-dim">Slot {i + 1}</p>
                  {img ? (
                    <img
                      src={img}
                      alt={`Billboard ${i + 1}`}
                      className="h-10 w-full border-[1px] border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-full items-center justify-center border-[1px] border-border/30 bg-bg/50 text-[8px] text-dim">
                      Empty
                    </div>
                  )}
                  <input
                    ref={(el) => { fileRefs.current[i] = el; }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={() => handleFileChange(i)}
                    className="w-full text-[8px] text-muted normal-case file:mr-1 file:border-[1px] file:border-border file:bg-bg file:px-1 file:py-0.5 file:text-[8px] file:text-cream"
                  />
                  <button
                    onClick={() => handleUpload(i)}
                    disabled={isUploading}
                    className="btn-press w-full px-2 py-0.5 text-[9px] text-bg disabled:opacity-40"
                    style={{
                      backgroundColor: isSaved ? "#39d353" : ACCENT,
                      boxShadow: `1px 1px 0 0 ${SHADOW}`,
                    }}
                  >
                    {isUploading ? "..." : isSaved ? "Saved!" : "Upload"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-[8px] text-dim normal-case">
            PNG, JPEG, WebP or GIF. Max 2 MB.
          </p>
        </>
      ) : (
        <>
          <p className="mb-2 text-[9px] text-muted normal-case">
            Try it — pick an image to preview on the 3D building. Purchase to save.
          </p>
          <div className="flex items-center gap-3">
            {images[0] && (
              <img
                src={images[0]}
                alt="Billboard preview"
                className="h-10 w-14 border-[2px] border-border object-cover"
              />
            )}
            <input
              ref={(el) => { fileRefs.current[0] = el; }}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={() => handleFileChange(0)}
              className="min-w-0 flex-1 text-[9px] text-muted normal-case file:mr-2 file:border-[2px] file:border-border file:bg-bg-card file:px-2 file:py-1 file:text-[9px] file:text-cream"
            />
          </div>
          <p className="mt-1 text-[8px] text-dim normal-case">
            PNG, JPEG, WebP or GIF. Max 2 MB. Each purchase = 1 billboard slot.
          </p>
        </>
      )}
    </div>
  );
}

/* ─── Shop Client ───────────────────────────────────────────── */

export default function ShopClient({
  githubLogin,
  developerId,
  items,
  ownedItems,
  initialCustomColor,
  initialBillboardImages,
  billboardSlots: initialBillboardSlots,
  buildingDims,
}: Props) {
  const [buyingItem, setBuyingItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBrl, setIsBrl] = useState(false);
  const [owned, setOwned] = useState<string[]>(ownedItems);
  const [pixModal, setPixModal] = useState<PixModalData | null>(null);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState<string | null>(initialCustomColor);
  const [billboardImages, setBillboardImages] = useState<string[]>(initialBillboardImages);
  const [billboardSlots, setBillboardSlots] = useState(initialBillboardSlots);
  const [previewColor, setPreviewColor] = useState<string | null>(null);
  const [previewBillboardImages, setPreviewBillboardImages] = useState<string[] | null>(null);

  const [autoUploading, setAutoUploading] = useState(false);

  useEffect(() => {
    setIsBrl(detectBrazil());
  }, []);

  // Auto-upload pending billboard image after purchase redirect
  useEffect(() => {
    if (billboardSlots <= 0) return;
    // Only auto-upload if slot 0 has no image yet
    if (billboardImages[0]) return;

    const pending = getPendingBillboard();
    if (!pending) return;

    setAutoUploading(true);
    const file = dataUrlToFile(pending.data, pending.name, pending.type);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("slot_index", "0");

    fetch("/api/customizations/upload", { method: "POST", body: formData })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.images) {
            setBillboardImages(data.images);
          }
        }
      })
      .finally(() => {
        clearPendingBillboard();
        setAutoUploading(false);
      });
  }, [billboardSlots]); // only run on mount / when slots change

  const checkout = useCallback(
    async (itemId: string, provider: "stripe" | "abacatepay") => {
      if (buyingItem) return;
      setBuyingItem(itemId);
      setError(null);

      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: itemId, provider, currency: isBrl ? "brl" : "usd" }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 409) {
            if (itemId === "billboard") {
              setError(data.error || "Max billboard slots reached");
            } else {
              setError("You already own this item");
              setOwned((prev) =>
                prev.includes(itemId) ? prev : [...prev, itemId]
              );
            }
          } else {
            setError(data.error || "Checkout failed");
          }
          return;
        }

        if (data.brCode) {
          // PIX — show inline modal
          const item = items.find((i) => i.id === itemId);
          setPixModal({
            brCode: data.brCode,
            brCodeBase64: data.brCodeBase64,
            purchaseId: data.purchase_id,
            itemName: item?.name ?? "Item",
            githubLogin,
          });
        } else if (data.url) {
          // Stripe — redirect
          window.location.href = data.url;
        }
      } catch {
        setError("Network error. Try again.");
      } finally {
        setBuyingItem(null);
      }
    },
    [buyingItem, isBrl, items, githubLogin]
  );

  const handlePixCompleted = useCallback(
    (_purchaseId: string) => {
      // Find which item was just purchased
      if (pixModal) {
        const item = items.find((i) => i.name === pixModal.itemName);
        if (item) {
          setOwned((prev) =>
            prev.includes(item.id) ? prev : [...prev, item.id]
          );
          if (item.id === "billboard") {
            setBillboardSlots((prev) => prev + 1);
            // Auto-upload pending billboard image after PIX confirmation
            const pending = getPendingBillboard();
            if (pending) {
              const file = dataUrlToFile(pending.data, pending.name, pending.type);
              const formData = new FormData();
              formData.append("file", file);
              formData.append("slot_index", "0");
              fetch("/api/customizations/upload", { method: "POST", body: formData })
                .then(async (res) => {
                  if (res.ok) {
                    const data = await res.json();
                    if (data.images) setBillboardImages(data.images);
                  }
                })
                .finally(() => clearPendingBillboard());
            }
          }
        }
      }
      setPixModal(null);
    },
    [pixModal, items]
  );

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-[10px] text-muted normal-case">
        No items available yet. Check back soon!
      </p>
    );
  }

  return (
    <>
      {/* PIX Modal */}
      {pixModal && (
        <PixModal
          data={pixModal}
          onClose={() => setPixModal(null)}
          onCompleted={handlePixCompleted}
        />
      )}

      <div className="lg:flex lg:gap-6">
        {/* Left column: items card */}
        <div className="min-w-0 flex-1">
          {/* Mobile-only preview */}
          <div className="mb-5 lg:hidden">
            <ShopPreview
              previewItemId={previewItemId}
              ownedItems={owned}
              customColor={previewColor ?? customColor}
              billboardImages={previewBillboardImages ?? billboardImages}
              buildingDims={buildingDims}
            />
          </div>

          <div className="border-[3px] border-border bg-bg-raised p-4 sm:p-6">
            {/* Currency toggle */}
            <div className="mb-5 flex items-center justify-end">
              <button
                onClick={() => setIsBrl(!isBrl)}
                className="border-[2px] border-border px-2 py-0.5 text-xs text-muted transition-colors hover:text-cream"
              >
                {isBrl ? "BRL" : "USD"}
              </button>
            </div>

            {error && (
              <div className="mb-4 border-[2px] border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] text-red-400 normal-case">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {grouped.map((group) => (
                <div key={group.category}>
                  <h3 className="mb-3 text-sm" style={{ color: ACCENT }}>
                    {group.label}
                  </h3>
                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const isOwned = owned.includes(item.id);
                      const isBuying = buyingItem === item.id;
                      const isBillboard = item.id === "billboard";
                      // Billboard can be bought multiple times
                      const showBuyButton = isBillboard || !isOwned;

                      return (
                        <div key={item.id}>
                          <div
                            className="flex items-center justify-between border-[2px] border-border bg-bg-card px-4 py-3 transition-colors hover:border-border-light"
                            style={
                              previewItemId === item.id
                                ? { borderLeftColor: ACCENT, borderLeftWidth: 3 }
                                : undefined
                            }
                            onMouseEnter={() => setPreviewItemId(item.id)}
                            onMouseLeave={() => setPreviewItemId(null)}
                          >
                            <div className="mr-3 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-cream">{item.name}</span>
                                {isOwned && !isBillboard && (
                                  <span
                                    className="px-1.5 py-0.5 text-[10px] text-bg"
                                    style={{ backgroundColor: ACCENT }}
                                  >
                                    Owned
                                  </span>
                                )}
                                {isBillboard && billboardSlots > 0 && (
                                  <span
                                    className="px-1.5 py-0.5 text-[10px] text-bg"
                                    style={{ backgroundColor: ACCENT }}
                                  >
                                    x{billboardSlots}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="mt-0.5 text-xs text-muted normal-case">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="mr-1 text-sm text-muted">
                                {formatPrice(item, isBrl)}
                              </span>
                              {!showBuyButton ? (
                                <span className="w-14 text-center text-xs text-muted">
                                  &#10003;
                                </span>
                              ) : isBrl && ENABLE_PIX ? (
                                <>
                                  <button
                                    onClick={() => checkout(item.id, "abacatepay")}
                                    disabled={isBuying || !!buyingItem}
                                    className="btn-press px-3 py-1.5 text-xs text-bg disabled:opacity-40"
                                    style={{
                                      backgroundColor: ACCENT,
                                      boxShadow: `2px 2px 0 0 ${SHADOW}`,
                                    }}
                                  >
                                    {isBuying ? "..." : isBillboard && billboardSlots > 0 ? "+1 PIX" : "PIX"}
                                  </button>
                                  <button
                                    onClick={() => checkout(item.id, "stripe")}
                                    disabled={isBuying || !!buyingItem}
                                    className="btn-press border-[2px] border-border px-3 py-1.5 text-xs text-cream transition-colors hover:border-border-light disabled:opacity-40"
                                  >
                                    {isBuying ? "..." : isBillboard && billboardSlots > 0 ? "+1 Card" : "Card"}
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => checkout(item.id, "stripe")}
                                  disabled={isBuying || !!buyingItem}
                                  className="btn-press w-16 px-3 py-1.5 text-xs text-bg disabled:opacity-40"
                                  style={{
                                    backgroundColor: ACCENT,
                                    boxShadow: `2px 2px 0 0 ${SHADOW}`,
                                  }}
                                >
                                  {isBuying ? "..." : isBillboard && billboardSlots > 0 ? "Buy +1" : "Buy"}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Customization panels — always visible */}
                          {item.id === "custom_color" && (
                            <ColorPickerPanel
                              currentColor={customColor}
                              isOwned={isOwned}
                              onColorChange={(c) => setPreviewColor(c)}
                              onSaved={(c) => { setCustomColor(c); setPreviewColor(null); }}
                            />
                          )}
                          {isBillboard && (
                            <BillboardUploadPanel
                              images={previewBillboardImages ?? billboardImages}
                              slotCount={billboardSlots}
                              isOwned={billboardSlots > 0}
                              autoUploading={autoUploading}
                              onImagesChange={(imgs) => { setBillboardImages(imgs); setPreviewBillboardImages(null); }}
                              onPreviewChange={(imgs) => setPreviewBillboardImages(imgs)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Payment method note */}
            <p className="mt-5 text-center text-[10px] text-dim normal-case">
              {isBrl && ENABLE_PIX ? "PIX via AbacatePay · Card via Stripe" : "Payment via Stripe"}
            </p>
          </div>
        </div>

        {/* Right column: desktop sticky preview */}
        <div className="hidden lg:block lg:w-[420px] lg:shrink-0">
          <div className="sticky top-6">
            <ShopPreview
              previewItemId={previewItemId}
              ownedItems={owned}
              customColor={previewColor ?? customColor}
              billboardImages={previewBillboardImages ?? billboardImages}
              buildingDims={buildingDims}
            />
          </div>
        </div>
      </div>
    </>
  );
}
