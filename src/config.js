export const VOXEL = 0.2;
export const DAY_SECONDS = 86400;
export const INITIAL_TIME = 9 * 3600 + 23 * 60;
export const BASE_TIME_RATE = 60; // 1×：现实 1 秒推进工地时间 1 分钟

export const SCHEDULE = Object.freeze({
  PREP_START: 6 * 3600,
  WORK_START: 7 * 3600,
  WORK_END: 17 * 3600 + 30 * 60,
  CLOSE_END: 18 * 3600 + 15 * 60,
});

export const SITE = Object.freeze({
  minX: -56,
  maxX: 56,
  minZ: -42,
  maxZ: 42,
  gate: { x: 8, z: 41 },
  building: { x: -12, z: -10, width: 28, depth: 20, roofY: 17.4 },
  crane: { x: 12, z: -14, height: 34, source: { x: 18, z: 0 }, target: { x: -10, z: -10 } },
  truckLoad: { x: 28, z: 25 },
  truckUnload: { x: -36, z: 10 },
  palletSources: [{ x: 22, z: 12 }, { x: 26, z: 12 }, { x: 30, z: 12 }],
  palletReserve: [{ x: 22, z: 6 }, { x: 26, z: 6 }, { x: 30, z: 6 }],
  palletDrops: [{ x: -29, z: 4 }, { x: -29, z: 7 }, { x: -29, z: 10 }],
  buildingDoor: { x: -27, z: -4 },
});

export const PALETTE = Object.freeze({
  soil: 0x8b8068,
  soilDark: 0x655e50,
  sand: 0xb4a17d,
  asphalt: 0x575c59,
  gravel: 0x77766b,
  concrete: 0xb8b8aa,
  concreteLight: 0xd0cfc0,
  concreteDark: 0x858b84,
  rebar: 0x5a5149,
  steel: 0x59676b,
  steelLight: 0x849498,
  scaffold: 0x8c9690,
  net: 0x3d8978,
  yellow: 0xe8a928,
  yellowLight: 0xf4c54d,
  orange: 0xd9752b,
  red: 0xb84c3f,
  white: 0xe5e2d5,
  dark: 0x263237,
  rubber: 0x252b2c,
  glass: 0x5f8f9b,
  blue: 0x397183,
  wood: 0x9b7145,
  woodLight: 0xc39760,
  vest: 0xe9c33e,
  skin: 0xb98764,
  vegetation: 0x60785a,
  vegetationLight: 0x7f9367,
});

export function snap(value) {
  return Math.round(value / VOXEL) * VOXEL;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value) {
  return clamp(value, 0, 1);
}

export function smooth(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function normalizeTime(seconds) {
  return mod(seconds, DAY_SECONDS);
}

export function formatTime(seconds) {
  const value = Math.floor(normalizeTime(seconds));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
