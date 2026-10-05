export const TILE = 16;
export const ROWS = 15;
export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const GROUND_ROW = 13;

// Movement tuning, in pixels per frame at 60 fps. Loosely modelled on the NES original.
export const PHYS = {
  walkAccel: 0.055,
  runAccel: 0.085,
  walkMax: 1.5,
  runMax: 2.6,
  friction: 0.09,
  skidDecel: 0.18,
  airTurn: 0.08,
  jumpVel: 4.3,
  jumpRunBonus: 0.17,
  gravity: 0.42,
  gravityHold: 0.12,
  maxFall: 4.5,
  stompBounce: 3.6,
  stompBounceHeld: 5.0,
  // Extra moves.
  poundWindup: 12,
  poundSpeed: 6,
  wallSlide: 1.2,
  wallGraceFrames: 6,
  wallJumpX: 2.2,
  wallLock: 12,
  rollSpeed: 3.2,
  rollFrames: 45,
  glideFall: 1.0,
  flapVel: 3.6,
};

export const PLAYER_W = 12;
export const SMALL_H = 15;
export const BIG_H = 30;

// Frames per in-game clock second (the NES clock runs faster than real time).
export const TIME_TICK = 24;
