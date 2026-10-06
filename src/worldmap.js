// The overworld: one panel per World Cup, each a real map of the host country
// (the Final is France, Mbappé's home turf). Every stadium node sits on its
// real host city. Pure data, shared by the game rules (walking) and the
// renderer (drawing).

export const MAP_W = 1024;
/** Map pixels between the HUD bar and the hint bar. */
export const MAP_TOP = 32;
export const MAP_BOTTOM = 228;

// Each panel is 256 px wide and shows a longitude/latitude window chosen so the
// country isn't stretched (equirectangular, scaled by the cosine of latitude).
export const REGIONS = [
  { id: '2014', name: 'COPA 2014 - BRASIL', x0: 0, x1: 256, theme: 'brazil', host: 'BRA', view: { west: -77, east: -23, north: 6, south: -34 } },
  { id: '2018', name: 'COPA 2018 - RUSSIA', x0: 256, x1: 512, theme: 'russia', host: 'RUS', view: { west: 24, east: 64.7, north: 62, south: 43 } },
  { id: '2022', name: 'COPA 2022 - QATAR', x0: 512, x1: 768, theme: 'qatar', host: 'QAT', view: { west: 49.95, east: 52.55, north: 26.25, south: 24.45 } },
  { id: 'final', name: 'THE FINAL - FRANCE', x0: 768, x1: 1024, theme: 'final', host: 'FRA', view: { west: -7.3, east: 12.4, north: 51.6, south: 41.2 } },
];

export function project(region, lon, lat) {
  const { west, east, north, south } = region.view;
  return {
    x: region.x0 + ((lon - west) / (east - west)) * (region.x1 - region.x0),
    y: MAP_TOP + ((north - lat) / (north - south)) * (MAP_BOTTOM - MAP_TOP),
  };
}

// Host city of each level, in LEVELS order: [region index, label, lat, lon, nudge].
// The nudge (in map pixels) separates stadiums that would otherwise overlap:
// two matches in Fortaleza, and Qatar's three venues a few kilometres apart.
const CITIES = [
  [0, 'SAO PAULO', -23.55, -46.47],
  [0, 'FORTALEZA', -3.81, -38.52],
  [0, 'BRASILIA', -15.78, -47.9],
  [0, 'BELO HORIZONTE', -19.87, -43.97],
  [0, 'FORTALEZA', -3.81, -38.52, [12, 8]],
  [1, 'ROSTOV-ON-DON', 47.21, 39.74],
  [1, 'SAINT PETERSBURG', 59.97, 30.22],
  [1, 'MOSCOW', 55.82, 37.44],
  [1, 'SAMARA', 53.28, 50.24],
  [1, 'KAZAN', 55.82, 49.16],
  [2, 'LUSAIL', 25.42, 51.49, [0, -16]],
  [2, 'DOHA', 25.29, 51.57, [10, 10]],
  [2, 'AL RAYYAN', 25.31, 51.42, [-18, 6]],
  [3, 'MONT-SAINT-MICHEL', 48.64, -1.51],
  [3, 'PARIS', 48.92, 2.36],
];

export const NODES = CITIES.map(([r, city, lat, lon, [dx, dy] = [0, 0]]) => {
  const { x, y } = project(REGIONS[r], lon, lat);
  return { x: Math.round(x + dx), y: Math.round(y + dy), city };
});

/** Waypoints from node `a` to the adjacent node `b`: a straight route between the two cities. */
export function pathBetween(a, b) {
  return [{ x: NODES[a].x, y: NODES[a].y }, { x: NODES[b].x, y: NODES[b].y }];
}

export const regionAt = (x) => REGIONS.find((r) => x >= r.x0 && x < r.x1) ?? REGIONS.at(-1);
