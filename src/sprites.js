// Pixel art as palette-indexed strings. '.' is transparent; rows shorter than
// the sprite width are padded, so art can be written without trailing dots.

// ── Neymario ──────────────────────────────────────────────────────────────
// H blond mohawk, D shaved sides, S skin, Y Brazil yellow, G green collar and
// sleeves, B blue shorts and badge, W socks, P pink boots, K eyes/outline.

const SMALL_HEAD = [
  '......HHHH',
  '.....HHHHHH',
  '....DHHHHHHD',
  '....DSSSSKSS',
  '....DSSSSSSSS',
  '.....SSSSSS',
];
// Brazil home kit: yellow shirt, green collar and sleeves, blue badge.
const SMALL_BODY = [
  '.....GGGGGG',
  '...GGYYGGYYGG',
  '..SGYYYYYYBYGS',
  '..S.GYYYYYYG.S',
];
const SMALL_LEGS = {
  stand: [
    '....YYYYYYYY',
    '....BBBBBBBB',
    '....BBB..BBB',
    '....SSS..SSS',
    '....WWW..WWW',
    '...PPPP..PPPPP',
  ],
  run1: [
    '....YYYYYYYY',
    '...BBBBBBBBBB',
    '..BBB......BBB',
    '.SSS........SSS',
    '.WWW........WWW',
    'PPP..........PPP',
  ],
  run2: [
    '....YYYYYYYY',
    '.....BBBBBB',
    '......BBBB',
    '......SSSS',
    '......WWWW',
    '.....PPPPPP',
  ],
  jump: [
    '....YYYYYYYY',
    '....BBBBBBBBB',
    '...BBB....BBBB',
    '..SSS......SSS',
    '.WWW.......WWW',
    'PPP.........PPP',
  ],
};

export const NEY_SMALL = {
  stand: [...SMALL_HEAD, ...SMALL_BODY, ...SMALL_LEGS.stand],
  run1: [...SMALL_HEAD, ...SMALL_BODY, ...SMALL_LEGS.run1],
  run2: [...SMALL_HEAD, ...SMALL_BODY, ...SMALL_LEGS.run2],
  jump: [...SMALL_HEAD, ...SMALL_BODY, ...SMALL_LEGS.jump],
  dead: [
    '......HHHH',
    '.....HHHHHH',
    '....DHHHHHHD',
    '.S..DSKSSKSD..S',
    '.SS.SSSSSSSS.SS',
    '..SS.SSKKSS.SS',
    '...SYYGYYGYYS',
    '....YYYYYYYY',
    '....YYYYYYYY',
    '....YYYYYYYY',
    '....BBBBBBBB',
    '....BBB..BBB',
    '....SSS..SSS',
    '....WWW..WWW',
    '....WWW..WWW',
    '...PPPP..PPPP',
  ],
};

const BIG_HEAD = [
  '.....HHHHH',
  '....HHHHHHH',
  '....HHHHHHHH',
  '...DDHHHHHHHD',
  '...DDSSSSSSSD',
  '...DSSSSSKSSS',
  '...DSSSSSKSSSS',
  '...DSSSSSSSSSS',
  '....SSSSSSKKS',
  '.....SSSSSSS',
  '......SSSS',
];
const BIG_BODY = [
  '....GGGYYGGG',
  '...GGYYGGYYGG',
  '..GGYYYYYYYYGG',
  '.SGYYYYYYYBBYGS',
  '.SGYYYYYYYBBYGS',
  '.SYYYYYYYYYYYYS',
  '.SS.YYYYYYYYY.SS',
  '.S..YYYYYYYYY..S',
  '....YYYYYYYYY',
  '....YYYYYYYYY',
];
const BIG_LEGS = {
  stand: [
    '....BBBBBBBBB',
    '....BBBBBBBBB',
    '....BBBB.BBBB',
    '....BBBB.BBBB',
    '....SSS...SSS',
    '....WWW...WWW',
    '....WWW...WWW',
    '....WWW...WWW',
    '....WWW...WWW',
    '...PPPP...PPPP',
    '...PPPPP..PPPPP',
  ],
  run1: [
    '....BBBBBBBBB',
    '...BBBBBBBBBB',
    '...BBBB..BBBBB',
    '..BBBB....BBBB',
    '..SSS......SSS',
    '.WWW........WWW',
    '.WWW........WWW',
    '.WWW.........WWW',
    'WWW..........WWW',
    'PPP..........PPP',
    'PPP..........PPP',
  ],
  run2: [
    '....BBBBBBBBB',
    '....BBBBBBBBB',
    '.....BBBBBBB',
    '......BBBBB',
    '......SSSS',
    '......WWWW',
    '......WWWW',
    '......WWWW',
    '......WWWW',
    '.....PPPPPP',
    '.....PPPPPPP',
  ],
  jump: [
    '....BBBBBBBBB',
    '...BBBBBBBBBB',
    '..BBBB...BBBBB',
    '.BBB.......BBB',
    '.SSS.......SSS',
    'WWW.........WWW',
    'WWW.........WWW',
    'WW...........WW',
    'PPP..........PPP',
    'PP...........PP',
    '',
  ],
};

