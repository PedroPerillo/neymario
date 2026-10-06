import { TILE, ROWS } from './constants.js';

// I ice, X shipping container, K ball cannon, G the gate in front of the cup.
const SOLID = new Set(['#', 'B', 'S', '?', 'U', '[', ']', '{', '}', '=', '(', ')', '-', '_', 'I', 'X', 'K', 'G']);

export const isSolidChar = (ch) => SOLID.has(ch);

// Outside the level horizontally is a wall; above and below are open air (pits).
export function tileAt(level, tx, ty) {
  if (tx < 0 || tx >= level.width) return 'S';
  if (ty < 0 || ty >= ROWS) return ' ';
  return level.tiles[ty][tx];
}

export const solidAt = (level, tx, ty) => isSolidChar(tileAt(level, tx, ty));

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Tile index ranges covered by a span [start, start + size).
const firstTile = (start) => Math.floor(start / TILE);
const lastTile = (start, size) => Math.ceil((start + size) / TILE) - 1;

/**
 * Moves an axis-aligned body by its velocity, resolving tile collisions one
 * axis at a time. Velocity is left untouched except for vy on vertical hits;
 * callers decide how to react to walls (stop, bounce, reverse).
 *
 * `hiddenBlocks` lets the body hit invisible 'h' blocks, but only when its
 * head crosses the block's underside this frame.
 */
export function moveBody(body, level, { hiddenBlocks = false } = {}) {
  const result = { wall: 0, landed: false, ceiling: [] };

  if (body.vx !== 0) {
    body.x += body.vx;
    const top = firstTile(body.y);
    const bottom = lastTile(body.y, body.h);
    const col = body.vx > 0 ? lastTile(body.x, body.w) : firstTile(body.x);
    for (let ty = top; ty <= bottom; ty++) {
      if (!solidAt(level, col, ty)) continue;
      if (body.vx > 0) {
        body.x = col * TILE - body.w;
        result.wall = 1;
      } else {
        body.x = (col + 1) * TILE;
        result.wall = -1;
      }
      break;
    }
  }

  const prevTop = body.y;
  body.y += body.vy;
  const left = firstTile(body.x);
  const right = lastTile(body.x, body.w);

  if (body.vy > 0) {
    const row = lastTile(body.y, body.h);
    for (let tx = left; tx <= right; tx++) {
      if (solidAt(level, tx, row)) {
        body.y = row * TILE - body.h;
        body.vy = 0;
        result.landed = true;
        break;
      }
    }
  } else if (body.vy < 0) {
    const row = firstTile(body.y);
    for (let tx = left; tx <= right; tx++) {
      const ch = tileAt(level, tx, row);
      const hitsHidden = hiddenBlocks && ch === 'h' && prevTop >= (row + 1) * TILE;
      if (isSolidChar(ch) || hitsHidden) result.ceiling.push({ tx, ty: row });
    }
    if (result.ceiling.length) {
      body.y = (row + 1) * TILE;
      body.vy = 0;
    }
  }

  return result;
}
