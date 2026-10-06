export const TILE = 16;
export const ROWS = 15;
export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const GROUND_ROW = 13;

// Movement tuning, in pixels per frame at 60 fps: the NES original's values,
// converted from its sub-pixel units. Mario builds up speed, slides when you
// let go, skids when you turn around, and jumps higher the faster he runs.
export const PHYS = {
  minWalk: 0.0742, // starting speed from a standstill
  walkAccel: 0.0371,
  runAccel: 0.0557,
  releaseDecel: 0.0508, // sliding to a stop after letting go
  skidFactor: 2, // skidding brakes at twice the current acceleration
  skidTurn: 0.5625, // below this while skidding, he turns right round
  walkMax: 1.5,
  runMax: 2.5,
  runTimer: 10, // frames he keeps sprint top speed after letting go of run
  airRunSpeed: 1.5625, // in the air, sprint top speed and acceleration apply only above this
  // Jump launch and gravity depend on horizontal speed at take-off: [speed below, launch, gravity holding jump, gravity otherwise].
  jumps: [
    { below: 1.0, vel: 4.0, hold: 0.125, fall: 0.4375 },
    { below: 1.5625, vel: 4.0, hold: 0.1172, fall: 0.375 },
    { below: Infinity, vel: 5.0, hold: 0.1563, fall: 0.5625 },
  ],
  // In mid-air you keep momentum: turning back is slower than on the ground.
  airBrakeFast: 0.0508, // turning back after a fast take-off
  maxFall: 4.5,
  // Simple falls (celebrations, bridges) use the standing-jump gravity.
  gravity: 0.4375,
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
  // Spin jump (SMW) and mid-air twirl.
  spinVelDrop: 0.4, // a spin jump launches a little lower than a normal one
  spinBounce: 3.2, // hop after spin-landing on an enemy
  twirlLift: 2.0, // the mid-air twirl's little boost
  twirlFrames: 24,
  twirlFall: 1.5, // fall speed cap while twirling
  // Trampoline pads: launch speed, and how long the launch floats as if jump were held.
  springLaunch: 6.0,
  springHeldBonus: 0.5,
  springFloat: 36,
  // Ice cuts grip: acceleration, friction and skid are scaled by these.
  iceAccel: 0.4,
  iceFriction: 0.12,
  iceSkid: 0.25,
};

export const PLAYER_W = 12;
export const SMALL_H = 15;
export const BIG_H = 30;

// Frames per in-game clock second (the NES clock runs faster than real time).
export const TIME_TICK = 24;
