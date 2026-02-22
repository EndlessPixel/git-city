"use client";

import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Neon Outline ────────────────────────────────────────────
// Wireframe edges with strong emission around the building

export function NeonOutline({
  width,
  height,
  depth,
  color = "#c8e64a",
}: {
  width: number;
  height: number;
  depth: number;
  color?: string;
}) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const frameCount = useRef(0);

  useFrame((state) => {
    if (!lineRef.current) return;
    frameCount.current++;
    if (frameCount.current % 3 !== 0) return;
    const mat = lineRef.current.material as THREE.LineBasicMaterial;
    mat.opacity = 0.6 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
  });

  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(width + 1, height + 1, depth + 1);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [width, height, depth]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <lineSegments ref={lineRef} geometry={geometry} position={[0, height / 2, 0]}>
      <lineBasicMaterial color={color} transparent opacity={0.8} linewidth={2} />
    </lineSegments>
  );
}

// ─── Particle Aura ───────────────────────────────────────────
// Floating particles around the building

const AURA_COUNT = 60;

export function ParticleAura({
  width,
  height,
  depth,
  color = "#c8e64a",
}: {
  width: number;
  height: number;
  depth: number;
  color?: string;
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(AURA_COUNT * 3);
    const spd = new Float32Array(AURA_COUNT);
    const spread = Math.max(width, depth) * 0.8;

    for (let i = 0; i < AURA_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = spread / 2 + Math.random() * spread * 0.4;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = Math.random() * height;
      pos[i * 3 + 2] = Math.sin(angle) * radius;
      spd[i] = 5 + Math.random() * 15;
    }
    return { positions: pos, speeds: spd };
  }, [width, height, depth]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position;
    const arr = posAttr.array as Float32Array;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < AURA_COUNT; i++) {
      arr[i * 3 + 1] += speeds[i] * 0.016;
      if (arr[i * 3 + 1] > height * 1.2) {
        arr[i * 3 + 1] = 0;
      }
      // Gentle horizontal drift
      arr[i * 3] += Math.sin(t + i) * 0.02;
      arr[i * 3 + 2] += Math.cos(t + i * 0.7) * 0.02;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={2.5}
        transparent
        opacity={0.7}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

// ─── Spotlight ───────────────────────────────────────────────
// Thick light beam shooting to sky, visible from far

export function SpotlightEffect({
  height,
  width,
  depth,
  color = "#c8e64a",
}: {
  height: number;
  width: number;
  depth: number;
  color?: string;
}) {
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 3 + Math.sin(t * 1.5) * 1;
    }
  });

  const baseRadius = Math.max(width, depth) * 0.5;

  return (
    <group>
      {/* Bright glow disc on rooftop */}
      <mesh ref={glowRef} position={[0, height + 0.5, 0]}>
        <cylinderGeometry args={[baseRadius, baseRadius * 1.2, 1.5, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
          toneMapped={false}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Outer soft halo */}
      <mesh position={[0, height + 0.8, 0]}>
        <cylinderGeometry args={[baseRadius * 1.5, baseRadius * 2, 0.5, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ─── Rooftop Fire ────────────────────────────────────────────
// Blocky contained campfire with strong orange glow

export function RooftopFire({
  height,
  width,
  depth,
}: {
  height: number;
  width: number;
  depth: number;
}) {
  const flamesRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!flamesRef.current) return;
    const t = state.clock.elapsedTime;
    flamesRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      // Blocky flame animation: scale Y wobble + slight Y bob
      const phase = i * 1.3;
      mesh.scale.y = 0.7 + Math.sin(t * 4 + phase) * 0.3;
      mesh.position.y = mesh.userData.baseY + Math.sin(t * 3 + phase) * 1;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 3 + Math.sin(t * 5 + phase) * 1.5;
    });
  });

  const fireW = Math.min(width, depth) * 0.4;

  // 5 blocky flame columns in a cluster
  const flames = useMemo(() => [
    { x: 0, z: 0, h: 8, color: "#ff6622" },
    { x: fireW * 0.3, z: fireW * 0.2, h: 6, color: "#ff8833" },
    { x: -fireW * 0.25, z: -fireW * 0.15, h: 7, color: "#ff5511" },
    { x: fireW * 0.1, z: -fireW * 0.3, h: 5, color: "#ffaa44" },
    { x: -fireW * 0.2, z: fireW * 0.25, h: 5.5, color: "#ff7722" },
  ], [fireW]);

  return (
    <group position={[0, height, 0]}>
      {/* Fire pit base */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[fireW * 0.6, fireW * 0.7, 1.5, 8]} />
        <meshStandardMaterial color="#333340" roughness={0.8} />
      </mesh>
      {/* Blocky flame columns */}
      <group ref={flamesRef}>
        {flames.map((f, i) => (
          <mesh
            key={i}
            position={[f.x, 1.5 + f.h / 2, f.z]}
            userData={{ baseY: 1.5 + f.h / 2 }}
          >
            <boxGeometry args={[2, f.h, 2]} />
            <meshStandardMaterial
              color={f.color}
              emissive={f.color}
              emissiveIntensity={3}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      {/* Glow light */}
      <pointLight position={[0, 6, 0]} color="#ff6622" intensity={40} distance={60} />
    </group>
  );
}

// ─── Helipad ─────────────────────────────────────────────────
// Flat cylinder on rooftop with "H" marking

export function Helipad({
  height,
  width,
  depth,
}: {
  height: number;
  width: number;
  depth: number;
}) {
  const padSize = Math.min(width, depth) * 0.6;

  return (
    <group position={[0, height + 0.5, 0]}>
      {/* Pad base */}
      <mesh>
        <cylinderGeometry args={[padSize / 2, padSize / 2, 1, 16]} />
        <meshStandardMaterial color="#444455" roughness={0.7} />
      </mesh>
      {/* H marking - vertical bars */}
      <mesh position={[-padSize * 0.15, 0.6, 0]}>
        <boxGeometry args={[padSize * 0.06, 0.2, padSize * 0.4]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1}
        />
      </mesh>
      <mesh position={[padSize * 0.15, 0.6, 0]}>
        <boxGeometry args={[padSize * 0.06, 0.2, padSize * 0.4]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1}
        />
      </mesh>
      {/* H marking - horizontal bar */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[padSize * 0.36, 0.2, padSize * 0.06]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1}
        />
      </mesh>
    </group>
  );
}

// ─── Antenna Array ───────────────────────────────────────────
// Multiple thin cylinders with blinking tip lights

export function AntennaArray({
  height,
}: {
  height: number;
}) {
  const lightRef = useRef<THREE.Group>(null);
  const frameCount = useRef(0);

  useFrame((state) => {
    if (!lightRef.current) return;
    frameCount.current++;
    if (frameCount.current % 3 !== 0) return;
    const t = state.clock.elapsedTime;
    lightRef.current.children.forEach((child, i) => {
      if ((child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = Math.sin(t * 3 + i * 1.5) > 0.3 ? 4 : 0.2;
      }
    });
  });

  const antennas = [
    { x: -3, z: -2, h: 12 },
    { x: 2, z: -3, h: 16 },
    { x: -1, z: 3, h: 10 },
    { x: 4, z: 1, h: 14 },
  ];

  return (
    <group position={[0, height, 0]}>
      {antennas.map((a, i) => (
        <group key={i} position={[a.x, 0, a.z]}>
          {/* Antenna pole */}
          <mesh position={[0, a.h / 2, 0]}>
            <cylinderGeometry args={[0.3, 0.5, a.h, 6]} />
            <meshStandardMaterial color="#666677" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* Blinking tip lights */}
      <group ref={lightRef}>
        {antennas.map((a, i) => (
          <mesh key={i} position={[a.x, a.h + 0.5, a.z]}>
            <sphereGeometry args={[0.8, 8, 8]} />
            <meshStandardMaterial
              color="#ff2222"
              emissive="#ff0000"
              emissiveIntensity={4}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ─── Rooftop Garden ──────────────────────────────────────────
// Green base with cubic Minecraft-style trees (box geometry)

export function RooftopGarden({
  height,
  width,
  depth,
}: {
  height: number;
  width: number;
  depth: number;
}) {
  const trees = useMemo(() => {
    const result = [];
    const count = 3 + Math.floor(Math.random() * 3);
    const hw = width * 0.32;
    const hd = depth * 0.32;
    const greens = ["#2d5a1e", "#1e6b2e", "#39d353"];
    for (let i = 0; i < count; i++) {
      result.push({
        x: (Math.random() - 0.5) * hw * 2,
        z: (Math.random() - 0.5) * hd * 2,
        trunkH: 2 + Math.random() * 2,
        canopySize: 3 + Math.random() * 2,
        color: greens[i % greens.length],
      });
    }
    return result;
  }, [width, depth]);

  return (
    <group position={[0, height, 0]}>
      {/* Green base (grass block) */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[width * 0.85, 0.8, depth * 0.85]} />
        <meshStandardMaterial color="#2d5a1e" emissive="#1a3a10" emissiveIntensity={0.3} />
      </mesh>
      {/* Cubic Minecraft-style trees */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0.8, t.z]}>
          {/* Trunk (box, not cylinder) */}
          <mesh position={[0, t.trunkH / 2, 0]}>
            <boxGeometry args={[1.2, t.trunkH, 1.2]} />
            <meshStandardMaterial color="#5a3a1a" />
          </mesh>
          {/* Foliage (stacked cubes like Minecraft) */}
          <mesh position={[0, t.trunkH + t.canopySize / 2 - 0.5, 0]}>
            <boxGeometry args={[t.canopySize, t.canopySize, t.canopySize]} />
            <meshStandardMaterial
              color={t.color}
              emissive={t.color}
              emissiveIntensity={0.3}
            />
          </mesh>
          {/* Small top cube */}
          <mesh position={[0, t.trunkH + t.canopySize + 0.5, 0]}>
            <boxGeometry args={[t.canopySize * 0.6, t.canopySize * 0.5, t.canopySize * 0.6]} />
            <meshStandardMaterial
              color={t.color}
              emissive={t.color}
              emissiveIntensity={0.3}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Spire ───────────────────────────────────────────────────
// Tall cone tapering from rooftop (Empire State style)

export function Spire({
  height,
  width,
  depth,
}: {
  height: number;
  width: number;
  depth: number;
}) {
  const spireHeight = Math.min(width, depth) * 1.5;
  const baseRadius = Math.min(width, depth) * 0.12;

  return (
    <group position={[0, height, 0]}>
      {/* Base platform */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[baseRadius * 5, 2, baseRadius * 5]} />
        <meshStandardMaterial color="#888899" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Spire cone */}
      <mesh position={[0, 2 + spireHeight / 2, 0]}>
        <coneGeometry args={[baseRadius, spireHeight, 8]} />
        <meshStandardMaterial color="#aaaabb" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Tip light */}
      <mesh position={[0, spireHeight + 3, 0]}>
        <sphereGeometry args={[0.6, 8, 8]} />
        <meshStandardMaterial
          color="#ff2222"
          emissive="#ff0000"
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ─── Billboard (Multi / Times Square) ────────────────────────
// Each purchase = one billboard slot distributed across building faces

function useBillboardTexture(imageUrl?: string | null) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const texRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      if (texRef.current) {
        texRef.current.dispose();
        texRef.current = null;
      }
      setTexture(null);
      return;
    }

    const loader = new THREE.TextureLoader();
    let cancelled = false;

    loader.load(
      imageUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        // Dispose previous texture before setting new one
        if (texRef.current) texRef.current.dispose();
        tex.colorSpace = THREE.SRGBColorSpace;
        texRef.current = tex;
        setTexture(tex);
      },
      undefined,
      () => {
        if (!cancelled) setTexture(null);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      if (texRef.current) {
        texRef.current.dispose();
        texRef.current = null;
      }
    };
  }, []);

  return texture;
}

// Single billboard panel (internal component)
function BillboardSingle({
  imageUrl,
  billW,
  billH,
  position,
  rotation,
  color = "#c8e64a",
}: {
  imageUrl?: string | null;
  billW: number;
  billH: number;
  position: [number, number, number];
  rotation: [number, number, number];
  color?: string;
}) {
  const tex = useBillboardTexture(imageUrl);

  return (
    <group position={position} rotation={rotation}>
      {/* Billboard frame */}
      <mesh>
        <boxGeometry args={[billW + 1, billH + 1, 0.5]} />
        <meshStandardMaterial color="#222233" />
      </mesh>
      {/* Billboard face */}
      <mesh position={[0, 0, 0.3]}>
        <planeGeometry args={[billW, billH]} />
        {tex ? (
          <meshBasicMaterial map={tex} toneMapped={false} />
        ) : (
          // Empty slot or no-image — glowing accent placeholder
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={imageUrl === undefined ? 0.4 : 1.5}
            toneMapped={false}
            opacity={imageUrl === undefined ? 0.6 : 1}
            transparent={imageUrl === undefined}
          />
        )}
      </mesh>
    </group>
  );
}

// Seeded random for deterministic billboard placement
function billboardSeeded(seed: number): number {
  const s = (seed * 16807) % 2147483647;
  return (s - 1) / 2147483646;
}

export function Billboards({
  height,
  width,
  depth,
  images,
  color = "#c8e64a",
}: {
  height: number;
  width: number;
  depth: number;
  images: string[];
  color?: string;
}) {
  const slots = useMemo(() => {
    const MIN_BILL_W = 10;
    const MIN_BILL_H = 8;
    const totalFaceArea = 2 * (width + depth) * height;
    const maxSlots = Math.max(1, Math.floor(totalFaceArea / (MIN_BILL_W * MIN_BILL_H * 6)));
    const slotCount = Math.max(images.length, 1);
    const count = Math.min(slotCount, maxSlots);

    // Face definitions: [normalAxis, offset, faceWidth, rotation]
    const faces: Array<{
      faceWidth: number;
      getPos: (along: number, y: number) => [number, number, number];
      rotation: [number, number, number];
    }> = [
      {
        // Front (+Z)
        faceWidth: width,
        getPos: (along, y) => [along, y, depth / 2 + 0.5],
        rotation: [0, 0, 0],
      },
      {
        // Right (+X)
        faceWidth: depth,
        getPos: (along, y) => [width / 2 + 0.5, y, along],
        rotation: [0, -Math.PI / 2, 0],
      },
      {
        // Back (-Z)
        faceWidth: width,
        getPos: (along, y) => [-along, y, -(depth / 2 + 0.5)],
        rotation: [0, Math.PI, 0],
      },
      {
        // Left (-X)
        faceWidth: depth,
        getPos: (along, y) => [-(width / 2 + 0.5), y, -along],
        rotation: [0, Math.PI / 2, 0],
      },
    ];

    const result: Array<{
      position: [number, number, number];
      rotation: [number, number, number];
      billW: number;
      billH: number;
      imageUrl: string | undefined;
    }> = [];

    for (let i = 0; i < count; i++) {
      const face = faces[i % 4];
      const seed = i * 7919 + 42;

      // Fixed aspect ratio 1.4:1 (landscape billboard)
      const ASPECT = 1.4;
      // Billboard fills ~95% of face width (covers the wall)
      const billW = Math.max(8, face.faceWidth * 0.95);
      const billH = billW / ASPECT;

      // Y position: start from the TOP and go down (top is most visible)
      const tier = Math.floor(i / 4);
      const topY = height - billH / 2 - 2; // just below the roofline
      const y = Math.max(billH / 2 + 2, topY - tier * (billH + 4));

      // Horizontal offset along face
      const along = (billboardSeeded(seed + 4) - 0.5) * Math.max(0, face.faceWidth - billW) * 0.6;

      const img = images[i];

      result.push({
        position: face.getPos(along, y),
        rotation: face.rotation,
        billW,
        billH,
        imageUrl: img && img.length > 0 ? img : undefined,
      });
    }

    return result;
  }, [height, width, depth, images]);

  return (
    <group>
      {slots.map((slot, i) => (
        <BillboardSingle
          key={i}
          imageUrl={slot.imageUrl}
          billW={slot.billW}
          billH={slot.billH}
          position={slot.position}
          rotation={slot.rotation}
          color={color}
        />
      ))}
    </group>
  );
}

// ─── Flag ────────────────────────────────────────────────────
// Animated flag on top of the building

export function Flag({
  height,
  color = "#c8e64a",
}: {
  height: number;
  color?: string;
}) {
  const flagRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!flagRef.current) return;
    const t = state.clock.elapsedTime;
    flagRef.current.rotation.y = Math.sin(t * 2) * 0.2;
    flagRef.current.position.x = Math.sin(t * 3) * 0.3 + 3;
  });

  const poleHeight = 15;

  return (
    <group position={[0, height, 0]}>
      {/* Pole */}
      <mesh position={[0, poleHeight / 2, 0]}>
        <cylinderGeometry args={[0.3, 0.4, poleHeight, 6]} />
        <meshStandardMaterial color="#888899" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Flag cloth */}
      <mesh ref={flagRef} position={[3, poleHeight - 2, 0]}>
        <planeGeometry args={[6, 4]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Pole tip */}
      <mesh position={[0, poleHeight + 0.5, 0]}>
        <sphereGeometry args={[0.6, 8, 8]} />
        <meshStandardMaterial color="#ccccdd" metalness={0.8} />
      </mesh>
    </group>
  );
}

// ─── Neon Trim (v2 — thick bars, replaces neon_outline) ──────

export function NeonTrim({
  width,
  height,
  depth,
  color = "#c8e64a",
}: {
  width: number;
  height: number;
  depth: number;
  color?: string;
}) {
  const trimRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!trimRef.current) return;
    const t = state.clock.elapsedTime;
    const intensity = 3 + Math.sin(t * 1.5) * 1;
    trimRef.current.children.forEach((child) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat?.emissiveIntensity !== undefined) mat.emissiveIntensity = intensity;
    });
  });

  const barThickness = 2;
  const hw = width / 2 + barThickness / 2;
  const hd = depth / 2 + barThickness / 2;
  const levels = [height * 0.33, height * 0.66, height - 1];

  return (
    <group>
      {levels.map((y, li) => (
        <group ref={li === 0 ? trimRef : undefined} key={li} position={[0, y, 0]}>
          <mesh position={[0, 0, hd]}>
            <boxGeometry args={[width + barThickness * 2, barThickness, barThickness]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, -hd]}>
            <boxGeometry args={[width + barThickness * 2, barThickness, barThickness]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} toneMapped={false} />
          </mesh>
          <mesh position={[-hw, 0, 0]}>
            <boxGeometry args={[barThickness, barThickness, depth]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} toneMapped={false} />
          </mesh>
          <mesh position={[hw, 0, 0]}>
            <boxGeometry args={[barThickness, barThickness, depth]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Satellite Dish (crown zone) ─────────────────────────────

export function SatelliteDish({
  height,
  width,
  depth,
  color = "#c8e64a",
}: {
  height: number;
  width: number;
  depth: number;
  color?: string;
}) {
  const dishRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!dishRef.current) return;
    dishRef.current.rotation.y = state.clock.elapsedTime * 0.3;
  });

  const dishSize = Math.min(width, depth) * 0.4;

  return (
    <group position={[0, height, 0]}>
      {/* Support pole */}
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[0.5, 0.8, 6, 6]} />
        <meshStandardMaterial color="#666677" metalness={0.7} roughness={0.3} />
      </mesh>
      <group ref={dishRef} position={[0, 7, 0]} rotation={[0.4, 0, 0]}>
        {/* Dish bowl (half sphere approximation) */}
        <mesh>
          <cylinderGeometry args={[dishSize * 0.3, dishSize, 3, 12]} />
          <meshStandardMaterial color="#aaaabb" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Feed horn */}
        <mesh position={[0, 3, 0]}>
          <cylinderGeometry args={[0.3, 0.6, 4, 6]} />
          <meshStandardMaterial color="#888899" />
        </mesh>
        {/* Signal light */}
        <mesh position={[0, 5.5, 0]}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Crown Item (crown zone — premium) ──────────────────────

export function CrownItem({
  height,
  color = "#ffd700",
}: {
  height: number;
  color?: string;
}) {
  const crownRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!crownRef.current) return;
    const t = state.clock.elapsedTime;
    crownRef.current.position.y = height + 8 + Math.sin(t * 1.5) * 1.5;
    crownRef.current.rotation.y = t * 0.5;
  });

  return (
    <group ref={crownRef} position={[0, height + 8, 0]}>
      {/* Crown base ring */}
      <mesh>
        <cylinderGeometry args={[6, 6, 3, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* Crown points (4 pillars) */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 5, 4, Math.sin(angle) * 5]}>
            <boxGeometry args={[2, 5, 2]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
          </mesh>
        );
      })}
      {/* Glow */}
      <pointLight color={color} intensity={60} distance={80} />
    </group>
  );
}

