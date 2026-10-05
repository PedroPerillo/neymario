import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { TILE, GROUND_ROW, SCREEN_H, BIG_H, SMALL_H, PHYS } from '../src/constants.js';
import { run, testLevel, playing, flatGround } from './helpers.js';

const GROUND_Y = GROUND_ROW * TILE;
const settle = (g) => run(g, {}, 2);
const jump = (g, frames = 30) => {
  g.update({});
  run(g, { jump: true }, frames);
  run(g, {}, 40);
};
const find = (g, type) => g.entities.find((e) => e.type === type);

test('title → Enter → match intro → play', () => {
  const g = new Game();
  assert.equal(g.state, 'title');
  g.update({ start: true });
  assert.equal(g.state, 'intro');
  assert.equal(g.lives, 3);
  run(g, {}, 150);
  assert.equal(g.state, 'play');
});

test('Neymario lands on the ground and walks right', () => {
  const g = playing([flatGround()]);
  settle(g);
  assert.equal(g.player.y + g.player.h, GROUND_Y);
  assert.ok(g.player.onGround);
  const x0 = g.player.x;
  run(g, { right: true }, 60);
  assert.ok(g.player.x > x0 + 40);
  assert.equal(g.player.facing, 1);
});

test('running is faster than walking', () => {
  const walk = playing([flatGround()]);
  const sprint = playing([flatGround()]);
  run(walk, { right: true }, 90);
  run(sprint, { right: true, run: true }, 90);
  assert.ok(sprint.player.x > walk.player.x + 30);
});

test('cannot walk back past the left edge of the camera', () => {
  const g = playing([flatGround()]);
  g.camX = 100;
  g.player.x = 110;
  run(g, { left: true }, 60);
  assert.equal(g.player.x, 100);
});

test('a standing jump clears four tiles; holding jump goes higher than tapping', () => {
  const peak = (frames) => {
    const g = playing([flatGround()]);
    settle(g);
    let top = Infinity;
    g.update({});
    for (let i = 0; i < 60; i++) {
      g.update({ jump: i < frames });
      top = Math.min(top, g.player.y + g.player.h);
    }
    return GROUND_Y - top;
  };
  assert.ok(peak(60) > 4 * TILE, `held jump only reached ${peak(60)}px`);
  assert.ok(peak(3) < peak(60) - 20);
});

test('heading a power-up block releases a football that makes Neymario big', () => {
  const g = playing([flatGround((L) => L.place(2, 9, 'M'))]);
  settle(g);
  jump(g, 10);
  assert.equal(g.level.tiles[9][2], 'U', 'block is used up');
  const ball = find(g, 'football');
  assert.ok(ball, 'football spawned');
  g.player.x = ball.x;
  g.player.y = ball.y + ball.h - g.player.h;
  g.update({});
  assert.equal(g.player.size, 'big');
  assert.equal(g.player.h, BIG_H);
  assert.equal(g.score, 1000);
});

test('a power-up block gives the Blaze logo when already big, and Blaze shoots fireballs', () => {
  const g = playing([flatGround((L) => L.place(2, 9, 'M'))]);
  g.setSize('big');
  settle(g);
  jump(g, 10);
  const blaze = find(g, 'blaze');
  assert.ok(blaze, 'Blaze logo spawned instead of a football');
  g.player.x = blaze.x;
  g.player.y = blaze.y + blaze.h - g.player.h;
  g.update({});
  assert.equal(g.player.size, 'fire');
  run(g, {}, 50);
  for (let i = 0; i < 3; i++) {
    g.update({ run: true });
    g.update({});
  }
  assert.equal(g.entities.filter((e) => e.type === 'fireball').length, 2, 'at most two fireballs');
});

