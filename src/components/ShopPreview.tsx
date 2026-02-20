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
} from "./BuildingEffects";
import type { BuildingDims } from "./ShopClient";

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
      return <AntennaArray height={dims.height} />;
    case "rooftop_garden":
      return <RooftopGarden {...dims} />;
    case "spire":
      return <Spire {...dims} />;
    case "billboard":
      return <Billboards {...dims} images={billboardImages ?? []} />;
    case "flag":
      return <Flag height={dims.height} />;
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

function ShopPreviewScene({
  previewItemId,
  ownedItems,
  customColor,
  billboardImages,
  dims,
}: {
  previewItemId: string | null;
  ownedItems: string[];
  customColor: string | null;
  billboardImages: string[];
  dims: BuildingDims;
}) {
  const { width: W, height: H, depth: D } = dims;
  const groupRef = useRef<THREE.Group>(null);
  const texture = useWindowTexture();

  // Custom color: use picked/saved color, or accent demo on hover, or no tint
  const tint = useMemo(() => {
    if (customColor) return customColor;
    if (previewItemId === "custom_color") return ACCENT;
    return "#ffffff";
  }, [previewItemId, customColor]);

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
          {/* Hovered item preview */}
          {previewItemId && previewItemId !== "custom_color" && (
            <EffectForItem itemId={previewItemId} dims={dims} billboardImages={previewItemId === "billboard" ? billboardImages : undefined} />
          )}

          {/* Idle: show all owned effects */}
          {!previewItemId &&
            ownedItems.map((id) => <EffectForItem key={id} itemId={id} dims={dims} billboardImages={id === "billboard" ? billboardImages : undefined} />)}

          {/* Always show billboard if images exist but not already rendered above */}
          {billboardImages.length > 0 && previewItemId !== "billboard" && !(!previewItemId && ownedItems.includes("billboard")) && (
            <EffectForItem itemId="billboard" dims={dims} billboardImages={billboardImages} />
          )}
        </group>
      </group>
    </>
  );
}

// ─── Canvas wrapper (default export) ─────────────────────────

export default function ShopPreview({
  previewItemId,
  ownedItems,
  customColor,
  billboardImages,
  buildingDims,
}: {
  previewItemId: string | null;
  ownedItems: string[];
  customColor: string | null;
  billboardImages: string[];
  buildingDims?: BuildingDims;
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
            previewItemId={previewItemId}
            ownedItems={ownedItems}
            customColor={customColor}
            billboardImages={billboardImages}
            dims={dims}
          />
        </Canvas>
      </div>
      <div className="absolute bottom-2 left-2 right-2 flex flex-col items-center gap-1 pointer-events-none">
        <span className="bg-bg/80 px-2 py-0.5 text-[9px] text-muted">
          {previewItemId ? "PREVIEW" : "HOVER AN ITEM TO PREVIEW"}
        </span>
        <span className="bg-bg/80 px-2 py-0.5 text-[9px] text-muted normal-case">
          Scroll: zoom · Drag: rotate · Right-drag: move
        </span>
      </div>
    </div>
  );
}
