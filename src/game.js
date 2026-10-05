import {
  TILE, SCREEN_W, SCREEN_H, GROUND_ROW, PHYS, PLAYER_W, SMALL_H, BIG_H, TIME_TICK,
} from './constants.js';
import { LEVELS, buildLevel } from './levels.js';
import { moveBody, overlaps, tileAt, isSolidChar } from './physics.js';

export const NO_INPUT = Object.freeze({
  left: false, right: false, down: false, jump: false, run: false, start: false, pause: false,
});

const ENEMIES = new Set(['defender', 'referee']);
const ITEMS = new Set(['football', 'blaze', 'noodles', 'feather', 'trophy', 'jersey']);
// Each World Cup has its own transformation, released by power blocks once Neymario is big.
const POWER_ITEM = { fire: 'blaze', roll: 'noodles', pombo: 'feather' };
const ITEM_POWER = { blaze: 'fire', noodles: 'roll', feather: 'pombo' };
const STAR_FRAMES = 600;
const INVULN_FRAMES = 120;
const SHELL_SPEED = 3.5;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

/**
 * The whole game simulation. Pure state + rules, no DOM: the browser shell
 * feeds it input once per 60 Hz tick and draws whatever state it is in.
 *
 * States: title → intro → play ⇄ (dying | pipe | flag | bridge) → gameover | victory.
 * A level has a main area and optionally a bonus room reached through a warp pipe.
 */
export class Game {
  constructor({ sfx = () => {}, seed = 1, levels = LEVELS, highScore = 0 } = {}) {
    this.sfx = sfx;
    this.random = mulberry32(seed);
    this.levels = levels;
    this.highScore = highScore;
    this.prev = { ...NO_INPUT };
    this.input = { ...NO_INPUT };
    this.frame = 0;
    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this.carrySize = 'small';
    this.paused = false;
    this.loadLevel(0);
    this.setState('title');
  }

  setState(state, timer = 0) {
    this.state = state;
    this.stateTimer = timer;
  }

  toTitle() {
    this.loadLevel(0);
    this.setState('title');
  }

  newGame(levelIndex = 0) {
    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this.carrySize = 'small';
    this.loadLevel(levelIndex);
    this.setState('intro', 150);
  }

  loadLevel(index) {
    const def = this.levels[index];
    this.levelIndex = index;
    this.areas = { main: buildLevel(def), bonus: def.bonus ? buildLevel({ ...def, ...def.bonus }) : null };
    this.areaName = 'main';
    this.mainPending = null;
    this.level = this.areas.main;
    this.time = this.level.time;
    this.timeTick = 0;
    this.camX = 0;
    this.entities = [];
    this.effects = [];
    this.pending = this.level.spawns.map((s) => ({ ...s }));
    this.bumps = new Map();
    this.freeze = 0;
    this.shake = 0;
    this.seq = null;
    this.paused = false;
    this.player = this.makePlayer();
  }

  makePlayer() {
    const size = this.carrySize;
    const h = size === 'small' ? SMALL_H : BIG_H;
    return {
      x: this.level.spawn.x, y: this.level.spawn.bottom - h, w: PLAYER_W, h,
      vx: 0, vy: 0, size, facing: 1, onGround: false, crouch: false, skid: false,
      invuln: 0, star: 0, grow: 0, throwAnim: 0, anim: 0,
      dead: false, fell: false, deathDelay: 0, inPipe: false,
      prevBottom: 0, lastVy: 0,
      // Extra moves: ground pound (>0 winding up, -1 slamming), wall slide/jump,
      // the Miojo roll, the feather's glide and mid-air flap.
      pound: 0, wallDir: 0, wallGrace: 0, wallLock: 0, wallLockDir: 0,
      rolling: 0, gliding: false, flaps: 1,
    };
  }

  // ───────────────────────────── main tick ─────────────────────────────

  update(input = NO_INPUT) {
    const inp = { ...NO_INPUT, ...input };
    const prev = this.prev;
    const pressed = (k) => inp[k] && !prev[k];
    this.input = inp;
    this.frame++;

    switch (this.state) {
      case 'title':
        if (pressed('start') || pressed('jump')) this.newGame(0);
        break;
      case 'intro':
        if (--this.stateTimer <= 0) {
          this.setState('play');
          this.sfx(`music:${this.level.theme}`);
        }
        break;
      case 'play':
        // Start doubles as pause, like the NES controller (and the touch pad's only menu button).
        if (pressed('pause') || pressed('start')) this.setPaused(!this.paused);
        if (!this.paused) this.updatePlay(pressed);
        break;
      case 'dying':
        this.updateDying();
        break;
      case 'pipe':
        this.updatePipe();
        break;
      case 'flag':
        this.updateFlag();
        break;
      case 'bridge':
        this.updateBridge();
        break;
      case 'gameover':
        if (--this.stateTimer <= 0 || (this.stateTimer < 200 && pressed('start'))) this.toTitle();
        break;
      case 'victory':
        this.updateEffects();
        if (this.stateTimer > 0) this.stateTimer--;
        else if (pressed('start') || pressed('jump')) this.toTitle();
        break;
      default:
        break;
    }
    if (this.score > this.highScore) this.highScore = this.score;
    this.prev = inp;
  }

  /** Pauses or resumes a match in progress; ignored outside of play. */
  setPaused(paused) {
    if (this.state !== 'play' || this.paused === paused) return;
    this.paused = paused;
    this.sfx(paused ? 'pause' : 'resume');
  }

  updatePlay(pressed) {
    const p = this.player;
    if (this.shake > 0) this.shake--;
    if (this.freeze > 0) {
      this.freeze--;
      if (p.grow > 0) p.grow--;
      return;
    }
    this.tickClock();
    if (this.state === 'play') this.updatePlayer(pressed);
    this.spawnPending();
    this.updateEntities();
    this.updateEffects();
    this.updateBumps();
    this.updateCamera();
  }