export const NEY_BIG = {
  stand: [...BIG_HEAD, ...BIG_BODY, ...BIG_LEGS.stand],
  run1: [...BIG_HEAD, ...BIG_BODY, ...BIG_LEGS.run1],
  run2: [...BIG_HEAD, ...BIG_BODY, ...BIG_LEGS.run2],
  jump: [...BIG_HEAD, ...BIG_BODY, ...BIG_LEGS.jump],
  crouch: [
    ...BIG_HEAD,
    '..GGYYGGYYYYGG',
    '.SGYYYYYYYYBBGS',
    '.SBBBBBBBBBBBBS',
    '..WWWW....WWWW',
    '.PPPPP....PPPPP',
  ],
};

export const NEY_PAL = {
  H: '#f3d36b', D: '#3b2716', S: '#c98b57', K: '#1a1a1a',
  Y: '#ffdf00', G: '#009c3b', B: '#1f3fae', W: '#ffffff', P: '#ff4fa3',
};
// The Brazil kit never changes. Power states show on the mohawk and boots:
// Blaze sets them flickering like flames, Miojo gives curly noodle hair and
// white boots, the Pombo feather platinum hair and sky-blue boots, and the
// trophy flashes them rainbow.
const BLAZE_FLAMES = [
  { H: '#ff6a00', P: '#ff2a00' },
  { H: '#ffb000', P: '#ff6a00' },
];
const STAR_FLASH = ['#ffffff', '#38d7ff', '#ff4fa3', '#ffd400'];

/** Palette for Neymario's current power state. Returns [cacheKey, palette]. */
export function playerPalette({ size, star }, frame) {
  if (star > 0) {
    const i = (frame >> 2) % STAR_FLASH.length;
    // h is the second hair shade the Miojo noodle hair uses; it must flash too.
    const flash = (k) => STAR_FLASH[(i + k) % STAR_FLASH.length];
    return [`star${i}`, { ...NEY_PAL, H: flash(0), h: flash(1), P: flash(2) }];
  }
  if (size === 'fire') {
    const i = (frame >> 3) % BLAZE_FLAMES.length;
    return [`fire${i}`, { ...NEY_PAL, ...BLAZE_FLAMES[i] }];
  }
  if (size === 'roll') return ['roll', { ...NEY_PAL, H: '#ffe9a0', h: '#d8a840', P: '#ffffff' }];
  if (size === 'pombo') return ['pombo', { ...NEY_PAL, H: '#eef2f8', P: '#5ad1ff' }];
  return ['base', NEY_PAL];
}

/** Miojo hair: checker the mohawk with a darker noodle shade ('h'). */
export const noodleHair = (rows) => rows.map((row, y) => [...row].map((ch, x) => (ch === 'H' && (x + y) % 2 ? 'h' : ch)).join(''));

// ── Opponents ─────────────────────────────────────────────────────────────
// A/a shirt (two colours so Croatia gets its checkerboard), D shorts.

export const DEFENDER = [
  '',
  '.....HHHHHH',
  '....HHHHHHHH',
  '....SSSSSSSS',
  '...SKKSSSSKKS',
  '...SSKWSSWKSS',
  '...SSSSSSSSSS',
  '....SSKKKKSS',
  '.....SSSSSS',
  '...AaAaAaAaAa',
  '..SaAaAaAaAaAS',
  '..SAaAaAaAaAaS',
  '....DDDDDDDD',
  '....DDD..DDD',
  '..KKKK...KKK',
  '..KKKKK..KKKK',
];