test('small Neymario only bumps bricks; big Neymario smashes them', () => {
  const small = playing([flatGround((L) => L.place(2, 9, 'B'))]);
  settle(small);
  jump(small, 10);
  assert.equal(small.level.tiles[9][2], 'B');

  const big = playing([flatGround((L) => L.place(2, 8, 'B'))]);
  big.setSize('big');
  settle(big);
  jump(big, 10);
  assert.equal(big.level.tiles[8][2], ' ');
  assert.equal(big.score, 50);
});

test('question blocks pay out a coin; 100 coins is an extra life', () => {
  const g = playing([flatGround((L) => L.place(2, 9, '?'))]);
  g.coins = 99;
  settle(g);
  jump(g, 10);
  assert.equal(g.coins, 0);
  assert.equal(g.lives, 4);
});

test('a hidden block hides a Brazil #10 shirt worth a life', () => {
  const g = playing([flatGround((L) => L.place(2, 9, '1'))]);
  settle(g);
  jump(g, 10);
  assert.equal(g.level.tiles[9][2], 'U', 'hidden block revealed');
  const shirt = find(g, 'jersey');
  assert.ok(shirt);
  g.player.x = shirt.x;
  g.player.y = shirt.y + shirt.h - g.player.h;
  g.update({});
  assert.equal(g.lives, 4);
});

test('the hidden block is not solid when walked into from the side', () => {
  const g = playing([flatGround((L) => L.place(5, 12, '1'))]);
  run(g, { right: true }, 90);
  assert.ok(g.player.x > 6 * TILE, 'walked straight through');
});

const withEnemy = (type, x = 6) => flatGround((L) => L.enemy(type, x));

test('stomping a defender flattens him and bounces Neymario', () => {
  const g = playing([withEnemy('defender')]);
  settle(g);
  const d = find(g, 'defender');
  g.player.x = d.x;
  g.player.y = d.y - g.player.h + 1;
  g.player.vy = 2;
  g.update({});
  assert.equal(d.state, 'flat');
  assert.ok(g.player.vy < 0, 'bounced');
  assert.equal(g.score, 100);
});

test('walking into a defender while small costs a life and restarts the match', () => {
  const g = playing([withEnemy('defender', 4)]);
  run(g, { right: true }, 120);
  assert.equal(g.state, 'dying');
  run(g, {}, 180);
  assert.equal(g.lives, 2);
  assert.equal(g.state, 'intro');
  assert.equal(g.player.size, 'small');
});

test('a hit while big shrinks Neymario and gives brief invulnerability', () => {
  const g = playing([withEnemy('defender', 4)]);
  g.setSize('big');
  run(g, { right: true }, 120);
  assert.equal(g.state, 'play');
  assert.equal(g.player.size, 'small');
  assert.equal(g.player.h, SMALL_H);
  assert.ok(g.player.invuln > 0);
});

test('a stomped referee hides behind the VAR, which can be kicked into defenders', () => {
  const g = playing([flatGround((L) => L.enemy('referee', 6).enemy('defender', 14))]);
  settle(g);
  const ref = find(g, 'referee');
  const def = find(g, 'defender');
  g.player.x = ref.x;
  g.player.y = ref.y - g.player.h + 1;
  g.player.vy = 2;
  g.update({});
  assert.equal(ref.state, 'shell');
  assert.equal(ref.vx, 0);
  run(g, {}, 40);
  g.player.x = ref.x - g.player.w + 2;
  g.player.y = ref.y + ref.h - g.player.h;
  g.update({});
  assert.ok(ref.vx > 0, 'VAR kicked away from Neymario');
  run(g, {}, 60);
  assert.equal(def.state, 'flip');
});

test('the World Cup trophy makes Neymario knock out enemies by touch', () => {
  const g = playing([withEnemy('defender', 4)]);
  g.player.star = 600;
  run(g, { right: true }, 120);
  assert.equal(g.state, 'play');
  assert.ok(g.score >= 200);
});

