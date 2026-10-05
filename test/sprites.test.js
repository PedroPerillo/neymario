import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/sprites.js';

const cases = [
  ...Object.entries(S.NEY_SMALL).map(([n, rows]) => [`small ${n}`, rows, S.NEY_PAL, 16]),
  ...Object.entries(S.NEY_BIG).map(([n, rows]) => [`big ${n}`, rows, S.NEY_PAL, 16]),
  ['defender', S.DEFENDER, S.kitPalette({ shirt: 1, shirt2: 1, shorts: 1, skin: 1, hair: 1 }), 16],
  ['referee walk1', S.REFEREE.walk1, S.REF_PAL, 16],
  ['referee walk2', S.REFEREE.walk2, S.REF_PAL, 16],
  ['VAR shell', S.VAR_SHELL, S.VAR_PAL, 16],
  ['boss closed', S.BOSS.closed, S.BOSS_PAL, 32],
  ['boss open', S.BOSS.open, S.BOSS_PAL, 32],
  ['football', S.FOOTBALL, S.FOOTBALL_PAL, 16],
  ['golden-ball coin', S.COIN, S.COIN_PAL, 16],
  ['match ball', S.MATCH_BALL, S.MATCH_BALL_PAL, 8],
  ['#10 shirt', S.JERSEY, S.JERSEY_PAL, 16],
  ['noodle cup', S.NOODLES, S.NOODLES_PAL, 16],
  ['pigeon feather', S.FEATHER, S.FEATHER_PAL, 16],
  ...S.BLAZE_PALS.map((p, i) => [`blaze ${i}`, S.BLAZE, p, 16]),
  ['trophy', S.TROPHY, S.TROPHY_PAL, 16],
  ['prize-block trophy', S.BLOCK_TROPHY, S.BLOCK_TROPHY_PAL, 10],
  ['fireball', S.FIREBALL, S.FIREBALL_PAL, 8],
  ['firebar', S.FIREBAR_BALL, S.FIREBAR_PAL, 8],
];

for (const [name, rows, pal, width] of cases) {
  test(`${name} sprite fits its size and only uses palette colours`, () => {
    assert.ok(rows.length <= 32);
    rows.forEach((row, y) => {
      assert.ok(row.length <= width, `row ${y} is ${row.length} wide`);
      for (const ch of row) if (ch !== '.') assert.ok(pal[ch], `row ${y} uses "${ch}"`);
    });
  });
}

test('player sprites are 16px (small) and 32px (big) tall', () => {
  for (const rows of Object.values(S.NEY_SMALL)) assert.equal(rows.length, 16);
  for (const [name, rows] of Object.entries(S.NEY_BIG)) assert.equal(rows.length, name === 'crouch' ? 16 : 32, name);
  assert.equal(S.BOSS.closed.length, 32);
});

test('Neymario always wears the Brazil kit, whatever his power state', () => {
  const states = [
    { size: 'small', star: 0 }, { size: 'big', star: 0 }, { size: 'fire', star: 0 },
    { size: 'small', star: 300 }, { size: 'fire', star: 300 },
  ];
  for (const state of states) {
    for (let frame = 0; frame < 64; frame++) {
      const [, pal] = S.playerPalette(state, frame);
      const label = `${JSON.stringify(state)} frame ${frame}`;
      assert.equal(pal.Y, '#ffdf00', `${label}: yellow shirt`);
      assert.equal(pal.G, '#009c3b', `${label}: green collar and sleeves`);
      assert.equal(pal.B, '#1f3fae', `${label}: blue shorts`);
      assert.equal(pal.W, '#ffffff', `${label}: white socks`);
    }
  }
});

test('Blaze and trophy powers are still visible on Neymario', () => {
  const base = S.playerPalette({ size: 'big', star: 0 }, 0)[1];
  const fire = S.playerPalette({ size: 'fire', star: 0 }, 0)[1];
  const star = S.playerPalette({ size: 'big', star: 300 }, 0)[1];
  assert.notEqual(fire.H, base.H);
  assert.notEqual(star.H, base.H);
});

test('the shirt shows plenty of green on both sprite sizes', () => {
  const greens = (rows) => rows.join('').split('').filter((c) => c === 'G').length;
  assert.ok(greens(S.NEY_SMALL.stand) >= 12, `small has ${greens(S.NEY_SMALL.stand)} green pixels`);
  assert.ok(greens(S.NEY_BIG.stand) >= 16, `big has ${greens(S.NEY_BIG.stand)} green pixels`);
});

test('every power state, with or without the trophy, can draw every Neymario frame', () => {
  // Regression: trophy + Miojo hair used a hair shade the trophy palette lacked, crashing the renderer.
  for (const size of ['small', 'big', 'fire', 'roll', 'pombo']) {
    for (const star of [0, 300]) {
      for (let frame = 0; frame < 64; frame++) {
        const [, pal] = S.playerPalette({ size, star }, frame);
        for (const set of [S.NEY_SMALL, S.NEY_BIG]) {
          for (const [name, rows] of Object.entries(set)) {
            const drawn = size === 'roll' ? S.noodleHair(rows) : rows;
            for (const ch of drawn.join('')) {
              if (ch !== '.') assert.ok(pal[ch], `${size} star=${star} frame ${frame} ${name}: no colour for "${ch}"`);
            }
          }
        }
      }
    }
  }
});