  tickClock() {
    if (++this.timeTick < TIME_TICK) return;
    this.timeTick = 0;
    this.time = Math.max(0, this.time - 1);
    if (this.time === 100) this.sfx('hurry');
    if (this.time === 0) this.killPlayer();
  }

  // ───────────────────────────── player ─────────────────────────────

  updatePlayer(pressed) {
    const p = this.player;
    const inp = this.input;
    if (p.invuln > 0) p.invuln--;
    if (p.throwAnim > 0) p.throwAnim--;
    if (p.wallLock > 0) p.wallLock--;
    if (p.star > 0 && --p.star === 0) this.sfx(`music:${this.level.theme}`);

    if (inp.down && p.onGround && this.tryEnterPipe()) return;

    // The 2018 roll: Miojo-haired Neymario rolls through defenders and bricks.
    if (p.size === 'roll' && p.onGround && !p.rolling && pressed('down') && Math.abs(p.vx) >= 1.2) this.startRoll();
    else if (p.rolling > 0 && --p.rolling === 0) this.endRoll();

    if (!p.rolling && p.size !== 'small' && p.onGround && inp.down !== p.crouch) {
      if (inp.down) {
        this.setHeight(SMALL_H);
        p.crouch = true;
      } else if (this.canStand()) {
        this.setHeight(BIG_H);
        p.crouch = false;
      }
    }

    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const max = inp.run ? PHYS.runMax : PHYS.walkMax;
    const accel = inp.run ? PHYS.runAccel : PHYS.walkAccel;
    p.skid = false;
    if (p.rolling) {
      p.vx = p.facing * PHYS.rollSpeed;
    } else if (p.pound) {
      p.vx = 0;
    } else if (dir !== 0 && !(p.crouch && p.onGround) && !(p.wallLock > 0 && dir === p.wallLockDir)) {
      if (p.onGround) p.facing = dir;
      if (p.vx * dir < 0) {
        p.vx += dir * (p.onGround ? PHYS.skidDecel : PHYS.airTurn);
        p.skid = p.onGround;
      } else if (Math.abs(p.vx) < max) {
        p.vx = dir * Math.min(Math.abs(p.vx) + accel, max);
      } else if (p.onGround) {
        p.vx = dir * Math.max(Math.abs(p.vx) - PHYS.friction, max);
      }
    } else if (p.onGround) {
      p.vx = approach(p.vx, 0, PHYS.friction);
    }

    if (pressed('jump') && !p.pound) {
      if (p.onGround) {
        p.vy = -(PHYS.jumpVel + Math.abs(p.vx) * PHYS.jumpRunBonus);
        p.onGround = false;
        this.sfx(p.size === 'small' ? 'jump' : 'jumpBig');
      } else if (p.wallGrace > 0) {
        p.vy = -PHYS.jumpVel;
        p.vx = -p.wallDir * PHYS.wallJumpX;
        p.facing = -p.wallDir;
        p.wallLock = PHYS.wallLock;
        p.wallLockDir = p.wallDir;
        p.wallGrace = 0;
        p.wallDir = 0;
        this.sfx('walljump');
      } else if (p.size === 'pombo' && p.flaps > 0) {
        p.vy = -PHYS.flapVel;
        p.flaps--;
        this.sfx('flap');
      }
    }

    // Ground pound: ↓ in mid-air hangs for a moment, then slams straight down.
    if (pressed('down') && !p.onGround && !p.pound && !p.rolling) {
      p.pound = PHYS.poundWindup;
      p.vx = 0;
      this.sfx('spin');
    }
    p.gliding = false;
    if (p.pound > 0) {
      p.vy = 0;
      if (--p.pound === 0) p.pound = -1;
    } else if (p.pound < 0) {
      p.vy = PHYS.poundSpeed;
    } else {
      const gravity = p.vy < 0 && inp.jump ? PHYS.gravityHold : PHYS.gravity;
      p.vy = Math.min(p.vy + gravity, PHYS.maxFall);
      if (p.wallGrace === PHYS.wallGraceFrames && p.vy > PHYS.wallSlide) p.vy = PHYS.wallSlide;
      if (p.size === 'pombo' && inp.jump && p.vy > PHYS.glideFall) {
        p.vy = PHYS.glideFall;
        p.gliding = true;
      }
    }

    if (pressed('run') && p.size === 'fire' && !p.crouch) this.throwFireball();

    p.prevBottom = p.y + p.h;
    p.lastVy = p.vy;
    const res = moveBody(p, this.level, { hiddenBlocks: true });
    if (res.wall) {
      if (p.rolling && !this.rollThrough(res.wall)) this.endRoll();
      p.vx = 0;
    }
    p.onGround = res.landed;
    if (res.ceiling.length) this.bumpFromBelow(res.ceiling);

    if (res.landed) {
      p.flaps = 1;
      p.wallGrace = 0;
      p.wallDir = 0;
      if (p.pound < 0) this.landPound();
    } else if (res.wall && res.wall === dir && !p.pound && !p.rolling) {
      p.wallDir = res.wall;
      p.wallGrace = PHYS.wallGraceFrames;
    } else if (p.wallGrace > 0 && --p.wallGrace === 0) {
      p.wallDir = 0;
    }

    if (this.areaName === 'bonus' && inp.right && res.wall === 1 && p.onGround && this.atSideExit()) {
      this.beginPipe('right');
      return;
    }

    if (p.x < this.camX) {
      p.x = this.camX;
      if (p.vx < 0) p.vx = 0;
    }
    p.anim += p.onGround ? Math.abs(p.vx) : 0;

    this.collectCoinTiles(p);

    if (p.y > SCREEN_H) {
      this.killPlayer({ fell: true });
      return;
    }
    if (this.touchingLava(p)) {
      this.killPlayer({ fell: true });
      return;
    }
    const { flagX, axe } = this.level;
    if (flagX !== null && p.x + p.w >= flagX * TILE + 6) {
      this.beginFlag();
      return;
    }
    // Triggered by crossing, like the flag, so a running jump can't sail over the cup.
    if (axe && p.x + p.w >= axe.x) this.beginBridge();
  }

