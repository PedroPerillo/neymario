import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/sprites.js';

const cases = [
  ...Object.entries(S.NEY_SMALL).flatMap(([n, rows]) => [[`small ${n}`, rows, S.NEY_PAL, 16], [`small ${n} fire`, rows, S.NEY_FIRE_PAL, 16]]),
  ...Object.entries(S.NEY_BIG).flatMap(([n, rows]) => [[`big ${n}`, rows, S.NEY_PAL, 16], [`big ${n} fire`, rows, S.NEY_FIRE_PAL, 16]]),
  ['defender', S.DEFENDER, S.kitPalette({ shirt: 1, shirt2: 1, shorts: 1, skin: 1, hair: 1 }), 16],
  ['referee walk1', S.REFEREE.walk1, S.REF_PAL, 16],
  ['referee walk2', S.REFEREE.walk2, S.REF_PAL, 16],
  ['VAR shell', S.VAR_SHELL, S.VAR_PAL, 16],
  ['boss closed', S.BOSS.closed, S.BOSS_PAL, 32],
  ['boss open', S.BOSS.open, S.BOSS_PAL, 32],
  ['football', S.FOOTBALL, S.FOOTBALL_PAL, 16],
  ['golden ball', S.FOOTBALL, S.GOLDBALL_PAL, 16],
  ...S.BLAZE_PALS.map((p, i) => [`blaze ${i}`, S.BLAZE, p, 16]),
  ['trophy', S.TROPHY, S.TROPHY_PAL, 16],
  ['coin', S.COIN, S.COIN_PAL, 16],
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
