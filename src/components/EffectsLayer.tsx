"use client";

import { useState, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { CityBuilding } from "@/lib/github";
import type { BuildingColors } from "./CityCanvas";
import { ClaimedGlow, BuildingItemEffects } from "./Building3D";
import { StreakFlame, NeonOutline, ParticleAura, SpotlightEffect } from "./BuildingEffects";
import RaidTag3D from "./RaidTag3D";

// ─── Spatial Grid (same structure as CityScene) ────────────────

interface GridIndex {
  cells: Map<string, number[]>;
  cellSize: number;
}

function querySpatialGrid(grid: GridIndex, x: number, z: number, radius: number): number[] {
  const result: number[] = [];
  const minCx = Math.floor((x - radius) / grid.cellSize);
  const maxCx = Math.floor((x + radius) / grid.cellSize);
  const minCz = Math.floor((z - radius) / grid.cellSize);
  const maxCz = Math.floor((z + radius) / grid.cellSize);
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      const arr = grid.cells.get(`${cx},${cz}`);
      if (arr) {
        for (let i = 0; i < arr.length; i++) {
          result.push(arr[i]);
        }
      }
    }
  }
  return result;
}

// ─── Constants ─────────────────────────────────────────────────

const EFFECTS_RADIUS = 400;
const EFFECTS_RADIUS_HYSTERESIS = 500;
const EFFECTS_UPDATE_INTERVAL = 0.3; // seconds

// ─── Component ─────────────────────────────────────────────────

interface EffectsLayerProps {
  buildings: CityBuilding[];
  grid: GridIndex;
  colors: BuildingColors;
  accentColor: string;
  focusedBuilding?: string | null;
  focusedBuildingB?: string | null;
  hideEffectsFor?: string | null;
  introMode?: boolean;
  flyMode?: boolean;
  ghostPreviewLogin?: string | null;
}