test('falling into a pit is a lost life', () => {
  const g = playing([testLevel((L) => L.ground(0, 5).ground(12, 39))]);
  run(g, { right: true }, 200);
  assert.equal(g.state, 'dying');
  assert.ok(g.player.y > SCREEN_H);
});

test('the clock running out is a lost life', () => {
  const g = playing([flatGround()]);
  g.time = 1;
  run(g, {}, 30);
  assert.equal(g.state, 'dying');
});

test('losing the last life ends the game and returns to the title', () => {
  const g = playing([flatGround()]);
  g.lives = 1;
  g.killPlayer();
  run(g, {}, 180);
  assert.equal(g.state, 'gameover');
  run(g, {}, 300);
  assert.equal(g.state, 'title');
});

const goalLevel = testLevel((L) => {
  L.ground(0, 39);
  L.goal(10);
}, { width: 40 });

test('touching the corner flag ends the match, tallies time and starts the next one', () => {
  const next = flatGround();
  const g = playing([goalLevel, next]);
  g.player.x = 8 * TILE;
  settle(g);
  g.update({ right: true });
  run(g, { right: true, jump: true }, 30);
  run(g, { right: true }, 60);
  assert.equal(g.state, 'flag');
  const before = g.score;
  let guard = 0;
  while (g.state === 'flag' && guard++ < 2000) g.update({});
  assert.equal(g.state, 'intro');
  assert.equal(g.levelIndex, 1);
  assert.ok(g.score > before, 'leftover time became points');
});

test('size carries over between matches but resets after a death', () => {
  const g = playing([goalLevel, flatGround()]);
  g.setSize('fire');
  g.loadLevel(1);
  assert.equal(g.player.size, 'fire');
  g.setState('play');
  g.killPlayer();
  run(g, {}, 180);
  assert.equal(g.player.size, 'small');
});

const castle = testLevel((L) => {
  L.ground(0, 9);
  L.lava(10, 25, 14).bridgeSpan(10, 25);
  L.boss(15);
  L.ground(26, 39).trophy(26);
}, { theme: 'castle' });

test('grabbing the cup drops Mbappé Ditador into the lava and wins the Hexa', () => {
  const g = playing([castle]);
  run(g, {}, 5);
  assert.ok(find(g, 'boss'), 'boss spawned');
  g.player.x = 26 * TILE - g.player.w + 2;
  g.player.star = 9999; // keep the boss's fire out of this test
  g.update({});
  assert.equal(g.state, 'bridge');
  let guard = 0;
  while (g.state === 'bridge' && guard++ < 3000) g.update({});
  assert.equal(g.state, 'victory');
  assert.equal(g.level.tiles[GROUND_ROW][15], ' ', 'bridge collapsed');
  assert.ok(!find(g, 'boss'), 'boss fell');
  assert.equal(g.highScore, g.score);
});

test('five Blaze fireballs defeat Mbappé Ditador', () => {
  const g = playing([castle]);
  run(g, {}, 5);
  const boss = find(g, 'boss');
  for (let i = 0; i < 5; i++) g.hitBoss(boss);
  assert.equal(boss.state, 'dead');
  assert.equal(g.score, 5000);
});

test('Mbappé Ditador breathes fire toward Neymario', () => {
  const g = playing([castle]);
  g.camX = 8 * TILE;
  g.player.x = 12 * TILE;
  g.player.star = 9999;
  let fire;
  for (let i = 0; i < 200 && !fire; i++) {
    g.update({});
    fire = find(g, 'bossfire');
  }
  assert.ok(fire, 'fire breath spawned');
  assert.ok(fire.vx < 0);
});

test('pause freezes the match', () => {
  const g = playing([flatGround()]);
  settle(g);
  g.update({ pause: true });
  const x = g.player.x;
  const t = g.time;
  run(g, { right: true }, 120);
  assert.equal(g.player.x, x);
  assert.equal(g.time, t);
  g.update({ pause: true, right: true });
  run(g, { right: true }, 10);
  assert.ok(g.player.x > x);
});

