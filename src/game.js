import {
  TILE, SCREEN_W, SCREEN_H, GROUND_ROW, PHYS, PLAYER_W, SMALL_H, BIG_H, TIME_TICK,
} from './constants.js';
import { LEVELS, buildLevel } from './levels.js';
import { moveBody, overlaps, tileAt, isSolidChar } from './physics.js';

export const NO_INPUT = Object.freeze({
  left: false, right: false, down: false, jump: false, run: false, start: false, pause: false,
});

const ENEMIES = new Set(['defender', 'referee']);
const ITEMS = new Set(['football', 'blaze', 'trophy', 'goldball']);
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
 * States: title → intro → play ⇄ (dying | flag | bridge) → gameover | victory.
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
    this.levelIndex = index;
    this.level = buildLevel(this.levels[index]);
    this.time = this.level.time;
    this.timeTick = 0;
    this.camX = 0;
    this.entities = [];
    this.effects = [];
    this.pending = this.level.spawns.map((s) => ({ ...s }));
    this.bumps = new Map();
    this.freeze = 0;
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
      dead: false, fell: false, deathDelay: 0, hidden: false,
      prevBottom: 0, lastVy: 0,
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
    if (p.star > 0 && --p.star === 0) this.sfx(`music:${this.level.theme}`);

    if (p.size !== 'small' && p.onGround && inp.down !== p.crouch) {
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
    if (dir !== 0 && !(p.crouch && p.onGround)) {
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

    if (pressed('jump') && p.onGround) {
      p.vy = -(PHYS.jumpVel + Math.abs(p.vx) * PHYS.jumpRunBonus);
      p.onGround = false;
      this.sfx(p.size === 'small' ? 'jump' : 'jumpBig');
    }
    const gravity = p.vy < 0 && inp.jump ? PHYS.gravityHold : PHYS.gravity;
    p.vy = Math.min(p.vy + gravity, PHYS.maxFall);

    if (pressed('run') && p.size === 'fire' && !p.crouch) this.throwFireball();

    p.prevBottom = p.y + p.h;
    p.lastVy = p.vy;
    const res = moveBody(p, this.level, { hiddenBlocks: true });
    if (res.wall) p.vx = 0;
    p.onGround = res.landed;
    if (res.ceiling.length) this.bumpFromBelow(res.ceiling);

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
        level.tiles[ty][tx] = ' ';
        this.addDebris(tx, ty);
        this.addScore(50);
        this.sfx('break');
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
      power: this.player.size === 'small' ? 'football' : 'blaze',
      star: 'trophy',
      '1up': 'goldball',
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
      } else if ((e.type === 'football' || e.type === 'goldball') && !e.emerge && overlaps(e, zone)) {
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
        case 'goldball':
          this.updateWalkingItem(e, 0.25, () => {});
          break;
        case 'trophy':
          this.updateWalkingItem(e, 0.15, () => { e.vy = -4; });
          break;
        case 'blaze':
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
    if (e.type === 'football' || e.type === 'goldball') e.vx = 1;
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
        if (p.size === 'small') this.powerUp('big');
        else if (p.size === 'big') this.powerUp('fire');
        this.addScore(1000, e.x, e.y);
        break;
      case 'trophy':
        p.star = STAR_FRAMES;
        this.addScore(1000, e.x, e.y);
        this.sfx('music:star');
        break;
      case 'goldball':
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
    if (p.star > 0) {
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

  // ───────────────────────────── end of level: corner flag ─────────────────────────────

  beginFlag() {
    const p = this.player;
    const poleX = this.level.flagX * TILE + 8;
    p.x = poleX - p.w;
    p.vx = 0;
    p.vy = 0;
    p.facing = 1;
    p.crouch = false;
    if (p.size !== 'small' && p.h !== BIG_H) this.setHeight(BIG_H);
    const points = p.y < 4 * TILE ? 5000 : p.y < 6 * TILE ? 2000 : p.y < 8 * TILE ? 800 : p.y < 10 * TILE ? 400 : 100;
    this.addScore(points, poleX + 6, p.y);
    this.entities = this.entities.filter((e) => e.type !== 'fireball');
    this.seq = { phase: 'slide', flagY: 3 * TILE + 4, t: 0, raised: 0 };
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
        if (--s.t <= 0) {
          s.phase = 'walk';
          p.facing = 1;
          this.sfx('clear');
        }
        break;
      case 'walk': {
        p.vx = 1.2;
        p.vy = Math.min(p.vy + PHYS.gravity, PHYS.maxFall);
        const res = moveBody(p, this.level);
        p.onGround = res.landed;
        p.anim += p.onGround ? p.vx : 0;
        this.updateCamera();
        if (p.x >= (this.level.castleX + 2) * TILE) {
          p.hidden = true;
          p.vx = 0;
          s.phase = 'tally';
        }
        break;
      }
      case 'tally':
        if (this.tallyTime()) {
          s.phase = 'done';
          s.t = 90;
        }
        break;
      case 'done':
        s.raised = Math.min(s.raised + 1, 16);
        if (--s.t <= 0) this.nextLevel();
        break;
      default:
        break;
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
    p.vx = 0;
    p.vy = 0;
    this.entities = this.entities.filter((e) => e.type !== 'fireball' && e.type !== 'bossfire');
    this.seq = { phase: 'collapse', col: this.level.bridge ? this.level.bridge.x1 : -1, t: 0 };
    this.setState('bridge');
    this.sfx('music:stop');
  }

  updateBridge() {
    const s = this.seq;
    const bridge = this.level.bridge;
    this.updateEffects();
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
        if (--s.t <= 0 && (bossGone || s.t < -240)) s.phase = 'tally';
        break;
      }
      case 'tally':
        if (this.tallyTime()) this.win();
        break;
      default:
        break;
    }
  }
}
