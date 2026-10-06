// Draws the overworld: four World Cup regions with animated scenery, the
// stadium path, and Neymario walking between matches. The terrain is painted
// once into an offscreen canvas; everything that moves is drawn per frame.
import { SCREEN_W, SCREEN_H } from './constants.js';
import { MAP_W, NODES, pathBetween, regionAt } from './worldmap.js';
import { NEY_SMALL, playerPalette, TROPHY, TROPHY_PAL } from './sprites.js';

const SEA_Y = 214;
const RIVERS = [256, 512];
const STRAIT = 768;
const REVEAL_FRAMES = 70;
const BANNER_FRAMES = 150;

const hash = (n) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

const SUBTITLES = {
  brazil: 'WHERE IT ALL BEGAN',
  russia: 'WHITE NIGHTS AND MATRYOSHKAS',
  qatar: 'DESERT FALCONS AND CONTAINERS',
  final: 'THE DICTATOR AWAITS',
};

let terrain = null;

/** Paints the static map once: land, landmarks, rivers and bridges. */
function paintTerrain() {
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
  const tri = (x, y, w, h, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x + w / 2, y);
    g.lineTo(x + w, y + h);
    g.fill();
  };

  // Brazil: jungle green, Sugarloaf Mountain, a beach and the Atlantic.
  r(0, 0, 256, SCREEN_H, '#4caf50');
  for (let i = 0; i < 70; i++) disc(hash(i) * 250, 36 + hash(i + 300) * 160, 4 + hash(i + 600) * 6, i % 3 ? '#3a9a48' : '#2e8b3e');
  disc(196, 66, 22, '#7a8a6a');
  disc(196, 66, 18, '#8a9a7a');
  disc(162, 82, 13, '#6a7a5a');
  g.strokeStyle = '#3a3a3a';
  g.lineWidth = 0.5;
  g.beginPath();
  g.moveTo(162, 70);
  g.lineTo(196, 45);
  g.stroke();
  for (let x = 0; x < 256; x += 4) r(x, SEA_Y - 10 - Math.round(hash(x) * 3), 4, 12, '#f2d38a');
  r(0, SEA_Y, 256, SCREEN_H - SEA_Y, '#1e70d0');

  // Russia: snowfields, pines, a frozen lake and onion domes.
  r(256, 0, 256, SCREEN_H, '#eef3fa');
  for (let i = 0; i < 30; i++) disc(260 + hash(i + 900) * 248, 40 + hash(i + 950) * 170, 6 + hash(i + 990) * 10, '#dde8f4');
  g.fillStyle = '#bfe0f5';
  g.beginPath();
  g.ellipse(300, 70, 26, 12, 0, 0, Math.PI * 2);
  g.fill();
  r(290, 68, 14, 1, '#e8f6ff');
  for (let i = 0; i < 34; i++) {
    const x = 262 + hash(i + 1200) * 240;
    const y = 40 + hash(i + 1300) * 170;
    tri(x, y, 9, 13, '#2a5a3a');
    tri(x + 2, y, 5, 4, '#ffffff');
    r(x + 4, y + 13, 1, 2, '#5a3a2a');
  }
  r(430, 60, 70, 34, '#c8402a');
  r(430, 60, 70, 3, '#e8e0d0');
  r(460, 80, 10, 14, '#3a1a10');
  const domes = [[440, 54, 7, '#2a9a5a'], [454, 46, 9, '#ffcc1a'], [470, 40, 11, '#2a6ac8'], [486, 48, 8, '#e8202a'], [496, 56, 6, '#2a9a5a']];
  for (const [x, y, rad, color] of domes) {
    r(x - 2, y, 4, 60 - y + 4, '#d8d0c0');
    disc(x, y, rad, color);
    tri(x - 2, y - rad - 6, 4, 7, '#ffcc1a');
    for (let k = -rad + 2; k < rad; k += 4) r(x + k, y - 2, 2, 5, 'rgba(255,255,255,0.35)');
  }

  // Qatar: dunes, the Doha skyline and the Gulf.
  r(512, 0, 256, SCREEN_H, '#e6c27a');
  g.strokeStyle = '#d4ac62';
  g.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const x = 520 + hash(i + 1500) * 230;
    const y = 90 + hash(i + 1550) * 110;
    g.beginPath();
    g.arc(x, y + 14, 16, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
  }
  const towers = [[600, 40, 10], [614, 52, 8], [626, 34, 9], [640, 46, 12], [656, 30, 8], [668, 50, 10], [684, 42, 9], [698, 56, 8]];
  for (const [x, top, w] of towers) {
    r(x, top, w, 86 - top, '#7a8aa8');
    r(x, top, w, 2, '#a8b8d8');
    for (let y = top + 4; y < 84; y += 5) for (let k = 2; k < w - 2; k += 3) if (hash(x * 7 + y + k) > 0.45) r(x + k, y, 1, 2, '#ffe08a');
  }
  r(672, 22, 6, 30, '#b8c0d0');
  disc(675, 22, 6, '#d8e0f0');
  for (let x = 512; x < 768; x += 4) r(x, SEA_Y - 8 - Math.round(hash(x + 77) * 3), 4, 10, '#f0d898');
  r(512, SEA_Y, 256, SCREEN_H - SEA_Y, '#2a8ac8');

  // The Final: a volcanic island, lava, and Mbappé Ditador's castle.
  r(768, 0, 256, SCREEN_H, '#3a2e2e');
  for (let i = 0; i < 40; i++) disc(772 + hash(i + 1800) * 248, 36 + hash(i + 1850) * 180, 3 + hash(i + 1880) * 6, '#4a3a3a');
  tri(782, 40, 56, 52, '#5a4040');
  r(804, 40, 12, 4, '#c82800');
  r(768, 200, 256, 14, '#8a1a00');
  r(768, SEA_Y, 256, SCREEN_H - SEA_Y, '#1e3a6a');
  r(892, 52, 96, 66, '#4a4a5a');
  for (const tx of [886, 932, 978]) {
    r(tx, 36, 16, 82, '#3a3a4a');
    for (let k = 0; k < 4; k++) r(tx + k * 4, 30, 3, 6, '#3a3a4a');
  }
  for (let k = 0; k < 24; k++) r(892 + k * 4, 46, 3, 6, '#4a4a5a');
  r(928, 92, 24, 26, '#0a0a10');
  r(926, 58, 28, 22, '#ffcc1a');
  g.fillStyle = '#4a2a00';
  g.font = '16px "Press Start 2P", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillText('M', 940, 61);
  for (const [bx, color] of [[900, '#0055a4'], [906, '#ffffff'], [912, '#ef4135'], [966, '#0055a4'], [972, '#ffffff'], [978, '#ef4135']]) r(bx, 60, 6, 20, color);

  // Rivers between the World Cups, a sea strait before the Final, with bridges where the path crosses.
  for (const bx of RIVERS) r(bx - 6, 30, 12, SEA_Y - 30, '#3a8ad8');
  r(STRAIT - 7, 30, 14, SCREEN_H - 30, '#1e60b0');
  for (let i = 0; i < NODES.length - 1; i++) {
    const [a, , b] = pathBetween(i, i + 1);
    for (const bx of [...RIVERS, STRAIT]) {
      if (a.x < bx && b.x > bx) {
        r(bx - 9, a.y - 5, 18, 10, '#8a5a2a');
        for (let k = -8; k < 9; k += 3) r(bx + k, a.y - 5, 1, 10, '#5a3a1a');
        r(bx - 9, a.y - 6, 18, 1, '#c8a070');
        r(bx - 9, a.y + 5, 18, 1, '#c8a070');
      }
    }
  }
  return c;
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
  terrain ??= paintTerrain();
  const m = game.map;
  const f = game.frame;
  const cam = Math.round(m.camX);
  const visible = (x) => x > cam - 40 && x < cam + SCREEN_W + 40;

  ctx.drawImage(terrain, -cam, 0);

  // ── moving scenery ──
  // Waves on the Atlantic and the Gulf.
  for (let x = Math.floor(cam / 8) * 8; x < cam + SCREEN_W; x += 8) {
    const region = regionAt(x);
    if (region.theme === 'russia') continue;
    for (let row = 0; row < 3; row++) {
      const wx = x + ((f / 3 + row * 5) % 8);
      rect(wx - cam, SEA_Y + 5 + row * 8, 4, 1, 'rgba(255,255,255,0.55)');
    }
  }
  // Rivers ripple downstream.
  for (const bx of RIVERS) {
    if (!visible(bx)) continue;
    for (let y = 30; y < SEA_Y; y += 10) rect(bx - 3 - cam, y + ((f / 2) % 10), 2, 3, 'rgba(255,255,255,0.5)');
  }
  // A sailing boat off Copacabana and a dhow in the Gulf.
  for (const [x0, span, sail] of [[0, 256, '#ffffff'], [512, 256, '#f2e2c0']]) {
    const bx = x0 + ((f * 0.25 + x0) % (span + 40)) - 20;
    if (!visible(bx)) continue;
    const by = SEA_Y + 10 + Math.round(Math.sin(f / 20) * 1.5);
    rect(bx - cam, by, 14, 3, '#7a4a2a');
    rect(bx + 6 - cam, by - 10, 1, 10, '#5a3a1a');
    ctx.fillStyle = sail;
    ctx.beginPath();
    ctx.moveTo(bx + 7 - cam, by - 10);
    ctx.lineTo(bx + 14 - cam, by - 2);
    ctx.lineTo(bx + 7 - cam, by - 2);
    ctx.fill();
  }
  // Palms swaying on the beaches.
  for (const [px, py] of [[20, 196], [110, 198], [176, 196], [236, 198], [540, 198], [600, 196], [730, 198], [700, 120]]) {
    if (!visible(px)) continue;
    const sway = Math.round(Math.sin(f / 25 + px) * 1.5);
    rect(px - cam, py - 14, 2, 14, '#7a5a2a');
    for (const [dx, dy] of [[-6, 0], [2, 0], [-4, -2], [0, -2]]) rect(px + dx + sway - cam, py - 15 + dy, 6, 2, '#2e8b3e');
  }
  // Snow falling over Russia.
  for (let i = 0; i < 46; i++) {
    const x = 256 + hash(i + 3000) * 256 + Math.sin((f + i * 20) / 30) * 5;
    const y = 30 + ((hash(i + 3100) * 200 + f * (0.3 + hash(i + 3200) * 0.4)) % 190);
    if (visible(x)) rect(x - cam, y, 1, 1, i % 3 ? '#ffffff' : '#9fc0e0');
  }
  // Lava flowing round the island, smoke from the volcano, lightning over the castle.
  if (visible(800)) {
    for (let x = 768; x < 1024; x += 6) rect(x - cam + ((f / 4) % 6), 203 + ((x / 6) % 2) * 4, 3, 2, (x + f) % 24 < 12 ? '#ff8a00' : '#ffd000');
    for (let i = 0; i < 4; i++) {
      const t = (f / 2 + i * 30) % 120;
      ctx.fillStyle = `rgba(120,110,110,${0.6 - t / 200})`;
      ctx.beginPath();
      ctx.arc(810 + Math.sin(t / 15) * 4 - cam, 40 - t / 3, 3 + t / 20, 0, Math.PI * 2);
      ctx.fill();
    }
    const strike = f % 260;
    if (strike < 10) {
      ctx.fillStyle = `rgba(255,255,255,${strike % 4 < 2 ? 0.35 : 0.15})`;
      ctx.fillRect(768 - cam, 30, 256, SCREEN_H - 30);
      ctx.strokeStyle = '#fff8c0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(1000 - cam, 30);
      ctx.lineTo(990 - cam, 44);
      ctx.lineTo(998 - cam, 46);
      ctx.lineTo(986 - cam, 64);
      ctx.stroke();
    }
  }
  // Cloud shadows drifting across the whole map.
  for (let i = 0; i < 5; i++) {
    const cx = ((hash(i + 4000) * MAP_W + f * 0.2) % (MAP_W + 80)) - 40;
    if (!visible(cx)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(cx - cam, 60 + hash(i + 4100) * 120, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── the path ──
  const unlocked = Math.min(game.save.unlocked, NODES.length - 1, game.levels.length - 1);
  for (let i = 0; i < NODES.length - 1 && i < game.levels.length - 1; i++) {
    let fraction = i < unlocked ? 1 : 0;
    if (m.reveal && i === m.reveal.from) fraction = Math.min(1, m.reveal.t / REVEAL_FRAMES);
    if (fraction === 0) continue;
    const dots = dotsAlong(pathBetween(i, i + 1), 5, fraction);
    for (const d of dots) {
      rect(d.x - 1 - cam, d.y, 3, 3, 'rgba(0,0,0,0.35)');
      rect(d.x - 1 - cam, d.y - 1, 3, 3, '#fff4c8');
    }
    if (fraction < 1 && dots.length) {
      const tip = dots.at(-1);
      const s = (f >> 1) % 2 ? 3 : 2;
      rect(tip.x - s - cam, tip.y - s, s * 2 + 1, 1, '#ffffff');
      rect(tip.x - cam, tip.y - s * 2, 1, s * 4, '#ffffff');
    }
  }

  // ── stadium nodes ──
  const cleared = new Set(game.save.cleared);
  NODES.forEach((n, i) => {
    if (i >= game.levels.length || !visible(n.x)) return;
    const x = n.x - cam;
    const def = game.levels[i];
    const open = i <= unlocked && !(m.reveal && i === m.reveal.to && m.reveal.t < REVEAL_FRAMES);
    const won = cleared.has(def.id);
    if (open && !won) {
      const pulse = 9 + Math.round(Math.sin(f / 8) * 1.5);
      ctx.strokeStyle = '#ffdf00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, n.y, pulse + 2, pulse - 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = open ? '#f0f0f0' : '#8a8a8a';
    ctx.beginPath();
    ctx.ellipse(x, n.y, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = open ? '#3cb043' : '#5a5a5a';
    ctx.beginPath();
    ctx.ellipse(x, n.y, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    rect(x, n.y - 3, 1, 7, open ? 'rgba(255,255,255,0.7)' : '#7a7a7a');
    if (i === game.levels.length - 1) blit(sprite('trophy', TROPHY, TROPHY_PAL), x + 12, n.y - 22 + Math.round(Math.sin(f / 12) * 2));
    if (won) {
      // A little Brazil flag flies over every match won.
      const wave = (f >> 3) % 2;
      rect(x + 6, n.y - 16, 1, 14, '#d8d8d8');
      rect(x + 7, n.y - 16 + wave, 8, 6, '#009c3b');
      rect(x + 9, n.y - 15 + wave, 4, 4, '#ffdf00');
      rect(x + 10, n.y - 14 + wave, 2, 2, '#1f3fae');
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
  rect(0, 0, SCREEN_W, 30, '#0b1230');
  rect(0, 30, SCREEN_W, 1, '#ffdf00');
  text('WORLD MAP', 8, 5, { color: '#ffdf00' });
  text(`x${game.lives}`, 132, 5);
  text(String(game.score).padStart(6, '0'), 248, 5, { align: 'right' });
  const here = game.levels[m.node];
  const label = m.walk ? '...' : `${here.code}  BRA X ${here.opponent}`;
  text(label, 8, 17, { size: 6, color: cleared.has(here.id) ? '#5fe07a' : '#ffffff' });
  rect(0, SCREEN_H - 12, SCREEN_W, 12, 'rgba(11,18,48,0.85)');
  text('<- -> WALK      ENTER / Z  PLAY', SCREEN_W / 2, SCREEN_H - 9, { size: 6, align: 'center', color: '#bbbbbb', shadow: false });

  // Region banner slides in when entering a new World Cup.
  if (m.banner > 0) {
    const region = regionAt(m.x);
    const shown = BANNER_FRAMES - m.banner;
    const slide = Math.min(1, shown / 15, m.banner / 15);
    const y = Math.round(36 - 40 + 40 * slide);
    panel(28, y, 200, 34);
    text(region.name, 128, y + 8, { align: 'center', color: '#ffdf00' });
    text(SUBTITLES[region.theme], 128, y + 21, { size: 6, align: 'center', color: '#bbbbbb' });
  }
}