  setHeight(h) {
    const p = this.player;
    const bottom = p.y + p.h;
    p.h = h;
    p.y = bottom - h;
  }

  canStand() {
    const p = this.player;
    const top = p.y + p.h - BIG_H;
    const row = Math.floor(top / TILE);
    const left = Math.floor(p.x / TILE);
    const right = Math.ceil((p.x + p.w) / TILE) - 1;
    for (let tx = left; tx <= right; tx++) {
      if (isSolidChar(tileAt(this.level, tx, row))) return false;
    }
    return true;
  }

  setSize(size) {
    const p = this.player;
    p.size = size;
    p.crouch = false;
    p.rolling = 0;
    this.setHeight(size === 'small' ? SMALL_H : BIG_H);
    this.carrySize = size;
  }

  touchingLava(p) {
    const tx = Math.floor((p.x + p.w / 2) / TILE);
    const ty = Math.floor((p.y + p.h - 4) / TILE);
    return tileAt(this.level, tx, ty) === 'L';
  }

  throwFireball() {
    const p = this.player;
    if (this.entities.filter((e) => e.type === 'fireball').length >= 2) return;
    this.entities.push({
      type: 'fireball',
      x: p.facing > 0 ? p.x + p.w : p.x - 8,
      y: p.y + 6, w: 8, h: 8,
      vx: 4 * p.facing, vy: 2, anim: 0,
    });
    p.throwAnim = 8;
    this.sfx('fireball');
  }

  startRoll() {
    const p = this.player;
    p.rolling = PHYS.rollFrames;
    p.crouch = false;
    this.setHeight(SMALL_H);
    this.sfx('roll');
  }

  endRoll() {
    const p = this.player;
    p.rolling = 0;
    if (this.canStand()) this.setHeight(BIG_H);
    else p.crouch = true; // finished under a low ceiling: stay ducked until there's room
  }

  /** Rolling into bricks smashes them. Returns true if the way ahead was cleared. */
  rollThrough(dir) {
    const p = this.player;
    const tx = dir > 0 ? Math.ceil((p.x + p.w) / TILE) : Math.floor(p.x / TILE) - 1;
    const top = Math.floor(p.y / TILE);
    const bottom = Math.ceil((p.y + p.h) / TILE) - 1;
    let cleared = false;
    for (let ty = top; ty <= bottom; ty++) {
      const ch = tileAt(this.level, tx, ty);
      if (ch === 'B' && !this.level.contents.has(`${tx},${ty}`)) {
        this.breakBrick(tx, ty);
        cleared = true;
      } else if (isSolidChar(ch)) {
        return false;
      }
    }
    return cleared;
  }

  /** The slam lands: smash plain bricks underneath (when big) and keep going, or stop with a thud. */
  landPound() {
    const p = this.player;
    const row = Math.round((p.y + p.h) / TILE);
    const left = Math.floor(p.x / TILE);
    const right = Math.ceil((p.x + p.w) / TILE) - 1;
    let smashed = false;
    for (let tx = left; tx <= right; tx++) {
      const ch = tileAt(this.level, tx, row);
      const hasContent = this.level.contents.has(`${tx},${row}`);
      if (ch === '?' || (ch === 'B' && hasContent)) this.bumpTile(tx, row);
      else if (ch === 'B' && p.size !== 'small') {
        this.breakBrick(tx, row);
        smashed = true;
      }
    }
    if (smashed) {
      p.onGround = false;
      return;
    }
    p.pound = 0;
    this.shake = 10;
    this.sfx('pound');
    for (const dx of [-6, p.w + 2]) this.effects.push({ kind: 'puff', x: p.x + dx, y: p.y + p.h - 8, t: 12 });
  }

  breakBrick(tx, ty) {
    this.level.tiles[ty][tx] = ' ';
    this.addDebris(tx, ty);
    this.addScore(50);
    this.sfx('break');
  }

  hurtPlayer() {
    const p = this.player;
    if (p.invuln > 0 || p.star > 0 || p.dead) return;
    if (p.size !== 'small') {
      this.setSize('small');
      p.invuln = INVULN_FRAMES;
      this.freeze = 30;
      this.sfx('shrink');
    } else {
      this.killPlayer();
    }
  }

  killPlayer({ fell = false } = {}) {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    p.fell = fell;
    p.size = 'small';
    this.setHeight(SMALL_H);
    p.vx = 0;
    p.vy = fell ? 0 : -4.5;
    p.deathDelay = fell ? 0 : 30;
    p.star = 0;
    this.carrySize = 'small';
    this.setState('dying', 180);
    this.sfx('music:stop');
    this.sfx('die');
  }

  updateDying() {
    const p = this.player;
    if (!p.fell) {
      if (p.deathDelay > 0) p.deathDelay--;
      else {
        p.vy += 0.25;
        p.y += p.vy;
      }
    }
    this.updateEffects();
    if (--this.stateTimer > 0) return;
    this.lives--;
    if (this.lives > 0) {
      this.loadLevel(this.levelIndex);
      this.setState('intro', 150);
    } else {
      this.setState('gameover', 300);
      this.sfx('gameover');
    }
  }

  bounce() {
    const p = this.player;
    p.vy = -(this.input.jump ? PHYS.stompBounceHeld : PHYS.stompBounce);
    p.onGround = false;
  }

  // ───────────────────────────── score & coins ─────────────────────────────

