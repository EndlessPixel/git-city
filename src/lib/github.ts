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
  top_repos?: TopRepo[];
  rank: number | null;
  fetched_at: string;
  created_at: string;
  claimed: boolean;
  fetch_priority: number;
  claimed_at: string | null;
  owned_items?: string[];
  custom_color?: string | null;
  billboard_images?: string[];
  // v2 fields (optional for backward compat)
  contributions_total?: number;
  contribution_years?: number[];
  total_prs?: number;
  total_reviews?: number;
  total_issues?: number;
  repos_contributed_to?: number;
  followers?: number;
  following?: number;
  organizations_count?: number;
  account_created_at?: string | null;
  current_streak?: number;
  longest_streak?: number;
  active_days_last_year?: number;
  language_diversity?: number;
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
  visit_count: number;
  loadout?: { crown: string | null; roof: string | null; aura: string | null } | null;
  app_streak: number;
  raid_xp: number;
  current_week_contributions: number;
  current_week_kudos_given: number;
  current_week_kudos_received: number;
  active_raid_tag?: { attacker_login: string; tag_style: string; expires_at: string } | null;
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
  type: 'tree' | 'streetLamp' | 'car' | 'bench' | 'fountain' | 'sidewalk' | 'roadMarking';
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

const BLOCK_SIZE = 4;     // 4x4 buildings per city block
const LOT_W = 46;        // lot width  (X axis) — fits max building (40) + 3 each side
const LOT_D = 40;        // lot depth  (Z axis) — fits max building (34) + 3 each side
const ALLEY_W = 4;       // narrow gap between buildings within a block
const STREET_W = 25;     // street between blocks
const AVENUE_W = 50;     // wide avenue (every AVENUE_EVERY-th gap)
const AVENUE_EVERY = 4;  // avenue frequency

// Derived: total block footprint
const BLOCK_FOOTPRINT_X = BLOCK_SIZE * LOT_W + (BLOCK_SIZE - 1) * ALLEY_W; // 4*46 + 3*4 = 196
const BLOCK_FOOTPRINT_Z = BLOCK_SIZE * LOT_D + (BLOCK_SIZE - 1) * ALLEY_W; // 4*40 + 3*4 = 172

// Spiral slots that become plazas instead of building blocks
const PLAZA_SLOTS = new Set([3, 7, 12, 18, 25, 33, 42, 52, 63, 75, 88, 102]);

const MAX_BUILDING_HEIGHT = 600;
const MIN_BUILDING_HEIGHT = 10;
const HEIGHT_RANGE = MAX_BUILDING_HEIGHT - MIN_BUILDING_HEIGHT; // 590

function calcHeight(
  contributions: number,
  totalStars: number,
  publicRepos: number,
  maxContrib: number,
  maxStars: number,
): { height: number; composite: number } {
  const effMaxC = Math.min(maxContrib, 20_000);
  const effMaxS = Math.min(maxStars, 200_000);

  // Normalize to 0-1 (can exceed 1 for outliers)
  const cNorm = contributions / Math.max(1, effMaxC);
  const sNorm = totalStars / Math.max(1, effMaxS);
  const rNorm = Math.min(publicRepos / 200, 1);

  // Power curves — exponent < 1 compresses, > 0.5 gives more contrast than sqrt
  const cScore = Math.pow(Math.min(cNorm, 3), 0.55);   // contributions (allow up to 3x max)
  const sScore = Math.pow(Math.min(sNorm, 3), 0.45);   // stars (more generous curve)
  const rScore = Math.pow(rNorm, 0.5);                   // repos

  // Weights: contributions dominate, but stars matter a lot
  const composite = cScore * 0.55 + sScore * 0.35 + rScore * 0.10;

  const height = Math.min(MAX_BUILDING_HEIGHT, MIN_BUILDING_HEIGHT + composite * HEIGHT_RANGE);
  return { height, composite };
}

// ─── V2 Detection & Formulas ────────────────────────────────

