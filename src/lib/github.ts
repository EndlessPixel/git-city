// ─── Types ───────────────────────────────────────────────────

export interface DeveloperRecord {
  id: number;
  github_login: string;
  github_id: number | null;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  contributions: number;
  public_repos: number;
  total_stars: number;
  primary_language: string | null;
  top_repos: TopRepo[];
  rank: number | null;
  fetched_at: string;
  created_at: string;
  claimed: boolean;
  fetch_priority: number;
  claimed_at: string | null;
  owned_items?: string[];
  custom_color?: string | null;
  billboard_images?: string[];
}

export interface TopRepo {
  name: string;
  stars: number;
  language: string | null;
  url: string;
}

export interface CityBuilding {
  login: string;
  rank: number;
  contributions: number;
  total_stars: number;
  public_repos: number;
  name: string | null;
  avatar_url: string | null;
  primary_language: string | null;
  claimed: boolean;
  owned_items: string[];
  custom_color?: string | null;
  billboard_images?: string[];
  achievements: string[];
  kudos_count: number;
  loadout?: { crown: string | null; roof: string | null; aura: string | null } | null;
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  floors: number;
  windowsPerFloor: number;
  sideWindowsPerFloor: number;
  litPercentage: number;
}

export interface CityPlaza {
  position: [number, number, number];
  size: number;
  variant: number; // 0-1 seeded random for visual variety
}

export interface CityDecoration {
  type: 'tree' | 'streetLamp' | 'car' | 'bench' | 'fountain' | 'sidewalk';
  position: [number, number, number];
  rotation: number;
  variant: number;
  size?: [number, number];
}

// ─── Spiral Coordinate ──────────────────────────────────────

function spiralCoord(index: number): [number, number] {
  if (index === 0) return [0, 0];

  let x = 0,
    y = 0,
    dx = 1,
    dy = 0;
  let segLen = 1,
    segPassed = 0,
    turns = 0;

  for (let i = 0; i < index; i++) {
    x += dx;
    y += dy;
    segPassed++;
    if (segPassed === segLen) {
      segPassed = 0;
      // turn left
      const tmp = dx;
      dx = -dy;
      dy = tmp;
      turns++;
      if (turns % 2 === 0) segLen++;
    }
  }
  return [x, y];
}

// ─── City Layout ─────────────────────────────────────────────

const BLOCK_SIZE_DOWNTOWN = 3; // 3x3 grid inside block
const BLOCK_SIZE_SUBURB = 2; // 2x2 grid
const DOWNTOWN_RANK_LIMIT = 500;
const STREET_WIDTH = 15;
const AVENUE_WIDTH = 25;
const AVENUE_INTERVAL = 3; // avenue every 3 blocks
const CELL_SPACING = 50; // spacing between buildings within a block

// Spiral slots that become plazas instead of building blocks
const PLAZA_SLOTS = new Set([3, 7, 12, 18, 25, 33, 42]);

const MAX_BUILDING_HEIGHT = 800;

function calcHeight(contributions: number, maxContrib: number): number {
  // Cap reference so one outlier doesn't flatten the entire city
  const effectiveMax = Math.min(maxContrib, 15_000);
  const K = 300 / Math.sqrt(Math.max(1, effectiveMax));
  return Math.min(MAX_BUILDING_HEIGHT, 12 + Math.sqrt(contributions) * K);
}