// ── review fixes ──

test('a running jump cannot sail over the cup: crossing it collapses the bridge', () => {
  const g = playing([castle]);
  run(g, {}, 5);
  g.player.x = 22 * TILE;
  g.player.y = 7 * TILE; // well above the 2-tile-tall cup
  g.player.vx = 2.6;
  g.player.star = 9999;
  let crossed = false;
  for (let i = 0; i < 60 && g.state === 'play'; i++) {
    g.update({ right: true, run: true, jump: true });
    crossed ||= g.player.y + g.player.h < g.level.axe.y;
  }
  assert.ok(crossed, 'the jump really passed above the cup');
  assert.equal(g.state, 'bridge');
  let guard = 0;
  while (g.state === 'bridge' && guard++ < 3000) g.update({});
  assert.equal(g.state, 'victory');
  assert.equal(g.player.y + g.player.h, GROUND_Y, 'landed on the ground past the cup');
  assert.ok(g.player.onGround);
});

test('crossing the cup with only the leading edge still lands on solid ground', () => {
  const g = playing([castle]);
  run(g, {}, 5);
  g.player.star = 9999;
  g.player.y = 9 * TILE;
  g.player.vx = 0;
  g.player.x = g.level.axe.x - g.player.w; // right edge exactly on the line
  g.update({ right: true });
  assert.equal(g.state, 'bridge');
  let guard = 0;
  while (g.state === 'bridge' && guard++ < 3000) g.update({});
  assert.equal(g.player.y + g.player.h, GROUND_Y);
});

test('a Blaze fireball passes over a defender who is already flattened', () => {
  const g = playing([withEnemy('defender')]);
  settle(g);
  const d = find(g, 'defender');
  d.state = 'flat';
  d.timer = 30;
  g.entities.push({ type: 'fireball', x: d.x - 4, y: d.y + 2, w: 8, h: 8, vx: 4, vy: 0, anim: 0 });
  const score = g.score;
  g.update({});
  assert.equal(d.state, 'flat');
  assert.equal(g.score, score);
});

test('Start pauses and resumes a match (the touch pad has no separate pause)', () => {
  const sounds = [];
  const g = playing([flatGround()], { sfx: (s) => sounds.push(s) });
  settle(g);
  g.update({ start: true });
  assert.equal(g.paused, true);
  g.update({});
  g.update({ start: true });
  assert.equal(g.paused, false);
  assert.deepEqual(sounds.filter((s) => s === 'pause' || s === 'resume'), ['pause', 'resume']);
});

test('setPaused is ignored outside of a match', () => {
  const g = new Game();
  g.setPaused(true);
  assert.equal(g.paused, false);
});

test('Mbappé Ditador breathes fire the way he faces, even after Neymario gets past him', () => {
  const g = playing([castle]);
  g.camX = 8 * TILE;
  run(g, {}, 5);
  const boss = find(g, 'boss');
  g.player.x = boss.x + 60;
  g.player.star = 9999;
  let fire;
  for (let i = 0; i < 200 && !fire; i++) {
    g.player.x = boss.x + 60;
    g.update({});
    fire = find(g, 'bossfire');
  }
  assert.ok(fire);
  assert.ok(fire.vx > 0, 'fire travels toward Neymario on his right');
  assert.ok(fire.x >= boss.x + boss.w - 4, 'fire leaves from his front, not his back');
});

test('big Neymario keeps his feet where they were when he dies', () => {
  const g = playing([flatGround()]);
  g.setSize('big');
  settle(g);
  g.killPlayer({ fell: true });
  assert.equal(g.player.y + g.player.h, GROUND_Y);
});

test('the high score follows the score live, not just at game over', () => {
  const g = playing([flatGround()], { highScore: 100 });
  g.addScore(500);
  g.update({});
  assert.equal(g.highScore, 500);
});

