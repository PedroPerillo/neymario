// Draws the overworld: real maps of the host countries (Brazil, Russia, Qatar,
// and France for the Final), the route between stadiums, and Neymario walking
// it. Land, landmarks and labels are painted once into an offscreen canvas;
// waves, boats, snow, lightning and the HUD are drawn every frame.
import { SCREEN_W, SCREEN_H } from './constants.js';
import { MAP_W, MAP_TOP, MAP_BOTTOM, REGIONS, NODES, pathBetween, project, regionAt } from './worldmap.js';
import { GEO } from './geo.js';
import { NEY_SMALL, playerPalette, TROPHY, TROPHY_PAL } from './sprites.js';

const REVEAL_FRAMES = 70;
const BANNER_FRAMES = 150;

const LOOK = {
  brazil: { sea: '#1e70d0', land: '#4caf50', speckle: '#3a9a48', neighbour: '#a9b98a', border: '#2e6a30', label: 'BRASIL', labelAt: [-52, -8] },
  russia: { sea: '#4078b8', land: '#eef3fa', speckle: '#dde8f4', neighbour: '#c4ccb4', border: '#8aa0b8', label: 'RUSSIA', labelAt: [44, 58.6] },
  qatar: { sea: '#2a8ac8', land: '#e6c27a', speckle: '#d4ac62', neighbour: '#d6c69e', border: '#a8884e', label: 'QATAR', labelAt: [51.2, 24.85] },
  final: { sea: '#1a3060', land: '#57506a', speckle: '#4a4460', neighbour: '#3c3a44', border: '#8a7aa0', label: 'FRANCE', labelAt: [2.5, 46.6] },
};

const SUBTITLES = {
  brazil: 'WHERE IT ALL BEGAN',
  russia: 'WHITE NIGHTS AND MATRYOSHKAS',
  qatar: 'DESERT FALCONS AND CONTAINERS',
  final: 'THE DICTATOR AWAITS IN PARIS',
};

const hash = (n) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

const at = (theme, lon, lat) => project(REGIONS.find((r) => r.theme === theme), lon, lat);

let painted = null;

