import { ROWS, TILE, GROUND_ROW } from './constants.js';

/*
 * Tile chars stored in a built level:
 *   ' ' air      '#' ground      'B' brick       '?' prize block (shows a World Cup trophy)   'U' used block
 *   'S' solid    'h' hidden blk  'C' coin        '=' bridge           'L' lava
 *   '[' ']' pipe top (left/right)                '{' '}' pipe body (left/right)
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

  /** Solid column `h` tiles tall standing on the ground. */
  column(x, h) {
    return this.fill(x, GROUND_ROW - h, 1, h, 'S');
  }

  /** Staircase `h` steps long; dir 1 climbs to the right, -1 descends. */
  stairs(x, h, dir = 1) {
    for (let i = 0; i < h; i++) this.column(x + i, dir > 0 ? i + 1 : h - i);
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

  /** Enemy standing on top of `row` - 1 (defaults to the ground). */
  enemy(type, x, row = GROUND_ROW - 1) {
    this.spawns.push({ type, x: x * TILE, bottom: (row + 1) * TILE });
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

  /** Corner-flag pole at column x on a solid base, locker room ("vestiário") 5 tiles after. */
  goal(x) {
    this.flagX = x;
    this.place(x, GROUND_ROW - 1, 'S');
    this.castleX = x + 5;
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
    const { build, ...meta } = def;
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

const CROATIA = {
  kit: { shirt: '#e8202a', shirt2: '#ffffff', shorts: '#ffffff', skin: '#f1c27d', hair: '#6b4a2a' },
  flag: { dir: 'h', colors: ['#e8202a', '#ffffff', '#1a3c9c'] },
};

export const LEVELS = [
  {
    id: '2014-1',
    code: '2014-1',
    cup: 'WORLD CUP 2014',
    stage: 'OPENING MATCH',
    opponent: 'CROATIA',
    venue: 'SAO PAULO',
    realScore: 'BRA 3-1 CRO',
    tip: 'GRAB THE FOOTBALL TO GROW!',
    theme: 'day',
    ...CROATIA,
    width: 214,
    build(L) {
      L.ground(0, 70).ground(73, 88).ground(92, 155).ground(158, 213);
      L.place(16, 9, 'M');
      L.place(20, 9, 'B?B?B').place(22, 5, '?');
      L.enemy('defender', 24);
      L.pipe(28, 2).pipe(38, 3).enemy('defender', 42).pipe(46, 4);
      L.enemy('defender', 51).enemy('defender', 53).pipe(57, 4);
      L.place(64, 8, '1');
      L.place(77, 9, 'BMB').place(80, 5, 'BBBBBBBB');
      L.enemy('defender', 81, 4).enemy('defender', 83, 4);
      L.place(93, 5, 'BBB?').place(96, 9, 'c');
      L.enemy('defender', 99).enemy('defender', 101).place(102, 9, 'B*');
      L.place(108, 9, '?').place(111, 9, '?').place(114, 9, '?').place(111, 5, 'M');
      L.enemy('referee', 110);
      L.enemy('defender', 116).enemy('defender', 118);
      L.place(120, 9, 'B').place(123, 5, 'BBB');
      L.enemy('defender', 126).enemy('defender', 128);
      L.place(130, 5, 'B??B').place(131, 9, 'BB');
      L.stairs(136, 4, 1).stairs(142, 4, -1);
      L.stairs(151, 4, 1).column(155, 4).stairs(158, 4, -1);
      L.pipe(165, 2).place(170, 9, 'BB?B');
      L.enemy('defender', 175).enemy('defender', 177).pipe(181, 2);
      L.stairs(183, 8, 1).column(191, 8);
      L.goal(200);
    },
  },
  {
    id: '2014-2',
    code: '2014-2',
    cup: 'WORLD CUP 2014',
    stage: 'QUARTER-FINAL',
    opponent: 'COLOMBIA',
    venue: 'FORTALEZA',
    realScore: 'BRA 2-1 COL',
    tip: 'STOMP A REFEREE, THEN KICK THE VAR!',
    theme: 'dusk',
    // Away kit, so defenders can't be mistaken for Neymario's yellow and blue.
    kit: { shirt: '#14204a', shirt2: '#14204a', shorts: '#ffffff', skin: '#c68642', hair: '#2a1a0a' },
    flag: { dir: 'h', colors: ['#fcd116', '#fcd116', '#003893', '#ce1126'] },
    width: 214,
    build(L) {
      L.ground(0, 45).ground(49, 80).ground(84, 87).ground(91, 130).ground(135, 213);
      L.place(12, 9, '?M?');
      L.enemy('defender', 18).enemy('defender', 20);
      L.pipe(24, 3).place(30, 9, 'BBBBB').place(30, 5, 'CCCCC');
      L.enemy('referee', 34);
      L.place(38, 9, 'B?B').place(39, 5, '?').enemy('defender', 42);
      L.place(52, 9, 'BcB');
      L.enemy('defender', 56).enemy('defender', 58).enemy('defender', 60);
      L.pipe(64, 2).pipe(70, 4).enemy('referee', 75);
      L.place(85, 9, '?').place(84, 5, 'CCCC');
      L.stairs(94, 3, 1).place(100, 9, 'B?B').place(100, 5, 'CCC');
      L.enemy('defender', 104).enemy('referee', 108);
      L.place(112, 9, 'M').place(115, 9, 'BBBB').place(115, 5, 'B*BB');
      L.enemy('defender', 116, 8);
      L.pipe(124, 3).enemy('defender', 127).enemy('defender', 129);
      L.place(132, 10, 'SS');
      L.stairs(139, 4, 1).column(143, 4).stairs(144, 4, -1);
      L.enemy('referee', 152).place(156, 9, '?B?B?');
      L.enemy('defender', 160).enemy('defender', 162);
      L.pipe(168, 2).place(173, 9, 'BMB').enemy('referee', 177);
      L.stairs(183, 8, 1).column(191, 8);
      L.goal(200);
    },
  },
  {
    id: '2018-1',
    code: '2018-1',
    cup: 'WORLD CUP 2018',
    stage: 'ROUND OF 16',
    opponent: 'MEXICO',
    venue: 'SAMARA',
    realScore: 'BRA 2-0 MEX',
    tip: 'MIND THE GAPS. NO ROLLING ALLOWED!',
    theme: 'day',
    kit: { shirt: '#006847', shirt2: '#006847', shorts: '#ffffff', skin: '#c68642', hair: '#2a1a0a' },
    flag: { dir: 'v', colors: ['#006847', '#ffffff', '#ce1126'] },
    width: 214,
    build(L) {
      L.ground(0, 30);
      L.place(10, 9, '?M?').enemy('defender', 16).enemy('defender', 18).pipe(24, 2);
      L.place(33, 10, 'SSS').place(38, 8, 'SSSS').place(38, 7, 'CCCC').place(44, 10, 'SSS');
      L.ground(48, 70);
      L.enemy('defender', 52).enemy('defender', 54).place(56, 9, 'B?B?B');
      L.pipe(63, 3).enemy('referee', 67);
      L.place(73, 10, 'SS').place(77, 8, 'SS').place(81, 6, 'SSS').place(81, 5, 'CCC');
      L.place(86, 8, 'SS').place(90, 10, 'SS');
      L.ground(94, 130);
      L.enemy('defender', 98).enemy('defender', 100).place(104, 9, 'B*B');
      L.pipe(110, 4).enemy('referee', 114);
      L.place(118, 9, 'BBBBBB').place(118, 5, '?BBMBB');
      L.enemy('defender', 120, 8).enemy('defender', 122, 8).pipe(127, 2);
      L.place(133, 9, 'SSSS').enemy('defender', 135, 8);
      L.place(140, 7, 'SSSS').place(140, 6, 'CCCC').place(147, 9, 'SSS');
      L.ground(152, 213);
      L.place(156, 9, '?').place(159, 8, '1');
      L.enemy('referee', 162).enemy('defender', 165).enemy('defender', 167);
      L.stairs(172, 4, 1).stairs(176, 4, -1);
      L.stairs(183, 8, 1).column(191, 8);
      L.goal(200);
    },
  },
  {
    id: '2018-2',
    code: '2018-2',
    cup: 'WORLD CUP 2018',
    stage: 'QUARTER-FINAL',
    opponent: 'BELGIUM',
    venue: 'KAZAN',
    realScore: 'BRA 1-2 BEL',
    tip: 'A NIGHT TO REWRITE HISTORY!',
    theme: 'night',
    kit: { shirt: '#e30613', shirt2: '#b00010', shorts: '#e30613', skin: '#f1c27d', hair: '#3b2716' },
    flag: { dir: 'v', colors: ['#111111', '#fdda24', '#ef3340'] },
    width: 214,
    build(L) {
      L.ground(0, 60).ground(63, 100).ground(104, 140).ground(144, 213);
      L.place(10, 9, 'M');
      L.enemy('defender', 16).enemy('defender', 18).enemy('defender', 20);
      L.place(22, 9, 'BBBBB').place(23, 5, 'B?B').enemy('referee', 28);
      L.pipe(32, 3).enemy('defender', 36).pipe(40, 4);
      L.enemy('referee', 45).enemy('defender', 48);
      L.stairs(55, 4, 1).column(59, 4).column(60, 4).stairs(63, 4, -1);
      L.place(72, 9, '?c?').enemy('referee', 76);
      L.enemy('defender', 80).enemy('defender', 82);
      L.place(86, 9, 'BB*BB').place(86, 5, 'CCCCC');
      L.pipe(93, 2).enemy('defender', 96).enemy('defender', 98);
      L.place(108, 9, 'M').enemy('referee', 112).enemy('referee', 116);
      L.place(120, 9, 'BBBB').place(120, 5, 'BBBB');
      L.enemy('defender', 121, 4).enemy('defender', 123, 4);
      L.pipe(128, 3).enemy('defender', 133).enemy('defender', 135);
      L.stairs(137, 4, 1).stairs(144, 4, -1);
      L.place(152, 9, '?B?').enemy('referee', 156);
      L.enemy('defender', 160).enemy('defender', 162).enemy('defender', 164);
      L.pipe(168, 2).place(173, 9, 'BMB').enemy('referee', 178);
      L.stairs(183, 8, 1).column(191, 8);
      L.goal(200);
    },
  },
  {
    id: '2022-1',
    code: '2022-1',
    cup: 'WORLD CUP 2022',
    stage: 'GROUP STAGE',
    opponent: 'SERBIA',
    venue: 'LUSAIL',
    realScore: 'BRA 2-0 SRB',
    tip: 'CROSS THE BRICK BRIDGES!',
    theme: 'desert',
    kit: { shirt: '#c6363c', shirt2: '#c6363c', shorts: '#0c4076', skin: '#f1c27d', hair: '#3b2716' },
    flag: { dir: 'h', colors: ['#c6363c', '#0c4076', '#ffffff'] },
    width: 214,
    build(L) {
      L.ground(0, 40).ground(62, 100).ground(122, 150).ground(158, 213);
      L.place(8, 9, '?M?').enemy('defender', 15).enemy('defender', 17);
      L.pipe(22, 3).enemy('referee', 28).place(31, 9, 'B1B').place(36, 9, 'BBB');
      L.place(41, 10, 'BBBBBB..BBBBB..BBBBB').place(41, 6, 'CCCCCC..CCCCC..CCCCC');
      L.enemy('defender', 44, 9).enemy('defender', 51, 9).enemy('referee', 57, 9);
      L.place(66, 9, 'M').place(70, 9, 'BBBBBBBB').place(70, 5, 'B?B?B?B?');
      L.enemy('defender', 72, 8).enemy('defender', 75, 8);
      L.pipe(82, 3).enemy('referee', 86).pipe(90, 4);
      L.enemy('defender', 94).enemy('defender', 96);
      L.place(102, 10, 'SSS').place(107, 8, 'BBBB').place(107, 5, 'CCCC');
      L.place(113, 10, 'SSS').place(118, 9, 'SS');
      L.enemy('referee', 126).place(130, 9, 'B*B');
      L.enemy('defender', 134).enemy('defender', 136).enemy('defender', 138);
      L.stairs(144, 4, 1).column(148, 4).column(149, 4).column(150, 4);
      L.place(153, 9, 'SS').stairs(158, 4, -1);
      L.enemy('referee', 166).place(170, 9, '?B?B?').place(172, 5, 'M');
      L.enemy('defender', 174).enemy('defender', 176);
      L.stairs(183, 8, 1).column(191, 8);
      L.goal(200);
    },
  },
  {
    id: '2022-2',
    code: '2022-2',
    cup: 'WORLD CUP 2022',
    stage: 'QUARTER-FINAL',
    opponent: 'CROATIA',
    venue: 'AL RAYYAN',
    realScore: 'BRA 1-1 CRO (2-4 PENS)',
    tip: 'NO PENALTIES THIS TIME. FINISH IT!',
    theme: 'night',
    ...CROATIA,
    width: 214,
    build(L) {
      L.ground(0, 35).ground(40, 75).ground(80, 82).ground(87, 120);
      L.ground(126, 160).ground(165, 213);
      L.place(8, 9, 'M').enemy('referee', 14).enemy('defender', 18).enemy('defender', 20);
      L.pipe(24, 4).place(29, 9, 'B?B').enemy('defender', 32);
      L.place(37, 10, 'S');
      L.place(44, 9, 'BBBBBB').place(44, 5, 'c?BB?B').enemy('referee', 46, 8);
      L.enemy('defender', 50).enemy('defender', 52).enemy('defender', 54);
      L.pipe(58, 3).pipe(64, 4).enemy('referee', 69).enemy('referee', 72);
      L.place(81, 9, 'M');
      L.stairs(90, 4, 1).column(94, 4).stairs(95, 4, -1);
      L.enemy('defender', 100).enemy('defender', 102).enemy('defender', 104).enemy('referee', 108);
      L.place(110, 9, 'B*B').pipe(115, 2);
      L.place(122, 9, 'SSS');
      L.place(130, 9, '?BBB?').place(131, 5, 'BMB').enemy('referee', 134);
      L.enemy('defender', 138).enemy('defender', 140);
      L.pipe(145, 3).pipe(151, 4).enemy('defender', 156).enemy('referee', 158);
      L.place(162, 10, 'SS');
      L.place(171, 9, '1').enemy('referee', 170);
      L.enemy('defender', 174).enemy('defender', 176).enemy('defender', 178);
      L.stairs(183, 8, 1).column(191, 8);
      L.goal(200);
    },
  },
  {
    id: 'final',
    code: 'FINAL',
    cup: 'THE FINAL',
    stage: "THE DICTATOR'S CASTLE",
    opponent: 'FRANCE',
    venue: 'MBAPPE DITADOR AWAITS',
    realScore: null,
    tip: 'BEAT MBAPPE DITADOR. GRAB THE CUP!',
    theme: 'castle',
    kit: { shirt: '#21304d', shirt2: '#21304d', shorts: '#ffffff', skin: '#8d5524', hair: '#1a1008' },
    flag: { dir: 'v', colors: ['#0055a4', '#ffffff', '#ef4135'] },
    width: 128,
    time: 300,
    build(L) {
      L.fill(0, 2, 128, 1, '#');
      L.ground(0, 14).lava(15, 17);
      L.ground(18, 30).firebar(24, 9, { speed: 0.035 });
      L.lava(31, 34);
      L.ground(35, 50).fill(38, 3, 10, 3, '#').firebar(42, 6, { speed: -0.04 });
      L.enemy('defender', 46);
      L.lava(51, 54).place(52, 10, 'S');
      L.ground(55, 70).place(58, 9, 'M').place(62, 9, '?').firebar(66, 9, { speed: 0.05 });
      L.lava(71, 72);
      L.ground(73, 82).enemy('referee', 78);
      L.lava(83, 100, 14).bridgeSpan(83, 100);
      L.fill(85, 3, 16, 5, '#');
      L.boss(96);
      L.ground(101, 127).trophy(101);
    },
  },
];