// ── transformations, extra moves, pipes and the goal ──

const powerLevel = (power, extra = () => {}) => testLevel((L) => {
  L.ground(0, 39);
  L.place(2, 9, 'M');
  extra(L);
}, { power });

for (const [power, item] of [['fire', 'blaze'], ['roll', 'noodles'], ['pombo', 'feather']]) {
  test(`a big Neymario gets the ${item} from power blocks in a ${power} World Cup`, () => {
    const g = playing([powerLevel(power)]);
    g.setSize('big');
    settle(g);
    jump(g, 10);
    const it = find(g, item);
    assert.ok(it, `${item} released`);
    g.player.x = it.x;
    g.player.y = it.y + it.h - g.player.h;
    g.update({});
    assert.equal(g.player.size, power);
  });
}

test('Miojo roll: run, press down, and Neymario rolls through defenders and bricks', () => {
  const g = playing([testLevel((L) => {
    L.ground(0, 39);
    L.place(11, 11, 'B').place(11, 12, 'B');
    L.enemy('defender', 9);
  })]);
  g.setSize('roll');
  settle(g);
  run(g, { right: true, run: true }, 20);
  g.update({ right: true, run: true, down: true });
  assert.ok(g.player.rolling > 0, 'rolling');
  assert.equal(g.player.h, SMALL_H);
  run(g, { right: true }, 40);
  assert.equal(g.state, 'play', 'unhurt');
  assert.equal(find(g, 'defender')?.state ?? 'flip', 'flip');
  assert.equal(g.level.tiles[12][11], ' ', 'brick smashed');
  run(g, {}, 30);
  assert.equal(g.player.rolling, 0);
  assert.equal(g.player.h, BIG_H, 'stands back up');
});

test('Pombo feather: hold jump to glide down slowly, and flap once in mid-air', () => {
  const g = playing([flatGround()]);
  g.setSize('pombo');
  settle(g);
  g.update({});
  run(g, { jump: true }, 60);
  assert.ok(!g.player.onGround);
  assert.ok(g.player.vy <= PHYS.glideFall, `gliding at ${g.player.vy}`);
  assert.ok(g.player.gliding);
  g.update({});
  g.update({ jump: true });
  assert.equal(g.player.vy, -PHYS.flapVel + PHYS.gravityHold, 'flapped');
  g.update({});
  const vy = g.player.vy;
  g.update({ jump: true });
  assert.ok(g.player.vy > vy - 1, 'only one flap per jump');
});

test('ground pound: down in mid-air hangs, slams, and flattens a defender below', () => {
  const g = playing([withEnemy('defender', 6)]);
  settle(g);
  const d = find(g, 'defender');
  d.vx = 0;
  g.player.x = d.x;
  g.player.y = d.y - 70;
  g.player.onGround = false;
  g.update({ down: true });
  assert.ok(g.player.pound > 0, 'winding up');
  const y = g.player.y;
  run(g, {}, PHYS.poundWindup - 1);
  assert.equal(g.player.y, y, 'hangs in the air during the windup');
  run(g, {}, 20);
  assert.equal(d.state, 'flip');
  assert.equal(g.state, 'play');
});

test('a big ground pound smashes the bricks under Neymario and keeps going', () => {
  const g = playing([flatGround((L) => L.place(1, 12, 'BBBB'))]);
  g.setSize('big');
  g.player.y = 12 * TILE - g.player.h;
  settle(g);
  assert.equal(g.player.y + g.player.h, 12 * TILE, 'standing on the bricks');
  g.update({});
  run(g, { jump: true }, 8);
  g.update({ down: true });
  run(g, {}, 60);
  assert.equal(g.level.tiles[12][2], ' ');
  assert.equal(g.level.tiles[12][3], ' ');
  assert.equal(g.player.y + g.player.h, GROUND_Y);
  assert.equal(g.player.pound, 0);
});

