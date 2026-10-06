import { TILE, ROWS, SCREEN_W, SCREEN_H, GROUND_ROW } from './constants.js';
import {
  makeSprite, NEY_SMALL, NEY_BIG, NEY_PAL, playerPalette,
  DEFENDER, kitPalette, REFEREE, REF_PAL, VAR_SHELL, VAR_PAL, BOSS, BOSS_PAL,
  FOOTBALL, FOOTBALL_PAL, BLAZE, BLAZE_PALS, TROPHY, TROPHY_PAL, noodleHair,
  MATCH_BALL, MATCH_BALL_PAL, JERSEY, JERSEY_PAL, NOODLES, NOODLES_PAL, FEATHER, FEATHER_PAL,
  COIN, COIN_PAL, FIREBALL, FIREBALL_PAL, FIREBAR_BALL, FIREBAR_PAL, BLOCK_TROPHY, BLOCK_TROPHY_PAL,
  DRONE, DRONE_PAL, KEEPER, keeperPalette, STUDS, STUDS_PAL, MATRYOSHKA, MATRYOSHKA_PAL, FALCON, FALCON_PAL,
} from './sprites.js';
import { drawWorldMap } from './maprender.js';

export const SCALE = 3;
const FONT = '"Press Start 2P", ui-monospace, monospace';

const THEMES = {
  day: {
    sky: ['#5c94fc', '#a8ccff'], stands: '#2f3558', roof: '#4a5080', grass: ['#3cb043', '#33a03a'],
    dirt: '#b5651d', dirtDark: '#7a3f10', brick: '#c84c0c', mortar: '#5a1c00', solid: ['#e09060', '#c06c2c', '#6a3410'],
  },
  dusk: {
    sky: ['#3b2a6b', '#ff9a5a'], stands: '#2a2140', roof: '#4b3b66', grass: ['#3a9a40', '#318a37'],
    dirt: '#a65a1b', dirtDark: '#6a3410', brick: '#b8440c', mortar: '#4a1600', solid: ['#d08050', '#b0602a', '#5a2a0a'],
    lights: true,
  },
  night: {
    sky: ['#050818', '#1a2350'], stands: '#151a33', roof: '#262d52', grass: ['#2f8f36', '#28802f'],
    dirt: '#8a4a16', dirtDark: '#4a2508', brick: '#9c3a0c', mortar: '#3a1000', solid: ['#b07040', '#8a5020', '#3a1a05'],
    lights: true,
  },
  desert: {
    sky: ['#7cc8f8', '#f4e4b4'], stands: '#6b4e3a', roof: '#8a6a4f', grass: ['#46b84a', '#3caa42'],
    dirt: '#d0a060', dirtDark: '#8a6030', brick: '#d0702c', mortar: '#6a2c00', solid: ['#f0c080', '#d0a060', '#7a5020'],
  },
  castle: {
    sky: ['#000000', '#120808'], stone: true, bricksBehind: true, dirt: '#7d7d7d', dirtDark: '#3e3e3e', stoneHi: '#b8b8b8',
    brick: '#8a8a8a', mortar: '#3a3a3a', solid: ['#b0b0b0', '#808080', '#404040'],
  },
  // Swiss Alps in Rostov: snow on the pitch.
  snow: {
    sky: ['#8fb8e0', '#e8f2fc'], stands: '#45557a', roof: '#66779c', grass: ['#f4f8ff', '#e6eef8'], snowTop: true,
    dirt: '#8a6a4a', dirtDark: '#5a4430', brick: '#b8501c', mortar: '#4a1600', solid: ['#e8eef8', '#b8c8dc', '#6a7a92'],
  },
  // Stadium 974 by the Gulf at sunset.
  port: {
    sky: ['#f08a4a', '#5a3a7a'], stands: '#2a2438', roof: '#3a3450', grass: ['#3a9a40', '#318a37'],
    dirt: '#8a7a6a', dirtDark: '#5a4a3a', brick: '#c8602c', mortar: '#4a1a00', solid: ['#d8c8b0', '#a8987e', '#5a4a3a'],
    lights: true,
  },
  // The bonus room under the pitch.
  tunnel: {
    sky: ['#000000', '#000000'], stone: true, dirt: '#1d4f9c', dirtDark: '#0c2a5a', stoneHi: '#5a8ad8',
    brick: '#2f6fc0', mortar: '#0c2a5a', solid: ['#5a8ad8', '#2f6fc0', '#0c2a5a'],
  },
};

const hash = (n) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

