import { ROWS, TILE, GROUND_ROW } from './constants.js';

/*
 * Tile chars stored in a built level:
 *   '(' ')' sideways pipe mouth (top/bottom)     '-' '_' sideways pipe body (top/bottom)
 *   ' ' air      '#' ground      'B' brick       '?' prize block (shows a World Cup trophy)   'U' used block
 *   'S' solid    'h' hidden blk  'C' coin        '=' bridge           'L' lava
 *   '[' ']' pipe top (left/right)                '{' '}' pipe body (left/right)
 *   'I' ice      'X' shipping container          'K' ball cannon      'G' gate bars before the cup
 *
 * `place()` accepts a few authoring shorthands that expand to a tile plus contents:
 *   'M' prize block with a power-up (football, or Blaze when already big)
 *   '*' brick hiding a World Cup trophy (invincibility)
 *   'c' brick holding 10 coins
 *   '1' hidden block with a golden ball (1UP)
 *   '.' leave the existing tile untouched
 */
const PLACE = {
  ' ': { tile: ' ' },
  '#': { tile: '#' },
  B: { tile: 'B' },
  '?': { tile: '?', content: 'coin' },
  M: { tile: '?', content: 'power' },
  '*': { tile: 'B', content: 'star' },
  c: { tile: 'B', content: 'coins' },
  1: { tile: 'h', content: '1up' },
  C: { tile: 'C' },
  S: { tile: 'S' },
  U: { tile: 'U' },
  '=': { tile: '=' },
  L: { tile: 'L' },
  I: { tile: 'I' },
  X: { tile: 'X' },
  K: { tile: 'K' },
  G: { tile: 'G' },
};

export class LevelBuilder {
  constructor(width) {
    this.width = width;
    this.tiles = Array.from({ length: ROWS }, () => new Array(width).fill(' '));
    this.contents = new Map();
    this.spawns = [];
    this.flagX = null;
    this.castleX = null;
    this.axe = null;
    this.bridge = null;
    this.warp = null;
    this.exit = null;
    this.sideExit = null;
    this.checkpoint = null;
    this.gate = null;
  }

  place(x, y, str) {
    [...str].forEach((ch, i) => {
      if (ch === '.') return;
      const spec = PLACE[ch];
      if (!spec) throw new Error(`Unknown level char "${ch}"`);
      const tx = x + i;
      if (tx < 0 || tx >= this.width || y < 0 || y >= ROWS) return;
      this.tiles[y][tx] = spec.tile;
      const key = `${tx},${y}`;
      if (spec.content) {
        this.contents.set(key, { type: spec.content, count: spec.content === 'coins' ? 10 : 1 });
      } else {
        this.contents.delete(key);
      }
    });
    return this;
  }

  fill(x, y, w, h, ch) {
    for (let j = 0; j < h; j++) this.place(x, y + j, ch.repeat(w));
    return this;
  }

  /** Ground from column x0 to x1 inclusive. */
  ground(x0, x1) {
    return this.fill(x0, GROUND_ROW, x1 - x0 + 1, ROWS - GROUND_ROW, '#');
  }

  lava(x0, x1, top = GROUND_ROW) {
    return this.fill(x0, top, x1 - x0 + 1, ROWS - top, 'L');
  }

  /** Slippery ground: ice on top, solid underneath. */
  ice(x0, x1) {
    this.ground(x0, x1);
    return this.fill(x0, GROUND_ROW, x1 - x0 + 1, 1, 'I');
  }

  /** Solid column `h` tiles tall standing on the ground. */
  column(x, h, ch = 'S') {
    return this.fill(x, GROUND_ROW - h, 1, h, ch);
  }

  /** Staircase `h` steps long; dir 1 climbs to the right, -1 descends. */
  stairs(x, h, dir = 1, ch = 'S') {
    for (let i = 0; i < h; i++) this.column(x + i, dir > 0 ? i + 1 : h - i, ch);
    return this;
  }

  pipe(x, h) {
    const top = GROUND_ROW - h;
    this.tiles[top][x] = '[';
    this.tiles[top][x + 1] = ']';
    for (let y = top + 1; y < GROUND_ROW; y++) {
      this.tiles[y][x] = '{';
      this.tiles[y][x + 1] = '}';
    }
    return this;
  }

  /** A pipe Neymario can go down (↓ on top) into the level's hidden bonus room. */
  warpPipe(x, h) {
    this.warp = { x, top: GROUND_ROW - h };
    return this.pipe(x, h);
  }

  /** The pipe he pops back out of after the bonus room. */
  exitPipe(x, h) {
    this.exit = { x, top: GROUND_ROW - h };
    return this.pipe(x, h);
  }

  /** Bonus-room exit: a sideways pipe mouth at column x (rows row, row+1), running to the right wall and up. */
  sidePipe(x, row) {
    this.tiles[row][x] = '(';
    this.tiles[row + 1][x] = ')';
    for (let tx = x + 1; tx < this.width; tx++) {
      this.tiles[row][tx] = '-';
      this.tiles[row + 1][tx] = '_';
    }
    for (let y = 3; y < row; y++) {
      this.tiles[y][x + 1] = '{';
      if (x + 2 < this.width) this.tiles[y][x + 2] = '}';
    }
    this.sideExit = { x, row };
    return this;
  }

  /** A pipe with a goalkeeper hiding in it. */
  keeperPipe(x, h) {
    this.pipe(x, h);
    this.spawns.push({ type: 'keeper', x: x * TILE + 8, top: (GROUND_ROW - h) * TILE });
    return this;
  }