/** Paints land, rivers, landmarks and labels once; also records where the sea is, for waves and boats. */
function paint() {
  const c = document.createElement('canvas');
  c.width = MAP_W;
  c.height = SCREEN_H;
  const g = c.getContext('2d');
  const r = (x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const disc = (x, y, rad, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  };
  const ringPath = (ring) => {
    g.beginPath();
    g.moveTo(ring[0], ring[1]);
    for (let i = 2; i < ring.length; i += 2) g.lineTo(ring[i], ring[i + 1]);
    g.closePath();
  };
  const river = (theme, coords, color, width = 1.5) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    coords.forEach(([lon, lat], i) => {
      const p = at(theme, lon, lat);
      if (i) g.lineTo(p.x, p.y);
      else g.moveTo(p.x, p.y);
    });
    g.stroke();
  };

  for (const region of REGIONS) {
    const look = LOOK[region.theme];
    const geo = GEO[region.theme];
    g.save();
    g.beginPath();
    g.rect(region.x0, MAP_TOP, region.x1 - region.x0, MAP_BOTTOM - MAP_TOP);
    g.clip();
    r(region.x0, MAP_TOP, region.x1 - region.x0, MAP_BOTTOM - MAP_TOP, look.sea);
    for (const ring of geo.others) {
      ringPath(ring);
      g.fillStyle = look.neighbour;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 0.6;
      g.stroke();
    }
    // The host country: textured land, clipped to its own outline.
    g.save();
    g.beginPath();
    for (const ring of geo.host) {
      g.moveTo(ring[0], ring[1]);
      for (let i = 2; i < ring.length; i += 2) g.lineTo(ring[i], ring[i + 1]);
      g.closePath();
    }
    g.fillStyle = look.land;
    g.fill();
    g.clip();
    for (let i = 0; i < 90; i++) {
      disc(region.x0 + hash(i + region.x0) * 256, MAP_TOP + hash(i + 500 + region.x0) * 196, 3 + hash(i + 900) * 6, look.speckle);
    }
    g.restore();
    for (const ring of geo.host) {
      ringPath(ring);
      g.strokeStyle = look.border;
      g.lineWidth = 1;
      g.stroke();
    }
    g.restore();
  }

  // Landmarks and rivers, at their real places.
  // Brazil: the Amazon, Sugarloaf in Rio.
  river('brazil', [[-73, -4.3], [-67, -3.5], [-60, -3.1], [-55, -2.4], [-51.5, -1.2], [-50, -0.2]], '#3a8ad8', 2);
  river('brazil', [[-60, -3.1], [-63, -8], [-65, -10.5]], '#3a8ad8', 1);
  const rio = at('brazil', -43.2, -22.95);
  disc(rio.x + 2, rio.y - 3, 4, '#7a8a6a');
  disc(rio.x - 2, rio.y - 1, 3, '#6a7a5a');
  // Russia: the Volga through Kazan and Samara to the Caspian, pines, St Basil's in Moscow.
  river('russia', [[39.9, 57.6], [44, 56.3], [49.1, 55.8], [49.5, 54.3], [50.1, 53.2], [46, 51.5], [44.5, 48.7], [47.5, 46.6], [48, 46.3]], '#5a9ad8', 1.5);
  const moscow = at('russia', 37.44, 55.82);
  for (let i = 0; i < 40; i++) {
    const p = at('russia', 26 + hash(i + 77) * 37, 45 + hash(i + 177) * 16);
    if (Math.abs(p.x - moscow.x) < 30 && Math.abs(p.y - moscow.y) < 14) continue;
    g.fillStyle = '#2a5a3a';
    g.beginPath();
    g.moveTo(p.x, p.y - 8);
    g.lineTo(p.x + 4, p.y + 2);
    g.lineTo(p.x - 4, p.y + 2);
    g.fill();
    r(p.x - 1, p.y - 8, 2, 2, '#ffffff');
  }
  r(moscow.x - 26, moscow.y - 8, 14, 9, '#c8402a');
  for (const [dx, rad, color] of [[-24, 3, '#2a9a5a'], [-19, 4, '#ffcc1a'], [-14, 3, '#2a6ac8']]) {
    disc(moscow.x + dx, moscow.y - 9, rad, color);
    r(moscow.x + dx, moscow.y - 9 - rad - 3, 1, 3, '#ffcc1a');
  }
  // Qatar: dunes, the Doha skyline by the corniche.
  g.strokeStyle = '#c9a25a';
  g.lineWidth = 1.5;
  for (let i = 0; i < 16; i++) {
    const p = at('qatar', 50.8 + hash(i + 300) * 0.7, 24.6 + hash(i + 330) * 1.3);
    g.beginPath();
    g.arc(p.x, p.y + 8, 8, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
  }
  const doha = at('qatar', 51.53, 25.32);
  for (const [dx, h, w] of [[26, 22, 5], [32, 30, 6], [39, 18, 5], [45, 26, 5], [51, 14, 4]]) {
    r(doha.x + dx, doha.y - h, w, h, '#7a8aa8');
    for (let y = doha.y - h + 3; y < doha.y - 2; y += 4) r(doha.x + dx + 1, y, w - 2, 1, '#ffe08a');
  }
  // France: the Seine, Mont-Saint-Michel on its rock, the Eiffel Tower and the dictator's castle in Paris.
  river('final', [[2.35, 48.86], [1.5, 49.1], [0.1, 49.45]], '#3a5a9a', 1.5);
  const msm = at('final', -1.51, 48.64);
  disc(msm.x - 12, msm.y + 2, 4, '#7a6a5a');
  r(msm.x - 13, msm.y - 7, 2, 7, '#9a8a7a');
  const paris = at('final', 2.36, 48.86);
  g.strokeStyle = '#c8b090';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(paris.x - 22, paris.y + 4);
  g.lineTo(paris.x - 18, paris.y - 18);
  g.lineTo(paris.x - 14, paris.y + 4);
  g.moveTo(paris.x - 21, paris.y - 4);
  g.lineTo(paris.x - 15, paris.y - 4);
  g.stroke();
  r(paris.x + 8, paris.y - 16, 22, 16, '#3a3a4a');
  for (const tx of [6, 16, 28]) r(paris.x + tx, paris.y - 24, 5, 24, '#2a2a3a');
  r(paris.x + 16, paris.y - 8, 6, 8, '#0a0a10');
  for (const [bx, color] of [[10, '#0055a4'], [12, '#ffffff'], [14, '#ef4135']]) r(paris.x + bx, paris.y - 14, 2, 6, color);

  // Country names across the land.
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '8px "Press Start 2P", monospace';
  for (const region of REGIONS) {
    const look = LOOK[region.theme];
    const p = at(region.theme, ...look.labelAt);
    g.fillStyle = region.theme === 'russia' ? 'rgba(60,80,110,0.55)' : 'rgba(255,255,255,0.45)';
    g.fillText(look.label, p.x, p.y);
  }

  // Seams between the World Cups.
  for (const region of REGIONS.slice(1)) {
    r(region.x0 - 2, MAP_TOP, 4, MAP_BOTTOM - MAP_TOP, '#0b1230');
    r(region.x0 - 1, MAP_TOP, 1, MAP_BOTTOM - MAP_TOP, '#ffdf00');
    r(region.x0, MAP_TOP, 1, MAP_BOTTOM - MAP_TOP, '#009c3b');
  }

  // Remember where the sea is, so waves and boats stay on the water.
  const pixels = g.getImageData(0, 0, MAP_W, SCREEN_H).data;
  const seaRgb = Object.fromEntries(Object.entries(LOOK).map(([k, v]) => [k, [1, 3, 5].map((i) => parseInt(v.sea.slice(i, i + 2), 16))]));
  const isSea = (x, y) => {
    const [sr, sg, sb] = seaRgb[regionAt(x).theme];
    const i = (y * MAP_W + x) * 4;
    return pixels[i] === sr && pixels[i + 1] === sg && pixels[i + 2] === sb;
  };
  const seaPoints = [];
  for (let y = MAP_TOP + 4; y < MAP_BOTTOM - 4; y += 7) {
    for (let x = 4; x < MAP_W - 4; x += 9) {
      const jx = x + Math.floor(hash(x * 31 + y) * 6);
      if (isSea(jx, y) && isSea(jx + 4, y)) seaPoints.push({ x: jx, y });
    }
  }
  // Boat lanes: the longest open-water row in Brazil's Atlantic and in the Gulf.
  const lane = (theme) => {
    const region = REGIONS.find((rg) => rg.theme === theme);
    let best = null;
    for (let y = MAP_TOP + 12; y < MAP_BOTTOM - 4; y += 3) {
      let start = null;
      for (let x = region.x0 + 4; x <= region.x1 - 4; x++) {
        const sea = isSea(x, y) && isSea(x, y - 10);
        if (sea && start === null) start = x;
        if ((!sea || x === region.x1 - 4) && start !== null) {
          if (!best || x - start > best.x1 - best.x0) best = { x0: start, x1: x, y };
          start = null;
        }
      }
    }
    return best;
  };
  return { canvas: c, seaPoints, lanes: [lane('brazil'), lane('qatar')].filter(Boolean) };
}

/** Points along a polyline, `spacing` apart, up to `fraction` of its length. */
function dotsAlong(points, spacing, fraction = 1) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const len = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    segs.push([points[i - 1], points[i], len]);
    total += len;
  }
  const out = [];
  const limit = total * fraction;
  for (let d = 0; d <= limit; d += spacing) {
    let rest = d;
    for (const [a, b, len] of segs) {
      if (rest <= len) {
        const k = len ? rest / len : 0;
        out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
        break;
      }
      rest -= len;
    }
  }
  return out;
}

