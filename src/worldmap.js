// The overworld: one region per World Cup, one stadium node per level (same
// order as LEVELS), joined by a path Neymario walks along. Pure data, shared
// by the game rules (walking) and the renderer (drawing).

export const MAP_W = 1024;

export const REGIONS = [
  { id: '2014', name: 'COPA 2014 - BRASIL', x0: 0, x1: 256, theme: 'brazil' },
  { id: '2018', name: 'COPA 2018 - RUSSIA', x0: 256, x1: 512, theme: 'russia' },
  { id: '2022', name: 'COPA 2022 - QATAR', x0: 512, x1: 768, theme: 'qatar' },
  { id: 'final', name: 'THE FINAL', x0: 768, x1: 1024, theme: 'final' },
];

export const NODES = [
  { x: 36, y: 184 },
  { x: 84, y: 132 },
  { x: 140, y: 176 },
  { x: 180, y: 112 },
  { x: 228, y: 156 },
  { x: 292, y: 180 },
  { x: 336, y: 120 },
  { x: 392, y: 164 },
  { x: 436, y: 104 },
  { x: 484, y: 150 },
  { x: 560, y: 180 },
  { x: 628, y: 120 },
  { x: 700, y: 168 },
  { x: 822, y: 156 },
  { x: 932, y: 116 },
];

/** Waypoints from node `a` to the adjacent node `b`: across first, then up or down, like the NES maps. */
export function pathBetween(a, b) {
  const from = NODES[a];
  const to = NODES[b];
  // Going backwards retraces the same L-shaped path in reverse.
  if (b < a) return pathBetween(b, a).reverse();
  return [{ x: from.x, y: from.y }, { x: to.x, y: from.y }, { x: to.x, y: to.y }];
}

export const regionAt = (x) => REGIONS.find((r) => x >= r.x0 && x < r.x1) ?? REGIONS.at(-1);