export const kitPalette = (kit) => ({
  A: kit.shirt, a: kit.shirt2, D: kit.shorts, S: kit.skin, H: kit.hair, K: '#111111', W: '#ffffff',
});

const REF_TOP = [
  '',
  '......KKKK',
  '.....KKKKKK',
  '.....SSSSSS',
  '....SSKSSKS',
  '....SSSSSSS..R',
  '.....SKKSS...RR',
  '......SSS....RR',
  '....FFFFFFF.SS',
  '...FFFFFFFFFSS',
  '..FFFFFFFFFFF',
  '..SFFFFWFFFF',
  '..SFFFFKFFFF',
  '..S.FFFFFFFF',
  '....FFFFFFFF',
  '....KKKKKKKK',
  '....KKKKKKKK',
];
export const REFEREE = {
  walk1: [
    ...REF_TOP,
    '....KKK..KKK',
    '....SSS..SSS',
    '....KKK..KKK',
    '....KKK..KKK',
    '....KKK..KKK',
    '...KKKK..KKKK',
    '...KKKK..KKKK',
  ],
  walk2: [
    ...REF_TOP,
    '....KKK...KKK',
    '...SSS....SSS',
    '...KKK.....KKK',
    '...KKK.....KKK',
    '..KKK......KKK',
    '.KKKK......KKKK',
    '.KKKK.......KKKK',
  ],
};
export const REF_PAL = { K: '#151515', S: '#e0ac69', F: '#c6f000', R: '#e8102a', W: '#ffffff' };

// The stomped referee curls up behind a VAR monitor, which can be kicked.
export const VAR_SHELL = [
  '',
  '',
  '.KKKKKKKKKKKKKK',
  '.KBBBBBBBBBBBBK',
  '.KBWBWBBWBBWWBK',
  '.KBWBWBWBWBWBWK',
  '.KBWBWBWWWBWWBK',
  '.KBWBWBWBWBWBWK',
  '.KBBWBBWBWBWBWK',
  '.KBBBBBBBBBBBBK',
  '.KKKKKKKKKKKKKK',
  '......KggK',
  '......KggK',
  '....KKggggKK',
  '...KggggggggK',
  '...KKKKKKKKKK',
];
export const VAR_PAL = { K: '#151515', B: '#1e5bd8', W: '#ffffff', g: '#9a9a9a' };

// ── Mbappé Ditador (32×32) ────────────────────────────────────────────────
// Officer's cap, mirrored shades, epaulettes and far too many medals.
const BOSS_HEAD = [
  '',
  '...........KKKKKKKKKK',
  '.........KKNNNNNNNNNNKK',
  '........KNNNNNNNNNNNNNNK',
  '.......KNNNNNNNQQNNNNNNNK',
  '.......KNNNNNNQQQQNNNNNNK',
  '.......KNNNNNNNQQNNNNNNNK',
  '......KKKKKKKKKKKKKKKKKKKK',
  '.....KKKKKKKKKKKKKKKKKKKKKK',
  '........KSSSSSSSSSSSSSSSK',
  '........KSKKKKKKSSKKKKKKSK',
  '........KSKKgKKKKKKKgKKKSK',
  '........KSSKKKKKSSKKKKKSSK',
  '........KSSSSSSSSSSSSSSSSK',
  '.........KSSSSSsSSsSSSSSK',
];
const BOSS_BODY = [
  '..........KSSSSSSSSSSSSK',
  '...........KKSSSSSSSSKK',
  '......KKKKKKKNNNSSNNNKKKKKKK',
  '....KQQQQNNNNNNNKKNNNNNNNQQQQK',
  '...KQQQQNNNNNNNNKKNNNNNNNNQQQQK',
  '...KNNNNNNRRQNNNKKNNNNNNNNNNNNK',
  '...KNNNNNNQRRNNNQKNNNNNNNNNNNNK',
  '...KNNNNNNRQRNNNKKNNNNNNNNNNNNK',
  '...KSSNNNNNNNNNNQKNNNNNNNNNNSSK',
  '...KSSNNNNNNNNNNKKNNNNNNNNNNSSK',
  '....KKNNNNNNNNNNQKNNNNNNNNNNKK',
  '......KnnnnnnnnnnnnnnnnnnnnK',
  '......KnnnnnnnnKKnnnnnnnnnnK',
  '......KnnnnnnnK..KnnnnnnnnnK',
  '.....KKKKKKKKK....KKKKKKKKKKK',
  '.....KKKKKKKKK....KKKKKKKKKKK',
];
export const BOSS = {
  closed: [...BOSS_HEAD, '.........KSSSKKKKKKKSSSSK', ...BOSS_BODY],
  open: [...BOSS_HEAD, '.........KSSKRRRRRRKSSSSK', ...BOSS_BODY],
};
export const BOSS_PAL = {
  K: '#0b0b0b', N: '#1b2a5e', n: '#0f1836', Q: '#f8c800', S: '#6b4423', s: '#4e2f17',
  R: '#d01020', g: '#9ab0c0', W: '#ffffff',
};

