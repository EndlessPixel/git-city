"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Building3D from "./Building3D";
import type { CityBuilding } from "@/lib/github";
import type { BuildingColors } from "./CityCanvas";

const LOD_DISTANCE = 500;        // beyond this: instanced mesh, no label
                                  // within this: individual Building3D with username label
const LOD_UPDATE_INTERVAL = 0.2; // seconds

// Pre-allocated temp objects to avoid GC pressure in useFrame
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

export interface FocusInfo {
  dist: number;
  screenX: number;
  screenY: number;
}

interface CitySceneProps {
  buildings: CityBuilding[];
  colors: BuildingColors;
  focusedBuilding?: string | null;
  focusedBuildingB?: string | null;
  accentColor?: string;
  onBuildingClick?: (building: CityBuilding) => void;
  onFocusInfo?: (info: FocusInfo) => void;
  introMode?: boolean;
}

export default function CityScene({
  buildings,
  colors,
  focusedBuilding,
  focusedBuildingB,
  accentColor,
  onBuildingClick,
  onFocusInfo,
  introMode,
}: CitySceneProps) {
  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const lastUpdate = useRef(-1); // -1 so first frame triggers immediately
  const nearSetRef = useRef(new Set<string>());
  const [nearBuildings, setNearBuildings] = useState<CityBuilding[]>([]);

  // Shared geometry for far building instances (unit box, scaled per instance)
  const sharedGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  // Material for far buildings (flat color, no textures)
  const farMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    []
  );

  // Update material when theme changes
  useEffect(() => {
    farMaterial.color.set(colors.face);
    farMaterial.emissive.set(colors.roof);
    farMaterial.emissiveIntensity = 1.2;
    farMaterial.needsUpdate = true;
  }, [colors.face, colors.roof, farMaterial]);

  // Dim far buildings when one is focused
  useEffect(() => {
    if (focusedBuilding || focusedBuildingB) {
      farMaterial.transparent = true;
      farMaterial.opacity = 0.55;
      farMaterial.emissiveIntensity = 0.4;
    } else {
      farMaterial.transparent = false;
      farMaterial.opacity = 1;
      farMaterial.emissiveIntensity = 1.2;
    }
    farMaterial.needsUpdate = true;
  }, [focusedBuilding, focusedBuildingB, farMaterial]);

  // Force recalculation when buildings array changes or intro mode changes
  useEffect(() => {
    lastUpdate.current = -1;
    // Clear near set when intro starts so all buildings begin as instanced mesh
    if (introMode) {
      nearSetRef.current = new Set<string>();
      setNearBuildings([]);
    }
  }, [buildings, introMode]);

  // Dispose shared resources on unmount
  useEffect(() => {
    return () => {
      sharedGeo.dispose();
      farMaterial.dispose();
    };
  }, [sharedGeo, farMaterial]);

  // Cache lowercase focus names to avoid per-building string allocation in useFrame
  const focusedLower = focusedBuilding?.toLowerCase() ?? null;
  const focusedBLower = focusedBuildingB?.toLowerCase() ?? null;

  // Centralized LOD check — one useFrame for all buildings
  useFrame(({ camera, clock, size }) => {
    const elapsed = clock.elapsedTime;
    if (elapsed - lastUpdate.current < LOD_UPDATE_INTERVAL) return;
    lastUpdate.current = elapsed;

    const newNearSet = new Set<string>();
    const far: CityBuilding[] = [];

    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const dx = camera.position.x - b.position[0];
      const dz = camera.position.z - b.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);

      const loginLower = b.login.toLowerCase();
      const isFocused =
        loginLower === focusedLower || loginLower === focusedBLower;

      if (isFocused && onFocusInfo) {
        // Project building top to screen coordinates
        _position.set(b.position[0], b.height * 0.65, b.position[2]);
        _position.project(camera);
        const screenX = (_position.x * 0.5 + 0.5) * size.width;
        const screenY = (-_position.y * 0.5 + 0.5) * size.height;
        onFocusInfo({ dist, screenX, screenY });
      }

      if (dist < LOD_DISTANCE || isFocused) {
        newNearSet.add(b.login);
      } else if (introMode && nearSetRef.current.has(b.login)) {
        // During intro: never remove buildings from near set (additive-only)
        newNearSet.add(b.login);
      } else {
        far.push(b);
      }
    }

    // Only trigger React re-render when the near set actually changes
    let changed = newNearSet.size !== nearSetRef.current.size;
    if (!changed) {
      for (const login of newNearSet) {
        if (!nearSetRef.current.has(login)) {
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      nearSetRef.current = newNearSet;
      setNearBuildings(buildings.filter((b) => newNearSet.has(b.login)));
    }

    // Update instanced mesh for far buildings (no React re-render needed)
    const mesh = instancedRef.current;
    if (mesh) {
      for (let i = 0; i < far.length; i++) {
        const b = far[i];
        _position.set(b.position[0], b.height / 2, b.position[2]);
        _scale.set(b.width, b.height, b.depth);
        _matrix.compose(_position, _quaternion, _scale);
        mesh.setMatrixAt(i, _matrix);
        _color.set(b.custom_color ?? colors.face);
        mesh.setColorAt(i, _color);
      }
      mesh.count = far.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Far buildings: single instanced draw call */}
      <instancedMesh
        ref={instancedRef}
        args={[sharedGeo, farMaterial, buildings.length]}
        frustumCulled={false}
      />

      {/* Near buildings: individual components with username label + effects */}
      {nearBuildings.map((b) => {
        const loginLower = b.login.toLowerCase();
        const isA = focusedBuilding?.toLowerCase() === loginLower;
        const isB = focusedBuildingB?.toLowerCase() === loginLower;
        return (
          <Building3D
            key={b.login}
            building={b}
            colors={colors}
            focused={isA || isB}
            dimmed={
              !!(focusedBuilding || focusedBuildingB) && !isA && !isB
            }
            accentColor={accentColor}
            onClick={onBuildingClick}
          />
        );
      })}
    </>
  );
}
