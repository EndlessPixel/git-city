"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  NeonOutline,
  ParticleAura,
  SpotlightEffect,
  RooftopFire,
  Helipad,
  AntennaArray,
  RooftopGarden,
  Spire,
  Billboards,
  Flag,
  NeonTrim,
  SatelliteDish,
  CrownItem,
  PoolParty,
  HologramRing,
  LightningAura,
  LEDBanner,
} from "./BuildingEffects";
import type { BuildingDims } from "./ShopClient";
import { ZONE_ITEMS } from "@/lib/zones";

const ACCENT = "#c8e64a";

// Fallback dims if none provided
const DEFAULT_DIMS: BuildingDims = { width: 20, height: 40, depth: 16 };

// ─── Procedural window texture (pixel look) ──────────────────

function useWindowTexture() {
  return useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#2a2a3e";
    ctx.fillRect(0, 0, size, size);

    const cols = 4;
    const rows = 8;
    const winW = 6;
    const winH = 4;
    const gapX = (size - cols * winW) / (cols + 1);
    const gapY = (size - rows * winH) / (rows + 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = Math.random() > 0.35;
        ctx.fillStyle = lit ? "#e8e8a0" : "#1a1a2a";
        const x = gapX + c * (winW + gapX);
        const y = gapY + r * (winH + gapY);
        ctx.fillRect(Math.round(x), Math.round(y), winW, winH);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);
}

// ─── Effect renderer map ─────────────────────────────────────

function EffectForItem({
  itemId,
  dims,
  billboardImages,
}: {
  itemId: string;
  dims: BuildingDims;
  billboardImages?: string[];
}) {
  switch (itemId) {
    case "neon_outline":
      return <NeonOutline {...dims} />;
    case "particle_aura":
      return <ParticleAura {...dims} />;
    case "spotlight":
      return <SpotlightEffect {...dims} />;
    case "rooftop_fire":
      return <RooftopFire {...dims} />;
    case "helipad":
      return <Helipad {...dims} />;
    case "antenna_array":
      return <AntennaArray {...dims} />;
    case "rooftop_garden":
      return <RooftopGarden {...dims} />;
    case "spire":
      return <Spire {...dims} />;
    case "billboard":
      return <Billboards {...dims} images={billboardImages ?? []} />;
    case "flag":
      return <Flag {...dims} />;
    case "neon_trim":
      return <NeonTrim {...dims} color={ACCENT} />;
    case "satellite_dish":
      return <SatelliteDish {...dims} color={ACCENT} />;
    case "crown_item":
      return <CrownItem height={dims.height} color={ACCENT} />;
    case "pool_party":
      return <PoolParty {...dims} />;
    case "hologram_ring":
      return <HologramRing {...dims} color={ACCENT} />;
    case "lightning_aura":
      return <LightningAura {...dims} color={ACCENT} />;
    case "led_banner":
      return <LEDBanner {...dims} color={ACCENT} />;
    default:
      return null;
  }
}

// ─── Ground grid ─────────────────────────────────────────────

function Ground({ y, size }: { y: number; size: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#111118" />
    </mesh>
  );
}

// ─── Scene ───────────────────────────────────────────────────

interface Loadout {
  crown: string | null;
  roof: string | null;
  aura: string | null;
}

function ShopPreviewScene({
  loadout,
  ownedFacesItems,
  customColor,
  billboardImages,
  dims,
  highlightItemId,
}: {
  loadout: Loadout;
  ownedFacesItems: string[];
  customColor: string | null;
  billboardImages: string[];
  dims: BuildingDims;
  highlightItemId?: string | null;
}) {
  const { width: W, height: H, depth: D } = dims;
  const groupRef = useRef<THREE.Group>(null);
  const texture = useWindowTexture();

  // Custom color: use picked/saved color, or accent demo on hover, or no tint
  const tint = useMemo(() => {
    if (customColor) return customColor;
    if (highlightItemId === "custom_color") return ACCENT;
    return "#ffffff";
  }, [highlightItemId, customColor]);

  // Gentle idle bob
  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
  });

  const groundSize = Math.max(120, Math.max(W, D) * 4);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[30, 60, 20]} intensity={1.2} />
      <directionalLight position={[-20, 30, -10]} intensity={0.3} color="#6677aa" />

      <OrbitControls
        autoRotate
        autoRotateSpeed={1}
        enablePan
        screenSpacePanning
        minDistance={15}
        maxDistance={Math.max(200, H * 4)}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI * 0.85}
        target={[0, H * 0.15, 0]}
      />

      <Ground y={-H / 2} size={groundSize} />

      <group ref={groupRef}>
        {/* Building centered at origin */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[W, H, D]} />
          <meshStandardMaterial
            key={tint}
            map={texture}
            color={tint}
          />
        </mesh>

        {/* Effects use y=0 as ground, so offset them */}
        <group position={[0, -H / 2, 0]}>
          {/* Zone items: highlight replaces equipped item in the same zone */}
          {(["crown", "roof", "aura"] as const).map((zone) => {
            const equipped = loadout[zone];
            // If highlight belongs to this zone, show it instead of equipped
            const highlightInZone = highlightItemId && ZONE_ITEMS[zone]?.includes(highlightItemId);
            const showId = highlightInZone ? highlightItemId : equipped;
            return showId ? <EffectForItem key={zone} itemId={showId} dims={dims} /> : null;
          })}

          {/* Faces: always render if owned (same as Building3D) */}
          {ownedFacesItems.includes("led_banner") && (
            <EffectForItem itemId="led_banner" dims={dims} />
          )}
          {(billboardImages.length > 0 || ownedFacesItems.includes("billboard")) && (
            <EffectForItem itemId="billboard" dims={dims} billboardImages={billboardImages} />
          )}
        </group>
      </group>
    </>
  );
}

// ─── Canvas wrapper (default export) ─────────────────────────

export default function ShopPreview({
  loadout,
  ownedFacesItems,
  customColor,
  billboardImages,
  buildingDims,
  highlightItemId,
}: {
  loadout: { crown: string | null; roof: string | null; aura: string | null };
  ownedFacesItems: string[];
  customColor: string | null;
  billboardImages: string[];
  buildingDims?: BuildingDims;
  highlightItemId?: string | null;
}) {
  const dims = buildingDims ?? DEFAULT_DIMS;
  // Camera distance adapts to building size
  const camDist = Math.max(60, dims.height * 1.5);

  return (
    <div className="relative border-[3px] border-border bg-bg-card">
      <div className="h-[280px] sm:h-[360px] lg:h-[520px]">
        <Canvas
          camera={{ position: [0, camDist * 0.4, camDist], fov: 45 }}
          gl={{ antialias: false }}
        >
          <ShopPreviewScene
            loadout={loadout}
            ownedFacesItems={ownedFacesItems}
            customColor={customColor}
            billboardImages={billboardImages}
            dims={dims}
            highlightItemId={highlightItemId}
          />
        </Canvas>
      </div>
      <div className="absolute bottom-2 left-2 right-2 flex flex-col items-center gap-1 pointer-events-none">
        <span className="bg-bg/80 px-2 py-0.5 text-[9px] text-muted">
          {highlightItemId ? "PREVIEW" : "HOVER AN ITEM TO PREVIEW"}
        </span>
        <span className="bg-bg/80 px-2 py-0.5 text-[9px] text-muted normal-case">
          Scroll: zoom · Drag: rotate · Right-drag: move
        </span>
      </div>
    </div>
  );
}