// ─── Pool Party (roof zone — premium) ───────────────────────

export function PoolParty({
  height,
  width,
  depth,
}: {
  height: number;
  width: number;
  depth: number;
}) {
  const waterRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!waterRef.current) return;
    const mat = waterRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1.5 + Math.sin(state.clock.elapsedTime * 2) * 0.3;
  });

  const poolW = width * 0.7;
  const poolD = depth * 0.5;

  return (
    <group position={[0, height, 0]}>
      {/* Pool rim */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[poolW + 2, 1.5, poolD + 2]} />
        <meshStandardMaterial color="#c0c0c8" />
      </mesh>
      {/* Water */}
      <mesh ref={waterRef} position={[0, 1, 0]}>
        <boxGeometry args={[poolW, 0.8, poolD]} />
        <meshStandardMaterial
          color="#40b0e0"
          emissive="#2080c0"
          emissiveIntensity={1.5}
          toneMapped={false}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Lounge chairs (pixelated blocks) */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (poolW / 2 + 2.5), 0.5, 0]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[2, 0.4, 4]} />
            <meshStandardMaterial color="#e0d0a0" />
          </mesh>
          <mesh position={[side * 0.8, 1.2, -1.5]} rotation={[0.3 * side, 0, 0]}>
            <boxGeometry args={[1.5, 1.5, 0.3]} />
            <meshStandardMaterial color="#e0d0a0" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Hologram Ring (aura zone) ──────────────────────────────