  /** Enemy standing on top of `row` - 1 (defaults to the ground); for flyers, the row they cruise at. */
  enemy(type, x, row = GROUND_ROW - 1) {
    this.spawns.push({ type, x: x * TILE, bottom: (row + 1) * TILE });
    return this;
  }

  /** Ball launcher on tile (x, row). */
  cannon(x, row = GROUND_ROW - 1) {
    this.place(x, row, 'K');
    this.spawns.push({ type: 'cannon', x: x * TILE, y: row * TILE });
    return this;
  }

  /** Lift `w` tiles wide at tile (x, y), swinging back and forth by (dx, dy) tiles. */
  lift(x, y, w, { dx = 0, dy = 0, speed = 0.6 } = {}) {
    this.spawns.push({ type: 'lift', x: x * TILE, y: y * TILE, w: w * TILE, dx: dx * TILE, dy: dy * TILE, speed });
    return this;
  }

  /** Trampoline pad sunk flush into the ground: run over it to bounce, hold jump to fly. */
  spring(x) {
    this.place(x, GROUND_ROW, ' ');
    this.spawns.push({ type: 'spring', x: x * TILE, y: GROUND_ROW * TILE });
    return this;
  }

  /** A lava bubble that leaps out of the lava at column x. */
  bubble(x) {
    this.spawns.push({ type: 'bubble', x: x * TILE, lavaTop: GROUND_ROW * TILE });
    return this;
  }

  /** Halfway flag: losing a life after passing it restarts here. */
  checkpointAt(x) {
    this.checkpoint = x;
    return this;
  }

  /** Bars at column x (rows y0..y1) that only open once the boss is beaten. */
  gateAt(x, y0, y1) {
    this.fill(x, y0, 1, y1 - y0 + 1, 'G');
    this.gate = { x, y0, y1 };
    return this;
  }

  firebar(x, y, { length = 6, speed = 0.04 } = {}) {
    this.place(x, y, 'U');
    this.spawns.push({ type: 'firebar', x: x * TILE, cx: x * TILE + 8, cy: y * TILE + 8, length, speed });
    return this;
  }

  boss(x, row = GROUND_ROW - 1) {
    this.spawns.push({ type: 'boss', x: x * TILE, bottom: (row + 1) * TILE });
    return this;
  }

  /** Corner-flag pole at column x on a solid base, with the goal Neymario scores in 5 tiles after. */
  goal(x) {
    this.flagX = x;
    this.place(x, GROUND_ROW - 1, 'S');
    return this.net(x + 5);
  }

  /** The goal (side view, 5 tiles deep) for the end-of-level celebration. */
  net(x) {
    this.castleX = x;
    return this;
  }

  bridgeSpan(x0, x1, row = GROUND_ROW) {
    this.fill(x0, row, x1 - x0 + 1, 1, '=');
    this.bridge = { x0, x1, row };
    return this;
  }

  /** The World Cup trophy that collapses the bridge (the "axe"). */
  trophy(x, row = GROUND_ROW - 2) {
    this.axe = { x: x * TILE, y: row * TILE, w: TILE, h: 2 * TILE };
    return this;
  }

  finish(def) {
    const { build, bonus, ...meta } = def;
    return {
      ...meta,
      width: this.width,
      time: def.time ?? 400,
      tiles: this.tiles,
      contents: this.contents,
      spawns: [...this.spawns].sort((a, b) => a.x - b.x),
      flagX: this.flagX,
      castleX: this.castleX,
      axe: this.axe,
      bridge: this.bridge,
      warp: this.warp,
      exit: this.exit,
      sideExit: this.sideExit,
      checkpoint: this.checkpoint,
      gate: this.gate,
      hasBoss: this.spawns.some((s) => s.type === 'boss'),
      spawn: { x: 40, bottom: GROUND_ROW * TILE },
    };
  }
}

/** Builds a fresh, mutable copy of a level definition. */
export function buildLevel(def) {
  const builder = new LevelBuilder(def.width);
  def.build(builder);
  return builder.finish(def);
}

/**
 * A one-screen underground bonus room, like the original's coin rooms. `rows`
 * are [x, y, chars] placements; the exit is the sideways pipe on the right.
 */
const bonusRoom = (rows) => ({
  width: 16,
  theme: 'tunnel',
  build(B) {
    B.ground(0, 15);
    B.fill(0, 2, 16, 1, 'B');
    B.fill(0, 3, 1, 10, 'B');
    for (const [x, y, chars] of rows) B.place(x, y, chars);
    B.sidePipe(13, 11);
  },
});

const CROATIA = {
  kit: { shirt: '#e8202a', shirt2: '#ffffff', shorts: '#ffffff', skin: '#f1c27d', hair: '#6b4a2a' },
  flag: { dir: 'h', colors: ['#e8202a', '#ffffff', '#1a3c9c'] },
};
const MEXICO = {
  kit: { shirt: '#006847', shirt2: '#006847', shorts: '#ffffff', skin: '#c68642', hair: '#2a1a0a' },
  flag: { dir: 'v', colors: ['#006847', '#ffffff', '#ce1126'] },
};
const SERBIA = {
  kit: { shirt: '#c6363c', shirt2: '#c6363c', shorts: '#0c4076', skin: '#f1c27d', hair: '#3b2716' },
  flag: { dir: 'h', colors: ['#c6363c', '#0c4076', '#ffffff'] },
};
const FRANCE = {
  kit: { shirt: '#21304d', shirt2: '#21304d', shorts: '#ffffff', skin: '#8d5524', hair: '#1a1008' },
  flag: { dir: 'v', colors: ['#0055a4', '#ffffff', '#ef4135'] },
};

