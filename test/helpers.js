import { Game } from '../src/game.js';
import { LevelBuilder } from '../src/levels.js';
import { TILE } from '../src/constants.js';
import { solidAt } from '../src/physics.js';

/** Steps the game `frames` times with the same held input. */
export function run(game, input, frames = 1) {
  for (let i = 0; i < frames; i++) game.update(input);
}

/** A tiny level definition built inline for focused scenarios. */
export function testLevel(build, { width = 40, ...meta } = {}) {
  return {
    id: 'test', code: 'T-1', cup: 'TEST', stage: 'TEST', opponent: 'TEST', venue: 'TEST',
    theme: 'day', kit: { shirt: '#f00', shirt2: '#f00', shorts: '#fff', skin: '#fc9', hair: '#000' },
    flag: { dir: 'h', colors: ['#f00'] }, width, ...meta, build,
  };
}

/** Starts a game directly in the `play` state of the given level definitions. */
export function playing(levels, opts = {}) {
  const game = new Game({ levels, ...opts });
  game.newGame(0);
  game.setState('play');
  return game;
}

export const flatGround = (extra = () => {}) => testLevel((L) => {
  L.ground(0, 39);
  extra(L);
});

export { LevelBuilder };

/** Deep-copies a game so the bot can try out futures without touching the real one. */
export function cloneGame(game) {
  const copy = Object.create(Object.getPrototypeOf(game));
  for (const [k, v] of Object.entries(game)) {
    // Level definitions (with build functions) are read-only, so they can be shared.
    copy[k] = typeof v === 'function' || k === 'levels' ? v : structuredClone(v);
  }
  return copy;
}

/** Default "keep running" policy: sprint right and jump at walls and ledges. */
function runner() {
  let hold = 0;
  return (g) => {
    const p = g.player;
    if (p.onGround && hold === 0) {
      const tx = Math.floor((p.x + p.w) / TILE);
      const foot = Math.floor((p.y + p.h - 1) / TILE);
      const wall = solidAt(g.level, tx, foot) || solidAt(g.level, tx + 1, foot);
      const ledge = !solidAt(g.level, tx + 1, foot + 1);
      // One released frame first, so the jump registers as a fresh press.
      if (wall || ledge) hold = 41;
    }
    const jump = hold > 0 && hold <= 40;
    if (hold > 0) hold--;
    return { right: true, run: true, jump };
  };
}

const ACTIONS = [
  { right: true, run: true },
  { right: true, run: true, jump: true },
  { right: true, jump: true },
  { right: true },
  {},
  { left: true },
  { left: true, jump: true },
];

/**
 * Greedy lookahead player: every few frames it tries each action for a short
 * burst, then continues running right, and keeps whichever future survives
 * and gets furthest. Enemies are ignored via permanent invincibility so the
 * test is about level geometry being finishable.
 */
export function autoplay(game, { maxFrames = 12000, burst = 10, horizon = 90 } = {}) {
  let frames = 0;
  const startLevel = game.levelIndex;
  const invincible = (g) => { g.player.star = 9999; };
  while (game.state === 'play' && game.levelIndex === startLevel && frames < maxFrames) {
    let best = null;
    for (const action of ACTIONS) {
      for (const hold of [burst, burst * 3]) {
        const sim = cloneGame(game);
        sim.sfx = () => {};
        const cont = runner();
        const inputs = [];
        let alive = true;
        for (let i = 0; i < horizon; i++) {
          invincible(sim);
          const input = i < hold ? action : cont(sim);
          inputs.push(input);
          sim.update(input);
          if (sim.state === 'dying') { alive = false; break; }
          if (sim.state !== 'play') break;
        }
        const done = sim.state === 'flag' || sim.state === 'bridge';
        const score = !alive ? -Infinity : done ? Infinity : sim.player.x + (sim.player.onGround ? 8 : 0);
        if (!best || score > best.score) best = { score, inputs: done ? inputs : inputs.slice(0, hold) };
      }
    }
    for (const input of best.inputs) {
      if (game.state !== 'play') break;
      invincible(game);
      game.update(input);
      frames++;
    }
  }
  return frames;
}