// ── Items ─────────────────────────────────────────────────────────────────

export const FOOTBALL = [
  '.....OOOOOO',
  '...OOWWWWWWOO',
  '..OWWWWWWWWWWO',
  '.OWWWWWKKWWWWWO',
  '.OWWWWKKKKWWWWO',
  'OKWWWKKKKKKWWWKO',
  'OKKWWWKKKKWWWKKO',
  'OKWWWWWWWWWWWWKO',
  'OWWWWWWWWWWWWWgO',
  'OWWKWWWWWWWWKWgO',
  'OWKKKWWWWWWKKKgO',
  '.OKKWWWWWWWWKKO',
  '.OWWWWWKKWWWggO',
  '..OWWWKKKKWggO',
  '...OOgKKKKgOO',
  '.....OOOOOO',
];
export const FOOTBALL_PAL = { O: '#3a3a3a', K: '#1a1a1a', W: '#ffffff', g: '#c8c8c8' };

// A stylised flame emblem standing in for the Blaze logo.
export const BLAZE = [
  '......K',
  '.....KRK',
  '.....KRRK',
  '....KRRRK...K',
  '....KRRRRK.KRK',
  '...KRROORRKKRK',
  '...KRROORRKRRK',
  '..KRRROOORRRRK',
  '..KRROOYOORRRK',
  '..KRROYYYOORRK',
  '..KRROYWYYORRK',
  '..KRROYYYYORRK',
  '...KRROYYORRK',
  '....KRROORRK',
  '.....KKKKKK',
];
export const BLAZE_PALS = [
  { K: '#2a0000', R: '#f12c4c', O: '#ff8a00', Y: '#ffe14a', W: '#ffffff' },
  { K: '#2a0000', R: '#ff5a1f', O: '#ffb000', Y: '#fff3a0', W: '#ffffff' },
];

export const TROPHY = [
  '....KKKKKKKK',
  '.KKKQQQQQQQQKKK',
  'KQQKQQQQQWQQKQQK',
  'KQ.KQQQQQWQQK.QK',
  'KQ.KQQQQQQQQK.QK',
  '.KQKQQQQQQQQKQK',
  '..KKQQQQQQQQKK',
  '....KQQQQQQK',
  '.....KQQQQK',
  '......KQQK',
  '......KQQK',
  '.....KGGGGK',
  '....KQQQQQQK',
  '....KGGGGGGK',
  '...KQQQQQQQQK',
  '...KKKKKKKKKK',
];
export const TROPHY_PAL = { K: '#5a3a00', Q: '#ffcc1a', W: '#fffbe0', G: '#1f9c4a' };

// Coins are golden soccer balls.
export const COIN = [
  '',
  '',
  '.....KKKKKK',
  '....KQWQQQQK',
  '...KQWQddQQQK',
  '..KQQQdddQQQQK',
  '..KQdQQdQQQdQK',
  '..KddQQQQQdddK',
  '..KQdQQQQQQdQK',
  '..KQQQQddQQQQK',
  '..KQQQdddQQQQK',
  '...KQQQdQQQQK',
  '....KQQQQQQK',
  '.....KKKKKK',
];
export const COIN_PAL = { K: '#6b3d00', Q: '#ffc400', d: '#b87800', W: '#fff4b0' };