test('wall jump: slide down a wall, then jump to kick off it', () => {
  const g = playing([flatGround((L) => L.column(8, 8))]);
  settle(g);
  g.player.x = 8 * TILE - g.player.w - 1;
  g.update({ right: true });
  run(g, { right: true, jump: true }, 25);
  run(g, { right: true }, 20);
  assert.ok(!g.player.onGround);
  assert.ok(g.player.wallGrace > 0, 'clinging to the wall');
  assert.ok(g.player.vy <= PHYS.wallSlide, 'sliding slowly');
  g.update({ right: true, jump: true });
  assert.ok(g.player.vx < 0, 'kicked away from the wall');
  assert.ok(g.player.vy < 0, 'and upward');
});

const pipeLevel = testLevel((L) => {
  L.ground(0, 39);
  L.pipe(10, 2);
  L.warpPipe(4, 2);
  L.exitPipe(24, 2);
}, {
  bonus: {
    width: 16,
    theme: 'tunnel',
    build(B) {
      B.ground(0, 15);
      B.fill(0, 3, 1, 10, 'B');
      B.place(5, 12, 'CCC');
      B.sidePipe(13, 11);
    },
  },
});

test('down on the warp pipe leads to the bonus room; its side pipe pops Neymario out of the exit pipe', () => {
  const g = playing([pipeLevel]);
  g.player.x = 4 * TILE + 3;
  g.player.y = 11 * TILE - g.player.h;
  g.update({});
  g.update({ down: true });
  assert.equal(g.state, 'pipe');
  let guard = 0;
  while (g.state === 'pipe' && guard++ < 200) g.update({ down: true });
  assert.equal(g.areaName, 'bonus');
  assert.equal(g.level.theme, 'tunnel');
  guard = 0;
  while (g.areaName === 'bonus' && guard++ < 400) g.update({ right: true });
  assert.ok(g.coins >= 3, 'collected the bonus coins');
  guard = 0;
  while (g.state !== 'play' && guard++ < 200) g.update({});
  assert.equal(g.areaName, 'main');
  assert.equal(g.player.y + g.player.h, 11 * TILE, 'standing on top of the exit pipe');
  assert.ok(Math.abs(g.player.x + g.player.w / 2 - (24 * TILE + TILE)) < 2, 'centred on the exit pipe');
});

test('an ordinary pipe cannot be entered', () => {
  const g = playing([pipeLevel]);
  g.player.x = 10 * TILE + 3;
  g.player.y = 11 * TILE - g.player.h;
  g.update({});
  run(g, { down: true }, 30);
  assert.equal(g.state, 'play');
  assert.equal(g.areaName, 'main');
});

test('after the corner flag, Neymario shoots into the goal: GOOOOL, confetti and 5000 points', () => {
  const g = playing([goalLevel, flatGround()]);
  g.player.x = 8 * TILE;
  settle(g);
  g.update({ right: true });
  run(g, { right: true, jump: true }, 30);
  run(g, { right: true }, 60);
  assert.equal(g.state, 'flag');
  const phases = new Set();
  let scoredAt = null;
  let guard = 0;
  while (g.state === 'flag' && guard++ < 3000) {
    g.update({});
    if (g.state !== 'flag') break;
    phases.add(g.seq.phase);
    if (g.seq.phase === 'goal' && scoredAt === null) {
      scoredAt = { ...g.seq.ball };
      assert.ok(g.effects.some((fx) => fx.kind === 'confetti'), 'confetti');
    }
  }
  for (const ph of ['slide', 'walk', 'kick', 'fly', 'goal', 'tally']) assert.ok(phases.has(ph), `went through ${ph}`);
  const goalX = 15 * TILE;
  assert.ok(scoredAt.x > goalX + 10 && scoredAt.x < goalX + 76, 'ball ended up inside the net');
  assert.equal(g.state, 'intro');
});