export default function EffectsLayer({
  buildings,
  grid,
  colors,
  accentColor,
  focusedBuilding,
  focusedBuildingB,
  hideEffectsFor,
  introMode,
  flyMode,
  ghostPreviewLogin,
}: EffectsLayerProps) {
  const lastUpdate = useRef(-1);
  const activeSetRef = useRef(new Set<number>());
  const [activeIndices, setActiveIndices] = useState<number[]>([]);

  const focusedLower = focusedBuilding?.toLowerCase() ?? null;
  const focusedBLower = focusedBuildingB?.toLowerCase() ?? null;
  const hideLower = hideEffectsFor?.toLowerCase() ?? null;
  const loginToIdx = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < buildings.length; i++) {
      map.set(buildings[i].login.toLowerCase(), i);
    }
    return map;
  }, [buildings]);

  useFrame(({ camera, clock }) => {
    if (introMode) return; // Skip effects during intro

    const elapsed = clock.elapsedTime;
    if (elapsed - lastUpdate.current < EFFECTS_UPDATE_INTERVAL) return;
    lastUpdate.current = elapsed;

    const cx = camera.position.x;
    const cz = camera.position.z;
    const candidates = querySpatialGrid(grid, cx, cz, EFFECTS_RADIUS_HYSTERESIS);

    const nearSq = EFFECTS_RADIUS * EFFECTS_RADIUS;
    const farSq = EFFECTS_RADIUS_HYSTERESIS * EFFECTS_RADIUS_HYSTERESIS;
    const newSet = new Set<number>();

    for (let c = 0; c < candidates.length; c++) {
      const idx = candidates[c];
      const b = buildings[idx];

      // Only buildings that have something to render
      const hasEffects = b.claimed || (b.owned_items && b.owned_items.length > 0) || (b.app_streak > 0) || !!b.active_raid_tag || b.rabbit_completed;
      if (!hasEffects) continue;

      const dx = cx - b.position[0];
      const dz = cz - b.position[2];
      const distSq = dx * dx + dz * dz;

      const alreadyActive = activeSetRef.current.has(idx);
      if (distSq < nearSq || (alreadyActive && distSq < farSq)) {
        newSet.add(idx);
      }
    }

    // Always include focused buildings
    if (focusedLower) {
      const fi = loginToIdx.get(focusedLower);
      if (fi !== undefined) newSet.add(fi);
    }
    if (focusedBLower) {
      const fi = loginToIdx.get(focusedBLower);
      if (fi !== undefined) newSet.add(fi);
    }

    // Check if changed
    let changed = newSet.size !== activeSetRef.current.size;
    if (!changed) {
      for (const idx of newSet) {
        if (!activeSetRef.current.has(idx)) {
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      activeSetRef.current = newSet;
      setActiveIndices(Array.from(newSet));
    }
  });

  // A8: Ghost preview — pick a random aura effect based on login hash
  const ghostLower = ghostPreviewLogin?.toLowerCase() ?? null;
  const ghostIdx = ghostLower ? loginToIdx.get(ghostLower) : undefined;
  const ghostBuilding = ghostIdx != null ? buildings[ghostIdx] : null;
  const ghostEffectId = useMemo(() => {
    if (!ghostLower) return 0;
    let h = 0;
    for (let i = 0; i < ghostLower.length; i++) h = (h * 31 + ghostLower.charCodeAt(i)) | 0;
    return Math.abs(h) % 3; // 0=NeonOutline, 1=ParticleAura, 2=Spotlight
  }, [ghostLower]);

  if (introMode) return null;

  return (
    <>
      {activeIndices.map((idx) => {
        const b = buildings[idx];
        if (!b) return null;
        const loginLower = b.login.toLowerCase();
        if (hideLower === loginLower) return null;
        const isFocused = focusedLower === loginLower || focusedBLower === loginLower;
        const isDimmed = !!focusedLower && !isFocused;
        const isGhostTarget = ghostLower === loginLower;
        return (
          <group key={b.login} position={[b.position[0], 0, b.position[2]]} visible={!isDimmed}>
            {b.claimed && (
              <ClaimedGlow height={b.height} width={b.width} depth={b.depth} />
            )}
            <BuildingItemEffects
              building={b}
              accentColor={accentColor}
              focused={isFocused}
            />
            {/* A8: Ghost preview effect (temporary aura) */}
            {isGhostTarget && (
              ghostEffectId === 0
                ? <NeonOutline width={b.width} height={b.height} depth={b.depth} color={accentColor} />
                : ghostEffectId === 1
                ? <ParticleAura width={b.width} height={b.height} depth={b.depth} color={accentColor} />
                : <SpotlightEffect height={b.height} width={b.width} depth={b.depth} color={accentColor} />
            )}
            {b.app_streak > 0 && (
              <StreakFlame height={b.height} width={b.width} depth={b.depth} streakDays={b.app_streak} color={accentColor} />
            )}
            {b.active_raid_tag && (
              <RaidTag3D
                width={b.width}
                height={b.height}
                depth={b.depth}
                attackerLogin={b.active_raid_tag.attacker_login}
                tagStyle={b.active_raid_tag.tag_style}
              />
            )}
          </group>
        );
      })}
      {/* A8: Ghost preview for building not in active set (force render) */}
      {ghostBuilding && ghostIdx != null && !activeIndices.includes(ghostIdx) && (
        <group position={[ghostBuilding.position[0], 0, ghostBuilding.position[2]]}>
          {ghostEffectId === 0
            ? <NeonOutline width={ghostBuilding.width} height={ghostBuilding.height} depth={ghostBuilding.depth} color={accentColor} />
            : ghostEffectId === 1
            ? <ParticleAura width={ghostBuilding.width} height={ghostBuilding.height} depth={ghostBuilding.depth} color={accentColor} />
            : <SpotlightEffect height={ghostBuilding.height} width={ghostBuilding.width} depth={ghostBuilding.depth} color={accentColor} />
          }
        </group>
      )}
    </>
  );
}