export function generateCityLayout(devs: DeveloperRecord[]): {
  buildings: CityBuilding[];
  plazas: CityPlaza[];
  decorations: CityDecoration[];
} {
  const buildings: CityBuilding[] = [];
  const plazas: CityPlaza[] = [];
  const decorations: CityDecoration[] = [];
  const maxContrib = devs[0]?.contributions || 1;

  let devIndex = 0;
  let spiralIndex = 0;

  while (devIndex < devs.length) {
    const isDowntown = devIndex < DOWNTOWN_RANK_LIMIT;
    const blockSize = isDowntown ? BLOCK_SIZE_DOWNTOWN : BLOCK_SIZE_SUBURB;

    // Get block position in spiral
    const [bx, by] = spiralCoord(spiralIndex);

    const blockSpacing = CELL_SPACING * blockSize + STREET_WIDTH;

    const avenueExtraX =
      Math.floor(Math.abs(bx) / AVENUE_INTERVAL) *
      (AVENUE_WIDTH - STREET_WIDTH) *
      Math.sign(bx || 1);
    const avenueExtraZ =
      Math.floor(Math.abs(by) / AVENUE_INTERVAL) *
      (AVENUE_WIDTH - STREET_WIDTH) *
      Math.sign(by || 1);

    const blockCenterX = bx * blockSpacing + avenueExtraX;
    const blockCenterZ = by * blockSpacing + avenueExtraZ;

    // Is this a plaza slot?
    if (PLAZA_SLOTS.has(spiralIndex)) {
      plazas.push({
        position: [blockCenterX, 0, blockCenterZ],
        size: CELL_SPACING * blockSize * 0.8,
        variant: seededRandom(spiralIndex * 997),
      });
      spiralIndex++;
      continue; // skip this slot, don't consume devs
    }

    const devsPerBlock = blockSize * blockSize;
    const blockDevs = devs.slice(devIndex, devIndex + devsPerBlock);

    for (let i = 0; i < blockDevs.length; i++) {
      const dev = blockDevs[i];
      const localRow = Math.floor(i / blockSize);
      const localCol = i % blockSize;

      const offsetX = (localCol - (blockSize - 1) / 2) * CELL_SPACING;
      const offsetZ = (localRow - (blockSize - 1) / 2) * CELL_SPACING;

      const posX = blockCenterX + offsetX;
      const posZ = blockCenterZ + offsetZ;

      // Height with dramatic scaling
      const height = calcHeight(dev.contributions, maxContrib);

      // Width/depth: base from repos, variance from seed
      const seed1 = hashStr(dev.github_login);
      const repoFactor = Math.min(1, dev.public_repos / 100); // 0-1 based on repos
      const baseW = 14 + repoFactor * 16; // 14-30 based on repos
      const w = Math.round(baseW + seededRandom(seed1) * 10);
      const d = Math.round(12 + seededRandom(seed1 + 99) * 20); // 12-32, independent of w

      const floorH = 6;
      const floors = Math.max(3, Math.floor(height / floorH));
      const windowsPerFloor = Math.max(3, Math.floor(w / 5));
      const sideWindowsPerFloor = Math.max(3, Math.floor(d / 5));

      // Lit percentage proportional to contributions
      const contribRatio = dev.contributions / maxContrib;
      const litPercentage = 0.2 + contribRatio * 0.7;

      buildings.push({
        login: dev.github_login,
        rank: dev.rank ?? devIndex + i + 1,
        contributions: dev.contributions,
        total_stars: dev.total_stars,
        public_repos: dev.public_repos,
        name: dev.name,
        avatar_url: dev.avatar_url,
        primary_language: dev.primary_language,
        claimed: dev.claimed ?? false,
        owned_items: dev.owned_items ?? [],
        custom_color: dev.custom_color ?? null,
        billboard_images: dev.billboard_images ?? [],
        achievements: (dev as unknown as Record<string, unknown>).achievements as string[] ?? [],
        kudos_count: (dev as unknown as Record<string, unknown>).kudos_count as number ?? 0,
        loadout: (dev as unknown as Record<string, unknown>).loadout as CityBuilding["loadout"] ?? null,
        position: [posX, 0, posZ],
        width: w,
        depth: d,
        height,
        floors,
        windowsPerFloor,
        sideWindowsPerFloor,
        litPercentage,
      });
    }

    // ── Per-block decorations ──
    const blockFootprint = CELL_SPACING * blockSize;

    // Sidewalk around block
    decorations.push({
      type: 'sidewalk',
      position: [blockCenterX, 0.05, blockCenterZ],
      rotation: 0,
      variant: 0,
      size: [blockFootprint + 8, blockFootprint + 8],
    });

    // Street lamps (2-4 per block)
    const lampCount = 2 + Math.floor(seededRandom(spiralIndex * 311) * 3);
    for (let li = 0; li < lampCount; li++) {
      const seed = spiralIndex * 5000 + li;
      const edge = Math.floor(seededRandom(seed) * 4);
      const along = (seededRandom(seed + 50) - 0.5) * blockFootprint;
      let lx = blockCenterX, lz = blockCenterZ;
      if (edge === 0) { lz -= blockFootprint / 2 + 4; lx += along; }
      else if (edge === 1) { lx += blockFootprint / 2 + 4; lz += along; }
      else if (edge === 2) { lz += blockFootprint / 2 + 4; lx += along; }
      else { lx -= blockFootprint / 2 + 4; lz += along; }
      decorations.push({
        type: 'streetLamp',
        position: [lx, 0, lz],
        rotation: 0,
        variant: 0,
      });
    }

    // Parked cars (0-1 per building, ~50% chance)
    for (let bi = 0; bi < blockDevs.length; bi++) {
      const bld = buildings[buildings.length - blockDevs.length + bi];
      const carSeed = hashStr(blockDevs[bi].github_login) + 777;
      if (seededRandom(carSeed) > 0.5) {
        const side = seededRandom(carSeed + 1) > 0.5 ? 1 : -1;
        decorations.push({
          type: 'car',
          position: [bld.position[0] + side * (bld.width / 2 + 4), 0, bld.position[2]],
          rotation: seededRandom(carSeed + 2) > 0.5 ? 0 : Math.PI,
          variant: Math.floor(seededRandom(carSeed + 3) * 4),
        });
      }
    }

    // Street trees (1-2 per block edge)
    const streetTreeCount = 1 + Math.floor(seededRandom(spiralIndex * 421) * 2);
    for (let ti = 0; ti < streetTreeCount; ti++) {
      const seed = spiralIndex * 6000 + ti;
      const edge = Math.floor(seededRandom(seed) * 4);
      const along = (seededRandom(seed + 50) - 0.5) * blockFootprint * 0.8;
      let tx = blockCenterX, tz = blockCenterZ;
      if (edge === 0) { tz -= blockFootprint / 2 + 6; tx += along; }
      else if (edge === 1) { tx += blockFootprint / 2 + 6; tz += along; }
      else if (edge === 2) { tz += blockFootprint / 2 + 6; tx += along; }
      else { tx -= blockFootprint / 2 + 6; tz += along; }
      decorations.push({
        type: 'tree',
        position: [tx, 0, tz],
        rotation: seededRandom(seed + 100) * Math.PI * 2,
        variant: Math.floor(seededRandom(seed + 200) * 3),
      });
    }

    devIndex += blockDevs.length;
    spiralIndex++;
  }

  // ── Plaza decorations ──
  for (let pi = 0; pi < plazas.length; pi++) {
    const plaza = plazas[pi];
    const [px, , pz] = plaza.position;
    const halfSize = plaza.size / 2;

    // Trees: 4-8 per plaza
    const treeCount = 4 + Math.floor(seededRandom(pi * 137 + 7777) * 5);
    for (let t = 0; t < treeCount; t++) {
      const seed = pi * 10000 + t;
      const tx = px + (seededRandom(seed) - 0.5) * halfSize * 1.6;
      const tz = pz + (seededRandom(seed + 50) - 0.5) * halfSize * 1.6;
      decorations.push({
        type: 'tree',
        position: [tx, 0, tz],
        rotation: seededRandom(seed + 100) * Math.PI * 2,
        variant: Math.floor(seededRandom(seed + 200) * 3),
      });
    }

    // Benches: 2-3 per plaza
    const benchCount = 2 + Math.floor(seededRandom(pi * 251 + 8888) * 2);
    for (let b = 0; b < benchCount; b++) {
      const seed = pi * 20000 + b;
      const bx = px + (seededRandom(seed) - 0.5) * halfSize;
      const bz = pz + (seededRandom(seed + 50) - 0.5) * halfSize;
      decorations.push({
        type: 'bench',
        position: [bx, 0, bz],
        rotation: seededRandom(seed + 100) * Math.PI * 2,
        variant: 0,
      });
    }

    // Fountain in first plaza
    if (pi === 0) {
      decorations.push({
        type: 'fountain',
        position: [px, 0, pz],
        rotation: 0,
        variant: 0,
      });
    }
  }

  return { buildings, plazas, decorations };
}

// ─── Building Dimensions (reusable for shop preview) ────────

export function calcBuildingDims(
  githubLogin: string,
  contributions: number,
  publicRepos: number,
  maxContrib: number
): { width: number; height: number; depth: number } {
  const height = calcHeight(contributions, maxContrib);
  const seed1 = hashStr(githubLogin);
  const repoFactor = Math.min(1, publicRepos / 100);
  const baseW = 14 + repoFactor * 16;
  const width = Math.round(baseW + seededRandom(seed1) * 10);
  const depth = Math.round(12 + seededRandom(seed1 + 99) * 20);
  return { width, height, depth };
}

// ─── Utilities (kept for Building3D seeded variance) ─────────

export function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function seededRandom(seed: number): number {
  const s = (seed * 16807) % 2147483647;
  return (s - 1) / 2147483646;
}