  addScore(points, x, y) {
    this.score += points;
    if (x !== undefined) this.effects.push({ kind: 'text', text: String(points), x, y, t: 40 });
  }

  addCoin() {
    this.coins++;
    this.score += 200;
    this.sfx('coin');
    if (this.coins >= 100) {
      this.coins -= 100;
      this.gainLife();
    }
  }

  gainLife(x, y) {
    this.lives++;
    this.sfx('oneup');
    if (x !== undefined) this.effects.push({ kind: 'text', text: '1UP', x, y, t: 50 });
  }

  collectCoinTiles(body) {
    const left = Math.floor(body.x / TILE);
    const right = Math.ceil((body.x + body.w) / TILE) - 1;
    const top = Math.floor(body.y / TILE);
    const bottom = Math.ceil((body.y + body.h) / TILE) - 1;
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (tileAt(this.level, tx, ty) === 'C') {
          this.level.tiles[ty][tx] = ' ';
          this.addCoin();
        }
      }
    }
  }

  // ───────────────────────────── blocks ─────────────────────────────

  bumpFromBelow(hits) {
    const p = this.player;
    const centerTx = Math.floor((p.x + p.w / 2) / TILE);
    const hit = hits.find((h) => h.tx === centerTx) ?? hits[0];
    this.bumpTile(hit.tx, hit.ty);
  }

  bumpTile(tx, ty) {
    const level = this.level;
    const key = `${tx},${ty}`;
    const ch = tileAt(level, tx, ty);
    const content = level.contents.get(key);

    if (ch === '?' || ch === 'h' || (ch === 'B' && content)) {
      const item = content ?? { type: 'coin', count: 1 };
      this.releaseContent(tx, ty, item.type);
      const remaining = item.type === 'coins' ? --item.count : 0;
      if (remaining <= 0) {
        level.tiles[ty][tx] = 'U';
        level.contents.delete(key);
      }
      this.bumps.set(key, 8);
    } else if (ch === 'B') {
      if (this.player.size !== 'small') {
        this.breakBrick(tx, ty);
      } else {
        this.bumps.set(key, 8);
        this.sfx('bump');
      }
    } else {
      this.sfx('bump');
    }
    this.hitFromBelow(tx, ty);
  }

  releaseContent(tx, ty, type) {
    if (type === 'coin' || type === 'coins') {
      this.addCoin();
      this.effects.push({ kind: 'coin', x: tx * TILE, y: ty * TILE - 16, vy: -5, t: 30 });
      return;
    }
    const kind = {
      power: this.player.size === 'small' ? 'football' : POWER_ITEM[this.level.power ?? 'fire'],
      star: 'trophy',
      '1up': 'jersey',
    }[type];
    this.entities.push({
      type: kind, x: tx * TILE + 1, y: ty * TILE, w: 14, h: 16,
      vx: 0, vy: 0, emerge: 16, anim: 0,
    });
    this.sfx('item');
  }

  /** Anything standing on a block that gets bumped is knocked out. */
  hitFromBelow(tx, ty) {
    const zone = { x: tx * TILE, y: (ty - 1) * TILE, w: TILE, h: TILE };
    for (const e of this.entities) {
      if (ENEMIES.has(e.type) && e.state !== 'flip' && e.state !== 'flat' && overlaps(e, zone)) {
        this.flipKill(e, 100);
      } else if ((e.type === 'football' || e.type === 'jersey') && !e.emerge && overlaps(e, zone)) {
        e.vy = -3;
      }
    }
    if (tileAt(this.level, tx, ty - 1) === 'C') {
      this.level.tiles[ty - 1][tx] = ' ';
      this.addCoin();
      this.effects.push({ kind: 'coin', x: tx * TILE, y: (ty - 1) * TILE, vy: -5, t: 30 });
    }
  }

  addDebris(tx, ty) {
    const x = tx * TILE + 4;
    const y = ty * TILE + 4;
    for (const [dx, dy, vx, vy] of [[-4, -4, -1, -5], [4, -4, 1, -5], [-4, 4, -1, -3], [4, 4, 1, -3]]) {
      this.effects.push({ kind: 'debris', x: x + dx, y: y + dy, vx, vy, t: 60 });
    }
  }

  updateBumps() {
    for (const [key, t] of this.bumps) {
      if (t <= 1) this.bumps.delete(key);
      else this.bumps.set(key, t - 1);
    }
  }

  // ───────────────────────────── entities ─────────────────────────────

  spawnPending() {
    while (this.pending.length && this.pending[0].x < this.camX + SCREEN_W + 32) {
      this.entities.push(this.createEntity(this.pending.shift()));
    }
  }

  createEntity(spec) {
    switch (spec.type) {
      case 'defender':
        return { type: 'defender', x: spec.x + 1, y: spec.bottom - 14, w: 14, h: 14, vx: -0.5, vy: 0, state: 'walk', anim: 0 };
      case 'referee':
        return { type: 'referee', x: spec.x + 1, y: spec.bottom - 22, w: 14, h: 22, vx: -0.5, vy: 0, state: 'walk', anim: 0, idle: 0, kickGrace: 0 };
      case 'boss':
        return {
          type: 'boss', x: spec.x, y: spec.bottom - 30, w: 28, h: 30, vx: 0, vy: 0,
          hp: 5, home: spec.x, facing: -1, moveTimer: 60, fireTimer: 90, mouth: 0, hurt: 0,
          state: 'alive', onGround: false,
        };
      case 'firebar':
        return { type: 'firebar', x: spec.x, y: spec.cy - 8, w: 16, h: 16, cx: spec.cx, cy: spec.cy, length: spec.length, speed: spec.speed, angle: 0 };
      default:
        throw new Error(`Unknown spawn type ${spec.type}`);
    }
  }

  updateEntities() {
    const p = this.player;
    for (const e of this.entities) {
      if (e.remove) continue;
      if (e.emerge > 0) {
        this.updateEmerging(e);
        continue;
      }
      switch (e.type) {
        case 'defender':
        case 'referee':
          this.updateEnemy(e);
          break;
        case 'football':
        case 'jersey':
          this.updateWalkingItem(e, 0.25, () => {});
          break;
        case 'trophy':
          this.updateWalkingItem(e, 0.15, () => { e.vy = -4; });
          break;
        case 'blaze':
        case 'noodles':
        case 'feather':
          e.anim++;
          break;
        case 'fireball':
          this.updateFireball(e);
          break;
        case 'firebar':
          e.angle += e.speed;
          break;
        case 'boss':
          this.updateBoss(e);
          break;
        case 'bossfire':
          e.x += e.vx;
          e.y = approach(e.y, e.targetY, 0.5);
          if (e.x + e.w < this.camX - 16 || e.x > this.camX + SCREEN_W + 16) e.remove = true;
          break;
        default:
          break;
      }
      if (!p.dead && !e.remove && this.state === 'play') this.touchPlayer(e);
    }
    this.resolveEnemyPairs();
    this.entities = this.entities.filter((e) => !e.remove && !this.isOffstage(e));
  }

  isOffstage(e) {
    if (e.y > SCREEN_H + 32) return true;
    if (e.type === 'boss' || e.type === 'firebar') return false;
    return e.x + e.w < this.camX - 64;
  }

  updateEmerging(e) {
    e.y -= 1;
    if (--e.emerge > 0) return;
    if (e.type === 'football' || e.type === 'jersey') e.vx = 1;
    if (e.type === 'trophy') {
      e.vx = 1.2;
      e.vy = -4;
    }
  }

  updateWalkingItem(e, gravity, onLand) {
    e.anim++;
    e.vy = Math.min(e.vy + gravity, 4);
    const res = moveBody(e, this.level);
    if (res.wall) e.vx = -e.vx;
    if (res.landed) onLand();
  }

  updateEnemy(e) {
    e.anim++;
    if (e.state === 'flat') {
      if (--e.timer <= 0) e.remove = true;
      return;
    }
    if (e.state === 'flip') {
      e.vy += 0.3;
      e.x += e.vx;
      e.y += e.vy;
      return;
    }
    if (e.state === 'shell') {
      if (e.kickGrace > 0) e.kickGrace--;
      if (e.vx === 0 && ++e.idle > 360) {
        e.state = 'walk';
        const bottom = e.y + e.h;
        e.h = 22;
        e.y = bottom - 22;
        e.vx = this.player.x < e.x ? -0.5 : 0.5;
      }
    }
    e.vy = Math.min(e.vy + 0.3, 4);
    const res = moveBody(e, this.level);
    if (res.wall) {
      e.vx = -e.vx;
      if (e.state === 'shell' && this.onScreen(e)) this.sfx('bump');
    }
  }

  onScreen(e) {
    return e.x + e.w > this.camX && e.x < this.camX + SCREEN_W;
  }

  flipKill(e, points) {
    e.state = 'flip';
    e.vy = -3;
    e.vx = e.vx >= 0 ? 0.5 : -0.5;
    this.addScore(points, e.x, e.y);
    this.sfx('kick');
  }

  touchPlayer(e) {
    const p = this.player;
    if (ITEMS.has(e.type)) {
      if (overlaps(p, e)) {
        e.remove = true;
        this.collectItem(e);
      }
      return;
    }
    if (e.type === 'firebar') {
      if (this.firebarHits(e, p)) this.hurtPlayer();
      return;
    }
    if (!overlaps(p, e)) return;
    if (ENEMIES.has(e.type)) this.touchEnemy(e);
    else if (e.type === 'bossfire' || (e.type === 'boss' && e.state === 'alive')) this.hurtPlayer();
  }

  firebarHits(bar, p) {
    const hitbox = { x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 4 };
    for (let i = 0; i < bar.length; i++) {
      const bx = bar.cx + Math.cos(bar.angle) * i * 8;
      const by = bar.cy + Math.sin(bar.angle) * i * 8;
      if (overlaps(hitbox, { x: bx - 3, y: by - 3, w: 6, h: 6 })) return true;
    }
    return false;
  }

  collectItem(e) {
    const p = this.player;
    switch (e.type) {
      case 'football':
        if (p.size === 'small') this.powerUp('big');
        this.addScore(1000, e.x, e.y);
        break;
      case 'blaze':
      case 'noodles':
      case 'feather': {
        const power = ITEM_POWER[e.type];
        if (p.size === 'small') this.powerUp('big');
        else if (p.size !== power) this.powerUp(power);
        this.addScore(1000, e.x, e.y);
        break;
      }
      case 'trophy':
        p.star = STAR_FRAMES;
        this.addScore(1000, e.x, e.y);
        this.sfx('music:star');
        break;
      case 'jersey':
        this.gainLife(e.x, e.y);
        break;
      default:
        break;
    }
  }

  powerUp(size) {
    this.setSize(size);
    this.player.grow = 40;
    this.freeze = 40;
    this.sfx('powerup');
  }

  touchEnemy(e) {
    if (e.state === 'flip' || e.state === 'flat') return;
    const p = this.player;
    // The trophy, a roll and a ground pound all bowl defenders over on contact.
    if (p.star > 0 || p.rolling > 0 || p.pound < 0) {
      this.flipKill(e, 200);
      return;
    }
    const stomping = p.lastVy > 0 && p.prevBottom <= e.y + 8;

    if (e.state === 'shell') {
      if (e.kickGrace > 0) return;
      if (e.vx === 0) {
        e.vx = p.x + p.w / 2 < e.x + e.w / 2 ? SHELL_SPEED : -SHELL_SPEED;
        e.kickGrace = 12;
        this.addScore(400, e.x, e.y);
        this.sfx('kick');
        if (stomping) this.bounce();
      } else if (stomping) {
        e.vx = 0;
        e.idle = 0;
        e.kickGrace = 8;
        this.bounce();
        this.addScore(100, e.x, e.y);
        this.sfx('stomp');
      } else {
        this.hurtPlayer();
      }
      return;
    }

    if (!stomping) {
      this.hurtPlayer();
      return;
    }
    if (e.type === 'defender') {
      e.state = 'flat';
      e.timer = 30;
      e.vx = 0;
    } else {
      e.state = 'shell';
      const bottom = e.y + e.h;
      e.h = 14;
      e.y = bottom - 14;
      e.vx = 0;
      e.idle = 0;
      e.kickGrace = 8;
    }
    p.y = e.y - p.h;
    this.bounce();
    this.addScore(100, e.x, e.y);
    this.sfx('stomp');
  }

  /** Walkers turn around when they bump into each other; a sliding VAR flattens everyone. */
  resolveEnemyPairs() {
    const live = this.entities.filter((e) => ENEMIES.has(e.type) && !e.remove && e.state !== 'flip' && e.state !== 'flat');
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        if (a.state === 'flip' || b.state === 'flip' || !overlaps(a, b)) continue;
        const aSliding = a.state === 'shell' && a.vx !== 0;
        const bSliding = b.state === 'shell' && b.vx !== 0;
        if (aSliding || bSliding) {
          if (aSliding) this.flipKill(b, 500);
          if (bSliding) this.flipKill(a, 500);
        } else {
          const [l, r] = a.x < b.x ? [a, b] : [b, a];
          l.vx = -Math.abs(l.vx);
          r.vx = Math.abs(r.vx);
        }
      }
    }
  }

  updateFireball(e) {
    e.anim++;
    e.vy = Math.min(e.vy + 0.35, 4);
    const res = moveBody(e, this.level);
    if (res.landed) e.vy = -2.8;
    if (res.wall || !this.onScreen(e)) {
      this.popFireball(e);
      return;
    }
    for (const o of this.entities) {
      if (o.remove || !overlaps(e, o)) continue;
      if (ENEMIES.has(o.type) && o.state !== 'flip' && o.state !== 'flat') {
        this.flipKill(o, 200);
        this.popFireball(e);
        return;
      }
      if (o.type === 'boss' && o.state === 'alive') {
        this.hitBoss(o);
        this.popFireball(e);
        return;
      }
    }
  }

  popFireball(e) {
    e.remove = true;
    if (this.onScreen(e)) this.effects.push({ kind: 'puff', x: e.x, y: e.y, t: 12 });
  }

  // ───────────────────────────── boss: Mbappé Ditador ─────────────────────────────

  updateBoss(e) {
    if (e.hurt > 0) e.hurt--;
    if (e.state === 'dead') {
      e.vy += 0.2;
      e.y += e.vy;
      return;
    }
    const p = this.player;
    e.facing = p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1;
    if (--e.moveTimer <= 0) {
      e.vx = this.random() < 0.5 ? -0.6 : 0.6;
      e.moveTimer = 40 + Math.floor(this.random() * 80);
    }
    if (e.x < e.home - 48) e.vx = Math.abs(e.vx);
    if (e.x > e.home + 16) e.vx = -Math.abs(e.vx);
    if (e.onGround && this.random() < 0.012) e.vy = -3.5;
    e.vy = Math.min(e.vy + 0.15, 4);
    const res = moveBody(e, this.level);
    e.onGround = res.landed;
    if (res.wall) e.vx = -e.vx;

    if (e.mouth > 0) e.mouth--;
    if (--e.fireTimer <= 0) {
      if (this.onScreen(e)) {
        const target = p.y + p.h - 12;
        this.entities.push({
          type: 'bossfire', x: e.facing < 0 ? e.x - 20 : e.x + e.w - 2, y: e.y + 6, w: 22, h: 6, vx: 1.6 * e.facing,
          targetY: Math.max(4 * TILE, Math.min(target, GROUND_ROW * TILE - 8)), anim: 0,
        });
        e.mouth = 24;
        this.sfx('bossfire');
      }
      e.fireTimer = 110 + Math.floor(this.random() * 90);
    }
  }

  hitBoss(boss) {
    boss.hp--;
    boss.hurt = 20;
    if (boss.hp > 0) {
      this.sfx('bump');
      return;
    }
    boss.state = 'dead';
    boss.vy = -3;
    boss.vx = 0;
    this.addScore(5000, boss.x, boss.y);
    this.sfx('bossdie');
  }

  // ───────────────────────────── effects & camera ─────────────────────────────

  updateEffects() {
    for (const fx of this.effects) {
      fx.t--;
      if (fx.kind === 'text') fx.y -= 0.6;
      else if (fx.kind === 'coin') {
        fx.y += fx.vy;
        fx.vy += 0.35;
        if (fx.t === 1) this.effects.push({ kind: 'text', text: '200', x: fx.x, y: fx.y, t: 30 });
      } else if (fx.kind === 'debris') {
        fx.x += fx.vx;
        fx.y += fx.vy;
        fx.vy += 0.3;
      } else if (fx.kind === 'confetti') {
        fx.x += fx.vx;
        fx.y += fx.vy;
        fx.vx *= 0.98;
        fx.vy = Math.min(fx.vy + 0.06, 1.2);
      }
    }
    this.effects = this.effects.filter((fx) => fx.t > 0 && fx.y < SCREEN_H + 16);
  }

  updateCamera() {
    const p = this.player;
    const target = p.x + p.w / 2 - SCREEN_W * 0.45;
    const max = this.level.width * TILE - SCREEN_W;
    if (target > this.camX) this.camX = Math.min(target, max);
  }

  // ───────────────────────────── pipes & the bonus room ─────────────────────────────

  /** Standing on the warp pipe holding ↓ sends Neymario down into the bonus room. */
  tryEnterPipe() {
    const p = this.player;
    const warp = this.level.warp;
    if (!warp || this.areaName !== 'main') return false;
    const left = warp.x * TILE;
    if (p.y + p.h !== warp.top * TILE || p.x < left + 2 || p.x + p.w > left + 2 * TILE - 2) return false;
    this.beginPipe('down');
    return true;
  }

  atSideExit() {
    const exit = this.level.sideExit;
    if (!exit) return false;
    const p = this.player;
    const foot = Math.floor((p.y + p.h - 1) / TILE);
    return Math.ceil((p.x + p.w) / TILE) === exit.x && (foot === exit.row || foot === exit.row + 1);
  }

  beginPipe(dir) {
    const p = this.player;
    if (p.rolling || p.crouch) {
      p.rolling = 0;
      p.crouch = false;
      this.setHeight(p.size === 'small' ? SMALL_H : BIG_H);
    }
    p.vx = 0;
    p.vy = 0;
    p.pound = 0;
    p.inPipe = true;
    this.entities = this.entities.filter((e) => e.type !== 'fireball');
    this.seq = { phase: dir, t: dir === 'down' ? p.h + 4 : 24 };
    this.setState('pipe');
    this.sfx('pipe');
  }

  updatePipe() {
    const p = this.player;
    const s = this.seq;
    this.updateEffects();
    switch (s.phase) {
      case 'down':
        p.y += 1;
        if (--s.t <= 0) this.enterBonus();
        break;
      case 'right':
        p.x += 1;
        if (--s.t <= 0) this.returnToMain();
        break;
      case 'rise':
        p.y -= 1;
        if (p.y + p.h <= s.top) {
          p.y = s.top - p.h;
          p.inPipe = false;
          p.onGround = true;
          this.setState('play');
        }
        break;
      default:
        break;
    }
  }

  switchArea(name) {
    this.areaName = name;
    this.level = this.areas[name];
    this.entities = [];
    this.effects = [];
    this.bumps = new Map();
  }

  enterBonus() {
    const p = this.player;
    this.mainPending = this.pending;
    this.switchArea('bonus');
    this.pending = this.level.spawns.map((sp) => ({ ...sp }));
    this.camX = 0;
    p.x = this.level.spawn.x;
    p.y = 3 * TILE;
    p.inPipe = false;
    p.onGround = false;
    this.setState('play');
    this.sfx(`music:${this.level.theme}`);
  }

  /** Back to the main area, rising out of the exit pipe further along the level. */
  returnToMain() {
    const p = this.player;
    this.switchArea('main');
    const { exit } = this.level;
    p.x = exit.x * TILE + TILE - p.w / 2;
    p.y = exit.top * TILE;
    p.facing = 1;
    const max = this.level.width * TILE - SCREEN_W;
    this.camX = Math.max(0, Math.min(p.x + p.w / 2 - SCREEN_W * 0.45, max));
    // Enemies the camera already passed stay gone, like the original.
    this.pending = this.mainPending.filter((sp) => sp.x >= this.camX);
    this.seq = { phase: 'rise', top: exit.top * TILE };
    this.sfx('pipe');
    this.sfx(`music:${this.level.theme}`);
  }

  // ───────────────────────────── end of level: corner flag & goal ─────────────────────────────

  beginFlag() {
    const p = this.player;
    const poleX = this.level.flagX * TILE + 8;
    p.x = poleX - p.w;
    p.vx = 0;
    p.vy = 0;
    p.facing = 1;
    p.pound = 0;
    p.rolling = 0;
    p.crouch = false;
    if (p.size !== 'small' && p.h !== BIG_H) this.setHeight(BIG_H);
    const points = p.y < 4 * TILE ? 5000 : p.y < 6 * TILE ? 2000 : p.y < 8 * TILE ? 800 : p.y < 10 * TILE ? 400 : 100;
    this.addScore(points, poleX + 6, p.y);
    this.entities = this.entities.filter((e) => e.type !== 'fireball');
    this.seq = { phase: 'slide', flagY: 3 * TILE + 4, t: 0 };
    this.setState('flag');
    this.sfx('music:stop');
    this.sfx('flag');
  }

  updateFlag() {
    const p = this.player;
    const s = this.seq;
    const base = (GROUND_ROW - 1) * TILE;
    const poleX = this.level.flagX * TILE + 8;
    this.updateEffects();
    switch (s.phase) {
      case 'slide': {
        p.y = Math.min(p.y + 2, base - p.h);
        s.flagY = Math.min(s.flagY + 2, base - 12);
        if (p.y + p.h >= base && s.flagY >= base - 12) {
          s.phase = 'hop';
          s.t = 20;
          p.x = poleX + 1;
          p.facing = -1;
        }
        break;
      }
      case 'hop':
        if (--s.t <= 0) this.beginCelebration(s);
        break;
      default:
        this.updateCelebration(s, () => this.nextLevel());
        break;
    }
  }

  /** Neymario dribbles a ball up to the goal, shoots, and the stadium erupts. */
  beginCelebration(s) {
    const p = this.player;
    p.facing = 1;
    if (this.level.castleX === null) {
      s.phase = 'tally';
      return;
    }
    s.phase = 'walk';
    s.ball = { x: p.x + p.w + 2, y: GROUND_ROW * TILE - 8, spin: 0 };
    s.bulge = 0;
    this.sfx('whistle');
  }

  updateCelebration(s, onFinish) {
    const p = this.player;
    const groundY = GROUND_ROW * TILE;
    const goalX = this.level.castleX * TILE;
    const stepPlayer = (vx) => {
      p.vx = vx;
      p.vy = Math.min(p.vy + PHYS.gravity, PHYS.maxFall);
      p.onGround = moveBody(p, this.level).landed;
      p.anim += p.onGround ? Math.abs(p.vx) : 0;
    };
    switch (s.phase) {
      case 'walk': {
        const kickX = goalX - 40;
        stepPlayer(p.x + p.w < kickX ? 1.2 : 0);
        this.updateCamera();
        s.ball.x = p.x + p.w + 2 + Math.abs(Math.sin(this.frame / 6)) * 4;
        s.ball.spin += p.vx;
        if (p.vx === 0 && p.onGround) {
          s.phase = 'kick';
          s.t = 14;
        }
        break;
      }
      case 'kick':
        stepPlayer(0);
        if (--s.t <= 0) {
          s.phase = 'fly';
          s.flight = { x0: s.ball.x, y0: s.ball.y, x1: goalX + 40, y1: groundY - 30, t: 0, n: 32 };
          this.sfx('kick');
        }
        break;
      case 'fly': {
        stepPlayer(0);
        const f = s.flight;
        const k = ++f.t / f.n;
        s.ball.x = f.x0 + (f.x1 - f.x0) * k;
        s.ball.y = f.y0 + (f.y1 - f.y0) * k - 48 * k * (1 - k);
        s.ball.spin += 3;
        if (f.t >= f.n) {
          s.phase = 'goal';
          s.t = 150;
          s.bulge = 10;
          this.addScore(5000, goalX + 16, groundY - 60);
          this.sfx('goal');
          this.confetti(60);
        }
        break;
      }
      case 'goal':
        // Ball drops into the bulging net while Neymario jumps for joy.
        s.bulge = Math.max(0, s.bulge - 0.25);
        s.ball.y = Math.min(s.ball.y + 1.5, groundY - 8);
        if (p.onGround && s.t % 40 === 0) p.vy = -3.6;
        stepPlayer(0);
        if (s.t % 6 === 0) this.confetti(6);
        if (--s.t <= 0) s.phase = 'tally';
        break;
      case 'tally':
        stepPlayer(0);
        if (this.tallyTime()) {
          s.phase = 'done';
          s.t = 60;
        }
        break;
      case 'done':
        if (--s.t <= 0) onFinish();
        break;
      default:
        break;
    }
  }

  confetti(n) {
    const colors = ['#ffdf00', '#009c3b', '#1f3fae', '#ffffff'];
    for (let i = 0; i < n; i++) {
      this.effects.push({
        kind: 'confetti',
        x: this.camX + this.random() * SCREEN_W,
        y: 30 + this.random() * 40,
        vx: (this.random() - 0.5) * 2,
        vy: this.random() * 0.5,
        color: colors[Math.floor(this.random() * colors.length)],
        t: 120,
      });
    }
  }

  /** Converts leftover time to points, a little per frame. Returns true when done. */
  tallyTime() {
    if (this.time <= 0) return true;
    const n = Math.min(this.time, 2);
    this.time -= n;
    this.score += 50 * n;
    if (this.frame % 4 === 0) this.sfx('tick');
    return false;
  }

  nextLevel() {
    if (this.levelIndex + 1 < this.levels.length) {
      this.loadLevel(this.levelIndex + 1);
      this.setState('intro', 150);
    } else {
      this.win();
    }
  }

  win() {
    this.setState('victory', 120);
    this.sfx('victory');
  }

  // ───────────────────────────── end of game: the bridge ─────────────────────────────

  beginBridge() {
    const p = this.player;
    const { axe } = this.level;
    // Make sure he overlaps the solid ground past the cup, so he lands there
    // instead of riding the collapsing bridge into the lava.
    if (axe && p.x + p.w < axe.x + 4) p.x = axe.x + 4 - p.w;
    p.vx = 0;
    p.vy = Math.max(p.vy, 0);
    this.entities = this.entities.filter((e) => e.type !== 'fireball' && e.type !== 'bossfire');
    this.seq = { phase: 'collapse', col: this.level.bridge ? this.level.bridge.x1 : -1, t: 0 };
    this.setState('bridge');
    this.sfx('music:stop');
  }

  updateBridge() {
    const s = this.seq;
    const bridge = this.level.bridge;
    const p = this.player;
    this.updateEffects();
    if (s.phase === 'collapse' || s.phase === 'fall') {
      // Neymario drops straight down if he crossed the cup mid-jump.
      p.vx = 0;
      p.vy = Math.min(p.vy + PHYS.gravity, PHYS.maxFall);
      p.onGround = moveBody(p, this.level).landed;
    }
    for (const boss of this.entities.filter((e) => e.type === 'boss')) {
      boss.vx = 0;
      boss.vy = Math.min(boss.vy + 0.2, 5);
      if (boss.state === 'dead') boss.y += boss.vy;
      else moveBody(boss, this.level);
      if (boss.y > SCREEN_H + 32) boss.remove = true;
    }
    this.entities = this.entities.filter((e) => !e.remove);

    switch (s.phase) {
      case 'collapse':
        if (++s.t % 4 !== 0) break;
        if (bridge && s.col >= bridge.x0) {
          this.level.tiles[bridge.row][s.col] = ' ';
          s.col--;
          this.sfx('break');
        } else {
          s.phase = 'fall';
          s.t = 90;
          if (this.entities.some((e) => e.type === 'boss')) this.sfx('bossdie');
        }
        break;
      case 'fall': {
        // Wait for the boss to sink, but never hang if something kept him on solid ground.
        const bossGone = !this.entities.some((e) => e.type === 'boss');
        if (--s.t <= 0 && (bossGone || s.t < -240)) this.beginCelebration(s);
        break;
      }
      default:
        this.updateCelebration(s, () => this.win());
        break;
    }
  }
}