export function createRenderer(canvas) {
  canvas.width = SCREEN_W * SCALE;
  canvas.height = SCREEN_H * SCALE;
  const ctx = canvas.getContext('2d');
  const cache = new Map();

  const sprite = (key, rows, pal, width = 16) => {
    let img = cache.get(key);
    if (!img) {
      img = makeSprite(rows, pal, width);
      cache.set(key, img);
    }
    return img;
  };

  function blit(img, x, y, { flipX = false, flipY = false, h = img.height } = {}) {
    const dx = Math.round(x);
    const dy = Math.round(y);
    if (!flipX && !flipY) {
      ctx.drawImage(img, dx, dy, img.width, h);
      return;
    }
    ctx.save();
    ctx.translate(dx + (flipX ? img.width : 0), dy + (flipY ? h : 0));
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(img, 0, 0, img.width, h);
    ctx.restore();
  }

  function text(str, x, y, { color = '#ffffff', size = 8, align = 'left', shadow = true } = {}) {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    if (shadow) {
      ctx.fillStyle = '#000000';
      ctx.fillText(str, x + 1, y + 1);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  const rect = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };

  // ───────────────────────────── background ─────────────────────────────

  function crowdStrip(level, theme) {
    const key = `crowd:${level.id}`;
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 76;
    const g = c.getContext('2d');
    g.fillStyle = theme.roof;
    g.fillRect(0, 0, 512, 6);
    g.fillStyle = theme.stands;
    g.fillRect(0, 6, 512, 70);
    const colors = ['#ffdf00', '#ffdf00', '#009c3b', '#1f3fae', '#ffffff', level.kit.shirt, level.kit.shirt2, '#e0ac69', '#8d5524'];
    for (let y = 10; y < 72; y += 3) {
      for (let x = 0; x < 512; x += 3) {
        const r = hash(x * 131 + y * 7 + level.width);
        if (r < 0.18) continue;
        g.fillStyle = colors[Math.floor(hash(x * 17 + y * 911) * colors.length)];
        g.globalAlpha = 0.6;
        g.fillRect(x, y, 2, 2);
      }
    }
    g.globalAlpha = 1;
    for (let x = 0; x < 512; x += 64) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x, 6, 2, 70);
    }
    cache.set(key, c);
    return c;
  }

  function drawBackground(game, theme, cam) {
    const grad = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
    grad.addColorStop(0, theme.sky[0]);
    grad.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    if (theme.stone) {
      if (theme.bricksBehind) drawCastleBackdrop(cam);
      return;
    }

    if (theme.lights) {
      for (let i = 0; i < 40; i++) {
        const sx = (hash(i * 3) * 900 - cam * 0.1) % 900;
        if (sx < 0 || sx > SCREEN_W) continue;
        rect(sx, 34 + hash(i * 5) * 70, 1, 1, '#ffffff');
      }
    }
    const cloudCount = Math.ceil(game.level.width / 8);
    for (let i = 0; i < cloudCount; i++) {
      const wx = i * 96 + hash(i) * 40;
      const sx = wx - cam * 0.3;
      if (sx < -64 || sx > SCREEN_W + 8) continue;
      drawCloud(sx, 40 + hash(i + 99) * 50, 1 + Math.floor(hash(i + 7) * 3), theme.lights);
    }

    const strip = crowdStrip(game.level, theme);
    const off = -((cam * 0.5) % strip.width);
    // Faded so blocks and enemies in front of the stands stay readable.
    ctx.globalAlpha = theme.lights ? 0.7 : 0.45;
    for (let x = off; x < SCREEN_W; x += strip.width) ctx.drawImage(strip, Math.round(x), 120);
    ctx.globalAlpha = 1;
    if (theme.lights) drawFloodlights(cam);
    if (theme.lights && game.frame % 6 === 0) {
      for (let i = 0; i < 3; i++) rect(hash(game.frame + i) * SCREEN_W, 130 + hash(game.frame * 3 + i) * 60, 2, 2, '#ffffff');
    }
    drawAdBoards(game, cam);
  }

  function drawCloud(x, y, size, dim) {
    ctx.fillStyle = dim ? '#3a3f6e' : '#ffffff';
    for (let i = 0; i < size + 1; i++) {
      ctx.beginPath();
      ctx.arc(x + 10 + i * 12, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(x + 4, y, size * 12 + 12, 7);
  }

  function drawFloodlights(cam) {
    for (let i = -1; i < 4; i++) {
      const base = Math.floor(cam * 0.5 / 200) * 200 + i * 200;
      const sx = base + 60 - cam * 0.5;
      if (sx < -40 || sx > SCREEN_W + 40) continue;
      rect(sx, 60, 2, 62, '#3a3f5a');
      rect(sx - 10, 52, 22, 10, '#4a5070');
      ctx.fillStyle = '#fffbe0';
      for (let k = 0; k < 4; k++) ctx.fillRect(Math.round(sx - 8 + k * 5), 54, 3, 3);
      const glow = ctx.createRadialGradient(sx + 1, 57, 2, sx + 1, 57, 40);
      glow.addColorStop(0, 'rgba(255,250,220,0.35)');
      glow.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 40, 17, 82, 80);
    }
  }

  const BOARDS = ['NEYMARIO', 'BLAZE', 'HEXA!', 'BRASIL', 'GOLACO', 'JOGA BONITO'];

  function drawAdBoards(game, cam) {
    const level = game.level;
    const y = GROUND_ROW * TILE - 12;
    const first = Math.floor(cam / 64);
    for (let i = first; i <= first + 5; i++) {
      const wx = i * 64;
      const sx = wx - cam;
      const tx = Math.floor(wx / TILE);
      if (level.tiles[GROUND_ROW]?.[tx] !== '#' || level.tiles[GROUND_ROW]?.[tx + 3] !== '#') continue;
      rect(sx + 1, y, 62, 12, i % 2 ? '#0b2a6b' : '#0a5a2a');
      rect(sx + 1, y, 62, 1, '#ffffff33');
      text(BOARDS[i % BOARDS.length], sx + 32, y + 3, { size: 6, align: 'center', color: i % 2 ? '#ffdf00' : '#ffffff', shadow: false });
    }
  }

  function drawCastleBackdrop(cam) {
    ctx.fillStyle = '#1a0f0f';
    for (let y = 48; y < 208; y += 16) {
      for (let x = -((cam * 0.5) % 32) - 32; x < SCREEN_W; x += 32) {
        ctx.fillRect(Math.round(x + ((y / 16) % 2) * 16), y, 30, 14);
      }
    }
  }

  // ───────────────────────────── tiles ─────────────────────────────

  function drawTiles(game, theme, cam) {
    const level = game.level;
    const first = Math.max(0, Math.floor(cam / TILE));
    const last = Math.min(level.width - 1, first + Math.ceil(SCREEN_W / TILE) + 1);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = first; tx <= last; tx++) {
        const ch = level.tiles[ty][tx];
        if (ch === ' ' || ch === 'h' || ch === 'L') continue;
        const bump = game.bumps.get(`${tx},${ty}`) ?? 0;
        const lift = bump ? -Math.round(4 - Math.abs(bump - 4)) : 0;
        drawTile(ch, tx * TILE - cam, ty * TILE + lift, theme, game.frame, level.tiles[ty - 1]?.[tx], tx);
      }
    }
  }

  function drawLava(game, cam) {
    const level = game.level;
    const first = Math.max(0, Math.floor(cam / TILE));
    const last = Math.min(level.width - 1, first + Math.ceil(SCREEN_W / TILE) + 1);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = first; tx <= last; tx++) {
        if (level.tiles[ty][tx] !== 'L') continue;
        const x = tx * TILE - cam;
        const y = ty * TILE;
        rect(x, y, TILE, TILE, '#c81e00');
        if (level.tiles[ty - 1]?.[tx] !== 'L') {
          for (let i = 0; i < TILE; i++) {
            const wave = Math.round(1.5 + Math.sin((tx * TILE + i + game.frame) / 3) * 1.5);
            rect(x + i, y + wave, 1, 3, '#ff8a00');
            rect(x + i, y + wave + 3, 1, 1, '#ffd000');
          }
        } else if ((tx + ty + (game.frame >> 4)) % 3 === 0) {
          rect(x + 5, y + 6, 3, 2, '#ff6000');
        }
      }
    }
  }

  function drawTile(ch, x, y, theme, frame, above, tx) {
    switch (ch) {
      case '#':
        if (theme.stone) drawStone(x, y, theme);
        else drawGround(x, y, theme, above !== '#', tx);
        break;
      case 'B':
        drawBrick(x, y, theme);
        break;
      case '?':
        drawPrizeBlock(x, y, frame);
        break;
      case 'U':
        drawBevel(x, y, ['#a0703a', '#8b5a2b', '#3a2008']);
        rivets(x, y, '#2a1505');
        break;
      case 'S':
        drawBevel(x, y, theme.solid);
        break;
      case '[': case ']': case '{': case '}':
      case '(': case ')': case '-': case '_':
        drawPipe(ch, x, y);
        break;
      case '=':
        rect(x, y, TILE, 6, '#b05000');
        rect(x, y, TILE, 1, '#ffb070');
        for (let i = 0; i < TILE; i += 4) rect(x + i, y, 1, 6, '#5a2000');
        rect(x, y - 6, TILE, 1, '#9a9a9a');
        for (let i = 0; i < TILE; i += 4) rect(x + i, y - 5 + ((i / 4) % 2), 2, 1, '#9a9a9a');
        break;
      case 'I':
        rect(x, y, TILE, TILE, '#a8dcf8');
        rect(x, y, TILE, 2, '#ffffff');
        rect(x, y + 13, TILE, 3, '#6ab0dc');
        for (let i = 0; i < 3; i++) rect(x + 2 + i * 5, y + 4 + i, 3, 1, '#e8f8ff');
        break;
      case 'X': {
        // Shipping containers, each a colour, with corrugated sides.
        const colors = ['#c8402a', '#2a6ac8', '#e8a020', '#2a9a5a', '#8a3ac8'];
        const c = colors[(Math.floor(tx / 3) + Math.floor(y / 32)) % colors.length];
        rect(x, y, TILE, TILE, c);
        for (let i = 1; i < TILE; i += 3) rect(x + i, y + 2, 1, 12, 'rgba(0,0,0,0.25)');
        rect(x, y, TILE, 2, 'rgba(255,255,255,0.25)');
        rect(x, y + 14, TILE, 2, 'rgba(0,0,0,0.35)');
        break;
      }
      case 'K': {
        // Ball launcher: a training machine with a ball loaded in its mouth.
        rect(x, y, TILE, TILE, '#1d2a48');
        rect(x, y, TILE, 2, '#3a4a78');
        rect(x + 1, y + 13, 14, 3, '#0e1528');
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(x + 8, y + 7, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + 8, y + 7, 3, 0, Math.PI * 2);
        ctx.fill();
        rect(x + 7, y + 6, 2, 2, '#1a1a1a');
        break;
      }
      case 'G':
        // Iron bars with gold caps: the gate in front of the cup.
        rect(x, y, TILE, 2, '#5a5a6a');
        for (const bx of [2, 7, 12]) {
          rect(x + bx, y, 2, TILE, '#8a8aa0');
          rect(x + bx, y, 1, TILE, '#c8c8dc');
        }
        rect(x, y + 14, TILE, 2, '#5a5a6a');
        rect(x + 6, y + 6, 4, 4, '#ffcc1a');
        break;
      case 'C': {
        // Golden balls tumble in place by mirroring their patches.
        const phase = Math.floor(frame / 10) % 4;
        blit(sprite('coin', COIN, COIN_PAL), x, y, { flipX: phase === 1 || phase === 2, flipY: phase >= 2 });
        break;
      }
      default:
        break;
    }
  }

  function drawGround(x, y, theme, top, tx) {
    rect(x, y, TILE, TILE, theme.dirt);
    rect(x + 3, y + 9, 2, 2, theme.dirtDark);
    rect(x + 11, y + 13, 2, 1, theme.dirtDark);
    rect(x + 9, y + 5, 1, 2, theme.dirtDark);
    if (top) {
      // Mowed-pitch stripes, two tiles wide (snow-covered in the Alps).
      rect(x, y, TILE, 6, theme.grass[Math.floor(tx / 2) % 2]);
      rect(x, y, TILE, 1, theme.snowTop ? '#ffffff' : '#8ee88e');
      rect(x, y + 6, TILE, 1, theme.snowTop ? '#b8c8dc' : theme.dirtDark);
    }
  }

  function drawStone(x, y, theme) {
    rect(x, y, TILE, TILE, theme.dirt);
    rect(x, y + 7, TILE, 1, theme.dirtDark);
    rect(x, y + 15, TILE, 1, theme.dirtDark);
    rect(x + 7, y, 1, 7, theme.dirtDark);
    rect(x + 15, y + 8, 1, 7, theme.dirtDark);
    rect(x, y, TILE, 1, theme.stoneHi);
  }

  function drawBrick(x, y, theme) {
    rect(x, y, TILE, TILE, theme.brick);
    rect(x, y, TILE, 1, '#ffffff40');
    for (const row of [3, 7, 11, 15]) rect(x, y + row, TILE, 1, theme.mortar);
    for (let r = 0; r < 4; r++) {
      const off = r % 2 ? 4 : 12;
      rect(x + off, y + r * 4, 1, 3, theme.mortar);
    }
  }

  function drawPrizeBlock(x, y, frame) {
    const shade = ['#f8b800', '#f8b800', '#f8b800', '#e09000', '#c06800', '#e09000'][Math.floor(frame / 8) % 6];
    rect(x, y, TILE, TILE, shade);
    rect(x, y, TILE, 1, '#ffe0a0');
    rect(x, y + 15, TILE, 1, '#8a4000');
    rect(x + 15, y, 1, TILE, '#8a4000');
    rivets(x, y, '#5a2800');
    ctx.drawImage(sprite('block-trophy', BLOCK_TROPHY, BLOCK_TROPHY_PAL, 10), x + 3, y + 2);
  }

  function drawBevel(x, y, [light, mid, dark]) {
    rect(x, y, TILE, TILE, mid);
    rect(x, y, TILE, 2, light);
    rect(x, y, 2, TILE, light);
    rect(x, y + 14, TILE, 2, dark);
    rect(x + 14, y, 2, TILE, dark);
  }

  function rivets(x, y, color) {
    for (const [dx, dy] of [[2, 2], [13, 2], [2, 13], [13, 13]]) rect(x + dx, y + dy, 1, 1, color);
  }

  function drawPipe(ch, x, y) {
    if ('()-_'.includes(ch)) {
      drawSidePipe(ch, x, y);
      return;
    }
    const top = ch === '[' || ch === ']';
    const left = ch === '[' || ch === '{';
    const dark = '#005c00';
    if (top) {
      rect(x, y, TILE, TILE, '#00a800');
      rect(x, y, TILE, 1, dark);
      rect(x, y + 15, TILE, 1, dark);
      if (left) {
        rect(x, y, 1, TILE, dark);
        rect(x + 3, y + 2, 2, 12, '#90f090');
        rect(x + 7, y + 2, 1, 12, '#50d050');
      } else {
        rect(x + 15, y, 1, TILE, dark);
        rect(x + 8, y + 2, 3, 12, '#007800');
      }
    } else {
      const bx = left ? x + 2 : x;
      rect(bx, y, 14, TILE, '#00a800');
      if (left) {
        rect(bx, y, 1, TILE, dark);
        rect(bx + 3, y, 2, TILE, '#90f090');
        rect(bx + 7, y, 1, TILE, '#50d050');
      } else {
        rect(bx + 13, y, 1, TILE, dark);
        rect(bx + 6, y, 3, TILE, '#007800');
      }
    }
  }

  /** Sideways pipe (bonus-room exit): the same pipe turned 90°, mouth facing left. */
  function drawSidePipe(ch, x, y) {
    const mouth = ch === '(' || ch === ')';
    const upper = ch === '(' || ch === '-';
    const dark = '#005c00';
    if (mouth) {
      rect(x, y, TILE, TILE, '#00a800');
      rect(x, y, 1, TILE, dark);
      rect(x + 15, y, 1, TILE, dark);
      if (upper) {
        rect(x, y, TILE, 1, dark);
        rect(x + 2, y + 3, 12, 2, '#90f090');
        rect(x + 2, y + 7, 12, 1, '#50d050');
      } else {
        rect(x, y + 15, TILE, 1, dark);
        rect(x + 2, y + 8, 12, 3, '#007800');
      }
      return;
    }
    const by = upper ? y + 2 : y;
    rect(x, by, TILE, 14, '#00a800');
    if (upper) {
      rect(x, by, TILE, 1, dark);
      rect(x, by + 3, TILE, 2, '#90f090');
      rect(x, by + 7, TILE, 1, '#50d050');
    } else {
      rect(x, by + 13, TILE, 1, dark);
      rect(x, by + 6, TILE, 3, '#007800');
    }
  }

  // ───────────────────────────── goal: corner flag & the net ─────────────────────────────

  function drawFlag(level, x, y) {
    const { dir, colors } = level.flag;
    const w = 16;
    const h = 12;
    if (dir === 'cross') {
      rect(x, y, w, h, colors[0]);
      rect(x + 6, y + 2, 4, 8, colors[1]);
      rect(x + 4, y + 4, 8, 4, colors[1]);
      return;
    }
    if (dir === 'disc') {
      rect(x, y, w, h, colors[0]);
      ctx.fillStyle = colors[1];
      ctx.beginPath();
      ctx.arc(x + 8, y + 6, 3.5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = colors[2];
      ctx.beginPath();
      ctx.arc(x + 8, y + 6, 3.5, 0, Math.PI);
      ctx.fill();
      return;
    }
    colors.forEach((c, i) => {
      if (dir === 'h') {
        const y0 = Math.round((i * h) / colors.length);
        const y1 = Math.round(((i + 1) * h) / colors.length);
        rect(x, y + y0, w, y1 - y0, c);
      } else {
        const x0 = Math.round((i * w) / colors.length);
        const x1 = Math.round(((i + 1) * w) / colors.length);
        rect(x + x0, y, x1 - x0, h, c);
      }
    });
  }

  function drawBrazilFlag(x, y) {
    rect(x, y, 16, 12, '#009c3b');
    ctx.fillStyle = '#ffdf00';
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 1);
    ctx.lineTo(x + 15, y + 6);
    ctx.lineTo(x + 8, y + 11);
    ctx.lineTo(x + 1, y + 6);
    ctx.fill();
    ctx.fillStyle = '#1f3fae';
    ctx.beginPath();
    ctx.arc(x + 8, y + 6, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCornerFlag(game, cam) {
    const level = game.level;
    if (level.flagX === null) return;
    const poleX = level.flagX * TILE + 7 - cam;
    if (poleX < -40 || poleX > SCREEN_W + 40) return;
    rect(poleX, 3 * TILE, 2, 9 * TILE, '#e8e8e8');
    ctx.fillStyle = '#009c3b';
    ctx.beginPath();
    ctx.arc(poleX + 1, 3 * TILE - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    const flagY = game.state === 'flag' && game.seq?.flagY !== undefined ? game.seq.flagY : 3 * TILE + 4;
    drawFlag(level, poleX - 16, flagY);
  }

  /** Halfway flag: grey until Neymario passes, then the Brazil flag flies. */
  function drawCheckpoint(game, cam) {
    const col = game.level.checkpoint;
    if (col === null || col === undefined || game.areaName !== 'main') return;
    let row = 0;
    while (row < GROUND_ROW && ' C'.includes(game.level.tiles[row][col])) row++;
    const x = col * TILE + 7 - cam;
    if (x < -20 || x > SCREEN_W + 20) return;
    const ground = row * TILE;
    rect(x, ground - 40, 2, 40, '#d8d8d8');
    if (game.checkpointHit) drawBrazilFlag(x + 2, ground - 40);
    else rect(x + 2, ground - 40, 14, 10, '#8a8a8a');
  }

  /** Goal seen side-on: front post + crossbar, net sloping back to the ground. Drawn behind the ball. */
  function drawNetBack(game, cam) {
    const level = game.level;
    if (level.castleX === null) return;
    const gx = level.castleX * TILE - cam;
    if (gx > SCREEN_W + 8 || gx < -96) return;
    const ground = GROUND_ROW * TILE;
    const top = ground - 44;
    const bulge = celebration(game)?.bulge ?? 0;
    const backTop = gx + 56 + bulge;
    const backBottom = gx + 76 + bulge;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(gx + 10, top);
    ctx.lineTo(backTop, top);
    ctx.lineTo(backBottom, ground);
    ctx.lineTo(gx + 10, ground);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let x = gx + 10; x < backBottom; x += 5) ctx.fillRect(x, top, 1, 44);
    for (let y = top; y < ground; y += 5) ctx.fillRect(gx + 10, y, 80, 1);
    ctx.restore();
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(backTop, top + 0.5);
    ctx.lineTo(backBottom, ground);
    ctx.stroke();
  }

  function drawNetFront(game, cam) {
    const level = game.level;
    if (level.castleX === null) return;
    const gx = level.castleX * TILE - cam;
    if (gx > SCREEN_W + 8 || gx < -96) return;
    const ground = GROUND_ROW * TILE;
    rect(gx + 8, ground - 44, 3, 44, '#ffffff');
    rect(gx + 8, ground - 44, 50 + (celebration(game)?.bulge ?? 0) * 0.2, 3, '#ffffff');
    rect(gx + 10, ground - 43, 1, 43, '#c8c8c8');
  }

  /** The goal sequence (from the flag or the bridge), if one is running. */
  const celebration = (game) => (game.seq && game.seq.ball && (game.state === 'flag' || game.state === 'bridge') ? game.seq : null);

  function drawMatchBall(game, cam) {
    const s = celebration(game);
    if (!s || s.phase === 'tally' || s.phase === 'done') return;
    const spin = Math.floor(s.ball.spin / 4) % 4;
    blit(sprite('matchball', MATCH_BALL, MATCH_BALL_PAL, 8), s.ball.x - cam, s.ball.y, { flipX: spin === 1 || spin === 2, flipY: spin >= 2 });
  }

  function drawGoalBanner(game) {
    const s = celebration(game);
    if (!s || s.phase !== 'goal') return;
    const flash = (game.frame >> 3) % 2;
    text('GOOOOOL!', 128, 52, { size: 20, align: 'center', color: flash ? '#ffdf00' : '#5fe07a' });
    text('NEYMARIO SCORES!', 128, 80, { size: 8, align: 'center' });
  }

  // ───────────────────────────── actors ─────────────────────────────

  function drawPlayer(game, cam) {
    const p = game.player;
    if (p.invuln > 0 && !game.freeze && (game.frame >> 1) % 2) return;
    const [palKey, pal] = playerPalette(p, game.frame);
    const hair = (rows) => (p.size === 'roll' ? noodleHair(rows) : rows);

    // Rolling and the ground-pound windup: a tumbling ball of Neymario.
    if (p.rolling > 0 || p.pound > 0) {
      const img = sprite(`ney:curl:${palKey}`, hair(NEY_BIG.crouch), pal);
      const turn = p.rolling > 0 ? game.frame * 0.4 * p.facing : (1 - p.pound / 12) * Math.PI * 2;
      ctx.save();
      ctx.translate(Math.round(p.x + p.w / 2 - cam), Math.round(p.y + p.h - 8));
      ctx.rotate(turn);
      ctx.drawImage(img, -8, -8);
      ctx.restore();
      return;
    }

    let big = p.size !== 'small';
    if (game.freeze > 0 && (p.grow > 0 || p.invuln > 0)) big = (game.frame >> 2) % 2 === 0;

    let frameName;
    if (p.dead) frameName = 'dead';
    else if (big && p.crouch) frameName = 'crouch';
    else if (game.state === 'flag' && ['slide', 'hop'].includes(game.seq?.phase)) frameName = 'jump';
    else if (p.pound < 0) frameName = big ? 'crouch' : 'jump';
    else if (!p.onGround) frameName = 'jump';
    else if (Math.abs(p.vx) > 0.1) frameName = ['run1', 'run2', 'stand'][Math.floor(p.anim / 7) % 3];
    else frameName = 'stand';

    const set = big && !p.dead ? NEY_BIG : NEY_SMALL;
    const rows = hair(set[frameName] ?? set.stand);
    const img = sprite(`ney:${big && !p.dead ? 'big' : 'small'}:${frameName}:${palKey}`, rows, pal);
    if (p.size === 'pombo' && !p.onGround && !p.dead) drawWings(p, game, cam, img.height);
    blit(img, p.x - 2 - cam, p.y + p.h - img.height, { flipX: p.facing < 0 && !p.dead });
  }

  /** Pigeon wings while the feather power is airborne; they beat faster when gliding. */
  function drawWings(p, game, cam, spriteH) {
    const y = Math.round(p.y + p.h - spriteH + (spriteH > 16 ? 13 : 7));
    const beat = (game.frame >> (p.gliding ? 2 : 3)) % 2 ? -2 : 1;
    for (const side of [-1, 1]) {
      const x = Math.round(p.x + p.w / 2 - cam + side * 7 - (side < 0 ? 6 : 0));
      rect(x, y + beat, 6, 3, '#f4f6fa');
      rect(x + (side < 0 ? 0 : 2), y + beat + 3, 4, 2, '#9aa3b2');
    }
  }

  function drawEntity(e, game, cam) {
    const x = e.x - cam;
    if (x < -48 || x > SCREEN_W + 48) return;
    const kitKey = game.level.id;
    switch (e.type) {
      case 'defender': {
        const img = sprite(`def:${kitKey}`, DEFENDER, kitPalette(game.level.kit));
        if (e.state === 'flat') blit(img, x - 1, e.y + e.h - 8, { h: 8 });
        else blit(img, x - 1, e.y + e.h - 16, { flipX: (e.anim >> 3) % 2 === 1, flipY: e.state === 'flip' });
        break;
      }
      case 'referee': {
        if (e.state === 'shell' || (e.state === 'flip' && e.h < 20)) {
          const img = sprite('var', VAR_SHELL, VAR_PAL);
          blit(img, x - 1, e.y + e.h - 16, { flipY: e.state === 'flip' });
        } else {
          const name = (e.anim >> 3) % 2 ? 'walk2' : 'walk1';
          const img = sprite(`ref:${name}`, REFEREE[name], REF_PAL);
          blit(img, x - 1, e.y + e.h - 24, { flipX: e.vx > 0, flipY: e.state === 'flip' });
        }
        break;
      }
      case 'football':
        blit(sprite('football', FOOTBALL, FOOTBALL_PAL), x - 1, e.y, { flipX: (Math.floor(e.x / 6) % 2) === 1 });
        break;
      case 'jersey':
        blit(sprite('jersey', JERSEY, JERSEY_PAL), x - 1, e.y);
        break;
      case 'noodles':
        blit(sprite('noodles', NOODLES, NOODLES_PAL), x - 1, e.y + ((e.anim >> 4) % 2));
        break;
      case 'feather':
        blit(sprite('feather', FEATHER, FEATHER_PAL), x - 1 + Math.round(Math.sin(e.anim / 10) * 2), e.y);
        break;
      case 'blaze': {
        const k = (e.anim >> 3) % 2;
        blit(sprite(`blaze${k}`, BLAZE, BLAZE_PALS[k]), x - 1, e.y);
        break;
      }
      case 'trophy':
        blit(sprite('trophy', TROPHY, TROPHY_PAL), x - 1, e.y);
        break;
      case 'fireball': {
        const img = sprite('fireball', FIREBALL, FIREBALL_PAL, 8);
        const spin = (e.anim >> 2) % 4;
        blit(img, x, e.y, { flipX: spin === 1 || spin === 2, flipY: spin >= 2 });
        break;
      }
      case 'firebar': {
        const img = sprite('firebar', FIREBAR_BALL, FIREBAR_PAL, 8);
        for (let i = 0; i < e.length; i++) {
          const bx = e.cx + Math.cos(e.angle) * i * 8 - cam;
          const by = e.cy + Math.sin(e.angle) * i * 8;
          blit(img, bx - 4, by - 4);
        }
        break;
      }
      case 'matryoshka': {
        const big = e.size === 'big';
        const img = sprite(`doll:${e.size}`, big ? MATRYOSHKA.big : MATRYOSHKA.small, MATRYOSHKA_PAL, big ? 16 : 12);
        if (e.state === 'flat') blit(img, x - 1, e.y + e.h - 6, { h: 6 });
        else blit(img, x - 1, e.y + e.h - img.height - ((e.anim >> 3) % 2), { flipY: e.state === 'flip' });
        break;
      }
      case 'studs': {
        const img = sprite('studs', STUDS, STUDS_PAL);
        blit(img, x - 1, e.y + e.h - img.height, { flipX: (e.anim >> 3) % 2 === 1, flipY: e.state === 'flip' });
        break;
      }
      case 'drone': {
        const k = (e.anim >> 2) % 2 ? 'a' : 'b';
        blit(sprite(`drone:${k}`, DRONE[k], DRONE_PAL), x - 1, e.y, { flipY: e.state === 'flip' });
        break;
      }
      case 'falcon': {
        const k = e.mode === 'dive' || (e.anim >> 3) % 2 ? 'up' : 'down';
        blit(sprite(`falcon:${k}`, FALCON[k], FALCON_PAL), x, e.y - 1, { flipX: e.vx > 0, flipY: e.state === 'flip' });
        break;
      }
      case 'keeper': {
        const img = sprite(`keeper:${kitKey}`, KEEPER, keeperPalette(game.level.kit));
        blit(img, x - 1, e.y, { flipY: e.state === 'flip' });
        break;
      }
      case 'shot': {
        // A fiercely struck ball with speed lines behind it.
        const img = sprite('shotball', FOOTBALL, { O: '#1a1a1a', K: '#e8202a', W: '#f4f4f4', g: '#c8c8c8' });
        const tail = e.vx > 0 ? -10 : 12;
        for (let i = 0; i < 3; i++) rect(x + tail + (e.vx > 0 ? -i * 3 : i * 3), e.y + 3 + i * 3, 6, 1, 'rgba(255,255,255,0.6)');
        ctx.drawImage(img, Math.round(x), Math.round(e.y), 12, 12);
        break;
      }
      case 'lift': {
        const castle = game.level.theme === 'castle';
        rect(x, e.y, e.w, 8, castle ? '#8a8a8a' : '#f4f4f4');
        rect(x, e.y, e.w, 1, castle ? '#c8c8c8' : '#ffffff');
        rect(x, e.y + 7, e.w, 1, '#3a3a3a');
        if (!castle) for (let i = 4; i < e.w; i += 12) rect(x + i, e.y + 1, 5, 6, '#e8202a');
        break;
      }
      case 'spring': {
        // Trampoline sunk into the pitch: a yellow pad on coiled springs.
        const press = Math.round(e.squash / 3);
        rect(x, e.y, TILE, TILE, '#1a1a1a');
        for (let i = 0; i < 3; i++) rect(x + 3, e.y + 7 + i * 3 + press / 2, 10, 1, '#c8c8c8');
        rect(x + 1, e.y + 3 + press, 14, 3, '#ffdf00');
        rect(x + 1, e.y + 3 + press, 14, 1, '#009c3b');
        break;
      }
      case 'bubble':
        if (e.y < e.lavaTop) {
          ctx.drawImage(sprite('firebar', FIREBAR_BALL, FIREBAR_PAL, 8), Math.round(x), Math.round(e.y), 12, 12);
          rect(x + 3, e.y + (e.vy < 0 ? 10 : -2), 6, 2, 'rgba(255,160,0,0.6)');
        }
        break;
      case 'boss':
        drawBoss(e, game, cam);
        break;
      case 'bossfire': {
        // Drawn pointing the way it travels: hot white tip at the front.
        const flick = (game.frame >> 2) % 2;
        const left = e.vx < 0;
        rect(x, e.y, e.w, e.h, '#ff4b1f');
        rect(x + (left ? 2 : 4), e.y + 1, e.w - 6, e.h - 2, flick ? '#ffb000' : '#ffd84a');
        rect(left ? x - 3 : x + e.w, e.y + 2, 3, 2, '#ff4b1f');
        rect(left ? x + 4 + flick * 4 : x + e.w - 8 - flick * 4, e.y + 2, 4, 2, '#ffffff');
        break;
      }
      default:
        break;
    }
  }

  function drawBoss(e, game, cam) {
    if (e.hurt > 0 && (game.frame >> 1) % 2) return;
    const open = e.mouth > 0;
    // Angry at low health: his uniform flushes red.
    const angry = e.angry && (game.frame >> 3) % 2;
    const img = sprite(`boss:${open}:${angry ? 'angry' : 'calm'}`, open ? BOSS.open : BOSS.closed, angry ? { ...BOSS_PAL, N: '#8a1020', n: '#4a0810' } : BOSS_PAL, 32);
    blit(img, e.x - 2 - cam, e.y + e.h - 32, { flipX: e.facing > 0, flipY: e.state === 'dead' });
    if (e.state !== 'alive' || game.state !== 'play') return;
    const cx = Math.max(44, Math.min(SCREEN_W - 44, e.x + e.w / 2 - cam));
    text('MBAPPE DITADOR', cx, e.y - 18, { size: 6, align: 'center', color: '#ff6060' });
    for (let i = 0; i < 5; i++) rect(cx - 14 + i * 6, e.y - 9, 4, 3, i < e.hp ? '#ff3030' : '#3a3a3a');
  }

  function drawCupAxe(game, cam) {
    const axe = game.level.axe;
    if (!axe || game.state === 'bridge' || game.state === 'victory') return;
    const bob = Math.round(Math.sin(game.frame / 12) * 2);
    const glow = ctx.createRadialGradient(axe.x + 8 - cam, axe.y + 16, 2, axe.x + 8 - cam, axe.y + 16, 22);
    glow.addColorStop(0, 'rgba(255,220,80,0.6)');
    glow.addColorStop(1, 'rgba(255,220,80,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(axe.x - 16 - cam, axe.y - 8, 48, 48);
    blit(sprite('trophy', TROPHY, TROPHY_PAL), axe.x - cam, axe.y + 8 + bob);
  }

  function drawEffects(game, cam) {
    for (const fx of game.effects) {
      const x = fx.x - cam;
      switch (fx.kind) {
        case 'text':
          text(fx.text, x, fx.y, { size: 6, color: '#ffffff' });
          break;
        case 'coin':
          blit(sprite('coin', COIN, COIN_PAL), x, fx.y);
          break;
        case 'debris':
          rect(x, fx.y, 6, 6, THEMES[game.level.theme].brick);
          rect(x, fx.y, 6, 1, '#000000');
          break;
        case 'confetti':
          rect(x, fx.y, 2, 2, fx.color);
          break;
        case 'puff': {
          const r = 12 - fx.t;
          rect(x + 4 - r / 2, fx.y + 4 - r / 2, r, r, fx.t % 4 < 2 ? '#ffb000' : '#ff4b1f');
          break;
        }
        default:
          break;
      }
    }
  }

  // ───────────────────────────── HUD & screens ─────────────────────────────

  function drawHud(game) {
    const coin = sprite('coin', COIN, COIN_PAL);
    text('NEYMARIO', 16, 8);
    text(String(game.score).padStart(6, '0'), 16, 18);
    ctx.drawImage(coin, 2, 2, 12, 12, 85, 17, 8, 8);
    text(`x${String(game.coins).padStart(2, '0')}`, 96, 18);
    text('CUP', 144, 8);
    text(game.level.code, 144, 18);
    text('TIME', 208, 8);
    const showTime = game.state !== 'intro' && game.state !== 'title';
    text(showTime ? String(game.time).padStart(3, '0') : '', 208, 18, {
      color: game.time <= 100 && game.state === 'play' ? '#ff6060' : '#ffffff',
    });
  }

  function drawWorld(game) {
    const theme = THEMES[game.level.theme];
    const cam = Math.round(game.camX);
    const shake = game.shake > 0 ? (game.frame % 2 ? 2 : -2) : 0;
    ctx.save();
    ctx.translate(0, shake);
    drawBackground(game, theme, cam);
    const behind = (e) => e.emerge > 0 || e.type === 'keeper';
    for (const e of game.entities) if (behind(e)) drawEntity(e, game, cam);
    // Going through a pipe, Neymario is drawn behind it.
    if (game.player.inPipe) drawPlayer(game, cam);
    drawCornerFlag(game, cam);
    drawCheckpoint(game, cam);
    drawNetBack(game, cam);
    drawTiles(game, theme, cam);
    drawCupAxe(game, cam);
    for (const e of game.entities) if (!behind(e)) drawEntity(e, game, cam);
    if (!game.player.inPipe) drawPlayer(game, cam);
    drawMatchBall(game, cam);
    drawNetFront(game, cam);
    drawLava(game, cam);
    drawEffects(game, cam);
    ctx.restore();
    drawGoalBanner(game);
  }

  function panel(x, y, w, h) {
    rect(x, y, w, h, 'rgba(6,10,30,0.92)');
    rect(x, y, w, 2, '#ffdf00');
    rect(x, y + h - 2, w, 2, '#009c3b');
  }

  function drawTitle(game) {
    drawWorld(game);
    panel(20, 34, 216, 118);
    text('SUPER', 128, 44, { align: 'center', color: '#ffdf00' });
    text('NEYMARIO', 128, 56, { size: 20, align: 'center', color: '#ffdf00' });
    text('THE HEXA QUEST', 128, 82, { align: 'center', color: '#5fe07a' });
    blit(sprite('ney:small:stand:base', NEY_SMALL.stand, NEY_PAL), 64, 100);
    blit(sprite('football', FOOTBALL, FOOTBALL_PAL), 82, 100);
    blit(sprite('blaze0', BLAZE, BLAZE_PALS[0]), 100, 100);
    blit(sprite('noodles', NOODLES, NOODLES_PAL), 116, 100);
    blit(sprite('feather', FEATHER, FEATHER_PAL), 132, 100);
    blit(sprite('boss:false', BOSS.closed, BOSS_PAL, 32), 156, 84);
    const options = game.titleOptions();
    options.forEach((opt, i) => {
      const y = options.length > 1 ? 120 + i * 11 : 126;
      const chosen = i === game.titleChoice % options.length;
      text(opt, 128, y, { align: 'center', color: chosen ? '#ffffff' : '#7a7a8a' });
      if (chosen && (game.frame >> 4) % 2 === 0) text('>', 128 - opt.length * 4 - 12, y, { color: '#ffdf00' });
    });
    if (game.save.complete) blit(sprite('trophy', TROPHY, TROPHY_PAL), 196, 118);
    text(`TOP- ${String(game.highScore).padStart(6, '0')}`, 128, 143, { size: 6, align: 'center', color: '#bbbbbb' });
    panel(8, 156, 240, 76);
    const lines = [
      'ARROWS MOVE   Z/SPACE JUMP',
      'X/SHIFT RUN + SHOOT, RUN+DOWN ROLL',
      'DOWN: CROUCH, PIPES, MID-AIR POUND',
      'JUMP OFF WALLS   P PAUSE  M MUTE',
      'A FAN PARODY - NOT AFFILIATED',
    ];
    lines.forEach((l, i) => text(l, 128, 163 + i * 13, { size: 6, align: 'center', color: i === 4 ? '#999999' : '#ffffff' }));
  }

  function drawIntro(game) {
    rect(0, 0, SCREEN_W, SCREEN_H, '#000000');
    drawHud(game);
    const L = game.level;
    text(L.cup, 128, 52, { align: 'center', color: '#ffdf00' });
    text(L.stage, 128, 66, { size: 6, align: 'center', color: '#bbbbbb' });
    drawBrazilFlag(44, 92);
    text('BRASIL', 64, 94, { size: 8 });
    text('X', 128, 94, { align: 'center', color: '#ffdf00' });
    text(L.opponent, 194, 94, { size: 8, align: 'right' });
    drawFlag(L, 198, 92);
    text(L.venue, 128, 112, { size: 6, align: 'center', color: '#bbbbbb' });
    blit(sprite('ney:small:stand:base', NEY_SMALL.stand, NEY_PAL), 100, 136);
    text(`x  ${game.lives}`, 124, 141);
    const powerIcon = { fire: ['blaze0', BLAZE, BLAZE_PALS[0]], roll: ['noodles', NOODLES, NOODLES_PAL], pombo: ['feather', FEATHER, FEATHER_PAL] }[L.power];
    if (powerIcon) {
      text('POWER', 168, 141, { size: 6, color: '#bbbbbb' });
      blit(sprite(...powerIcon), 204, 136);
    }
    if (L.realScore) text(`REAL RESULT: ${L.realScore}`, 128, 176, { size: 6, align: 'center', color: '#888888' });
    text(L.tip, 128, 192, { size: 6, align: 'center', color: '#5fe07a' });
  }

  function drawGameOver(game) {
    rect(0, 0, SCREEN_W, SCREEN_H, '#000000');
    drawHud(game);
    text('GAME OVER', 128, 104, { align: 'center' });
    text('THE DICTATOR STILL RULES...', 128, 124, { size: 6, align: 'center', color: '#ff6060' });
  }

  function drawVictory(game) {
    drawWorld(game);
    panel(14, 40, 228, 150);
    text('GOLACO!', 128, 52, { size: 16, align: 'center', color: '#ffdf00' });
    text('MBAPPE DITADOR HAS FALLEN', 128, 78, { size: 6, align: 'center', color: '#ff8080' });
    text('THE HEXA IS OURS!', 128, 94, { align: 'center', color: '#5fe07a' });
    for (let i = 0; i < 6; i++) {
      const bob = Math.round(Math.sin((game.frame + i * 10) / 10) * 2);
      blit(sprite('trophy', TROPHY, TROPHY_PAL), 76 + i * 18, 110 + bob);
    }
    text(`SCORE ${String(game.score).padStart(6, '0')}`, 128, 140, { align: 'center' });
    text('THANK YOU NEYMARIO!', 128, 156, { size: 6, align: 'center' });
    if (game.stateTimer === 0 && (game.frame >> 5) % 2 === 0) text('PRESS ENTER', 128, 172, { size: 6, align: 'center' });
  }

  function draw(game) {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    switch (game.state) {
      case 'title':
        drawTitle(game);
        return;
      case 'intro':
        drawIntro(game);
        return;
      case 'map':
        drawWorldMap({ ctx, rect, text, sprite, blit, panel }, game);
        return;
      case 'gameover':
        drawGameOver(game);
        return;
      case 'victory':
        drawVictory(game);
        return;
      default:
        drawWorld(game);
        drawHud(game);
        if (game.paused) {
          panel(78, 100, 100, 30);
          text('PAUSED', 128, 111, { align: 'center' });
        }
    }
  }

  return { draw };
}