export function HologramRing({
  width,
  height,
  depth,
  color = "#c8e64a",
}: {
  width: number;
  height: number;
  depth: number;
  color?: string;
}) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.y = state.clock.elapsedTime * 0.8;
    ringRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
  });

  const radius = Math.max(width, depth) * 0.7;

  return (
    <mesh ref={ringRef} position={[0, height * 0.6, 0]}>
      <torusGeometry args={[radius, 1.5, 8, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
        toneMapped={false}
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── Lightning Aura (aura zone — premium) ───────────────────

export function LightningAura({
  width,
  height,
  depth,
  color = "#c8e64a",
}: {
  width: number;
  height: number;
  depth: number;
  color?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bolts = useRef<THREE.Mesh[]>([]);
  const nextFlash = useRef(0);

  const setBoltRef = useCallback((el: THREE.Mesh | null, idx: number) => {
    if (el) bolts.current[idx] = el;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (t > nextFlash.current) {
      nextFlash.current = t + 0.5 + Math.random() * 2;
      // Flash a random bolt
      const idx = Math.floor(Math.random() * bolts.current.length);
      const bolt = bolts.current[idx];
      if (bolt) {
        const mat = bolt.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 8;
        mat.opacity = 0.9;
        setTimeout(() => {
          mat.emissiveIntensity = 0.5;
          mat.opacity = 0.2;
        }, 100);
      }
    }
  });

  const spread = Math.max(width, depth) * 0.6;

  return (
    <group ref={groupRef}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * spread;
        const z = Math.sin(angle) * spread;
        const boltH = height * 0.4 + Math.random() * height * 0.3;
        const y = height * 0.2 + Math.random() * height * 0.3;
        return (
          <mesh
            key={i}
            ref={(el) => setBoltRef(el, i)}
            position={[x, y + boltH / 2, z]}
          >
            <boxGeometry args={[0.8, boltH, 0.8]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.5}
              toneMapped={false}
              transparent
              opacity={0.2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── LED Banner (faces zone) ─────────────────────────────────

export function LEDBanner({
  height,
  width,
  depth,
  color = "#c8e64a",
}: {
  height: number;
  width: number;
  depth: number;
  color?: string;
}) {
  const bannerRef = useRef<THREE.Group>(null);
  const offsetRef = useRef(0);

  useFrame((_, delta) => {
    offsetRef.current += delta * 0.5;
    if (!bannerRef.current) return;
    // Scroll effect via UV offset (simulated via position)
    bannerRef.current.children.forEach((child) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat?.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = 2 + Math.sin(offsetRef.current * 3) * 0.5;
      }
    });
  });

  const bannerH = 3;
  const y = height * 0.45;
  const hw = width / 2 + 0.3;
  const hd = depth / 2 + 0.3;

  return (
    <group ref={bannerRef}>
      {/* Front face banner */}
      <mesh position={[0, y, hd]}>
        <boxGeometry args={[width, bannerH, 0.5]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* Back face banner */}
      <mesh position={[0, y, -hd]}>
        <boxGeometry args={[width, bannerH, 0.5]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* Side banners */}
      <mesh position={[hw, y, 0]}>
        <boxGeometry args={[0.5, bannerH, depth]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <mesh position={[-hw, y, 0]}>
        <boxGeometry args={[0.5, bannerH, depth]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
      </mesh>
    </group>
  );
}