// Small match ball for the end-of-level goal.
export const MATCH_BALL = [
  '..KKKK',
  '.KWWKWK',
  'KWKKWWWK',
  'KWKKWWKK',
  'KWWWWKKK',
  'KKWWWKWK',
  '.KWKWWK',
  '..KKKK',
];
export const MATCH_BALL_PAL = { K: '#1a1a1a', W: '#ffffff' };

// 1-UP: a Brazil #10 shirt.
export const JERSEY = [
  '',
  '...KKKK..KKKK',
  '..KGGGGKKGGGGK',
  '.KGYYYYGGYYYYGK',
  'KGYYYYYYYYYYYYGK',
  'KGGYYYYYYYYYYGGK',
  '.KKKYYYYYYYYKKK',
  '...KYBYYBBBYK',
  '...KYBYYBYBYK',
  '...KYBYYBYBYK',
  '...KYBYYBYBYK',
  '...KYBYYBBBYK',
  '...KYYYYYYYYK',
  '...KGGGGGGGGK',
  '...KKKKKKKKKK',
];
export const JERSEY_PAL = { K: '#1a1a1a', Y: '#ffdf00', G: '#009c3b', B: '#1f3fae' };

// 2018 power: a cup of instant noodles ("miojo"), for Neymar's noodle hair.
export const NOODLES = [
  '....w..w..w',
  '...w..w..w',
  '..KKKKKKKKKKKK',
  '..KYyYyYyYyYYK',
  '..KKKKKKKKKKKK',
  '...KRRRRRRRRK',
  '...KCCCCCCCCK',
  '...KCRRCCRRCK',
  '...KCRCRRCRCK',
  '....KCCCCCCK',
  '....KRRRRRRK',
  '....KCCCCCCK',
  '.....KCCCCK',
  '.....KKKKKK',
];
export const NOODLES_PAL = { K: '#3a1a00', Y: '#ffe680', y: '#d8a840', R: '#e8202a', C: '#fff6e0', w: '#d0d8e0' };

// 2022 power: a pigeon feather (the "pombo" celebration).
export const FEATHER = [
  '...........KK',
  '.........KKWWK',
  '........KWWWgK',
  '.......KWWWWgK',
  '......KWWWWgK',
  '.....KWWWWgK',
  '....KWWWbgK',
  '...KWWWbgK',
  '...KWWbgK',
  '..KWWbgK',
  '..KWbgK',
  '..KbgK',
  '.KgK',
  '.KK',
  'K',
];
export const FEATHER_PAL = { K: '#2a2f3a', W: '#f4f6fa', g: '#9aa3b2', b: '#6fa8dc' };

// Neymario's Blaze shot: a flaming football.
export const FIREBALL = [
  '..OOOO',
  '.OYYYYO',
  'OYWKWWYO',
  'OYKWWKYO',
  'OYWWKWYO',
  'OYWKWWYO',
  '.OYYYYO',
  '..OOOO',
];
export const FIREBALL_PAL = { O: '#ff4b1f', Y: '#ffb000', W: '#ffffff', K: '#1a1a1a' };

export const FIREBAR_BALL = [
  '..OOOO',
  '.ORRRRO',
  'ORYYYYRO',
  'ORYWWYRO',
  'ORYWWYRO',
  'ORYYYYRO',
  '.ORRRRO',
  '..OOOO',
];
export const FIREBAR_PAL = { O: '#a01000', R: '#ff4b1f', Y: '#ffb000', W: '#fff7c0' };

// Emblem on prize blocks (the original's "?"): a mini World Cup trophy with
// a globe on top and green bands on the base.
export const BLOCK_TROPHY = [
  '...KKKK',
  '..KWQQQK',
  '.KWQQQQQK',
  '.KQQQQQQK',
  '..KQQQQK',
  '...KQQK',
  '...KQQK',
  '..KQQQQK',
  '..KGGGGK',
  '..KQQQQK',
  '.KGGGGGGK',
  '.KKKKKKKK',
];
export const BLOCK_TROPHY_PAL = { K: '#5a2800', Q: '#ffe680', W: '#ffffff', G: '#1f9c4a' };

/** Renders palette-indexed rows into an offscreen canvas. Browser only. */
export function makeSprite(rows, pal, width = 16) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < width && x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const color = pal[ch];
      if (!color) throw new Error(`Sprite colour "${ch}" missing from palette`);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}
