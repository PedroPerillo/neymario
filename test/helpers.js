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
      const pad = g.entities.some((e) => e.type === 'spring' && Math.abs(e.x - (tx + 1) * TILE) < TILE * 2);
      const ledge = !solidAt(g.level, tx + 1, foot + 1) && !p.ridingId && !pad;
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
  { jump: true },
  { left: true },
  { left: true, jump: true },
];

const invincible = (g) => { g.player.star = 9999; };
const finished = (g) => g.state === 'flag' || g.state === 'bridge';

/**
 * Candidate moves from this position, best first: each tries one action for a
 * short burst, then keeps running with `runner`, and is scored by how far it
 * gets without dying. A plan that reaches the end keeps its whole input list.
 */
function candidates(game, { burst, horizon }) {
  const plans = [];
  for (const action of ACTIONS) {
    for (const hold of [burst, burst * 3, burst * 6]) {
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
      if (!alive) continue;
      const done = finished(sim);
      plans.push({ score: done ? Infinity : sim.player.x + (sim.player.onGround ? 8 : 0), inputs: done ? inputs : inputs.slice(0, hold) });
    }
  }
  return plans.sort((a, b) => b.score - a.score);
}

/**
 * Lookahead player used to prove levels are finishable: a depth-first search
 * over short bursts of input that backtracks out of dead ends, then replays
 * the winning inputs on the real game. Enemies are ignored via permanent
 * invincibility, so this checks level geometry (gaps, walls, lifts, springs).
 */
export function autoplay(game, { maxFrames = 12000, burst = 10, horizon = 90, maxNodes = 3000 } = {}) {
  const opts = { burst, horizon };
  let node = { game: cloneGame(game), plans: null, next: 0, inputs: [] };
  const stack = [];
  let best = node;
  let found = null;
  for (let expanded = 0; expanded < maxNodes && !found; expanded++) {
    node.plans ??= candidates(node.game, opts);
    if (node.next >= node.plans.length || node.inputs.length > maxFrames) {
      node = stack.pop();
      if (!node) break;
      continue;
    }
    const plan = node.plans[node.next++];
    const child = cloneGame(node.game);
    child.sfx = () => {};
    for (const input of plan.inputs) {
      invincible(child);
      child.update(input);
      if (child.state !== 'play') break;
    }
    if (child.state === 'dying') continue;
    const next = { game: child, plans: null, next: 0, inputs: node.inputs.concat(plan.inputs) };
    if (finished(child) || child.levelIndex !== game.levelIndex) {
      found = next;
      break;
    }
    if (child.player.x > best.game.player.x) best = next;
    stack.push(node);
    node = next;
  }
  const path = (found ?? best).inputs;
  for (const input of path) {
    if (game.state !== 'play') break;
    invincible(game);
    game.update(input);
  }
  return path.length;
}