const CUP_2014 = { cup: 'WORLD CUP 2014', power: 'fire' };
const CUP_2018 = { cup: 'WORLD CUP 2018', power: 'roll' };
const CUP_2022 = { cup: 'WORLD CUP 2022', power: 'pombo' };
const THE_FINAL = { cup: 'THE FINAL', power: 'fire', theme: 'castle', ...FRANCE, realScore: null };

/** The usual run-up to the corner flag: an 8-step staircase, then the flag and goal. */
const finale = (L, ch = 'S') => {
  L.stairs(183, 8, 1, ch).column(191, 8, ch);
  L.goal(200);
};

// Every match of Neymar's at the World Cup, in order. Each has its own gimmick.
export const LEVELS = [
  // ───────────── WORLD CUP 2014 · BRASIL ─────────────
  {
    id: '2014-1', code: '2014-1', ...CUP_2014, stage: 'OPENING MATCH', opponent: 'CROATIA',
    venue: 'SAO PAULO', realScore: 'BRA 3-1 CRO', tip: 'GRAB THE FOOTBALL TO GROW!', theme: 'day', ...CROATIA,
    bonus: bonusRoom([[4, 12, 'BBBBBBB'], [4, 11, 'CCCCCCC'], [4, 10, 'CCCCCCC'], [4, 6, 'CCCCCCC']]),
    width: 214,
    build(L) {
      L.ground(0, 70).ground(73, 88).ground(92, 155).ground(158, 213);
      L.place(16, 9, 'M');
      L.place(20, 9, 'B?B?B').place(22, 5, '?');
      L.enemy('defender', 24);
      L.pipe(28, 2).pipe(38, 3).enemy('defender', 42).pipe(46, 4);
      L.enemy('defender', 51).enemy('defender', 53).warpPipe(57, 4);
      L.place(64, 8, '1');
      L.place(77, 9, 'BMB').place(80, 5, 'BBBBBBBB');
      L.enemy('defender', 81, 4).enemy('defender', 83, 4);
      L.place(93, 5, 'BBB?').place(96, 9, 'c').checkpointAt(98);
      L.enemy('defender', 99).enemy('defender', 101).place(102, 9, 'B*');
      L.place(108, 9, '?').place(111, 9, '?').place(114, 9, '?').place(111, 5, 'M');
      L.enemy('referee', 110);
      L.enemy('defender', 116).enemy('defender', 118);
      L.place(120, 9, 'B').place(123, 5, 'BBB');
      L.enemy('defender', 126).enemy('defender', 128);
      L.place(130, 5, 'B??B').place(131, 9, 'BB');
      L.stairs(136, 4, 1).stairs(142, 4, -1);
      L.stairs(151, 4, 1).column(155, 4).stairs(158, 4, -1);
      L.exitPipe(165, 2).place(170, 9, 'BB?B');
      L.enemy('defender', 175).enemy('defender', 177).pipe(181, 2);
      finale(L);
    },
  },
  {
    // 0-0: Ochoa's day. A maze of pipes, every other one hiding a goalkeeper.
    id: '2014-2', code: '2014-2', ...CUP_2014, stage: 'GROUP STAGE', opponent: 'MEXICO',
    venue: 'FORTALEZA', realScore: 'BRA 0-0 MEX', tip: 'KEEPERS GUARD THE PIPES. TIME YOUR JUMPS!', theme: 'day', ...MEXICO,
    bonus: bonusRoom([[3, 12, 'CCCCCCCCC'], [3, 9, 'BBBBBBB'], [3, 8, 'CCCCCCC'], [5, 5, 'C1C']]),
    width: 214,
    build(L) {
      L.ground(0, 60).ground(64, 120).ground(124, 213);
      L.place(10, 9, '?M?');
      L.keeperPipe(18, 2).enemy('defender', 22);
      L.keeperPipe(26, 3).pipe(32, 4);
      L.keeperPipe(38, 3).enemy('defender', 42).enemy('defender', 44);
      L.warpPipe(48, 2).place(52, 9, 'B?B');
      L.keeperPipe(56, 4);
      L.keeperPipe(66, 3).place(71, 9, 'BBBB').place(71, 5, 'C?CC');
      L.enemy('referee', 75).keeperPipe(79, 2).place(83, 9, 'M');
      L.keeperPipe(88, 4).pipe(94, 2).checkpointAt(97);
      L.keeperPipe(100, 3).enemy('defender', 104).enemy('defender', 106);
      L.place(108, 9, 'B*B').keeperPipe(114, 4);
      L.exitPipe(128, 2).enemy('referee', 134).keeperPipe(140, 3);
      L.place(146, 9, '?B?').keeperPipe(152, 2).enemy('defender', 156).enemy('defender', 158);
      L.keeperPipe(162, 4).place(167, 8, 'CCC').pipe(172, 3).keeperPipe(177, 2);
      finale(L);
    },
  },
  {
    // 4-1: Neymar's double. Up in the treetops, riding lifts under camera drones.
    id: '2014-3', code: '2014-3', ...CUP_2014, stage: 'GROUP STAGE', opponent: 'CAMEROON',
    venue: 'BRASILIA', realScore: 'BRA 4-1 CMR', tip: 'RIDE THE LIFTS. WATCH OUT FOR DRONES!', theme: 'day',
    kit: { shirt: '#007a3d', shirt2: '#007a3d', shorts: '#ce1126', skin: '#5c3a1e', hair: '#120a04' },
    flag: { dir: 'v', colors: ['#007a3d', '#ce1126', '#fcd116'] },
    bonus: bonusRoom([[4, 12, 'BBBBBBB'], [4, 11, 'CCCCCCC'], [4, 8, 'CCCCCCC'], [4, 5, 'CCCCCCC']]),
    width: 214,
    build(L) {
      L.ground(0, 22).place(8, 9, '?M?').warpPipe(14, 2).enemy('defender', 19);
      L.place(25, 10, 'SSSS').place(25, 9, 'CCCC');
      L.lift(31, 9, 3, { dx: 5 });
      L.place(41, 8, 'SSSS').enemy('defender', 42, 7);
      L.lift(47, 10, 3, { dy: -4, speed: 0.8 });
      L.place(52, 5, 'SSSSSS').place(52, 4, 'CCCCCC').enemy('drone', 56, 2);
      L.place(60, 8, 'SSS');
      L.lift(65, 8, 3, { dx: 6, speed: 0.7 });
      L.ground(75, 95).place(78, 9, 'B?B?B').checkpointAt(80);
      L.enemy('defender', 84).enemy('defender', 86).enemy('drone', 90, 8).place(92, 9, 'M');
      L.place(98, 10, 'SSS');
      L.lift(103, 10, 3, { dy: -5, speed: 0.8 });
      L.place(108, 5, 'SSSSS').enemy('drone', 110, 2);
      L.lift(115, 6, 3, { dx: 6 });
      L.place(125, 7, 'SSSS').place(125, 6, 'C*CC').place(131, 9, 'SS');
      L.ground(135, 160).exitPipe(140, 2).enemy('referee', 146).place(150, 9, 'B?B').enemy('drone', 154, 9);
      L.place(163, 10, 'SS');
      L.lift(167, 10, 3, { dx: 5 });
      L.place(176, 10, 'SS');
      L.ground(179, 213);
      finale(L);
    },
  },
  {
    // 1-1, won on penalties. A night of cannons, springboards and studs-up boots.
    id: '2014-4', code: '2014-4', ...CUP_2014, stage: 'ROUND OF 16', opponent: 'CHILE',
    venue: 'BELO HORIZONTE', realScore: 'BRA 1-1 CHI (3-2 PENS)', tip: 'CANNONS FIRE! SPRINGS LAUNCH YOU HIGH!', theme: 'night',
    kit: { shirt: '#d52b1e', shirt2: '#d52b1e', shorts: '#0039a6', skin: '#c68642', hair: '#1a1008' },
    flag: { dir: 'h', colors: ['#ffffff', '#d52b1e'] },
    bonus: bonusRoom([[3, 12, 'C.C.C.C.C'], [3, 10, 'SSSSSSS'], [3, 9, 'CCCCCCC'], [4, 6, 'CCCCC']]),
    width: 214,
    build(L) {
      L.ground(0, 50).ground(56, 110).ground(116, 213);
      L.place(9, 9, 'M').enemy('defender', 16).cannon(22);
      L.enemy('defender', 28).enemy('defender', 30).warpPipe(34, 3);
      L.place(40, 12, 'S').cannon(40, 11);
      L.spring(45).fill(48, 5, 2, 8, 'S').place(48, 3, 'CC');
      L.enemy('studs', 62).place(64, 9, 'B?B?B').enemy('defender', 66).cannon(72);
      L.spring(77).place(80, 4, 'BBBBBB').place(80, 3, 'CCCCCC');
      L.enemy('studs', 84).checkpointAt(88).enemy('referee', 92);
      L.place(98, 12, 'S').cannon(98, 11).place(102, 9, 'B*B');
      L.exitPipe(120, 2).enemy('studs', 126).enemy('studs', 130).cannon(136);
      L.place(140, 9, '?M?');
      L.spring(149).fill(152, 6, 2, 7, 'S').place(152, 4, 'CC');
      L.enemy('defender', 158).enemy('defender', 160);
      L.place(166, 12, 'S').cannon(166, 11).enemy('referee', 172);
      finale(L);
    },
  },
  {
    // 2-1 quarter-final. Zúñiga's knee: the studs come out.
    id: '2014-5', code: '2014-5', ...CUP_2014, stage: 'QUARTER-FINAL', opponent: 'COLOMBIA',
    venue: 'FORTALEZA', realScore: 'BRA 2-1 COL', tip: "STUDS-UP BOOTS! DON'T STOMP THEM!", theme: 'dusk',
    // Away kit, so defenders can't be mistaken for Neymario's yellow and blue.
    kit: { shirt: '#14204a', shirt2: '#14204a', shorts: '#ffffff', skin: '#c68642', hair: '#2a1a0a' },
    flag: { dir: 'h', colors: ['#fcd116', '#fcd116', '#003893', '#ce1126'] },
    bonus: bonusRoom([[3, 12, 'CCCCCCCCC'], [3, 9, 'BBBBBBB'], [3, 8, 'CCCCCCC'], [5, 5, 'CcC']]),
    width: 214,
    build(L) {
      L.ground(0, 45).ground(49, 80).ground(84, 87).ground(91, 130).ground(135, 213);
      L.place(12, 9, '?M?');
      L.enemy('defender', 18).enemy('studs', 21);
      L.pipe(24, 3).place(30, 9, 'BBBBB').place(30, 5, 'CCCCC');
      L.enemy('referee', 34);
      L.place(38, 9, 'B?B').place(39, 5, '?').enemy('studs', 42);
      L.place(52, 9, 'BcB');
      L.enemy('defender', 56).enemy('studs', 58).enemy('defender', 60);
      L.warpPipe(64, 2).pipe(70, 4).enemy('referee', 75);
      L.place(85, 9, '?').place(84, 5, 'CCCC');
      L.stairs(94, 3, 1).place(100, 9, 'B?B').place(100, 5, 'CCC').checkpointAt(98);
      L.enemy('studs', 104).enemy('referee', 108);
      L.place(112, 9, 'M').place(115, 9, 'BBBB').place(115, 5, 'B*BB');
      L.enemy('defender', 116, 8);
      L.exitPipe(124, 3).enemy('studs', 127).enemy('defender', 129);
      L.place(132, 10, 'SS');
      L.stairs(139, 4, 1).column(143, 4).stairs(144, 4, -1);
      L.enemy('referee', 152).place(156, 9, '?B?B?');
      L.enemy('studs', 160).enemy('defender', 162).enemy('drone', 164, 8);
      L.keeperPipe(168, 2).place(173, 9, 'BMB').enemy('referee', 177);
      finale(L);
    },
  },

  // ───────────── WORLD CUP 2018 · RUSSIA ─────────────
  {
    // 1-1 in Rostov. Alpine Swiss: an icy pitch where nothing stops on time.
    id: '2018-1', code: '2018-1', ...CUP_2018, stage: 'GROUP STAGE', opponent: 'SWITZERLAND',
    venue: 'ROSTOV-ON-DON', realScore: 'BRA 1-1 SUI', tip: 'ICY PITCH! RUN, THEN DOWN TO ROLL.', theme: 'snow',
    kit: { shirt: '#d52b1e', shirt2: '#d52b1e', shorts: '#ffffff', skin: '#f1c27d', hair: '#5a3a1a' },
    flag: { dir: 'cross', colors: ['#d52b1e', '#ffffff'] },
    bonus: bonusRoom([[4, 12, 'BBBBBBB'], [4, 11, 'CCCCCCC'], [4, 10, 'CCCCCCC'], [5, 6, 'CcCcC']]),
    width: 214,
    build(L) {
      L.ground(0, 24).ice(25, 60).ice(64, 100).ground(101, 125).ice(130, 175).ground(176, 213);
      L.place(10, 9, '?M?').enemy('defender', 18);
      L.warpPipe(28, 2).place(34, 9, 'BBB');
      L.enemy('defender', 38).enemy('defender', 40).enemy('drone', 46, 8);
      L.place(50, 9, 'M').stairs(54, 3, 1).column(57, 3);
      L.enemy('referee', 70).place(74, 9, 'B?B?B').place(75, 5, 'C1C');
      L.enemy('studs', 82).enemy('matryoshka', 88).checkpointAt(96);
      L.exitPipe(106, 2).enemy('defender', 112).enemy('defender', 114).place(118, 9, 'B*B');
      L.enemy('drone', 140, 8).enemy('referee', 146).place(150, 9, '?B?');
      L.enemy('studs', 156).enemy('defender', 160);
      L.place(164, 9, 'IIII').place(164, 8, 'CCCC');
      finale(L);
    },
  },
  {
    // 2-0 in Saint Petersburg, city of canals: cross them on lifts while cannons fire.
    id: '2018-2', code: '2018-2', ...CUP_2018, stage: 'GROUP STAGE', opponent: 'COSTA RICA',
    venue: 'SAINT PETERSBURG', realScore: 'BRA 2-0 CRC', tip: 'RIDE THE LIFTS ACROSS THE CANALS!', theme: 'dusk',
    kit: { shirt: '#ce1126', shirt2: '#ce1126', shorts: '#002b7f', skin: '#c68642', hair: '#1a1008' },
    flag: { dir: 'h', colors: ['#002b7f', '#ffffff', '#ce1126', '#ce1126', '#ffffff', '#002b7f'] },
    bonus: bonusRoom([[3, 12, 'CCCCCCCCC'], [3, 10, 'B.B.B.B.B'], [3, 7, 'CCCCCCCCC'], [3, 4, 'CCCCCCCCC']]),
    width: 214,
    build(L) {
      L.ground(0, 26).place(10, 9, '?M?').enemy('defender', 16).enemy('defender', 18).warpPipe(22, 2);
      L.lift(28, 11, 3, { dx: 6 });
      L.ground(41, 70).cannon(46).enemy('matryoshka', 52).place(56, 9, 'B?B').place(57, 5, 'M');
      L.enemy('referee', 62).place(66, 12, 'S').cannon(66, 11);
      L.lift(72, 10, 3, { dx: 6 });
      L.place(82, 8, 'SS');
      L.lift(86, 9, 3, { dx: 3, speed: 0.5 });
      L.ground(92, 125).checkpointAt(100).enemy('matryoshka', 104).place(108, 9, '?B*B?');
      L.exitPipe(116, 3).cannon(122);
      L.lift(127, 11, 3, { dy: -5, speed: 0.8 });
      L.place(132, 6, 'SSSS').place(132, 5, 'CCCC').enemy('drone', 134, 3);
      L.lift(138, 6, 3, { dx: 6 });
      L.ground(151, 213).enemy('referee', 156).enemy('matryoshka', 162);
      L.place(168, 12, 'S').cannon(168, 11).place(172, 9, 'BMB');
      finale(L);
    },
  },
  {
    // 2-0 in Moscow. Red Square at night, crowded with nesting dolls.
    id: '2018-3', code: '2018-3', ...CUP_2018, stage: 'GROUP STAGE', opponent: 'SERBIA',
    venue: 'MOSCOW', realScore: 'BRA 2-0 SRB', tip: 'MATRYOSHKAS SPLIT IN TWO. KEEP STOMPING!', theme: 'night', ...SERBIA,
    bonus: bonusRoom([[4, 12, 'BBBBBBB'], [4, 11, 'CCCCCCC'], [4, 8, 'CCCCCCC'], [4, 5, 'CCCCCCC']]),
    width: 214,
    build(L) {
      L.ground(0, 45).ground(50, 100).ground(105, 150).ground(155, 213);
      L.place(9, 9, 'M').enemy('matryoshka', 16).enemy('matryoshka', 22);
      L.place(26, 9, 'BBBBBB').place(26, 5, 'B?B?BB').enemy('matryoshka', 28, 8);
      L.warpPipe(36, 3).enemy('defender', 41);
      L.place(54, 9, '?c?').enemy('matryoshka', 58);
      L.spring(63).fill(66, 9, 5, 4, 'B').place(66, 4, 'CCCCC');
      L.enemy('matryoshka', 74).enemy('referee', 78).place(84, 9, 'B*B').enemy('drone', 90, 8);
      L.stairs(94, 4, 1);
      L.checkpointAt(108).enemy('matryoshka', 112).enemy('matryoshka', 116).exitPipe(120, 2);
      L.place(126, 9, 'BMB').spring(132).place(134, 3, 'CCCC').enemy('studs', 138).enemy('matryoshka', 144);
      L.enemy('referee', 160).enemy('matryoshka', 166).enemy('matryoshka', 170).place(174, 9, '?B?');
      finale(L);
    },
  },
  {
    // 2-0 in Samara: floating platforms over the pitch, keepers in the pipes.
    id: '2018-4', code: '2018-4', ...CUP_2018, stage: 'ROUND OF 16', opponent: 'MEXICO',
    venue: 'SAMARA', realScore: 'BRA 2-0 MEX', tip: 'MIND THE GAPS. MIND THE KEEPERS!', theme: 'day', ...MEXICO,
    bonus: bonusRoom([[3, 12, 'C.C.C.C.C'], [3, 10, 'SSSSSSS'], [3, 9, 'CCCCCCC'], [4, 6, 'CCCCC'], [5, 4, 'C1C']]),
    width: 214,
    build(L) {
      L.ground(0, 30);
      L.place(10, 9, '?M?').enemy('defender', 16).enemy('defender', 18).keeperPipe(24, 2);
      L.place(33, 10, 'SSS').place(38, 8, 'SSSS').place(38, 7, 'CCCC').place(44, 10, 'SSS');
      L.ground(48, 70);
      L.enemy('matryoshka', 52).place(56, 9, 'B?B?B');
      L.warpPipe(63, 3).enemy('referee', 67);
      L.place(73, 10, 'SS').place(77, 8, 'SS').place(81, 6, 'SSS').place(81, 5, 'CCC');
      L.place(86, 8, 'SS').place(90, 10, 'SS');
      L.ground(94, 130).checkpointAt(96);
      L.enemy('defender', 98).enemy('defender', 100).place(104, 9, 'B*B');
      L.exitPipe(110, 4).enemy('referee', 114);
      L.place(118, 9, 'BBBBBB').place(118, 5, '?BBMBB');
      L.enemy('defender', 120, 8).enemy('defender', 122, 8).keeperPipe(127, 2);
      L.place(133, 9, 'SSSS').enemy('defender', 135, 8);
      L.lift(139, 7, 4, { dx: 3, speed: 0.5 }).place(140, 5, 'CCCC').place(147, 9, 'SSS');
      L.ground(152, 213);
      L.place(156, 9, '?').place(159, 8, '1');
      L.enemy('referee', 162).enemy('matryoshka', 165).enemy('defender', 168);
      L.stairs(172, 4, 1).stairs(176, 4, -1);
      finale(L);
    },
  },
  {
    // 1-2 in Kazan. The Red Devils' night: cannons, studs and a crowd of defenders.
    id: '2018-5', code: '2018-5', ...CUP_2018, stage: 'QUARTER-FINAL', opponent: 'BELGIUM',
    venue: 'KAZAN', realScore: 'BRA 1-2 BEL', tip: 'ROLL RIGHT THROUGH THE RED DEVILS!', theme: 'night',
    kit: { shirt: '#e30613', shirt2: '#b00010', shorts: '#e30613', skin: '#f1c27d', hair: '#3b2716' },
    flag: { dir: 'v', colors: ['#111111', '#fdda24', '#ef3340'] },
    bonus: bonusRoom([[4, 12, 'BBBBBBB'], [4, 11, 'CCCCCCC'], [4, 8, 'CCCCCCC'], [4, 5, 'CCCCCCC']]),
    width: 214,
    build(L) {
      L.ground(0, 60).ground(63, 100).ground(104, 140).ground(144, 213);
      L.place(10, 9, 'M');
      L.enemy('defender', 16).enemy('defender', 18).enemy('studs', 20);
      L.place(22, 9, 'BBBBB').place(23, 5, 'B?B').enemy('referee', 28);
      L.pipe(32, 3).cannon(36).warpPipe(40, 4);
      L.enemy('referee', 45).enemy('defender', 48).cannon(51);
      L.stairs(55, 4, 1).column(59, 4).column(60, 4).stairs(63, 4, -1);
      L.place(72, 9, '?c?').enemy('referee', 76);
      L.enemy('defender', 80).enemy('studs', 82);
      L.place(86, 9, 'BB*BB').place(86, 5, 'CCCCC');
      L.exitPipe(93, 2).enemy('defender', 96).enemy('defender', 98);
      L.checkpointAt(106).place(108, 9, 'M').enemy('referee', 112).enemy('referee', 116);
      L.place(120, 9, 'BBBB').place(120, 5, 'BBBB');
      L.enemy('defender', 121, 4).enemy('defender', 123, 4);
      L.keeperPipe(128, 3).enemy('studs', 133).enemy('defender', 135);
      L.stairs(137, 4, 1).stairs(144, 4, -1);
      L.place(152, 9, '?B?').enemy('referee', 156);
      L.enemy('defender', 160).enemy('studs', 162).place(165, 12, 'S').cannon(165, 11);
      L.pipe(168, 2).place(173, 9, 'BMB').enemy('referee', 178);
      finale(L);
    },
  },

  // ───────────── WORLD CUP 2022 · QATAR ─────────────
  {
    // 2-0 in Lusail. Brick bridges over the desert, falcons overhead.
    id: '2022-1', code: '2022-1', ...CUP_2022, stage: 'GROUP STAGE', opponent: 'SERBIA',
    venue: 'LUSAIL', realScore: 'BRA 2-0 SRB', tip: 'POMBO FEATHER: HOLD JUMP TO GLIDE!', theme: 'desert', ...SERBIA,
    bonus: bonusRoom([[3, 12, 'CCCCCCCCC'], [3, 10, 'B.B.B.B.B'], [3, 7, 'CCCCCCCCC'], [3, 4, 'CCCCCCCCC']]),
    width: 214,
    build(L) {
      L.ground(0, 40).ground(62, 100).ground(122, 150).ground(158, 213);
      L.place(8, 9, '?M?').enemy('defender', 15).enemy('defender', 17);
      L.warpPipe(22, 3).enemy('referee', 28).place(31, 9, 'B1B').place(36, 9, 'BBB');
      L.place(41, 10, 'BBBBBB..BBBBB..BBBBB').place(41, 6, 'CCCCCC..CCCCC..CCCCC');
      L.enemy('defender', 44, 9).enemy('falcon', 50, 3).enemy('referee', 57, 9);
      L.place(66, 9, 'M').place(70, 9, 'BBBBBBBB').place(70, 5, 'B?B?B?B?');
      L.enemy('defender', 72, 8).enemy('defender', 75, 8);
      L.exitPipe(82, 3).enemy('referee', 86).pipe(90, 4).checkpointAt(93);
      L.enemy('defender', 94).enemy('defender', 96);
      L.place(102, 10, 'SSS').place(107, 8, 'BBBB').place(107, 5, 'CCCC').enemy('falcon', 110, 3);
      L.place(113, 10, 'SSS').place(118, 9, 'SS');
      L.enemy('referee', 126).place(130, 9, 'B*B');
      L.enemy('defender', 134).enemy('defender', 136).enemy('studs', 138);
      L.stairs(144, 4, 1).column(148, 4).column(149, 4).column(150, 4);
      L.place(153, 9, 'SS').stairs(158, 4, -1);
      L.enemy('falcon', 164, 3).enemy('referee', 166).place(170, 9, '?B?B?').place(172, 5, 'M');
      L.enemy('defender', 174).enemy('defender', 176);
      finale(L);
    },
  },
  {
    // 4-1 at Stadium 974, built out of shipping containers by the Gulf.
    id: '2022-2', code: '2022-2', ...CUP_2022, stage: 'ROUND OF 16', opponent: 'SOUTH KOREA',
    venue: 'DOHA - STADIUM 974', realScore: 'BRA 4-1 KOR', tip: 'A STADIUM MADE OF CONTAINERS!', theme: 'port',
    kit: { shirt: '#e3172d', shirt2: '#e3172d', shorts: '#111111', skin: '#f1c27d', hair: '#111111' },
    flag: { dir: 'disc', colors: ['#ffffff', '#cd2e3a', '#0047a0'] },
    bonus: bonusRoom([[3, 12, 'CCCCCCCCC'], [3, 9, 'BBBBBBB'], [3, 8, 'CCCCCCC'], [5, 5, 'CcC']]),
    width: 214,
    build(L) {
      L.ground(0, 40).place(8, 9, '?M?').enemy('defender', 14);
      L.fill(18, 11, 4, 2, 'X').fill(24, 9, 4, 4, 'X').enemy('defender', 25, 8);
      L.warpPipe(32, 2).enemy('falcon', 36, 3);
      L.lift(42, 10, 3, { dx: 6 });
      L.place(52, 9, 'XXX').place(52, 8, 'CCC');
      L.ground(60, 120).fill(64, 10, 6, 3, 'X').fill(66, 7, 4, 3, 'X').place(66, 6, 'CCCC');
      L.enemy('referee', 72).cannon(78).place(82, 9, 'B?B?B').enemy('falcon', 88, 3);
      L.fill(92, 9, 3, 4, 'X').fill(95, 11, 3, 2, 'X').checkpointAt(100);
      L.enemy('defender', 104).enemy('defender', 106).exitPipe(112, 2).place(116, 9, 'M');
      L.fill(124, 10, 2, 5, 'X').fill(130, 8, 2, 7, 'X').fill(136, 10, 2, 5, 'X').enemy('falcon', 130, 3);
      L.ground(141, 213).enemy('referee', 146).place(152, 12, 'X').cannon(152, 11);
      L.fill(158, 11, 5, 2, 'X').fill(160, 9, 3, 2, 'X').enemy('defender', 160, 8);
      L.place(168, 9, '?B*B?').enemy('falcon', 172, 3).enemy('defender', 176).enemy('defender', 178);
      finale(L, 'X');
    },
  },
  {
    // 1-1, lost on penalties in Al Rayyan. This time: dodge the shootout and finish it.
    id: '2022-3', code: '2022-3', ...CUP_2022, stage: 'QUARTER-FINAL', opponent: 'CROATIA',
    venue: 'AL RAYYAN', realScore: 'BRA 1-1 CRO (2-4 PENS)', tip: 'PENALTY SHOOTOUT AHEAD. DODGE THE SHOTS!', theme: 'night', ...CROATIA,
    bonus: bonusRoom([[4, 12, 'BBBBBBB'], [4, 11, 'CCCCCCC'], [4, 10, 'CCCCCCC'], [5, 6, 'CcCcC']]),
    width: 214,
    build(L) {
      L.ground(0, 35).ground(40, 75).ground(80, 82).ground(87, 120);
      L.ground(126, 160).ground(165, 213);
      L.place(8, 9, 'M').enemy('referee', 14).enemy('defender', 18).enemy('defender', 20);
      L.pipe(24, 4).place(29, 9, 'B?B').enemy('defender', 32);
      L.place(37, 10, 'S');
      L.place(44, 9, 'BBBBBB').place(44, 5, 'c?BB?B').enemy('referee', 46, 8);
      L.enemy('defender', 50).enemy('falcon', 52, 3).enemy('studs', 54);
      L.keeperPipe(58, 3).warpPipe(64, 4).enemy('referee', 69).enemy('referee', 72);
      L.place(81, 9, 'M');
      L.stairs(90, 4, 1).column(94, 4).stairs(95, 4, -1).checkpointAt(99);
      L.enemy('defender', 100).enemy('defender', 102).enemy('falcon', 104, 3).enemy('referee', 108);
      L.place(110, 9, 'B*B').exitPipe(115, 2);
      L.place(122, 9, 'SSS');
      L.place(130, 9, '?BBB?').place(131, 5, 'BMB').enemy('referee', 134);
      L.enemy('studs', 138).enemy('defender', 140);
      L.keeperPipe(145, 3).pipe(151, 4).enemy('defender', 156).enemy('referee', 158);
      L.place(162, 10, 'SS');
      // The shootout: a row of ball launchers firing at the box.
      L.cannon(168).place(171, 9, '1').place(174, 12, 'S').cannon(174, 11).cannon(179);
      finale(L);
    },
  },

  // ───────────── THE FINAL ─────────────
  {
    id: 'final-1', code: 'FINAL-1', ...THE_FINAL, stage: "THE DICTATOR'S FORTRESS", opponent: 'FRANCE',
    venue: 'THE ROAD TO THE CUP', tip: 'LAVA BUBBLES! LIFTS OVER THE LAVA!', width: 170, time: 300,
    build(L) {
      L.fill(0, 2, 170, 1, '#');
      L.ground(0, 12).place(6, 9, 'M');
      L.lava(13, 18).bubble(15);
      L.ground(19, 34).firebar(26, 9, { speed: 0.04 }).enemy('defender', 30);
      L.lava(35, 44).bubble(39);
      L.lift(36, 10, 3, { dx: 5 });
      L.ground(45, 70).cannon(50).fill(54, 3, 8, 4, '#').firebar(58, 7, { speed: -0.045 });
      L.enemy('referee', 64).place(67, 9, '?');
      L.lava(71, 84).bubble(72).bubble(82).place(74, 10, 'SS');
      L.lift(78, 9, 3, { dy: -3, speed: 0.8 });
      L.ground(85, 120).checkpointAt(88).firebar(92, 9, { speed: 0.05, length: 7 });
      L.enemy('defender', 98).enemy('defender', 100).place(104, 12, 'S').cannon(104, 11);
      L.place(108, 9, 'B*B').firebar(114, 6, { speed: -0.04 });
      L.lava(121, 136).bubble(126).bubble(134);
      L.lift(122, 11, 3, { dx: 5 });
      L.place(131, 9, 'SS');
      L.ground(137, 169).enemy('referee', 142).cannon(148).stairs(152, 4, 1).column(156, 4);
      L.goal(160);
    },
  },
  {
    id: 'final-2', code: 'FINAL-2', ...THE_FINAL, stage: "THE DICTATOR'S CASTLE", opponent: 'FRANCE',
    venue: 'MBAPPE DITADOR AWAITS', tip: 'BEAT MBAPPE DITADOR TO OPEN THE GATE!', width: 128, time: 300,
    build(L) {
      L.fill(0, 2, 128, 1, '#');
      L.ground(0, 14).lava(15, 17).bubble(16);
      L.ground(18, 30).firebar(24, 9, { speed: 0.035 });
      L.lava(31, 34).bubble(33);
      L.ground(35, 50).fill(38, 3, 10, 3, '#').firebar(42, 6, { speed: -0.04 });
      L.enemy('defender', 46);
      L.lava(51, 54).place(52, 10, 'S').bubble(54);
      L.ground(55, 70).place(58, 9, 'M').place(62, 9, '?').firebar(66, 9, { speed: 0.05 });
      L.lava(71, 72);
      L.ground(73, 82).enemy('referee', 78);
      L.lava(83, 100, 14).bridgeSpan(83, 100);
      L.fill(85, 3, 16, 5, '#');
      L.boss(96);
      // The cup waits behind bars that only lift once Mbappé Ditador is beaten.
      L.ground(101, 127).gateAt(101, 3, 12).trophy(103).net(116);
    },
  },
];
