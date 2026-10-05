import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, buildLevel } from '../src/levels.js';
import { Game } from '../src/game.js';
import { TILE, ROWS, GROUND_ROW } from '../src/constants.js';
import { autoplay } from './helpers.js';

const KNOWN_TILES = new Set([' ', '#', 'B', '?', 'U', 'S', 'h', 'C', '=', 'L', '[', ']', '{', '}']);

test('there are six World Cup matches and a final castle', () => {
  assert.equal(LEVELS.length, 7);
  assert.deepEqual(LEVELS.map((l) => l.theme === 'castle'), [false, false, false, false, false, false, true]);
  assert.equal(LEVELS.at(-1).opponent, 'FRANCE');
});

for (const def of LEVELS) {
  test(`${def.id} builds a well-formed level`, () => {
    const level = buildLevel(def);
    assert.equal(level.tiles.length, ROWS);
    for (const row of level.tiles) {
      assert.equal(row.length, level.width);
      for (const ch of row) assert.ok(KNOWN_TILES.has(ch), `unknown tile "${ch}"`);
    }
    const spawnCol = Math.floor(level.spawn.x / TILE);
    assert.equal(level.tiles[GROUND_ROW][spawnCol], '#', 'player spawns on ground');
    assert.equal(level.tiles[GROUND_ROW - 1][spawnCol], ' ', 'spawn is not inside a block');
    for (const key of level.contents.keys()) {
      const [x, y] = key.split(',').map(Number);
      assert.ok(['?', 'B', 'h'].includes(level.tiles[y][x]), `contents at ${key} sit in a block`);
    }
    if (def.theme === 'castle') {
      assert.ok(level.axe && level.bridge, 'castle has the cup trigger and a bridge');
      const boss = level.spawns.find((s) => s.type === 'boss');
      const bossCol = Math.floor(boss.x / TILE);
      assert.ok(bossCol >= level.bridge.x0 && bossCol <= level.bridge.x1, 'Mbappé stands on the bridge');
    } else {
      assert.ok(level.flagX !== null && level.castleX + 5 <= level.width, 'flag and locker room fit');
    }
  });

  test(`${def.id} can be finished (geometry check via lookahead bot)`, () => {
    const game = new Game({ levels: LEVELS });
    game.newGame(LEVELS.indexOf(def));
    game.setState('play');
    autoplay(game);
    assert.ok(['flag', 'bridge'].includes(game.state), `stuck at column ${Math.round(game.player.x / TILE)}`);
  });
}

test('building a level twice yields independent copies', () => {
  const a = buildLevel(LEVELS[0]);
  const b = buildLevel(LEVELS[0]);
  a.tiles[9][16] = 'U';
  a.contents.clear();
  assert.equal(b.tiles[9][16], '?');
  assert.ok(b.contents.size > 0);
});

test("no opponent's kit could be mistaken for Neymario's yellow shirt", () => {
  for (const def of LEVELS) {
    assert.notEqual(def.kit.shirt.toLowerCase(), '#fcd116', def.id);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(def.kit.shirt.slice(i, i + 2), 16));
    const yellowish = r > 200 && g > 170 && b < 100;
    assert.ok(!yellowish, `${def.id} defenders wear a yellow shirt`);
  }
});