function isV2Dev(dev: DeveloperRecord): boolean {
  return (dev.contributions_total ?? 0) > 0;
}

function calcHeightV2(
  dev: DeveloperRecord,
  maxContribV2: number,
  maxStars: number,
): { height: number; composite: number } {
  const contribs = dev.contributions_total! > 0 ? dev.contributions_total! : dev.contributions;

  const cNorm = contribs / Math.max(1, Math.min(maxContribV2, 50_000));
  const sNorm = dev.total_stars / Math.max(1, Math.min(maxStars, 200_000));
  const prNorm = ((dev.total_prs ?? 0) + (dev.total_reviews ?? 0)) / 5_000;
  const extNorm = (dev.repos_contributed_to ?? 0) / 100;
  const fNorm = Math.log10(Math.max(1, dev.followers ?? 0)) / Math.log10(50_000);

  // Consistency: years active / account age
  const accountAgeYears = Math.max(1,
    (Date.now() - new Date(dev.account_created_at || dev.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  const yearsActive = dev.contribution_years?.length || 1;
  const consistencyRaw = (yearsActive / accountAgeYears) * Math.min(1, contribs / (accountAgeYears * 200));
  const consistencyNorm = Math.min(1, consistencyRaw);

  const cScore = Math.pow(Math.min(cNorm, 3), 0.55);
  const sScore = Math.pow(Math.min(sNorm, 3), 0.45);
  const prScore = Math.pow(Math.min(prNorm, 2), 0.5);
  const extScore = Math.pow(Math.min(extNorm, 2), 0.5);
  const fScore = Math.pow(Math.min(fNorm, 2), 0.5);
  const cnsScore = Math.pow(consistencyNorm, 0.6);

  const composite =
    cScore  * 0.35 +
    sScore  * 0.20 +
    prScore * 0.15 +
    extScore * 0.10 +
    cnsScore * 0.10 +
    fScore  * 0.10;

  const height = Math.min(MAX_BUILDING_HEIGHT, MIN_BUILDING_HEIGHT + composite * HEIGHT_RANGE);
  return { height, composite };
}

function calcWidthV2(dev: DeveloperRecord): number {
  const repoNorm = Math.min(1, dev.public_repos / 200);
  const langNorm = Math.min(1, (dev.language_diversity ?? 1) / 10);
  const topStarNorm = Math.min(1, (dev.top_repos?.[0]?.stars ?? 0) / 50_000);

  const score =
    Math.pow(repoNorm, 0.5) * 0.50 +
    Math.pow(langNorm, 0.6) * 0.30 +
    Math.pow(topStarNorm, 0.4) * 0.20;

  const jitter = (seededRandom(hashStr(dev.github_login)) - 0.5) * 4;
  return Math.round(14 + score * 24 + jitter);
}

function calcDepthV2(dev: DeveloperRecord): number {
  const extNorm = Math.min(1, (dev.repos_contributed_to ?? 0) / 100);
  const orgNorm = Math.min(1, (dev.organizations_count ?? 0) / 10);
  const prNorm = Math.min(1, (dev.total_prs ?? 0) / 1_000);
  const ratioNorm = (dev.followers ?? 0) > 0
    ? Math.min(1, ((dev.followers ?? 0) / Math.max(1, dev.following ?? 1)) / 10)
    : 0;

  const score =
    Math.pow(extNorm, 0.5) * 0.40 +
    Math.pow(orgNorm, 0.5) * 0.25 +
    Math.pow(prNorm, 0.5) * 0.20 +
    Math.pow(ratioNorm, 0.5) * 0.15;

  const jitter = (seededRandom(hashStr(dev.github_login) + 99) - 0.5) * 4;
  return Math.round(12 + score * 20 + jitter);
}

function calcLitPercentageV2(dev: DeveloperRecord): number {
  const activeDaysNorm = Math.min(1, (dev.active_days_last_year ?? 0) / 300);
  const streakNorm = Math.min(1, (dev.current_streak ?? 0) / 100);

  const avgPerYear = (dev.contributions_total ?? 0) / Math.max(1, dev.contribution_years?.length ?? 1);
  const trendRaw = avgPerYear > 0 ? dev.contributions / avgPerYear : 1;
  const trendNorm = Math.min(2, Math.max(0, trendRaw)) / 2;

  const score =
    activeDaysNorm * 0.60 +
    streakNorm * 0.25 +
    trendNorm * 0.15;

  return 0.05 + score * 0.90;
}

export interface CityRiver {
  x: number;
  width: number;
  length: number;
  centerZ: number;
}

export interface CityBridge {
  position: [number, number, number];
  width: number;
}

const RIVER_WIDTH = 40;

// Compute block center position along one axis.
// Each block occupies `footprint` units; between blocks there's a street.
// Every AVENUE_EVERY-th gap is an avenue (wider).
function blockAxisPos(idx: number, footprint: number): number {
  if (idx === 0) return 0;
  const abs = Math.abs(idx);
  const sign = idx >= 0 ? 1 : -1;
  const numAvenues = Math.floor(abs / AVENUE_EVERY);
  const numStreets = abs - numAvenues;
  return sign * (abs * footprint + numStreets * STREET_W + numAvenues * AVENUE_W);
}

export function generateCityLayout(devs: DeveloperRecord[]): {
  buildings: CityBuilding[];
  plazas: CityPlaza[];
  decorations: CityDecoration[];
  river: CityRiver;
  bridges: CityBridge[];
} {
  const buildings: CityBuilding[] = [];
  const plazas: CityPlaza[] = [];
  const decorations: CityDecoration[] = [];
  const maxContrib = devs[0]?.contributions || 1;
  const maxStars = devs.reduce((max, d) => Math.max(max, d.total_stars), 1);
  const maxContribV2 = devs.reduce((max, d) => Math.max(max, d.contributions_total ?? 0), 1);

  // River runs along Z axis, between block col -1 and col -2.
  // Instead of skipping blocks, we shift all blocks beyond the river further out
  // to create exactly RIVER_WIDTH of space.
  const RIVER_COL = -1; // river sits after this block column (between -1 and -2)
  const riverShift = RIVER_WIDTH - STREET_W; // extra space beyond normal street gap
  const block1Edge = blockAxisPos(RIVER_COL, BLOCK_FOOTPRINT_X) - BLOCK_FOOTPRINT_X / 2; // left edge of block -1
  const riverMaxX = block1Edge;
  const riverMinX = riverMaxX - RIVER_WIDTH;
  const riverX = riverMinX;

  let devIndex = 0;
  let spiralIndex = 0;

  // Track block positions for road marking generation
  const blockCenters: { cx: number; cz: number; bx: number; by: number }[] = [];

  while (devIndex < devs.length) {
    const [bx, by] = spiralCoord(spiralIndex);
    let blockCX = blockAxisPos(bx, BLOCK_FOOTPRINT_X);
    const blockCZ = blockAxisPos(by, BLOCK_FOOTPRINT_Z);

    // Shift blocks on the far side of the river to make room
    if (bx <= RIVER_COL - 1) {
      blockCX -= riverShift;
    }

    // Plaza check
    if (PLAZA_SLOTS.has(spiralIndex)) {
      plazas.push({
        position: [blockCX, 0, blockCZ],
        size: Math.min(BLOCK_FOOTPRINT_X, BLOCK_FOOTPRINT_Z) * 0.8,
        variant: seededRandom(spiralIndex * 997),
      });
      spiralIndex++;
      continue;
    }

    // Fill this block with up to BLOCK_SIZE x BLOCK_SIZE buildings
    const devsPerBlock = BLOCK_SIZE * BLOCK_SIZE;
    const blockDevs = devs.slice(devIndex, devIndex + devsPerBlock);

    for (let i = 0; i < blockDevs.length; i++) {
      const dev = blockDevs[i];
      const localRow = Math.floor(i / BLOCK_SIZE);
      const localCol = i % BLOCK_SIZE;

      // Position within block: lots separated by ALLEY_W
      const cellStepX = LOT_W + ALLEY_W;
      const cellStepZ = LOT_D + ALLEY_W;
      const offsetX = (localCol - (BLOCK_SIZE - 1) / 2) * cellStepX;
      const offsetZ = (localRow - (BLOCK_SIZE - 1) / 2) * cellStepZ;

      const posX = blockCX + offsetX;
      const posZ = blockCZ + offsetZ;

      let height: number, composite: number, w: number, d: number, litPercentage: number;

      if (isV2Dev(dev)) {
        ({ height, composite } = calcHeightV2(dev, maxContribV2, maxStars));
        w = calcWidthV2(dev);
        d = calcDepthV2(dev);
        litPercentage = calcLitPercentageV2(dev);
      } else {
        ({ height, composite } = calcHeight(dev.contributions, dev.total_stars, dev.public_repos, maxContrib, maxStars));
        const seed1 = hashStr(dev.github_login);
        const repoFactor = Math.min(1, dev.public_repos / 100);
        const baseW = 14 + repoFactor * 12;
        w = Math.round(baseW + seededRandom(seed1) * 8);
        d = Math.round(12 + seededRandom(seed1 + 99) * 16);
        litPercentage = 0.2 + composite * 0.7;
      }

      const floorH = 6;
      const floors = Math.max(3, Math.floor(height / floorH));
      const windowsPerFloor = Math.max(3, Math.floor(w / 5));
      const sideWindowsPerFloor = Math.max(3, Math.floor(d / 5));

      buildings.push({
        login: dev.github_login,
        rank: dev.rank ?? devIndex + i + 1,
        contributions: (dev.contributions_total && dev.contributions_total > 0) ? dev.contributions_total : dev.contributions,
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
        visit_count: (dev as unknown as Record<string, unknown>).visit_count as number ?? 0,
        loadout: (dev as unknown as Record<string, unknown>).loadout as CityBuilding["loadout"] ?? null,
        app_streak: (dev as unknown as Record<string, unknown>).app_streak as number ?? 0,
        raid_xp: (dev as unknown as Record<string, unknown>).raid_xp as number ?? 0,
        current_week_contributions: (dev as unknown as Record<string, unknown>).current_week_contributions as number ?? 0,
        current_week_kudos_given: (dev as unknown as Record<string, unknown>).current_week_kudos_given as number ?? 0,
        current_week_kudos_received: (dev as unknown as Record<string, unknown>).current_week_kudos_received as number ?? 0,
        active_raid_tag: (dev as unknown as Record<string, unknown>).active_raid_tag as CityBuilding["active_raid_tag"] ?? null,
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

    // Sidewalk around the entire block
    const blockInRiver = (blockCX + BLOCK_FOOTPRINT_X / 2 + 4) > riverMinX &&
                         (blockCX - BLOCK_FOOTPRINT_X / 2 - 4) < riverMaxX;
    if (!blockInRiver) {
      decorations.push({
        type: 'sidewalk',
        position: [blockCX, 0.1, blockCZ],
        rotation: 0,
        variant: 0,
        size: [BLOCK_FOOTPRINT_X + 8, BLOCK_FOOTPRINT_Z + 8],
      });
    }

    // Street lamps (2-4 per block, on block edges)
    const lampCount = 2 + Math.floor(seededRandom(spiralIndex * 311) * 3);
    for (let li = 0; li < lampCount; li++) {
      const seed = spiralIndex * 5000 + li;
      const edge = Math.floor(seededRandom(seed) * 4);
      const alongX = (seededRandom(seed + 50) - 0.5) * BLOCK_FOOTPRINT_X;
      const alongZ = (seededRandom(seed + 50) - 0.5) * BLOCK_FOOTPRINT_Z;
      let lx = blockCX, lz = blockCZ;
      if (edge === 0) { lz -= BLOCK_FOOTPRINT_Z / 2 + 4; lx += alongX; }
      else if (edge === 1) { lx += BLOCK_FOOTPRINT_X / 2 + 4; lz += alongZ; }
      else if (edge === 2) { lz += BLOCK_FOOTPRINT_Z / 2 + 4; lx += alongX; }
      else { lx -= BLOCK_FOOTPRINT_X / 2 + 4; lz += alongZ; }
      if (lx > riverMinX - 5 && lx < riverMaxX + 5) continue;
      decorations.push({
        type: 'streetLamp',
        position: [lx, 0, lz],
        rotation: 0,
        variant: 0,
      });
    }

    // Parked cars (~40% per building, on the street side)
    for (let bi = 0; bi < blockDevs.length; bi++) {
      const bld = buildings[buildings.length - blockDevs.length + bi];
      const carSeed = hashStr(blockDevs[bi].github_login) + 777;
      if (seededRandom(carSeed) > 0.6) {
        const side = seededRandom(carSeed + 1) > 0.5 ? 1 : -1;
        const carX = bld.position[0] + side * (bld.width / 2 + 6);
        if (carX > riverMinX - 5 && carX < riverMaxX + 5) continue;
        decorations.push({
          type: 'car',
          position: [carX, 0, bld.position[2]],
          rotation: seededRandom(carSeed + 2) > 0.5 ? 0 : Math.PI,
          variant: Math.floor(seededRandom(carSeed + 3) * 4),
        });
      }
    }

    // Street trees (1-2 per block edge)
    const treeCount = 1 + Math.floor(seededRandom(spiralIndex * 421) * 2);
    for (let ti = 0; ti < treeCount; ti++) {
      const seed = spiralIndex * 6000 + ti;
      const edge = Math.floor(seededRandom(seed) * 4);
      const alongX = (seededRandom(seed + 50) - 0.5) * BLOCK_FOOTPRINT_X * 0.8;
      const alongZ = (seededRandom(seed + 50) - 0.5) * BLOCK_FOOTPRINT_Z * 0.8;
      let tx = blockCX, tz = blockCZ;
      if (edge === 0) { tz -= BLOCK_FOOTPRINT_Z / 2 + 6; tx += alongX; }
      else if (edge === 1) { tx += BLOCK_FOOTPRINT_X / 2 + 6; tz += alongZ; }
      else if (edge === 2) { tz += BLOCK_FOOTPRINT_Z / 2 + 6; tx += alongX; }
      else { tx -= BLOCK_FOOTPRINT_X / 2 + 6; tz += alongZ; }
      if (tx > riverMinX - 5 && tx < riverMaxX + 5) continue;
      decorations.push({
        type: 'tree',
        position: [tx, 0, tz],
        rotation: seededRandom(seed + 100) * Math.PI * 2,
        variant: Math.floor(seededRandom(seed + 200) * 3),
      });
    }

    blockCenters.push({ cx: blockCX, cz: blockCZ, bx, by });
    devIndex += blockDevs.length;
    spiralIndex++;
  }

  // ── Road markings (dashed center lines between blocks) ──
  const DASH_LENGTH = 6;
  const DASH_GAP = 8;
  const DASH_STEP = DASH_LENGTH + DASH_GAP;

  const blockByGrid = new Map<string, typeof blockCenters[0]>();
  for (const b of blockCenters) {
    blockByGrid.set(`${b.bx},${b.by}`, b);
  }

  for (const block of blockCenters) {
    const halfX = BLOCK_FOOTPRINT_X / 2;
    const halfZ = BLOCK_FOOTPRINT_Z / 2;

    // Right road (vertical dashes along Z) — between this block and bx+1
    const right = blockByGrid.get(`${block.bx + 1},${block.by}`);
    if (right) {
      const roadCenterX = (block.cx + halfX + right.cx - BLOCK_FOOTPRINT_X / 2) / 2;
      if (!(roadCenterX + 2 > riverMinX && roadCenterX - 2 < riverMaxX)) {
        const zMin = Math.min(block.cz, right.cz) - Math.max(halfZ, BLOCK_FOOTPRINT_Z / 2);
        const zMax = Math.max(block.cz, right.cz) + Math.max(halfZ, BLOCK_FOOTPRINT_Z / 2);
        for (let z = zMin; z <= zMax; z += DASH_STEP) {
          decorations.push({
            type: 'roadMarking',
            position: [roadCenterX, 0.2, z],
            rotation: 0,
            variant: 0,
            size: [2, DASH_LENGTH],
          });
        }
      }
    }

    // Bottom road (horizontal dashes along X) — between this block and by+1
    const bottom = blockByGrid.get(`${block.bx},${block.by + 1}`);
    if (bottom) {
      const roadCenterZ = (block.cz + halfZ + bottom.cz - BLOCK_FOOTPRINT_Z / 2) / 2;
      const xMin = Math.min(block.cx, bottom.cx) - Math.max(halfX, BLOCK_FOOTPRINT_X / 2);
      const xMax = Math.max(block.cx, bottom.cx) + Math.max(halfX, BLOCK_FOOTPRINT_X / 2);
      for (let x = xMin; x <= xMax; x += DASH_STEP) {
        if (x + 2 > riverMinX && x - 2 < riverMaxX) continue;
        decorations.push({
          type: 'roadMarking',
          position: [x, 0.2, roadCenterZ],
          rotation: Math.PI / 2,
          variant: 0,
          size: [2, DASH_LENGTH],
        });
      }
    }
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

  // ── River data — length matches city extent ──
  let minZ = 0, maxZ = 0;
  for (const b of buildings) {
    if (b.position[2] < minZ) minZ = b.position[2];
    if (b.position[2] > maxZ) maxZ = b.position[2];
  }
  const riverPadding = 80;
  const riverLength = (maxZ - minZ) + riverPadding * 2;
  const riverCenterZ = (minZ + maxZ) / 2;
  const river: CityRiver = { x: riverX, width: RIVER_WIDTH, length: riverLength, centerZ: riverCenterZ };

  // ── Bridges (2: one near downtown, one further out) ──
  const bridgeWidth = RIVER_WIDTH + 20;
  const bridges: CityBridge[] = [
    { position: [riverX + RIVER_WIDTH / 2, 0, 0], width: bridgeWidth },
    { position: [riverX + RIVER_WIDTH / 2, 0, blockAxisPos(3, BLOCK_FOOTPRINT_Z)], width: bridgeWidth },
  ];

  return { buildings, plazas, decorations, river, bridges };
}

// ─── Building Dimensions (reusable for shop preview) ────────

export function calcBuildingDims(
  githubLogin: string,
  contributions: number,
  publicRepos: number,
  totalStars: number,
  maxContrib: number,
  maxStars: number,
  v2Data?: Partial<DeveloperRecord>,
): { width: number; height: number; depth: number } {
  // V2 path when expanded data is available
  if (v2Data && (v2Data.contributions_total ?? 0) > 0) {
    const dev: DeveloperRecord = {
      id: 0, github_login: githubLogin, github_id: null, name: null,
      avatar_url: null, bio: null, contributions, public_repos: publicRepos,
      total_stars: totalStars, primary_language: null, top_repos: [],
      rank: null, fetched_at: '', created_at: '', claimed: false,
      fetch_priority: 0, claimed_at: null,
      ...v2Data,
    };
    const { height } = calcHeightV2(dev, maxContrib, maxStars);
    return { width: calcWidthV2(dev), height, depth: calcDepthV2(dev) };
  }

  // V1 fallback
  const { height } = calcHeight(contributions, totalStars, publicRepos, maxContrib, maxStars);
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