export function drawWorldMap(api, game) {
  const { ctx, rect, text, sprite, blit, panel } = api;
  painted ??= paint();
  const m = game.map;
  const f = game.frame;
  const cam = Math.round(m.camX);
  const visible = (x) => x > cam - 40 && x < cam + SCREEN_W + 40;

  ctx.drawImage(painted.canvas, -cam, 0);

  // ── moving scenery ──
  for (const [i, p] of painted.seaPoints.entries()) {
    if (!visible(p.x)) continue;
    const phase = (f / 3 + i * 7) % 24;
    if (phase < 12) rect(p.x + Math.floor(phase / 3) - cam, p.y, 3, 1, 'rgba(255,255,255,0.45)');
  }
  for (const [k, ln] of painted.lanes.entries()) {
    const span = Math.max(1, ln.x1 - ln.x0 - 12);
    const bx = ln.x0 + 6 + ((f * 0.25 + k * 90) % span);
    if (!visible(bx)) continue;
    const by = ln.y + Math.round(Math.sin(f / 20));
    rect(bx - 6 - cam, by, 12, 3, '#7a4a2a');
    rect(bx - cam, by - 9, 1, 9, '#5a3a1a');
    ctx.fillStyle = k ? '#f2e2c0' : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(bx + 1 - cam, by - 9);
    ctx.lineTo(bx + 7 - cam, by - 2);
    ctx.lineTo(bx + 1 - cam, by - 2);
    ctx.fill();
  }
  // Snow over Russia.
  for (let i = 0; i < 50; i++) {
    const x = 258 + hash(i + 3000) * 252 + Math.sin((f + i * 20) / 30) * 5;
    const y = MAP_TOP + ((hash(i + 3100) * 196 + f * (0.3 + hash(i + 3200) * 0.4)) % 196);
    if (visible(x)) rect(x - cam, y, 1, 1, i % 3 ? '#ffffff' : '#bcd4ee');
  }
  // A storm over the dictator's France: lightning above Paris.
  if (visible(900)) {
    const strike = f % 260;
    if (strike < 10) {
      ctx.fillStyle = `rgba(255,255,255,${strike % 4 < 2 ? 0.3 : 0.12})`;
      ctx.fillRect(768 - cam, MAP_TOP, 256, MAP_BOTTOM - MAP_TOP);
      const paris = at('final', 2.36, 48.86);
      ctx.strokeStyle = '#fff8c0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(paris.x + 30 - cam, MAP_TOP);
      ctx.lineTo(paris.x + 22 - cam, MAP_TOP + 14);
      ctx.lineTo(paris.x + 28 - cam, MAP_TOP + 16);
      ctx.lineTo(paris.x + 18 - cam, paris.y - 26);
      ctx.stroke();
    }
  }
  // Cloud shadows drifting across every map.
  for (let i = 0; i < 6; i++) {
    const cx = ((hash(i + 4000) * MAP_W + f * 0.2) % (MAP_W + 80)) - 40;
    if (!visible(cx)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(cx - cam, MAP_TOP + 30 + hash(i + 4100) * 140, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── the route between stadiums ──
  const unlocked = Math.min(game.save.unlocked, NODES.length - 1, game.levels.length - 1);
  for (let i = 0; i < NODES.length - 1 && i < game.levels.length - 1; i++) {
    let fraction = i < unlocked ? 1 : 0;
    if (m.reveal && i === m.reveal.from) fraction = Math.min(1, m.reveal.t / REVEAL_FRAMES);
    if (fraction === 0) continue;
    const route = pathBetween(i, i + 1);
    const dots = dotsAlong(route, 5, fraction);
    for (const d of dots) {
      if (!visible(d.x)) continue;
      rect(d.x - 1 - cam, d.y, 3, 3, 'rgba(0,0,0,0.35)');
      rect(d.x - 1 - cam, d.y - 1, 3, 3, '#fff4c8');
    }
    // Flights between World Cups get a little plane at the seam.
    const [a, b] = route;
    const seam = REGIONS.find((rg) => a.x < rg.x0 && b.x >= rg.x0);
    if (seam && fraction === 1) {
      const y = Math.round(a.y + ((b.y - a.y) * (seam.x0 - a.x)) / (b.x - a.x));
      const px = seam.x0 - cam;
      rect(px - 5, y - 1, 11, 3, '#ffffff');
      rect(px - 1, y - 5, 3, 11, '#ffffff');
      rect(px - 5, y - 3, 2, 3, '#ffffff');
      rect(px + 4, y, 2, 1, '#1f3fae');
    }
    if (fraction < 1 && dots.length) {
      const tip = dots.at(-1);
      const s = (f >> 1) % 2 ? 3 : 2;
      rect(tip.x - s - cam, tip.y - s, s * 2 + 1, 1, '#ffffff');
      rect(tip.x - cam, tip.y - s * 2, 1, s * 4, '#ffffff');
    }
  }

  // ── stadiums ──
  const cleared = new Set(game.save.cleared);
  NODES.forEach((n, i) => {
    if (i >= game.levels.length || !visible(n.x)) return;
    const x = n.x - cam;
    const def = game.levels[i];
    const open = i <= unlocked && !(m.reveal && i === m.reveal.to && m.reveal.t < REVEAL_FRAMES);
    const won = cleared.has(def.id);
    if (open && !won) {
      const pulse = 8 + Math.round(Math.sin(f / 8) * 1.5);
      ctx.strokeStyle = '#ffdf00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, n.y, pulse + 2, pulse - 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = open ? '#f0f0f0' : '#8a8a8a';
    ctx.beginPath();
    ctx.ellipse(x, n.y, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = open ? '#3cb043' : '#5a5a5a';
    ctx.beginPath();
    ctx.ellipse(x, n.y, 4.5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (i === game.levels.length - 1) blit(sprite('trophy', TROPHY, TROPHY_PAL), x + 34, n.y - 34 + Math.round(Math.sin(f / 12) * 2));
    if (won) {
      // A little Brazil flag flies over every match won.
      const wave = (f >> 3) % 2;
      rect(x + 5, n.y - 15, 1, 13, '#d8d8d8');
      rect(x + 6, n.y - 15 + wave, 8, 6, '#009c3b');
      rect(x + 8, n.y - 14 + wave, 4, 4, '#ffdf00');
      rect(x + 9, n.y - 13 + wave, 2, 2, '#1f3fae');
    }
  });

  // ── Neymario ──
  const walking = Boolean(m.walk);
  const frameName = walking ? ['run1', 'run2', 'stand'][Math.floor(f / 6) % 3] : 'stand';
  const [palKey, pal] = playerPalette({ size: game.carrySize, star: 0 }, f);
  const img = sprite(`ney:small:${frameName}:${palKey}`, NEY_SMALL[frameName], pal);
  const bob = walking ? 0 : Math.round(Math.sin(f / 15));
  rect(m.x - 5 - cam, m.y + 1, 10, 2, 'rgba(0,0,0,0.3)');
  blit(img, m.x - 8 - cam, m.y - 14 + bob, { flipX: m.facing < 0 });

  // ── HUD ──
  rect(0, 0, SCREEN_W, MAP_TOP - 2, '#0b1230');
  rect(0, MAP_TOP - 2, SCREEN_W, 2, '#ffdf00');
  text('WORLD MAP', 8, 5, { color: '#ffdf00' });
  text(`x${game.lives}`, 132, 5);
  text(String(game.score).padStart(6, '0'), 248, 5, { align: 'right' });
  const here = game.levels[m.node];
  const label = m.walk ? '...' : `${here.code} ${NODES[m.node].city}: BRA X ${here.opponent}`;
  text(label, 8, 18, { size: 6, color: cleared.has(here.id) ? '#5fe07a' : '#ffffff' });
  rect(0, SCREEN_H - 12, SCREEN_W, 12, 'rgba(11,18,48,0.9)');
  text('<- -> WALK      ENTER / Z  PLAY', SCREEN_W / 2, SCREEN_H - 9, { size: 6, align: 'center', color: '#bbbbbb', shadow: false });

  // Region banner slides in when entering a new World Cup.
  if (m.banner > 0) {
    const region = regionAt(m.x);
    const shown = BANNER_FRAMES - m.banner;
    const slide = Math.min(1, shown / 15, m.banner / 15);
    const y = Math.round(MAP_TOP + 4 - 40 + 40 * slide);
    panel(28, y, 200, 34);
    text(region.name, 128, y + 8, { align: 'center', color: '#ffdf00' });
    text(SUBTITLES[region.theme], 128, y + 21, { size: 6, align: 'center', color: '#bbbbbb' });
  }
}
